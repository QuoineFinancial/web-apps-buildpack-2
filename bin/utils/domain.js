const { appUrlKeys } = require('./config');

const template = (vendor, env, app) => {
  switch (env) {
    case 'prod': return `https://${app}.${vendor}.com`;
    case 'beta': return `https://${app}-beta.${vendor}.com`;
    case 'sandbox': return `https://${app}-sandbox.${vendor}.com`;
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
