'use strict';

const { Client } = require('ssh2');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

for (const file of ['.env.vps.local', '.env.local']) {
  require('dotenv').config({ path:path.join(__dirname, '..', file), quiet:true });
}

const apply = process.argv.includes('--apply');
const host = process.env.VPS_SITE_HOST || process.env.VPS_HOST;
const username = process.env.VPS_SITE_USER || process.env.VPS_USER;
const password = process.env.VPS_SITE_PASSWORD || process.env.VPS_ROOT_PASSWORD || process.env.VPS_PASSWORD;
const privateKeyPath = process.env.VPS_SITE_PRIVATE_KEY || process.env.VPS_PRIVATE_KEY;
const privateKey = privateKeyPath ? fs.readFileSync(privateKeyPath) : undefined;
const appDir = '/var/www/mdv-api';
if (!host || !username || (!password && !privateKey)) throw new Error('Missing VPS SSH configuration');

const quote = value => `'${String(value).replace(/'/g, `'\\''`)}'`;
const connection = new Client();
function exec(command) {
  return new Promise((resolve, reject) => connection.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '', stderr = '';
    stream.on('data', chunk => { stdout += chunk.toString(); });
    stream.stderr.on('data', chunk => { stderr += chunk.toString(); });
    stream.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(stderr || `Remote command failed (${code})`)));
  }));
}
function nodeCommand(source) {
  const encoded = Buffer.from(source).toString('base64');
  return `cd ${quote(appDir)} && node -e ${quote(`eval(Buffer.from('${encoded}','base64').toString())`)}`;
}

async function remoteSource(shouldApply) {
  const fs = require('node:fs');
  const crypto = require('node:crypto');
  const dotenv = require('dotenv');
  const mysql = require('mysql2/promise');
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const envPath = '.env';
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = dotenv.parse(raw);
  const featureKeys = Object.keys(env).filter(key => /^MDV_PRINT3D_.*_ENABLED$/.test(key));
  if (featureKeys.some(key => env[key] === '1')) throw new Error('Print3D features must remain disabled during company configuration');
  const companyId = String(env.COMPANY_ID || env.VITE_COMPANY_ID || '9717131e-7b14-4aec-84a4-4317c0489985');
  if (!UUID.test(companyId)) throw new Error('Operational company id is invalid');
  const db = await mysql.createConnection({ host:env.DB_HOST, user:env.DB_USER, password:env.DB_PASS, database:env.DB_NAME });
  try {
    const [[products]] = await db.query(`SELECT COUNT(*) total,
      SUM(CASE WHEN company_id=? THEN 1 ELSE 0 END) operational FROM products`, [companyId]);
    if (!Number(products.total) || Number(products.operational) / Number(products.total) < 0.9) {
      throw new Error('Operational company does not own the dominant catalog');
    }
    const [settings] = await db.query('SELECT id FROM company_settings LIMIT 2');
    if (settings.length !== 1) throw new Error('Expected exactly one primary company settings row');
    const [[fiscal]] = await db.query(`SELECT COUNT(*) linked,
      SUM(CASE WHEN c.verified_locally=1 AND c.valid_until>=CURRENT_DATE THEN 1 ELSE 0 END) valid_certificate,
      SUM(CASE WHEN v.status='approved' THEN 1 ELSE 0 END) approved_tax_validation
      FROM company_fiscal_profiles p
      LEFT JOIN company_certificate_settings c ON c.profile_id=p.id
      LEFT JOIN company_fiscal_tax_validations v ON v.profile_id=p.id
      WHERE p.settings_id=?`, [settings[0].id]);
    if (Number(fiscal.linked) !== 1) throw new Error('Primary fiscal profile is missing or ambiguous');
    const [[payments]] = await db.query(`SELECT COUNT(*) active FROM payment_integrations
      WHERE company_id=? AND is_active=1`, [companyId]);
    if (!Number(payments.active)) throw new Error('Operational company has no active payment integration');
    const alreadyConfigured = String(env.MDV_PRINT3D_COMPANY_ID || '') === companyId;
    let backup = null;
    if (shouldApply && !alreadyConfigured) {
      const stamp = new Date().toISOString().replace(/[^0-9]/g, '');
      backup = `.deploy-backups/print3d-company-${stamp}-${crypto.randomBytes(3).toString('hex')}.env`;
      fs.mkdirSync('.deploy-backups', { recursive:true, mode:0o700 });
      fs.copyFileSync(envPath, backup, fs.constants.COPYFILE_EXCL);
      fs.chmodSync(backup, 0o600);
      const line = `MDV_PRINT3D_COMPANY_ID=${companyId}`;
      const next = /^MDV_PRINT3D_COMPANY_ID=.*$/m.test(raw)
        ? raw.replace(/^MDV_PRINT3D_COMPANY_ID=.*$/m, line)
        : `${raw.replace(/\s*$/, '')}\n${line}\n`;
      const temporary = `.env.print3d-company-${process.pid}`;
      fs.writeFileSync(temporary, next, { mode:0o600, flag:'wx' });
      fs.renameSync(temporary, envPath);
    }
    const verified = dotenv.parse(fs.readFileSync(envPath, 'utf8'));
    const configured = String(verified.MDV_PRINT3D_COMPANY_ID || '') === companyId;
    if (shouldApply && !configured) throw new Error('Company configuration verification failed');
    return {
      mode:shouldApply ? 'apply' : 'plan', configured, already_configured:alreadyConfigured,
      company_reference:crypto.createHash('sha256').update(companyId).digest('hex').slice(0,12),
      catalog_products:Number(products.operational), payment_active:true,
      fiscal_profile_linked:true, certificate_valid:Number(fiscal.valid_certificate) === 1,
      tax_validation_approved:Number(fiscal.approved_tax_validation) === 1,
      feature_flags_enabled:featureKeys.filter(key => verified[key] === '1'),
      runtime_restart_required:shouldApply && !alreadyConfigured,
      backup:backup ? `/var/www/mdv-api/${backup}` : null,
    };
  } finally { await db.end(); }
}

async function main() {
  await new Promise((resolve, reject) => {
    connection.on('ready', resolve);
    connection.on('error', reject);
    connection.connect({ host, port:22, username, password, privateKey, readyTimeout:20000 });
  });
  const processes = JSON.parse(await exec('pm2 jlist'));
  const api = processes.filter(item => item.name === 'mdv-api');
  if (api.length !== 1 || api[0].pm2_env?.pm_cwd !== appDir) throw new Error('Unexpected API target');
  const result = JSON.parse((await exec(nodeCommand(`(${remoteSource.toString()})(${JSON.stringify(apply)}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exit(1)})`))).trim());
  console.log(JSON.stringify(result, null, 2));
}

main().finally(() => connection.end()).catch(error => { console.error(error.message); process.exitCode = 1; });
