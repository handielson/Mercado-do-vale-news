import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('pages/admin/settings/WhatsAppPage.tsx', 'utf8');

assert.doesNotMatch(source, /lib\/supabase|from ['"][^'"]*supabase['"]/, 'WhatsAppPage must not import Supabase directly');
assert.match(source, /getWhatsAppSettings/, 'WhatsAppPage must keep using the WhatsApp settings service');
assert.match(source, /updateWhatsAppSettings/, 'WhatsAppPage must keep saving through the WhatsApp settings service');

console.log('WhatsAppPage no direct Supabase import static checks passed');
