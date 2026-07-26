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
