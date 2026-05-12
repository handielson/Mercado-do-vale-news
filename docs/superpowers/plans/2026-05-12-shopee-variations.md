# Plano de Implementacao de Variacoes Shopee

> **Para agentes de implementacao:** SUB-SKILL OBRIGATORIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar este plano tarefa por tarefa. Os passos usam sintaxe de checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** Publicar produtos locais relacionados como um unico item da Shopee com variacoes, em vez de criar anuncios separados para cada opcao de cor, modelo, tamanho, RAM ou armazenamento.

**Arquitetura:** Adicionar um motor puro de variacoes que agrupa produtos locais, extrai dimensoes seguras de variacao, valida SKU/preco/estoque/imagens/GTIN e monta o payload Shopee com `tier_variation` e `model_list`. Integrar esse fluxo como uma opcao explicita em `ShopeePage.tsx`, reaproveitando os fluxos atuais de upload, atributos, logistica, marca, debug e salvamento no Supabase para o item pai. Manter o envio em massa assistido em produtos simples ate que grupos de variacoes sejam selecionados explicitamente.

**Stack Tecnica:** React, TypeScript, Vite, proxy Shopee existente, registros existentes de produtos e `shopee_products` no Supabase, testes estaticos de regressao em Node, `tsx` para testes puros em TypeScript.

---

## Estrutura de Arquivos

- Criar `types/shopee-variation.ts`: contratos de grupo local de variacao, dimensao, modelo, resultado de validacao e payload.
- Criar `services/shopeeVariationEngine.ts`: helpers puros para agrupamento, deteccao de dimensoes, validacao de payload e construcao dos modelos Shopee.
- Criar `tmp-tests/shopee-variation-engine.test.mjs`: cobertura comportamental para agrupamento e construcao de payload.
- Criar `tmp-tests/shopee-variation-modal-static.test.mjs`: cobertura estatica para integracao da UI e caminho de publicacao.
- Modificar `pages/admin/settings/ShopeePage.tsx`: adicionar descoberta de grupos de variacao, UI de selecao, painel de validacao e caminho de publicacao com variacoes.
- Modificar `Shopee.md`: marcar a primeira entrega de variacoes como planejada/implementada e documentar regras operacionais.

## Tarefa 1: Tipos e Motor de Variacoes

**Arquivos:**
- Criar: `types/shopee-variation.ts`
- Criar: `services/shopeeVariationEngine.ts`
- Testar: `tmp-tests/shopee-variation-engine.test.mjs`

- [ ] **Passo 1: Escrever o teste do motor falhando**

Crie `tmp-tests/shopee-variation-engine.test.mjs`:

