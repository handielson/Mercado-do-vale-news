const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { deployProductReadPrivacy } = require('./deploy-product-read-privacy.cjs');
const BASELINE = 'f83979f4';
const ENTRIES = ['server.js', 'vps_server.js', 'vps_server.cjs'];
const normalize = text => text.replace(/\r\n/g, '\n');
function functionRange(text) {
  const start = text.indexOf('async function loadSeoProductBySlug(slug) {');
  const end = text.indexOf('\n}\n', start) + 3;
  if (start < 0 || end < start) throw Error('Missing SEO function boundary');
  return { start, end, block: text.slice(start, end) };
}
function patchEntry(source, before, after, alternateBefore = before) {
  const text = normalize(source);
  const current = functionRange(text);
  const old = functionRange(normalize(before)).block;
  const updated = functionRange(normalize(after)).block;
  const anchor = '  if (!rows.length) {\n    const [routeCandidates] = await pool.query(';
  const insertStart = updated.indexOf('  // O pai representa a familia:');
  const insertEnd = updated.indexOf(anchor, insertStart);
  if (insertStart < 0 || insertEnd < insertStart) throw Error('Missing family resolution patch');
  const insertion = updated.slice(insertStart, insertEnd);
  if (current.block.includes(insertion)) return source;
  if (current.block !== old && current.block !== functionRange(normalize(alternateBefore)).block) throw Error('Remote SEO function drift');
  if (current.block.split(anchor).length !== 2) throw Error('Ambiguous family resolution anchor');
  const patched = current.block.replace(anchor, insertion + anchor);
  const result = text.slice(0, current.start) + patched + text.slice(current.end);
  return source.includes('\r\n') ? result.replace(/\n/g, '\r\n') : result;
}
async function deployParentPublicLink(options) {
  return deployProductReadPrivacy({ ...options, files: ENTRIES, backupPrefix: 'parent-public-link',
    patchFile(source, file) {
      const before = execFileSync('git', ['show', BASELINE + ':' + file], { cwd: options.root, encoding: 'utf8', maxBuffer: 15e6 });
      // Production server.js contains the richer, already-published VPS SEO
      // resolver. Preserve it and insert only the family fallback.
      const alternate = execFileSync('git', ['show', BASELINE + ':vps_server.cjs'], { cwd: options.root, encoding: 'utf8', maxBuffer: 15e6 });
      return patchEntry(source, before, fs.readFileSync(path.join(options.root, file), 'utf8'), alternate);
    },
  });
}
module.exports = { patchEntry, deployParentPublicLink, BASELINE };
