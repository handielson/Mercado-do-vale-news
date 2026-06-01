import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/catalogShareService.ts', 'utf8');

assert.doesNotMatch(source, /from ['"]\.\/supabase['"]|supabase\.from|createClient/, 'catalog share service must not use Supabase directly');
assert.match(source, /publicCompanySettingsService/, 'catalog share service must read company data through the VPS-backed public company settings service');
assert.match(source, /vpsClient/, 'catalog share service must use vpsClient for share tracking');
assert.match(source, /\/table-data\/catalog_shares/, 'catalog share tracking must write through the VPS table-data endpoint');
assert.match(source, /share_type/, 'catalog share tracking must preserve share_type payload');

console.log('catalog share service VPS static checks passed');
