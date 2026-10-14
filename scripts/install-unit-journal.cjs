'use strict';
// Explicitly authorized installation. Tests use a disposable schema, never operational rows.
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('../tmp-tests/vps-ssh-config.cjs');
const apply = process.argv.includes('--apply');
const builder = fs.readFileSync(path.join(__dirname, '../services/unitJournalSchema.cjs'), 'utf8');
const program = `
require('dotenv').config({path:'/var/www/mdv-api/.env',quiet:true});
const fs=require('fs');const {execFileSync}=require('child_process');
const mod={exports:{}};new Function('module','exports',${JSON.stringify(builder)})(mod,mod.exports);
const {buildUnitJournalMigration}=mod.exports;
const tables=['units','products','sale_items','sales','orders','product_stock_locations','stock_location_movements'];
const apply=${JSON.stringify(apply)};
(async()=>{
 const database=process.env.DB_NAME;if(!/^[a-zA-Z0-9_]+$/.test(database))throw new Error('Invalid operational database');
 const db=await require('mysql2/promise').createConnection({user:'root',socketPath:'/var/run/mysqld/mysqld.sock',database});
 let stopped=false,started=false,completed=false;
 try{
  const [[version]]=await db.query('SELECT VERSION() version');if(!version.version.startsWith('8.0.'))throw new Error('MySQL 8.0 required');
  const [installed]=await db.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='unit_journal_events'");
  if(installed.length)throw new Error('Journal already exists; review installation manually');
  const readSchema=async()=>{const [rows]=await db.query("SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (?) ORDER BY TABLE_NAME,ORDINAL_POSITION",[tables]);const result={};for(const r of rows)(result[r.TABLE_NAME]||=[]).push(r.COLUMN_NAME);return result;};
  const schema=await readSchema();const plan=buildUnitJournalMigration(schema);
  const testDb='mdv_unit_journal_test_schema_'+Date.now();
  await db.query('CREATE DATABASE '+testDb);
  try{
   for(const table of tables)await db.query('CREATE TABLE '+testDb+'.'+table+' LIKE '+database+'.'+table);
   await db.query('USE '+testDb);
   for(const statement of plan)await db.query(statement.sql);
   console.log(JSON.stringify({validatedRealSchema:true,statements:plan.length,mysql:version.version}));
  }finally{await db.query('USE '+database);await db.query('DROP DATABASE '+testDb);}
  if(!apply)return;
  const state=JSON.parse(execFileSync('pm2',['jlist'],{encoding:'utf8'})).find(p=>p.name==='mdv-api');
  if(state?.pm2_env?.status!=='online')throw new Error('API must be online before maintenance');
  execFileSync('pm2',['stop','mdv-api'],{stdio:'ignore'});stopped=true;
  await new Promise(resolve=>setTimeout(resolve,1500));
  const [writers]=await db.query("SELECT ID FROM information_schema.PROCESSLIST WHERE DB=? AND ID<>CONNECTION_ID() AND COMMAND<>'Sleep'",[database]);
  if(writers.length)throw new Error('Other active database connections; installation aborted');
  if(JSON.stringify(schema)!==JSON.stringify(await readSchema()))throw new Error('Schema changed during preparation');
  const backupDir='/var/backups/mdv-unit-journal';fs.mkdirSync(backupDir,{recursive:true,mode:0o700});
  const backup=backupDir+'/before-journal-'+new Date().toISOString().replace(/[^0-9]/g,'')+'.sql';
  const fd=fs.openSync(backup,'wx',0o600);
  try{execFileSync('mysqldump',['--socket=/var/run/mysqld/mysqld.sock','--user=root','--single-transaction','--routines','--triggers','--events','--set-gtid-purged=OFF','--databases',database],{stdio:['ignore',fd,'pipe']});}finally{fs.closeSync(fd);}
  if(fs.statSync(backup).size<100)throw new Error('Backup is empty');
  execFileSync('gzip',[backup]);execFileSync('gzip',['-t',backup+'.gz']);
  console.log(JSON.stringify({backup:backup+'.gz',bytes:fs.statSync(backup+'.gz').size,verified:true}));
  const totals=async()=>{const [[row]]=await db.query('SELECT (SELECT COUNT(*) FROM units) units,(SELECT COALESCE(SUM(stock_quantity),0) FROM products) productStock,(SELECT COUNT(*) FROM sales) sales');return JSON.stringify(row);};
  const before=await totals();started=true;
  for(const statement of plan){await db.query(statement.sql);console.log(JSON.stringify({installed:statement.name}));}
  const [[triggers]]=await db.query("SELECT COUNT(*) n FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND (TRIGGER_NAME LIKE 'mdv_unit_journal_%' OR TRIGGER_NAME LIKE 'mdv_uj_%')");
  if(triggers.n!==plan.length-3)throw new Error('Incomplete trigger installation');
  const [[coverage]]=await db.query("SELECT COUNT(*) missing FROM units u WHERE NOT EXISTS (SELECT 1 FROM unit_journal_events e WHERE e.unit_id=u.id AND e.event_type='baseline')");
  if(coverage.missing)throw new Error('Incomplete baseline');
  if(before!==await totals())throw new Error('Operational totals changed');
  const [counts]=await db.query('SELECT event_type,COUNT(*) n FROM unit_journal_events GROUP BY event_type');
  completed=true;console.log(JSON.stringify({installed:true,triggers:triggers.n,counts,operationalTotalsPreserved:true}));
 }finally{
  await db.end();
  if(stopped&&(!started||completed)){execFileSync('pm2',['restart','mdv-api'],{stdio:'ignore'});console.log(JSON.stringify({apiResumed:true}));}
  else if(stopped)console.error('Partial installation: API left stopped until migration is repaired.');
 }
})().catch(error=>{console.error(JSON.stringify({error:error.code||error.message}));process.exitCode=1;});
`;
const client = new Client();
client.on('error', error => { console.error(error.message); process.exitCode = 1; });
client.on('ready', () => client.exec('cd /var/www/mdv-api && node', (error, stream) => {
    if (error) throw error;
    stream.pipe(process.stdout); stream.stderr.pipe(process.stderr);
    stream.on('close', code => { process.exitCode = code; client.end(); });
    stream.end(program);
})).connect(getVpsSshConfig());
