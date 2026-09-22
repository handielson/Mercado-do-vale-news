const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const normalize = value => value.replace(/\r\n/g, '\n');
function sections(source) {
  const functions = ['applyReconcileStockChangesVps', 'syncShopeeStockFromBlingTargetsVps'].map(name => {
    const match = source.match(new RegExp('async function ' + name + '\\b[\\s\\S]*?\\n}'));
    if (!match) throw new Error('Missing function: ' + name);
    return match[0];
  });
  const start = source.indexOf("if (resource === 'reconcile') {");
  const end = source.indexOf("if (resource === 'serial-sales-sync')", start);
  if (start < 0 || end < start) throw new Error('Missing reconcile route');
  return [...functions, source.slice(start, end)];
}
function patch(remote, before, after) {
  let result = normalize(remote);
  const oldSections = sections(normalize(before));
  const newSections = sections(normalize(after));
  oldSections.forEach((old, i) => {
    if (result.includes(newSections[i])) return; // Idempotent retry.
    if (result.split(old).length !== 2) throw new Error('Production section differs; abort without overwrite: ' + i);
    result = result.replace(old, newSections[i]);
  });
  return result;
}
module.exports = async function deploy({ appDir, apiProc, exec, root, read, write }) {
  if (apiProc.name !== 'mdv-api' || appDir !== '/var/www/mdv-api') throw new Error('Unexpected API target');
  const before = execFileSync('git', ['show', 'HEAD^:vps_server.js'], {cwd: root, encoding: 'utf8', maxBuffer: 16*1024*1024});
  const after = fs.readFileSync(require('node:path').join(root, 'vps_server.js'), 'utf8');
  const files = ['server.js', 'vps_server.js', 'vps_server.cjs'];
  const staged = [];
  for (const file of files) {
    const original = await read(appDir + '/' + file);
    staged.push({file, original, content: patch(original, before, after)});
  }
  const backup = appDir + '/backups/bling-stock-reconcile-' + Date.now();
  await exec('mkdir -p ' + backup);
  for (const {file, content} of staged) {
    await write(appDir + '/' + file + '.next.cjs', content);
    await exec('node --check ' + appDir + '/' + file + '.next.cjs');
  }
  // Re-read immediately before replacing to refuse concurrent changes.
  for (const {file, original} of staged) {
    if (await read(appDir + '/' + file) !== original) throw new Error('Production changed concurrently: ' + file);
  }
  for (const {file} of staged) {
    await exec('cp -p ' + appDir + '/' + file + ' ' + backup + '/' + file);
    await exec('mv ' + appDir + '/' + file + '.next.cjs ' + appDir + '/' + file);
  }
  console.log(await exec('pm2 restart mdv-api'));
  console.log('Selective stock reconciliation deployed; backup: ' + backup);
};
module.exports.patch = patch;
