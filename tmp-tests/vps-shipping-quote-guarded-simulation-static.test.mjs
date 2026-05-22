import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = 'tmp-tests/vps-shipping-quote-guarded-simulation.cjs';
const source = readFileSync(file, 'utf8');

assert.match(source, /https:\/\/api\.xiaomipetrolina\.com\.br/, 'script must default to the VPS API base URL');
assert.match(source, /SHIPPING_TEST_PROVIDER/, 'script must require an explicit shipping provider');
assert.match(source, /SHIPPING_TEST_FROM_CEP/, 'script must require an explicit origin CEP');
assert.match(source, /SHIPPING_TEST_TO_CEP/, 'script must require an explicit destination CEP');
assert.match(source, /SHIPPING_TEST_TOKEN/, 'script must require an explicit provider token for real quote calls');
assert.match(source, /CONFIRM_SHIPPING_QUOTE_SIMULATION/, 'script must require explicit shipping quote confirmation');
assert.match(source, /I_UNDERSTAND_SHIPPING_QUOTE_SIMULATION/, 'script must use a deliberate confirmation phrase');
assert.match(source, /DRY_RUN/, 'script must default to dry-run behavior');
assert.match(source, /\/api\/shipping\?provider=\$\{encodeURIComponent\(TEST_PROVIDER\)\}&action=calculate/, 'script must only call /api/shipping calculate');
assert.match(source, /method:\s*'POST'/, 'script must use POST for shipping quote calls');
assert.match(source, /sanitizeShippingQuoteResponse/, 'script must sanitize quote responses');
assert.match(source, /mutation_executed:\s*false/, 'script must report no mutation for skipped/dry-run paths');
assert.match(source, /quote_sent:\s*false/, 'script must report no quote request for skipped/dry-run paths');
assert.doesNotMatch(source, /action=label|shipment\/checkout|shipment\/generate|api\/v2\/me\/cart/, 'script must not create or generate labels');
assert.doesNotMatch(source, /console\.log\([^)]*TEST_TOKEN/, 'script must not print provider tokens directly');

console.log('vps shipping guarded quote simulation static checks ok');
