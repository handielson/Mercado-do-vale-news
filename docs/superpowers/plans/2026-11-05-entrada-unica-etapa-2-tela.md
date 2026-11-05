# Entrada única: etapa 2 (tela Entrada, abas Manual e Bipar) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tela `/admin/entrada` com a Lista de entrada e as abas **Manual** e **Bipar**, que conferem e confirmam o lote pela porta única da etapa 1.

**Architecture:**
- A regra da lista fica num módulo JS puro (`components/entrada/entryList.js`), testado com `node:test`: adicionar, editar e remover linhas, montar os itens da API, aplicar a prévia e decidir se pode confirmar. O módulo também guarda e lê o rascunho no navegador.
- A tela (`pages/admin/entrada/CatalogEntryPage.tsx`) só desenha a lista e as abas.
- Cada aba é um componente que entrega linhas prontas para a lista.
- O cliente HTTP (`services/catalogEntries.ts`) fala com `/catalog-entries`.

**Tech Stack:** React 18 + TypeScript + Vite, Tailwind, `vpsClient`, `node:test`; testes de navegador com Vite + Playwright no padrão de `tmp-tests/accounting-page-browser.test.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-05-entrada-unica-design.md` (seção 4; etapa 2 da seção 6). API pronta da etapa 1: `services/catalogEntryServer.cjs` e `services/catalogEntryCore.cjs`.

## Global Constraints
- Contrato da API:
  - `POST /catalog-entries/preview {items}` → `200 {ok, plan, hash}`;
  - `POST /catalog-entries {items, preview_hash}` → `201 {batch_id, plan}`, `422 {plan}` ou `409 {error}`;
  - `GET /catalog-entries/:id`.
- `PlanLine = {line, product_id, sku, family:'new'|'existing'|null, variation:'new'|'existing'|null, price_source, stock:{kind,quantity}, errors[]}`.
- O item segue `normalizeEntryItem` (spec §3.3): `source`, `model_id`, `category_id`, `name`, `configuration{ram,storage,version,network,condition}`, `color`, `condition_note`, `battery_health`, `identity{imei1,imei2,serial}`, `quantity`, `cost_cents`, `location_id`, `prices{price_retail,price_reseller,price_wholesale}|null`.
- `vpsClient` lança `Error('[VPS] <status> …')` em resposta não 2xx e não devolve o corpo. Em 409 ou 422 a tela roda a prévia de novo e mostra o plano novo.
- Valores em centavos inteiros. O campo de dinheiro usa `components/ui/CurrencyInput` (`onChange(cents)`).
- Textos visíveis em português, com acento.
- Botão **Confirmar entrada** só habilitado quando a última prévia tem `ok:true` e a lista não mudou depois dela.
- Rascunho no navegador: chave `mdv-entrada-rascunho-v1`, com leitura e escrita dentro de `try/catch`.
- Não alterar as telas antigas nesta etapa: os redirecionamentos são a etapa 6.

## Review Focus
1. **Lista editada depois da prévia:** o Confirmar volta a ficar desabilitado até conferir de novo. → teste na Task 1.
2. **Duas linhas com o mesmo IMEI digitadas na tela:** a prévia mostra o erro nas duas e o Confirmar fica desabilitado. → teste de navegador na Task 2.
3. **Confirmação que volta 409:** a tela mostra "O lote mudou desde a conferência. Confira novamente." e roda a prévia de novo. → teste na Task 2.
4. **Bipar a mesma leitura duas vezes seguidas** (leitor repete): não cria linha duplicada; mostra o aviso "IMEI já está na lista". → teste na Task 4.
5. **Rascunho corrompido no navegador:** a tela abre com a lista vazia, sem quebrar. → teste na Task 1.

---

### Task 1: Cliente HTTP + regra da lista

**Files:**
- Create: `services/catalogEntries.ts`, `components/entrada/entryList.js`
- Test: `tmp-tests/entrada-entry-list.test.mjs`

**Interfaces:**
- Produces:
  - `catalogEntries.preview(items: EntryItem[]): Promise<{ok:boolean, plan:PlanLine[], hash:string}>`
  - `catalogEntries.commit(items: EntryItem[], previewHash: string): Promise<{batch_id:string, plan:PlanLine[]}>`
  - `catalogEntries.get(id: string)`
  - `entryList.js`:
    - `createLine(fields: object, { source }): Line`, com `Line = { key, source, item, label }`; `key` é string única, `item` é o EntryItem e `label` é o texto curto para a lista (ex.: "Redmi 15 · 8/256 · Verde · IMEI …8763");
    - `addLines(state, lines): State`, `updateLine(state, key, item): State`, `removeLine(state, key): State`;
    - `toItems(state): EntryItem[]`;
    - `applyPreview(state, result): State`, que guarda `plan` por linha (na ordem), `hash` e `previewedSignature`;
    - `canConfirm(state): boolean`;
    - `lineStatus(state, key): {state:'pending'|'ok'|'error', badges:string[], errors:string[]}`. Os selos são 'família nova', 'cor nova', 'já existe' e 'preço da configuração novo';
    - `hasIdentity(state, imeiOrSerial): boolean`;
    - `saveDraft(state, storage)`, `loadDraft(storage): State`, com estado vazio quando não há rascunho, o JSON é inválido ou o storage lança erro;
    - `emptyState()`.
  - `State = { lines: Line[], plan: PlanLine[]|null, hash: string|null, previewedSignature: string|null }`. A assinatura é `JSON.stringify(toItems(state))`.

