# Tabela dinâmica de celulares

## Gerador de listas por fabricante — 06/10/2026

Release `v1.2.557-marketing-tabelas`: no Marketing, a opção **Criar → Tabelas de celulares**
usa o formato de lista aprovado, com modelo, memória, logo, contato e data.
Selecionar Xiaomi, POCO e/ou realme e escolher o tipo:

- **Sem preço:** não imprime preços, parcelas ou condição de pagamento; pode incluir
  aparelho disponível que ainda não tenha preço válido.
- **Preço à vista no Pix:** usa `price_retail` em centavos, sem desconto adicional.
- **Preço no cartão:** imprime parcelas e total, reutilizando
  `calculateAutoresponderMaxInstallment` e as taxas presenciais de `payment_fees`,
  no maior parcelamento cadastrado até 12x. Sem taxa disponível, a geração é bloqueada.

As configurações/cores são agrupadas pela regra existente de maior preço disponível.
Cada fabricante fica em sua própria imagem; acima de 14 configurações, a lista continua
em páginas adicionais para preservar a leitura. A troca do tipo ou marca atualiza a
prévia e o agendamento consulta novamente os dados. O cache diferencia tipo, layout,
parcelamento e versão do desenho. A arte aprovada continua sendo um retrato dos dados
na geração; preços e taxas posteriores exigem uma nova geração.

O endpoint aceita `{brands, priceMode: 'none' | 'cash' | 'card', layout: 'list'}`.
Chamadas antigas sem esses campos preservam o layout de seis cards com fotos e preços
à vista usado pelo bot. Nenhuma migration, envio, aprovação ou publicação automática
é criada por essa alteração.

Implementação local de 06/09/2026. Não publicada nesta tarefa.

## Uso no Marketing

Marketing → Agenda Instagram (ou WhatsApp → Agendar Stories) → Tabela de celulares.
Selecionar Xiaomi, POCO e/ou realme e gerar a prévia. O servidor consulta celulares ativos,
visíveis e com estoque, agrupando configuração/memória e cores. Produz até seis cards por
página PNG 1080×1920, com logo e telefone dos dados da empresa. A última página mantém
as proporções compactas dos cards, sem esticá-los. O operador escolhe os canais e datas e solicita a
aprovação pelo agendamento existente. Nenhum novo envio automático é criado.

Cada prévia/agendamento é uma fotografia dos preços no momento da geração. Mudanças
posteriores no estoque ou preço não reescrevem imagens de um lote já aprovado; gerar
uma nova prévia e substituir o agendamento quando necessário. O cache de geração muda
quando os dados, marca, fotos, empresa, data ou versão do layout mudam.

## Preços e bot

Fonte da lista do bot: nó `Vendas - Contexto Produtos` do workflow ativo
`SkrkB4vyKVDnQ68t`, inspecionado na versão `3edc8f23-90f6-4012-aaf5-385eb3aa8934`.
A regra observada usa `price_retail` em centavos como preço à vista no Pix e o maior
preço das cores de uma mesma configuração. A tabela usa essa regra sem aplicar um
segundo desconto ou recalcular preços comerciais.

`POST /admin/marketing/phone-price-list/preview` exige autenticação interna sync/admin.
O Marketing envia `{brands}`. O bot envia `{groups:[{productIds,name,memory,priceCents}]}`
com os grupos exatos da lista determinística. O servidor revalida disponibilidade,
visibilidade e preço; divergência retorna 409. A resposta contém `items`, `generatedAt`,
`productCount` e `warnings`. As imagens públicas contêm apenas informações comerciais.
O serviço reutiliza `attachCatalogModelColorImages` para fotos da galeria.

O patch local `tmp-tests/n8n-add-phone-price-list-cards.cjs` acrescenta as imagens depois
do texto para pedidos de lista/categoria de smartphones. Mantém o splitter, envio
sequencial e handoff existentes. Falha da geração mantém a resposta textual e marca
`phonePriceListCardsStatus: unavailable` na execução. A primeira geração pode adicionar
latência; a chamada tem timeout de 120 segundos e não repete automaticamente.

## Publicação pendente

Publicar frontend e API conforme `publish-vps`/`publicar.md`, incluindo os dois novos
serviços `phonePriceListServer.cjs` e `phonePriceListArtwork.cjs` e as dependências em
`marketingCampaignApi.cjs` e `vps_server.cjs`. Sem migrations ou novas credenciais.
O espelho `vps_server.js` recebeu a mesma injeção de dependência.

Antes de atualizar o bot, exportar novamente a versão ativa e aplicar o patch local
idempotente contra ela (não sobrescrever com o export antigo). Validar conexões e
configuração dos nós, publicar apenas o delta e testar com destinatário autorizado.
O MCP n8n não estava disponível nesta sessão; o patch foi validado localmente contra
o export ativo, sem teste com envio real nem publicação do workflow.

## Validação local

- `node --test tmp-tests/phone-price-list-server.test.cjs tmp-tests/phone-price-list-artwork.test.cjs tmp-tests/n8n-phone-price-list-cards.test.cjs`
- `node tmp-tests/social-story-scheduler-static.test.mjs`
- `node tmp-tests/marketing-calendar-data-loading-static.test.mjs`
- `npm run test:money` e `npm run build`
- Sintaxe dos módulos/API e renderização local com amostra real anonimizada do catálogo.
