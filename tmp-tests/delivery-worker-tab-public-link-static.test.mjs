import assert from 'node:assert/strict';
import fs from 'node:fs';

const tab = fs.readFileSync('components/customer/profile/DeliveryWorkerTab.tsx', 'utf8');

assert.match(
    tab,
    /function buildDeliveryOperationUrl/,
    'DeliveryWorkerTab deve ter um helper para montar a URL publica da entrega'
);

assert.match(
    tab,
    /\/delivery\/\$\{encodeURIComponent\(cleanToken\)\}/,
    'DeliveryWorkerTab deve montar a rota publica /delivery/:token usando o token do job'
);

assert.match(
    tab,
    /Abrir entrega/,
    'Entregas em aberto devem exibir um link/botao "Abrir entrega"'
);

assert.match(
    tab,
    /target="_blank"/,
    'O link da entrega deve abrir em nova aba'
);

assert.match(
    tab,
    /rel="noreferrer"/,
    'O link da entrega deve usar rel="noreferrer"'
);

const openJobsSection = tab.slice(tab.indexOf('Entregas em aberto'), tab.indexOf('Entregas registradas'));
assert.match(
    openJobsSection,
    /href=\{deliveryUrl\}/,
    'O link publico deve aparecer dentro da lista de entregas em aberto'
);

assert.doesNotMatch(
    openJobsSection,
    /isAdminMode && \(\s*deliveryUrl/,
    'O link publico da entrega nao pode ficar restrito ao modo admin'
);

console.log('delivery-worker-tab-public-link-static.test.mjs: ok');
