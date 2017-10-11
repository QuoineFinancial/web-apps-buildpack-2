// This will do many stuffs based on S3 bucket name
// The app need to know the AWS_S3_BUCKET

const { exec, execSync } = require('child_process');
const fs = require('fs');

const { apps, appUrlKeys } = require('./config');
const dns = require('./dns');
const domain = require('./domain');
const cloudfront = require('./cloudfront');

const LOG_PREFIX = ' '.repeat(6);
const ARROW_PREFIX = '----->';

const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;
const BUILD_DIR = process.env.BUILD_DIR;
const AWS_CLI = `${BUILD_DIR}/bin/aws`;

const getS3URL = bucket => new Promise((resolve, reject) => {
  exec(`${AWS_CLI} s3api get-bucket-location --bucket ${bucket}`, (error, stdout, stderr) => {
    if (error) {
      console.log(stderr);
      reject(error);
    }

    const response = JSON.parse(stdout);
    const region = response.LocationConstraint;
    const url = `${bucket}.s3-website-${region}.amazonaws.com`;
    resolve(url);
  });
});

const getOrigin = distribution => {
  const originId = distribution.DefaultCacheBehavior.TargetOriginId;
  return distribution.Origins.Items.find(item => (item.Id === originId));
};

const getApp = distribution => (
  getOrigin(distribution).OriginPath.replace('/', '')
);

const isInvalid = distribution => {
  const app = getApp(distribution);

  if (distribution.Aliases.Items) {
    const appDomain = domain(AWS_S3_BUCKET, app).replace('https://', '');
    if (distribution.Aliases.Items.indexOf(appDomain) > -1) {
      console.log(LOG_PREFIX, `- Distribution ${distribution.Id} for ${appDomain} is valid.`);
      return false;
    }
  }

  return true;
};

const getDistributions = s3URL => new Promise((resolve, reject) => {
  const matchedS3Bucket = distribution => {
    const DomainName = getOrigin(distribution).DomainName;
    return (DomainName.indexOf(AWS_S3_BUCKET) > -1);
  };

  const isEnabled = distribution => (distribution.Enabled === true);

  exec(`${AWS_CLI} cloudfront list-distributions`, { maxBuffer: 10000 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      console.log(stderr);
      reject(error);
    }

    const distributions = JSON
      .parse(stdout).DistributionList.Items
      .filter(isEnabled)
      .filter(matchedS3Bucket);

    resolve({ s3URL, distributions });
  });
});

// Update distributon to the right config
const updateDistribution = distribution => new Promise((resolve, reject) => {
  const appDomain = domain(AWS_S3_BUCKET, getApp(distribution)).replace('https://', '');
  console.log(LOG_PREFIX, `- Distribution ${distribution.Id} for ${appDomain} need to update.`);

  const updateCommand = (ETag, configFile) => {
    // console.log(`${AWS_CLI} cloudfront update-distribution --id ${distribution.Id} --distribution-config file://${configFile} --if-match ${ETag}`);
    exec(`${AWS_CLI} cloudfront update-distribution --id ${distribution.Id} --distribution-config file://${configFile} --if-match ${ETag}`,
      (error, stdout, stderr) => {
        if (error) {
          console.log(stderr);
          return reject(error);
        }
        exec(`rm -rf ./${configFile}`, (error) => {
          if (error) {
            return; // Not reject anymore
          }
        });
        resolve(JSON.parse(stdout));
      });
  }

  exec(`${AWS_CLI} cloudfront get-distribution --id ${distribution.Id}`, (error, stdout) => {
    if (error) {
      return reject(error);
    }

    const response = JSON.parse(stdout);
    const ETag = response.ETag;
    const CallerReference = response.Distribution.DistributionConfig.CallerReference;

    const origin = getOrigin(distribution);
    const config = cloudfront(origin.DomainName + origin.OriginPath, appDomain, CallerReference, origin.Id);
    const configFile = `${appDomain}.json`;
    // Write config
    fs.writeFile(`./${configFile}`, JSON.stringify(config, null, 2), (error) => {
      if (error) {
        return reject(error);
      }
      // Then update
      updateCommand(ETag, configFile);
    });
  });
});