```js
import assert from 'node:assert/strict';
import {
  buildShopeeVariationModels,
  detectShopeeVariationDimensions,
  groupShopeeVariationCandidates,
  validateShopeeVariationGroup,
} from '../services/shopeeVariationEngine.ts';

const products = [
  {
    id: 'parent',
    name: 'Capa Redmi Note 13',
    sku: 'CAPA-RN13',
    parent_id: null,
    is_parent: true,
    price_retail: 1990,
    stock_quantity: 0,
    images: ['https://cdn.test/parent.jpg'],
    specs: {},
  },
  {
    id: 'red',
    name: 'Capa Redmi Note 13 Cor:Vermelho',
    sku: 'CAPA-RN13-RED',
    parent_id: 'parent',
    price_retail: 1990,
    stock_quantity: 4,
    images: ['https://cdn.test/red.jpg'],
    eans: ['7890000000011'],
    specs: { color: 'Vermelho' },
  },
  {
    id: 'blue',
    name: 'Capa Redmi Note 13 Cor:Azul',
    sku: 'CAPA-RN13-BLUE',
    parent_id: 'parent',
    price_retail: 2090,
    stock_quantity: 2,
    images: ['https://cdn.test/blue.jpg'],
    eans: ['7890000000012'],
    specs: { color: 'Azul' },
  },
];

const groups = groupShopeeVariationCandidates(products);
assert.equal(groups.length, 1);
assert.equal(groups[0].parent.id, 'parent');
assert.deepEqual(groups[0].children.map((child) => child.sku), ['CAPA-RN13-RED', 'CAPA-RN13-BLUE']);

const dimensions = detectShopeeVariationDimensions(groups[0]);
assert.deepEqual(dimensions, [{ name: 'Cor', key: 'color', options: ['Vermelho', 'Azul'] }]);

const validation = validateShopeeVariationGroup(groups[0], dimensions);
assert.equal(validation.ok, true);
assert.deepEqual(validation.blockers, []);

const payloadParts = buildShopeeVariationModels(groups[0], dimensions, {
  imageIdsByProductId: { red: 'sg-red', blue: 'sg-blue' },
  stockByProductId: { red: 4, blue: 2 },
});

assert.deepEqual(payloadParts.tier_variation, [
  {
    name: 'Cor',
    option_list: [
      { option: 'Vermelho', image: { image_id: 'sg-red' } },
      { option: 'Azul', image: { image_id: 'sg-blue' } },
    ],
  },
]);

assert.deepEqual(payloadParts.model_list, [
  {
    tier_index: [0],
    model_sku: 'CAPA-RN13-RED',
    original_price: 19.9,
    seller_stock: [{ stock: 4 }],
    gtin_code: '7890000000011',
    tax_info: { gtin: '7890000000011' },
  },
  {
    tier_index: [1],
    model_sku: 'CAPA-RN13-BLUE',
    original_price: 20.9,
    seller_stock: [{ stock: 2 }],
    gtin_code: '7890000000012',
    tax_info: { gtin: '7890000000012' },
  },
]);

console.log('shopee variation engine tests passed');
```

- [ ] **Passo 2: Rodar o teste e verificar que ele falha**

Rode: `npx.cmd tsx tmp-tests\shopee-variation-engine.test.mjs`

Esperado: FALHA porque `services/shopeeVariationEngine.ts` ainda nao existe.

- [ ] **Passo 3: Adicionar os tipos**

Crie `types/shopee-variation.ts`:

```ts
export type ShopeeVariationDimensionKey = 'color' | 'model' | 'size' | 'ram' | 'storage';

export interface ShopeeVariationProduct {
  id: string;
  name: string;
  sku?: string | null;
  parent_id?: string | null;
  is_parent?: boolean | number | null;
  price_retail?: number | null;
  stock_quantity?: number | null;
  track_inventory?: boolean | null;
  images?: any[];
  eans?: string[] | null;
  specs?: Record<string, any> | null;
}

export interface ShopeeVariationGroup {
  id: string;
  parent: ShopeeVariationProduct;
  children: ShopeeVariationProduct[];
}

export interface ShopeeVariationDimension {
  name: string;
  key: ShopeeVariationDimensionKey;
  options: string[];
}

export interface ShopeeVariationValidationIssue {
  productId?: string;
  field: string;
  message: string;
}

export interface ShopeeVariationValidationResult {
  ok: boolean;
  blockers: ShopeeVariationValidationIssue[];
  warnings: ShopeeVariationValidationIssue[];
}

export interface ShopeeVariationBuildContext {
  imageIdsByProductId: Record<string, string>;
  stockByProductId?: Record<string, number>;
}

export interface ShopeeVariationPayloadParts {
  tier_variation: Array<{
    name: string;
    option_list: Array<{ option: string; image?: { image_id: string } }>;
  }>;
  model_list: Array<Record<string, any>>;
}
```

- [ ] **Passo 4: Implementar o motor**

Crie `services/shopeeVariationEngine.ts` com:

```ts
import type {
  ShopeeVariationBuildContext,
  ShopeeVariationDimension,
  ShopeeVariationDimensionKey,
  ShopeeVariationGroup,
  ShopeeVariationPayloadParts,
  ShopeeVariationProduct,
  ShopeeVariationValidationIssue,
  ShopeeVariationValidationResult,
} from '../types/shopee-variation';

const DIMENSION_LABELS: Record<ShopeeVariationDimensionKey, string> = {
  color: 'Cor',
  model: 'Modelo',
  size: 'Tamanho',
  ram: 'RAM',
  storage: 'Armazenamento',
};

const DIMENSION_KEYS: ShopeeVariationDimensionKey[] = ['color', 'model', 'size', 'ram', 'storage'];

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function centsToReais(value: unknown): number {
  const cents = Number(value ?? 0);
  return Number.isFinite(cents) && cents > 0 ? Number((cents / 100).toFixed(2)) : 0;
}

function readSpec(product: ShopeeVariationProduct, key: ShopeeVariationDimensionKey): string {
  const specs = product.specs || {};
  if (key === 'color') return text(specs.color || specs.cor);
  if (key === 'storage') return text(specs.storage || specs.armazenamento);
  return text(specs[key]);
}

function firstEan(product: ShopeeVariationProduct): string {
  const eans = Array.isArray(product.eans) ? product.eans : [];
  return text(eans.find((ean) => text(ean)));
}

export function groupShopeeVariationCandidates(products: ShopeeVariationProduct[]): ShopeeVariationGroup[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  const childrenByParent = new Map<string, ShopeeVariationProduct[]>();

  for (const product of products) {
    const parentId = text(product.parent_id);
    if (!parentId) continue;
    const current = childrenByParent.get(parentId) || [];
    current.push(product);
    childrenByParent.set(parentId, current);
  }

  return Array.from(childrenByParent.entries())
    .map(([parentId, children]) => {
      const parent = byId.get(parentId);
      if (!parent || children.length < 2) return null;
      return {
        id: parentId,
        parent,
        children: children.slice().sort((a, b) => text(a.sku).localeCompare(text(b.sku))),
      };
    })
    .filter((group): group is ShopeeVariationGroup => Boolean(group));
}

export function detectShopeeVariationDimensions(group: ShopeeVariationGroup): ShopeeVariationDimension[] {
  return DIMENSION_KEYS
    .map((key) => {
      const values = Array.from(new Set(group.children.map((child) => readSpec(child, key)).filter(Boolean)));
      return { name: DIMENSION_LABELS[key], key, options: values };
    })
    .filter((dimension) => dimension.options.length > 1)
    .slice(0, 2);
}

export function validateShopeeVariationGroup(
  group: ShopeeVariationGroup,
  dimensions: ShopeeVariationDimension[],
): ShopeeVariationValidationResult {
  const blockers: ShopeeVariationValidationIssue[] = [];
  const warnings: ShopeeVariationValidationIssue[] = [];

  if (dimensions.length === 0) {
    blockers.push({ field: 'variation_dimensions', message: 'Nenhuma dimensao de variacao foi detectada.' });
  }

  for (const child of group.children) {
    if (!text(child.sku)) blockers.push({ productId: child.id, field: 'sku', message: 'Variacao sem SKU.' });
    if (centsToReais(child.price_retail) <= 0) blockers.push({ productId: child.id, field: 'price_retail', message: 'Variacao sem preco valido.' });
    if (!Array.isArray(child.images) || child.images.length === 0) warnings.push({ productId: child.id, field: 'images', message: 'Variacao sem imagem propria; sera usada imagem do anuncio.' });

    for (const dimension of dimensions) {
      if (!readSpec(child, dimension.key)) {
        blockers.push({ productId: child.id, field: dimension.key, message: `Variacao sem valor para ${dimension.name}.` });
      }
    }
  }

  return { ok: blockers.length === 0, blockers, warnings };
}

export function buildShopeeVariationModels(
  group: ShopeeVariationGroup,
  dimensions: ShopeeVariationDimension[],
  context: ShopeeVariationBuildContext,
): ShopeeVariationPayloadParts {
  const tier_variation = dimensions.map((dimension) => ({
    name: dimension.name,
    option_list: dimension.options.map((option) => {
      const child = group.children.find((product) => readSpec(product, dimension.key) === option);
      const imageId = child ? context.imageIdsByProductId[child.id] : '';
      return {
        option,
        ...(dimension.key === 'color' && imageId ? { image: { image_id: imageId } } : {}),
      };
    }),
  }));

  const model_list = group.children.map((child) => {
    const tierIndex = dimensions.map((dimension) => Math.max(0, dimension.options.indexOf(readSpec(child, dimension.key))));
    const gtin = firstEan(child);
    return {
      tier_index: tierIndex,
      model_sku: text(child.sku),
      original_price: centsToReais(child.price_retail),
      seller_stock: [{ stock: Math.max(0, Math.trunc(Number(context.stockByProductId?.[child.id] ?? child.stock_quantity ?? 0) || 0)) }],
      ...(gtin ? { gtin_code: gtin, tax_info: { gtin } } : {}),
    };
  });

  return { tier_variation, model_list };
}
```

