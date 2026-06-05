import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const serverPaths = [
  path.join(root, 'server.js'),
  path.join(root, 'vps_server.js'),
  path.join(root, 'vps_server.cjs'),
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const serverPath of serverPaths) {
  const source = fs.readFileSync(serverPath, 'utf8');
  const filename = path.basename(serverPath);

  assert(
    source.includes("const AUTORESPONDER_AUDIO_UNSUPPORTED_REPLY = 'Recebi seu áudio, mas ainda não consigo ouvir por aqui. Pode me mandar em texto?';"),
    `${filename} must keep the fixed audio unsupported reply`
  );
  assert(
    source.includes('function isAutoresponderAudioMessage(message)'),
    `${filename} must detect audio placeholders`
  );
  assert(
    source.includes("function isAutoresponderAudioPayload(payload, message = '')"),
    `${filename} must detect audio metadata in webhook payloads`
  );
  assert(
    source.includes('const isAudioPayload = isAutoresponderAudioPayload(payload, message);'),
    `${filename} webhook must evaluate audio payloads before other fallbacks`
  );
  assert(
    /if \(!message && !isAudioPayload\) \{[\s\S]*?return \{ replies: \[\] \};[\s\S]*?\}/.test(source),
    `${filename} webhook must ignore empty non-text events instead of sending fallback`
  );
  assert(
    /if \(isAudioPayload\) \{[\s\S]*?intent: 'audio_unsupported'[\s\S]*?return \{ replies: \[\{ message: AUTORESPONDER_AUDIO_UNSUPPORTED_REPLY \}\] \};/.test(source),
    `${filename} webhook must answer audio payloads before other fallbacks`
  );
}

console.log('autoresponder audio placeholder static checks passed');
