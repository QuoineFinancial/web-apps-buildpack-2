const { appUrlKeys } = require('./config');

const template = (vendor, env, app) => {
  switch (env) {
    case 'prod': return `https://${app}.${vendor}.com`;
    case 'beta': return `https://beta-${app}.${vendor}.com`;
    case 'demo': return `https://demo-${app}.${vendor}.com`;
    default:
      return `https://${vendor}-${env}-${app}.quoine.io`;
  }
}

const domain = (bucket, app) => {
  // Fallback to the env first
  if (process.env[appUrlKeys[app]]) {
    return process.env[appUrlKeys[app]];
  }

  // Then fallback to our url template
  // Note: env might contains "-", so bucket might has multiple "-",
  // eg: quoinex-v4-uat
  const separatorIndex = bucket.indexOf('-');
  const vendor = bucket.slice(0, separatorIndex);
  const env = bucket.slice(separatorIndex + 1);
  return template(vendor, env, app);
}

module.exports = domain;