- [ ] **Passo 5: Rodar o teste e verificar que ele passa**

Rode: `npx.cmd tsx tmp-tests\shopee-variation-engine.test.mjs`

Esperado: PASS com `shopee variation engine tests passed`.

## Tarefa 2: Cobertura Estatica do Modal

**Arquivos:**
- Criar: `tmp-tests/shopee-variation-modal-static.test.mjs`

- [ ] **Passo 1: Escrever o teste estatico falhando**

Crie `tmp-tests/shopee-variation-modal-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');
const docs = readFileSync('Shopee.md', 'utf8');

assert.match(page, /shopeeVariationEngine/, 'Shopee page should import the variation engine');
assert.match(page, /variationGroups/, 'Shopee page should discover selectable variation groups');
assert.match(page, /selectedVariationGroupId/, 'Shopee modal should track the selected variation group');
assert.match(page, /buildShopeeVariationModels/, 'publish flow should build tier_variation and model_list');
assert.match(page, /tier_variation/, 'add_item payload should include Shopee tier variations');
assert.match(page, /model_list/, 'add_item payload should include Shopee model list');
assert.match(page, /Publicar como anuncio com variacoes/, 'operator should explicitly opt in to variation publish');
assert.match(docs, /Primeira entrega: variacoes manuais/, 'Shopee docs should document the first manual variation delivery');

console.log('shopee variation modal static checks passed');
```

- [ ] **Passo 2: Rodar o teste e verificar que ele falha**

Rode: `node tmp-tests\shopee-variation-modal-static.test.mjs`

Esperado: FALHA porque o modal ainda nao importa nem renderiza os controles de variacao.

## Tarefa 3: Descoberta de Grupos e UI no Modal

**Arquivos:**
- Modificar: `pages/admin/settings/ShopeePage.tsx`

- [ ] **Passo 1: Importar helpers de variacao**

Adicione os imports perto dos imports de template Shopee:

```ts
import {
    buildShopeeVariationModels,
    detectShopeeVariationDimensions,
    groupShopeeVariationCandidates,
    validateShopeeVariationGroup,
} from '../../../services/shopeeVariationEngine';
import type { ShopeeVariationGroup } from '../../../types/shopee-variation';
```

- [ ] **Passo 2: Adicionar grupos de variacao no nivel da pagina**

Depois do state `bulkRunItems` em `ShopeePage`, adicione:

```ts
const variationGroups = useMemo(
    () => groupShopeeVariationCandidates(products.map((product) => toLocalProduct(product))),
    [products]
);
```

- [ ] **Passo 3: Passar os grupos para o modal**

Adicione `variationGroups={variationGroups}` nos dois usos de `ShopeeSyncModal`: o modal de produto individual e o modal do envio em massa.

- [ ] **Passo 4: Estender props e state do modal**

Atualize as props de `ShopeeSyncModal`:

```ts
variationGroups?: ShopeeVariationGroup[];
```

Dentro do modal, adicione:

```ts
const [publishWithVariations, setPublishWithVariations] = useState(false);
const [selectedVariationGroupId, setSelectedVariationGroupId] = useState('');
const selectedVariationGroup = useMemo(
    () => (variationGroups || []).find((group) => group.id === selectedVariationGroupId) || null,
    [selectedVariationGroupId, variationGroups]
);
const variationDimensions = useMemo(
    () => selectedVariationGroup ? detectShopeeVariationDimensions(selectedVariationGroup) : [],
    [selectedVariationGroup]
);
const variationValidation = useMemo(
    () => selectedVariationGroup ? validateShopeeVariationGroup(selectedVariationGroup, variationDimensions) : null,
    [selectedVariationGroup, variationDimensions]
);
```

- [ ] **Passo 5: Selecionar automaticamente o grupo do produto quando existir**

