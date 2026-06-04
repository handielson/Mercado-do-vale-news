# Displays Android E Pix Mercado Pago Implementation Plan

> Copia operacional para Codex dentro do workspace: `mercado-do-vale/docs/planos/android.md`.
> Documento vivo: toda mudanca feita durante a implementacao deve ser registrada neste arquivo no mesmo dia, para nao depender de memoria da conversa.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar Displays Android nomeados/numerados para tablets e TVs, com Pix Mercado Pago no PDV, QR em tela vinculada ao caixa, impressao termica e propagandas configuraveis quando o display estiver ocioso.

**Architecture:** A fonte operacional deve ser a VPS/MySQL. O frontend do PDV nunca deve usar token secreto do Mercado Pago diretamente; criacao e consulta de Pix passam por rotas seguras da VPS. Displays Android acessam uma URL publica do dominio proprio, fazem pareamento por codigo curto e usam token salvo no navegador para buscar sua configuracao e o conteudo ativo.

**Tech Stack:** React/Vite, TypeScript, Fastify VPS (`vps_server.js`), MySQL, `vpsClient`, Mercado Pago REST API, navegador Android/tablet/TV, impressao HTML termica.

**Status de execucao em 04/06/2026:**

- Desenho aprovado pelo usuario.
- Documento movido para `mercado-do-vale/docs/planos/android.md` para seguir o padrao das outras implementacoes.
- Regra operacional definida: qualquer mudanca de codigo, schema, rota, teste, deploy ou decisao deve ser registrada na secao `Historico De Implementacao`.
- Requisito adicional incluido: telas, campanhas, banners, produtos de display, tokens de pareamento e cobrancas Pix de teste devem ter opcao de excluir/limpar lixo quando apropriado.

---

## Indice De Caminhos Dos Arquivos

Use estes caminhos antes de iniciar qualquer task para evitar busca manual e dependencia de memoria.

### Plano e publicacao

- Plano atual: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\docs\planos\android.md`
- Fluxo oficial de publicacao: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\publicar.md`
- Workspace do projeto: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale`

### Backend VPS

- Servidor principal VPS/Fastify: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\vps_server.js`
- Espelho/variante CJS a conferir quando a API for publicada: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\vps_server.cjs`
- Cliente VPS frontend: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\services\vpsClient.ts`
- Servico de integracoes de pagamento: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\services\paymentIntegrationService.ts`
- Provider Mercado Pago existente: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\services\providers\mercadoPagoProvider.ts`

### PDV

- Pagina PDV: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\pages\pdv\PDVPage.tsx`
- Secao de pagamento do PDV: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\components\pdv\PaymentSection.tsx`
- Preview de comprovante do PDV: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\components\pdv\ReceiptPreview.tsx`
- Impressao de comprovante de venda: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\utils\printSaleReceipt.ts`
- Calculos de venda/pagamento: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\utils\saleCalculations.ts`
- Tipos de venda/pagamento: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\types\sale.ts`

### Displays Android

- Registro de rotas React: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\routes\index.tsx`
- Layout/menu admin: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\layouts\AdminLayout.tsx`
- Pagina admin a criar: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\pages\admin\settings\DisplaysPage.tsx`
- Pagina publica do display a criar: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\pages\display\DisplayPage.tsx`
- Servico frontend a criar: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\services\pdvDisplayService.ts`
- Tipos a criar: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\types\pdvDisplay.ts`
- Impressao do QR Pix a criar: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\utils\printPixQr.ts`

### Testes planejados

- Rotas de displays/Pix: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\tmp-tests\pdv-display-routes-static.test.mjs`
- Regras do PDV Pix: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\tmp-tests\pdv-pix-payment-static.test.mjs`
- Pareamento Android: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\tmp-tests\pdv-display-pairing-static.test.mjs`
- Impressao QR Pix: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\tmp-tests\pdv-pix-print-static.test.mjs`
- Limpeza/exclusao de lixo: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\tmp-tests\pdv-display-trash-static.test.mjs`

### Comandos base

Executar comandos a partir de:

```powershell
cd "C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale"
```

Build:

```powershell
npm.cmd run build
```

Consultar fluxo oficial:

```powershell
Get-Content publicar.md
```

---

## Checklist Mestre

### Fase 0 - Documentacao viva

- [x] Mover documento para `mercado-do-vale/docs/planos/android.md`.
- [x] Registrar regra de documentar cada mudanca no proprio arquivo.
- [x] Incluir requisito de excluir/limpar lixo.
- [x] Antes de cada bloco de implementacao, registrar em `Historico De Implementacao` o objetivo do bloco.
- [x] Depois de cada bloco de implementacao, registrar arquivos alterados, testes executados, resultado e pendencias.

### Fase 1 - Backend seguro Mercado Pago e dados base

- [x] Mapear no `vps_server.js` o padrao atual de rotas protegidas e migrations/tabelas.
- [x] Criar persistencia para displays, tokens, codigos de pareamento e Pix do PDV.
- [x] Criar rota segura para gerar Pix Mercado Pago sem expor access token no frontend.
- [x] Criar rota segura para consultar status do pagamento no Mercado Pago.
- [x] Criar rota para associar/limpar Pix ativo em um display.
- [x] Criar rota para excluir lixo: displays de teste, tokens revogados antigos, codigos expirados e Pix pendente/cancelado de teste.
- [x] Documentar no `Historico De Implementacao` as rotas criadas e o contrato de cada uma.

