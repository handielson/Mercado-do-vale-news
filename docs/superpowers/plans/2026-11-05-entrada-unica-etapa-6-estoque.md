# Entrada única: etapa 6 (estoque só pela Entrada) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** entrada de estoque e de aparelho (unidade, IMEI, serial, quantidade) passa a ser feita **só** pela tela `/admin/entrada`. O formulário "Novo produto" continua para o cadastro de **catálogo** (fotos, descrição, EAN, fiscal, 3D, família, rascunhos, Bling), mas não cria mais unidade nem estoque. Depois de criar, ele oferece "Dar entrada no estoque". "Cadastro em massa" e "Smartphones por foto" passam a abrir a Entrada.

**Decisão do usuário (05/11):** "Fechar só o estoque". Fica fora desta etapa: tirar o cadastro de catálogo do formulário, a importação do Bling pela Entrada (etapa própria) e combos/ofertas, que continuam em `/admin/products/combos`.

**Mudança na spec** (`docs/superpowers/specs/2026-11-05-entrada-unica-design.md` §5 e §6.6):
- `/admin/products/new` **não** redireciona; o formulário mantém o modo cadastro, só que sem estoque;
- `POST /products/batch` **não** ganha a trava de produto novo;
- a trava fica no estoque: `POST /units`, `POST /units/batch` e `/table-data/units`.

**Tech Stack:** Node 20 CJS + Fastify + mysql2 (servidor, `vps_server.js` e `vps_server.cjs` iguais); React/TS/Vite (front); `node:test`, testes estáticos e de navegador (padrão `tmp-tests/entrada-*-browser.test.mjs`).

## Global Constraints
- **Mensagem padrão** de bloqueio: `Entrada de estoque é feita pela tela Entrada (Admin → Entrada).`
- **`POST /units` e `POST /units/batch`** → 409 com essa mensagem.
  - Exceção: corpo com `origin: 'maintenance'` **e** autenticação por `x-sync-key`, usado pelo script `scripts/rebuild-smartphone-serialized-units.cjs`. O script passa a mandar esse campo.
  - As guardas de pai e de IMEI continuam valendo para a exceção.
- **`POST /table-data/units` e `/table-data/units/bulk`:** insert bloqueado com 409 e a mesma mensagem. Leitura, atualização e exclusão por table-data não mudam.
- **A Entrada não usa essas rotas.** Ela grava unidade por `catalogEntryServer.cjs`, e a foto por `finalizePhotoIntake`.
- **Atualizações continuam iguais:** `PUT /units/:id`, `PATCH`, trocas (`unit_swap_logs`), venda, pedido, devolução e transferência de local.
- **Formulário em modo cadastro** (`ProductForm` com `isNewRegistration`):
  - some a criação de unidade com IMEI/serial do produto único;
  - some a "lista de seriais", que criava produto + unidades;
  - a quantidade em estoque não é enviada; o produto nasce com estoque 0;
  - depois de salvar, aparece "Dar entrada no estoque", que leva a `/admin/entrada?variacao=<id>` (produto simples ou variação). Para família, leva a `/admin/entrada?aba=manual&modelo=<model_id>`, ou à primeira variação quando não há modelo.
- **Família** (`familyRegistration.js` / `saveFamilyRegistration`), no cadastro e na edição:
  - linhas novas continuam criando o **produto** filho;
  - não criam mais unidade, e os campos de IMEI/serial somem das linhas;
  - o aviso de linha nova diz "Estoque e aparelhos entram pela tela Entrada".
- **`POST /products/batch`** criando produto novo sem `bling_id`: `stock_quantity` é gravado como 0.
  - Atualização de produto existente não muda.
  - Linha com `bling_id` também não muda, porque a importação do Bling traz o estoque do Bling.
  - Verificar se outra rotina conta com estoque inicial; se contar, registrar e não aplicar.
- **Redirecionamentos** (com `replace`):
  - `/admin/products/bulk` → `/admin/entrada?aba=planilha`;
  - `/admin/products/photo-intake` → `/admin/entrada?aba=foto`;
  - links, atalhos do menu, painel rápido e botões apontam direto para a Entrada.
