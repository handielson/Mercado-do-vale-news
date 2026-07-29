# v1.2.120-shopee-fiscal-print

Publicação seletiva do fluxo automático da Shopee.

- Localiza e autoriza no Bling a NF-e vinculada ao número exato do pedido.
- Envia o XML autorizado à Shopee antes de preparar o envio.
- Em erro fiscal, como NCM ou CEST, envia um aviso ao aplicativo Gestão MDV.
- Prepara o envio, baixa e amplia a etiqueta para a térmica 10x15.
- Gera um resumo de separação 10x15 com itens e código de rastreio.
- Marca etiqueta e resumo separadamente para impedir reimpressões em loop.
- Bloqueia ciclos simultâneos do serviço local.

Release VPS: `/var/www/mdv-site/releases/20260729-170413-shopee-fiscal-print`
