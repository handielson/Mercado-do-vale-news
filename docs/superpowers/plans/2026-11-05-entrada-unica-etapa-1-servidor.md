# Entrada única: etapa 1 (porta única no servidor) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar no servidor a porta única de entrada (`POST /catalog-entries/preview` e `POST /catalog-entries`), que resolve família, variação, preço e estoque de uma lista de itens numa transação, e travar a criação de aparelho em produto pai.

**Architecture:**
- Regras puras ficam em `services/catalogEntryCore.cjs`: normalização, validação, plano e hash.
- Banco e rotas ficam em `services/catalogEntryServer.cjs`, que reusa:
  - `ensureSmartphoneModelFamily` (família);
  - `productSku.cjs` (SKU `PAI0001` / `PAI0001-NN`);
  - `inheritSmartphonePrices` (preço da configuração).
- Funções que hoje só existem no `vps_server.js` chegam por injeção de dependência no registro das rotas: conflito de IMEI, sincronização de estoque e movimento de estoque.
- A prévia e a confirmação executam o mesmo código. A prévia termina em `ROLLBACK`; a confirmação compara o hash do plano e faz `COMMIT`.

**Tech Stack:** Node 20 (VPS) / CommonJS, Fastify, mysql2/promise, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-05-entrada-unica-design.md` (seções 3 e 6, etapa 1).

## Global Constraints
- O VPS roda Node 20: nada de `require()` de `.mjs`. O IMEI é validado no próprio core (15 dígitos + Luhn).
- Valores de preço e custo em **centavos inteiros**. Aceitar texto numérico ("130000.00") e converter. Rejeitar fração, negativo e não numérico.
- Ordem de preço: `price_retail ≥ price_reseller ≥ price_wholesale`.
- SKU novo:
  - pai: `nextProductSku(model.name, skus)` → `XXXX0001`;
  - variação: `nextVariationSku(parentSku, skus)` → `XXXX0001-01`;
  - sob o lock `GET_LOCK('mdv:product-auto-sku', 15)` na mesma conexão.
- Condição faz parte da configuração (`smartphonePriceGroupsCore.configuration`): `new | seminovo | used | open_box`.
- O pai nunca recebe IMEI, serial, estoque nem preço de venda.
- Rotas protegidas com `requireSyncKeyOrAdmin`.
- Publicação pelo `publicar.md`: versão em `public/VERSION.json`, `VERSAO_ATUAL.md` e `docs/versoes/`; stage por arquivo; tag; push; deploy; verificação.

## Review Focus
1. **Item com cor escrita diferente** ("verde" vs "Verde", espaços): deve achar a mesma variação, não criar outra. → teste na Task 2.
2. **IMEI 2 igual ao IMEI 1 de outra linha do lote:** é duplicado no lote. → teste na Task 1.
3. **Modelo de celular sem nenhum produto ainda:** cria pai `XXXX0001` + variação `XXXX0001-01` + unidade, e o `ensureSmartphoneModelFamily` não deve recusar ("Nenhuma variação compatível"). → teste na Task 2.
4. **Confirmação com lote alterado depois da prévia** (outra pessoa entrou o mesmo IMEI): 409 com mensagem de conferir de novo, nada gravado. → teste na Task 3.
5. **`POST /units` com `product_id` de pai:** 409. → teste na Task 4.

---

### Task 1: Core puro (`catalogEntryCore.cjs`)

**Files:**
- Create: `services/catalogEntryCore.cjs`
- Test: `tmp-tests/catalog-entry-core.test.cjs`

**Interfaces:**
- Produces:
  - `SOURCES = ['manual','bipar','planilha','foto','bling','atalho']`
  - `isValidImei(value: string): boolean`
  - `cents(value): number|null|undefined`: `undefined` para vazio, número inteiro ≥ 0, `null` para inválido.
  - `normalizeEntryItem(raw: object, index: number): { line: number, source, model_id, category_id, name, configuration: {ram,storage,version,network,condition}, color, condition_note, battery_health, identity: {imei1,imei2,serial}, quantity, cost_cents, location_id, prices|null, photo_intake_id, bling, errors: string[] }`, com `line = index + 1`.
  - `validateEntryBatch(items: NormalizedItem[], { isSmartphone: (item) => boolean }): NormalizedItem[]`: devolve os itens com `errors` preenchidos.
  - `planHash(plan: PlanLine[]): string`: sha256 de `JSON.stringify` das linhas sem `errors`.

- [ ] **Step 1: Write the failing tests** em `tmp-tests/catalog-entry-core.test.cjs`:
  - `isValidImei('863715061138763') === true`; `isValidImei('863715061138764') === false`; `isValidImei('12345') === false`.
  - `cents('130000.00') === 130000`; `cents(125000) === 125000`; `cents('') === undefined`; `cents('12,50') === null`; `cents(-1) === null`; `cents(1.5) === null`.
  - `normalizeEntryItem({source:'xx'},0).errors` contém `'Origem inválida.'`; `.line === 1`.
  - Celular sem IMEI 1 e sem serial → erro `'Informe IMEI 1 ou serial.'`. Celular com `quantity: 2` → erro `'Celular entra um aparelho por linha.'`.
  - Não celular com `quantity: 0` → erro `'Quantidade deve ser 1 ou mais.'`.
  - Preços `{price_retail:100,price_reseller:200,price_wholesale:50}` → erro `'Preços fora da ordem: varejo ≥ revenda ≥ atacado.'`.
  - Lote com IMEI 1 da linha 1 igual ao IMEI 2 da linha 2 → as duas linhas recebem `'IMEI 863715061138763 repetido no lote (linhas 1 e 2).'`.
  - IMEI inválido → `'IMEI 1 inválido.'`.
  - Item sem `location_id` → `'Escolha o local de estoque.'`.
  - Item sem `model_id` e sem (`category_id` + `name`) → `'Informe o modelo ou a categoria e o nome.'`.
  - `planHash` igual para o mesmo plano e diferente quando um SKU muda.

- [ ] **Step 2: Run** `node --test tmp-tests/catalog-entry-core.test.cjs`. Expected: FAIL (`Cannot find module '../services/catalogEntryCore.cjs'`).
- [ ] **Step 3: Implement** em `services/catalogEntryCore.cjs` as funções do bloco Interfaces.
  - Texto de identificador: só dígitos para IMEI e `toUpperCase().trim()` para serial.
  - Cor: `trim()` com espaços colapsados; a comparação é feita no servidor, caso-insensível.
  - Erros com as frases exatas dos testes.
- [ ] **Step 4: Run** `node --test tmp-tests/catalog-entry-core.test.cjs`. Expected: PASS.
- [ ] **Step 5: Commit** `git add services/catalogEntryCore.cjs tmp-tests/catalog-entry-core.test.cjs` + `git commit -m "feat(entrada): core da entrada unica (validacao e plano)"`.

### Task 2: Resolução no banco (`catalogEntryServer.cjs`, sem rotas)

**Files:**
- Create: `services/catalogEntryServer.cjs`
- Modify: `services/smartphoneModelFamily.cjs` (opção `anyCategory`)
- Test: `tmp-tests/catalog-entry-server.test.cjs` (banco falso no mesmo estilo de `tmp-tests/smartphone-model-family.test.cjs`), `tmp-tests/smartphone-model-family.test.cjs` (caso novo)

**Interfaces:**
- Consumes:
  - Task 1 (`normalizeEntryItem`, `validateEntryBatch`, `planHash`);
  - `ensureSmartphoneModelFamily(connection, {modelId, companyId, defaultCompanyId, productId, anyCategory})`;
  - `nextProductSku`, `nextVariationSku` de `services/productSku.cjs`;
  - `inheritSmartphonePrices(db, product, model, existing)`, `loadModel(db, id, lock)` de `services/smartphonePriceGroupsServer.cjs`;
  - `smartphonePriceGroupsCore.isSmartphoneCategory`.
- Produces:
  - `ensureCatalogEntrySchema(pool): Promise<void>`: cria `catalog_entry_batches (id CHAR(36) PK, source VARCHAR(20), created_by CHAR(36) NULL, plan_hash CHAR(64), line_count INT, created_at TIMESTAMP)` e `catalog_entry_lines (id CHAR(36) PK, batch_id CHAR(36), line INT, product_id CHAR(36), unit_id CHAR(36) NULL, quantity INT, family_created TINYINT, variation_created TINYINT, INDEX(batch_id))`.
  - `runCatalogEntry(pool, rawItems, { commit: boolean, expectedHash?: string, userId?: string, deps }): Promise<{ ok: boolean, plan: PlanLine[], hash: string, batch_id?: string }>`, com `deps = { findUnitConflict(identifiers, excludeId), syncProductStock(productId, db), syncProductStockFromLocations(productId, db), insertStockMovement(row, db), getDefaultCompanyId(): Promise<string> }`.
  - `PlanLine = { line, product_id, sku, family: 'new'|'existing', variation: 'new'|'existing', price_source: 'group'|'group-new'|'item'|'existing', stock: { kind: 'unit'|'quantity', quantity }, errors: string[] }`.

- [ ] **Step 1: Write the failing test** em `tmp-tests/smartphone-model-family.test.cjs`: `ensureSmartphoneModelFamily(db, {...opts, anyCategory:true})` com `category_name:'Acessórios'` cria o pai; sem `anyCategory` continua lançando `/exige um modelo de smartphone/`.

- [ ] **Step 2: Write the failing tests** em `tmp-tests/catalog-entry-server.test.cjs`. O banco falso registra produtos, unidades, `product_stock_locations`, grupos de preço e o SQL executado. Casos:
  - `modelo sem produtos cria pai XXXX0001, variação -01 e unidade`: plano `family:'new'`, `variation:'new'`, `stock.kind:'unit'`; após commit há 1 pai (`is_parent:1`, estoque 0, sem `imei1` em specs), 1 filho com `parent_id` do pai e 1 unidade `available` com `deposit_id` do local.
  - `mesma configuração e cor existente só cria unidade`: nenhum `INSERT INTO products`.
  - `cor escrita diferente acha a mesma variação` ("verde " vs "Verde"): `variation:'existing'`.
  - `cor nova em configuração com preço usa o preço do grupo`: `price_source:'group'`, sem exigir `prices`.
  - `configuração nova sem prices dá erro na linha`: `'Configuração sem preço: informe varejo, revenda e atacado.'`; com `prices` → `price_source:'group-new'` e grupo gravado.
  - `seminovo da mesma memória do novo vira variação separada`.
  - `IMEI já cadastrado em units dá erro e nada é gravado`: `deps.findUnitConflict` devolve conflito → erro `'IMEI 863715061138763 já cadastrado.'`; `commit:true` → `ok:false` e o banco falso registra `ROLLBACK`.
  - `lote com uma linha ruim faz rollback total`.
  - `acessório com quantidade soma no local`: `INSERT … product_stock_locations` (ou `UPDATE quantity = quantity + ?`), movimento `movement_type:'entry'`, `reference_type:'catalog_entry'`, `reference_id: batch_id`, e `syncProductStockFromLocations` chamado.
  - `prévia não grava nada`: `commit:false` → termina em `ROLLBACK`, `ok:true`, `hash` preenchido.
  - `hash diferente na confirmação devolve 409`: `expectedHash:'x'` → erro com `statusCode:409` e mensagem `'O lote mudou desde a conferência. Confira novamente.'`.

- [ ] **Step 3: Run** `node --test tmp-tests/smartphone-model-family.test.cjs tmp-tests/catalog-entry-server.test.cjs`. Expected: FAIL.

- [ ] **Step 4: Implement** a opção `anyCategory` em `ensureSmartphoneModelFamily`: pula apenas a checagem `isSmartphoneCategory`.

- [ ] **Step 5: Implement** `runCatalogEntry` em `services/catalogEntryServer.cjs`:
  - uma conexão, `BEGIN`, lock de SKU;
  - por item, na ordem da spec §3.4:
    - trava o modelo (`loadModel(conn, id, true)`);
    - acha ou cria o pai com `nextProductSku` quando o modelo não tem pai;
    - acha a variação por `model_id` + `configuration().id` + cor normalizada; senão cria com `nextVariationSku`, fotos de `model_color_images` e specs do item;
    - preço via `inheritSmartphonePrices` (celular) ou `prices` (outros, só se a variação é nova);
    - `ensureSmartphoneModelFamily(..., {anyCategory: !smartphone})`;
    - unidade ou quantidade;
  - erros de regra viram `errors` da linha (não exceção);
  - no fim: se `commit` e todas as linhas sem erro e `hash === expectedHash` → grava `catalog_entry_*` e `COMMIT`; senão `ROLLBACK`.

- [ ] **Step 6: Run** os dois testes. Expected: PASS.
- [ ] **Step 7: Commit** `git add services/catalogEntryServer.cjs services/smartphoneModelFamily.cjs tmp-tests/catalog-entry-server.test.cjs tmp-tests/smartphone-model-family.test.cjs` + `git commit -m "feat(entrada): resolucao de familia, variacao, preco e estoque em transacao"`.

### Task 3: Rotas `/catalog-entries`

**Files:**
- Modify: `services/catalogEntryServer.cjs` (adiciona `registerCatalogEntryRoutes`)
- Modify: `vps_server.js` e `vps_server.cjs` (registro, perto de `registerSmartphonePriceGroupRoutes`)
- Test: `tmp-tests/catalog-entry-routes.test.cjs`

**Interfaces:**
- Consumes: `runCatalogEntry`, `ensureCatalogEntrySchema` (Task 2).
- Produces:
  - `registerCatalogEntryRoutes(fastify, { pool, auth, deps })`;
  - `POST /catalog-entries/preview` → `200 { ok, plan, hash }`;
  - `POST /catalog-entries` com `{ items, preview_hash }` → `201 { batch_id, plan }`, `422 { plan }` com erros de linha ou `409 { error }`;
  - `GET /catalog-entries/:id` → `{ batch, lines }`.

- [ ] **Step 1: Write the failing tests** com `fastify()` real + `inject` e o banco falso da Task 2:
  - prévia devolve `hash`;
  - confirmação com `preview_hash` certo → 201 e `batch_id`;
  - com hash errado → 409 `'O lote mudou desde a conferência. Confira novamente.'`;
  - item inválido → 422 com `plan[0].errors`;
  - mais de 500 itens → 400 `'Lote acima de 500 itens.'`;
  - sem auth → 401.
- [ ] **Step 2: Run** `node --test tmp-tests/catalog-entry-routes.test.cjs`. Expected: FAIL.
- [ ] **Step 3: Implement** `registerCatalogEntryRoutes`. O usuário vem de `request.user?.id` quando houver. O `vps_server.js`/`.cjs` registra com `{ pool, auth: requireSyncKeyOrAdmin, deps: { findUnitConflict: (ids, ex) => findUnitSerializedIdentifierConflict(ids, ex), syncProductStock, syncProductStockFromLocations, insertStockMovement, getDefaultCompanyId: getDefaultStockCompanyId } }` (resolvido a cada chamada, não no boot).
- [ ] **Step 4: Run** o teste + `node --check vps_server.js && node --check vps_server.cjs`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(entrada): rotas /catalog-entries (previa, confirmacao, consulta)"`.

