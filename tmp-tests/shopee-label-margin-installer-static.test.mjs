import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const installer = readFileSync('scripts/install-shopee-label-margin-lenovo.ps1', 'utf8');
const verifier = readFileSync('scripts/verify-shopee-label-margin.cjs', 'utf8');

assert.match(installer, /C:\\ProgramData\\MercadoDoVale\\printer-service/);
assert.match(installer, /shopee-label-core\.cjs/);
assert.match(installer, /Get-FileHash -Algorithm SHA256/);
assert.match(installer, /printer-service\.restore-points/);
assert.match(installer, /IndexOf\('async function expandShopeeLabelForThermalPaper/);
assert.match(installer, /require\('\.\/shopee-label-core\.cjs'\)\.expandShopeeLabelForThermalPaper/);
assert.match(installer, /pm2 restart shopee-auto-print/);
assert.match(installer, /http:\/\/127\.0\.0\.1:8081\/printers/);
assert.doesNotMatch(installer, /shopee_printed|mercado_livre_printed|tiktok_shop_printed/,
  'o instalador nao pode alterar marcadores que impedem impressoes duplicadas');
assert.match(verifier, /101\.6/);
assert.match(verifier, /152\.4/);
assert.match(verifier, /placement\.pageWidth - placement\.x - placement\.width/);

console.log('Shopee label margin installer static checks passed.');
