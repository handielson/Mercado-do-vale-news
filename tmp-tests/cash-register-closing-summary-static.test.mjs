import fs from 'node:fs';
import assert from 'node:assert/strict';

const hook = fs.readFileSync('hooks/useCashSession.ts', 'utf8');
const page = fs.readFileSync('pages/admin/financial/CashRegisterPage.tsx', 'utf8');
const types = fs.readFileSync('types/cashRegister.ts', 'utf8');
const server = fs.readFileSync('vps_server.js', 'utf8');

assert(
  hook.includes('cashRegisterService.getSessionSummary(result.session.id)'),
  'useCashSession must fetch the detailed summary when /current has an open session without summary'
);

assert(
  hook.includes('createEmptyCashSessionSummary(result.session)'),
  'useCashSession must keep an opening-amount fallback summary when the detailed summary is unavailable'
);

assert(
  page.includes('summaryForSession') && page.includes('summary || createEmptyCashSessionSummary(session)'),
  'CashRegisterPage must render cards and closing wizard from a safe session summary'
);

assert(
  !page.includes('session && summary && <CashClosingWizard'),
  'CashClosingWizard must not be gated by the raw summary response'
);

assert(
  types.includes('expected_cash_cents: openingAmountCents'),
  'empty cash summary must use opening_amount_cents as expected cash fallback'
);

assert(
  server.includes('missingOpeningFloatCents') &&
    server.includes('expectedCashCents = cashFromMethods + movementsInCents + missingOpeningFloatCents - movementsOutCents'),
  'cash summary API must add opening_amount_cents when the opening_float movement is missing'
);

console.log('cash register closing summary static checks passed');
