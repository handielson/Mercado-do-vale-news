import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = 'tmp-tests/vps-melhor-envio-label-guarded-simulation.cjs';
const source = readFileSync(file, 'utf8');

assert.match(source, /https:\/\/api\.xiaomipetrolina\.com\.br/, 'script must default to the VPS API base URL');
assert.match(source, /MELHOR_ENVIO_TEST_TOKEN/, 'script must require an explicit Melhor Envio token');
assert.match(source, /MELHOR_ENVIO_TEST_CARRIER_ID/, 'script must require an explicit carrier/service id');
assert.match(source, /MELHOR_ENVIO_TEST_FROM_CEP/, 'script must require an explicit origin CEP');
assert.match(source, /MELHOR_ENVIO_TEST_TO_NAME/, 'script must require explicit recipient data');
assert.match(source, /MELHOR_ENVIO_TEST_TO_DOCUMENT/, 'script must require a recipient document for label validation');
assert.match(source, /MELHOR_ENVIO_TEST_TO_POSTAL_CODE/, 'script must require destination postal code');
assert.match(source, /CONFIRM_MELHOR_ENVIO_LABEL_SIMULATION/, 'script must require explicit label confirmation');
assert.match(source, /I_UNDERSTAND_MELHOR_ENVIO_LABEL_SIMULATION/, 'script must use a deliberate confirmation phrase');
assert.match(source, /DRY_RUN/, 'script must default to dry-run behavior');
assert.match(source, /\/api\/shipping\?provider=melhor-envio&action=label/, 'script must only call /api/shipping Melhor Envio label');
assert.match(source, /method:\s*'POST'/, 'script must use POST for label calls');
assert.match(source, /sanitizeMelhorEnvioLabelResponse/, 'script must sanitize label responses');
assert.match(source, /label_requested:\s*false/, 'script must report no label request for skipped/dry-run paths');
assert.doesNotMatch(source, /provider=frenet|action=calculate/, 'script must not call quote endpoints');
assert.doesNotMatch(source, /console\.log\([^)]*TEST_TOKEN/, 'script must not print provider tokens directly');

console.log('vps Melhor Envio guarded label simulation static checks ok');
