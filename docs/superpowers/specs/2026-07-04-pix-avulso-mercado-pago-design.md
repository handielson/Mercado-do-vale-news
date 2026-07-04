# Pix Avulso Mercado Pago

## Contexto

O PDV ja gera Pix Mercado Pago vinculado a venda, display Android e webhook de confirmacao. Esse fluxo funciona para pagamento de carrinho, mas nao deve receber cobranças independentes porque isso poluiria a finalizacao de venda e poderia confundir estoque, cliente e pagamento.

A nova funcao sera uma area propria de Pix Avulso no admin, separada do PDV, com historico auditavel, compartilhamento com cliente e dados preparados para um futuro fechamento de caixa.

## Objetivos

- Criar uma pagina admin `Pix Avulso` em `/admin/pix-avulso`, no grupo Financeiro.
- Gerar cobranças Pix Mercado Pago independentes de venda e carrinho.
- Definir vencimento fixo de 10 minutos para cada Pix avulso.
- Manter extrato auditavel, incluindo pagamentos aprovados e cancelados por falta de pagamento.
- Permitir enviar o QR para um display Android escolhido.
- Permitir compartilhar o Pix por link publico e WhatsApp.
- Preservar campos de caixa para posterior conciliacao no fechamento de caixa.

## Fora de Escopo Neste Ciclo

- Fechamento de caixa completo.
- Conciliacao automatica com contas financeiras ou Bling.
- Agenda Google central do sistema.
- Sincronizacao automatica de clientes com Google Contacts.
- Pix sem valor definido. Este ciclo usa cobrança Mercado Pago dinamica com valor obrigatorio.

## Experiencia Admin

A pagina `/admin/pix-avulso` tera um formulario no topo:

- Valor em reais, obrigatorio.
- Descricao opcional, com padrao `Pix avulso Mercado do Vale`.
- Caixa, com valor inicial salvo em `localStorage`, por exemplo `caixa-01`.
- Display opcional, carregado dos displays ativos dos tipos `cashier` e `hybrid`.
- Telefone do cliente opcional para preparar compartilhamento via WhatsApp.

Ao gerar o Pix, a tela mostra:

- Valor.
- Status.
- Horario de criacao.
- Horario de vencimento.
- QR Code.
- Codigo Pix copia e cola.
- Link publico.

Acoes disponiveis:

- Copiar codigo Pix.
- Copiar link publico.
- Imprimir QR.
- Exibir no display escolhido.
- Atualizar status.
- Compartilhar no WhatsApp.
- Gerar novo Pix com os mesmos dados quando o anterior estiver aprovado, expirado ou rejeitado.

## Extrato

A mesma pagina tera um extrato de Pix avulsos com filtros:

- Periodo.
- Status.
- Caixa.
- Display.
- Busca por descricao, ID Mercado Pago, telefone ou referencia.

Cada linha mostra:

- Data/hora de criacao.
- Valor.
- Descricao.
- Caixa.
- Display.
- Status legivel.
- ID Mercado Pago.
- Horario de vencimento.
- Telefone usado no compartilhamento, quando houver.

Status legiveis principais:

- `Pendente`.
- `Aprovado`.
- `Cancelado por falta de pagamento`.
- `Rejeitado`.
- `Erro`.

Um Pix vencido nao deve desaparecer. Ele permanece no extrato como `Cancelado por falta de pagamento`, com motivo auditavel e horario de vencimento.

## Pagina Publica

Cada Pix avulso tera um token publico nao sequencial e uma rota publica como `/pix/:token`.

Essa pagina mostra apenas dados seguros para pagamento:

- Nome da loja.
- Valor.
- Descricao.
- Status.
- Horario de vencimento.
- QR Code enquanto estiver pagavel.
- Pix copia e cola.
- Botao `Copiar codigo Pix`.

Quando o Pix vencer, a pagina mostra que a cobrança foi cancelada por falta de pagamento e orienta o cliente a pedir novo link.

O token publico nao deve expor ID interno previsivel. A pagina publica nao permite alterar status, escolher display nem acessar dados administrativos.

## WhatsApp

Na pagina admin, o usuario podera digitar um telefone e compartilhar o Pix.

O compartilhamento deve montar uma mensagem com:

- Nome da loja.
- Valor.
- Descricao.
- Link publico do Pix.
- Aviso de validade de 10 minutos.
- Instrucao para abrir o link, escanear o QR ou copiar o codigo Pix.

Primeira versao usa abertura de `wa.me` com texto preenchido no navegador. Se a automacao WhatsApp configurada no sistema estiver disponivel, o envio direto pode ser uma melhoria posterior.

Ao compartilhar, o sistema deve registrar no Pix:

- Telefone informado.
- Data/hora do compartilhamento.
- Canal `whatsapp_link`.

## Display Android

O Pix avulso podera ser associado a um display escolhido manualmente.

Regras:

