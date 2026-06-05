import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const doc = readFileSync('docs/autoresponder/cleanup-inventory.md', 'utf8');

[
  'Candidatos A Remover',
  'Removidos',
  'Candidatos A Manter',
  'Observacoes De Deploy',
  'AUTORESPONDER_ENGINE_V2',
  'Candidatos A Arquivar',
  'Documentos Revisados',
  'Referencias Encontradas',
  'Criterios Para Remover',
  'Pendencias Para Fechamento',
  'tmp-tests/autoresponder-core-scenarios.cjs',
  'tmp-tests/autoresponder-no-purchase-flow-outside-purchase-static.test.mjs',
  'tmp-tests/autoresponder-bot-doc-helper-static.test.mjs',
  'tmp-tests/autoresponder-choice-instructions-static.test.mjs',
  'tmp-tests/autoresponder-delivery-cep-replace-static.test.mjs',
  'tmp-tests/autoresponder-delivery-cep-shipping-static.test.mjs',
  'tmp-tests/autoresponder-product-search-engine-static.test.mjs',
  'docs/autoresponder/engine-v2-rollout-audit.md',
  'docs/autoresponder/engine-v2-rollout-runbook.md',
  'tmp-tests/autoresponder-engine-v2-rollout-static.test.mjs',
  'tmp-tests/autoresponder-engine-v2-rollout-runbook-static.test.mjs',
  'docs/autoresponder/archive/Bot_Whatsapp.md | arquivado',
  'tools/check-autoresponder-synology-readiness.cjs',
  'vps_server.cjs',
  'deploy-vps-server-only.cjs',
].forEach((needle) => {
  assert.ok(doc.includes(needle), `cleanup inventory must include ${needle}`);
});

console.log('autoresponder cleanup inventory static checks passed');
