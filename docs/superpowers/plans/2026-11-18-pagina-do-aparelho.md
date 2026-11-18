# Página do aparelho (Parte 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página admin `/admin/aparelhos/:identificador` que mostra, para um aparelho (IMEI 1, IMEI 2, serial ou id da unidade), a situação atual e a linha do tempo legível reconstruída do que já existe no banco.

**Architecture:** Um módulo puro (`services/unitTimeline.cjs`) transforma as linhas das fontes (diário, vendas, itens, clientes, equipe, entrada por foto, garantias, locais) em `{ current, events }`. Um servidor de rotas (`services/unitTimelineServer.cjs`) busca as linhas e chama o módulo; é registrado nos dois servidores (`vps_server.js`/`.cjs`). O frontend ganha uma página, um service e os links. Parte 1 só lê: nenhuma escrita nova no banco.

**Tech Stack:** Node/Fastify + mysql2 (API), React + TypeScript + Vite + Tailwind + lucide-react (admin), `node:test` + `node:assert/strict` (testes em `tmp-tests/`).

**Spec:** `docs/superpowers/specs/2026-11-18-historico-do-aparelho-design.md` (seções 4, 7 e 8).

## Global Constraints

- Só admin: mesma regra do leitor do diário (`getBearerAuthContext` → `isAdmin && userId`, senão 401). Nada novo em rotas da cliente.
- `Cache-Control: no-store` nas respostas.
- Eventos `product_*`, `product_stock_locations_*` e `stock_location_movements_*` **não** entram na linha do tempo.
- Mesmo fato visto por duas fontes vira **um** evento.
- Textos em português do Brasil; datas em `America/Sao_Paulo`; dinheiro em centavos na API, formatado `R$ 1.999,00` na tela.
- Rota da página: `/admin/aparelhos` (busca) e `/admin/aparelhos/:identifier`. Item de menu **Aparelhos** em "Produtos & Estoque".
- O histórico do produto (modal no `ProductCard`) continua como está.
- Mudanças no servidor vão nos **dois** arquivos `vps_server.js` e `vps_server.cjs`.
- Publicação segue `publicar.md` (versão em `public/VERSION.json`, `VERSAO_ATUAL.md`, `docs/versoes/`; stage por arquivo; nunca `git add .`).
- Fixture de teste sem dado pessoal real: nome da cliente anonimizado como `Cliente Teste`, CPF/telefone removidos.
- `unit_swap_logs` **não existe** no banco: trocas ficam fora da Parte 1 (o spec as cita; registrar no doc da versão).
- `signed_warranty_documents` não tem `serialized_unit_id`: liga pelo `sale_id` das vendas do aparelho.

## Review Focus

1. Aparelho vendido, estornado e vendido de novo (duas vendas): cada venda é um "Vendido" com o próprio cliente e valor, e "Situação agora" mostra a venda atual. Teste em Task 1.
2. Aparelho anterior ao diário (só `baseline`/`existing_sale_reference`): página mostra "Já estava cadastrado" e a venda antiga, sem erro. Teste em Task 1.
3. Identificador que bate em dois aparelhos (IMEI 2 de um = IMEI 1 de outro, ou serial repetido): a API devolve `matches` e a página deixa escolher. Teste em Task 2.
4. `sale_update` que não muda status (ex.: gravação do log de finalização, 2882 no caso real) não vira evento. Teste em Task 1.
5. Venda/cliente/vendedor apagados (linha não encontrada): evento continua com o que o diário guardou e mostra "Cliente não encontrado". Teste em Task 1.

---

### Task 1: Montagem da linha do tempo (módulo puro)

**Files:**
- Create: `services/unitTimeline.cjs`
- Create: `tmp-tests/fixtures/unit-timeline-868499080873669.json`
- Test: `tmp-tests/unit-timeline.test.cjs`

