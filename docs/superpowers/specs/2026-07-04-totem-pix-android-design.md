# Totem Pix Android

## Objetivo

Criar uma operacao de totem Pix para o Mercado do Vale usando um celular Android fixo, conectado no carregador, como display dedicado de pagamento. O aparelho deve ficar pareado pela internet, acordar visualmente quando houver Pix ativo, exibir apenas as informacoes essenciais em tela pequena e permitir compartilhamento simples do comprovante.

O sistema tambem deve continuar aceitando tablets, TVs ou outros celulares como displays moveis pareados pela internet. Nesses aparelhos, o modo ocioso pode mostrar propagandas com tela ligada.

## Contexto Atual

O projeto ja possui uma base de display PDV:

- `pages/display/DisplayPage.tsx` mostra o display pareado no navegador.
- `services/pdvDisplayService.ts` consome rotas de displays e Pix.
- `types/pdvDisplay.ts` define `PdvDisplay`, `PdvPixPayment` e `PdvDisplayState`.
- O backend possui rotas como `/pdv/displays/pair`, `/pdv/display-state`, `/pdv/pix-payments`, `/pdv/displays/:displayId/active-pix` e limpeza de Pix ativo.

A nova solucao deve reaproveitar esse modelo de pareamento e estado, adicionando os campos e fluxos necessarios para totem, comprovante e compartilhamento.

## Escopo

Incluido:

- App Android simples para totem/display, preferencialmente WebView controlada por camada nativa.
- Modo totem para celular fixo: tela cheia, sempre ativo, carregador conectado, brilho minimo quando ocioso.
- Modo display para tablet/TV: pode manter propagandas em tela quando ocioso.
- Tela de Pix pendente com numero do pedido, QR Code grande e valor.
- Tela de Pix aprovado com comprovante simples.
- Botao no PDV para limpar somente a visualizacao do totem.
- Temporizador visual de 10 minutos para limpar o totem se o operador esquecer.
- Compartilhamento opcional do comprovante por WhatsApp ou QR temporario.
- QR temporario do comprovante com validade de 5 minutos e contador visivel.

Fora do escopo desta fase:

- Consulta publica por numero do pedido.
- Historico publico de comprovantes.
- PDF ou imagem do comprovante.
- Envio automatico de comprovante sem acao do cliente ou operador.
- Regras financeiras, estoque ou finalizacao de venda.

## Principios

- "Limpar totem" nao finaliza venda, nao altera pagamento, nao baixa estoque e nao muda financeiro.
- O totem nao deve expor historico nem dados sensiveis de outros pedidos.
- A tela pequena deve priorizar leitura rapida: pedido, QR, valor e status.
- Links temporarios devem existir apenas durante a visualizacao atual e expirar quando ela for limpa.
- O envio por WhatsApp deve ser opcional e confirmado.

## Modos de Exibicao

### Ocioso

No celular fixo de pagamento, o app permanece aberto e pareado, mas a tela fica visualmente apagada: brilho minimo, fundo preto ou overlay escuro. Como o aparelho fica no carregador, nao e necessario bloquear a tela.

Em tablets e TVs, o mesmo display pode mostrar banners, produtos ou mensagens promocionais quando nao houver Pix ativo.

### Pix Pendente

Quando o PDV cria ou associa um Pix ao display, o totem deve acender visualmente e mostrar somente:

```text
Pedido #1234

[ QR CODE GRANDE ]

R$ 1.234,56
```

Nao deve mostrar resumo de itens, instrucoes longas ou propaganda durante o Pix pendente no modo celular pequeno.

### Pix Aprovado

Quando o pagamento for reconhecido como aprovado, o totem troca para comprovante simples:

```text
Pagamento aprovado

Pedido #1234
Valor: R$ 1.234,56
Pagamento: Pix
Autenticacao: 987654321
Data/hora: 04/07/2026 15:42
Mercado do Vale

[ Compartilhar comprovante ]
```

O numero do pedido deve permanecer visivel no comprovante. O campo de autenticacao deve usar o identificador oficial disponivel no retorno do provedor de pagamento; se nao houver um campo mais especifico, usar o ID do pagamento Mercado Pago como fallback.

### Limpeza Visual

O comprovante permanece no totem ate uma destas condicoes:

- O operador clicar em `Limpar totem` no PDV.
- O temporizador visual de 10 minutos expirar.

Essa limpeza:

- remove o comprovante da tela;
- invalida o QR/link temporario do comprovante;
- limpa qualquer telefone digitado;
- retorna ao modo ocioso;
- nao altera a venda, o pagamento, o estoque nem o financeiro.

O totem nao deve oferecer um botao visivel para o cliente limpar a tela.

## Compartilhamento do Comprovante

Na tela de comprovante aprovado, o botao `Compartilhar comprovante` abre as opcoes:

```text
Como deseja receber?

[ Enviar para meu WhatsApp ]
[ Abrir no meu celular por QR Code ]
```

### Enviar para WhatsApp

Se a venda estiver vinculada a um cliente cadastrado com telefone/WhatsApp:

```text
Enviar comprovante para Maria?
WhatsApp: (87) *****-1234

[ Enviar ] [ Usar outro numero ]
```

Se nao houver cliente cadastrado ou telefone:

```text
WhatsApp para envio

(87) 9 9999-9999

[ Enviar comprovante ]
```

O telefone digitado deve aceitar formatos com ou sem nono digito depois do DDD, reutilizando a normalizacao ja adotada para WhatsApp. O envio deve acontecer pelo backend usando a Evolution API configurada para `botmercadodovale`.

Mensagem para cliente identificado:

