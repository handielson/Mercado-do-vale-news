import fs from 'node:fs';
import path from 'node:path';
import { readBotWhatsappDoc } from '../tools/autoresponder-bot-doc.cjs';

const root = process.cwd();
const serverPath = path.join(root, 'vps_server.cjs');
const typesPath = path.join(root, 'types', 'autoResponder.ts');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const server = fs.readFileSync(serverPath, 'utf8');
const types = fs.readFileSync(typesPath, 'utf8');
const doc = readBotWhatsappDoc(root);

[
  'AUTORESPONDER_ATTACHMENT_SYNOLOGY_FOLDER',
  'safeAutoresponderAttachmentFilename',
  'uploadAutoresponderAttachmentToSynology',
  "storage: 'synology'",
  "storage: 'local'",
  'SYNO_CDN[folder]',
  'Synology unavailable for autoresponder attachment',
].forEach((token) => {
  assert(server.includes(token), `Autoresponder attachment endpoint must include ${token}`);
});

assert(
  server.includes("const folder = AUTORESPONDER_ATTACHMENT_SYNOLOGY_FOLDER;"),
  'Autoresponder attachment upload must use its dedicated Synology folder setting'
);
assert(
  server.includes("if (SYNO_USER && SYNO_PASS)"),
  'Autoresponder attachment upload must only attempt Synology when credentials exist'
);
assert(
  server.includes("return { ok: true, url: synologyResult.url, filename, storage: 'synology' };"),
  'Autoresponder attachment upload must return Synology URL after successful upload'
);
assert(
  server.includes("return { ok: true, url, filename, storage: 'local' };"),
  'Autoresponder attachment upload must keep local fallback response'
);
assert(
  types.includes("storage?: 'synology' | 'local';"),
  'AutoResponderAttachmentUpload must expose returned storage'
);
assert(
  doc.includes('- [x] Upload de imagem indo para Synology'),
  'Bot_Whatsapp.md must mark Synology attachment upload after implementation'
);

console.log('autoresponder attachment synology static checks passed');
