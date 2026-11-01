// Publica somente os perfis fiscais por produto (cadastro): tabelas oficiais NCM/CEST, núcleo, rotas e migration 028.
// Uso via deploy-vps-server-only.cjs: --fiscal-tax-profiles-check (só confere) ou --fiscal-tax-profiles-only.
const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');

const modules = ['services/fiscalCatalog.cjs', 'services/fiscalTaxProfileCore.cjs', 'services/fiscalTaxProfilesServer.cjs'];
const dataFiles = ['data/fiscal/ncm-vigente.json', 'data/fiscal/cest-conv142.json'];
const portal = 'services/accountantPortalServer.cjs';
const migration = 'migrations/028_fiscal_tax_profiles.sql';
// O proxy do site precisa liberar as rotas novas para a contadora (linhas marcadas com MDV-FISCAL-TAX-PROFILES).
const serverFiles = [['vps_server.js', 'server.js'], ['vps_server.js', 'vps_server.js'], ['vps_server.cjs', 'vps_server.cjs']];
const PROXY_MARK = 'MDV-FISCAL-TAX-PROFILES';
const HOOK = /\n\n  \/\/ Perfis fiscais por produto[^\n]*\n  require\('\.\/fiscalTaxProfilesServer\.cjs'\)[^\n]*\n/;
const runNode = (exec, appDir, source) => exec(`cd ${appDir} && node -e "eval(Buffer.from('${Buffer.from(source).toString('base64')}','base64').toString())"`);
const sha = text => crypto.createHash('sha256').update(text).digest('hex');

function expectedRemoteServerHash(root, local) {
  const text = fs.readFileSync(path.join(root, local), 'utf8').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  if (lines.filter(line => line.includes(PROXY_MARK)).length !== 2) throw new Error(`${local}: liberação do proxy ausente.`);
  return { withoutHook: sha(lines.filter(line => !line.includes(PROXY_MARK)).join('\n')), withHook: sha(text) };
}

/** O portal publicado precisa ser igual ao local sem o gancho novo; senão haveria código não revisado indo junto. */
function expectedRemotePortalHash(root) {
  const local = fs.readFileSync(path.join(root, portal), 'utf8').replace(/\r\n/g, '\n');
  if (!HOOK.test(local)) throw new Error('Gancho dos perfis fiscais ausente no portal local.');
  return { withoutHook: sha(local.replace(HOOK, '\n')), withHook: sha(local) };
}