**Interfaces:**
- Produces: `buildUnitTimeline(input) -> { current, events }`, onde
  - `input = { unit, product, journal, sales, saleItems, customers, teamMembers, intakes, warranties, signedWarranties, deposits, locations }` (arrays de linhas do banco; `journal` são linhas de `unit_journal_events` com `before_data`/`after_data` já em objeto).
  - `current = { status, statusLabel, deposit: {id,name}|null, location: {id,name}|null, sale: { id, code, customerName, soldAt }|null, orderId|null, costCents, priceCents, daysInStock, timesSold, timesReturned }`.
  - `event = { key, type, at (ISO), title, detail (string|null), actor (string|null), saleId|null, orderId|null, intakeId|null }`.
  - `type` ∈ `entry`, `legacy_entry`, `legacy_sale`, `data_corrected`, `reserved`, `reservation_released`, `sold`, `sale_cancelled`, `sale_refunded`, `returned_to_stock`, `warranty_issued`, `warranty_signed`, `rma`, `hidden`, `unhidden`, `scrapped`.
  - Exporta também `STATUS_LABELS` (`available: 'Disponível'`, `reserved: 'Reservado'`, `sold: 'Vendido'`, `rma: 'RMA'`, `hidden: 'Oculto'`, `scrapped: 'Descartado'`).

Regras (o que a assinatura não decide):
- `unit_insert` → `entry`; `detail` "Cadastro por foto" quando `after_data.unit.intake_id`, senão "Cadastro manual"; inclui custo.
- `baseline` → `legacy_entry` com `at = after_data.unit.created_at` e título "Já estava cadastrado".
- `existing_sale_reference` → `legacy_sale` (venda anterior ao diário), com a venda quando achada.
- `sale_items_insert` → `sold` (chave `sold:<sale_id>`): cliente, vendedor (`team_members.name` por `sales.seller_id`), valor do item (`sale_items.unit_price`), forma(s) de pagamento, código = 8 primeiros caracteres do `sale_id` em maiúsculas.
- `unit_update` com troca de status: `available→sold` só gera `sold` se não houver `sold:<sale_id>` (venda sem `sale_items_insert`); `→reserved` = `reserved`; `reserved→available` = `reservation_released`; `sold→available` = `returned_to_stock`; `→rma`, `→hidden`, `hidden→available` (`unhidden`), `→scrapped`.
- `unit_update` com mudança em `imei_1`, `imei_2`, `imei`, `serial`, `cost_price` ou `condition` → `data_corrected` com "campo: antes → depois" no `detail`.
- `sale_update` só vira evento quando `before_data.sale.payment_status` não é cancelado e `after_data.sale.payment_status` é `cancelled` (→ `sale_cancelled`) ou `refunded` (→ `sale_refunded`).
- `warranties` (por `serialized_unit_id`) → `warranty_issued`; `signedWarranties` com `status='available'` das vendas do aparelho → `warranty_signed`.
- Ignora `product_*`, `product_stock_locations_*`, `stock_location_movements_*`, `order_update`, `order_delete`, `sale_items_update/delete`.
- Ordena por `at` desc; empate por id de origem desc.
- `current.daysInStock`: dias desde o último `entry`/`returned_to_stock` (ou `unit.created_at`) até agora, só quando `available`; senão `null`.

- [ ] **Step 1: Gerar a fixture do caso real**

Na VPS, exportar para JSON a unidade `8fe9d22d-9836-4375-867f-b130d2b6b0de`, o produto `cab5ec20-7125-4a1f-b3c3-579be3a7c551` (só `id,name,sku,price_retail,images`), as linhas do diário dessa unidade (com `before_data`/`after_data`, removendo a chave `product` deles), a venda `8d7563b4-baa3-4cf6-983c-8df9550780db` (sem `finalization_log`), seus 3 `sale_items`, o cliente (só `id` e `name` = `Cliente Teste`), o `team_members` do vendedor (`id`, `name`), a entrada por foto `cf84896f-52c8-4ece-901f-a009e8934e79` (`id,created_at,created_by,status`), e os depósitos/locais `55cbef8a-…`/`26081933-…`. Salvar em `tmp-tests/fixtures/unit-timeline-868499080873669.json`. Conferir com `grep -c 747.913 tmp-tests/fixtures/unit-timeline-868499080873669.json` → `0`.

- [ ] **Step 2: Escrever os testes**

