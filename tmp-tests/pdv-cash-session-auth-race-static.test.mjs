import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hook = readFileSync('hooks/useCashSession.ts', 'utf8');
const modal = readFileSync('components/pdv/CashOpeningModal.tsx', 'utf8');
const pdv = readFileSync('pages/pdv/PDVPage.tsx', 'utf8');
const cashPage = readFileSync('pages/admin/financial/CashRegisterPage.tsx', 'utf8');

assert.match(hook, /useVpsAuth\(\)/, 'cash session lookup must wait for VPS authentication');
assert.match(hook, /if \(isAuthLoading\) return/, 'cash session lookup must not run before authentication resolves');
assert.match(hook, /\[isAuthLoading, refresh, user\?\.id\]/, 'cash session lookup must rerun when the authenticated user changes');
assert.match(modal, /onAlreadyOpen/, 'opening modal must recover from an already-open cash session');
assert.match(pdv, /onAlreadyOpen=\{\(\) => \{\s*void refreshCashSession\(\);/, 'PDV must refresh the existing session after a duplicate open response');
assert.match(cashPage, /onAlreadyOpen=\{\(\) => refresh\(\)\}/, 'cash page must refresh after a duplicate open response');

console.log('PDV cash session auth race static checks ok');
