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
  const vendor = bucket.split('-')[0];
  const env = bucket.split('-')[1];
  return template(vendor, env, app);
}

module.exports = domain;
