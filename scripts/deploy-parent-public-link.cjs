const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { deployProductReadPrivacy } = require('./deploy-product-read-privacy.cjs');
const BASELINE = '5eafffac';
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
  const anchor = '  if (!rows.length) {\n    const [routeCandidates] = await pool.query(';
  const section = value => {
    const start = value.indexOf('  // O pai representa a familia:');
    const end = value.indexOf(anchor, start);
    if (start < 0 || end < start) throw Error('Missing family resolution patch');
    return value.slice(start, end);
  };
  const route = value => {
    const start = value.indexOf("fastify.get('/products/by-slug/:slug',");
    const end = value.indexOf('\n});', start) + 4;
    if (start < 0 || end < start) throw Error('Missing public route');
    return value.slice(start, end);
  };
  let result = text;
  for (const extract of [section, route]) {
    const current = extract(result);
    const old = extract(normalize(before));
    const updated = extract(normalize(after));
    const alternate = extract(normalize(alternateBefore));
    if (current === updated) continue;
    if (current !== old && current !== alternate) throw Error('Remote public family resolver drift');
    // server.js in production uses the richer VPS route; retain that shape.
    const target = extract === route && current === alternate && alternate !== old
      ? extract(normalize(fs.readFileSync(path.join(__dirname, '..', 'vps_server.cjs'), 'utf8')))
      : updated;
    result = result.replace(current, target);
  }
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
