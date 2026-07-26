# TikTok Shop - Solucoes de problemas

## Coluna `shipping_weight` inexistente ao criar rascunho

- Data: 2026-07-26
- Area: produtos / VPS
- Sintoma: o proxy devolvia HTTP 502 ao chamar `POST /tiktok-shop/products/drafts`.
- Evidencia: o log da API registrou `Unknown column 'shipping_weight' in 'field list'` antes de qualquer chamada de criacao ao TikTok.
- Causa: a consulta local selecionava campos opcionais `shipping_*` que nao existem na tabela `products` de producao.
- Correcao: a consulta usa somente `weight_kg` e `dimensions`, campos existentes e suficientes para montar peso e dimensoes do pacote.
- Protecao: o teste estatico impede que a consulta de criacao volte a depender de colunas `shipping_*`.
- Risco restante: depois dessa correcao, o TikTok ainda pode validar regras comerciais do produto; esses erros devem ser tratados pelo codigo e `request_id` oficiais.

## Imagem local em base64 bloqueada ao criar rascunho

- Data: 2026-07-26
- Area: produtos / midia / VPS
- Sintoma: o proxy devolvia HTTP 502 e o log registrava `Imagem fora dos dominios autorizados do Mercado do Vale`.
- Evidencia: o produto possuia duas imagens HTTPS controladas e uma imagem valida `data:image/jpeg;base64`.
- Causa: a validacao aceitava apenas URLs HTTPS, embora o banco de imagens do proprio sistema tambem armazene imagens locais em data URI.
- Correcao: data URIs de JPEG, PNG, WEBP, HEIC e BMP sao decodificadas no backend, validadas pelo tipo e limite de 10 MB e enviadas diretamente ao endpoint oficial de imagens.
- Protecao: URLs remotas continuam restritas aos dominios controlados; nenhum novo dominio externo foi liberado.
- Melhoria adicional: o envio agora inicia um processo assincrono e o modal consulta cada etapa, evitando que um processamento longo termine como pagina HTML 502 do proxy.