async function deployFiscalTaxProfiles({ appDir, apiProc, exec, upload, root, checkOnly = false }) {
  if (appDir !== '/var/www/mdv-api' || apiProc.name !== 'mdv-api') throw new Error('Unexpected API target');
  const dbSetup = `require('dotenv').config({quiet:true});const db=await require('mysql2/promise').createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME});`;
  await runNode(exec, appDir, `(async()=>{${dbSetup}
    for(const table of ['company_fiscal_profiles','company_fiscal_events','company_accountant_access','products']){const [r]=await db.query('SHOW TABLES LIKE ?',[table]);if(!r.length)throw new Error('Missing table: '+table);}
    const [cols]=await db.query('SHOW COLUMNS FROM products');const names=new Set(cols.map(c=>c.Field));for(const c of ['id','name','sku','ncm','cest','origin','is_parent'])if(!names.has(c))throw new Error('Missing column: products.'+c);
    await db.end();console.log('Fiscal tax profiles preflight passed');
  })().catch(e=>{console.error(e.message);process.exit(1)});`);
  const { withoutHook, withHook } = expectedRemotePortalHash(root);
  const remote = String(await exec(`tr -d '\\r' < ${appDir}/${portal} | sha256sum | cut -d' ' -f1`)).trim();
  if (remote !== withoutHook && remote !== withHook) throw new Error(`${portal} na VPS diverge do local (fora o gancho novo). Publique ou reconcilie antes.`);
  console.log(`Portal remoto confere (${remote === withHook ? 'já tem o gancho' : 'sem o gancho'})`);
  for (const [local, target] of serverFiles) {
    const expected = expectedRemoteServerHash(root, local);
    const current = String(await exec(`tr -d '\\r' < ${appDir}/${target} | sha256sum | cut -d' ' -f1`)).trim();
    if (current !== expected.withoutHook && current !== expected.withHook) throw new Error(`${target} na VPS diverge do local (fora a liberação do proxy). Publique ou reconcilie antes.`);
  }
  console.log('Servidor remoto confere com o local');
  if (checkOnly) return;
  const backup = `${appDir}/backups/fiscal-tax-profiles-${Date.now()}`;
  const files = [...modules, ...dataFiles, portal];
  await exec(`mkdir -p ${backup}/services ${backup}/data/fiscal ${appDir}/data/fiscal ${appDir}/migrations && chmod 700 ${backup}`);
  for (const file of [...files, ...serverFiles.map(([, target]) => target)]) await exec(`if test -f ${appDir}/${file}; then cp -p ${appDir}/${file} ${backup}/${file}; fi`);
  for (const file of files) {
    const staged = `${appDir}/${file}.next${file.endsWith('.cjs') ? '.cjs' : ''}`;
    await upload(path.join(root, file), staged);
    if (file.endsWith('.cjs')) await exec(`node --check ${staged}`);
    else await exec(`node -e "JSON.parse(require('fs').readFileSync('${staged}','utf8'))"`);
  }
  for (const [local, target] of serverFiles) { await upload(path.join(root, local), `${appDir}/${target}.next.cjs`); await exec(`node --check ${appDir}/${target}.next.cjs`); }
  await upload(path.join(root, migration), `${appDir}/${migration}.next`);
  await runNode(exec, appDir, `(async()=>{const fs=require('fs');${dbSetup}
    const sql=fs.readFileSync('${migration}.next','utf8').replace(/--[^\\n]*/g,'');
    for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await db.query(statement);
    for(const table of ['company_fiscal_tax_profiles','product_fiscal_settings']){const [r]=await db.query('SHOW TABLES LIKE ?',[table]);if(!r.length)throw new Error('Migration missing '+table);}
    await db.end();console.log('Fiscal tax profile tables ready');
  })().catch(e=>{console.error(e.message);process.exit(1)});`);
  try {
    for (const file of files) await exec(`mv ${appDir}/${file}.next${file.endsWith('.cjs') ? '.cjs' : ''} ${appDir}/${file}`);
    for (const [, target] of serverFiles) await exec(`mv ${appDir}/${target}.next.cjs ${appDir}/${target}`);
    await exec(`mv ${appDir}/${migration}.next ${appDir}/${migration}`);
    await exec('pm2 restart mdv-api');
    await runNode(exec, appDir, `(async()=>{for(let i=0;i<20;i++){try{const r=await fetch('http://127.0.0.1:4000/status');const s=await r.json();if(r.ok&&s.mysql?.ok){console.log('API and MySQL healthy');return;}}catch{}await new Promise(r=>setTimeout(r,1500));}throw new Error('API did not become healthy');})().catch(e=>{console.error(e.message);process.exit(1)});`);
    await runNode(exec, appDir, `const c=require('./services/fiscalCatalog.cjs');const r=c.lookupNcm('85171300');if(!r.valid)throw new Error('Catalogo NCM nao carregou');if(!c.cestForNcm('85171300').length)throw new Error('Catalogo CEST nao carregou');console.log('Fiscal catalog loaded: '+r.formatted);`);
  } catch (error) {
    for (const file of [...files, ...serverFiles.map(([, target]) => target)]) await exec(`if test -f ${backup}/${file}; then cp -p ${backup}/${file} ${appDir}/${file}; fi`);
    await exec('pm2 restart mdv-api');
    throw error;
  }
  console.log(`Fiscal tax profiles deployed; backup: ${backup}`);
}

module.exports = { modules, dataFiles, portal, migration, serverFiles, expectedRemotePortalHash, expectedRemoteServerHash, deployFiscalTaxProfiles };
