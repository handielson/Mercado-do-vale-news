# TikTok Shop — módulos comerciais

Pesquisa oficial atualizada em 26 de julho de 2026.

## 1. Pedidos e estoque no Bling

Fontes:

- https://partner.tiktokshop.com/docv2/page/650b1b4bbace3e02b76d1011
- https://partner.tiktokshop.com/docv2/page/1-order-status-change
- https://partner.tiktokshop.com/docv2/page/tts-webhooks-overview
- https://partner.tiktokshop.com/docv2/page/get-order-detail-202309

Decisões:

- Escopo necessário: `seller.order.info`.
- Consultar detalhes em `GET /order/202309/orders`.
- Receber `ORDER_STATUS_CHANGE`, mas manter polling periódico porque a documentação informa que webhooks não devem ser a única fonte.
- Considerar venda confirmada em `AWAITING_SHIPMENT`.
- Registrar `tts_notification_id`, `order_id`, status e versão antes de qualquer mutação.
- Baixar o Bling uma única vez por pedido + SKU.
- Em `CANCEL`, estornar somente movimentos anteriormente confirmados.
- Nunca baixar novamente estoque em reentrega do mesmo webhook.

## 2. Calculadora e preço

Fontes:

- https://partner.tiktokshop.com/docv2/page/update-price-202309
- https://partner.tiktokshop.com/docv2/page/finance-api-overview

Decisões:

- Escopo de escrita: `seller.product.write`.
- O cálculo usa custo do produto, comissão configurável, tarifa de transação, impostos, anúncios, tarifa fixa, embalagem e frete líquido de subsídio.
- Taxas não serão fixadas no código: variam por loja, campanha e período.
- A sincronização usa `POST /product/202309/products/{product_id}/prices/update`.
- Só sincronizar após confirmação explícita do usuário.

## 3. Venda e etiqueta

Fontes:

- https://partner.tiktokshop.com/docv2/page/fulfillment-api-overview
- https://partner.tiktokshop.com/docv2/page/get-package-shipping-document-202309
- https://partner.tiktokshop.com/docv2/page/br-market-zpl-format-support-for-shipping-documents

Decisões:

- Escopo: `seller.fulfillment.basic`.
- Para TikTok Shipping no Brasil, enviar a nota fiscal antes de organizar o despacho.
- Depois do envio organizado, consultar:
  `GET /fulfillment/202309/packages/{package_id}/shipping_documents`.
- Oferecer PDF A6 e ZPL, sem recortar ou alterar a etiqueta.
- Para Seller Shipping/Correios próprio, gerar a etiqueta pelo provedor local e devolver rastreio ao TikTok pelo fluxo de fulfillment.

## 4. Envio de produto

Fontes:

- https://partner.tiktokshop.com/docv2/page/products-api-overview
- https://partner.tiktokshop.com/docv2/page/create-product-202309
- https://partner.tiktokshop.com/docv2/page/create-product-api-now-supports-an-idempotency-key
- https://partner.tiktokshop.com/docv2/page/get-attributes-202309

Decisões:

- Escopos: `seller.product.basic` e `seller.product.write`.
- Consultar categoria, regras, atributos, marcas e armazéns antes do envio.
- Fazer upload das imagens para o TikTok; não reutilizar URLs locais como se fossem URIs do TikTok.
- Criar primeiro como `AS_DRAFT`.
- Usar UUID v4 como `idempotency_key`.
- Persistir IDs de produto e SKU do TikTok em tabela própria.
- Publicar como `LISTING` somente depois da validação do rascunho.
