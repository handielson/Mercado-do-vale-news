# Entrada única: etapa 4 (aba Foto) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aba **Foto** na tela `/admin/entrada`. Ela usa a fila de cadastro por foto atual (captura, análise, revisão, margens, cores, Bling e preços). No lugar de "Salvar no estoque", o aparelho revisado vai para a Lista de entrada, e a confirmação do lote finaliza o pré-cadastro pela porta única.

**Architecture:**
- **Servidor:**
  - o corpo da rota `POST /smartphone-photo-intakes/:id/finalize` vira a função `finalizePhotoIntake(connection, intakeId, { sku, headers })`, que roda na transação de quem chama, sem `BEGIN`/`COMMIT` próprios;
  - a rota antiga continua chamando essa função, com o mesmo comportamento;
  - a porta única (`runCatalogEntry`) trata a linha com `photo_intake_id` chamando essa mesma função dentro da transação do lote. Na prévia ela roda e é desfeita (`ROLLBACK`); na confirmação, grava.
  
  Assim as regras próprias da foto continuam valendo exatamente como hoje: preços confirmados, revisão, EAN alternativo, vínculo Bling, `units.intake_id`, foto privada e status `completed`.
- **Front:** a página `SmartphonePhotoIntakePage` ganha o modo embutido `onSendToList(intake)`. Nesse modo o botão de finalizar vira "Enviar para a lista" e a página não chama `finalize`. A aba Foto renderiza a página nesse modo.