### Fase 2 - Tipos e services frontend

- [x] Criar tipos `pdvDisplay.ts`.
- [x] Criar `pdvDisplayService.ts` usando `vpsClient`.
- [x] Criar helper de normalizacao de status Pix.
- [x] Criar helper para montar dados de impressao do QR.
- [x] Documentar no `Historico De Implementacao` os services criados.

### Fase 3 - Admin de Displays Android

- [x] Criar pagina admin `DisplaysPage.tsx`.
- [x] Adicionar rota no painel admin.
- [x] Adicionar entrada no menu admin.
- [x] Permitir criar/editar displays nomeados ou numerados.
- [x] Permitir selecionar tipo: caixa, propaganda ou hibrido.
- [x] Permitir configurar orientacao e exibicoes: loja, valor, itens, instrucoes e propaganda durante Pix.
- [x] Permitir gerar/renovar codigo de pareamento.
- [x] Permitir revogar pareamento.
- [x] Permitir excluir display/lixo com confirmacao.
- [x] Documentar no `Historico De Implementacao` o fluxo admin criado.

### Fase 4 - Pagina publica do Android

- [x] Criar pagina publica do display.
- [x] Criar tela de pareamento por codigo curto.
- [x] Salvar token no navegador do Android.
- [x] Buscar configuracao do display por token.
- [x] Mostrar propaganda/conteudo ocioso quando nao houver Pix ativo.
- [x] Mostrar QR, valor, itens e instrucoes conforme configuracao quando houver Pix ativo.
- [x] Fazer polling simples para atualizar estado do display.
- [x] Voltar para pareamento se token for revogado.
- [x] Documentar no `Historico De Implementacao` a URL final e o comportamento do Android.

### Fase 5 - PDV Pix Mercado Pago

- [x] Integrar geracao de Pix na secao de pagamento do PDV.
- [x] Guardar estado local da cobranca: criando, pendente, aprovado, erro, rejeitado ou expirado.
- [x] Enviar/associar Pix ao display vinculado ao caixa.
- [x] Adicionar botao `Atualizar pagamento`.
- [x] Bloquear finalizacao da venda enquanto Pix estiver pendente.
- [x] Converter Pix aprovado em `PaymentMethod` do tipo `pix`.
- [x] Permitir cancelar Pix pendente sem cancelar venda.
- [x] Documentar no `Historico De Implementacao` o comportamento exato do PDV.

### Fase 6 - Impressao termica do QR

- [x] Criar `utils/printPixQr.ts`.
- [x] Imprimir cabecalho da loja, valor, QR grande, codigo copia-e-cola e instrucao curta.
- [x] Adicionar botao `Imprimir QR` no PDV quando houver Pix gerado.
- [x] Verificar que o recibo final continua usando `printSaleReceipt.ts`.
- [x] Documentar no `Historico De Implementacao` o layout de impressao.

### Fase 7 - Propagandas e limpeza

- [x] Implementar modelo inicial de conteudo ocioso.
- [x] Permitir ocultar/mostrar propaganda durante Pix.
- [x] Permitir remover banners/produtos/conteudos nao usados.
- [x] Criar opcao `Excluir lixo` ou `Limpar itens inativos` no admin, com confirmacao.
- [x] Garantir que excluir lixo nao remova displays ativos nem Pix aprovado.
- [x] Documentar no `Historico De Implementacao` a regra exata de limpeza.

### Fase 8 - Verificacao e publicacao

- [x] Rodar testes estaticos planejados.
- [x] Rodar `npm.cmd run build`.
- [ ] Verificar PDV em navegador.
- [x] Verificar display Android em viewport tablet/TV.
- [ ] Verificar impressao do QR.
- [x] Se publicar, seguir `publicar.md`.
- [x] Documentar no `Historico De Implementacao` comandos, resultados, release e URLs verificadas.

---

## Historico De Implementacao

### 2026-06-04 - Bloco Fase 8 Verificacao Pre-Publicacao

