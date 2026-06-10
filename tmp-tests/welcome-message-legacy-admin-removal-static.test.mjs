import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const routes = readFileSync('routes/index.tsx', 'utf8');
const layout = readFileSync('layouts/AdminLayout.tsx', 'utf8');

assert.ok(!routes.includes('/admin/settings/messages'), 'legacy welcome message route must be removed');
assert.ok(!routes.includes('pages/admin/settings/MessagesPage'), 'legacy settings MessagesPage lazy import must be removed');
assert.ok(!routes.includes('<MessagesPage />'), 'legacy settings MessagesPage render must be removed');
assert.ok(!layout.includes('Mensagens Auto'), 'legacy Mensagens Auto menu item must be removed');
assert.ok(!existsSync('pages/admin/settings/MessagesPage.tsx'), 'legacy welcome message admin page must be deleted');
assert.ok(existsSync('services/welcomeMessageService.ts'), 'welcome message service must remain for future Evolution API automation');

console.log('welcome message legacy admin removal static checks passed');
