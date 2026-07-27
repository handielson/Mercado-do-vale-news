# TikTok Shop — contrato mínimo da integração

Consulta realizada em 26 de julho de 2026 nas páginas oficiais do TikTok Shop Partner Center.

## Escopo da primeira versão

- OAuth do vendedor com estado assinado e nonce de uso único.
- Armazenamento dos tokens somente no servidor.
- Renovação do access token antes do vencimento.
- Consulta das lojas autorizadas e armazenamento interno do `shop_cipher`.
- Exposição ao navegador apenas de status seguro e metadados não sensíveis.

Produtos, estoque, pedidos, logística, webhooks e conciliação financeira ficam fora desta versão.

## Descoberta de catalogo para o Brasil

Fontes verificadas em 26 de julho de 2026:

- https://partner.tiktokshop.com/docv2/page/get-categories-202309
- https://partner.tiktokshop.com/docv2/page/get-category-rules-202309
- https://partner.tiktokshop.com/docv2/page/get-attributes-202309
- https://partner.tiktokshop.com/docv2/page/upload-product-image
- https://partner.tiktokshop.com/docv2/page/create-product-api-now-supports-an-idempotency-key

Regras aplicadas:

- A loja BR usa `category_version=v1` e `locale=pt-BR`.
- A categoria selecionada deve ser folha e estar disponivel para o seller.
- Regras e atributos obrigatorios devem ser consultados em tempo real antes da criacao.
- Imagens externas precisam ser enviadas pelo endpoint oficial de upload antes de criar o produto.
- A futura criacao sera feita como `AS_DRAFT` e usara UUID v4 em `idempotency_key`.
- A primeira etapa do painel e somente leitura: produto local, categoria, regras e lacunas de cadastro.

## Contrato oficial usado

### Criacao segura de rascunho

Fontes verificadas em 26 de julho de 2026:

- https://partner.tiktokshop.com/docv2/page/create-product-202309
- https://partner.tiktokshop.com/docv2/page/draft-status-available-for-create-product-api
- https://partner.tiktokshop.com/docv2/page/create-product-api-now-supports-an-idempotency-key
- https://partner.tiktokshop.com/docv2/page/upload-product-image
- https://partner.tiktokshop.com/docv2/page/get-warehouse-list-202309

Regras aplicadas:

- Criar o produto local pelo `POST /product/202309/products` com `save_mode=AS_DRAFT`.
- Usar UUID v4 em `idempotency_key` e reutiliza-lo quando o mesmo payload precisar ser repetido.
- Fazer upload de cada imagem pelo `POST /product/202309/images/upload`; URLs locais nao podem ser usadas diretamente no produto.
- Aceitar no servidor somente imagens HTTPS dos dominios controlados pelo Mercado do Vale.
- Consultar o armazem pelo `GET /logistics/202309/warehouses` e usar somente armazem de venda habilitado.
- Exigir os escopos `seller.product.write` e `seller.logistics` no painel antes de liberar o envio.
- Persistir produto, SKU, categoria, estado, imagens enviadas e falha sanitizada na tabela TikTok propria.
- A criacao como rascunho nao torna o item visivel para compradores.

### Midia e acompanhamento do envio

Fontes verificadas em 26 de julho de 2026:

- https://partner.tiktokshop.com/docv2/page/upload-product-file-202309
- https://partner.tiktokshop.com/docv2/page/upload-product-image-and-upload-product-file-support-more-file-formats

Regras aplicadas:

- Imagens HTTPS controladas e imagens locais `data:image/...;base64` passam pela mesma validacao de formato e limite de 10 MB antes do upload.
- Videos cadastrados sao baixados somente dos dominios controlados, limitados a 100 MB e enviados por `POST /product/202309/files/upload`.
- Antes do upload, o backend ajusta videos fora da faixa de proporcao `9:16` a `16:9` com preenchimento centralizado, sem cortar nem deformar o conteudo.
- O TikTok recomenda video `1:1`, resolucao minima HD 720p e duracao entre 20 e 60 segundos.
- O ID retornado pelo upload de arquivo e associado ao campo `video` do rascunho.
- A criacao longa roda como um processo de backend consultado pelo painel; cada etapa exibe estado real (`running`, `done`, `skipped` ou `error`).
- O processo expira da memoria em 30 minutos e nunca expoe tokens, segredos ou shop cipher.