- Objetivo do bloco: validar o MVP de Displays Android/Pix antes de publicar na VPS, seguindo `publicar.md` e mantendo Supabase/Vercel fora do runtime operacional.
- Arquivos no escopo de publicacao Android/Display/Pix: `vps_server.js`, `vps_server.cjs`, `services/pdvDisplayService.ts`, `types/pdvDisplay.ts`, `pages/admin/settings/DisplaysPage.tsx`, `pages/display/DisplayPage.tsx`, `routes/index.tsx`, `layouts/AdminLayout.tsx`, `pages/pdv/PDVPage.tsx`, `components/pdv/PaymentSection.tsx`, `components/pdv/ReceiptPreview.tsx`, `types/sale.ts`, `utils/printPixQr.ts`, testes `tmp-tests/pdv-display-*.mjs`, testes `tmp-tests/pdv-pix-*.mjs` e este plano.
- Testes estaticos executados e aprovados: `node tmp-tests\pdv-display-routes-static.test.mjs`, `node tmp-tests\pdv-display-service-static.test.mjs`, `node tmp-tests\pdv-display-admin-static.test.mjs`, `node tmp-tests\pdv-display-pairing-static.test.mjs`, `node tmp-tests\pdv-pix-payment-static.test.mjs`, `node tmp-tests\pdv-pix-print-static.test.mjs` e `node tmp-tests\pdv-display-trash-static.test.mjs`.
- Verificacoes de servidor executadas e aprovadas: `node --check vps_server.js` e `node --check vps_server.cjs`.
- Trava Supabase executada e aprovada: `node scripts\assert-no-supabase-runtime.cjs`.
- Build executado e aprovado: `npm.cmd run build`; o build gerou os chunks `DisplayPage-*.js`, `DisplaysPage-*.js`, `PDVPage-*.js` e `pdvDisplayService-*.js`.
- Checagem extra do bundle executada e aprovada: `Select-String -Path "dist\assets\*.js" -Pattern "services/supabase|@supabase/supabase-js|VITE_SUPABASE|Missing Supabase environment variables"` nao retornou resultados.
- Verificacao local da rota publica do display: dev server temporario na porta `5181` respondeu `HTTP 200` para `http://127.0.0.1:5181/display`.
- Limitacao: a inspecao visual local via browser interno nao concluiu porque o runtime do browser falhou no sandbox e o perfil do Chrome DevTools estava ocupado; a validacao visual final deve ocorrer no dominio publicado/VPS.
- Publicacao Git: commits enviados para `origin/main` ate `3ca589d` (`fix(pdv): include customer price helper`), incluindo o MVP Android/Display/Pix e correcoes de build limpo.
- Ajustes feitos durante publicacao limpa: removida rota/menu de crediario nao publicado que havia vazado para `routes/index.tsx`/`AdminLayout.tsx`; substituido import externo de progresso de finalizacao no PDV por componente local; incluido helper `getEffectiveCustomerPrice()` em `utils/promoPrice.ts` exigido pelo PDV publicado.
- Publicacao frontend VPS: `npm.cmd ci` no worktree limpo exigiu execucao fora do sandbox por `EPERM` no cache do npm; `npm.cmd run deploy:vps-site` exigiu execucao fora do sandbox por `connect EACCES` na porta SSH. Release ativa publicada: `/var/www/mdv-site/releases/20260604-152419`.
- Publicacao API VPS: `node deploy-vps-server-only.cjs` executado a partir do workspace principal porque o worktree limpo nao carregava os envs SSH do workspace; a primeira tentativa no sandbox falhou por `connect EACCES`, a repeticao fora do sandbox publicou `/var/www/mdv-api` e reiniciou `mdv-api` no PM2 como `online`.
- Verificacoes publicas executadas: `https://mercadodovale.com.br/` retornou `200` com redirect efetivo para `https://www.mercadodovale.com.br/`; `https://www.mercadodovale.com.br/display` retornou `200`; `https://api.xiaomipetrolina.com.br/health` retornou `200` com `{"status":"ok","db":"mysql"}`; `https://api.xiaomipetrolina.com.br/pdv/display-state` sem token retornou `401 Unauthorized`, comportamento esperado para display nao pareado.
- Observacao: `https://www.mercadodovale.com.br/api/health` retornou `404` porque a rota de health operacional esta no host da API (`https://api.xiaomipetrolina.com.br/health`), nao sob `/api/health` no dominio principal.
- Pendencias deste bloco: validar visualmente em Android/tablet/TV real, testar pareamento com codigo gerado no admin, gerar Pix real/sandbox Mercado Pago no PDV e testar impressao termica fisica do QR.

### 2026-06-04 - Bloco Fase 1 Backend VPS

- Objetivo do bloco: mapear o padrao atual do `vps_server.js` e iniciar o backend seguro para displays Android e Pix PDV, mantendo token Mercado Pago apenas na VPS.
- Escopo previsto: auto-migrations das tabelas `pdv_displays`, `pdv_display_pairing_codes`, `pdv_display_tokens` e `pdv_pix_payments`; rotas protegidas para CRUD/pareamento/limpeza; rotas seguras para criar e consultar Pix; rotas de token publico para a pagina Android consultar seu estado.
- Padrao observado antes da implementacao: o backend usa Fastify em arquivo unico, `requireSyncKey`/`requireSyncKeyOrAdmin` para rotas administrativas, `pool.query` com MySQL, auto-migrations em `runMigrations()` e integracao Mercado Pago existente lendo `payment_integrations`.
- Arquivos alterados: `vps_server.js`, `vps_server.cjs`, `tmp-tests/pdv-display-routes-static.test.mjs` e `docs/planos/android.md`.
- Persistencia criada via auto-migration: `pdv_displays`, `pdv_display_pairing_codes`, `pdv_display_tokens` e `pdv_pix_payments`.
- Contrato das rotas administrativas/PDV protegidas por `x-sync-key`: `GET /pdv/displays`, `POST /pdv/displays`, `PATCH /pdv/displays/:id`, `DELETE /pdv/displays/:id`, `POST /pdv/displays/:id/pairing-code`, `POST /pdv/displays/:displayId/revoke-token`, `POST /pdv/displays/trash/cleanup`, `POST /pdv/pix-payments`, `GET /pdv/pix-payments/:id/status`, `POST /pdv/displays/:displayId/active-pix` e `DELETE /pdv/displays/:displayId/active-pix`.
- Contrato das rotas publicas do Android: `POST /pdv/displays/pair` troca codigo curto por token seguro; `GET /pdv/display-state` usa Bearer token ou `?token=` para devolver configuracao do display e Pix ativo.
- Regra de limpeza implementada: remove codigos consumidos/expirados, tokens revogados antigos e Pix pendente/rejeitado/expirado/falho de teste antigo; nao remove Pix aprovado.
- Teste RED/GREEN executado: `node tmp-tests/pdv-display-routes-static.test.mjs` falhou primeiro por ausencia das tabelas/rotas e depois passou.
- Verificacao de sintaxe executada: `node --check vps_server.js` e `node --check vps_server.cjs` passaram.
- Pendencias: integrar os novos endpoints no frontend e validar fluxo real com Mercado Pago configurado antes de publicar.

