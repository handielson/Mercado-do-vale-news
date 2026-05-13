# Shopee

Documentacao operacional da integracao Shopee Open Platform v2 no Mercado do Vale.

Ultima revisao: 2026-05-11

## Objetivo

Manter um guia rapido para publicar, atualizar e diagnosticar produtos na Shopee sem depender de memoria da conversa.

Este arquivo cobre o fluxo atual de:

- autorizacao e proxy da API Shopee;
- publicacao de produto;
- estoque, dimensoes e frete;
- GTIN/EAN e SKU principal;
- marca do anuncio e atributos de marca/modelo;
- upload de imagens e video;
- templates de categoria/campos, com o primeiro template para capa de celular.

## Arquivos principais

| Area | Arquivo |
| --- | --- |
| API/proxy Shopee | `api/shopee-catalog.ts` |
| OAuth Shopee | `api/shopee.ts` |
| Tela admin Shopee | `pages/admin/settings/ShopeePage.tsx` |
| Defaults de descricao/estoque | `pages/admin/settings/shopeeSyncDefaults.js` |
| Payloads de estoque | `pages/admin/settings/shopeeStockPayloads.js` |
| Busca/sugestao de categoria | `pages/admin/settings/shopeeCategoryHelpers.js` |
| Templates de categoria/campos | `pages/admin/settings/shopeeFieldTemplates.js` |
| Vinculo local x Shopee | tabela `shopee_products` |

## Fluxo de publicacao de produto

1. O usuario abre a acao de sincronizar/publicar produto na Shopee.
2. O modal carrega a arvore de categorias via `action=categories`.
3. Se existir template aplicavel, o sistema pode selecionar a categoria automaticamente.
4. Ao selecionar uma categoria folha, o sistema busca:
   - atributos da categoria via `action=attributes`;
   - lista oficial de marcas via `action=brand_list`;
   - canais logisticos habilitados antes de publicar.
5. O modal preenche campos conhecidos:
   - SKU principal com `product.sku`;
   - GTIN/EAN com primeiro EAN cadastrado, ou permite marcar "Produto sem GTIN";
   - marca do produto quando possivel;
   - atributos do template quando aplicavel;
   - peso e dimensoes com fallback seguro.
6. Imagens sao enviadas para a Shopee antes do `add_item`.
7. Video e enviado quando houver arquivo local ou URL remota compativel.
8. O produto e publicado via `action=add_item`.
9. O retorno com `item_id` e salvo em `shopee_products`.

## Categoria e templates de campos

O sistema agora tem um primeiro template em `shopeeFieldTemplates.js`.

### Template: Capa de celular

Reconhecimento:

- nome, SKU ou categoria interna contendo `capa`, `case`, `capinha` ou `cover`;
- ignora casos obvios de `pelicula`, `carregador`, `fone` e `cabo`.

Categoria Shopee:

- `100490`

Campos preenchidos automaticamente quando existem na categoria:

| Campo Shopee | Valor padrao |
| --- | --- |
| Duracao da Garantia | `3 Months` |
| Material | `TPU` |
| Estampa | `Sem` |
| Tipo de Garantia | `Supplier Warranty` |
| Recursos da Capa | `Water Resistant` |
| Material da Correia | `Others` |
| Tipo de Capa | `Others` |
| Tipo de Cabo Movel | `Others` |
| Tipo de Tela | `Soft` |
| Marca de Celular Aplicavel | marca local do produto, ex.: `Xiaomi` |
| Modelo do Celular | extraido do nome, ex.: `Redmi Note 12 Pro Plus` |

Importante: campos com lista fechada so sao preenchidos se a opcao existir na lista retornada pela Shopee. Isso evita enviar valores invalidos quando a Shopee altera opcoes da categoria.

## Marca: duas coisas diferentes

Na tela existem dois conceitos parecidos, mas separados:

### Marca Shopee

Campo de marca oficial do item, enviado no payload como:

```json
{
  "brand": {
    "brand_id": 0,
    "original_brand_name": "Xiaomi"
  }
}
```

Quando a Shopee nao retorna uma marca oficial por `get_brand_list`, o sistema usa marca livre:

- `brand_id: 0`;
- `original_brand_name` com a marca local do produto.

### Marca de Celular Aplicavel

Esse e um atributo da categoria de capa de celular. Exemplo:

- atributo: `Marca de Celular Aplicavel`;
- valor: `Xiaomi`.

Esse campo pode aparecer preenchido mesmo quando a marca oficial do item nao foi localizada na lista de marcas da Shopee.

## SKU principal

O campo "SKU principal" no modal vem de `product.sku`.

Ele e enviado no `add_item` como:

