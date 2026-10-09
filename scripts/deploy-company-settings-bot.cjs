const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { deployProductReadPrivacy } = require('./deploy-product-read-privacy.cjs');
const ENTRIES = ['server.js', 'vps_server.js', 'vps_server.cjs'];
const MODULE = 'services/companySettingsBotView.cjs';
const BASELINE = 'fc53728b';
function settingsBlock(source) {
  const normalized = source.replace(/\r\n/g, '\n');
  const start = normalized.indexOf('// ─── Company Settings ─');
  const publicStart = normalized.indexOf("fastify.get('/public/company-settings'", start);
  const closing = normalized.indexOf('\n});\n', publicStart);
  const end = closing + 6;
  if (start < 0 || publicStart < start || closing < publicStart) throw Error('Missing company settings route boundaries');
  return normalized.slice(start, end);
}
function patchEntry(source, updatedSource, baselineSource) {
  const current = settingsBlock(source), updated = settingsBlock(updatedSource);
  if (current === updated) return source;
  if (current !== settingsBlock(baselineSource)) throw Error('Remote company settings contract drift');
  const text = source.replace(/\r\n/g, '\n').replace(current, updated);
  return source.includes('\r\n') ? text.replace(/\n/g, '\r\n') : text;
}
async function deployCompanySettingsBot(options) {
  return deployProductReadPrivacy({ ...options, files: [...ENTRIES, MODULE], backupPrefix: 'company-settings-bot',
    patchFile(source, file) {
      const local = fs.readFileSync(path.join(options.root, file), 'utf8');
      if (file === MODULE) return local;
      const before = execFileSync('git', ['show', BASELINE + ':' + file], { cwd: options.root, encoding: 'utf8', maxBuffer: 15e6 });
      return patchEntry(source, local, before);
    },
  });
}
module.exports = { deployCompanySettingsBot, settingsBlock, patchEntry, ENTRIES, MODULE, BASELINE };