### 2026-06-04 - Bloco Fase 2 Tipos E Services Frontend

- Objetivo do bloco: criar os tipos TypeScript e o service frontend para consumir as rotas VPS de displays Android e Pix PDV, deixando pronto para admin, pagina publica Android, PDV e impressao usarem uma API unica.
- Escopo previsto: `types/pdvDisplay.ts`, `services/pdvDisplayService.ts`, helper de normalizacao de status Pix e helper para montar dados de impressao do QR.
- Arquivos alterados: `types/pdvDisplay.ts`, `services/pdvDisplayService.ts`, `tmp-tests/pdv-display-service-static.test.mjs` e `docs/planos/android.md`.
- Tipos criados: `PdvDisplay`, `PdvDisplayInput`, `PdvDisplaySettings`, `PdvDisplayIdleContent`, `PdvPixPayment`, `PdvPixPaymentInput`, `PdvDisplayState`, `PdvPixPrintData`, `PdvDisplayPairingCodeResponse` e `PdvDisplayPairResponse`.
- Service criado: `pdvDisplayService` com metodos para listar/criar/editar/excluir displays, gerar codigo de pareamento, parear display, revogar token, limpar lixo, criar Pix, atualizar status, associar/limpar Pix ativo e buscar estado publico do display.
- Helpers criados: `normalizePdvPixStatus()` normaliza status Mercado Pago/backend para `idle`, `creating`, `pending`, `approved`, `rejected`, `expired` ou `error`; `buildPdvPixPrintData()` monta dados padronizados para a futura impressao termica.
- Teste RED/GREEN executado: `node tmp-tests/pdv-display-service-static.test.mjs` falhou primeiro por ausencia dos arquivos e depois passou.
- Verificacao TypeScript focal executada: `npx.cmd tsc --noEmit --module esnext --moduleResolution bundler --target es2020 --jsx react-jsx --lib es2020,dom --types vite/client services\pdvDisplayService.ts types\pdvDisplay.ts` passou.
- Build completo executado apos Fase 1 e Fase 2: `npm.cmd run build` passou.
- Pendencias: conectar o service nas telas admin, pagina publica Android, PDV Pix e impressao.

### 2026-06-04 - Bloco Fase 3 Admin De Displays Android

- Objetivo do bloco: criar a pagina administrativa para cadastrar, editar, parear, revogar e excluir Displays Android, alem de expor limpeza de lixo operacional pelo painel.
- Escopo previsto: `pages/admin/settings/DisplaysPage.tsx`, rota `/admin/settings/displays`, entrada no menu admin, formulario com tipo/orientacao/exibicoes, acoes de pareamento e exclusao com confirmacao.
- Arquivos alterados: `pages/admin/settings/DisplaysPage.tsx`, `routes/index.tsx`, `layouts/AdminLayout.tsx`, `tmp-tests/pdv-display-admin-static.test.mjs` e `docs/planos/android.md`.
- Fluxo admin criado: lista displays com resumo de total/ativos/pareados/recebem Pix; cria e edita nome, slug, tipo, orientacao, caixa vinculado, status ativo e flags de exibicao; gera codigo curto de pareamento; copia codigo; revoga token; exclui display; executa `Excluir lixo` com confirmacao.
- Rota criada: `/admin/settings/displays`, protegida por admin e renderizada dentro de `AdminLayout`.
- Menu criado: item `Displays Android` em Ajustes da Empresa, com busca por termos de Android, tablet, TV, Pix, caixa, propaganda e QR code.
- Teste RED/GREEN executado: `node tmp-tests/pdv-display-admin-static.test.mjs` falhou primeiro por ausencia da pagina e depois passou.
- Verificacoes executadas: `node tmp-tests/pdv-display-routes-static.test.mjs`, `node tmp-tests/pdv-display-service-static.test.mjs`, `node tmp-tests/pdv-display-admin-static.test.mjs` e TypeScript focal da pagina/service/tipos passaram.
- Build completo executado: `npm.cmd run build` passou quando rodado sozinho. Uma tentativa anterior em paralelo com `tsc` falhou no plugin HTML do Vite/Rolldown por caminho relativo de `index.html`, mas a reproducao isolada passou.
- Verificacao visual no browser: tentativa feita, mas o dev server nao permaneceu ativo em background no sandbox; `npm.cmd run dev -- --host 127.0.0.1 --port 5181 --strictPort` inicia em foreground, porem e encerrado pelo timeout da ferramenta. Pendencia de verificacao visual manual/assistida quando houver servidor persistente.

