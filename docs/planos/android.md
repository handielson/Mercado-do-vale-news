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
- [ ] Antes de cada bloco de implementacao, registrar em `Historico De Implementacao` o objetivo do bloco.
- [ ] Depois de cada bloco de implementacao, registrar arquivos alterados, testes executados, resultado e pendencias.

### Fase 1 - Backend seguro Mercado Pago e dados base

- [ ] Mapear no `vps_server.js` o padrao atual de rotas protegidas e migrations/tabelas.
- [ ] Criar persistencia para displays, tokens, codigos de pareamento e Pix do PDV.
- [ ] Criar rota segura para gerar Pix Mercado Pago sem expor access token no frontend.
- [ ] Criar rota segura para consultar status do pagamento no Mercado Pago.
- [ ] Criar rota para associar/limpar Pix ativo em um display.
- [ ] Criar rota para excluir lixo: displays de teste, tokens revogados antigos, codigos expirados e Pix pendente/cancelado de teste.
- [ ] Documentar no `Historico De Implementacao` as rotas criadas e o contrato de cada uma.

### Fase 2 - Tipos e services frontend

- [ ] Criar tipos `pdvDisplay.ts`.
- [ ] Criar `pdvDisplayService.ts` usando `vpsClient`.
- [ ] Criar helper de normalizacao de status Pix.
- [ ] Criar helper para montar dados de impressao do QR.
- [ ] Documentar no `Historico De Implementacao` os services criados.

### Fase 3 - Admin de Displays Android

- [ ] Criar pagina admin `DisplaysPage.tsx`.
- [ ] Adicionar rota no painel admin.
- [ ] Adicionar entrada no menu admin.
- [ ] Permitir criar/editar displays nomeados ou numerados.
- [ ] Permitir selecionar tipo: caixa, propaganda ou hibrido.
- [ ] Permitir configurar orientacao e exibicoes: loja, valor, itens, instrucoes e propaganda durante Pix.
- [ ] Permitir gerar/renovar codigo de pareamento.
- [ ] Permitir revogar pareamento.
- [ ] Permitir excluir display/lixo com confirmacao.
- [ ] Documentar no `Historico De Implementacao` o fluxo admin criado.

### Fase 4 - Pagina publica do Android

- [ ] Criar pagina publica do display.
- [ ] Criar tela de pareamento por codigo curto.
- [ ] Salvar token no navegador do Android.
- [ ] Buscar configuracao do display por token.
- [ ] Mostrar propaganda/conteudo ocioso quando nao houver Pix ativo.
- [ ] Mostrar QR, valor, itens e instrucoes conforme configuracao quando houver Pix ativo.
- [ ] Fazer polling simples para atualizar estado do display.
- [ ] Voltar para pareamento se token for revogado.
- [ ] Documentar no `Historico De Implementacao` a URL final e o comportamento do Android.

### Fase 5 - PDV Pix Mercado Pago

- [ ] Integrar geracao de Pix na secao de pagamento do PDV.
- [ ] Guardar estado local da cobranca: criando, pendente, aprovado, erro, rejeitado ou expirado.
- [ ] Enviar/associar Pix ao display vinculado ao caixa.
- [ ] Adicionar botao `Atualizar pagamento`.
- [ ] Bloquear finalizacao da venda enquanto Pix estiver pendente.
- [ ] Converter Pix aprovado em `PaymentMethod` do tipo `pix`.
- [ ] Permitir cancelar Pix pendente sem cancelar venda.
- [ ] Documentar no `Historico De Implementacao` o comportamento exato do PDV.

### Fase 6 - Impressao termica do QR

- [ ] Criar `utils/printPixQr.ts`.
- [ ] Imprimir cabecalho da loja, valor, QR grande, codigo copia-e-cola e instrucao curta.
- [ ] Adicionar botao `Imprimir QR` no PDV quando houver Pix gerado.
- [ ] Verificar que o recibo final continua usando `printSaleReceipt.ts`.
- [ ] Documentar no `Historico De Implementacao` o layout de impressao.

### Fase 7 - Propagandas e limpeza

- [ ] Implementar modelo inicial de conteudo ocioso.
- [ ] Permitir ocultar/mostrar propaganda durante Pix.
- [ ] Permitir remover banners/produtos/conteudos nao usados.
- [ ] Criar opcao `Excluir lixo` ou `Limpar itens inativos` no admin, com confirmacao.
- [ ] Garantir que excluir lixo nao remova displays ativos nem Pix aprovado.
- [ ] Documentar no `Historico De Implementacao` a regra exata de limpeza.

### Fase 8 - Verificacao e publicacao

- [ ] Rodar testes estaticos planejados.
- [ ] Rodar `npm.cmd run build`.
- [ ] Verificar PDV em navegador.
- [ ] Verificar display Android em viewport tablet/TV.
- [ ] Verificar impressao do QR.
- [ ] Se publicar, seguir `publicar.md`.
- [ ] Documentar no `Historico De Implementacao` comandos, resultados, release e URLs verificadas.

---

## Historico De Implementacao

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
