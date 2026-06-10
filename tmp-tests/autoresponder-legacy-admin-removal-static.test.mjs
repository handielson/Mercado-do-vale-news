import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const routes = readFileSync('routes/index.tsx', 'utf8');
const layout = readFileSync('layouts/AdminLayout.tsx', 'utf8');

assert.ok(!routes.includes('AutoResponderPage'), 'routes must not import AutoResponderPage');
assert.ok(!routes.includes('/admin/atendimento-automatico'), 'legacy autoresponder route must be removed');
assert.ok(!layout.includes('AutoResponder'), 'legacy AutoResponder menu item must be removed');
assert.ok(!existsSync('pages/admin/AutoResponderPage.tsx'), 'legacy AutoResponderPage file must be deleted');
assert.ok(!existsSync('components/autoresponder/BlockNumberModal.tsx'), 'unused legacy BlockNumberModal must be deleted');
assert.ok(!existsSync('components/autoresponder/ConversationCard.tsx'), 'unused legacy ConversationCard must be deleted');

console.log('autoresponder legacy admin removal static checks passed');