Adicione um effect depois dos effects de inicializacao do modal:

```ts
useEffect(() => {
    const groups = variationGroups || [];
    const matching = groups.find((group) =>
        group.parent.id === product.id ||
        group.children.some((child) => child.id === product.id)
    );
    if (!matching) return;
    setSelectedVariationGroupId(matching.id);
}, [product.id, variationGroups]);
```

- [ ] **Passo 6: Renderizar o painel de ativacao explicita**

Acima do painel de template existente, renderize:

```tsx
{(variationGroups || []).length > 0 && (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
                <p className="text-sm font-bold text-slate-800">Variações Shopee</p>
                <p className="text-xs text-slate-500">Use quando vários produtos locais devem virar um único anúncio com opções.</p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                    type="checkbox"
                    checked={publishWithVariations}
                    onChange={(event) => setPublishWithVariations(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                Publicar como anuncio com variacoes
            </label>
        </div>
        {publishWithVariations && (
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <select
                    value={selectedVariationGroupId}
                    onChange={(event) => setSelectedVariationGroupId(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                    <option value="">Selecione um grupo de variacoes...</option>
                    {(variationGroups || []).map((group) => (
                        <option key={group.id} value={group.id}>
                            {group.parent.name} ({group.children.length} variacoes)
                        </option>
                    ))}
                </select>
                <span className={`rounded-lg px-3 py-2 text-xs font-bold ${variationValidation?.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {variationValidation?.ok ? 'Pronto para variacoes' : 'Revisao necessaria'}
                </span>
            </div>
        )}
        {publishWithVariations && variationValidation && (variationValidation.blockers.length > 0 || variationValidation.warnings.length > 0) && (
            <div className="space-y-1 text-xs">
                {variationValidation.blockers.map((issue, index) => (
                    <p key={`blocker-${index}`} className="text-red-700">{issue.message}</p>
                ))}
                {variationValidation.warnings.map((issue, index) => (
                    <p key={`warning-${index}`} className="text-amber-700">{issue.message}</p>
                ))}
            </div>
        )}
    </div>
)}
```

- [ ] **Passo 7: Rodar o teste estatico**

Rode: `node tmp-tests\shopee-variation-modal-static.test.mjs`

Esperado: ainda FALHA ate que o payload de publicacao seja integrado.

## Tarefa 4: Payload de Publicacao com Variacoes

**Arquivos:**
- Modificar: `pages/admin/settings/ShopeePage.tsx`

- [ ] **Passo 1: Bloquear publicacao com variacao invalida**

No inicio de `handleSync`, depois do bloqueio de seguranca do titulo, adicione:

```ts
if (publishWithVariations) {
    if (!selectedVariationGroup || !variationValidation?.ok) {
        toast.error('Revise o grupo de variacoes antes de publicar.');
        return;
    }
}
```

- [ ] **Passo 2: Enviar imagens dos filhos e coletar IDs**

Dentro de `handleSync`, depois do bloco existente de upload de `imageIdList` principal, adicione:

```ts
const variationImageIdsByProductId: Record<string, string> = {};

if (publishWithVariations && selectedVariationGroup) {
    for (const child of selectedVariationGroup.children) {
        const firstImage = Array.isArray(child.images) ? child.images[0] : '';
        if (!firstImage) continue;
        if (typeof firstImage === 'string' && firstImage.startsWith('sg-')) {
            variationImageIdsByProductId[child.id] = firstImage;
            continue;
        }
        const resolvedImageDataUrl = typeof firstImage === 'string'
            ? await readRemoteUrlAsDataUrl(firstImage)
            : '';
        if (!resolvedImageDataUrl) continue;
        const uploadData = await postShopeeDebug('upload_image', {
            image_data_url: resolvedImageDataUrl,
            file_name: `${child.sku || child.id}.jpg`,
        }, `upload_image:variation:${child.sku || child.id}`);
        const uploadedId = uploadData?.response?.image_info?.image_id || uploadData?.response?.image_id;
        if (uploadedId) variationImageIdsByProductId[child.id] = String(uploadedId);
    }
}
```

- [ ] **Passo 3: Mesclar o payload de variacao no `add_item`**

Antes de `const data = await publishShopeeItemWithStockFallback(...)`, adicione:

```ts
const variationPayloadParts = publishWithVariations && selectedVariationGroup
    ? buildShopeeVariationModels(selectedVariationGroup, variationDimensions, {
        imageIdsByProductId: variationImageIdsByProductId,
    })
    : null;