- Apenas displays ativos dos tipos `cashier` e `hybrid` aparecem como opcoes.
- Ao exibir no display, a cobrança vira o `active_pix_payment_id` daquele display.
- Pix aprovado ou cancelado por falta de pagamento nao pode ser enviado como cobrança ativa.
- Quando um Pix vence, ele nao deve continuar como ativo no display depois da proxima consulta/atualizacao.

## Backend e Dados

Evoluir a tabela existente `pdv_pix_payments`, porque ela ja possui os campos centrais de Mercado Pago, QR, status, display, caixa e webhook. Nao criar uma segunda tabela neste ciclo.

Colunas novas necessarias:

- `source`: `pdv_sale` para Pix do PDV e `standalone_pix` para Pix avulso.
- `public_token` unico para pagina publica.
- `description` para texto da cobrança.
- `expires_at` com criacao + 10 minutos.
- `cancel_reason` para `unpaid_expired`.
- `shared_phone` para o telefone usado no WhatsApp.
- `shared_at` para auditoria do compartilhamento.
- `share_channel` para registrar `whatsapp_link`.
- `approved_at` para auditoria de aprovacao.
- `cash_closing_id` nullable, criado desde ja para o fechamento de caixa futuro.

Registros antigos do PDV devem receber `source = 'pdv_sale'` como padrao da coluna, preservando compatibilidade.

Rotas novas recomendadas:

- `POST /pix/standalone` cria Pix avulso com vencimento de 10 minutos.
- `GET /pix/standalone` lista extrato com filtros.
- `GET /pix/standalone/:id/status` consulta Mercado Pago e atualiza status local.
- `POST /pix/standalone/:id/share-whatsapp` registra telefone e retorna link `wa.me`.
- `GET /pix/public/:token` retorna dados publicos para a pagina `/pix/:token`.

As rotas podem reutilizar a criacao Mercado Pago de `/pdv/pix-payments`, mas devem deixar clara a origem `standalone_pix` no metadata:

- `metadata.flow = 'standalone_pix'`.
- `metadata.standalone_pix_payment_id = id`.
- `metadata.cashier_key = caixa`.
- `external_reference = 'standalone_pix:<id>'`.

## Webhook Mercado Pago

O webhook atual deve reconhecer pagamentos `standalone_pix`.

Quando o Mercado Pago confirmar `approved`:

- Atualizar o status do Pix avulso para aprovado.
- Registrar horario de aprovacao.
- Manter no extrato.

Quando a consulta detectar vencimento sem aprovacao:

- Atualizar status para expirado/cancelado.
- Registrar motivo `unpaid_expired`.
- Mostrar na UI como `Cancelado por falta de pagamento`.
- Remover do display ativo se ele estiver exibindo esse Pix.

## Fechamento de Caixa Futuro

Cada Pix avulso deve nascer com `cashier_key` preenchido. Isso permite que o futuro fechamento de caixa filtre:

- Pix avulsos aprovados por caixa e periodo.
- Pix avulsos cancelados por falta de pagamento por caixa e periodo.
- Pix compartilhados, mas nao pagos.

O fechamento de caixa futuro podera vincular registros via `cash_closing_id` ou por uma tabela de conciliacao. Este ciclo nao implementa o fechamento, apenas preserva os dados necessarios.

## Agenda Google Como Fase 2

A agenda Google central sera tratada em uma spec propria. Direcao prevista:

- Integrar Google People API como fonte compartilhada de contatos.
- Permitir buscar, criar, editar e excluir contatos no admin.
- Criar ou reaproveitar grupo `Clientes Loja`.
- Ao cadastrar cliente novo no sistema, criar/atualizar contato Google com observacao `cliente loja`.
- Vincular clientes locais ao `google_contact_resource_name`.
- Usar a agenda central para preencher telefone em Pix avulso, WhatsApp, entregas e outros fluxos.

Essa fase fica fora do Pix Avulso para evitar acoplar pagamento, agenda e sincronizacao externa em uma unica entrega.

## Testes

Testes minimos para implementacao:

- Backend cria Pix avulso com `metadata.flow = 'standalone_pix'` e vencimento de 10 minutos.
- Pix avulso aparece no extrato e nao depende de venda/carrinho.
- Consulta de status transforma vencido em `Cancelado por falta de pagamento` na apresentacao.
- Pix vencido nao pode ser enviado ao display.
- Link publico retorna somente campos seguros.
- Compartilhamento WhatsApp gera mensagem com link publico e registra telefone/data.
- Menu e rota admin expõem `/admin/pix-avulso`.
- Fluxo PDV existente continua protegido por testes atuais.

## Criterios de Aceite

- Admin consegue gerar Pix avulso fora do PDV.
- Pix vence em 10 minutos.
- Pix vencido fica no extrato como `Cancelado por falta de pagamento`.
- Admin consegue copiar codigo Pix, copiar link publico, imprimir QR e compartilhar no WhatsApp.
- Cliente abre pagina publica, ve QR/copia e cola e consegue copiar o codigo.
- Admin consegue escolher display e exibir Pix ativo.
- Extrato permite auditoria por valor, status, caixa, display, datas e telefone compartilhado.
- Dados ficam preparados para fechamento de caixa futuro sem implementar o fechamento agora.