- [ ] **Step 1: Write the failing tests** em `tmp-tests/entrada-entry-list.test.mjs`:
  - `addLines` + `toItems` preserva a ordem;
  - `canConfirm` é falso sem prévia, verdadeiro após `applyPreview` com `ok:true`, e volta a falso depois de `updateLine` ou `removeLine`;
  - `applyPreview` com `ok:false` deixa `canConfirm` falso, e `lineStatus` mostra os `errors` da linha certa;
  - selos: `family:'new'` → 'família nova'; `variation:'new'` com família existente → 'cor nova'; `variation:'existing'` → 'já existe'; `price_source:'group-new'` → 'preço da configuração novo';
  - `hasIdentity` acha por IMEI 1, IMEI 2 ou serial (serial sem diferenciar maiúscula);
  - `loadDraft` com storage que lança erro, com `'{x'` e com `null` devolve `emptyState()`; `saveDraft` seguido de `loadDraft` devolve as linhas, sem plano.
- [ ] **Step 2: Run** `node --test tmp-tests/entrada-entry-list.test.mjs`. Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implement** os dois arquivos.
  - `catalogEntries.ts` usa `vpsClient.post` com `timeoutMs: 60000` nas rotas da etapa 1.
  - `entryList.js` é ESM puro (sem React).
- [ ] **Step 4: Run** o teste. Expected: PASS.
- [ ] **Step 5: Commit** `feat(entrada): cliente da porta unica e regra da lista`.

### Task 2: Página, rota, menu e Lista de entrada

**Files:**
- Create: `pages/admin/entrada/CatalogEntryPage.tsx`, `components/entrada/EntryListPanel.tsx`
- Modify: `routes/index.tsx` (lazy + rota `/admin/entrada` com `ProtectedRoute requireAdmin` + `AdminLayout`), `layouts/AdminLayout.tsx` (item "Entrada" em "Produtos & Estoque", logo após "Produtos": ícone `PackagePlus`, keywords `cadastro entrada estoque imei bipar planilha foto`), `hooks/usePageTitle.ts` (`'/admin/entrada': 'Entrada'`)
- Test: `tmp-tests/entrada-page-browser.test.mjs`

**Interfaces:**
- Consumes: Task 1 (`catalogEntries`, `entryList`).
- Produces:
  - `CatalogEntryPage` (export nomeado e default): abas `Manual | Bipar | Planilha | Foto`. Planilha e Foto mostram "Em breve nesta tela (use as telas atuais por enquanto)" com link para `/admin/products/bulk` e `/admin/products/photo-intake`. A aba vem de `?aba=`.
  - Contrato de cada aba: `onAddLines(lines: Line[]) => void`.
  - `EntryListPanel({ state, onRemove, onEdit, onPreview, onConfirm, busy, result })`.

- [ ] **Step 1: Write the failing browser test** (padrão `accounting-page-browser.test.mjs`, com `catalogEntries` e os serviços das abas trocados por stubs em `window`). Casos:
  - a página mostra as 4 abas e a lista vazia "Nenhum item na lista";
  - com 2 linhas pré-carregadas pelo rascunho (`mdv-entrada-rascunho-v1` via `addInitScript`), **Conferir** chama `preview` com 2 itens e mostra ✅ e o selo 'cor nova';
  - prévia com erro "IMEI 863715061138763 repetido no lote (linhas 1 e 2)." nas duas linhas → as duas mostram o erro e **Confirmar entrada** fica desabilitado;
  - prévia ok → Confirmar habilitado; `commit` resolve `{batch_id:'b1', plan}` → a tela mostra "Entrada confirmada" com link para `/admin/products/<product_id>` de cada linha, e a lista e o rascunho são limpos;
  - `commit` rejeita com `Error('[VPS] 409 …')` → mostra "O lote mudou desde a conferência. Confira novamente." e chama `preview` de novo;
  - remover uma linha depois da prévia desabilita o Confirmar.