```js
// tmp-tests/unit-timeline.test.cjs
const fixture = require('./fixtures/unit-timeline-868499080873669.json');
const clone = () => structuredClone(fixture);

test('caso real 868499080873669: entrada, venda, cancelamento, volta', () => {
  const { current, events } = buildUnitTimeline(clone());
  assert.deepEqual(events.map(e => e.type), ['returned_to_stock', 'sale_cancelled', 'sold', 'entry']);
  const sold = events.find(e => e.type === 'sold');
  assert.equal(sold.saleId, '8d7563b4-baa3-4cf6-983c-8df9550780db');
  assert.match(sold.detail, /Cliente Teste/); assert.match(sold.detail, /R\$ 1\.999,00/); assert.match(sold.title, /#8D7563B4/);
  assert.equal(events.find(e => e.type === 'entry').intakeId, 'cf84896f-52c8-4ece-901f-a009e8934e79');
  assert.equal(current.status, 'available'); assert.equal(current.statusLabel, 'Disponível');
  assert.equal(current.timesSold, 1); assert.equal(current.timesReturned, 1);
  assert.equal(current.sale, null);
});
test('sale_update sem mudança de status não vira evento', () => {
  const { events } = buildUnitTimeline(clone());        // a fixture tem o 2882 (paid → paid)
  assert.equal(events.filter(e => e.type.startsWith('sale_')).length, 1);
});
test('duas vendas: cada uma com seu cliente, situação aponta a última', () => {
  const input = clone(); /* acrescenta venda S2 (cliente "Outra Cliente", R$ 1.899,00): sale_items_insert + unit_update available→sold depois do 2899 */
  const { current, events } = buildUnitTimeline(input);
  assert.equal(events.filter(e => e.type === 'sold').length, 2);
  assert.match(events[0].detail, /Outra Cliente/);
  assert.equal(current.status, 'sold'); assert.equal(current.sale.customerName, 'Outra Cliente'); assert.equal(current.timesSold, 2);
});
test('aparelho anterior ao diário: baseline + existing_sale_reference', () => {
  const { events } = buildUnitTimeline({ ...clone(), journal: [/* baseline com unit.created_at 2026-09-01, existing_sale_reference da venda S0 */] });
  assert.deepEqual(events.map(e => e.type), ['legacy_sale', 'legacy_entry']);
  assert.equal(events[1].title, 'Já estava cadastrado'); assert.equal(events[1].at.slice(0, 10), '2026-09-01');
});
test('venda/cliente ausentes: evento mantém o diário e diz "Cliente não encontrado"', () => {
  const { events } = buildUnitTimeline({ ...clone(), sales: [], customers: [] });
  const sold = events.find(e => e.type === 'sold');
  assert.match(sold.detail, /Cliente não encontrado/); assert.match(sold.detail, /R\$ 1\.999,00/);
});
test('IMEI e custo alterados viram data_corrected com antes → depois', () => {
  const input = clone(); /* unit_update: imei_2 868499080873677 → 868499080873685, cost_price 174500 → 170000, status igual */
  const corrected = buildUnitTimeline(input).events.find(e => e.type === 'data_corrected');
  assert.match(corrected.detail, /IMEI 2: 868499080873677 → 868499080873685/); assert.match(corrected.detail, /Custo: R\$ 1\.745,00 → R\$ 1\.700,00/);
});
test('reserva e liberação de pedido', () => {
  const input = clone(); /* unit_update available→reserved (order_id O1) e reserved→available */
  const types = buildUnitTimeline(input).events.map(e => e.type);
  assert.ok(types.includes('reserved') && types.includes('reservation_released'));
});
test('eventos de produto e de saldo por local nunca aparecem', () => {
  const { events } = buildUnitTimeline(clone());         // fixture tem product_update e product_stock_locations_*
  assert.equal(events.some(e => /product_|stock_location/.test(e.key)), false);
});
```

O estorno do painel grava `payment_status='cancelled'`, por isso o caso real é `sale_cancelled`. Linhas sintéticas citadas nos comentários são montadas no próprio teste a partir das linhas da fixture (mesmo formato).

- [ ] **Step 3: Rodar e ver falhar**

Run: `node --test tmp-tests/unit-timeline.test.cjs`
Expected: FAIL com `Cannot find module '../services/unitTimeline.cjs'`.

- [ ] **Step 4: Implementar `buildUnitTimeline(input)` em `services/unitTimeline.cjs`**

CommonJS, `'use strict'`, sem acesso a banco. Um mapa `event_type → handler` e um `Map` de chaves para deduplicar.

- [ ] **Step 5: Rodar e ver passar**

Run: `node --test tmp-tests/unit-timeline.test.cjs`
Expected: todos os testes `ok`.

- [ ] **Step 6: Commit**

```bash
git add services/unitTimeline.cjs tmp-tests/unit-timeline.test.cjs tmp-tests/fixtures/unit-timeline-868499080873669.json
git commit -m "feat(aparelhos): montagem da linha do tempo do aparelho"
```

### Task 2: Rotas admin da linha do tempo

