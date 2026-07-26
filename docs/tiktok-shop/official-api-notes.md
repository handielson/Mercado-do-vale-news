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
