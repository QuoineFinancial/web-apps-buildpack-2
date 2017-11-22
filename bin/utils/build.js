const { exec, execSync } = require(`child_process`);
const { apps, appUrlKeys } = require('./config');
const domain = require('./domain');

const BUILD_DIR = process.env.BUILD_DIR;
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;
const MAX_CONCURRENT_BUILD = 2;

let concurrentBuild = 0;
let index = 0;

const attemp = () => {
  if (index < apps.length) {
    // We still have apps to build
    if (concurrentBuild < MAX_CONCURRENT_BUILD) {
      // We still not reach our maximum concurrent
      console.log(`       - [${index + 1}/${apps.length}] ${apps[index]}...`);
      concurrentBuild++;
      build(apps[index], (err) => {
        if (err) {
          execSync(`exit 1`);
        } else {
          concurrentBuild--; // We now done, descrese the concurrentBuild for next attemp
          attemp();
        }
      });
      index++; // Move to the next app
      attemp();
    }
  }
}

const env = (app) => {
  let result = process.env;
  result.REACT_APP_APP = app;

  apps.forEach(app => {
    result[appUrlKeys[app]] = domain(AWS_S3_BUCKET, app);
  });

  return result;
}

const build = (app, callback) => {
  exec(`yarn run build`, {
    cwd: `${BUILD_DIR}/${app}`,
    env: env(app)
  }, (err, stdout, stderr) => {
    if (err) {
      console.log(err);
      console.log('-----------------------');
      console.log(stderr);
      console.log(`       - Build ${app} failed.`);
      callback(err);
    } else {
      execSync(`mkdir ${BUILD_DIR}/dist/${app}`);
      execSync(`cp -R ${BUILD_DIR}/${app}/build/. ${BUILD_DIR}/dist/${app}`);
      callback();
    }
  });
}

console.log(`-----> Build all apps with ${MAX_CONCURRENT_BUILD} concurrent builds`);
execSync(`mkdir ${BUILD_DIR}/dist`);
attemp();
