import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const retiredService = 'services/models-new.ts';
const retiredDebugPage = 'pages/admin/debug/models.tsx';
const blingPage = readFileSync('pages/admin/settings/BlingPage.tsx', 'utf8');

assert.equal(existsSync(retiredService), false, 'models-new Supabase service must be retired; use services/models.ts');
assert.equal(existsSync(retiredDebugPage), false, 'unrouted models debug page must be retired instead of keeping Supabase reads');
assert.doesNotMatch(blingPage, /services\/models-new|['"]\.\.\/\.\.\/\.\.\/services\/models-new['"]/, 'BlingPage must not import models-new');
assert.match(blingPage, /from ['"]\.\.\/\.\.\/\.\.\/services\/models['"]/, 'BlingPage must use the VPS models service');

console.log('retired models-new Supabase service static checks passed');
