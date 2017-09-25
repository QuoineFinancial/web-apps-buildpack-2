// This file help install and build parallel
// But it's not completed yet
// Now we will install and build one by one
// Until this is completed too

const { exec, execSync } = require(`child_process`);
const apps = [`accounts`, `trade`, `balance`, `chart`];

let completed = 0;

const BUILD_DIR = process.env.BUILD_DIR;
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;

const deploy = () => {
  console.log(`-----> Deploy to S3 and CDN`);
  execSync(`${BUILD_DIR}/bin/aws s3 sync ${BUILD_DIR}/dist/ s3://${AWS_S3_BUCKET} --delete`);
  execSync(`${BUILD_DIR}/bin/aws configure set preview.cloudfront true`);
}

const invalidate = () => {
  exec(`${BUILD_DIR}/bin/aws cloudfront list-distributions`, (err, stdout, stderr) => {
    if (err) {
      return console.log(stderr);
    }

    const distributions = JSON.parse(stdout).DistributionList.Items;
    const matchedS3Bucket = name => (name.indexOf(AWS_S3_BUCKET) > -1);
    console.log(`-----> Invalidate CloudFront`);

    distributions.filter(distribution => matchedS3Bucket(distribution.DefaultCacheBehavior.TargetOriginId)).forEach(distribution => {
      console.log(`        Distributions Id:` + distribution.Id);
      execSync(`${BUILD_DIR}/bin/aws cloudfront create-invalidation --distribution-id ${distribution.Id} --paths "/*"`)
    });
  });
}

const build = apps.forEach((app, index) => {
  console.log('-----> Build all apps');

  execSync(`export "REACT_APP_APP=${app}"`);
  // Here we got a problem
  // When we build async
  // The new app might change the REACT_APP_APP
  // Cause old build (has not completed yet) broken

  console.log(`             [${index + 1}/${apps.length}] ${REACT_APP_APP}...`);

  execSync(`cd ${BUILD_DIR}/${app}`);
  exec(`yarn run build`, (err, stdout) => {
    if (err) {
      console.log(`echo "       Failed."`);
      execSync(`exit 1`);
    }

    execSync(`mkdir ${BUILD_DIR}/dist/${app}`);
    execSync(`cp -R ${BUILD_DIR}/${app}/build/. ${BUILD_DIR}/dist/${app}`);
    completed++;

    if (completed === apps.length) {
      deploy();
      invalidate();
    }
  });
})

