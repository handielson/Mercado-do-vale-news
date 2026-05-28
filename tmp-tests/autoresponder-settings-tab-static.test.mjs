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
  'SettingsFormState',
  'settingsToForm',
  'settingsFormToInput',
  'settingsForm',
  'isSavingSettings',
  'settingsNotice',
  'updateSettingsForm',
].forEach((token) => {
  assert(page.includes(token), `Settings tab must include ${token}`);
});

assert(page.includes('autoResponderService.updateSettings'), 'Settings tab must save through updateSettings');

[
  'Atendimento humano',
  'Mensagem no horário',
  'Mensagem fora do horário',
  'Pausa humana',
  'Saudação',
  'Prefixo de saudação',
  'Usar assinatura virtual',
  'Assinatura das respostas',
  'Auto-pausa',
  'Limites',
  'Imagens',
  'Enviar imagens de produtos',
  'Listas numeradas',
  'Arquivamento Synology',
  'Salvar configurações',
  'Configurações salvas',
].forEach((label) => {
  assert(page.includes(label), `Settings tab must render label: ${label}`);
});

[
  'human_message_in_hours',
  'human_message_out_of_hours',
  'human_pause_minutes',
  'greeting_prefix',
  'fallback_message',
  'signature_enabled',
  'signature_message',
  'auto_pause_fallback_threshold',
  'auto_pause_fallback_minutes',
  'auto_pause_fallback_message',
  'max_replies_per_conversation',
  'max_replies_window_hours',
  'send_product_images',
  'max_images_per_response',
  'use_numbered_lists',
  'numbered_list_threshold',
  'numbered_list_validity_minutes',
  'archive_to_synology',
  'archive_after_days',
].forEach((field) => {
  assert(page.includes(field), `Settings form must handle ${field}`);
});

assert(doc.includes('- [x] Bloco "Atendimento humano" (2 textareas + pausa)'), 'Bot_Whatsapp.md must mark human service block');
assert(doc.includes('- [x] Bloco "Saudação"'), 'Bot_Whatsapp.md must mark greeting block');
assert(doc.includes('- [x] Bloco "Assinatura virtual" editavel'), 'Bot_Whatsapp.md must mark virtual signature block');
assert(doc.includes('- [x] Bloco "Auto-pausa"'), 'Bot_Whatsapp.md must mark auto-pause block');
assert(doc.includes('- [x] Bloco "Limites"'), 'Bot_Whatsapp.md must mark limits block');
assert(doc.includes('- [x] Bloco "Imagens"'), 'Bot_Whatsapp.md must mark images block');

console.log('autoresponder settings tab static checks passed');
