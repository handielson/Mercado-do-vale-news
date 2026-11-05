# Entrada única: ajustes das pendências (v1.2.804) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** resolver as pendências menores registradas nas versões v1.2.801–803 (`docs/versoes/2026-11-05-v1.2.80{1,2,3}-*.md`). Ficam de fora, por decisão do usuário em 05/11, a importação do Bling pela Entrada e a consulta ao Bling enquanto o lock do SKU está preso.

**Tech Stack:** Node 20 CJS, Fastify e mysql2 (`vps_server.js` e `vps_server.cjs` iguais); React/TS/Vite; `node:test`, com testes estáticos e de navegador (padrão `tmp-tests/entrada-*-browser.test.mjs`).

## Global Constraints
- Comportamento atual que não está nesta lista não muda.
- Textos em português, com acento.
- Cada pendência resolvida ganha teste que falharia sem a correção.

---

### Task A: Servidor
1. **`/table-data/products` grava `stock_quantity` cru** (insert, bulk e PATCH por table-data). Se o corpo traz `stock_quantity`, responde 409 com "Entrada de estoque é feita pela tela Entrada (Admin → Entrada).". As outras colunas continuam iguais. O MySQL Explorer é quem usa essa rota.
   - Conferir se `vpsDbInsert/Upsert('products')` ou outro chamador interno passa `stock_quantity` por esse caminho.
   - Se algum passar, aplicar a trava só às rotas HTTP.
2. **Prévia cria o local padrão pelo pool.** `syncProductStock`/`ensureDefaultStockLocation` (`vps_server.js` ~27257), quando chamado pela porta única com a conexão da transação, usa essa conexão; assim a prévia desfaz tudo.
   - Mudar só o caminho chamado pela porta única, ou aceitar `connection` opcional sem mudar os outros chamadores.

**Files:** `vps_server.js`, `vps_server.cjs`; se preciso, `services/catalogEntryServer.cjs`. Testes novos em `tmp-tests/`.
**Run:** `NODE_PATH=/home/claude/nm/node_modules node --test tmp-tests/stock-entry-lock.test.cjs tmp-tests/catalog-entry-*.test.cjs tmp-tests/catalog-entry-units-guard-static.test.mjs` + os novos; `node --check` nos dois servidores.

### Task B: Tela Entrada
1. **Rascunho antigo + atalho.** Ao abrir com `?variacao=` e já existirem linhas na lista restauradas do rascunho, mostrar o aviso "Há N linha(s) de uma entrada anterior na lista." com dois botões: "Limpar a lista" (zera rascunho e `client_batch_id`) e "Manter".
2. **Combo/oferta pelo atalho.** `loadFixedVariation` recusa `is_combo=1` ou `offer_type` com a mensagem do servidor ("Combo/oferta não recebe estoque: dê entrada nos produtos que o compõem.").
   - Se `productService.getById` não devolve esses campos, buscar por um caminho que devolva; ver o que a rota `GET /products/:id` retorna.
3. **Trocar de variação perde custo e local.** Custo e local digitados ficam na página, ou o componente da aba não é desmontado. Assim, ir de `?variacao=A` para `?variacao=B` mantém os dois.
4. **"Já está na lista" ignora o IMEI da linha de foto.** A linha de foto passa a guardar IMEI 1, IMEI 2 e serial do pré-cadastro (só na linha, não no item enviado), e `hasIdentity` considera esses valores. No Bipar, bipar o IMEI de um aparelho que já está na lista pela foto mostra "Já está na lista".
5. **Rótulo da linha de foto desatualizado.** Quando a fila de foto recarrega, as linhas de foto da lista cujo pré-cadastro mudou ganham rótulo e identidades novos. Isso cobre o aviso "Adicionado à lista" e o 409 confuso.

**Files:** `pages/admin/entrada/CatalogEntryPage.tsx`, `components/entrada/*` (`entryList.js`, `FixedVariationCard.tsx`, `ManualEntryTab.tsx`, `ScanEntryTab.tsx`, `PhotoEntryTab.tsx`) e `tmp-tests/entrada-*`.
**Run:** `node --test --test-concurrency=2 tmp-tests/entrada-*.test.mjs tmp-tests/entry-shortcuts.test.mjs` + `npm run build`.

### Task C: Formulário e limpeza
1. **Nova tentativa do produto único zera o estoque.** Em `ProductForm.tsx` (~:1527, retry via `singleSaveCheckpoint` → `productService.update`), quando `isNewRegistration` é verdadeiro, o `update` **omite** `stock_quantity`. Com o campo omitido, o servidor mantém o saldo.
2. **Rascunho antigo com lista de seriais.** Ao abrir um rascunho cuja `snapshot` tem `serialList` com itens, mostrar uma vez o aviso "Este rascunho tinha N aparelho(s) na lista de seriais. Dê entrada deles pela tela Entrada.", com link para `/admin/entrada?aba=bipar`.
3. **Código morto.** Apagar `components/products/ProductEntryForm.tsx` e `components/products/entry/**` (antes, grep de importadores). Ajustar:
   - `tmp-tests/unique-validation-vps-products-static.test.mjs`, que lê `BatchEntryGrid.tsx`;
   - o mock de `serializedBatch` que sobrou em `tmp-tests/print3d-product-specifications-render.test.cjs`.

**Files:** `components/products/ProductForm.tsx`, `pages/admin/products/ProductFormPage.tsx`, as remoções e os testes.
**Run:** `node --test tmp-tests/stock-entry-only-static.test.mjs tmp-tests/product-form-*.test.* tmp-tests/family-registration.test.mjs` + os alterados; `npm run build`.

### Task D: Versão e publicação (controller, `publicar.md`)
- [ ] Juntar A, B e C. Revisão final. `v1.2.804-entrada-ajustes`: API + site.
- [ ] Conferir o servidor remoto contra `5f7ff39`.
- [ ] Verificar: `/status`; `POST /table-data/products` com `stock_quantity` → 409; prévia ok; `/admin/entrada` → 200. Registrar, fazer push e limpar.
