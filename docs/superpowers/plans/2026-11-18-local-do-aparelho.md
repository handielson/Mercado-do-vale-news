# Local do aparelho (Parte 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O aparelho passa a ter local de verdade: nasce no Depósito / Entrada / Conferencia, volta para lá quando sai de uma venda, e muda de lugar por transferência bipando o IMEI, com cada mudança registrada (quem, quando, de onde, para onde) e mostrada na página do aparelho.

**Architecture:** O saldo por local dos produtos com IMEI **já é recalculado a partir dos aparelhos** (`syncSerializedProductStockFromUnits` em `vps_server.js`; aparelho sem local cai em Loja Principal / Estoque Geral). Então basta tornar `units.deposit_id/location_id` confiável e chamar o recálculo: um módulo `services/unitLocation.cjs` concentra as regras (local padrão de entrada, volta ao Depósito, transferência por IMEI, preenchimento inicial, conferência de saldo sem IMEI, tabela `unit_events`); o servidor só liga as rotas e os caminhos de entrada. A transferência por quantidade de produto com IMEI passa a ser recusada (hoje ela é desfeita no próximo recálculo).

**Tech Stack:** Node/Fastify + mysql2, React + TS + Tailwind, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-18-historico-do-aparelho-design.md` (seção 5 e decisões do usuário).

## Global Constraints

- Local padrão = `ensureIncomingStockLocation(companyId, db)` (depósito `DEPOSITO`, local `ENTRADA-CONFERENCIA`), que já existe no servidor.
- Um local informado pela entrada é respeitado; o padrão só vale quando vier vazio.
- Aparelho que sai de venda (`sold` → `available`) volta para o Depósito / Entrada / Conferencia.
- Reserva liberada (`reserved` → `available`) não muda o local.
- Saldo por local continua vindo **só** do recálculo existente (`syncProductStock(productId, db, { stockLocationInTransaction: true })` dentro de transação).
- `unit_events` é só inclusão (triggers bloqueiam UPDATE/DELETE, como o diário); só a API grava.
- Preenchimento inicial **pula** aparelhos de produtos cujo saldo não bate com os IMEIs (hoje: Redmi 15 R158256R, Redmi 15 R158256T, Athomics Inspire Lite `rail`) e os lista como "saldo sem IMEI".
- Rotas novas só admin (sessão de administrador), `Cache-Control: no-store`; o preenchimento inicial só com chave de sync (roda uma vez, na VPS).
- Mudanças no servidor nos dois arquivos `vps_server.js`/`.cjs`; módulos novos na lista do `deploy-vps-server-only.cjs`.
- Publicação segue `publicar.md`.

## Review Focus

1. Dois operadores transferindo o mesmo IMEI ao mesmo tempo: o segundo recebe erro claro, nada duplicado (`FOR UPDATE` + teste com aparelho já movido).
2. IMEI bipado que é vendido/oculto/RMA, ou que não existe: recusa com o IMEI no texto, nenhuma mudança parcial (transação inteira).
3. Transferência para o mesmo local onde o aparelho já está: recusa só aquele IMEI com mensagem, sem evento vazio.
4. Preenchimento inicial rodado duas vezes: na segunda não move nada nem grava evento.
5. Produto com IMEI e saldo divergente: transferência por quantidade recusada com instrução de usar "Transferir aparelhos"; a página Aparelhos lista o produto em "saldo sem IMEI".

---

### Task 1: Regras do local do aparelho (módulo)

**Files:**
- Create: `services/unitLocation.cjs`
- Test: `tmp-tests/unit-location.test.cjs`

**Interfaces — Produces:**
- `UNIT_EVENTS_TABLE = 'unit_events'`; `unitEventsMigration() -> Array<{ name, sql }>` (tabela + triggers `mdv_unit_events_no_update`/`_no_delete`).
- `withIncomingDefault(unit, incoming) -> { deposit_id, location_id }` (mantém o informado; senão `incoming.depositId/locationId`).
- `isReturnFromSale(beforeStatus, afterStatus) -> boolean` (`sold` → `available`).
- `recordUnitEvent(db, { unitId, productId, eventType, actor, from, to, statusBefore, statusAfter, referenceType, referenceId, reason }) -> Promise<string>` (id). `eventType` ∈ `transfer`, `location_set`, `returned_to_incoming`.
- `transferUnits({ db, identifiers, toDepositId, toLocationId, actor, reason, syncProductStock }) -> Promise<{ moved: Array<{ unitId, productId, from, to }> }>`; `db` é conexão com `beginTransaction/commit/rollback/query`. Erros com `statusCode` 400/404/409 e texto em português com o IMEI.
- `backfillUnitLocations({ db, incoming, apply, actor, syncProductStock }) -> Promise<{ moved: Array<{ unitId, productId }>, skipped: Array<{ productId, sku, name, units, balance }> }>`.
- `stockMismatches(db) -> Promise<Array<{ productId, sku, name, units, balance }>>` (produtos com aparelho `available/reserved` e soma de `product_stock_locations` ≠ nº de aparelhos).

- [ ] **Step 1: Testes** (`db` falso que grava as queries e responde por tabela)

```js
test('withIncomingDefault mantém o local informado e completa o vazio', () => {
  const inc = { depositId: 'D', locationId: 'L' };
  assert.deepEqual(withIncomingDefault({ deposit_id: null, location_id: null }, inc), { deposit_id: 'D', location_id: 'L' });
  assert.deepEqual(withIncomingDefault({ deposit_id: 'X', location_id: 'Y' }, inc), { deposit_id: 'X', location_id: 'Y' });
});
test('isReturnFromSale só para sold → available', () => {
  assert.equal(isReturnFromSale('sold', 'available'), true);
  assert.equal(isReturnFromSale('reserved', 'available'), false);
  assert.equal(isReturnFromSale('available', 'available'), false);
});
test('transferência por IMEI muda o local, grava evento e recalcula o produto', async () => { /* 2 IMEIs de 2 produtos → moved.length 2, 2 UPDATE units, 2 INSERT unit_events com from/to, syncProductStock chamado 1x por produto, commit */ });
test('IMEI vendido, inexistente ou já no destino → recusa sem mudar nada', async () => { /* status sold → 409 /868499080873669/; desconhecido → 404; mesmo local → 409 "já está"; rollback, nenhum UPDATE */ });
test('aparelho travado já movido por outro operador → 409', async () => { /* SELECT … FOR UPDATE devolve local já = destino */ });
test('backfill move só aparelhos de produto com saldo batendo e lista o resto', async () => { /* produto A: 2 aparelhos sem local, saldo 2 → moved 2; produto B: 1 aparelho, saldo 4 → skipped [{sku, units:1, balance:4}] */ });
test('backfill dryRun não grava; segunda execução não move nada', async () => { ... });
test('stockMismatches devolve produtos com saldo ≠ aparelhos', async () => { ... });
test('migração cria unit_events e triggers que barram UPDATE/DELETE', () => { /* sql contém CREATE TABLE IF NOT EXISTS `unit_events`, BEFORE UPDATE … SIGNAL, BEFORE DELETE … SIGNAL */ });
```

- [ ] **Step 2:** `node --test tmp-tests/unit-location.test.cjs` → FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar `services/unitLocation.cjs`.
- [ ] **Step 4:** `node --test tmp-tests/unit-location.test.cjs` → todos ok.
- [ ] **Step 5:** Commit `feat(aparelhos): regras do local do aparelho`.

### Task 2: Ligação no servidor

**Files:**
- Modify: `vps_server.js`, `vps_server.cjs` (POST `/units`, POST `/units/batch`, PUT `/units/:id`, POST `/stock-locations/transfers`, migração no boot, rotas novas), `services/smartphonePhotoIntakeServer.cjs` (INSERT de unidade sem local), `deploy-vps-server-only.cjs` (módulo novo)
- Create: `services/unitLocationServer.cjs` (rotas)
- Test: `tmp-tests/unit-location-routes.test.cjs`

**Interfaces:**
- Consumes: Task 1.
- Produces: `registerUnitLocationRoutes(app, { pool, getBearerAuthContext, requireSyncKey, syncProductStock, ensureIncomingStockLocation, getDefaultStockCompanyId })` com
  - `POST /admin/units/transfers` body `{ identifiers: string[] (1–100), to_deposit_id, to_location_id, reason? }` → `{ moved }` (admin).
  - `GET /admin/units/stock-mismatches` → `{ rows }` (admin).
  - `POST /admin/units/location-backfill?dryRun=1` (chave de sync) → `{ moved, skipped }`.
- POST `/units` e `/units/batch` e a entrada por foto completam o local com `withIncomingDefault`.
- PUT `/units/:id`: quando `isReturnFromSale(antes, depois)` e o body não traz local, grava o Depósito / Entrada / Conferencia e um evento `returned_to_incoming`.
- POST `/stock-locations/transfers`: produto com aparelho `available/reserved` → 409 `{ error: 'Produto com IMEI: transfira pelos aparelhos em Aparelhos → Transferir aparelhos.' }`.

- [ ] **Step 1: Testes** — rotas com `Fastify().inject` (401 sem admin; 400 lista vazia/>100; transferência ok devolve `moved`; backfill exige chave de sync; `no-store`) e estáticos: cada `INSERT INTO units` de `vps_server.js`, `vps_server.cjs` e `smartphonePhotoIntakeServer.cjs` usa `withIncomingDefault` (ou recebe local obrigatório, caso do `catalogEntryServer.cjs`); PUT `/units/:id` usa `isReturnFromSale`; `/stock-locations/transfers` recusa produto com IMEI; `registerUnitLocationRoutes` registrado nos dois servidores; módulos no deploy.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** `node --test tmp-tests/unit-location-routes.test.cjs tmp-tests/unit-location.test.cjs` + `node --check` nos servidores → ok; estáticos vizinhos (`serialized-units-*`, `catalog-entry*`, `smartphone-photo-intake*`) continuam ok.
- [ ] **Step 5:** Commit `feat(aparelhos): aparelho nasce e volta no Depósito; transferência por IMEI no servidor`.

### Task 3: Linha do tempo mostra as mudanças de local

**Files:**
- Modify: `services/unitTimeline.cjs`, `services/unitTimelineServer.cjs`
- Test: `tmp-tests/unit-timeline.test.cjs`, `tmp-tests/unit-timeline-routes.test.cjs`

**Interfaces:** `buildUnitTimeline` aceita `unitEvents` (linhas de `unit_events`) e nomes de depósito/local de origem e destino (`deposits`/`locations` passam a incluir os citados nos eventos). Novos tipos: `transfer` ("Transferido · <origem> → <destino>"), `location_set` ("Local definido · <destino>"), `returned_to_incoming` ("Foi para conferência · Deposito / Entrada / Conferencia"), com `actor` e `detail` = motivo. Tabela ausente (`ER_NO_SUCH_TABLE`) → lista vazia.

- [ ] **Step 1: Testes** — transferência e local definido aparecem com quem fez e nomes dos locais; evento do mesmo instante do "Voltou ao estoque" fica logo acima dele; `unit_events` ausente não quebra a rota.
- [ ] **Step 2:** FAIL. - [ ] **Step 3:** implementar. - [ ] **Step 4:** testes da timeline ok. - [ ] **Step 5:** Commit.

### Task 4: Telas

**Files:**
- Create: `pages/admin/inventory/UnitTransferPage.tsx`, `services/unitLocationService.ts`
- Modify: `routes/index.tsx` (`/admin/aparelhos/transferir`, antes de `/admin/aparelhos/:identifier`), `pages/admin/inventory/UnitHistoryPage.tsx` (botão "Transferir aparelhos" e lista "Produtos com saldo sem IMEI" na página vazia), `scripts`/`infra/nginx` (regras SPA regeneradas)
- Test: `tmp-tests/unit-transfer-page-static.test.mjs`

Tela "Transferir aparelhos" (celular primeiro): escolhe depósito e local de destino (`/stock-locations/deposits` e `/stock-locations/locations`), campo "Bipe ou digite o IMEI ou serial" (Enter adiciona; repetido avisa), lista com produto e local atual de cada aparelho (via `getUnitTimeline`), remover da lista, motivo opcional, botão "Transferir N aparelhos"; resultado mostra o que foi movido e os erros com o IMEI.

- [ ] **Step 1:** teste estático (rota antes da `:identifier`, textos "Transferir aparelhos", "Bipe ou digite o IMEI ou serial", "Produtos com saldo sem IMEI", service chama `/admin/units/transfers` e `/admin/units/stock-mismatches`).
- [ ] **Step 2:** FAIL. - [ ] **Step 3:** implementar (+ `node scripts/sync-nginx-spa-routes.cjs`). - [ ] **Step 4:** teste + `npm run build` ok. - [ ] **Step 5:** Commit.

### Task 5: Publicação e preenchimento inicial

- [ ] Versão `v1.2.863-local-do-aparelho` (VERSION.json, VERSAO_ATUAL.md, docs/versoes).
- [ ] Todas as validações; merge ff em `main`, tag, push.
- [ ] API (backup, upload dos módulos e servidores, `node --check`, restart) — a migração `unit_events` roda no boot; conferir `SHOW TRIGGERS LIKE 'unit_events'`.
- [ ] nginx (regras SPA, `listen` de produção preservados) e site (`deploy:vps-site`).
- [ ] Backfill: `dryRun=1` → conferir 65 movidos / 3 pulados; aplicar; conferir saldo por local dos 40 produtos (soma igual à de antes) e que nenhum aparelho disponível de produto que bate ficou sem local.
- [ ] Verificar no navegador: página do Poco mostra "Onde está: Deposito / Entrada / Conferencia" e o evento "Local definido"; transferir o Poco para Loja Principal / Estoque Geral pela tela nova e ver "Transferido" na linha do tempo e o saldo por local do produto mudar.
- [ ] Registrar release/backup, commit/push, limpar lixo.
