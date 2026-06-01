import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/whatsappSettingsService.ts', 'utf8');

assert.doesNotMatch(source, /from ['"]\.\/supabase['"]|supabase\.from|createClient/, 'WhatsApp settings service must not use Supabase directly');
assert.match(source, /vpsClient/, 'WhatsApp settings service must use vpsClient');
assert.match(source, /\/table-data\/whatsapp_settings/, 'WhatsApp settings service must call the VPS table-data endpoint');
assert.match(source, /encodeURIComponent\(id\)/, 'WhatsApp settings updates must safely address rows by id');
assert.match(source, /api_url:\s*''/, 'WhatsApp settings service must preserve the empty default settings shape');

console.log('whatsapp settings service VPS static checks passed');
