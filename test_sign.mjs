import crypto from 'crypto';

const partnerId = '1229870';
const partnerKey = 'shpk44656775546c70516b545462446644426377536c79707449674e77474378';
const apiPath = '/api/v2/shop/auth_partner';
const timestamp = 1774321713;

const baseString = `${partnerId}${apiPath}${timestamp}`;
const sign = crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');

console.log('BaseString:', baseString);
console.log('Generated Sign:', sign);
console.log('Sign in URL: b3c096f68268eed813541775fbe5da6b7f06f6d3958d41...');