const finalPayload = variationPayloadParts
    ? {
        ...basePayload,
        item_sku: undefined,
        seller_stock: undefined,
        tier_variation: variationPayloadParts.tier_variation,
        model_list: variationPayloadParts.model_list,
    }
    : basePayload;
```

Depois substitua:

```ts
const data = await publishShopeeItemWithStockFallback(basePayload, parsedStock);
```

por:

```ts
const data = variationPayloadParts
    ? await postShopeeDebug('add_item', finalPayload, 'add_item:variation')
    : await publishShopeeItemWithStockFallback(finalPayload, parsedStock);
```

- [ ] **Passo 4: Salvar vinculos dos filhos depois da publicacao**

Depois de salvar a linha pai em `shopee_products`, adicione:

```ts
if (shopeeItemId && publishWithVariations && selectedVariationGroup) {
    for (const child of selectedVariationGroup.children) {
        await supabase.from('shopee_products').upsert({
            product_id: child.id,
            shopee_item_id: shopeeItemId,
            status: 'synced',
            synced_at: new Date().toISOString(),
        }, { onConflict: 'product_id' });
    }
}
```

- [ ] **Passo 5: Rodar o teste estatico**

Rode: `node tmp-tests\shopee-variation-modal-static.test.mjs`

Esperado: PASS.

## Tarefa 5: Documentacao e Regressao

**Arquivos:**
- Modificar: `Shopee.md`
- Testar: testes Shopee existentes

- [ ] **Passo 1: Atualizar a documentacao Shopee**

Em `## Variacoes no mesmo anuncio Shopee`, adicione:

```md
### Primeira entrega: variacoes manuais

A primeira versao sera manual e assistida.

- o operador escolhe explicitamente publicar como anuncio com variacoes;
- o sistema sugere grupos baseados em `parent_id`;
- cada filho vira um item de `model_list`;
- a primeira dimensao suportada e `Cor`, com suporte tambem a `Modelo`, `Tamanho`, `RAM` e `Armazenamento`;
- cada variacao precisa ter SKU, preco e estoque validos;
- imagem propria por cor e recomendada, mas a imagem principal do anuncio continua obrigatoria;
- o vinculo `shopee_products` sera salvo para o pai e para cada filho usando o mesmo `item_id`;
- envio em massa continua publicando somente produtos simples ate existir pre-validacao de variacoes.
```

- [ ] **Passo 2: Rodar testes focados**

Rode:

```powershell
npx.cmd tsx tmp-tests\shopee-variation-engine.test.mjs
node tmp-tests\shopee-variation-modal-static.test.mjs
node tmp-tests\shopee-bulk-export-static.test.mjs
node tmp-tests\shopee-bulk-progress-static.test.mjs
node tmp-tests\shopee-sync-modal-template-static.test.mjs
node tmp-tests\shopee-add-item-dimension-logistic-static.test.mjs
node pages\admin\settings\shopeeFieldTemplates.test.mjs
node pages\admin\settings\shopeeStockPayloads.test.mjs
node pages\admin\settings\shopeeSyncDefaults.test.mjs
```

Esperado: todos passam.

- [ ] **Passo 3: Rodar build**

Rode: `npm.cmd run build`

Esperado: build do Vite passa. Se o sandbox bloquear `vite.config.ts`, rode novamente o mesmo comando com aprovacao fora do sandbox.

- [ ] **Passo 4: Commit**

Stage somente:

```powershell
git add -- types\shopee-variation.ts services\shopeeVariationEngine.ts tmp-tests\shopee-variation-engine.test.mjs tmp-tests\shopee-variation-modal-static.test.mjs pages\admin\settings\ShopeePage.tsx Shopee.md docs\superpowers\plans\2026-05-12-shopee-variations.md
```

Commit:

```powershell
git commit -m "feat(shopee): add manual variation publishing"
```
