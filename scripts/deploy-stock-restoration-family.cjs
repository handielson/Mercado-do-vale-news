const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const BASELINE = 'a6c3ab3c6973c8cc8fe749190c66c518c689fcde';
const ENTRIES = ['server.js', 'vps_server.js', 'vps_server.cjs'];
const MODULES = ['services/stockMovementRestoration.cjs', 'services/smartphoneModelFamily.cjs'];
const FUNCTIONS = ['syncProductStockFromLocations', 'getStockLocationRow', 'insertStockMovement', 'restoreStockFromMovements'];
const normalize = source => source.replace(/\r\n/g, '\n');
function functionBlock(source, name) {
  const anchor = `async function ${name}(`;
  if (source.split(anchor).length !== 2) throw new Error(`Ambiguous function: ${name}`);
  const start = source.indexOf(anchor), end = source.indexOf('\n}\n', start);
  if (end < 0) throw new Error(`Missing function end: ${name}`);
  return source.slice(start, end + 3);
}
function patch(remote, baseline, current) {
  let result = normalize(remote);
  for (const name of FUNCTIONS) {
    const old = functionBlock(normalize(baseline), name), next = functionBlock(normalize(current), name);
    const found = functionBlock(result, name);
    if (found !== old && found !== next) throw new Error(`Remote function drift: ${name}`);
    result = result.replace(found, next);
  }
  return remote.includes('\r\n') ? result.replace(/\n/g, '\r\n') : result;
}
async function deployStockRestorationFamily(options) {
  const baseline = file => execFileSync('git', ['show', `${BASELINE}:${file}`], {
    cwd: options.root, encoding: 'utf8', maxBuffer: 12e6,
  });
  const patchFile = (remote, file) => {
    const current = fs.readFileSync(path.join(options.root, file), 'utf8');
    if (ENTRIES.includes(file)) return patch(remote, baseline(file), current);
    const expected = file === MODULES[0] ? '' : baseline(file);
    if (normalize(remote) !== normalize(expected) && normalize(remote) !== normalize(current)) {
      throw new Error(`Remote module drift: ${file}`);
    }
    return current;
  };
  // Reuse the canonical backup/recheck/syntax/rollback publisher; modules first.
  await require('./deploy-product-read-privacy.cjs').deployProductReadPrivacy({ ...options,
    files: [...MODULES, ...ENTRIES], patchFile, backupPrefix: 'stock-restoration-family' });
}
module.exports = { patch, deployStockRestorationFamily };
