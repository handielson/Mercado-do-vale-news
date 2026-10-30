const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { deployProductReadPrivacy } = require('./deploy-product-read-privacy.cjs');
const BASELINE = 'v1.2.710-foto-precos-media-compra';
const FILE = 'services/smartphonePriceGroupsServer.cjs';
const normalize = source => String(source).replace(/\r\n/g, '\n');
function patchModule(remote, before, after) {
    if (normalize(remote) !== normalize(before) && normalize(remote) !== normalize(after)) throw Error('Remote smartphone price groups drift');
    return normalize(remote) === normalize(after) ? remote : after;
}
async function deploy(options) {
    const before = execFileSync('git', ['show', `${BASELINE}:${FILE}`], { cwd: options.root, encoding: 'utf8' });
    const after = fs.readFileSync(path.join(options.root, FILE), 'utf8');
    return deployProductReadPrivacy({ ...options, files: [FILE], backupPrefix: 'smartphone-price-groups',
        patchFile: remote => patchModule(remote, before, after) });
}
module.exports = { deploy, patchModule, BASELINE, FILE };