### Publicacao do rascunho e acompanhamento do anuncio

Fontes verificadas em 27 de julho de 2026:

- https://partner.tiktokshop.com/docv2/page/edit-product-202509
- https://partner.tiktokshop.com/docv2/page/activate-product-202309
- https://partner.tiktokshop.com/docv2/page/get-product-202309
- https://partner.tiktokshop.com/docv2/page/get-attributes-202309
- https://seller-br.tiktok.com/university/essay?knowledge_id=4339061972092689&lang=pt-BR

Regras aplicadas:

- `Activate Product` nao publica produtos em `DRAFT`; esse endpoint aceita produtos anteriormente desativados.
- Para publicar um rascunho local, consultar primeiro o produto atual pelo `Get Product` com `return_draft_version=true`.
- Converter a categoria folha retornada em `categories[]` pelo `Get Product` para o campo `category_id` exigido pelo `Edit Product`.
- Quando o `Get Product` de um rascunho omitir tanto `category_id` quanto `categories[]`, reutilizar `tiktok_category_id` persistido no vinculo durante a criacao do rascunho.
- Converter `brand.id` para `brand_id` quando a marca estiver presente no rascunho retornado.
- Reenviar todos os campos editaveis pelo `PUT /product/202509/products/{product_id}` com `save_mode=LISTING`.
- Nao montar a publicacao a partir de uma copia parcial local: campos ausentes em uma edicao completa podem apagar dados existentes.
- Depois do envio, persistir `PENDING` e consultar o `Get Product` ate o TikTok retornar `ACTIVATE` ou `FAILED`.
- Tratar `data.errors` como falha mesmo quando o envelope da resposta retorna `code=0`.
- Consultar os atributos atuais da categoria antes da publicacao e enviar os valores obrigatorios com os IDs retornados pelo TikTok.
- Aceitar tanto `is_required` quanto a grafia historica `is_requried` devolvida pelo `Get Attributes`.
- Para a categoria `985480` de suprimentos de impressao 3D, declarar automaticamente `Nao` no atributo ANATEL `102427`; o ID do valor nunca e fixado e sempre vem do catalogo atual da loja.
- Retornar erros de negocio do TikTok como validacao HTTP 422 com `code` e `request_id`, evitando que o proxy transforme a resposta em uma pagina HTML 502.
- O atalho de rascunhos abre `https://seller-br.tiktok.com/product`; o anuncio publico so e liberado no estado `ACTIVATE`.

### Assinatura das APIs

Fonte: https://partner.tiktokshop.com/docv2/page/sign-your-api-request

1. Remover `sign` e `access_token` dos parâmetros usados na assinatura.
2. Ordenar os demais parâmetros por nome.
3. Concatenar cada nome com seu valor.
4. Prefixar o resultado com o path da API.
5. Acrescentar o body quando a requisição não for multipart.
6. Envolver o conteúdo com o App Secret no início e no fim.
7. Gerar HMAC-SHA256 usando o App Secret como chave.

### Lojas autorizadas

Fonte: https://partner.tiktokshop.com/docv2/page/get-authorized-shops-202309

- Método e path: `GET /authorization/202309/shops`
- Host global: `https://open-api.tiktokglobalshop.com`
- Escopo: `seller.authorization.info`
- Header: `x-tts-access-token`
- Query obrigatória: `app_key`, `timestamp`, `sign`
- O campo `cipher` retornado identifica a loja nas APIs que exigem shop cipher e não deve ser exposto ao navegador.

### Conexão da loja

Fonte: https://partner.tiktokshop.com/docv2/page/connecting-shops

O vendedor autoriza o aplicativo pela URL de serviço. O callback troca o código por tokens e, em seguida, a aplicação consulta as lojas autorizadas.

## Regras de regressão

- Nunca retornar App Secret, access token, refresh token ou shop cipher pelos endpoints administrativos genéricos.
- Nunca preencher novamente o campo de App Secret no frontend.
- As rotas de configuração, início do OAuth e consulta de lojas exigem autenticação administrativa.
- O callback OAuth permanece público, mas exige estado válido, assinado, dentro do prazo e de uso único.
- Manter `server.js`, `vps_server.js` e `vps_server.cjs` funcionalmente equivalentes.
