const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const MODULES = ['services/phonePriceListServer.cjs', 'services/phonePriceListArtwork.cjs'];
const ENTRIES = ['server.js', 'vps_server.js', 'vps_server.cjs'];
function patchCardDependency(source) {
  if (!source.includes('async function calculateAutoresponderMaxInstallment(')) throw new Error('Existing card calculation missing');
  const anchor = '  buildWhatsAppStoryItems: buildWhatsAppStatusStoryItemsVps,';
  if (source.split(anchor).length !== 2) throw new Error('Marketing registration anchor is ambiguous');
  const updated = anchor + '\n  calculateCardInstallment: calculateAutoresponderMaxInstallment,';
  return source.includes(updated) ? source : source.replace(anchor, updated);
}
const normalize = source => source.replace(/\r\n/g, '\n');
async function deployPhonePriceList({ appDir, apiProc, exec, root, read, write }) {
  if (appDir !== '/var/www/mdv-api' || apiProc.name !== 'mdv-api') throw new Error('Unexpected API target');
  const changes = [];
  for (const file of ENTRIES) {
    const original = await read(`${appDir}/${file}`);
    if (!original) throw new Error(`Missing server entry: ${file}`);
    const updated = patchCardDependency(normalize(original));
    if (updated !== normalize(original)) changes.push({ file, original, updated });
  }
  for (const file of MODULES) {
    const original = await read(`${appDir}/${file}`);
    const updated = fs.readFileSync(path.join(root, file), 'utf8');
    const previous = execFileSync('git', ['show', `HEAD^:${file}`], { cwd: root, encoding: 'utf8' });
    if (![normalize(previous), normalize(updated)].includes(normalize(original))) throw new Error(`Remote module differs from release baseline: ${file}`);
    changes.push({ file, original, updated });
  }
  const backupDir = `${appDir}/backups/phone-price-list-${Date.now()}`;
  await exec(`mkdir -p ${backupDir}`);
  for (const change of changes) await write(`${backupDir}/${change.file.replaceAll('/', '__')}`, change.original);
  try {
    for (const change of changes) {
      await write(`${appDir}/${change.file}.release-check.cjs`, change.updated);
      await exec(`node --check ${appDir}/${change.file}.release-check.cjs`);
    }
    for (const change of changes) await exec(`mv ${appDir}/${change.file}.release-check.cjs ${appDir}/${change.file}`);
    console.log((await exec('pm2 restart mdv-api')).trim());
    console.log(`Phone price list backup: ${backupDir}`);
  } catch (error) {
    for (const change of changes) await write(`${appDir}/${change.file}`, change.original);
    await exec('pm2 restart mdv-api');
    throw error;
  }
}
module.exports = { deployPhonePriceList, patchCardDependency };