### Task 4: Trava de aparelho em produto pai + deploy

**Files:**
- Modify: `vps_server.js` e `vps_server.cjs` (`POST /units`, `POST /units/batch`)
- Modify: `deploy-vps-server-only.cjs` (opção `--catalog-entry-only`, no mesmo estilo de `--sales-marketplaces-only`: guarda de arquivos commitados, backup, upload de `services/catalogEntryCore.cjs`, `services/catalogEntryServer.cjs`, `services/smartphoneModelFamily.cjs` e do runtime, `node --check`, `pm2 restart mdv-api`)
- Test: `tmp-tests/catalog-entry-units-guard-static.test.mjs`

- [ ] **Step 1: Write the failing test** (estático):
  - os dois handlers de `POST /units` e `POST /units/batch` consultam `is_parent` e devolvem 409 `'Aparelho não pode ficar no produto pai. Use a variação (cor/memória).'`;
  - `deploy-vps-server-only.cjs` contém `--catalog-entry-only` e lista os três serviços.
- [ ] **Step 2: Run** `node tmp-tests/catalog-entry-units-guard-static.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** nos handlers: `SELECT is_parent FROM products WHERE id=?` → 409 se `1`, antes do conflito de IMEI. Implementar também a opção de deploy.
- [ ] **Step 4: Run** o teste + `node --check vps_server.js && node --check vps_server.cjs`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "fix(estoque): aparelho nao entra em produto pai; deploy --catalog-entry-only"`.