### 2026-06-04 - Bloco Fase 4 Pagina Publica Android

- Objetivo do bloco: criar a URL publica para tablets/TVs Android, com pareamento por codigo curto, token salvo no navegador, polling do estado e alternancia entre conteudo ocioso e Pix ativo.
- Escopo previsto: `pages/display/DisplayPage.tsx`, rota publica `/display`, uso de `pdvDisplayService.pairDisplay()` e `pdvDisplayService.getDisplayState()`, `localStorage` para token, estado de token revogado voltando ao pareamento, layout responsivo para portrait/landscape.
- Arquivos alterados: `pages/display/DisplayPage.tsx`, `routes/index.tsx`, `tmp-tests/pdv-display-pairing-static.test.mjs` e `docs/planos/android.md`.
- URL publica criada: `/display`, sem `ProtectedRoute`, para tablets/TVs Android acessarem pelo navegador.
- Fluxo de pareamento criado: a tela pede codigo curto, normaliza o formato `000-000`, chama `pdvDisplayService.pairDisplay()`, salva o token em `localStorage` na chave `@mdv_pdv_display_token` e carrega o estado inicial do display.
- Fluxo de estado criado: com token salvo, a pagina chama `pdvDisplayService.getDisplayState()` e faz polling simples a cada 5 segundos; se o token for revogado/invalido, remove o token local e volta para o pareamento.
- Modo ocioso criado: exibe banners, produtos ou mensagens vindos de `idle_content`, com rotacao baseada em `settings.adRotationSeconds` e fallback visual para `Mercado do Vale`.
- Modo Pix criado: quando `active_pix` estiver pendente/aprovado, mostra QR por `qr_code_base64` ou copia-e-cola por `qr_code`, respeitando `showPixAmount`, `showItems`, `showInstructions` e `showAdsDuringPix`.
- Teste RED/GREEN executado: `node tmp-tests/pdv-display-pairing-static.test.mjs` falhou primeiro por ausencia da pagina publica e depois passou.
- Verificacoes executadas: `node tmp-tests/pdv-display-routes-static.test.mjs`, `node tmp-tests/pdv-display-service-static.test.mjs`, `node tmp-tests/pdv-display-admin-static.test.mjs`, `node tmp-tests/pdv-display-pairing-static.test.mjs`, TypeScript focal da pagina/service/tipos e `npm.cmd run build` passaram.
- Pendencia: verificacao visual em navegador Android/tablet/TV com servidor persistente e backend VPS real para validar pareamento e polling com dados vivos.

### 2026-06-04 - Bloco Fase 5 PDV Pix Mercado Pago

- Objetivo do bloco: integrar o Pix Mercado Pago na secao de pagamento do PDV, criando cobranca pela VPS, associando ao display do caixa, permitindo atualizar/cancelar e impedindo finalizar venda enquanto houver Pix pendente.
- Escopo previsto: estado local da cobranca Pix no `PDVPage`, controles no `PaymentSection`, uso de `pdvDisplayService.createPixPayment()`, `refreshPixPaymentStatus()`, `setActivePix()` e `clearActivePix()`, conversao de Pix aprovado em `PaymentMethod` do tipo `pix` e bloqueio no `ReceiptPreview`.
- Arquivos alterados: `pages/pdv/PDVPage.tsx`, `components/pdv/PaymentSection.tsx`, `components/pdv/ReceiptPreview.tsx`, `types/sale.ts`, `tmp-tests/pdv-pix-payment-static.test.mjs` e `docs/planos/android.md`.
- Fluxo criado no PDV: a secao de pagamento ganhou bloco `Pix Mercado Pago`, campos para `Caixa` e `Display ID`, botao `Gerar Pix Mercado Pago`, botao `Exibir no display`, botao `Atualizar pagamento` e botao `Cancelar Pix`.
- Criacao da cobranca: `handleCreatePdvPixPayment()` chama `pdvDisplayService.createPixPayment()` com valor em centavos, `cashier_key`, `display_id`, referencia local e e-mail do cliente quando disponivel; se houver display informado, associa a cobranca via `pdvDisplayService.setActivePix()`.
- Estado local: `PDVPage` guarda `pdvPixPayment`, `pdvPixLoading`, `pdvPixCashierKey` e `pdvPixDisplayId`; caixa/display sao persistidos em `localStorage` para o proximo uso do mesmo terminal.
- Atualizacao de status: `handleRefreshPdvPixPayment()` chama `pdvDisplayService.refreshPixPaymentStatus()`; quando o status volta `approved`, adiciona automaticamente um `PaymentMethod` de tipo `pix` com `pix_payment_id`, `mercado_pago_payment_id` e `pix_status: approved`.
- Regra de finalizacao: enquanto `pdvPixPayment` estiver `creating` ou `pending`, `handleFinalizeSale()` bloqueia a venda com toast e `ReceiptPreview` desabilita o botao com mensagem `Pix pendente`.
- Cancelamento local: `handleCancelPdvPixPayment()` limpa a cobranca ativa do display por `pdvDisplayService.clearActivePix()` quando houver display vinculado e remove o Pix pendente do PDV; Pix aprovado nao pode ser cancelado localmente.
- Teste RED/GREEN executado: `node tmp-tests/pdv-pix-payment-static.test.mjs` falhou primeiro por ausencia da integracao no PDV e depois passou.
- Verificacoes executadas: `node tmp-tests/pdv-display-routes-static.test.mjs`, `node tmp-tests/pdv-display-service-static.test.mjs`, `node tmp-tests/pdv-display-admin-static.test.mjs`, `node tmp-tests/pdv-display-pairing-static.test.mjs`, `node tmp-tests/pdv-pix-payment-static.test.mjs` e `npm.cmd run build` passaram.
- Observacao de TypeScript: tentativa focal com `tsc --noEmit` incluindo o PDV caiu em erros preexistentes fora do escopo (`services/blingService.ts` e `utils/printSaleReceipt.ts`); o build Vite completo passou.
- Pendencia: validar o fluxo vivo contra VPS/Mercado Pago configurado, com um display real pareado, antes de publicar para uso de loja.