- **Cadastro rápido por EAN** (o `QuickRegisterForm`, que sai): a aba **Bipar** ganha "Buscar produto por código de barras ou SKU". Achou um produto → prende a variação (o mesmo `?variacao=` da etapa 5). Não achou → "Produto não encontrado. Cadastre em Produtos → Novo produto." com link para `/admin/products/new`.
- **Apagar o código morto:**
  - `pages/admin/EntradaPage.tsx`, `pages/admin/products/ProductEntryPage.tsx` e `components/products/bulk/NewProductModal.tsx`;
  - `components/units/UnitForm.tsx`, se ninguém mais importar (ajustar `tmp-tests/product-condition-used.test.mjs`);
  - `pages/admin/products/BulkRegistrationPage.tsx`, `QuickRegisterForm.tsx` e `services/bulk-products.ts`, se ficarem sem uso depois do redirecionamento. Conferir com grep antes de apagar.
  - `SmartphonePhotoIntakePage.tsx` **fica**, porque a aba Foto o usa embutido.
- Testes que conferem os caminhos antigos são **atualizados** para o comportamento novo, sem perder a proteção.
- Textos em português com acento.

## Review Focus
1. **Nenhum caminho do SPA cria unidade fora da Entrada:** grep de `unitService.create`, `createUnit` e `createUnitsBatch` em `pages/`, `components/` e `services/` (exceto a definição) → zero. → teste estático na Task 2.
2. **Importação do Bling continua criando produto com o estoque do Bling.** → teste na Task 1.
3. **Editar uma família e adicionar uma cor nova** cria o produto filho sem unidade e sem erro 409. → teste na Task 2.
4. **`/admin/products/bulk` e `/admin/products/photo-intake` redirecionam;** nenhum link aponta mais para eles. → teste na Task 3.
5. **Bipar por EAN** prende o produto certo; um EAN desconhecido mostra a mensagem com o link. → teste na Task 3.

---

### Task 1: Servidor — trava do estoque

**Files:**
- Modify: `vps_server.js` + `vps_server.cjs` (iguais):
  - `POST /units` e `POST /units/batch` com 409 e a exceção de manutenção;
  - `/table-data/units` e `/table-data/units/bulk` com insert bloqueado;
  - `POST /products/batch` grava `stock_quantity: 0` em produto novo sem `bling_id`.
- Modify: `scripts/rebuild-smartphone-serialized-units.cjs`. Manda `origin: 'maintenance'`.
- Modify: `tmp-tests/catalog-entry-units-guard-static.test.mjs`. As guardas de pai e de IMEI continuam no caminho de manutenção; acrescentar a trava.
- Test: `tmp-tests/stock-entry-lock.test.cjs`, com `fastify.inject` e banco falso, ou estático com recortes, seguindo o padrão já usado para essas rotas. Ver `print3d-migrations-mysql.test.cjs`, que roda o handler real de `/products/batch`.

- [ ] **Step 1: Write the failing tests:**
  - `POST /units` sem origin → 409 com a mensagem;
  - `POST /units/batch` → 409;
  - `POST /units` com `origin:'maintenance'` e sync key → segue (pai continua 409; IMEI repetido continua conflito);
  - `POST /table-data/units` → 409;
  - `/products/batch`, produto novo sem `bling_id` com `stock_quantity: 5` → grava 0;
  - `/products/batch` com `bling_id` novo e `stock_quantity: 5` → grava 5;
  - `/products/batch` atualizando produto existente com `stock_quantity` → mesmo comportamento de hoje;
  - os dois arquivos de servidor têm o mesmo trecho (estático).
- [ ] **Step 2: Run** e ver falhar.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run:**
  - `NODE_PATH=/home/claude/nm/node_modules node --test tmp-tests/stock-entry-lock.test.cjs tmp-tests/catalog-entry-*.test.cjs tmp-tests/catalog-entry-units-guard-static.test.mjs tmp-tests/print3d-migrations-mysql.test.cjs tmp-tests/product-sku-immutability.test.cjs tmp-tests/product-slug-on-create-static.test.mjs tmp-tests/product-family-model-guard-static.test.mjs`
  - `node --check vps_server.js && node --check vps_server.cjs`

  Os testes que já falhavam antes desta etapa: anotar e comparar com o `main`, não esconder.
- [ ] **Step 5: Commit** `feat(entrada): estoque so pela Entrada no servidor`.

### Task 2: Formulário sem estoque

**Files:**
- Modify: `components/products/ProductForm.tsx`:
  - no modo cadastro, tirar a criação de unidade do produto único (~:1992-2031), a lista de seriais com a criação das unidades (~:1791-1960) e a quantidade em estoque;
  - nas linhas de família, tirar os campos de IMEI/serial;
  - aviso fixo "Estoque e aparelhos entram pela tela Entrada" no lugar.