**Files:**
- Create: `services/unitTimelineServer.cjs`
- Modify: `vps_server.js:29616` e `vps_server.cjs:29557` (logo após `registerUnitJournalRoutes`)
- Test: `tmp-tests/unit-timeline-routes.test.cjs`

**Interfaces:**
- Consumes: `buildUnitTimeline` (Task 1).
- Produces: `registerUnitTimelineRoutes(app, { pool, getBearerAuthContext })` com
  - `GET /admin/units/:unitId/timeline` (unitId UUID, senão 400) → `{ unit, product, current, events }`; unidade inexistente → 404 `{ error: 'Aparelho não encontrado.' }`.
  - `GET /admin/units/timeline?identifier=X` (1–100 caracteres, senão 400): busca em `units` por `id`, `imei`, `imei_1`, `imei_2`, `serial`. 0 → 404; 1 → mesmo corpo da rota por id; >1 → 200 `{ matches: [{ id, productName, imei1, imei2, serial, status }] }`.
  - `unit` na resposta: `id, product_id, imei_1, imei_2, serial, condition, status, cost_price, created_at, intake_id`. Sem `before_data` bruto (o diário bruto segue na rota `/journal`).

- [ ] **Step 1: Escrever os testes** (padrão de `tmp-tests/unit-journal.test.cjs`: `Fastify()` + `app.inject` + pool falso que responde por trecho de SQL)

```js
// app = Fastify(); registerUnitTimelineRoutes(app, { pool: fakePool(fixture), getBearerAuthContext: async () => admin ? { isAdmin: true, userId: 'op' } : { isAdmin: false } })
test('sem sessão admin → 401 nas duas rotas', async () => {
  assert.equal((await app.inject({ url: `/admin/units/${UNIT}/timeline` })).statusCode, 401);
  assert.equal((await app.inject({ url: '/admin/units/timeline?identifier=868499080873669' })).statusCode, 401);
});
test('unitId inválido → 400; identifier vazio ou >100 → 400', async () => {
  for (const url of ['/admin/units/x/timeline', '/admin/units/timeline?identifier=', `/admin/units/timeline?identifier=${'9'.repeat(101)}`])
    assert.equal((await app.inject({ url })).statusCode, 400);
});
test('por IMEI 2 e por serial acha a mesma unidade', async () => {
  for (const id of ['868499080873677', '81346W6V100217']) {
    const body = (await app.inject({ url: `/admin/units/timeline?identifier=${id}` })).json();
    assert.equal(body.unit.id, UNIT); assert.equal(body.current.status, 'available'); assert.ok(body.events.length >= 4);
  }
});
test('identifier em duas unidades → matches', async () => {
  const body = (await app.inject({ url: '/admin/units/timeline?identifier=DUP' })).json(); // pool falso devolve 2 unidades
  assert.equal(body.matches.length, 2); assert.deepEqual(Object.keys(body.matches[0]).sort(), ['id', 'imei1', 'imei2', 'productName', 'serial', 'status']);
});
test('unidade inexistente → 404', async () => {
  const r = await app.inject({ url: `/admin/units/${MISSING}/timeline` });
  assert.equal(r.statusCode, 404); assert.equal(r.json().error, 'Aparelho não encontrado.');
});
test('Cache-Control no-store', async () => {
  assert.equal((await app.inject({ url: `/admin/units/${UNIT}/timeline` })).headers['cache-control'], 'no-store');
});
test('vps_server.js e .cjs registram registerUnitTimelineRoutes', () => {
  for (const f of ['vps_server.js', 'vps_server.cjs'])
    assert.match(fs.readFileSync(f, 'utf8'), /unitTimelineServer\.cjs'\)\.registerUnitTimelineRoutes\(fastify/);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tmp-tests/unit-timeline-routes.test.cjs`
Expected: FAIL (`Cannot find module '../services/unitTimelineServer.cjs'`).

- [ ] **Step 3: Implementar `registerUnitTimelineRoutes` e registrar nos dois servidores**