```json
{
  "item_sku": "CCRN12PP13"
}
```

No importador/catalogo Shopee, o vinculo tambem usa SKU como principal criterio de match antes de tentar nome parecido.

## GTIN/EAN

O modal usa o primeiro EAN disponivel em `product.eans`.

Modos:

- `Informar GTIN/EAN`: envia o codigo digitado;
- `Produto sem GTIN`: envia `SEM GTIN`.

No payload, o valor vai em:

```json
{
  "tax_info": {
    "gtin": "7890001684506"
  },
  "gtin_code": "7890001684506"
}
```

Para produto sem GTIN:

```json
{
  "tax_info": {
    "gtin": "SEM GTIN"
  },
  "gtin_code": "SEM GTIN"
}
```

## Estoque

Historico do problema:

- a Shopee retornava `invalid field seller_stock, value must Not Null`;
- a variante aceita atualmente e `seller_stock` no topo do payload.

Formato atual para item sem variacao:

```json
{
  "seller_stock": [
    {
      "stock": 1
    }
  ]
}
```

O sistema ainda mantem diagnosticos de estoque para comparar:

- estoque bruto;
- estoque parseado;
- `product.stock_quantity`;
- `track_inventory`;
- categoria selecionada;
- atributos obrigatorios/preenchidos.

## Dimensoes e peso

A Shopee passou a exigir dimensao de pacote.

Payload atual:

```json
{
  "weight": 0.3,
  "dimension": {
    "package_length": 20,
    "package_width": 15,
    "package_height": 10
  }
}
```

Origem dos valores:

- `product.dimensions.depth_cm`, `shipping_length`, fallback `20`;
- `product.dimensions.width_cm`, `shipping_width`, fallback `15`;
- `product.dimensions.height_cm`, `shipping_height`, fallback `10`;
- detalhe do Bling via `product-detail`, quando o cadastro local nao tem peso/dimensoes:
  - `pesoBruto`;
  - `dimensoes.largura`;
  - `dimensoes.altura`;
  - `dimensoes.profundidade`;
  - alias tolerante `aspec`, `aspecto` ou `aspectos`, caso algum payload venha com esse nome;
- peso em `weight_kg`, `shipping_weight`, `pesoBruto` do Bling, fallback `0.3`.

Sempre envia minimo `1` cm para cada dimensao.

## Logistica/frete

Historico do problema:

- erro: `At least one shipping channel must be enabled for the product`;
- causa comum: enviar `logistics_info` plural ou canal fixo invalido.

Formato correto no `add_item`:

```json
{
  "logistic_info": [
    {
      "logistic_id": 80031,
      "enabled": true
    }
  ]
}
```

O sistema busca os canais habilitados por:

- `action=logistics_channel_list`;
- endpoint Shopee: `/api/v2/logistics/get_channel_list`.

Regra:

- usar somente canais retornados como habilitados;
- nao fixar canal se a loja nao tiver o canal aberto.

## Imagens

As imagens do produto sao enviadas para:

- `/api/v2/media_space/upload_image`;
- proxy: `action=upload_image`.

O `add_item` recebe apenas os `image_id` retornados:

```json
{
  "image": {
    "image_id_list": [
      "sg-11134201-..."
    ]
  }
}
```

## Video

Historico:

- antes o front tentava converter URL remota em base64;
- isso falhava para video remoto/Synology;
- agora o front envia `video_url` ao backend quando existe URL remota.

Payload para backend:

```json
{
  "video_url": "https://...",
  "file_name": "video.mp4"
}
```

Quando for upload local:

```json
{
  "video_data_url": "data:video/mp4;base64,...",
  "file_name": "video.mp4"
}
```

O backend faz o upload para:

- `/api/v2/media_space/upload_video`;
- consulta resultado em `/api/v2/media_space/get_video_upload_result`.

Se o backend responder `error_not_found`, o modal publica sem video e mostra mensagem de diagnostico.

## Atributos com muitas opcoes

A Shopee comunicou o endpoint:

- `/api/v2/product/search_attribute_value_list`

Proxy local:

- `action=search_attribute_values`

Quando o atributo vem com:

- `attribute_info.input_type = 2`;
- `attribute_info.support_search_value = true`;

o modal usa busca paginada em vez de depender da lista completa de opcoes.

Parametros:

- `attribute_id`;
- `value_name` opcional;
- `cursor`;
- `limit` entre `1` e `100`.

## Ship order e conformidade

A Shopee exige taxa diaria de sucesso acima de 90% em:

- `v2.logistics.ship_order`

Regras importantes:

- nao chamar `ship_order` para pedido/pacote ainda nao pronto;
- validar status antes da chamada;
- evitar duplicidade;
- tratar erros transitorios com retry;
- para prontidao de pacote, preferir APIs de pacote em vez de olhar apenas o status do pedido.

