'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const normalize = source => source.replace(/\r\n/g, '\n');
function patch(source) {
  const anchor = `  await addColumnIfMissing('units', 'status', "VARCHAR(20) NOT NULL DEFAULT 'available'");`;
  const after = anchor + "\n  await require('./services/unitStatusSchema.cjs').ensureUnitStatusSchema(pool);";
  source = normalize(source);
  if (source.includes(after)) return source;
  if (source.split(anchor).length !== 2) throw new Error('Units schema anchor diverged.');
  return source.replace(anchor, after);
}
async function deploy({ appDir, apiProc, exec, root, read, write }) {
  if (appDir !== '/var/www/mdv-api' || apiProc.name !== 'mdv-api') throw new Error('Unexpected API target');
  const changes = [];
  for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
    const original = await read(`${appDir}/${file}`);
    changes.push({ file, original, updated: patch(original) });
  }
  for (const file of ['services/unitVisibility.cjs', 'services/unitStatusSchema.cjs']) {
    const original = await read(`${appDir}/${file}`);
    const updated = fs.readFileSync(path.join(root, file), 'utf8');
    if (original && file.endsWith('unitVisibility.cjs')) {
      const previous = execFileSync('git', ['show', `HEAD^:${file}`], { cwd: root, encoding: 'utf8' });
      if (![normalize(previous), normalize(updated)].includes(normalize(original))) throw new Error('Unit visibility module diverged.');
    } else if (original && normalize(original) !== normalize(updated)) throw new Error('Unit status schema module diverged.');
    changes.push({ file, original, updated });
  }
  const backup = `${appDir}/backups/unit-status-schema-${Date.now()}`;
  await exec(`mkdir -p ${backup}`);
  for (const change of changes) {
    if (change.original) await write(`${backup}/${change.file.replaceAll('/', '__')}`, change.original);
    await write(`${appDir}/${change.file}.next.cjs`, change.updated);
    await exec(`node --check ${appDir}/${change.file}.next.cjs`);
  }
  const migration = `require('dotenv').config({path:'${appDir}/.env',quiet:true});
const fs=require('fs'),mysql=require('mysql2/promise');
(async()=>{const db=await mysql.createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME});
try{const [columns]=await db.query("SHOW FULL COLUMNS FROM units LIKE 'status'");const [before]=await db.query('SELECT status,COUNT(*) AS n FROM units GROUP BY status ORDER BY status');fs.writeFileSync('${backup}/status-schema-before.json',JSON.stringify({columns,counts:before},null,2));
await require('${appDir}/services/unitStatusSchema.cjs').ensureUnitStatusSchema(db);
const [after]=await db.query('SELECT status,COUNT(*) AS n FROM units GROUP BY status ORDER BY status');if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Unit states changed during migration');const [updated]=await db.query("SHOW FULL COLUMNS FROM units LIKE 'status'");console.log(JSON.stringify({schema:updated[0].Type,unitStatesPreserved:true}));}finally{await db.end();}})().catch(e=>{console.error(e.message);process.exitCode=1});`;
  try {
    for (const change of changes) await exec(`mv ${appDir}/${change.file}.next.cjs ${appDir}/${change.file}`);
    console.log(await exec(`cd ${appDir} && node -e "eval(Buffer.from('${Buffer.from(migration).toString('base64')}','base64').toString())"`));
    console.log(await exec('pm2 restart mdv-api'));
    console.log(`Backup: ${backup}`);
  } catch (error) {
    for (const change of changes) if (change.original) await write(`${appDir}/${change.file}`, change.original);
    await exec('pm2 restart mdv-api');
    throw error;
  }
}
module.exports = deploy;
module.exports.patch = patch;