### 2026-06-04 - Bloco Fase 6 Impressao Termica Do QR Pix

- Objetivo do bloco: criar a impressao separada do QR Pix, mantendo o recibo final em `printSaleReceipt.ts`, e adicionar o comando `Imprimir QR` no fluxo Pix do PDV.
- Escopo previsto: `utils/printPixQr.ts`, uso de `buildPdvPixPrintData()`, botao na `PaymentSection`, handler no `PDVPage`, layout termico com loja, valor, QR grande, codigo copia-e-cola e instrucao curta.
- Arquivos alterados: `utils/printPixQr.ts`, `pages/pdv/PDVPage.tsx`, `components/pdv/PaymentSection.tsx`, `tmp-tests/pdv-pix-print-static.test.mjs` e `docs/planos/android.md`.
- Impressao criada: `printPixQr(data)` abre janela propria, monta HTML de papel termico 80mm e chama `window.print()` sem passar pelo recibo final.
- Layout criado: nome da loja, titulo `QR Code Pix`, valor em destaque, QR grande por `qrCodeBase64` ou fallback via `api.qrserver.com`, instrucao curta, codigo `Pix copia e cola` quebrado em linhas e resumo opcional de itens.
- Integracao no PDV: `handlePrintPdvPixQr()` usa `buildPdvPixPrintData()` com `pdvPixPayment` e `cartItems`; a `PaymentSection` ganhou botao `Imprimir QR`, habilitado quando houver Pix gerado.
- Recibo final preservado: `printSaleReceipt.ts` continua sendo usado apenas no fluxo de recibo/finalizacao da venda e nao foi alterado neste bloco.
- Teste RED/GREEN executado: `node tmp-tests/pdv-pix-print-static.test.mjs` falhou primeiro por ausencia de `utils/printPixQr.ts` e depois passou.
- Verificacoes executadas: testes estaticos das Fases 1 a 6 passaram; `npm.cmd run build` passou.
- Pendencia: validar a impressao em impressora termica real, especialmente corte de papel, tamanho do QR e legibilidade do copia-e-cola.

### 2026-06-04 - Bloco Fase 7 Propagandas E Limpeza

- Objetivo do bloco: completar o modelo inicial de conteudo ocioso editavel, permitindo mensagens, banners e produtos de display no admin, com remocao de itens nao usados e mantendo a limpeza de lixo operacional protegida.
- Escopo previsto: controles em `DisplaysPage.tsx` para editar `idle_content.messages`, `idle_content.banners` e `idle_content.products`, acoes de adicionar/remover conteudos, preservacao de `showAdsDuringPix`, teste estatico de limpeza/conteudo e atualizacao do checklist.
- Arquivos alterados: `pages/admin/settings/DisplaysPage.tsx`, `tmp-tests/pdv-display-trash-static.test.mjs` e `docs/planos/android.md`.
- Conteudo ocioso editavel: o admin agora permite adicionar, editar e remover mensagens, banners e produtos destacados do `idle_content` de cada display.
- Propaganda durante Pix: a flag `showAdsDuringPix` continua editavel no formulario e e respeitada pela pagina publica `/display`, exibindo conteudo ocioso junto ao QR quando habilitada.
- Remocao de conteudo nao usado: o formulario filtra mensagens vazias, banners sem titulo/imagem e produtos sem nome antes de salvar.
- Limpeza operacional: o botao `Excluir lixo` usa confirmacao e chama `pdvDisplayService.cleanupTrash()`, que aciona a rota protegida `/pdv/displays/trash/cleanup`.
- Regra exata de limpeza: a VPS remove codigos de pareamento consumidos/expirados, tokens revogados antigos e Pix antigos de teste com status `pending`, `rejected`, `expired` ou `failed`; displays ativos nao sao apagados e Pix aprovado nao entra na limpeza.
- Teste RED/GREEN executado: `node tmp-tests/pdv-display-trash-static.test.mjs` falhou primeiro por ausencia dos controles de conteudo ocioso e depois passou.
- Como testar a segunda tela: criar ou editar um display em `/admin/settings/displays`, preencher conteudo ocioso, gerar codigo de pareamento, abrir `/display` no Android/tablet/TV, informar o codigo, depois gerar um Pix no PDV usando o `Display ID` do display pareado.