Fluxo recomendado pela Shopee:

1. Chamar `v2.order.search_package_list` com:
   - `package_status = 2`;
   - `invoice_pending = false`.
2. Filtrar pacotes com:
   - `is_shipment_arranged = true`.
3. Chamar `v2.order.get_package_detail`.
4. So chamar `v2.logistics.ship_order` quando:
   - `fulfillment_status = LOGISTICS_READY`;
   - `is_shipment_arranged = false`.

## Erros comuns e causas

### `invalid field seller_stock, value must Not Null`

Causa: formato de estoque errado para `add_item`.

Correcao atual: usar `seller_stock` no topo do payload.

### `Parcel size is required. Please fill in it.`

Causa: falta de `dimension`.

Correcao atual: enviar `dimension` com comprimento/largura/altura.

### `At least one shipping channel must be enabled`

Causa: canal logistico ausente, invalido ou campo incorreto.

Correcao atual:

- buscar canais habilitados;
- enviar `logistic_info` singular;
- usar pelo menos um canal aberto.

### Marca oficial nao encontrada, mas atributo de marca encontrado

Isso pode ser normal.

- `Marca Shopee` e marca oficial do item.
- `Marca de Celular Aplicavel` e atributo da categoria.

Quando a marca oficial nao volta no `get_brand_list`, o sistema envia marca livre com `brand_id: 0`.

## Testes relevantes

Rodar antes de mexer no fluxo de publicacao:

```bash
node tmp-tests/shopee-add-item-dimension-logistic-static.test.mjs
node pages/admin/settings/shopeeFieldTemplates.test.mjs
node pages/admin/settings/shopeeStockPayloads.test.mjs
node pages/admin/settings/shopeeSyncDefaults.test.mjs
node pages/admin/settings/shopeeCategoryHelpers.test.mjs
```

Build:

```bash
npm run build
```

No ambiente Codex, o build pode precisar rodar fora do sandbox por causa de acesso ao `vite.config.ts`.

## Como adicionar novo template de categoria/campos

1. Editar `pages/admin/settings/shopeeFieldTemplates.js`.
2. Criar uma funcao de reconhecimento do produto.
3. Definir:
   - `id`;
   - `label`;
   - `category_id`;
   - `attribute_defaults`.
4. Preencher somente valores estaveis e repetitivos.
5. Manter campos especificos fora do default sempre que variarem por produto.
6. Atualizar `pages/admin/settings/shopeeFieldTemplates.test.mjs`.
7. Rodar testes e build.

Exemplo de campos especificos que nao devem ficar fixos:

- cor;
- modelo exato do aparelho quando vier do nome;
- GTIN;
- SKU;
- preco;
- estoque;
- imagens;
- video.

## Checklist antes de publicar um produto

- Categoria correta selecionada.
- Template aplicado quando for produto recorrente.
- Marca oficial ou marca livre revisada.
- Marca/modelo aplicavel preenchidos quando for capa.
- GTIN ou "Produto sem GTIN" definido.
- SKU principal preenchido.
- Preco correto.
- Estoque correto.
- Peso e dimensoes coerentes.
- Pelo menos uma imagem valida.
- Canal logistico habilitado retornado pela Shopee.
- Video revisado quando existir.

## Deploy

Fluxo atual:

1. Alterar arquivos.
2. Rodar testes relevantes.
3. Rodar `npm run build`.
4. Commitar somente arquivos do escopo.
5. Push para `main`.
6. Vercel gera deploy de producao automaticamente.
7. Confirmar deploy `Ready` com Vercel.

## Feature planejada: pagina de templates da Shopee

### Objetivo

Criar uma pagina de templates da Shopee para montar cadastros completos antes da exportacao. O operador podera criar, editar e aplicar templates por tipo de produto, com sugestao automatica e escolha manual antes de enviar para a Shopee.

### Escopo

- Criar a pagina **Configuracoes > Shopee > Templates**.
- Permitir templates completos para preencher:
  - nome final do anuncio na Shopee;
  - descricao;
  - categoria Shopee;
  - atributos da categoria;
  - preco;
  - estoque;
  - peso e dimensoes;
  - GTIN quando aplicavel.
- Sugerir automaticamente um template com base em categoria, nome, SKU, marca e modelo do produto.
- Permitir trocar o template manualmente no modal de envio.
- Permitir editar o nome final do produto antes de enviar.
- Alertar sobre palavras ou frases perigosas que podem derrubar o anuncio.
- Gerar um titulo sugerido seguro, editavel antes da publicacao.

### Fluxo de uso

