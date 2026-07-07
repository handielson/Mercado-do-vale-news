# Fluxo guiado para troca de numero WhatsApp

## Objetivo

Criar no Centro WhatsApp um fluxo seguro para trocar o numero conectado ao bot da loja sem deixar o atendimento responder pelo numero errado. O fluxo deve priorizar controle operacional: pausar o bot antes da troca, desconectar/conectar via Evolution, validar o numero conectado e reativar somente depois da confirmacao do admin.

## Contexto atual

- A instancia oficial do bot e `botmercadodovale`.
- O numero oficial atual conectado e `558781137240`.
- O webhook esperado da Evolution e `https://n8n.mercadodovale.com.br/webhook/whatsapp`.
- O workflow n8n usa a instancia `botmercadodovale` para receber e enviar mensagens.
- O bot ja tem controle global de pausa/continuidade por API e por comando admin WhatsApp.

## Escopo

O fluxo entra no painel `Centro WhatsApp`, dentro ou ao lado do bloco `Conexao WhatsApp`.

Etapas esperadas:

1. Preparar troca
   - Exibir instancia, numero atual e estado da Evolution.
   - Botao `Iniciar troca de numero`.

2. Pausar bot
   - Ao iniciar, pausar o bot geral automaticamente.
   - Exibir o status final `Bot pausado`.
   - Se a pausa falhar, bloquear as etapas seguintes.

3. Desconectar numero atual
   - Exigir confirmacao explicita antes de desconectar.
   - Chamar a desconexao da instancia atual.
   - Atualizar o estado ate `close` ou `connecting`.

4. Conectar novo numero
   - Gerar QR Code e pairing code quando disponivel.
   - Atualizar o status periodicamente ate a Evolution retornar `open`.
   - Manter o bot pausado durante toda a conexao.

5. Validar numero conectado
   - Exibir o numero detectado pela Evolution.
   - Exigir acao manual `Confirmar este numero como oficial`.
   - A confirmacao deve validar tambem webhook, estado da instancia e controle global.

6. Reativar bot
   - Reativar o bot geral somente depois da confirmacao do numero.
   - Mostrar checklist final:
     - Evolution `open`;
     - webhook esperado ativo;
     - bot geral ativo;
     - numero conectado exibido na tela.

Tambem deve existir a acao `Manter bot pausado e sair`, para permitir que o admin conecte o numero novo e teste manualmente antes de liberar atendimento.

## Fora do escopo

- Criar multiplas instancias Evolution para varios numeros simultaneos.
- Migrar historico de conversas entre numeros.
- Alterar o workflow n8n para nomes de instancia dinamicos.
- Trocar o numero publico da empresa em cadastros, rodape, catalogo ou SEO.

## Arquitetura proposta

### Backend

Criar endpoints especificos para a troca guiada, reaproveitando as funcoes existentes sempre que possivel:

- `GET /n8n-bot/whatsapp-switch/status`
  - Retorna estado consolidado: controle global do bot, instancia, numero conectado, webhook e eventos.

- `POST /n8n-bot/whatsapp-switch/start`
  - Pausa o bot geral e retorna o status consolidado.

- `POST /n8n-bot/whatsapp-switch/disconnect`
  - Desconecta a instancia atual apos confirmacao no frontend.

- `POST /n8n-bot/whatsapp-switch/connect`
  - Gera QR Code/pairing code usando a instancia `botmercadodovale`.

- `POST /n8n-bot/whatsapp-switch/confirm`
  - Confirma o numero conectado e, se solicitado, reativa o bot.

- `POST /n8n-bot/whatsapp-switch/keep-paused`
  - Mantem o bot pausado e registra o motivo.

Os endpoints devem usar `requireSyncKey`, nao expor chaves Evolution e nunca retornar segredos.

### Frontend

Adicionar um componente no Centro WhatsApp:

- `WhatsAppNumberSwitchPanel`

Responsabilidades:

- buscar status consolidado;
- renderizar as etapas do fluxo;
- mostrar QR Code quando houver;
- bloquear avancos perigosos quando o estado nao permitir;
- exibir mensagens claras de erro;
- atualizar status automaticamente durante conexao.

O painel deve ser operacional e direto, sem texto promocional.

### Dados e auditoria

O primeiro passo pode registrar auditoria usando os campos existentes do controle global:

- `changed_by`;
- `changed_by_remote_jid`;
- `reason`;
- `changed_at`.

Se for necessario historico dedicado depois, criar uma tabela propria em uma evolucao separada. Para esta entrega, o objetivo e reduzir risco operacional sem ampliar o modelo de dados.

## Estados e erros

Estados principais:

- `idle`: troca nao iniciada;
- `paused`: bot pausado para troca;
- `disconnecting`;
- `awaiting_qr_scan`;
- `connected_pending_confirmation`;
- `completed`;
- `paused_for_manual_test`;
- `error`.

Erros importantes:

- Falha ao pausar bot: nao permitir desconectar.
- Evolution nao retorna QR Code: manter bot pausado e permitir tentar novamente.
- Novo numero nao fica `open`: manter em acompanhamento, sem reativar bot.
- Webhook divergente: mostrar erro e nao concluir.
- Confirmacao sem numero detectado: bloquear reativacao.

## Testes

Adicionar protecoes focadas:

- teste estatico de backend garantindo que os endpoints existem e usam `requireSyncKey`;
- teste estatico de frontend garantindo as etapas criticas: iniciar, desconectar, confirmar e manter pausado;
- teste de servico garantindo os caminhos da API usados pelo painel;
- `node --check vps_server.js` e `node --check vps_server.cjs`;
- `npm.cmd run build`.

## Criterios de aceite

- O admin consegue iniciar uma troca e o bot e pausado antes de qualquer desconexao.
- O admin consegue desconectar, gerar QR Code e acompanhar a conexao do novo numero.
- O painel mostra o numero conectado antes de permitir reativar.
- O bot so volta a responder depois da confirmacao.
- Existe opcao clara para sair mantendo o bot pausado.
- A tela final confirma Evolution, webhook e bot ativo.
