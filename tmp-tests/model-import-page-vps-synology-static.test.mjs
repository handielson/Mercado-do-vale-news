import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('pages/admin/import/ModelImportPage.tsx', 'utf8');

assert.doesNotMatch(
  source,
  /supabase/i,
  'ModelImportPage must not mention Supabase for future model import/storage work'
);

assert.match(
  source,
  /Synology|VPS/,
  'ModelImportPage should point model import/storage work to VPS/Synology'
);

console.log('model import page VPS/Synology static checks passed');