1. O usuario acessa **Configuracoes > Shopee > Templates**.
2. Cria ou edita um template, por exemplo:
   - Capa de celular;
   - Pelicula;
   - Carregador;
   - Cabo;
   - Fone.
3. Define regras de aplicacao automatica, como:
   - categoria local;
   - palavras no nome;
   - palavras no SKU;
   - marca;
   - modelo.
4. Define o titulo sugerido para a Shopee usando variaveis, por exemplo:
   - `Capa compativel com {modelo} Cor:{cor}`;
   - `Pelicula compativel com {modelo}`.
5. Define descricao, categoria Shopee, atributos e padroes de preco/estoque/logistica.
6. Ao enviar um produto para a Shopee, o modal sugere o melhor template.
7. O usuario pode trocar o template, revisar alertas, editar o titulo final e publicar.

### Nome seguro para Shopee

O nome interno do produto nao deve ser enviado obrigatoriamente igual para a Shopee. O modal de envio tera um campo separado chamado **Nome final na Shopee**.

Esse campo deve:

- iniciar com o titulo sugerido pelo template;
- permitir edicao manual antes de publicar;
- mostrar alertas quando houver frases perigosas;
- permitir aplicar uma sugestao segura.

Exemplo:

- evitar: `Capa para iPhone`;
- sugerir: `Capa compativel com iPhone`.

Esse exemplo vale para iPhone, mas o sistema deve permitir cadastrar regras para outras marcas e expressoes sensiveis.

### Regras de termos perigosos

A pagina de templates tera uma area para regras de palavras/frases perigosas.

Cada regra tera:

- texto detectado;
- sugestao de substituicao;
- nivel: aviso ou bloqueio;
- observacao opcional.

Exemplos:

- `Capa para iPhone` -> `Capa compativel com iPhone`;
- `Carregador Apple` -> `Carregador compativel`;
- `Original Samsung` -> alerta forte ou bloqueio;
- `Oficial` -> alerta ou bloqueio.

No modal de envio:

- aviso mostra destaque amarelo;
- bloqueio mostra destaque vermelho e impede publicar ate corrigir;
- o usuario pode aplicar a sugestao com um clique.

### Variaveis do template

Os campos de titulo e descricao podem usar variaveis do produto:

- `{produto}`;
- `{nome}`;
- `{sku}`;
- `{marca}`;
- `{modelo}`;
- `{cor}`;
- `{ram}`;
- `{armazenamento}`;
- `{categoria}`;
- `{descricao}`;
- `{preco}`;
- `{estoque}`.

Quando uma variavel nao existir no produto, ela deve ficar vazia e o texto final deve ser limpo para remover espacos duplicados.

### Dados do template

Cada template deve armazenar:

- nome do template;
- status ativo/inativo;
- prioridade para sugestao automatica;
- regras de aplicacao;
- titulo sugerido;
- descricao sugerida;
- categoria Shopee padrao;
- atributos Shopee padrao;
- modo de preco:
  - usar preco do produto;
  - aplicar valor fixo;
  - aplicar percentual sobre preco do produto.
- modo de estoque:
  - usar estoque do produto;
  - aplicar valor fixo.
- peso e dimensoes:
  - usar dados do produto;
  - aplicar valores padrao.
- GTIN:
  - usar EAN do produto;
  - enviar `SEM GTIN`;
  - deixar em branco.

### Integracao com o modal de envio

O modal atual de sincronizacao da Shopee deve ganhar:

- seletor de template no inicio do fluxo;
- indicacao de template sugerido automaticamente;
- botao para aplicar template;
- campo **Nome final na Shopee** editavel;
- painel de alertas de termos perigosos;
- botao para aplicar titulo sugerido;
- preservacao dos passos atuais:
  - categoria;
  - dados;
  - confirmar.

O template nao deve substituir edicoes manuais depois que o usuario alterar um campo. Se o usuario trocar o template manualmente, o sistema pode perguntar/aplicar novamente os campos do novo template.

### Abordagem recomendada

Implementar **Template + Titulo Sugerido + Regras de Substituicao**.

Motivo:

- reduz risco de anuncio derrubado por termos sensiveis;
- economiza tempo no cadastro;
- mantem revisao manual antes de publicar;
- permite ajustar regras sem mexer no codigo.

### Primeira versao

A primeira versao deve entregar:

- CRUD de templates;
- CRUD simples de regras perigosas dentro da pagina;
- sugestao automatica de template;
- selecao manual no modal;
- titulo sugerido e editavel;
- alertas de termos perigosos;
- aplicacao do template em titulo, descricao, categoria e atributos;
- testes cobrindo resolucao de template, variaveis e termos perigosos.

