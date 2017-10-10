const { exec, execSync } = require(`child_process`);
const apps = ['accounts', 'trade', 'balance', 'chart', 'tokens'];
const BUILD_DIR = process.env.BUILD_DIR;
const MAX_CONCURRENT_BUILD = 3;

console.log(`-----> Build all apps with ${MAX_CONCURRENT_BUILD} concurrent build`);
execSync(`mkdir ${BUILD_DIR}/dist`);

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

const build = (app, callback) => {
  let envBuild = process.env;
  envBuild.REACT_APP_APP = app;

  exec(`yarn run build`, {
    cwd: `${BUILD_DIR}/${app}`,
    env: envBuild
  }, (err, stdout, stderr) => {
    if (err) {
      console.log(`       - Build ${app} failed.`);
      callback(err);
    } else {
      execSync(`mkdir ${BUILD_DIR}/dist/${app}`);
      execSync(`cp -R ${BUILD_DIR}/${app}/build/. ${BUILD_DIR}/dist/${app}`);
      callback();
    }
  });
}

attemp();
