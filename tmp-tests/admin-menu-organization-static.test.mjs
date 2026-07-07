import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('layouts/AdminLayout.tsx', 'utf8');

const groupTitles = [...source.matchAll(/title: '([^']+)'/g)].map((match) => match[1]);

assert.deepEqual(
  groupTitles,
  [
    'Atendimento',
    'Produtos & Estoque',
    'Financeiro',
    'Loja Online & Marketing',
    'Catálogo Técnico',
    'Integrações',
    'Empresa & Sistema',
  ],
  'admin sidebar should be grouped by daily workflows'
);

const groupBlocks = new Map();
for (const match of source.matchAll(/title: '([^']+)',\s+items: \[([\s\S]*?)\]\s+}/g)) {
  groupBlocks.set(match[1], match[2]);
}

function assertGroupContains(groupName, labels) {
  const block = groupBlocks.get(groupName);
  assert.ok(block, `missing menu group ${groupName}`);
  for (const label of labels) {
    assert.match(block, new RegExp(`label: '${label}'`), `${label} should be in ${groupName}`);
  }
}

assertGroupContains('Atendimento', ['Dashboard', 'PDV', 'Vendas', 'Pedidos Online', 'Clientes']);
assertGroupContains('Produtos & Estoque', ['Produtos', 'Estoque', 'Locais de Estoque', 'Etiquetas', 'Lista de Impressao', 'Ofertas']);
assertGroupContains('Financeiro', ['Financeiro', 'Contabilidade']);
assertGroupContains('Loja Online & Marketing', ['Promoções', 'Cupons', 'Moedas do Vale', 'Banners', 'Criativos', 'Config. Catálogo']);
assertGroupContains('Catálogo Técnico', ['Categorias', 'Marcas', 'Modelos', 'Campos Customizados', 'Tags do Sistema']);
assertGroupContains('Integrações', ['Bling', 'Shopee', 'WhatsApp', 'Mensagens WhatsApp', 'Automações Bot', 'E-mail', 'Gateways Pagamento']);
assert.doesNotMatch(source, /Memoria IA/, 'legacy WhatsApp AI memory menu must be removed for n8n bot');
assert.doesNotMatch(source, /\/admin\/whatsapp\/memoria-ia/, 'legacy WhatsApp AI memory menu route must be removed');
assertGroupContains('Empresa & Sistema', ['Dados da Empresa', 'Equipe', 'Frete', 'Taxas', 'Displays Android', 'Documentos', 'Garantias', 'Permissões', 'Status VPS']);

assert.doesNotMatch(source, /\/test-tabs/, 'development-only test tabs route must not appear in the admin sidebar');
assert.doesNotMatch(source, /Teste de Abas/, 'development-only test tabs label must not appear in the admin sidebar');

console.log('admin menu organization static checks passed');