## Envio em massa Shopee

### Objetivo

Permitir publicar varios produtos locais na Shopee sem abrir a tela de produtos um por um, mantendo a revisao antes de cada envio.

### Primeira entrega: envio assistido em lote

O envio em massa inicial deve ser assistido, nao totalmente automatico.

Fluxo:

1. O usuario acessa **Shopee > Envio em massa**.
2. A tela lista produtos ainda nao sincronizados.
3. O usuario filtra por nome ou SKU.
4. O usuario seleciona varios produtos ou usa **Selecionar prontos**.
5. O sistema abre o modal atual de sincronizacao para o primeiro produto.
6. Ao publicar com sucesso, o proximo produto do lote abre automaticamente.
7. O lote termina quando todos os selecionados forem publicados ou quando o usuario cancelar.

Motivo dessa abordagem:

- reaproveita o fluxo ja validado de categoria, template, atributos, estoque, imagem e video;
- permite editar o nome final antes de publicar;
- reduz risco de publicar em massa com categoria ou atributo errado;
- deixa o operador revisar produtos com excecoes antes de enviar.

### Regras da primeira entrega

- Entram no lote apenas produtos com status **nao sincronizado**.
- Produtos sem imagem podem aparecer na lista, mas devem ser sinalizados como pendentes de revisao de midia.
- O envio usa o mesmo `ShopeeSyncModal` do produto individual.
- Depois de cada sucesso, o sistema recarrega os vinculos da Shopee.
- O envio assistido pode publicar variacoes no mesmo anuncio quando o modal encontra ou cria um grupo de variacoes.
- O botao **Selecionar todos** marca todos os produtos visiveis no filtro atual; **Selecionar automaticos** continua marcando apenas os prontos para automatico.
- A tela mostra um historico do lote com o resultado de cada item: publicado, pulado ou falhou.
- Quando um produto falha no modal, ele fica marcado no historico e o operador pode corrigir/repetir ou pular para o proximo.

### Entrega futura: envio automatico

Depois que o envio assistido estiver estavel, podemos criar um modo automatico para produtos que passam em pre-validacao:

- template resolvido;
- categoria Shopee definida;
- atributos obrigatorios preenchidos;
- preco valido;
- estoque valido;
- imagem principal presente;
- titulo seguro sem bloqueios;
- video enviado quando existir suporte e arquivo valido.

Produtos com qualquer alerta continuam indo para revisao manual.

### Pre-validacao para envio automatico

A primeira fase do envio automatico foi entregue como diagnostico operacional. Ela **nao publica sem modal ainda**.

Na aba **Envio em massa**, o sistema separa os produtos pendentes em:

- **Prontos para automatico**;
- **Precisam revisao**.

Tambem foram adicionados:

- contadores separados para produtos prontos e produtos que precisam revisao;
- filtro de lista por:
  - `Todos`;
  - `Prontos para automatico`;
  - `Precisam revisao`;
- botao **Selecionar automaticos**, que seleciona apenas os produtos aprovados na pre-validacao;
- coluna **Motivos**, mostrando bloqueios e avisos por produto;
- validacao dos atributos obrigatorios reais da categoria quando a Shopee retorna esses dados;
- validacao de existencia de canal logistico habilitado antes de considerar o produto pronto;
- documentacao desta fase no proprio `Shopee.md`;
- cobertura de teste para o motor de validacao e para a integracao visual da aba de envio em massa.

Arquivos envolvidos:

| Area | Arquivo |
| --- | --- |
| Motor de pre-validacao | `services/shopeeAutoPublishReadiness.ts` |
| UI da aba Envio em massa | `pages/admin/settings/ShopeePage.tsx` |
| Teste do motor | `tmp-tests/shopee-auto-publish-readiness.test.mjs` |
| Teste estatico da UI | `tmp-tests/shopee-auto-publish-bulk-ui-static.test.mjs` |
| Documentacao operacional | `Shopee.md` |

Um produto so entra como pronto quando:

- ainda nao esta sincronizado;
- tem template Shopee automatico compativel;
- o template tem categoria Shopee;
- o SKU esta preenchido;
- existe imagem principal;
- preco e estoque sao validos;
- o titulo final e o nome de origem nao contem termo bloqueado.

Bloqueios fazem o produto cair em **Precisa revisao**.

Bloqueios atuais:

