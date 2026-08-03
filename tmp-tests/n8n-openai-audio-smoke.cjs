const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

function runRemoteInput(conn, command, input) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`)));
    stream.end(input);
  }));
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  try {
    const remoteScript = `
require('dotenv').config({ path: '.env', quiet: true });
const mysql = require('mysql2/promise');
function makeWav() {
  const sampleRate = 16000;
  const seconds = 1;
  const samples = sampleRate * seconds;
  const dataSize = samples * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + dataSize, 4); wav.write('WAVE', 8);
  wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples; i += 1) wav.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / sampleRate) * 1200), 44 + i * 2);
  return wav;
}
(async () => {
  const pool = mysql.createPool({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME, connectionLimit: 1 });
  try {
    const [rows] = await pool.query('SELECT openai_api_key FROM autoresponder_settings WHERE id = 1 LIMIT 1');
    const key = String(rows?.[0]?.openai_api_key || process.env.OPENAI_API_KEY || '').trim();
    if (!key) throw new Error('OpenAI API key is not configured');
    const form = new FormData();
    form.append('file', new Blob([makeWav()], { type: 'audio/wav' }), 'technical-smoke.wav');
    form.append('model', 'gpt-4o-mini-transcribe');
    form.append('language', 'pt');
    form.append('response_format', 'json');
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: form,
    });
    const body = await response.json().catch(() => ({}));
    process.stdout.write(JSON.stringify({
      http: response.status,
      ok: response.ok,
      responseIsJson: Boolean(body && typeof body === 'object'),
      errorType: response.ok ? null : String(body?.error?.type || 'unknown'),
      errorCode: response.ok ? null : String(body?.error?.code || ''),
    }));
    if (!response.ok) process.exitCode = 1;
  } finally {
    await pool.end();
  }
})().catch((error) => { console.error(error.message); process.exit(1); });`;
    const output = await runRemoteInput(conn, 'cd /var/www/mdv-api && node', remoteScript);
    console.log(JSON.stringify(JSON.parse(output), null, 2));
  } finally {
    conn.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
