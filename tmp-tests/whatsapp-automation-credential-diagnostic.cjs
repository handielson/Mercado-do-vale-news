const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

function runRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr || stdout || `Remote command failed: ${code}`));
      });
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
    });
  });
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig());
  });

  try {
    const code = `
      require('dotenv').config({ path: '/var/www/mdv-api/.env', quiet: true });
      const crypto = require('crypto');
      const mysql = require('mysql2/promise');

      function fingerprint(value) {
        const text = String(value || '');
        if (!text) return null;
        return {
          length: text.length,
          sha256_12: crypto.createHash('sha256').update(text).digest('hex').slice(0, 12),
        };
      }

      async function checkEvolution(baseUrl, apiKey, instanceName) {
        if (!baseUrl || !apiKey || !instanceName) return { skipped: true };
        try {
          const url = String(baseUrl).replace(/\\/+$/, '') + '/instance/connectionState/' + encodeURIComponent(instanceName);
          const response = await fetch(url, { headers: { apikey: String(apiKey) } });
          const text = await response.text();
          return {
            status: response.status,
            ok: response.ok,
            bodyHint: text.slice(0, 120).replace(/[A-Za-z0-9._~+/=-]{16,}/g, '[REDACTED]'),
          };
        } catch (err) {
          return { error: err.message };
        }
      }

      (async () => {
        const pool = mysql.createPool({
          host: process.env.DB_HOST,
          user: process.env.DB_USER,
          password: process.env.DB_PASS,
          database: process.env.DB_NAME,
        });
        const [settingsRows] = await pool.query(
          "SELECT id, api_url, instance_name, api_key, is_active, updated_at FROM whatsapp_settings WHERE is_active = 1 ORDER BY updated_at DESC, created_at DESC LIMIT 1"
        );
        await pool.end();

        const settings = settingsRows[0] || null;
        const dbConfig = settings ? {
          id: settings.id,
          api_url: settings.api_url,
          instance_name: settings.instance_name,
          is_active: settings.is_active,
          updated_at: settings.updated_at,
          api_key_fingerprint: fingerprint(settings.api_key),
        } : null;

        const envConfig = {
          api_url: process.env.EVOLUTION_SERVER_URL || process.env.EVOLUTION_API_URL || process.env.EVOLUTION_BASE_URL || null,
          instance_name: process.env.EVOLUTION_INSTANCE_NAME || process.env.WHATSAPP_INSTANCE_NAME || null,
          api_key_fingerprint: fingerprint(process.env.EVOLUTION_API_KEY || process.env.EVOLUTION_GLOBAL_API_KEY),
        };

        const dbCheck = settings ? await checkEvolution(settings.api_url, settings.api_key, settings.instance_name) : { skipped: true };
        const envCheck = await checkEvolution(
          envConfig.api_url,
          process.env.EVOLUTION_API_KEY || process.env.EVOLUTION_GLOBAL_API_KEY,
          envConfig.instance_name
        );

        console.log(JSON.stringify({
          dbConfig,
          envConfig,
          same_key_fingerprint: Boolean(dbConfig?.api_key_fingerprint?.sha256_12 && dbConfig.api_key_fingerprint.sha256_12 === envConfig.api_key_fingerprint?.sha256_12),
          same_instance: Boolean(dbConfig?.instance_name && dbConfig.instance_name === envConfig.instance_name),
          checks: {
            db_settings: dbCheck,
            vps_env: envCheck,
          },
        }, null, 2));
      })().catch((err) => { console.error(err.message); process.exit(1); });
    `;

    const encoded = Buffer.from(code, 'utf8').toString('base64');
    const out = await runRemote(conn, `cd /var/www/mdv-api && node -e "eval(Buffer.from('${encoded}','base64').toString('utf8'))"`);
    console.log(out.trim());
  } finally {
    conn.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
