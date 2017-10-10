const { exec } = require('child_process');
const LOG_PREFIX = ' '.repeat(6);

const EMAIL = process.env.CLOUDFLARE_EMAIL;
const KEY = process.env.CLOUDFLARE_KEY;
const AUTHEN = `-H "X-Auth-Email:${EMAIL}" -H "X-Auth-Key:${KEY}" -H "Content-Type: application/json"`;
// These above three lines is the secret key and CAN NOT be revealed to anywhere

const ZONE_ID = '4f8f1d8bf3697857f18850557aa35880';
// This is Zone ID is unchanged and can be get from https://api.cloudflare.com/#zone-list-zones
// Because one account might have many domains (zone), we point out which zone to the API
// This is not secret or authenticated key, just a domain quoine.io's alias

const API = 'https://api.cloudflare.com/client/v4';

const validate = (domain, content) => {
  if (!(EMAIL && KEY)) {
    //console.log(LOG_PREFIX, `No CLOUDFLARE_EMAIL or CLOUDFLARE_KEY provided. Please check CloudFlare manually`)
    return; //Just do nothing when we don't have ENV
  }

  const url = `"${API}/zones/${ZONE_ID}/dns_records?type=CNAME&name=${domain}"`;
  exec(`curl -X GET ${url} ${AUTHEN}`, (error, stdout, stderr) => {
    if (error) {
      console.log(stderr);
      return; // Just don't do anything
    }

    const response = JSON.parse(stdout);
    const record = response.result[0];
    if (record) {
      if (record.content === content) {
        console.log(LOG_PREFIX, `- ${domain}: "${content}" `)
      } else {
        console.log(LOG_PREFIX, `✳ ${domain}: "${record.content}" ➡ "${content}"`);
        update(record.id, domain, content);
      }
    } else {
      console.log(LOG_PREFIX, `️️✳ ${domain}: "${content}"`)
      create(domain, content);
    }
  });
};

const update = (id, domain, content) => {
  const url = `"${API}/zones/${ZONE_ID}/dns_records/${id}"`;
  const data = {
    type: 'CNAME',
    name: domain,
    content: content,
    ttl: 1,
    proxied: true,
  };

  exec(`curl -X PUT ${url} ${AUTHEN} --data '${JSON.stringify(data)}'`, (error, stdout, stderr) => {
    if (error) {
      console.log(stderr);
      return;
    }

    const response = JSON.parse(stdout);
    if (!response.success) {
      console.log(LOG_PREFIX, `- Update CNAME record for ${domain} failed with error:`);
      console.log(JSON.stringify(response));
    }
  });
};

const create = (domain, content) => {
  const url = `"${API}/zones/${ZONE_ID}/dns_records"`;
  const data = {
    type: 'CNAME',
    name: domain,
    content: content,
    ttl: 1,
    proxied: true,
  };
  //ttl = 1 is automatic https://api.cloudflare.com/#dns-records-for-a-zone-create-dns-record

  exec(`curl -X POST ${url} ${AUTHEN} --data '${JSON.stringify(data)}'`, (error, stdout, stderr) => {
    if (error) {
      console.log(stderr);
      return;
    }

    const response = JSON.parse(stdout);
    if (!response.success) {
      console.log(LOG_PREFIX, `- Create CNAME record for ${domain} failed with error:`);
      console.log(JSON.stringify(response));
    }
  });
};

module.exports = validate;
