const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const deploySource = fs.readFileSync(path.join(root, 'deploy.cjs'), 'utf8');

function readConst(name) {
  const match = deploySource.match(new RegExp(`const ${name} = '([^']+)';`));
  if (!match) throw new Error(`Missing ${name} in deploy.cjs`);
  return match[1];
}

function exec(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => {
        if (code === 0) return resolve(stdout);
        reject(new Error(stderr || stdout || `Command failed: ${command}`));
      });
      stream.on('data', (data) => { stdout += data.toString(); });
      stream.stderr.on('data', (data) => { stderr += data.toString(); });
    });
  });
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: readConst('VpsHost'),
      port: 22,
      username: readConst('VpsUser'),
      password: readConst('VpsPass'),
      readyTimeout: 15000,
    });
  });

  const code = `
    require('dotenv').config({ path: '/var/www/mdv-api/.env', quiet: true });
    const mysql = require('mysql2/promise');
    const messages = {
      humanIn: 'Certo, vou chamar um especialista para te atender. Por favor aguarde um instante.',
      humanOut: 'Certo, vou chamar um especialista. Estamos fora do horario de atendimento humano agora, mas sua mensagem ficou registrada e vamos te responder assim que possivel.',
      fallback: 'Nao consegui localizar exatamente isso agora. Me diga o modelo do aparelho ou o tipo de produto que voce procura.',
      autoPause: 'Vou chamar um atendente para te ajudar melhor. Assim conseguimos conferir certinho pra voce.',
    };
    (async () => {
      const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
      });
      await pool.query(
        \`UPDATE autoresponder_settings
         SET human_message_in_hours = ?,
             human_message_out_of_hours = ?,
             fallback_message = ?,
             auto_pause_fallback_message = ?
         WHERE id = 1\`,
        [messages.humanIn, messages.humanOut, messages.fallback, messages.autoPause]
      );
      const [rows] = await pool.query(
        \`SELECT
           CHAR_LENGTH(human_message_in_hours) AS human_in_len,
           CHAR_LENGTH(human_message_out_of_hours) AS human_out_len,
           CHAR_LENGTH(fallback_message) AS fallback_len,
           CHAR_LENGTH(auto_pause_fallback_message) AS auto_pause_len
         FROM autoresponder_settings
         WHERE id = 1\`
      );
      await pool.end();
      console.log(JSON.stringify({ ok: true, lengths: rows[0] }, null, 2));
    })().catch((err) => { console.error(err); process.exit(1); });
  `;

  const encoded = Buffer.from(code, 'utf8').toString('base64');
  const output = await exec(conn, `cd /var/www/mdv-api && node -e "eval(Buffer.from('${encoded}','base64').toString('utf8'))"`);
  conn.end();
  console.log(output);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
