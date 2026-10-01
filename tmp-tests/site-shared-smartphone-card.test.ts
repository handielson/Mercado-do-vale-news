import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSharedPhoneFeatureSummary } from '../utils/cartShareUtils';

const poco = {
    specs: {
        ram: '12GB',
        storage: '512GB',
        display: '6.67',
        tipo_de_display: 'AMOLED',
        battery_mah: '5110',
        cam_principal_mpx: '50 MP',
        carregamento: '45W turbo',
    },
};

assert.equal(
    buildSharedPhoneFeatureSummary(poco),
    '✨ Tela AMOLED de 6,67”, bateria de 5.110 mAh, câmera de 50 MP e carregamento de 45 W.',
    'site smartphone cards must use the same concise verified feature line as the n8n list',
);

assert.equal(
    buildSharedPhoneFeatureSummary({ specs: { color: 'Preto' } }),
    '',
    'accessories and products without smartphone memory must not receive invented phone features',
);

assert.equal(
    buildSharedPhoneFeatureSummary({ specs: { ram: '4GB', storage: '128GB' } }),
    '',
    'missing verified characteristics must be omitted',
);

const source = readFileSync('utils/cartShareUtils.ts', 'utf8');
assert.match(source, /const plan12 = plans\.find\(plan => plan\.installments === 12\)/);
assert.match(source, /Cartão: 12x de \$\{brl\(plan12\.value\)\} \(total \$\{brl\(plan12\.total\)\}\)/);
assert.match(source, /if \(index > 0\) \{\s*lines\.push\('━{22}'\)/);
assert.match(source, /🎨 Cores: \$\{colors\.length > 0 \? colors\.join\(', '\) : 'Consultar'\}/);
assert.match(source, /lines\.push\(`   🔗 \$\{row\.url\}`\)/);

const cardLine = source.indexOf('💳 Cartão: 12x de ${brl(plan12.value)}');
const colorsLine = source.indexOf('🎨 Cores: ${colors.length');
const linkLine = source.indexOf('🔗 ${row.url}');
assert.ok(cardLine > 0 && cardLine < colorsLine && colorsLine < linkLine, 'site cards must keep payment, colors and link in the expected order');

const n8nNoLinksTest = readFileSync('tmp-tests/n8n-phone-catalog-no-links-static.test.mjs', 'utf8');
assert.match(n8nNoLinksTest, /initialLinksRemoved/);

console.log('site shared smartphone card format checks passed');