// Validate the distributions, if someone is wrong, it will fix
const validateDistributions = ({ s3URL, distributions }) => {
  console.log();
  console.log(ARROW_PREFIX, 'Checking distributions...');

  distributions
    .filter(isInvalid)
    .forEach(updateDistribution);
  // We don't need to wait distribution update
  // Just pass to next step

  return { s3URL, distributions };
};

const createDistribution = ({ origin, cname }) => new Promise((resolve, reject) => {
  const config = require('./cloudfront')(origin, cname);
  fs.writeFile(`./${cname}.json`, JSON.stringify(config), (error) => {
    if (error) {
      throw error;
    }

    exec(`${AWS_CLI} cloudfront create-distribution --distribution-config file://${cname}.json`, (error, stdout, stderr) => {
      if (error) {
        console.log(error);
        return reject(error);
      }

      const response = JSON.parse(stdout);
      const distribution = response.Distribution.DistributionConfig;
      distribution.Id = response.Distribution.Id;
      distribution.DomainName = response.Distribution.DomainName;

      console.log(LOG_PREFIX, `- Distribution ${distribution.Id} for ${cname} created.`);

      exec(`rm -rf ${cname}.json`); // Remove file after used
      resolve(distribution);
    });
  })
});

const addMissingDistributions = ({ s3URL, distributions }) => new Promise((resolve, reject) => {
  const cloudfrontApps = distributions.map(getOrigin).map(origin => origin.OriginPath.replace('/', ''));
  const missingApps = apps.filter(app => cloudfrontApps.indexOf(app) === -1);
  const getCreateConfig = app => ({
    origin: `${s3URL}/${app}`,
    cname: domain(AWS_S3_BUCKET, app).replace('https://', '')
  });

  Promise.all(
    missingApps
      .map(getCreateConfig)
      .map(createDistribution)
  ).then(newDistributions => {
    resolve(distributions.concat(newDistributions));
  });

});

const invalidateDistributions = (distributions) => new Promise((resolve, reject) => {
  console.log();
  console.log(ARROW_PREFIX, 'Creating invalidation...');

  execSync(`${AWS_CLI} configure set preview.cloudfront true`);
  distributions.map((distribution, index, all) => {
    const app = getApp(distribution);
    const appDomain = domain(AWS_S3_BUCKET, app).replace('https://', '');
    console.log(LOG_PREFIX, `- ${appDomain}...`);
    execSync(`${AWS_CLI} cloudfront create-invalidation --distribution-id ${distribution.Id} --paths "/*"`);
  });

  resolve(distributions);
});

const updateCloudFlareDNS = (distributions) => {
  console.log();
  console.log(ARROW_PREFIX, 'Checking DNS...');

  const EMAIL = process.env.CLOUDFLARE_EMAIL;
  const KEY = process.env.CLOUDFLARE_KEY;
  if (!(EMAIL && KEY)) {
    console.log(LOG_PREFIX, 'No CLOUDFLARE_EMAIL or CLOUDFLARE_KEY provided.');
    console.log(LOG_PREFIX, 'Please check CloudFlare manually.');
    return;
  }

  distributions.forEach(distribution => {
    const app = getApp(distribution);
    const appDomain = domain(AWS_S3_BUCKET, app).replace('https://', '');
    dns(appDomain, distribution.DomainName);
  })
}

getS3URL(AWS_S3_BUCKET)
  .then(getDistributions)
  .then(validateDistributions)
  .then(addMissingDistributions)
  .then(invalidateDistributions)
  .then(updateCloudFlareDNS)
  .catch((error) => {
    throw error;
  });
