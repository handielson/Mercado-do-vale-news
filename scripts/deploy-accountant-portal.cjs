const path = require('node:path');

const files = [
  'services/accountantPortalCore.cjs', 'services/accountantPortalServer.cjs',
  'services/accountantSaleDetails.cjs', 'services/blingFiscalImportCore.cjs',
  'services/fiscalDocumentArchive.cjs', 'services/fiscalNfceAccessKey.cjs',
  'services/danfeNfceCore.cjs', 'services/fiscalNfceDanfeRead.cjs',
];

// Exact anchors make a divergent runtime fail before any replacement.
function patchServer(source) {
  const oldSignature = 'async function fetchBlingFiscalDocumentsForMigrationVps(request, { from, to }) {';
  const signature = 'async function fetchBlingFiscalDocumentsForMigrationVps(request, { from, to, includeXml = false }) {';
  const anchor = '    getDetail: (type, id) => read(type, null, null, id),';
  const addition = "    getXml: includeXml ? async detail => (await downloadBlingNfeXmlVps(detail)).toString('utf8') : undefined,";
  for (const marker of [source.includes(signature) ? signature : oldSignature, anchor]) {
    if (source.split(marker).length !== 2) throw new Error('Unexpected Bling import anchor');
  }
  if (!source.includes('async function downloadBlingNfeXmlVps(')) throw new Error('XML download helper missing');
  source = source.replace(oldSignature, signature);
  if (!source.includes(addition)) source = source.replace(anchor, anchor + '\n' + addition);
  return source;
}

async function deployAccountantPortal({ appDir, apiProc, exec, upload, root, checkOnly = false }) {
  if (appDir !== '/var/www/mdv-api' || apiProc.name !== 'mdv-api') throw new Error('Unexpected API target');
  const backup = `${appDir}/backups/accountant-portal-${Date.now()}`;
  const run = source => exec(`cd ${appDir} && node -e "eval(Buffer.from('${Buffer.from(source).toString('base64')}','base64').toString())"`);
  const entries = ['server.js','vps_server.js','vps_server.cjs'];
  const dbSetup = `const fs=require('fs'); require('dotenv').config({quiet:true});
    const db=await require('mysql2/promise').createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME,dateStrings:true});`;
  await run(`(async()=>{${dbSetup}
    for(const file of ['server.js','vps_server.js']) (${patchServer.toString()})(fs.readFileSync(file,'utf8'));
    const expected={sale_items:['product_name','product_sku','quantity','unit_price','total','created_at'],order_items:['product_name','product_sku','quantity','unit_price','subtotal','created_at'],orders:['company_id'],company_fiscal_documents:['id','profile_id','access_key'],mobile_sale_events:['details_json']};
    for(const [table,required] of Object.entries(expected)){const [rows]=await db.query('SHOW COLUMNS FROM '+table);const names=rows.map(r=>r.Field);if(required.some(c=>!names.includes(c)))throw new Error('Schema mismatch: '+table);}
    await db.end();console.log('Accountant runtime anchors and database schema verified');
  })().catch(e=>{console.error(e.message);process.exit(1)});`);
  if (checkOnly) { console.log('Accountant preflight passed (read only)'); return; }
  await exec(`mkdir -p ${backup}/services ${appDir}/migrations && chmod 700 ${backup}`);
  for (const file of [...files,...entries,'package.json','package-lock.json']) {
    await exec(`if test -f ${appDir}/${file}; then cp -p ${appDir}/${file} ${backup}/${file}; fi`);
  }
  // A protected snapshot precedes the additive migration. Existing fiscal rows are untouched.
  await run(`(async()=>{${dbSetup}
    const snapshot={};await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await db.beginTransaction();
    for(const table of ['company_fiscal_documents','company_fiscal_document_xmls']){
      const [exists]=await db.query('SHOW TABLES LIKE ?',[table]);if(!exists.length)continue;
      const [schema]=await db.query('SHOW CREATE TABLE '+table);const [rows]=await db.query('SELECT * FROM '+table);snapshot[table]={schema:schema[0]['Create Table'],rows};
    }
    fs.writeFileSync('${backup}/fiscal-archive-snapshot.json',JSON.stringify(snapshot),{mode:0o600});await db.commit();await db.end();
  })().catch(e=>{console.error(e.message);process.exit(1)});`);
  for (const file of files) {
    await upload(path.join(root,file),`${appDir}/${file}.next.cjs`);
    await exec(`node --check ${appDir}/${file}.next.cjs`);
  }
  await run(`const fs=require('fs');for(const file of ${JSON.stringify(entries)}) fs.writeFileSync(file+'.next.cjs',(${patchServer.toString()})(fs.readFileSync(file==='vps_server.cjs'?'server.js':file,'utf8')));`);
  for (const file of entries) await exec(`node --check ${appDir}/${file}.next.cjs`);
  await exec(`cd ${appDir} && npm install --save-exact @alexssmusica/node-pdf-nfe@1.2.24 @xmldom/xmldom@0.9.12 --omit=dev --no-audit --no-fund`);
  const migration='migrations/027_fiscal_document_xml_archive.sql';
  await upload(path.join(root,migration),`${appDir}/${migration}`);
  await run(`(async()=>{${dbSetup}
    const sql=fs.readFileSync('${migration}','utf8').replace(/--[^\\n]*/g,'');
    for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await db.query(statement);
    const [cols]=await db.query('SHOW COLUMNS FROM company_fiscal_document_xmls');if(!cols.some(c=>c.Field==='xml_sha256'))throw new Error('Archive migration missing');
    await db.end(); await import('@alexssmusica/node-pdf-nfe');console.log('Archive migration and PDF dependency verified');
  })().catch(e=>{console.error(e.message);process.exit(1)});`);
  try {
    for (const file of [...files,...entries]) await exec(`mv ${appDir}/${file}.next.cjs ${appDir}/${file}`);
    await exec('pm2 restart mdv-api');
    await run(`(async()=>{for(let i=0;i<20;i++){try{const r=await fetch('http://127.0.0.1:4000/status');const s=await r.json();if(r.ok&&s.mysql?.ok){console.log('API and MySQL healthy');return;}}catch{}await new Promise(r=>setTimeout(r,1000));}throw new Error('API health check failed');})().catch(e=>{console.error(e.message);process.exit(1)});`);
  } catch (error) {
    for (const file of [...files,...entries]) await exec(`if test -f ${backup}/${file}; then cp -p ${backup}/${file} ${appDir}/${file}; fi`);
    await exec('pm2 restart mdv-api');
    throw error;
  }
  console.log(`Accountant API deployed; backup: ${backup}`);
}

module.exports = { files, patchServer, deployAccountantPortal };
