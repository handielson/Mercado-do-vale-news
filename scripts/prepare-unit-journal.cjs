'use strict';
// Default: read the production schema and save a local SQL plan only.
// Applying the plan is a separate, explicit migration step using a DBA account.
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('../tmp-tests/vps-ssh-config.cjs');
const { buildUnitJournalMigration } = require('../services/unitJournalSchema.cjs');
const program = `require('dotenv').config({path:'/var/www/mdv-api/.env',quiet:true});
(async()=>{const db=await require('mysql2/promise').createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME});
try{const [rows]=await db.query("SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('units','products','sale_items','sales','orders','product_stock_locations','stock_location_movements') ORDER BY TABLE_NAME,ORDINAL_POSITION");
const [triggers]=await db.query("SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND (TRIGGER_NAME LIKE 'mdv_unit_journal_%' OR TRIGGER_NAME LIKE 'mdv_uj_%')");
console.log(JSON.stringify({rows,triggers}));}finally{await db.end();}})().catch(e=>{console.error(e.code);process.exitCode=1});`;
const client = new Client();
client.on('ready', () => client.exec('cd /var/www/mdv-api && node', (error, stream) => {
  if (error) { client.end(); throw error; }
  let output = '';
  stream.on('data', data => { output += data; });
  stream.stderr.on('data', data => process.stderr.write(data));
  stream.on('close', code => {
    client.end();
    if (code) { process.exitCode = code; return; }
    const { rows, triggers } = JSON.parse(output);
    if (triggers.length) throw new Error('Diário já instalado: revisar triggers antes de gerar nova migração.');
    const schema = {};
    for (const row of rows) (schema[row.TABLE_NAME] ||= []).push(row.COLUMN_NAME);
    const statements = buildUnitJournalMigration(schema);
    const sql = '-- Gerado a partir do schema atual. Aplicar sob manutenção com backup e conta DBA.\n' +
      statements.map(({ name, sql }) => name === 'table' || name === 'baseline' || name === 'existing_sales'
        ? sql + ';' : 'DELIMITER $$\n' + sql + '$$\nDELIMITER ;').join('\n\n');
    const destination = path.resolve('.local/unit-journal-migration.sql');
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, sql);
    console.log(JSON.stringify({ destination, statements: statements.length, schemaColumns: Object.fromEntries(Object.entries(schema).map(([k,v]) => [k,v.length])), applied: false }));
  });
  stream.end(program);
})).connect(getVpsSshConfig());
