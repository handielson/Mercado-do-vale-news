# TikTok Shop — contrato mínimo da integração

Consulta realizada em 26 de julho de 2026 nas páginas oficiais do TikTok Shop Partner Center.

## Escopo da primeira versão

- OAuth do vendedor com estado assinado e nonce de uso único.
- Armazenamento dos tokens somente no servidor.
- Renovação do access token antes do vencimento.
- Consulta das lojas autorizadas e armazenamento interno do `shop_cipher`.
- Exposição ao navegador apenas de status seguro e metadados não sensíveis.

Produtos, estoque, pedidos, logística, webhooks e conciliação financeira ficam fora desta versão.

## Contrato oficial usado

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
