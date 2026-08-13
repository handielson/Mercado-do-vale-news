const { Client } = require('ssh2');
const { getVpsSshConfig } = require('../tmp-tests/vps-ssh-config.cjs');

const INSTANCE_NAME = String(process.env.EVOLUTION_INSTANCE_NAME || 'botmercadodovale').trim();
const EVOLUTION_CONTAINER = String(process.env.EVOLUTION_CONTAINER || 'evolution_api').trim();
const APPLY = process.argv.includes('--apply');

const CALL_RESPONSE_MESSAGE = [
  'Olá! 😊',
  '',
  'Vi que você tentou nos ligar.',
  '',
  'Nosso atendimento pelo WhatsApp funciona no computador, então não conseguimos atender chamadas por aqui.',
  '',
  'Pode enviar sua dúvida por mensagem ou áudio? Assim conseguimos atender você com segurança e registrar as informações certinho. 💬🎧',
].join('\n');

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function runRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (error, stream) => {
      if (error) return reject(error);
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk.toString(); });
      stream.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      stream.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr || stdout || `Remote command failed with code ${code}`));
      });
    });
  });
}

function evolutionCurlCommand(method, pathname, payload = null) {
  const url = `http://127.0.0.1:8080${pathname}`;
  const payloadCommand = payload === null
    ? ''
    : ` --header 'Content-Type: application/json' --data-binary "$(printf %s ${shellQuote(Buffer.from(JSON.stringify(payload), 'utf8').toString('base64'))} | base64 -d)"`;
  return [
    'set -eu',
    `api_key=$(docker inspect ${shellQuote(EVOLUTION_CONTAINER)} --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^AUTHENTICATION_API_KEY=//p' | head -n 1)`,
    'test -n "$api_key"',
    `curl -fsS --request ${shellQuote(method)} --header "apikey: $api_key"${payloadCommand} ${shellQuote(url)}`,
  ].join('; ');
}

function normalizeSettings(payload) {
  const source = Array.isArray(payload) ? payload[0] : payload;
  if (source?.settings && typeof source.settings === 'object') return source.settings;
  if (source && typeof source === 'object') return source;
  throw new Error('Evolution returned an invalid settings payload');
}

function writableSettings(settings) {
  const result = {};
  for (const key of ['rejectCall', 'msgCall', 'groupsIgnore', 'alwaysOnline', 'readMessages', 'readStatus', 'syncFullHistory', 'wavoipToken']) {
    if (Object.prototype.hasOwnProperty.call(settings, key)) result[key] = settings[key];
  }
  return result;
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.once('ready', resolve).once('error', reject).connect(getVpsSshConfig()));
  try {
    const currentRaw = await runRemote(conn, evolutionCurlCommand('GET', `/settings/find/${encodeURIComponent(INSTANCE_NAME)}`));
    const current = normalizeSettings(JSON.parse(currentRaw));
    const desired = {
      ...writableSettings(current),
      rejectCall: true,
      msgCall: CALL_RESPONSE_MESSAGE,
    };

    if (APPLY) {
      await runRemote(conn, evolutionCurlCommand('POST', `/settings/set/${encodeURIComponent(INSTANCE_NAME)}`, desired));
    }

    const verifiedRaw = await runRemote(conn, evolutionCurlCommand('GET', `/settings/find/${encodeURIComponent(INSTANCE_NAME)}`));
    const verified = normalizeSettings(JSON.parse(verifiedRaw));
    const matches = verified.rejectCall === true && verified.msgCall === CALL_RESPONSE_MESSAGE;

    console.log(JSON.stringify({
      apply: APPLY,
      instance: INSTANCE_NAME,
      before: {
        rejectCall: current.rejectCall === true,
        messageConfigured: Boolean(String(current.msgCall || '').trim()),
      },
      after: {
        rejectCall: verified.rejectCall === true,
        messageConfigured: Boolean(String(verified.msgCall || '').trim()),
        matchesExpectedMessage: matches,
      },
    }, null, 2));

    if (APPLY && !matches) throw new Error('Evolution call response settings were not persisted');
  } finally {
    conn.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

module.exports = { CALL_RESPONSE_MESSAGE };
