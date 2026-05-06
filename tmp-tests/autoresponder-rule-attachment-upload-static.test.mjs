import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagePath = path.join(root, 'pages', 'admin', 'AutoResponderPage.tsx');
const docPath = path.join(root, 'Bot_Whatsapp.md');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const page = fs.readFileSync(pagePath, 'utf8');
const doc = fs.readFileSync(docPath, 'utf8');

[
  'attachment_url: string;',
  'attachment_caption: string;',
  'isUploadingAttachment',
  'uploadRuleAttachment',
  'autoResponderService.uploadAttachment',
  'onUploadAttachment',
  'onRemoveAttachment',
  'accept="image/*"',
].forEach((token) => {
  assert(page.includes(token), `Rule attachment upload must include ${token}`);
});

[
  'Imagem da resposta',
  'Enviar imagem',
  'Legenda do anexo',
  'Remover anexo',
  'Anexo enviado',
].forEach((label) => {
  assert(page.includes(label), `Rule attachment upload must render label: ${label}`);
});

assert(
  page.includes('attachment_url: form.attachment_url.trim() || null'),
  'Rule payload must preserve uploaded attachment URL'
);
assert(
  page.includes('attachment_caption: form.attachment_caption.trim() || null'),
  'Rule payload must preserve attachment caption'
);
assert(
  doc.includes('- [x] Upload de anexo dentro do modal'),
  'Bot_Whatsapp.md must mark attachment upload inside modal'
);
assert(
  doc.includes('- [x] Upload de imagem indo para Synology'),
  'Bot_Whatsapp.md must mark Synology upload after Fase 3N'
);
assert(
  doc.includes('Ainda falta teste real em VPS/NAS'),
  'Bot_Whatsapp.md must keep the VPS/NAS real upload validation caveat'
);

console.log('autoresponder rule attachment upload static checks passed');
