const path = require('node:path');

const modules = [
  'services/companyFiscalServer.cjs',
  'services/fiscalCertificateVault.cjs',
  'services/fiscalTaxValidationCore.cjs',
  'services/fiscalCscVault.cjs',
  'services/fiscalItemReadiness.cjs',
  'services/fiscalNfceAuthorization.cjs',
  'services/fiscalNfceDraft.cjs',
  'services/fiscalNfceNumbering.cjs',
  'services/fiscalNfcePersistence.cjs',
  'services/fiscalNfceSalePreflight.cjs',
  'services/fiscalNfceSalePreparation.cjs',
  'services/fiscalNfceSchema.cjs',
  'services/fiscalNfceSigning.cjs',
  'services/fiscalNfceTransmission.cjs',
];
const schemas = [
  'nfe_v4.00.xsd', 'leiauteNFe_v4.00.xsd', 'tiposBasico_v4.00.xsd',
  'DFeTiposBasicos_v1.00.xsd', 'xmldsig-core-schema_v1.01.xsd',
].map(name => `schemas/nfe/PL_010f_v1.04/${name}`);
const migration = 'migrations/026_nfce_issuance_foundation.sql';
const runNode = (exec, appDir, source) => exec(`cd ${appDir} && node -e "eval(Buffer.from('${Buffer.from(source).toString('base64')}','base64').toString())"`);

async function deployNfceHomologation({ appDir, apiProc, exec, upload, root, checkOnly = false }) {
  if (appDir !== '/var/www/mdv-api' || apiProc.name !== 'mdv-api') throw new Error('Unexpected API target');
  const dbSetup = `require('dotenv').config({quiet:true});const db=await require('mysql2/promise').createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME,dateStrings:true});`;
  await runNode(exec, appDir, `(async()=>{${dbSetup}
    for(const table of ['company_fiscal_profiles','company_fiscal_tax_validations','company_accountant_access','customers','sales','sale_items','products','company_fiscal_documents']){
      const [rows]=await db.query('SHOW TABLES LIKE ?',[table]);if(!rows.length)throw new Error('Missing table: '+table);
    }
    for(const [table,columns] of Object.entries({sales:['id','total','payment_methods','finalization_status'],sale_items:['product_id','unit_price','total'],products:['ncm','cest','origin'],customers:['id','user_id','customer_type']})){
      const [rows]=await db.query('SHOW COLUMNS FROM '+table);const names=new Set(rows.map(row=>row.Field));for(const column of columns)if(!names.has(column))throw new Error('Missing column: '+table+'.'+column);
    }
    await db.end();console.log('NFC-e homologation preflight passed');
  })().catch(e=>{console.error(e.message);process.exit(1)});`);
  if (checkOnly) return;
  const backup = `${appDir}/backups/nfce-homologation-${Date.now()}`;
  const files = [...modules, ...schemas];
  await exec(`mkdir -p ${backup}/services ${backup}/schemas/nfe/PL_010f_v1.04 ${appDir}/schemas/nfe/PL_010f_v1.04 ${appDir}/migrations && chmod 700 ${backup}`);
  for (const file of [...files,'package.json','package-lock.json','.env']) {
    await exec(`if test -f ${appDir}/${file}; then cp -p ${appDir}/${file} ${backup}/${file}; fi`);
  }
  await runNode(exec, appDir, `(async()=>{const fs=require('fs');${dbSetup}
    const snapshot={};await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await db.beginTransaction();
    for(const table of ['company_fiscal_tax_validations','company_fiscal_nfce_sequences','company_fiscal_nfce_issuances']){
      const [exists]=await db.query('SHOW TABLES LIKE ?',[table]);if(exists.length){const [schema]=await db.query('SHOW CREATE TABLE '+table);const [rows]=await db.query('SELECT * FROM '+table);snapshot[table]={schema:schema[0]['Create Table'],rows};}
    }
    fs.writeFileSync('${backup}/fiscal-snapshot.json',JSON.stringify(snapshot),{mode:0o600});await db.commit();await db.end();console.log('Fiscal snapshot saved');
  })().catch(e=>{console.error(e.message);process.exit(1)});`);
  for (const file of files) {
    const target = `${appDir}/${file}`;
    await upload(path.join(root,file),`${target}.next`);
    if (file.endsWith('.cjs')) await exec(`node --check ${target}.next`);
  }
  await upload(path.join(root,migration),`${appDir}/${migration}.next`);
  await exec(`cd ${appDir} && npm install --save-exact xmllint-wasm@5.3.0 --omit=dev --no-audit --no-fund`);
  await runNode(exec, appDir, `(async()=>{const fs=require('fs');${dbSetup}
    const sql=fs.readFileSync('${migration}.next','utf8').replace(/--[^\\n]*/g,'');
    for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await db.query(statement);
    for(const table of ['company_fiscal_nfce_sequences','company_fiscal_nfce_issuances']){const [rows]=await db.query('SHOW TABLES LIKE ?',[table]);if(!rows.length)throw new Error('Migration missing '+table);}
    await db.end();console.log('NFC-e tables ready');
  })().catch(e=>{console.error(e.message);process.exit(1)});`);
  try {
    for (const file of files) await exec(`mv ${appDir}/${file}.next ${appDir}/${file}`);
    await exec(`mv ${appDir}/${migration}.next ${appDir}/${migration}`);
    await runNode(exec, appDir, `const fs=require('fs');const p='.env';const original=fs.readFileSync(p,'utf8');let next=original;for(const key of ['MDV_NFCE_HOMOLOGATION_PREPARE_ENABLED','MDV_NFCE_HOMOLOGATION_TRANSMIT_ENABLED']){const re=new RegExp('^'+key+'=.*$','m');next=re.test(next)?next.replace(re,key+'=1'):next.replace(/\\s*$/,'\\n'+key+'=1\\n');}fs.writeFileSync(p,next,{mode:0o600});console.log('Homologation flags enabled');`);
    await exec('pm2 restart mdv-api --update-env');
    await runNode(exec, appDir, `(async()=>{for(let i=0;i<20;i++){try{const r=await fetch('http://127.0.0.1:4000/status');const s=await r.json();if(r.ok&&s.mysql?.ok){console.log('API and MySQL healthy');return;}}catch{}await new Promise(r=>setTimeout(r,1000));}throw new Error('API health check failed');})().catch(e=>{console.error(e.message);process.exit(1)});`);
  } catch (error) {
    for (const file of [...files,'package.json','package-lock.json','.env']) await exec(`if test -f ${backup}/${file}; then cp -p ${backup}/${file} ${appDir}/${file}; fi`);
    await exec('pm2 restart mdv-api --update-env');
    throw error;
  }
  console.log(`NFC-e homologation deployed; backup: ${backup}`);
}

module.exports = { modules, schemas, migration, deployNfceHomologation };