| Codigo interno | Motivo exibido | Como resolver |
| --- | --- | --- |
| `already_synced` | Produto ja tem vinculo com a Shopee. | Nao entra no envio automatico; revisar na aba Produtos. |
| `missing_template` | Sem template automatico compativel. | Criar/ajustar template da categoria ou regras de aplicacao. |
| `missing_sku` | SKU nao preenchido. | Corrigir SKU no cadastro local. |
| `missing_image` | Sem imagem principal. | Adicionar imagem ao produto. |
| `invalid_price` | Preco invalido. | Corrigir preco de venda ou regra de preco do template. |
| `invalid_stock` | Estoque precisa ser maior que zero. | Corrigir estoque local ou regra de estoque do template. |
| `missing_category` | Template sem categoria Shopee. | Definir categoria Shopee no template. |
| `blocked_title_term` | Titulo contem termo bloqueado. | Ajustar nome/titulo ou regra perigosa no template. |
| `missing_required_attribute` | Atributo obrigatorio ausente. | Completar os atributos padrao do template. |
| `missing_logistics_channel` | Nenhum canal logistico habilitado para a loja. | Ativar canal logistico na Shopee ou revisar a integracao. |

Avisos nao bloqueantes aparecem em **Motivos**, mas ainda permitem classificar o produto como pronto. Exemplos:

- template sem atributos padrao;
- ausencia de GTIN quando o template deixa o campo em branco.

Observacao: dimensoes seguras padrao ja fazem parte do fluxo corrigido de envio e nao devem aparecer como motivo na pre-validacao. O fallback continua sendo aplicado no payload para evitar erro da Shopee quando o cadastro local nao tem dimensoes.

Quando o produto tem dimensoes cadastradas no Bling, o modal de envio busca o detalhe do Bling e usa essas medidas antes de recorrer ao fallback seguro.

Avisos atuais:

| Codigo interno | Motivo exibido | Observacao |
| --- | --- | --- |
| `missing_attribute_defaults` | Template sem atributos padrao. | Pode publicar se a categoria nao exigir atributos extras, mas e melhor completar o template. |
| `warning_title_term` | Titulo contem termo sensivel. | Nao bloqueia, mas merece revisao se aparecer com frequencia. |
| `missing_gtin` | Sem GTIN/EAN; revise se o produto permite SEM GTIN. | Importante para categorias que exigem codigo de barras. |
| `logistics_not_checked` | Logistica ainda nao validada. | Aparece quando a consulta de canais ainda nao retornou ou falhou. |

### Como interpretar os resultados

Use a pre-validacao como triagem antes de publicar:

- se muitos produtos aparecem como **Sem template automatico compativel**, o gargalo esta nos templates;
- se muitos aparecem como **Template sem categoria Shopee**, falta completar os templates existentes;
- se muitos aparecem como **Sem imagem principal**, o gargalo esta no cadastro/midia;
- se muitos aparecem com **Titulo contem termo bloqueado**, as regras de titulo seguro precisam ser aplicadas antes do envio;
- se aparecem apenas avisos, o produto esta apto para a proxima fase do automatico, mas o operador ainda deve confirmar se a categoria aceita esses defaults.

Essa fase prepara o botao futuro de publicacao automatica, mas mantem o fluxo atual assistido para evitar subir anuncios errados em escala.

### O que ainda falta para publicar automaticamente

O botao **Publicar automaticos** ainda nao foi implementado. A proxima fase deve usar apenas produtos com status **Prontos para automatico**.

Fluxo recomendado:

1. O usuario abre **Shopee > Envio em massa**.
2. Filtra por **Prontos para automatico**.
3. Clica em **Publicar automaticos**.
4. O sistema monta o payload usando o mesmo caminho do modal:
   - template aplicado;
   - titulo final;
   - descricao;
   - categoria Shopee;
   - atributos padrao;
   - preco;
   - estoque;
   - GTIN/EAN ou `SEM GTIN`;
   - peso e dimensoes;
   - imagens;
   - video quando compativel;
   - logistica habilitada.
5. O sistema publica um produto por vez.
6. Cada item do lote recebe status:
   - `Publicado`;
   - `Falhou`;
   - `Pulado`;
   - `Aguardando`.
7. O lote continua mesmo se um produto falhar.
8. No final, a tela mostra um resumo com publicados, falhas e pendentes.

Regras de seguranca para essa fase:

- nao publicar produto que nao esteja **Pronto para automatico**;
- nao publicar variacoes automaticamente ainda;
- nao publicar produto com bloqueio de titulo;
- nao publicar produto sem imagem principal;
- nao publicar produto sem categoria Shopee;
- nao publicar produto sem SKU;
- registrar erro bruto da Shopee para diagnostico;
- manter o operador no controle com um botao explicito, sem agendamento automatico.

### Melhorias pendentes antes ou junto do botao automatico

#### Validacao real de atributos obrigatorios

A pre-validacao agora busca atributos das categorias usadas pelos templates por `action=attributes` e bloqueia o automatico quando um atributo obrigatorio retornado pela Shopee nao esta nos `attributeDefaults` do template.