**Tech Stack:** Node 20 CJS + Fastify + mysql2 (servidor); React/TS/Vite (front); `node:test` com banco falso (`tmp-tests/helpers/catalogEntryFakeDb.cjs`) e testes de navegador (padrão `tmp-tests/entrada-*.test.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-05-entrada-unica-design.md` (§4.2 Foto; etapa 4 da §6).

## Global Constraints
- A linha de foto é `{ source:'foto', photo_intake_id, label }`. O servidor **ignora os demais campos do cliente** para essa linha e usa os dados do pré-cadastro (modelo, cor, memória, versão, IMEI, serial, preços, custo, EAN).
- Mensagens de erro da linha de foto: as mesmas da rota de hoje (ex.: "Confirme os preços antes de salvar"), mais:
  - pré-cadastro já finalizado → "Este aparelho da fila de foto já foi salvo.";
  - pré-cadastro inexistente → "Pré-cadastro não encontrado";
  - excluído → "Este registro foi excluído da fila".
- Rota antiga `POST /smartphone-photo-intakes/:id/finalize`: mesma resposta e mesmos códigos de hoje (incluindo a resposta idempotente quando já está concluída). A rota passa a apenas abrir a transação e chamar `finalizePhotoIntake`.
- `verifyBlingChild` usa `fastify.inject` com os cabeçalhos da requisição. A porta única passa os cabeçalhos da requisição dela (`request.headers`) em `options.headers`.
- Local da unidade: a finalização de foto não tem local hoje. Na linha de foto, o `location_id` do item, se vier, é aplicado à unidade criada (`units.location_id`/`deposit_id`) e o estoque por local é sincronizado; sem local, fica como hoje.
- A tela antiga `/admin/products/photo-intake` continua funcionando (o desligamento é a etapa 6).
- Node 20 CommonJS no servidor; textos em português com acento.

## Review Focus
1. **Mesmo pré-cadastro duas vezes no mesmo lote:** a segunda linha dá erro "Este aparelho da fila de foto já foi salvo." (vê a primeira dentro da transação), e nada é gravado. → teste na Task 1.
2. **Prévia não altera o pré-cadastro:** depois da prévia, o status continua o de antes (ROLLBACK). → teste na Task 1.
3. **Lote misto** (uma linha de foto + uma linha manual do mesmo modelo e cor): não cria variação duplicada. → teste na Task 1.
4. **Na aba Foto, enviar para a lista o mesmo pré-cadastro duas vezes:** não duplica a linha. → teste na Task 2.
5. **Depois de confirmar o lote, a fila da aba Foto mostra o aparelho como concluído** (recarrega a fila). → teste na Task 2.

---

### Task 1: Servidor — finalização de foto pela porta única

**Files:**
- Modify: `services/smartphonePhotoIntakeServer.cjs`. Extrair `finalizePhotoIntake(connection, intakeId, { sku, headers, locationId })`; `registerSmartphonePhotoIntakeRoutes` passa a retornar `{ ensureSchema, finalizePhotoIntake }`.
- Modify: `services/catalogEntryServer.cjs`:
  - linhas com `photo_intake_id` chamam `deps.finalizePhotoIntake(ctx.conn, id, { headers, locationId })` num SAVEPOINT da linha;
  - erro 4xx da função vira erro da linha;
  - a PlanLine sai com `family`/`variation` vindos do resultado da função (`created` → 'new'/'existing') e `price_source:'photo'`;
  - o hash do lote inclui `photo_intake_id`.
- Modify: `vps_server.js` + `vps_server.cjs` (iguais):
  - guardar o retorno de `registerSmartphonePhotoIntakeRoutes(...)`;
  - passar `finalizePhotoIntake` em `deps` do `registerCatalogEntryRoutes`;
  - passar os cabeçalhos da requisição até `runCatalogEntry` (opção `requestHeaders`).
- Test: `tmp-tests/catalog-entry-photo.test.cjs`, mais os testes existentes da foto, que não podem mudar de resultado: `tmp-tests/smartphone-photo-intake-server-static.test.mjs`, `tmp-tests/photo-intake-bling-routes.test.mjs` e `tmp-tests/smartphone-photo-intake-core.test.cjs`.

**Interfaces:**
- Produces:
  - `finalizePhotoIntake(connection, intakeId, { sku?, headers?, locationId? })` → `{ intake, product_id, parent_id, unit_id, idempotent, created: { family:boolean, variation:boolean } }`, ou lança `Error` com `statusCode` 4xx e as mensagens de hoje;
  - `runCatalogEntry(..., { requestHeaders })`;
  - `deps.finalizePhotoIntake`.

- [ ] **Step 1: Write the failing tests:**
  - linha de foto pronta → a prévia devolve PlanLine sem erro e o pré-cadastro continua com o status anterior;
  - confirmação → pré-cadastro `completed`, unidade com `intake_id` e o `location_id` informado;
  - pré-cadastro já concluído → erro "Este aparelho da fila de foto já foi salvo.";
  - mesmo `photo_intake_id` em duas linhas → erro na segunda, nada gravado;
  - preços não confirmados → erro "Confirme os preços antes de salvar";
  - lote misto foto + manual do mesmo modelo/cor/memória → uma variação só;
  - a rota antiga continua respondendo igual (teste com `fastify.inject` e o banco falso, ou o estático existente);
  - `vps_server.js` e `vps_server.cjs` repassam `finalizePhotoIntake` e `requestHeaders` (asserção estática).
- [ ] **Step 2: Run** `NODE_PATH=/home/claude/nm/node_modules node --test tmp-tests/catalog-entry-photo.test.cjs`. Expected: FAIL.
- [ ] **Step 3: Implement** a extração sem mudar a lógica (mover, não reescrever), a integração na porta única e a fiação no servidor.
- [ ] **Step 4: Run:**
  - os testes da etapa;
  - `tmp-tests/catalog-entry-*.test.cjs` + `tmp-tests/catalog-entry-units-guard-static.test.mjs`;
  - os testes de foto listados;
  - `node --check vps_server.js && node --check vps_server.cjs`.
  
  Expected: PASS.
- [ ] **Step 5: Commit** `feat(entrada): finalizacao de foto pela porta unica`.

### Task 2: Aba Foto

**Files:**
- Modify: `pages/admin/products/SmartphonePhotoIntakePage.tsx`. Props opcionais `embedded?: boolean` e `onSendToList?: (intake) => void`.
  - **Embutida:** sem o cabeçalho e o botão "Voltar" da página; o botão de finalizar do card vira "Enviar para a lista" (`onFinalize` chama `onSendToList(selected)`); nenhuma chamada a `smartphonePhotoIntakeService.finalize`.
  - **Sem as props:** comportamento idêntico ao de hoje.
- Modify: `components/products/photo-intake/PhotoIntakeReviewCard.tsx`, se o texto do botão precisar vir de prop (`finalizeLabel`).
- Create: `components/entrada/PhotoEntryTab.tsx`:
  - renderiza a página embutida e cria a linha `{ source:'foto', photo_intake_id, label }` (rótulo: marca · modelo · RAM/armazenamento · cor · IMEI final);
  - não adiciona se o mesmo `photo_intake_id` já está na lista;
  - recarrega a fila quando o lote é confirmado: a página Entrada expõe um contador de confirmações, ou a aba recarrega ao ficar visível.
- Modify: `components/entrada/entryList.js`. `hasIdentity` ou nova `hasPhotoIntake(state, id)`.
- Modify: `pages/admin/entrada/CatalogEntryPage.tsx`. Troca o `ComingSoon` da Foto pela aba.
- Test: `tmp-tests/entrada-photo-browser.test.mjs`, além dos testes estáticos existentes da página de foto, que devem continuar passando.

- [ ] **Step 1: Write the failing browser test** (stub de `smartphonePhotoIntakeService` com uma fila de 2 pré-cadastros: um pronto e um concluído):
  - a aba mostra a fila;
  - selecionar o pronto mostra "Enviar para a lista" e não chama `finalize`;
  - clicar adiciona 1 linha `source:'foto'` com o `photo_intake_id` e o rótulo;
  - clicar de novo não duplica (mostra "Já está na lista");
  - depois de uma confirmação simulada, a fila é recarregada (`list` chamado de novo);
  - a página antiga sem props mantém o texto e o comportamento atuais (estático).
- [ ] **Step 2: Run** `node --test tmp-tests/entrada-photo-browser.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** todos os `tmp-tests/entrada-*.test.mjs`, os testes estáticos de foto (`tmp-tests/smartphone-photo-intake-navigation-static.test.mjs`, `photo-intake-*.test.mjs`) e `npm run build`. Expected: PASS / build ok.
- [ ] **Step 5: Commit** `feat(entrada): aba Foto`.

### Task 3: Versão e publicação (controller, `publicar.md`)
- [ ] `v1.2.801-entrada-foto`: API (`--catalog-entry-only`, enviando também `services/smartphonePhotoIntakeServer.cjs`; conferir a lista de arquivos da opção de deploy e incluir o módulo se faltar) + site.
- [ ] Antes do deploy: o `server.js` remoto bate com o repositório anterior, e os módulos enviados são iguais aos do servidor, exceto os desta versão.
- [ ] Verificar: `/status`, prévia com linha de foto inválida → erro de linha, rota antiga de finalização com id inexistente → 404, `/admin/entrada?aba=foto` → 200. Registrar, fazer push e limpar.
