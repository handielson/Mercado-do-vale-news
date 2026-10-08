'use strict';
// Run on the API host from its application directory. Dry-run is the default.
// node scripts/migrate-model-display-fields.cjs
// node scripts/migrate-model-display-fields.cjs --apply --backup /secure/new-file.json
// node scripts/migrate-model-display-fields.cjs --rollback /secure/existing-file.json
require('dotenv').config();
const mysql = require('mysql2/promise');
const migration = require('../services/modelDisplayFieldMigration.cjs');
const args = process.argv.slice(2);
const value = flag => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
const pool = mysql.createPool({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME, connectionLimit: 1 });
(async () => {
  try {
    const result = value('--rollback')
      ? await migration.rollback(pool, value('--rollback'))
      : await migration.run(pool, { apply: args.includes('--apply'), backupPath: value('--backup') });
    console.log(JSON.stringify(result, null, 2));
  } finally { await pool.end(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