- Modify: `components/products/familyRegistration.js`. Não chama mais `createUnit`, e o IMEI das linhas é ignorado.
- Modify: `pages/admin/products/ProductFormPage.tsx`. Depois do cadastro, mostra a ação "Dar entrada no estoque" (toast com botão, ou tela de sucesso, conforme o padrão atual de sucesso) com o caminho de `entryAddUnitsPath` / `entryNewVariationPath` (`services/entryShortcuts.js`). O fluxo 3D continua indo para a calculadora, com a mesma ação disponível.
- Tests:
  - atualizar os estáticos do cadastro que conferem a criação de unidade (`product-form-serialized-units-static`, `product-form-serialized-batch`, `product-form-batch-add-button-static`, `product-form-single-success-toast-static`, `family-registration`, `model-parent-registration`, `product-service-model-write-vps-static` e outros que o grep achar), trocando pela proteção nova;
  - criar `tmp-tests/stock-entry-only-static.test.mjs`, com o grep do Review Focus 1 e a ação pós-cadastro;
  - teste de `saveFamilyRegistration` com mock: linha nova com IMEI → cria produto, nenhuma chamada a `createUnit`.

- [ ] **Step 1: Write the failing tests.**
- [ ] **Step 2: Run** e ver falhar.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** os testes de produto/família/formulário (`node --test` nos arquivos alterados e no grep `tmp-tests/product-form-*`, `tmp-tests/family-*`, `tmp-tests/model-parent-*`) e `npm run build`. Comparar as falhas com o `main`, onde algumas já falhavam.
- [ ] **Step 5: Commit** `feat(entrada): formulario cadastra catalogo sem estoque`.

### Task 3: Redirecionamentos, Bipar por EAN e limpeza

**Files:**
- Modify: `routes/index.tsx`. `/admin/products/bulk` e `/admin/products/photo-intake` viram `<Navigate replace>` para a Entrada.
- Modify, links para a Entrada:
  - `pages/admin/products/ProductListPage.tsx` ("Cadastro em Massa" e "Smartphones por Foto");
  - `components/admin/AdminLayout.tsx` (atalho "Foto" no celular);
  - `components/admin/dashboard/AdminQuickAccessGrid.tsx`;
  - `hooks/usePageTitle.ts`;
  - `SmartphonePhotoIntakePage.tsx`: o botão voltar do modo solto vai para a Entrada.
- Modify: `components/entrada/ScanEntryTab.tsx`, ou um componente novo `components/entrada/BarcodeProductLookup.tsx`. Campo "Buscar produto por código de barras ou SKU":
  - usa o serviço de produtos que já busca por EAN/SKU. Verificar o que o `QuickRegisterForm` usava e reaproveitar;
  - achou um produto → `navigate('/admin/entrada?aba=…&variacao=<id>')`, com a regra da etapa 5;
  - EAN alternativo também conta;
  - não achou → a mensagem com o link.
- Delete: as páginas e componentes mortos listados nas Global Constraints (grep antes de cada um).
- Tests:
  - atualizar `product-list-actions.test.cjs`, `admin-mobile-navigation-static.test.mjs`, `smartphone-photo-intake-navigation-static.test.mjs`, `product-condition-used.test.mjs` e os que apontam para as páginas apagadas;
  - criar `tmp-tests/entrada-barcode-browser.test.mjs` (EAN achado, EAN alternativo, SKU, não achado);
  - estático dos redirecionamentos e de nenhum link restante para bulk/photo-intake.

- [ ] **Step 1: Write the failing tests.**
- [ ] **Step 2: Run** e ver falhar.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `node --test --test-concurrency=2 tmp-tests/entrada-*.test.mjs tmp-tests/entry-shortcuts.test.mjs`, os testes alterados e `npm run build`.
- [ ] **Step 5: Commit** `feat(entrada): cadastro em massa e foto abrem a Entrada; bipar por codigo de barras`.

### Task 4: Versão e publicação (controller, `publicar.md`)
- [ ] `v1.2.803-entrada-estoque`: API e site.
  - A API muda `vps_server.js`. Conferir qual opção de deploy publica só o servidor; o `--catalog-entry-only` envia `server.js` + módulos.
  - Conferir o `server.js` remoto contra o commit `2f23caa` antes.
- [ ] Verificar:
  - `POST /units` sem origin → 409;
  - `/table-data/units` POST → 409;
  - prévia da Entrada continua ok;
  - `/admin/products/bulk` → 200 (o SPA redireciona);
  - `/admin/entrada?aba=planilha` → 200.
  
  Registrar, fazer push e limpar.
