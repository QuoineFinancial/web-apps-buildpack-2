// This will invalidate CloudFront based on S3
// The app need to know the AWS_S3_BUCKET
// Example: node cloudfront.js quoinex-stag9

const { exec, execSync } = require('child_process');
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;
const BUILD_DIR = process.env.BUILD_DIR;

exec(`${BUILD_DIR}/bin/aws cloudfront list-distributions`, {
  maxBuffer: 10000 * 1024
}, (err, stdout, stderr) => {
  if (err) {
    return console.log(stderr);
  }

  const distributions = JSON.parse(stdout).DistributionList.Items;
  const matchedS3Bucket = name => (name.indexOf(AWS_S3_BUCKET) > -1);

  distributions
    .filter(distribution => matchedS3Bucket(distribution.DefaultCacheBehavior.TargetOriginId))
    .forEach((distribution, index, all) => {
      try {
        const cname = distribution.Aliases.Items[0]
        console.log(`       [${index + 1}/${all.length}] ${cname}...`);
      } catch (error) {
        console.log(`       Warning: the distribution ${distribution.Id} does not have CNAME value`);
      }
      execSync(`${BUILD_DIR}/bin/aws cloudfront create-invalidation --distribution-id ${distribution.Id} --paths "/*"`)
    });
});

