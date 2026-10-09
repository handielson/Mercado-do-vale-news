const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { deployProductReadPrivacy } = require('./deploy-product-read-privacy.cjs');
const BASELINE = '01f4bc98';
const ENTRIES = ['server.js', 'vps_server.js', 'vps_server.cjs'];
function refreshBlock(source) {
  const text = source.replace(/\r\n/g, '\n');
  const anchor = 'async function refreshBlingStoredAccessTokenVps(settings) {';
  if (text.split(anchor).length !== 2) throw Error('Ambiguous Bling refresh handler');
  const start = text.indexOf(anchor), end = text.indexOf('\n}\n', start) + 3;
  if (end < start) throw Error('Missing Bling refresh boundary');
  return text.slice(start, end);
}
function patchEntry(source, before, after) {
  const old = refreshBlock(before), updated = refreshBlock(after), current = refreshBlock(source);
  if (current === updated) return source;
  if (current !== old) throw Error('Remote Bling refresh drift');
  const result = source.replace(/\r\n/g, '\n').replace(current, updated);
  return source.includes('\r\n') ? result.replace(/\n/g, '\r\n') : result;
}
async function deployBlingRefreshSafe(options) {
  return deployProductReadPrivacy({ ...options, files: ENTRIES, backupPrefix: 'bling-refresh-safe',
    patchFile(source, file) {
      const before = execFileSync('git', ['show', BASELINE + ':' + file], { cwd: options.root, encoding: 'utf8', maxBuffer: 15e6 });
      return patchEntry(source, before, fs.readFileSync(path.join(options.root, file), 'utf8'));
    },
  });
}
module.exports = { deployBlingRefreshSafe, patchEntry, refreshBlock, BASELINE };
