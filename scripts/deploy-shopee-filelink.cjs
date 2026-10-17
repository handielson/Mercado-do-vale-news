'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const BASELINE = '0874b8060bc297fda26b572d65950db3bbedd15d';
const ENTRIES = ['server.js', 'vps_server.js', 'vps_server.cjs'];
const MODULE = 'services/shopeeShippingDocumentJob.cjs';
const normalize = source => source.replace(/\r\n/g, '\n');
const SPECS = [
  ['async function shopeeCatalogRequestVps(', '\nfunction clampShopeeCatalogIntVps('],
  ["      case 'get_shipping_document': {", "\n      case '"],
];
function block(source, [startAnchor, endAnchor]) {
  if (source.split(startAnchor).length !== 2) throw new Error('Missing/ambiguous Shopee anchor: ' + startAnchor);
  const start = source.indexOf(startAnchor);
  const end = source.indexOf(endAnchor, start + startAnchor.length);
  if (end < 0) throw new Error('Missing Shopee block closing');
  return source.slice(start, end);
}
function patch(remote, baseline, current) {
  const old = normalize(baseline), next = normalize(current);
  let result = normalize(remote), accounted = old;
  for (const spec of SPECS) {
    const before = block(old, spec), after = block(next, spec), found = block(result, spec);
    if (found !== before && found !== after) throw new Error('Remote Shopee block drift: ' + spec[0]);
    result = result.replace(found, after);
    accounted = accounted.replace(before, after);
  }
  if (accounted !== next) throw new Error('Unaccounted local API changes outside Shopee Filelink scope');
  return remote.includes('\r\n') ? result.replace(/\n/g, '\r\n') : result;
}
async function deploy(options) {
  const baseline = file => execFileSync('git', ['show', `${BASELINE}:${file}`], {
    cwd: options.root, encoding: 'utf8', maxBuffer: 15e6,
  });
  return require('./deploy-product-read-privacy.cjs').deployProductReadPrivacy({
    ...options, files: [MODULE, ...ENTRIES], backupPrefix: 'shopee-filelink',
    patchFile: (remote, file) => {
      const current = fs.readFileSync(path.join(options.root, file), 'utf8');
      if (ENTRIES.includes(file)) return patch(remote, baseline(file), current);
      if (remote && normalize(remote) !== normalize(current)) throw new Error('Remote Shopee module drift');
      return current;
    },
  });
}
module.exports = { BASELINE, ENTRIES, MODULE, patch, deploy };