```text
Ola, Maria!

Seu pagamento Pix foi aprovado.

Pedido: #1234
Valor: R$ 1.234,56
Pagamento: Pix
Autenticacao: 987654321
Data/hora: 04/07/2026 15:42

Obrigado pela preferencia!
Mercado do Vale
```

Mensagem sem cliente identificado:

```text
Seu pagamento Pix foi aprovado.

Pedido: #1234
Valor: R$ 1.234,56
Pagamento: Pix
Autenticacao: 987654321
Data/hora: 04/07/2026 15:42

Obrigado pela preferencia!
Mercado do Vale
```

### Abrir no Celular por QR Code

O totem pode gerar um QR temporario com link seguro para a visualizacao do comprovante no celular do cliente.

A tela deve mostrar contador:

```text
Escaneie para ver o comprovante no seu celular

[ QR CODE ]

Expira em 04:59
```

Regras:

- O QR temporario vale por 5 minutos.
- Se o operador clicar em `Limpar totem`, o QR expira imediatamente.
- Quando o QR expirar, o totem mostra `QR expirado. Peca ao atendente para gerar novamente.`
- O link so deve exibir o comprovante daquela operacao atual.
- O link nao deve permitir consultar outros pedidos.

## PDV

O PDV deve expor controles claros apos Pix aprovado:

- `Compartilhar comprovante`: abre o mesmo fluxo de WhatsApp, adequado para o operador preencher ou confirmar.
- `Limpar totem`: limpa apenas a visualizacao do display.

Evitar nomes como `Finalizar` nesse contexto, para nao confundir limpeza visual com finalizacao de venda.

Quando houver cliente cadastrado na venda, o PDV pode sugerir o WhatsApp do cliente automaticamente e pedir confirmacao antes de enviar. Quando nao houver, deve aceitar numero manual.

## Dados Necessarios

O estado de display precisa carregar, junto com `active_pix`, os dados de comprovante:

- numero do pedido;
- valor;
- status;
- data/hora de aprovacao;
- autenticacao do pagamento;
- nome do cliente, quando houver;
- telefone do cliente mascarado para UI e telefone completo apenas no backend;
- identificador de venda ou rascunho necessario para resolver cliente e pedido.

Se `pdv_pix_payments` nao contiver todos esses dados diretamente, o backend deve resolver por `sale_draft_id`, `local_reference`, venda associada ou `raw_response_json`, sem expor dados desnecessarios no totem.

## Arquitetura Proposta

### Android

Criar app Android dedicado com:

- WebView apontando para a rota de display/totem do site;
- tela cheia e modo imersivo;
- manter tela acordada enquanto o app estiver aberto;
- controle nativo de brilho ou overlay escuro para modo ocioso;
- persistencia local do token de pareamento;
- opcionalmente abrir automaticamente no boot para o aparelho fixo.

O app Android nao deve implementar regras de pagamento. Ele deve ser uma casca confiavel para exibir o estado vindo do backend e controlar comportamento de hardware.

### Frontend Display

A tela web deve suportar modo totem compacto:

- layout de QR grande;
- comprovante aprovado;
- fluxo de compartilhamento;
- contador de QR temporario;
- estados de erro e reconexao.

### Backend

Adicionar ou ajustar endpoints para:

- retornar estado de comprovante no `/pdv/display-state`;
- limpar visualizacao do totem sem mexer na venda;
- criar QR/link temporario de comprovante;
- validar e expirar link temporario;
- enviar comprovante por WhatsApp;
- registrar logs de envio e falha sem expor segredos.

## Erros e Estados de Falha

- Sem internet no totem: manter tela atual se houver, mostrar aviso discreto e continuar tentando reconectar.
- Token invalido: voltar para pareamento.
- Pix sem QR: mostrar codigo copia e cola apenas como fallback.
- Falha no envio WhatsApp: mostrar erro curto e permitir tentar novamente ou usar QR temporario.
- QR temporario expirado: mostrar estado expirado e permitir gerar novo enquanto o comprovante visual ainda estiver ativo.
- Cliente sem telefone: pedir numero manual.

## Seguranca e Privacidade

- Telefone sugerido na tela do totem deve ser mascarado.
- Links temporarios devem usar token aleatorio, nao ID sequencial.
- Links temporarios expiram em 5 minutos ou ao limpar totem.
- Comprovante visual expira em 10 minutos ou ao limpar totem.
- O backend deve enviar WhatsApp usando credenciais no servidor, nunca no cliente.
- Nao imprimir chaves da Evolution, tokens ou dados sensiveis em logs copiados.

## Testes

Testes estaticos e unitarios devem cobrir:

- `Limpar totem` nao chama rotas de finalizacao de venda.
- Display state inclui dados de comprovante sem expor telefone completo na resposta do totem.
- Pix pendente mostra pedido, QR e valor.
- Pix aprovado mostra pedido, valor, autenticacao, data/hora e botao de compartilhar.
- QR temporario expira em 5 minutos.
- Limpar totem invalida QR temporario.
- Temporizador visual de 10 minutos limpa apenas a visualizacao.
- Telefone com e sem nono digito e normalizado antes do envio por WhatsApp.
- Mensagem de WhatsApp com cliente inclui nome e obrigado no fim.
- Mensagem de WhatsApp sem cliente nao usa saudacao nominal.

Validacao manual:

- Parear um celular fixo.
- Criar Pix no PDV e confirmar que o totem acende.
- Aprovar Pix e confirmar o comprovante.
- Enviar comprovante para WhatsApp cadastrado.
- Enviar comprovante para numero manual.
- Abrir comprovante por QR temporario.
- Confirmar expiracao do QR em 5 minutos.
- Confirmar limpeza visual manual pelo PDV.
- Confirmar limpeza visual automatica em 10 minutos.
