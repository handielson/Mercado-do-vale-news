# Entrada única: etapa 3 (aba Planilha) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aba **Planilha** na tela `/admin/entrada`. Ela baixa o modelo de planilha da Entrada, lê o arquivo `.xlsx` e põe cada linha válida na Lista de entrada; as linhas com problema são mostradas com o motivo.

**Architecture:**
- A conversão linha → item fica num módulo JS puro (`components/entrada/spreadsheetRows.js`), testado com `node:test`. Ele cuida de:
  - cabeçalhos com e sem acento ou maiúsculas;
  - modelo, local e categoria por nome;
  - condição;
  - dinheiro no formato brasileiro;
  - IMEI.
- A aba (`components/entrada/SpreadsheetEntryTab.tsx`) usa `utils/excel.ts` (`readExcelObjects`, `writeExcelRows`) e entrega as linhas para a lista pelo mesmo `onAddLines` das outras abas.
- O servidor não muda: a prévia da Lista de entrada continua sendo a conferência final.

**Tech Stack:** React 18 + TS + Vite, `read-excel-file`/`write-excel-file` (já no projeto, via `utils/excel.ts`), `react-dropzone` (já usado em `BulkUploadForm`), `node:test`, Playwright (padrão de `tmp-tests/entrada-*.test.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-05-entrada-unica-design.md` (§4.2 Planilha; etapa 3 da §6).

## Global Constraints
- **Planilha própria da Entrada (ruling):** o modelo atual do Cadastro em massa também edita produto (ações update/upsert), e a tela única é só de entrada (decisão do usuário). Por isso a aba usa um modelo próprio, com estas colunas e nesta ordem: `Modelo, Categoria, Nome, RAM, Armazenamento, Versão, Condição, Observação, Cor, IMEI 1, IMEI 2, Serial, Quantidade, Custo, Local, Varejo, Revenda, Atacado`. A tela antiga de Cadastro em massa não muda nesta etapa.
- **Item gerado:** mesmo formato da Manual (`source:'planilha'`). Ao reconhecer, cabeçalhos ignoram acento, maiúsculas e espaços (ex.: "imei1", "IMEI 1" e "Imei-1" valem).
- **Modelo:** por nome exato, ignorando acento e maiúsculas, entre os modelos de `modelService.list()`; um ID de modelo também é aceito. Nome achado em mais de um modelo → problema na linha.
- **Sem modelo:** exige `Categoria` + `Nome` (categoria pelo nome em `categoryService.list()`), que viram `category_id` + `name`.
- **Local:** pelo nome ou código em `stockLocationService.listLocations()`. Coluna vazia usa o local padrão (`is_default`); sem local → problema na linha.
- **Condição:** Novo/novo/vazio → `new`, Seminovo → `seminovo`, Usado → `used`, "Caixa aberta" → `open_box`; outro valor → problema.
- **Dinheiro:** "1.299,00", "1299,00", "1299.00", "1299" e número da planilha (1299 ou 1299.5) → centavos inteiros. Inválido → problema na linha.
- **IMEI:** só dígitos. A validade (15 dígitos + Luhn) é conferida pela mesma função `isValidImei` de `components/entrada/entryList.js`. Linha com IMEI ou serial → quantidade 1.
- **Versão:** vazia → "Global".
- **Preços:** `prices` só quando os três (Varejo, Revenda, Atacado) estão preenchidos; um ou dois preenchidos → problema "Informe varejo, revenda e atacado juntos.".
- **Limite:** até 500 linhas por arquivo (o mesmo do servidor). Acima disso, nenhuma linha é adicionada e aparece "Planilha acima de 500 linhas.".
- Textos em português com acento.

## Review Focus
1. **Planilha exportada do Excel com IMEI como número** (`8.63715E+14` ou `863715061138763` numérico): o número inteiro vira o texto exato; notação científica vira problema "IMEI ilegível (formate a coluna como texto)". → teste na Task 1.
2. **Arquivo sem cabeçalho reconhecido ou de outro modelo** (ex.: o template antigo do Cadastro em massa): mensagem clara "Esta planilha não é o modelo da Entrada. Baixe o modelo." e nenhuma linha adicionada. → teste na Task 1.
3. **Linhas em branco no meio:** ignoradas e sem erro. → teste na Task 1.
4. **Mesmo IMEI repetido no arquivo:** fica para a prévia do servidor (já cobre), mas a aba avisa antes de adicionar ("IMEI repetido no arquivo (linhas X e Y)"). → teste na Task 1.
5. **Reenviar o mesmo arquivo:** as linhas cujo IMEI ou serial já está na lista não são adicionadas de novo e entram no resumo como "já na lista". → teste na Task 2.

---

### Task 1: Conversão da planilha (`spreadsheetRows.js`)

**Files:**
- Create: `components/entrada/spreadsheetRows.js`
- Test: `tmp-tests/entrada-spreadsheet-rows.test.mjs`

**Interfaces:**
- Consumes: `isValidImei`, `createLine` de `components/entrada/entryList.js`.
- Produces:
  - `ENTRY_TEMPLATE_HEADERS: string[]`, com as 18 colunas na ordem dos Global Constraints;
  - `templateExampleRows(): Record<string,any>[]`, com 2 exemplos: um celular seminovo com IMEI e um acessório com quantidade;
  - `parseMoney(value): number|null|undefined`, que devolve centavos, `undefined` para vazio e `null` para inválido;
  - `rowsToLines(records: Record<string,any>[], ctx: { models: {id,name}[], categories: {id,name}[], locations: {id,name,code,is_default}[] }): { lines: Line[], issues: {row:number, message:string}[], fatal?: string }`. `row` é o número da linha da planilha: cabeçalho = 1, primeiro dado = 2.

- [ ] **Step 1: Write the failing tests:**
  - `parseMoney`: `'1.299,00'`→129900, `'1299,00'`→129900, `'1299.00'`→129900, `'1299'`→129900, `1299.5`→129950, `''`→undefined, `'abc'`→null.
  - Cabeçalhos "imei 1", "IMEI1" e "Imei-1" são reconhecidos.
  - Modelo "redmi 15" acha o "Redmi 15"; dois modelos com o mesmo nome → issue "Modelo \"Redmi 15\" encontrado mais de uma vez; use o ID do modelo.".
  - Sem modelo e com Categoria + Nome → `category_id` + `name`. Sem modelo e sem categoria → issue "Informe o modelo ou a categoria e o nome.".
  - Condições "Seminovo", "usado", "Caixa aberta", vazio e "ok" → seminovo, used, open_box, new e issue "Condição inválida: ok".
  - Local por código e por nome; vazio → o local padrão; sem padrão → issue "Escolha o local de estoque.".
  - IMEI numérico 863715061138763 → `'863715061138763'`; `'8.63715E+14'` → issue "IMEI ilegível (formate a coluna como texto)"; IMEI inválido → issue "IMEI 1 inválido.".
  - O mesmo IMEI nas linhas 2 e 4 → issue nas duas: "IMEI repetido no arquivo (linhas 2 e 4)".
  - Só 1 ou 2 preços → issue "Informe varejo, revenda e atacado juntos.".
  - Linha em branco ignorada.
  - Arquivo cujos cabeçalhos não têm Modelo nem Nome → `fatal` "Esta planilha não é o modelo da Entrada. Baixe o modelo.".
  - 501 linhas → `fatal` "Planilha acima de 500 linhas.".
  - Linhas válidas viram `Line` com `source:'planilha'` e item igual ao da Manual (inclui `version:'Global'` quando vazia e `quantity:1` com IMEI).
- [ ] **Step 2: Run** `node --test tmp-tests/entrada-spreadsheet-rows.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** (ESM puro, sem React).
- [ ] **Step 4: Run** o teste + `node --test tmp-tests/entrada-entry-list.test.mjs`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(entrada): conversao da planilha de entrada`.

### Task 2: Aba Planilha

**Files:**
- Create: `components/entrada/SpreadsheetEntryTab.tsx`
- Modify: `pages/admin/entrada/CatalogEntryPage.tsx` (troca o `ComingSoon` da Planilha pela aba)
- Test: `tmp-tests/entrada-spreadsheet-browser.test.mjs`

**Interfaces:**
- Consumes:
  - Task 1;
  - `readExcelObjects(file)` e `writeExcelRows(fileName, rows, headers)` de `utils/excel.ts`;
  - `modelService.list()`, `categoryService.list()`, `stockLocationService.listLocations()`;
  - `hasIdentity` de `entryList.js`.
- Produces: `SpreadsheetEntryTab({ onAddLines, existingState, busy })`.

- [ ] **Step 1: Write the failing browser test** (stubs: `utils/excel` devolve `window.excelRows` e grava `window.writtenTemplate`; serviços como em `tmp-tests/entrada-fixtures.mjs`):
  - "Baixar modelo da planilha" chama `writeExcelRows('modelo_entrada.xlsx', exemplos, ENTRY_TEMPLATE_HEADERS)`;
  - enviar um arquivo com 3 linhas válidas e 1 com problema mostra "3 linhas prontas" e a tabela de problemas (linha e motivo), com o botão "Adicionar 3 linhas à lista";
  - clicar adiciona 3 linhas (`source:'planilha'`) e limpa a aba;
  - com `fatal`, mostra a mensagem e nenhum botão de adicionar;
  - reenviar o mesmo arquivo com essas linhas já na lista: "0 linhas prontas", "3 já estão na lista";
  - com `busy`, o botão de adicionar fica desabilitado.
- [ ] **Step 2: Run** `node --test tmp-tests/entrada-spreadsheet-browser.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** a aba (dropzone `.xlsx`, carregar modelos/categorias/locais uma vez, resumo, tabela de problemas) e ligue-a na página.
- [ ] **Step 4: Run** todos os `tmp-tests/entrada-*.test.mjs` + `npm run build`. Expected: PASS / build ok.
- [ ] **Step 5: Commit** `feat(entrada): aba Planilha`.

### Task 3: Versão e publicação (controller, `publicar.md`)
- [ ] `v1.2.799-entrada-planilha` com `status: publicada` já no build; `VERSAO_ATUAL.md` e `docs/versoes/…`; commit, tag e push.
- [ ] Build no PC (sem Supabase), site com `VPS_SITE_SKIP_BUILD=1` e `VPS_SITE_RELEASE_NAME`. API e nginx não mudam: conferir que o `npm run build` não alterou `infra/nginx`.
- [ ] Verificar `/VERSION.json` e `/admin/entrada?aba=planilha` (200), registrar a publicação, push e limpar as chaves.
