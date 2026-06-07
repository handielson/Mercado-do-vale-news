import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tool = readFileSync('tools/set-autoresponder-engine-v2-vps.cjs', 'utf8');
const runbook = readFileSync('docs/autoresponder/engine-v2-rollout-runbook.md', 'utf8');
const audit = readFileSync('docs/autoresponder/engine-v2-rollout-audit.md', 'utf8');
const inventory = readFileSync('docs/autoresponder/cleanup-inventory.md', 'utf8');
const scenarios = readFileSync('docs/autoresponder/test-scenarios.md', 'utf8');

for (const needle of [
  "process.env.AUTORESPONDER_ENGINE_V2_APPLY === '1'",
  "process.env.AUTORESPONDER_ENGINE_V2_VALUE === '0' ? '0' : '1'",
  'Dry run only',
  'pm2 restart',
  '--update-env',
  'AUTORESPONDER_ENGINE_V2',
  '.autoresponder-engine-v2-',
]) {
  assert.ok(tool.includes(needle), `rollout tool must include ${needle}`);
}

for (const needle of [
  'Pre-check Local',
  'Dry-run Da Flag Na VPS',
  'Ativacao Controlada',
  'Validacao Pos-ativacao',
  'Rodada Real Controlada',
  'Rollback',
  'Criterio Para Remover Legado',
  'node tmp-tests\\autoresponder-core-scenarios.cjs',
  'curl.exe -i -s "https://api.xiaomipetrolina.com.br/health"',
  'AUTORESPONDER_ENGINE_V2_VALUE="0"',
  'remetente controlado',
  'App PM2 alvo',
  'Commit/deploy ativo',
  'Os cenarios automaticos em `/autoresponder/test-flow` nao substituem esta rodada real',
  'redmi note 15',
  'comprar',
  'O carrinho mantem item e quantidade',
  'Critérios de falha critica',
  'Produto escolhido muda depois de `comprar`',
  'Handoff nao pausa a conversa',
  'Evidencia minima para liberar remocao do legado',
  'transcricao completa com timestamps',
  'rollback imediatamente',
  'Dry-run final mostrou `AUTORESPONDER_ENGINE_V2: 0`',
  'Pos-rollback operacional',
]) {
  assert.ok(runbook.includes(needle), `rollout runbook must include ${needle}`);
}

for (const needle of [
  'Rodada Real Antes De Remover Legado',
  'AUTORESPONDER_ENGINE_V2',
  'purchase_flow.status',
  'A entrega dentro da compra nao cai na entrega avulsa',
  'Evidencia da conversa fica registrada no runbook de rollout antes da limpeza final',
]) {
  assert.ok(scenarios.includes(needle), `test scenarios doc must include ${needle}`);
}

assert.ok(
  audit.includes('So entao remover os `return null` condicionados pela flag em produto e compra'),
  'audit must keep legacy removal gated after rollout validation',
);

assert.ok(
  inventory.includes('Remover as flags e os caminhos legados de produto/compra somente depois dessas validacoes'),
  'inventory must keep legacy removal gated after rollout validation',
);

console.log('autoresponder engine v2 rollout runbook static checks passed');