- [ ] **Step 2: Run** `node --test tmp-tests/entrada-page-browser.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement**:
  - página: estado via `entryList`, rascunho salvo a cada mudança;
  - painel: tabela ou cartões com rótulo, origem, selos, status ✅/⚠️ + erros, botão remover;
  - rota, menu e título.
- [ ] **Step 4: Run** o teste + `npx tsc --noEmit -p .` restrito aos arquivos novos (ou `npm run build`). Expected: PASS / build ok.
- [ ] **Step 5: Commit** `feat(entrada): tela Entrada com lista, previa e confirmacao`.

### Task 3: Aba Manual

**Files:**
- Create: `components/entrada/ManualEntryTab.tsx`
- Modify: `pages/admin/entrada/CatalogEntryPage.tsx` (liga a aba)
- Test: `tmp-tests/entrada-manual-browser.test.mjs`

**Interfaces:**
- Consumes:
  - `modelService.list()`, `categoryService.getById(id)`;
  - `isSmartphoneModel({category_name})` de `services/smartphoneModelSpecs.mjs`;
  - `modelColorImagesService.getByModel(modelId)` + `colorService.list()` (cores com foto);
  - `stockLocationService.listLocations()`;
  - `IMEIInput` (com `onScanPair`), `CurrencyInput`;
  - `createLine` (Task 1).
- Produces: `ManualEntryTab({ onAddLines, prefill?: { model_id?: string } })`.

- [ ] **Step 1: Write the failing browser test** (stubs dos serviços). Casos:
  - escolher o modelo "Redmi 15" (celular) mostra RAM, Armazenamento, Versão (padrão "Global"), Condição (Novo, Seminovo, Usado, Caixa aberta), as cores com foto (Verde, Preto) como botões, IMEI 1, IMEI 2, Serial, Custo e Local;
  - preencher e clicar **Adicionar à lista** chama `onAddLines` com 1 linha cujo `item` tem `source:'manual'`, `model_id`, `configuration`, `color:'Verde'`, `identity.imei1`, `cost_cents`, `location_id`, `quantity:1`;
  - condição Seminovo mostra o campo "Observação do seminovo", que vai em `condition_note`;
  - modelo de outra categoria (acessório) mostra **Quantidade** no lugar de IMEI;
  - sem modelo, o botão fica desabilitado;
  - campos de preço (Varejo, Revenda, Atacado) aparecem só com a opção "Informar preços desta configuração" marcada e vão em `prices`.
- [ ] **Step 2: Run** `node --test tmp-tests/entrada-manual-browser.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** a aba e ligue `?modelo=<id>` como `prefill.model_id`.
- [ ] **Step 4: Run** o teste + o da Task 2. Expected: PASS.
- [ ] **Step 5: Commit** `feat(entrada): aba Manual`.

### Task 4: Aba Bipar

**Files:**
- Create: `components/entrada/ScanEntryTab.tsx`
- Modify: `pages/admin/entrada/CatalogEntryPage.tsx`
- Test: `tmp-tests/entrada-scan-browser.test.mjs`

**Interfaces:**
- Consumes:
  - os mesmos serviços da Task 3 + `productService.getById(id)` (atalho `?variacao=<id>`: trava modelo, configuração, cor e condição a partir do produto, com `specs.ram`, `specs.storage`, `specs.version` (padrão "Global"), `specs.condition` (padrão "new") e `specs.color`);
  - `hasIdentity` (Task 1).
- Produces: `ScanEntryTab({ onAddLines, existingState, prefill?: { variation_id?: string } })`.

- [ ] **Step 1: Write the failing browser test**:
  - etapa "Travar": modelo, configuração, cor, custo e local; o botão "Começar a bipar" só aparece com tudo preenchido;
  - no campo de leitura, digitar `863715061138763` + Enter adiciona 1 linha (`source:'bipar'`); o campo limpa e mantém o foco;
  - ler o par (via `onScanPair(['863715061138763','863715061138771'])`) adiciona 1 linha com `imei1` e `imei2`;
  - repetir uma leitura já presente na lista não adiciona e mostra "IMEI já está na lista";
  - IMEI inválido (`863715061138764`) não adiciona e mostra "IMEI inválido";
  - `?variacao=<id>` chega travado no produto (rótulo com nome + cor + memória), sem pedir modelo;
  - o contador mostra "3 aparelhos lidos".
- [ ] **Step 2: Run** `node --test tmp-tests/entrada-scan-browser.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** a aba (validação de IMEI local: 15 dígitos + Luhn, a mesma regra de `catalogEntryCore.isValidImei`) e ligue `?aba=bipar&variacao=<id>`.
- [ ] **Step 4: Run** os testes das Tasks 2, 3 e 4 + `npm run build`. Expected: PASS / build ok.
- [ ] **Step 5: Commit** `feat(entrada): aba Bipar`.

### Task 5: Versão, publicação e verificação (controller, `publicar.md`)
- [ ] `v1.2.798-entrada-unica-tela` (status `publicada` já no build, release `/var/www/mdv-site/releases/<YYYYMMDD-HHMMSS>-v1298-entrada-tela`); `VERSAO_ATUAL.md`, `docs/versoes/…`; commit; tag; push.
- [ ] Build no PC (`NODE_PATH=$HOME/nm/node_modules npm run build`), conferir que o bundle não tem Supabase e publicar com `VPS_SITE_SKIP_BUILD=1` e `VPS_SITE_RELEASE_NAME`.
- [ ] Verificar `/VERSION.json` e `/admin/entrada` (HTTP 200); registrar a release; push; limpar as chaves.