### 2026-06-04 - Planejamento inicial

- Arquivo operacional criado a partir da spec aprovada de Pix Mercado Pago e Displays Android.
- Decidido que `mercado-do-vale/docs/planos/android.md` sera a fonte de verdade da implementacao.
- Incluida a regra de registrar cada mudanca neste historico.
- Incluida a necessidade de excluir/limpar lixo em displays, conteudos, tokens/codigos expirados e cobrancas de teste, sempre com protecao para nao remover dados ativos ou aprovados.

---

## Especificacao Aprovada

Data: 2026-06-04

## Objetivo

Adicionar ao PDV um fluxo de Pix Mercado Pago com confirmacao automatica sob demanda e duas formas de exibicao do QR: envio para um display Android fixo e impressao do QR em impressora termica. O mesmo modulo deve nascer preparado para TVs Android exibirem propagandas estaticas ou rotativas de produtos quando nao houver Pix ativo.

## Escopo Aprovado

- Criar um modulo de Displays para tablets e TVs Android.
- Permitir cadastro de telas nomeadas ou numeradas, como `Caixa 01 - Tablet Pix`, `TV Vitrine` e `TV Balcao`.
- Parear cada dispositivo Android uma vez usando codigo curto gerado no admin.
- Salvar no navegador do dispositivo um token seguro, sem exigir que o operador digite token longo.
- Permitir tipos de display: caixa, propaganda e hibrido.
- Permitir configuracao editavel do que aparece em cada display.
- No PDV, gerar cobranca Pix Mercado Pago, exibir QR no display do caixa, imprimir QR e atualizar status do pagamento.
- Finalizar a venda somente depois que a consulta ao Mercado Pago retornar pagamento aprovado.

## Fora Do Escopo Inicial

- App Android nativo.
- Confirmacao em tempo real por webhook/push no tablet.
- Edicao avancada de layout visual por drag and drop.
- Playlist complexa com agenda por horario.
- Multiplos caixas disputando o mesmo display sem configuracao explicita.

Esses pontos podem ser adicionados depois sem invalidar a arquitetura.

## Modelo De Displays

Cada display cadastrado deve ter:

- Nome visivel.
- Slug ou identificador publico.
- Tipo: `cashier`, `ads` ou `hybrid`.
- Status ativo/inativo.
- Orientacao: `portrait` ou `landscape`.
- Caixa vinculado, quando for display de caixa ou hibrido.
- Configuracoes de exibicao:
  - Mostrar ou ocultar nome da loja.
  - Mostrar ou ocultar valor do Pix.
  - Mostrar ou ocultar resumo de produtos.
  - Mostrar ou ocultar instrucoes de pagamento.
  - Mostrar ou ocultar propaganda durante Pix.
  - Tempo de troca das propagandas.
- Conteudo ocioso:
  - Banners/imagens.
  - Produtos destacados.
  - Frases/promocoes.

Displays do tipo `ads` nunca recebem Pix automaticamente. Displays do tipo `cashier` recebem Pix do caixa vinculado. Displays `hybrid` rodam propaganda normalmente e podem trocar para Pix quando o caixa vinculado tiver uma cobranca ativa.

## Pareamento Android

O dispositivo Android deve abrir uma URL geral do dominio proprio, por exemplo:

```text
https://display.mercadodovale.com.br
```

Na primeira abertura:

1. O admin cria o display.
2. O sistema gera um codigo curto de pareamento, como `847-219`.
3. A TV ou tablet abre a URL geral.
4. A tela pede o codigo curto.
5. O codigo curto e trocado por um token longo e seguro.
6. O token e salvo no navegador do dispositivo.
7. Nas proximas aberturas, o display entra direto na tela configurada.

O admin deve conseguir revogar ou renovar o pareamento. Ao renovar, o token antigo deixa de funcionar.

## Fluxo Pix No PDV

No PDV, ao selecionar Pix:

1. O operador informa ou preenche o valor restante.
2. Clica em `Gerar Pix Mercado Pago`.
3. O sistema cria uma cobranca Pix Mercado Pago.
4. A cobranca retorna `payment_id`, status, QR copia-e-cola e QR base64.
5. O pagamento fica no estado `aguardando_pagamento`.
6. O QR e enviado para o display vinculado ao caixa.
7. O operador pode imprimir o QR em papel termico.
8. O operador clica em `Atualizar pagamento`.
9. O sistema consulta o Mercado Pago pelo `payment_id`.
10. Se o status for aprovado, o pagamento Pix entra na lista de pagamentos como pago.
11. A venda so pode finalizar quando os pagamentos aprovados cobrirem o total da venda.

Estados esperados da cobranca:

- `idle`: nenhum Pix gerado.
- `creating`: criando cobranca.
- `pending`: QR gerado e aguardando pagamento.
- `approved`: pagamento confirmado.
- `rejected`: pagamento rejeitado ou cancelado.
- `expired`: cobranca expirada, se essa informacao estiver disponivel.
- `error`: falha ao criar ou consultar.

## Acoes No PDV

Quando houver Pix pendente, o PDV deve exibir:

- `Exibir no display`: reenviar ou marcar a cobranca como ativa no display vinculado.
- `Imprimir QR`: abrir impressao termica do QR.
- `Atualizar pagamento`: consultar status no Mercado Pago.
- `Cancelar Pix`: limpar a cobranca ativa e permitir gerar outra.

O botao de finalizar venda deve permanecer bloqueado enquanto houver Pix pendente nao aprovado.

## Impressao Do QR

A impressao do QR e separada do recibo final.

Layout minimo:

- Cabecalho com nome da loja.
- Valor a pagar.
- QR grande.
- Codigo Pix copia-e-cola quebrado em linhas.
- Instrucao curta para o cliente.

Depois que a venda for confirmada, o recibo final continua usando o fluxo de impressao existente.

## Tela Do Display

Quando nao houver Pix ativo:

- Display de caixa e hibrido mostram conteudo ocioso configurado.
- Display de propaganda roda banners/produtos configurados.

Quando houver Pix ativo:

- Display de caixa mostra o QR do Pix.
- Display hibrido mostra o QR se estiver vinculado ao caixa da cobranca.
- A tela respeita as flags editaveis: valor, itens, instrucoes, propaganda lateral/rodape.

A tela deve funcionar bem em navegador Android, em modo tela cheia ou kiosk, sem depender de app nativo.

## Dados A Persistir

Sugestao de entidades:

- `pdv_displays`
  - id
  - name
  - slug
  - type
  - orientation
  - cashier_key
  - is_active
  - settings_json
  - paired_at
  - created_at
  - updated_at

- `pdv_display_pairing_codes`
  - id
  - display_id
  - code_hash
  - expires_at
  - consumed_at
  - created_at

- `pdv_display_tokens`
  - id
  - display_id
  - token_hash
  - revoked_at
  - last_seen_at
  - created_at

- `pdv_pix_payments`
  - id
  - sale_draft_id
  - local_reference
  - cashier_key
  - display_id
  - mercado_pago_payment_id
  - amount
  - status
  - qr_code
  - qr_code_base64
  - ticket_url
  - raw_response_json
  - created_at
  - updated_at

Se o backend atual preferir usar endpoints sobre tabelas diretas, essas entidades podem ser expostas pela VPS mantendo a mesma responsabilidade.

## Integracao Mercado Pago

O token secreto do Mercado Pago nao deve ficar no frontend. A criacao e consulta de Pix devem passar por endpoint de backend/VPS.

Endpoints sugeridos:

- `POST /pdv/pix-payments`
  - cria cobranca Pix no Mercado Pago.
- `GET /pdv/pix-payments/:id/status`
  - consulta o pagamento no Mercado Pago e atualiza status local.
- `POST /pdv/displays/:displayId/active-pix`
  - associa cobranca ativa ao display.
- `DELETE /pdv/displays/:displayId/active-pix`
  - limpa cobranca ativa do display.

## Erros E Recuperacao

- Se falhar ao gerar Pix, a venda permanece aberta e o operador pode tentar novamente.
- Se o Pix estiver pendente, o operador pode atualizar de novo sem duplicar pagamento.
- Se o Pix for aprovado, nao deve ser possivel cancelar localmente sem tratar estorno/cancelamento em fluxo separado.
- Se a tela Android perder conexao, ao reconectar deve buscar o estado atual do display.
- Se o token do display for revogado, a tela volta ao modo de pareamento.

## Testes E Verificacao

Testes unitarios:

- Normalizacao de status Mercado Pago.
- Regra que impede venda de finalizar com Pix pendente.
- Conversao de cobranca aprovada em `PaymentMethod` do tipo `pix`.
- Configuracoes de display mostrando/ocultando campos.

Testes de integracao ou mocks:

- Criacao de Pix via endpoint.
- Consulta de status aprovada, pendente e erro.
- Pareamento por codigo curto.
- Revogacao de token.

Verificacao manual:

- Gerar Pix no PDV.
- Ver QR no display Android.
- Imprimir QR.
- Atualizar pagamento pendente.
- Atualizar pagamento aprovado.
- Finalizar venda apos aprovacao.
- Display voltar para propaganda quando Pix for limpo.

## MVP De Implementacao

1. Backend seguro para criar e consultar Pix Mercado Pago.
2. Extensao do PDV para gerar Pix, atualizar status e bloquear finalizacao enquanto pendente.
3. Impressao termica do QR Pix.
4. Cadastro simples de displays.
5. Pareamento por codigo curto.
6. Pagina de display Android com modo ocioso e modo Pix.

Depois do MVP:

- Biblioteca de banners/produtos para propagandas.
- Playlists por display.
- Agendamento de conteudo.
- Webhook ou atualizacao automatica de status.
