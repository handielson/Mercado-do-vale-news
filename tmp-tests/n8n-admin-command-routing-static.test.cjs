const assert = require('node:assert/strict');
const { patchConnections, validateConnections } = require('./n8n-admin-command-routing.cjs');

const edge = (node) => ({ node, type: 'main', index: 0 });
const connections = {
  'Controle Bot - Registrar Entrada': { main: [[edge('Controle Bot - Buscar Controle')]] },
  'Controle Bot - Buscar Admin Global': { main: [[edge('Controle Bot - Comando Admin')]] },
  'Controle Bot - Comando Admin': { main: [[edge('Controle Bot - E comando admin?')]] },
  'Controle Bot - E comando admin?': { main: [[edge('Controle Bot - Executar Comando Admin')], [edge('Controle Bot - Pausa global?')]] },
  'Controle Bot - Pausa global?': { main: [[], [edge('Controle Bot - Buscar Controle')]] },
  'Controle Bot - Buscar Controle': { main: [[edge('Controle Bot - Aplicar Controle')]] },
  'Controle Bot - Aplicar Controle': { main: [[edge('Controle Bot - Reset pendente?')]] },
  'Controle Bot - Reset pendente?': { main: [[edge('Controle Bot - Consumir Reset')], [edge('Controle Bot - Bloqueado?')]] },
  'Controle Bot - Bloqueado?': { main: [[], [edge('Contato - Preparar')]] },
};

assert.throws(() => validateConnections(connections), /Registrar Entrada/);
const patched = patchConnections(connections);
assert.deepEqual(validateConnections(patched), {
  adminBeforeGlobalPause: true,
  adminBeforeClientBlock: true,
  blockedCustomerStops: true,
});
assert.deepEqual(patchConnections(patched), patched, 'patch must be idempotent');
assert.equal(connections['Controle Bot - Registrar Entrada'].main[0][0].node, 'Controle Bot - Buscar Controle', 'input must not mutate');
console.log('n8n admin command routing regression passed');
