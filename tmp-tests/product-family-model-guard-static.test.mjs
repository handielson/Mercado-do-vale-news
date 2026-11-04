import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const form = readFileSync('components/products/ProductForm.tsx', 'utf8');
for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const server = readFileSync(file, 'utf8');
  assert.match(server, /product-family-model-guard-v1/, `${file}: guarda no /products/batch`);
  assert.match(server, /!matchedExisting && !p\.bling_id && p\.model_id && !p\.parent_id && !optionalBool\(p\.is_parent\)/, `${file}: so cadastro manual novo, solto, com modelo`);
  assert.match(server, /SELECT id FROM products WHERE id=\? LIMIT 1/, `${file}: edicao de produto existente nao e bloqueada`);
  assert.match(server, /code: 'MODEL_HAS_FAMILY'/, `${file}: erro identificavel`);
}
assert.match(form, /const familyGuardApplies = !initialData\?\.id && !variationDraftMode && !isParentProduct && !guardParentId && Boolean\(guardModelId\)/, 'form: so produto novo e solto');
assert.match(form, /data-model-family-guard/, 'form: mostra a familia existente');
assert.match(form, /\?tab=inventory&addUnit=1/, 'form: leva para "+ peças" na variacao existente');
assert.match(form, /getFamilyChildState\(modelFamily\.parent\)/, 'form: cria a variacao dentro da familia');
assert.match(form, /blocksSubmitForDuplicateEAN \|\| Boolean\(modelFamily\)/, 'form: salvar bloqueado enquanto houver familia');
assert.match(form, /if \(modelFamily\) \{ toast\.error/, 'form: submit tambem bloqueado no handler');
const familyPage = readFileSync('pages/admin/products/ModelProductAggregatorPage.tsx', 'utf8');
assert.match(familyPage, />Página do Produto</, 'painel do modelo virou a Página do Produto (antiga pagina da familia)');
assert.doesNotMatch(familyPage, /Página da família/, 'nome antigo Página da família não volta');
assert.match(familyPage, /Nova variação \(cor\/memória\)/, 'pagina da familia cria variacao dentro dela');
assert.match(familyPage, /Editar dados da família/, 'pagina da familia edita o pai');
assert.match(familyPage, /Incluir peças em \$\{memoryGroup\.label\} \$\{colorGroup\.color\}/, 'cada cor tem Incluir peças');
assert.doesNotMatch(familyPage, />\s*Adicionar igual\s*</, '"Adicionar igual" saiu da Página do Produto (criava cadastro duplicado)');
assert.match(familyPage, /String\(product\.status \|\| ''\) !== 'inactive'/, 'cadastro solto inativo fica fora da pagina da familia');
assert.match(form, /Abrir a página do produto/, 'aviso do cadastro leva a Página do Produto');
console.log('product family model guard static checks passed');