### Task 5: Versão, publicação e verificação (`publicar.md`)

- [ ] **Step 1:** Rodar todos os testes da etapa:
  - `node --test tmp-tests/catalog-entry-core.test.cjs tmp-tests/catalog-entry-server.test.cjs tmp-tests/catalog-entry-routes.test.cjs tmp-tests/smartphone-model-family.test.cjs tmp-tests/model-family-repair.test.cjs`;
  - `node tmp-tests/catalog-entry-units-guard-static.test.mjs`.
  
  Expected: tudo PASS.
- [ ] **Step 2:** `v1.2.795-entrada-unica-servidor` em `public/VERSION.json` (status `publicada`, `api_release`), `VERSAO_ATUAL.md` e `docs/versoes/2026-11-05-v1.2.795-entrada-unica-servidor.md`. Stage por arquivo; commit; tag; push.
- [ ] **Step 3:** `node deploy-vps-server-only.cjs --catalog-entry-only`. Expected: `pm2` online. Antes, conferir que o `server.js` remoto tem o sha do `vps_server.js` do commit anterior.
- [ ] **Step 4:** Verificar na VPS, com a sync key e só leitura:
  - `POST /catalog-entries/preview` com 1 item de acessório existente → `200` e `hash`;
  - `POST /units` com o id de um pai → `409`;
  - `/status` → `mysql.ok`.
- [ ] **Step 5:** Registrar o backup e a verificação no `docs/versoes/…`; commit; push; apagar as chaves temporárias.