Fluxo atual:

1. Para cada categoria usada no lote, buscar atributos via `action=attributes`.
2. Criar cache por categoria para nao repetir chamadas.
3. Comparar atributos obrigatorios com `attributeDefaults` do template.
4. Marcar como bloqueio quando faltar atributo obrigatorio.
5. Mostrar o nome do atributo ausente em **Motivos**.

#### Validacao de logistica antes do automatico

A pre-validacao agora consulta `action=logistics_channel_list` e bloqueia o automatico quando nao encontra canal habilitado.

Fluxo atual:

1. Buscar `action=logistics_channel_list`.
2. Confirmar que existe pelo menos um canal habilitado.
3. Bloquear publicacao automatica quando nao houver canal.
4. Mostrar motivo claro: `Nenhum canal logistico habilitado para a loja`.

#### Validacao de video

Video nao deve bloquear a publicacao automatica inicialmente.

Regra recomendada:

- se o video for valido, enviar;
- se falhar com erro nao critico, publicar sem video e registrar aviso;
- se a categoria exigir video futuramente, transformar em bloqueio por categoria.

#### Decisao sobre avisos

Hoje avisos nao bloqueiam. Antes de liberar o botao automatico, decidir se alguns avisos devem virar bloqueio.

Sugestao conservadora:

- `missing_attribute_defaults`: transformar em bloqueio quando a Shopee confirmar atributo obrigatorio ausente;
- `missing_gtin`: manter como aviso apenas quando o template usa `SEM GTIN`; bloquear quando o template exige GTIN real;
- `warning_title_term`: manter como aviso, mas revisar regras de substituicao.

#### Relatorio de lote

O automatico deve gerar um historico mais completo que o envio assistido:

- produto;
- SKU;
- template aplicado;
- item_id retornado pela Shopee;
- status final;
- erro resumido;
- erro bruto para diagnostico;
- horario da tentativa.

Esse historico pode comecar apenas em estado de tela. Depois pode ser salvo em tabela se virar rotina operacional.

#### Retentativa controlada

Nao implementar retry amplo no primeiro botao automatico.

Primeira regra recomendada:

- erro de validacao da Shopee: nao repetir;
- erro de rede temporario: permitir repetir manualmente;
- erro de token: tentar renovar token uma vez e retomar;
- erro de imagem/video: registrar e continuar com o proximo.

### Fora da proxima fase

Manter fora do primeiro botao automatico:

- envio automatico de variacoes;
- agendamento para publicar sem operador;
- IA criando templates sozinha;
- alteracao automatica de produtos ja publicados;
- republicacao ou conversao de anuncio simples para anuncio com variacao;
- alteracao automatica de preco/estoque em anuncios ja existentes.

## Variacoes no mesmo anuncio Shopee

### Primeira entrega: variacoes manuais

A primeira versao sera manual e assistida.

- o operador escolhe explicitamente publicar como anuncio com variacoes;
- o sistema sugere grupos baseados em `parent_id`;
- se nao houver grupo, o modal pode sugerir um grupo pelo nome base do produto, como `Capa de Silicone para Redmi Note 14 5G`, agrupando as opcoes `Cor:*`;
- ao confirmar **Criar grupo de variacoes**, o sistema grava o relacionamento na VPS pelo endpoint `PATCH /products/variation-group`, atualizando apenas `parent_id`;
- quando todos os itens sao variacoes vendaveis e nao existe pai separado, um produto vira a ancora do grupo na VPS, mas continua entrando no `model_list` como variacao;
- cada filho vira um item de `model_list`;
- a primeira dimensao suportada e `Cor`, com suporte tambem a `Modelo`, `Tamanho`, `RAM` e `Armazenamento`;
- cada variacao precisa ter SKU, preco e estoque validos;
- imagem propria por cor e recomendada, mas a imagem principal do anuncio continua obrigatoria;
- o vinculo `shopee_products` sera salvo para o pai e para cada filho usando o mesmo `item_id`;
- cada filho tambem deve guardar o `model_id` da variacao retornado pela Shopee, para permitir atualizar estoque/preco da variacao correta depois;
- no envio em massa assistido, se um item selecionado pertence a um grupo de variacoes, o modal deve publicar o grupo inteiro de filhos carregado da VPS/lista, nao apenas os IDs presentes na fila do lote;
- quando o anuncio com variacoes e publicado, a barra do lote deve considerar o pai e todos os filhos desse grupo como concluidos para nao tentar enviar os mesmos filhos de novo.

### Como deve funcionar

Variacoes devem ser usadas quando varios produtos locais representam o mesmo anuncio com opcoes diferentes, por exemplo:

- mesma capa com cores diferentes;
- mesma pelicula com modelos diferentes;
- mesmo cabo com tamanhos diferentes.

Na Shopee, esse fluxo nao deve criar varios anuncios separados. Deve criar um item principal com `model_list`, onde cada variacao tem:

- SKU proprio;
- preco proprio quando necessario;
- estoque proprio;
- imagem propria quando aplicavel;
- GTIN/EAN proprio quando existir.

### Cor nova em anuncio existente

Quando chegar uma cor nova de um produto/familia que ja possui anuncio na Shopee, o sistema nao deve criar outro anuncio separado.

Regra operacional:

1. O produto novo entra no cadastro local com o mesmo agrupamento dos irmaos, preferencialmente pelo `parent_id`.
2. Antes de publicar, o sistema verifica se algum irmao ja possui vinculo em `shopee_products.shopee_item_id`.
3. Se existir `shopee_item_id`, o fluxo correto passa a ser **Adicionar variacao ao anuncio existente**.
4. O sistema busca o `model_list` atual da Shopee para esse `item_id`.
5. O sistema monta a lista de variacoes com as variacoes ja existentes + a nova cor.
6. A Shopee deve ser atualizada preservando o mesmo `item_id`.
7. Depois da atualizacao, o sistema consulta novamente o `model_list` e vincula o produto novo ao `model_id` retornado pela Shopee.

Resultado esperado:

| Produto local | Cor | `shopee_item_id` | `shopee_model_id` |
| --- | --- | --- | --- |
| Capa Redmi Note 13 Preto | Preto | `123456` | `9001` |
| Capa Redmi Note 13 Azul | Azul | `123456` | `9002` |
| Capa Redmi Note 13 Rosa | Rosa | `123456` | `9003` |

O `shopee_item_id` identifica o anuncio. O `shopee_model_id` identifica a variacao dentro do anuncio.

### Vinculo local x Shopee para variacoes

A tabela `shopee_products` hoje vincula `product_id` local ao `shopee_item_id`. Para variacoes, esse vinculo precisa ser mais especifico.

Campos recomendados para evoluir a tabela:

```sql
ALTER TABLE shopee_products
ADD COLUMN IF NOT EXISTS shopee_model_id bigint,
ADD COLUMN IF NOT EXISTS shopee_model_sku text,
ADD COLUMN IF NOT EXISTS shopee_model_name text,
ADD COLUMN IF NOT EXISTS shopee_tier_index jsonb;
```

Chave de vinculo recomendada:

- primaria: `model_sku` da Shopee igual ao `sku` do produto local;
- fallback: selecao manual pelo operador quando SKU estiver ausente, duplicado ou divergente.

Fluxo de vinculacao apos publicar ou atualizar variacoes:

1. Chamar `get_model_list` para o `shopee_item_id`.
2. Para cada produto local do grupo, procurar um modelo Shopee com `model_sku` igual ao SKU local.
3. Gravar em `shopee_products`:
   - `product_id`;
   - `shopee_item_id`;
   - `shopee_model_id`;
   - `shopee_model_sku`;
   - `shopee_tier_index`;
   - `status = active`;
   - `last_synced_at`.
4. Se nao houver match confiavel por SKU, marcar como vinculo pendente e pedir revisao manual.

Essa regra evita dois problemas:

- publicar uma cor nova como anuncio duplicado;
- atualizar estoque/preco no `model_id` errado dentro do mesmo anuncio.

### Regra de agrupamento local

Antes de implementar variacoes em massa, o sistema precisa saber quais produtos pertencem ao mesmo anuncio.

Possiveis bases de agrupamento:

- `parent_id` local;
- familia/modelo no cadastro;
- SKU base;
- regra do template Shopee;
- selecao manual do operador.

### Etapas recomendadas

1. Implementar envio em massa assistido somente para produtos simples.
2. Criar uma tela de agrupamento de variacoes.
3. Permitir selecionar produto pai e filhos.
4. Mapear dimensoes de variacao, como `Cor`, `Modelo`, `Tamanho`.
5. Montar o payload da Shopee com `tier_variation` e `model_list`.
6. Validar estoque/preco/GTIN por variacao.
7. Publicar variacoes em um unico anuncio.

### Fora da primeira entrega de envio em massa

- Agrupar automaticamente variacoes no mesmo anuncio.
- Converter anuncios simples ja publicados em anuncios com variacao.
- Envio automatico sem revisao.

### Fora da primeira versao

- IA gerando templates automaticamente.
- Sincronizacao totalmente automatica em massa para varios produtos.
- Aprendizado automatico com anuncios derrubados.
- Importacao de templates direto da Shopee.
