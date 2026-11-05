'use strict';

// catalog-brand-chunks-v1 (05/11/2026): lista de celulares "sem IA" volta a sair com até 3 aparelhos
// por mensagem e sem misturar marcas.
// O "Vendas - Contexto Produtos" já monta blocos de até 3 aparelhos de uma marca só
// (phone-5g-filter-brand-chunks-v338). Desde a v1.2.663 (22/10) o nó "Vendas - Catalogo sem IA"
// reagrupava todos esses blocos em no máximo 3 mensagens, juntando marcas e muitos modelos.
// Correção: o nó envia cada bloco como uma mensagem; a pergunta de escolha segue isolada no fim.

const { DIRECT: NODE, DIRECT_CODE, DIRECT_CODE_V1, BRAND_CHUNKS_MARKER: MARK } = require('../tmp-tests/n8n-sales-catalog-timeout-guard.cjs');

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const node = next.nodes.find((item) => item.name === NODE);
  if (!node?.parameters?.jsCode) throw new Error(`Code node ausente: ${NODE}`);
  if (node.parameters.jsCode === DIRECT_CODE) return next;
  if (node.parameters.jsCode !== DIRECT_CODE_V1) throw new Error(`${NODE}: código em produção diferente do esperado (v1)`);
  node.parameters.jsCode = DIRECT_CODE;
  return next;
}

module.exports = { MARK, NODE, patchWorkflow };
