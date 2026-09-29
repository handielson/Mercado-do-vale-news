# v1.2.513-shopee-video-compat

Data: 2026-09-29. Status: pronta para publicacao. Branch: main.
Tag: v1.2.513-shopee-video-compat
Release principal: /var/www/mdv-site/releases/20260929-190339-v1-2-513-shopee-video-compat

Quando a Shopee rejeita o processamento do video original, o publicador gera uma copia MP4 H.264 temporaria, estende o quadro final por dois segundos e tenta novamente. O arquivo original no Synology nao e alterado e os temporarios sao removidos automaticamente.

O comportamento foi validado com o SKU XD540: o original de 8,93 segundos foi rejeitado, a copia compativel de 10,93 segundos foi aceita e o item 58269311232 foi publicado na conta G com video, estoque e vinculo confirmados.

Validacoes: 12 testes focados do publicador Shopee, conversao real com FFmpeg e publicacao controlada do XD540.
