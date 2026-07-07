import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panel = readFileSync('components/whatsapp/WhatsAppNumberSwitchPanel.tsx', 'utf8');
const page = readFileSync('pages/admin/settings/WhatsAppPage.tsx', 'utf8');

const requiredText = [
  'Troca segura de numero',
  'Iniciar troca de numero',
  'Desconectar WhatsApp atual',
  'Gerar QR Code do novo numero',
  'Confirmar este numero como oficial',
  'Manter bot pausado e sair',
  'Checklist final',
];

for (const text of requiredText) {
  assert.ok(panel.includes(text), `panel must render "${text}"`);
}

const requiredCalls = [
  'autoResponderService.getWhatsAppSwitchStatus',
  'autoResponderService.startWhatsAppNumberSwitch',
  'autoResponderService.disconnectWhatsAppForSwitch',
  'autoResponderService.connectWhatsAppForSwitch',
  'autoResponderService.confirmWhatsAppNumberSwitch',
  'autoResponderService.keepWhatsAppSwitchPaused',
];

for (const call of requiredCalls) {
  assert.ok(panel.includes(call), `panel must call ${call}`);
}

assert.match(panel, /window\.confirm\('Desconectar o WhatsApp atual/, 'disconnect action must require explicit confirmation');
assert.match(panel, /status\?\.control\?\.paused !== true/, 'dangerous actions must be blocked unless bot is paused');
assert.match(panel, /status\?\.evolution\?\.state === 'open'/, 'confirmation must depend on Evolution open state');
assert.match(panel, /data:image\/png;base64/, 'panel must render bare QR base64 as an image data URL');
assert.match(panel, /status\?\.connect\?\.message/, 'panel must show backend connect guidance when QR is not available');
assert.match(panel, /const \[qrCode, setQrCode\]/, 'panel must keep QR code in dedicated state so status polling does not erase it');
assert.match(panel, /setQrCode\(nextQrCode\)/, 'panel must persist the QR received from the connect action');
assert.match(panel, /visibleQrCode = qrCode \|\| getQrCode\(status\)/, 'panel must keep showing the last QR while polling connection status');
assert.match(page, /import \{ WhatsAppNumberSwitchPanel \}/, 'WhatsApp page must import the switch panel');
assert.match(page, /<WhatsAppNumberSwitchPanel \/>/, 'WhatsApp page must render the switch panel');
assert.doesNotMatch(page, /import \{ WhatsAppConnectionPanel \}/, 'WhatsApp page must not import the legacy connection panel beside the guided switch flow');
assert.doesNotMatch(page, /<WhatsAppConnectionPanel \/>/, 'WhatsApp page must not render two disconnect/connect panels');
assert.doesNotMatch(page, /import \{ WhatsAppMigrationChecklist \}/, 'WhatsApp page must not import the obsolete migration checklist');
assert.doesNotMatch(page, /<WhatsAppMigrationChecklist \/>/, 'WhatsApp page must not render the obsolete migration checklist block');

console.log('whatsapp number switch panel static checks passed');