Consultas: unidade; produto; diário da unidade (`ORDER BY id`, `LIMIT 2000`); vendas pelos `sale_id` achados no diário + `sale_items.serialized_unit_id`; itens dessas vendas; clientes e `team_members` dessas vendas; entrada por foto (`smartphone_photo_intakes` por `units.intake_id`); `warranty_documents` por `serialized_unit_id`; `signed_warranty_documents` por `sale_id`; `stock_deposits`/`stock_locations` da unidade. Parse de `before_data`/`after_data` quando vierem como string. Linha `require('./services/unitTimelineServer.cjs').registerUnitTimelineRoutes(fastify, { pool, getBearerAuthContext: getVpsBearerAuthContext });` logo após a do diário.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tmp-tests/unit-timeline-routes.test.cjs tmp-tests/unit-timeline.test.cjs tmp-tests/unit-journal.test.cjs && node --check vps_server.js && node --check vps_server.cjs`
Expected: tudo `ok`, sem erro de sintaxe.

- [ ] **Step 5: Commit**

```bash
git add services/unitTimelineServer.cjs tmp-tests/unit-timeline-routes.test.cjs vps_server.js vps_server.cjs
git commit -m "feat(aparelhos): rotas admin da linha do tempo do aparelho"
```

### Task 3: Página "Aparelhos"

**Files:**
- Create: `services/unitTimelineService.ts`
- Create: `pages/admin/inventory/UnitHistoryPage.tsx`
- Modify: `routes/index.tsx` (lazy import + rotas `/admin/aparelhos` e `/admin/aparelhos/:identifier`, ambas `ProtectedRoute requireAdmin` + `AdminLayout`)
- Modify: `layouts/AdminLayout.tsx:172` (item `{ to: '/admin/aparelhos', icon: <Smartphone size={18} />, label: 'Aparelhos', keywords: 'imei serial historico aparelho celular devolucao' }` depois de "Estoque")
- Test: `tmp-tests/unit-history-page-static.test.mjs`

**Interfaces:**
- Consumes: rotas da Task 2.
- Produces:
  - `getUnitTimeline(identifier: string): Promise<UnitTimelineResponse | UnitTimelineMatches>` (UUID → `/admin/units/:id/timeline`; senão `/admin/units/timeline?identifier=`), via `vpsClient.get`.
  - Tipos `UnitTimelineEvent`, `UnitTimelineCurrent`, `UnitTimelineResponse`, `UnitTimelineMatches` espelhando a Task 1/2.

Página (celular primeiro):
- Campo de busca no topo ("IMEI 1, IMEI 2 ou serial"); enviar navega para `/admin/aparelhos/<valor>`.
- `matches` → lista para escolher (navega pelo `id`). 404 → "Nenhum aparelho com esse IMEI ou serial."
- **Resumo**: produto (nome, SKU, foto), IMEI 1, IMEI 2, serial, condição, situação (selo com `statusLabel`), "Onde está" (`deposit/location` ou "Local não registrado"), custo, preço, dias em estoque, vendido N× / devolvido N×; se vendido, cliente + link "Abrir venda" para `/admin/sales?sale=<id>` (`SalesPage` já abre os detalhes por `searchParams.get('sale')`). Mesmo link nos eventos com `saleId`.
- **Linha do tempo**: lista vertical com data/hora, título, detalhe, quem fez, links (venda, entrada por foto).
- **Dados técnicos**: botão "Ver dados técnicos" que abre o `UnitJournalModal` existente com `unitId` (mantém imprimir/WhatsApp).

- [ ] **Step 1: Escrever o teste estático**

```js
assert.match(routes, /path: "\/admin\/aparelhos"/);
assert.match(routes, /path: "\/admin\/aparelhos\/:identifier"/);
assert.match(routes, /UnitHistoryPage/);
assert.match(layout, /to: '\/admin\/aparelhos'[^}]*label: 'Aparelhos'/);
assert.match(service, /\/admin\/units\/timeline\?identifier=/);
assert.match(page, /Local não registrado/);
assert.match(page, /Nenhum aparelho com esse IMEI ou serial\./);
assert.match(page, /Ver dados técnicos/);
assert.match(page, /UnitJournalModal/);
assert.doesNotMatch(page, /product_stock_locations|stock_location_movements/); // página não reinterpreta o diário
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node tmp-tests/unit-history-page-static.test.mjs`
Expected: FAIL na primeira asserção.

- [ ] **Step 3: Implementar service, página, rotas e menu**

- [ ] **Step 4: Rodar teste e build**

Run: `node tmp-tests/unit-history-page-static.test.mjs && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "UnitHistoryPage|unitTimelineService" ; npm run build`
Expected: teste ok; nenhum erro de tipo nos arquivos novos; build termina sem erro.

- [ ] **Step 5: Commit**

```bash
git add services/unitTimelineService.ts pages/admin/inventory/UnitHistoryPage.tsx routes/index.tsx layouts/AdminLayout.tsx tmp-tests/unit-history-page-static.test.mjs
git commit -m "feat(aparelhos): página do aparelho com resumo e linha do tempo"
```

### Task 4: Links para a página

**Files:**
- Modify: `pages/admin/inventory/SerializedUnitsPage.tsx:260` (ícone de histórico navega para `/admin/aparelhos/<unit.id>`; remover `journalTarget`/`UnitJournalModal` da página se ficarem sem uso)
- Modify: `components/admin/sales/SaleDetailsModal.tsx:914-916` (IMEI 1/IMEI 2/Serial do item viram link para `/admin/aparelhos/<serialized_unit_id ou imei>`)
- Modify: `tmp-tests/unit-history-page-static.test.mjs`

**Interfaces:**
- Consumes: rota `/admin/aparelhos/:identifier` (Task 3).

- [ ] **Step 1: Acrescentar ao teste estático**

```js
assert.match(units, /\/admin\/aparelhos\/\$\{[^}]*unit\.id/);
assert.match(units, /aria-label="Abrir histórico do aparelho"/);
assert.match(saleModal, /\/admin\/aparelhos\//);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node tmp-tests/unit-history-page-static.test.mjs`
Expected: FAIL nas asserções novas.

- [ ] **Step 3: Implementar os links** (`react-router-dom` `Link`/`useNavigate`, como o resto do admin)

- [ ] **Step 4: Rodar teste, testes vizinhos e build**

Run: `node tmp-tests/unit-history-page-static.test.mjs && node tmp-tests/sale-partial-refund-static.test.mjs && node tmp-tests/sale-cancel-serialized-bling-static.test.mjs && npm run build`
Expected: tudo ok.

- [ ] **Step 5: Commit**

```bash
git add pages/admin/inventory/SerializedUnitsPage.tsx components/admin/sales/SaleDetailsModal.tsx tmp-tests/unit-history-page-static.test.mjs
git commit -m "feat(aparelhos): atalhos da lista de unidades e da venda abrem a página do aparelho"
```

### Task 5: Publicação (publicar.md)

**Files:**
- Modify: `public/VERSION.json`, `VERSAO_ATUAL.md`
- Create: `docs/versoes/2026-11-18-v1.2.862-pagina-do-aparelho.md`

- [ ] **Step 1: Versão** `v1.2.862-pagina-do-aparelho` nos três arquivos (mesmo formato da v1.2.861), citando que trocas (`unit_swap_logs` inexistente) ficaram fora.
- [ ] **Step 2: Rodar todas as validações** — `node --test tmp-tests/unit-timeline.test.cjs tmp-tests/unit-timeline-routes.test.cjs tmp-tests/unit-journal.test.cjs`, `node tmp-tests/unit-history-page-static.test.mjs`, `node tmp-tests/customer-sale-visibility.test.cjs`, `node --check vps_server.js vps_server.cjs`, `npm run build`. Expected: tudo ok.
- [ ] **Step 3: Commit, tag e push** (stage por arquivo).
- [ ] **Step 4: API** — backup em `/var/www/mdv-api/backups/unit-timeline-<ts>`, upload de `services/unitTimeline.cjs`, `services/unitTimelineServer.cjs`, `vps_server.js`, `vps_server.cjs`; `node --check`; `cp vps_server.js server.js`; `pm2 restart mdv-api`. Expected: `online`, `/status` 200.
- [ ] **Step 5: Site** — `npm run deploy:vps-site` com `VPS_SITE_RELEASE_NAME=<YYYYMMDD-HHMMSS>-v1-2-862-pagina-do-aparelho`; se o script não rodar neste ambiente (falta `.env.vps.local`), repetir os passos dele manualmente: build, nova pasta em `/var/www/mdv-site/releases/`, upload do `dist/` inteiro, `previous` → release atual, `current` → nova. Expected: release ativa, `https://www.mercadodovale.com.br/admin/aparelhos` HTTP 200.
- [ ] **Step 6: Verificar no navegador** — `/admin/aparelhos/868499080873669` mostra entrada por foto em 30/10, vendido na #8D7563B4 por R$ 1.999,00, venda cancelada/estornada em 18/11, volta ao estoque, situação Disponível; `/admin/aparelhos/868499080873677` (IMEI 2) e `/admin/aparelhos/81346W6V100217` (serial) abrem o mesmo aparelho.
- [ ] **Step 7: Registrar release/backup nos arquivos de versão, commit/push e limpar lixo** (`git status` limpo; scripts e fixtures temporários fora do repo).
