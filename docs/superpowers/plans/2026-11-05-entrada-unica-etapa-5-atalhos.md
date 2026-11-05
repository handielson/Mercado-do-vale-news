# Entrada única: etapa 5 (atalhos) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** os atalhos "+ peças", "Incluir peças", "Adicionar Unidade" e "Nova variação (cor/memória)" continuam onde estão, mas abrem a tela `/admin/entrada` já preenchida. A entrada por atalho funciona para **qualquer produto** (celular, acessório, 3D, simples), não só para celular com memória e cor completas.

**Fora desta etapa (decisão do usuário em 05/11):** a importação de produto do Bling fica como está e terá plano próprio depois. A sincronização automática com o Bling não muda.

**Architecture:**
- **Servidor:** o item ganha `product_id` (opcional), que é a variação ou o produto simples de destino. Com `product_id`, a porta única usa esse produto direto e ignora modelo, configuração e cor do cliente. Isso evita que uma variação antiga ou duplicada caia em outra linha, ou crie variação nova, pela chave de configuração.
- **Front:**
  - `/admin/entrada?variacao=<id>` carrega o produto, prende a linha nele ("Variação fixa") e escolhe a aba: **Bipar** para celular controlado por unidade e **Manual** para o resto. Se a URL já traz `aba`, ela é respeitada;
  - as linhas criadas com a variação fixa saem com `source:'atalho'` e `product_id`;
  - os botões antigos passam a navegar para a Entrada, e o link antigo `?tab=inventory&addUnit=1` redireciona.

