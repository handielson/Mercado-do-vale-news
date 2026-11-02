import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Menu lateral do admin organizado por rotina (parte 3, 02/11/2026): ferramentas técnicas em grupo próprio,
// ícones distintos e nomes corrigidos.
const source = readFileSync('layouts/AdminLayout.tsx', 'utf8');
const menu = source.slice(source.indexOf('const menuGroups = useMemo'), source.indexOf('], []);', source.indexOf('const menuGroups = useMemo')));
const groupTitles = [...menu.matchAll(/^\s+title: '([^']+)',/gm)].map((match) => match[1]);

assert.deepEqual(groupTitles, [
  'Vendas & Atendimento', '3DMV', 'Produtos & Estoque', 'Financeiro', 'Loja Online & Marketing',
  'Catálogo Técnico', 'Integrações', 'Empresa', 'Sistema (técnico)',
], 'admin sidebar should be grouped by daily workflows');

const groupBlocks = new Map();
for (const match of menu.matchAll(/title: '([^']+)',\s+items: \[([\s\S]*?)\]\s+}/g)) groupBlocks.set(match[1], match[2]);
function assertGroupContains(groupName, labels) {
  const block = groupBlocks.get(groupName);
  assert.ok(block, `missing menu group ${groupName}`);
  for (const label of labels) assert.match(block, new RegExp(`label: '${label.replace(/[()]/g, '\\$&')}'`), `${label} should be in ${groupName}`);
}

assertGroupContains('Vendas & Atendimento', ['Dashboard', 'PDV', 'Vendas', 'Pedidos Online', 'Clientes']);
assertGroupContains('Produtos & Estoque', ['Produtos', 'Rascunhos de anúncios', 'Estoque', 'Locais de Estoque', 'Etiquetas', 'Lista de Impressão', 'Ofertas']);
assertGroupContains('Financeiro', ['Visão financeira', 'Caixa', 'Auditoria de Caixa', 'Pix Avulso', 'Contabilidade']);
assertGroupContains('Loja Online & Marketing', ['Promoções', 'Cupons', 'Moedas do Vale', 'Banners', 'Gerador de Artes', 'Config. Catálogo']);
assertGroupContains('Catálogo Técnico', ['Categorias', 'Marcas', 'Modelos', 'Campos Customizados', 'Tags do Sistema', 'Saúde da Bateria']);
assertGroupContains('Integrações', ['Bling', 'Shopee', 'TikTok Shop', 'Mercado Livre', 'WhatsApp', 'Novo Bot', 'Mensagens WhatsApp', 'Bot do Telegram', 'E-mail', 'Gateways Pagamento']);
assertGroupContains('Empresa', ['Dados da Empresa', 'Equipe', 'Frete', 'Taxas', 'Displays Android', 'Documentos', 'Garantias', 'Permissões']);
assertGroupContains('Sistema (técnico)', ['Status do sistema', 'Backup Sistema', 'MySQL Explorer', 'CDN Synology', 'Config Synology']);

// Busca continua achando pelos nomes antigos.
assert.match(menu, /label: 'Visão financeira', keywords: 'financeiro /);
assert.match(menu, /label: 'Bot do Telegram', keywords: 'automacoes bot /);
assert.match(menu, /label: 'Lista de Impressão', keywords: 'lista de impressao /);

// Itens irmãos não repetem o ícone.
for (const [group, block] of groupBlocks) {
  const icons = [...block.matchAll(/icon: <(\w+)/g)].map((match) => match[1]);
  const repeated = icons.filter((icon, index) => icons.indexOf(icon) !== index);
  if (group !== '3DMV') assert.deepEqual(repeated, [], `${group}: ícones repetidos ${repeated.join(', ')}`);
}

assert.doesNotMatch(source, /Memoria IA/, 'legacy WhatsApp AI memory menu must be removed for n8n bot');
assert.doesNotMatch(source, /\/admin\/whatsapp\/memoria-ia/, 'legacy WhatsApp AI memory menu route must be removed');
assert.doesNotMatch(source, /\/test-tabs/, 'development-only test tabs route must not appear in the admin sidebar');
assert.doesNotMatch(source, /Teste de Abas/, 'development-only test tabs label must not appear in the admin sidebar');
console.log('admin menu organization static checks passed');