**Tech Stack:** Node 20 CJS, Fastify e mysql2 (servidor); React/TS/Vite (front); `node:test`, com banco falso (`tmp-tests/helpers/catalogEntryFakeDb.cjs`) e testes de navegador (padrão `tmp-tests/entrada-*-browser.test.mjs` + `tmp-tests/entrada-fixtures.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-05-entrada-unica-design.md`, §5 (atalhos) e §6 (etapa 5). **Desvio registrado:** a spec pedia `?aba=bipar&variacao=<id>` para "+ peças". Os atalhos mandam só `?variacao=<id>`, e a página escolhe a aba pelo tipo do produto, porque Bipar só serve para celular com IMEI.

## Global Constraints
- **Item com `product_id`:**
  - o servidor carrega o produto (`FOR UPDATE`, mesma empresa);
  - erros da linha:
    - não existe → "Produto não encontrado.";
    - `is_parent=1` → "Este é o produto pai da família. Escolha a variação (cor/memória).";
    - produto inativo ou excluído → mesma regra que o resto da porta única já usa para produto existente, se houver; senão aceita;
  - a linha **não** cria família nem variação: `family:'existing'`, `variation:'existing'`, `sku` do produto;
  - modo de estoque (unidade × quantidade), conflito de IMEI/serial, local, custo e movimentação: exatamente as regras que a porta única já aplica a uma variação existente. **Reusar o mesmo caminho de código**, só trocando a resolução;
  - preços: `prices: null` → não mexe no preço (`price_source: 'existing'` ou o que a porta já usa para variação existente sem preço); com `prices` → mesma regra da variação existente (inclui `inheritSmartphonePrices` para celular);
  - validação de entrada: com `product_id`, `model_id`, `category_id`, `name`, `configuration` e `color` do cliente são ignorados e não são exigidos; `quantity`, `location_id`, `cost_cents` e `identity` seguem as regras atuais;
  - `product_id` entra nos itens normalizados, logo no hash.
- `source:'atalho'` já existe em `SOURCES`. As linhas da variação fixa usam esse source.
- **"Nova variação (cor/memória)":** se o pai tem `model_id` → `/admin/entrada?aba=manual&modelo=<model_id>`. Sem `model_id` (pai importado do Bling) → continua no fluxo antigo (`/admin/products/new` com `getFamilyChildState`) até a etapa 6. Registrar isso na versão.
- **"Adicionar Unidade"** (Página do Produto, aba Estoque) → `/admin/entrada?variacao=<product.id>`. O `UnitForm` embutido sai da página; o arquivo `components/units/UnitForm.tsx` fica, porque outros lugares e um teste estático ainda usam.
- **Link antigo** `/admin/products/<id>?tab=inventory&addUnit=1` → `navigate('/admin/entrada?variacao=<id>', { replace: true })`. Favoritos e links antigos não quebram.
- A edição continua na Página do Produto. A Entrada é só entrada.
- Textos em português com acento. Node 20 CommonJS no servidor; `vps_server.js` e `vps_server.cjs` só mudam se for preciso, e iguais nos dois.

## Review Focus
1. **Variação existente pelo `product_id` não cria nada novo:** nem família, nem variação, nem SKU. → teste na Task 1.
2. **Produto pai no `product_id`** → erro da linha, nada gravado. → teste na Task 1.
3. **Produto por quantidade** (acessório sem IMEI) com `product_id` e `quantity: 5` → estoque +5 no local e movimentação 'in'. → teste na Task 1.
4. **Celular com `product_id` e IMEI repetido** → erro de conflito, como hoje. → teste na Task 1.
5. **`?variacao=` de acessório** abre Manual com a variação fixa, sem a mensagem "Use a aba Manual". → teste na Task 2.
6. **Link antigo `addUnit=1`** redireciona; nenhum atalho aponta mais para `addUnit=1`. → teste na Task 3.

---

### Task 1: Servidor — linha com `product_id`

**Files:**
- Modify: `services/catalogEntryCore.cjs`. `normalizeEntryItem` aceita `product_id` (string aparada, ou null); `validateEntryBatch` não exige modelo, categoria, nome, configuração nem cor quando há `product_id`.
- Modify: `services/catalogEntryServer.cjs`. Na resolução da linha, com `product_id`: carregar com `FOR UPDATE`, conferir empresa e `is_parent`, e seguir pelo mesmo caminho da variação existente (estoque, identidade, preços, movimentação). A PlanLine sai com `family:'existing'`, `variation:'existing'`, `product_id`, `sku`.
- Modify: `services/catalogEntries.ts`. `EntryItem` ganha `product_id?`, `photo_intake_id?` e `label?` (somente tipos; o label não vai ao servidor).
- Test: `tmp-tests/catalog-entry-product-id.test.cjs`.

- [ ] **Step 1: Write the failing tests:**
  - celular existente (por unidade) + IMEI novo → prévia e confirmação: unidade criada naquele produto, sem produto novo;
  - variação "antiga" cujas specs não batem com a chave de configuração → a unidade cai no `product_id` informado, não em outra variação;
  - pai → erro "Este é o produto pai da família. Escolha a variação (cor/memória).";
  - inexistente → "Produto não encontrado.";
  - acessório por quantidade, `quantity: 5` → estoque +5 no local e movimentação 'in';
  - IMEI repetido → erro de conflito atual;
  - `prices: null` não altera os preços; com `prices` em celular, mesma regra da variação existente;
  - `product_id` faz parte do hash: trocar entre a prévia e a confirmação → 409;
  - item com `product_id` e sem `model_id`/`name` não recebe "Informe o modelo ou a categoria e o nome.".
- [ ] **Step 2: Run** `NODE_PATH=/home/claude/nm/node_modules node --test tmp-tests/catalog-entry-product-id.test.cjs`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `NODE_PATH=/home/claude/nm/node_modules node --test tmp-tests/catalog-entry-*.test.cjs tmp-tests/catalog-entry-units-guard-static.test.mjs`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(entrada): linha por product_id (atalhos)`.

### Task 2: Entrada — variação fixa (`?variacao=`)

**Files:**
- Modify: `pages/admin/entrada/CatalogEntryPage.tsx`:
  - com `variacao` e sem `aba`, carrega o produto (`productService.getById`) e escolhe Bipar (celular controlado por unidade) ou Manual (resto);
  - mostra "Carregando variação…" enquanto carrega;
  - se o produto é pai ou não existe, mostra a mensagem e não prende nada.
- Create: `components/entrada/FixedVariationCard.tsx`. Mostra nome, SKU e foto (se houver) da variação fixa, com o botão "Trocar", que tira `variacao` da URL e solta a trava.
- Modify: `components/entrada/ManualEntryTab.tsx`:
  - com a variação fixa, esconde modelo, configuração e cor e mostra o card;
  - os campos ficam: quantidade (ou IMEI/serial quando o produto é por unidade), custo, local, observação, saúde da bateria (celular) e preços opcionais;
  - a linha sai `{source:'atalho', product_id, …}` com rótulo `nome · SKU`;
  - o `prefill.model_id` passa a ser aplicado também quando o parâmetro muda com a aba montada (`key` ou efeito).
- Modify: `components/entrada/ScanEntryTab.tsx`:
  - com a variação fixa, não exige mais memória, cor e modelo completos para prender;
  - prende pelo `product_id`, e as linhas saem `{source:'atalho', product_id, identity, cost_cents, location_id, prices|null}`;
  - continua só para celular: produto não celular mostra "Use a aba Manual", mas a página já manda esses produtos para a Manual.
- Modify: `components/entrada/entryList.js`. O rótulo de linha com `product_id` usa o `label` da linha (como a foto).
- Test: `tmp-tests/entrada-shortcut-browser.test.mjs`, mais os ajustes nos testes `entrada-*` existentes que dependem das mensagens antigas do lock (`entrada-scan-browser.test.mjs`, casos p1 a p5).

- [ ] **Step 1: Write the failing browser tests** (fixtures: celular completo, celular antigo sem memória/cor, acessório por quantidade, produto pai e id inexistente):
  - `?variacao=<celular>` → aba Bipar, card com o nome; bipar um IMEI → linha `{source:'atalho', product_id}`;
  - `?variacao=<celular antigo sem specs>` → Bipar prende pelo `product_id`, sem a mensagem "não tem memória/cor";
  - `?variacao=<acessório>` → aba Manual com o card; quantidade 5 → linha `{source:'atalho', product_id, quantity:5}`;
  - `?variacao=<pai>` → mensagem do pai e nada preso;
  - "Trocar" → a URL perde `variacao` e os campos normais voltam;
  - `?aba=manual&variacao=<celular>` → respeita a Manual;
  - `?aba=manual&modelo=<id>` continua preenchendo o modelo (teste existente).
- [ ] **Step 2: Run** `node --test tmp-tests/entrada-shortcut-browser.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `node --test --test-concurrency=2 tmp-tests/entrada-*.test.mjs` e `npm run build`. Expected: PASS / build ok.
- [ ] **Step 5: Commit** `feat(entrada): variacao fixa pelos atalhos`.

### Task 3: Atalhos apontando para a Entrada

**Files:**
- Modify, "+ peças"/"Incluir peças" → `/admin/entrada?variacao=<id>`:
  - `pages/store/PublicProductPage.tsx`: `addUnitsUrl`;
  - `components/products/ProductList.tsx`: o "+" de cada cor;
  - `components/products/ProductForm.tsx`: "+ peças · {variante}" no aviso da família;
  - `pages/admin/products/ModelProductAggregatorPage.tsx`: `addUnitsPath`.
- Modify: `pages/admin/products/ProductDetailPage.tsx`:
  - "Adicionar Unidade" navega para `/admin/entrada?variacao=<product.id>`, e o `UnitForm` embutido (e o `handleUnitSubmit`) sai;
  - `?addUnit=1` redireciona com `replace`;
  - "Adicionar nova variação" → `/admin/entrada?aba=manual&modelo=<model_id>` quando há `model_id`; sem `model_id`, mantém o fluxo antigo.
- Modify, "Nova variação (cor/memória)" (mesma regra do `model_id`):
  - `pages/admin/products/ProductListPage.tsx` (`onAddVariation`);
  - `pages/admin/products/ModelProductAggregatorPage.tsx`;
  - `components/products/ProductForm.tsx` ("Criar nova variação nesta família").
- Create: `services/entryShortcuts.js`. Funções puras `entryAddUnitsPath(productId)` e `entryNewVariationPath(parent)`: devolve o caminho da Entrada, ou `null` quando é para usar o fluxo antigo. Todos os botões usam essas funções, e o teste fica em um lugar só.
- Modify, testes estáticos que conferem as URLs antigas (trocar a expectativa pela nova, sem perder a proteção):
  - `tmp-tests/admin-variant-add-units-static.test.mjs`;
  - `tmp-tests/product-family-model-guard-static.test.mjs`;
  - `tmp-tests/model-product-clone-prefill.test.mjs`;
  - `tmp-tests/product-family-card-render.test.cjs`.
- Test: `tmp-tests/entry-shortcuts.test.mjs`, unitário das funções, mais um estático que procura `addUnit=1` em `pages/` e `components/` e só aceita a leitura do redirecionamento.

- [ ] **Step 1: Write the failing tests:**
  - `entryAddUnitsPath('p1')` → `/admin/entrada?variacao=p1`;
  - `entryNewVariationPath({model_id:'m1'})` → `/admin/entrada?aba=manual&modelo=m1`;
  - sem `model_id` → `null`;
  - estático: nenhum atalho monta `addUnit=1`; ProductDetailPage redireciona `addUnit=1`; os botões usam as funções;
  - navegador (opcional, se o padrão existente permitir sem muito custo): ProductDetailPage com `?addUnit=1` → URL vira `/admin/entrada?variacao=<id>`.
- [ ] **Step 2: Run** `node --test tmp-tests/entry-shortcuts.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run:**
  - `node --test --test-concurrency=2 tmp-tests/entrada-*.test.mjs tmp-tests/entry-shortcuts.test.mjs tmp-tests/admin-variant-add-units-static.test.mjs tmp-tests/product-family-model-guard-static.test.mjs tmp-tests/model-product-clone-prefill.test.mjs tmp-tests/product-condition-used.test.mjs`;
  - `NODE_PATH=/home/claude/nm/node_modules node --test tmp-tests/product-family-card-render.test.cjs tmp-tests/product-family-child-prefill.test.mjs`;
  - `npm run build`.
  
  Expected: PASS.
- [ ] **Step 5: Commit** `feat(entrada): atalhos abrem a Entrada`.

### Task 4: Versão e publicação (controller, `publicar.md`)
- [ ] `v1.2.802-entrada-atalhos`: API (`--catalog-entry-only`; os módulos não mudam de lista) + site.
- [ ] Antes do deploy: o `server.js` e os módulos remotos batem com o commit anterior (`cd56cd1`).
- [ ] Verificar:
  - `/status`;
  - prévia com `product_id` de pai → erro da linha;
  - prévia com `product_id` inexistente → "Produto não encontrado.";
  - `/admin/entrada?variacao=x` → 200.
  
  Registrar, fazer push e limpar.
