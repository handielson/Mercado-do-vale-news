# Ofertas e kits no site e na Shopee

Documento de producao para criar anuncios de kit/oferta no sistema e refletir no site e na Shopee.

## Onde criar

No admin, acesse `Produtos > Ofertas`.

Use:

- `Nova Oferta` para criar kits promocionais.
- `Kit por quantidade` quando o anuncio e do mesmo produto em varias unidades, exemplo `3x Capa Redmi Note 8`.
- `Combo de produtos` quando o anuncio mistura produtos diferentes.

## Campos principais

- `Nome da Oferta`: nome que aparece no sistema, site e base de sincronizacao.
- `SKU da Oferta`: SKU proprio do kit. O sistema sugere um SKU, mas ele pode ser ajustado.
- `Visibilidade no site`:
  - `Visivel`: o kit aparece como produto/oferta no site.
  - `Oculto`: o kit existe para operacao e Shopee, mas nao aparece na vitrine do site.
- `Shopee`:
  - `Variacao do produto base`: cria/atualiza o anuncio Shopee com duas opcoes, como `Unidade` e `Kit 3 un`.
  - `Item separado`: cria o kit como um anuncio proprio na Shopee.

## Estoque

O estoque do kit e sempre calculado em cima do estoque dos produtos filhos que vem do Bling.

Exemplos:

- Produto base com estoque `9` e kit `3 unidades`: estoque do kit = `3`.
- Produto base com estoque `2` e kit `3 unidades`: estoque do kit = `0`.
- Combo com dois itens: o estoque do combo e o menor saldo possivel entre os filhos.

O kit nao deve ter estoque manual proprio. Quando o Bling envia atualizacao de estoque:

1. O produto base e atualizado no sistema/VPS.
2. A VPS calcula quais kits foram afetados.
3. O webhook atualiza os vinculos da Shopee:
   - modelo da unidade, quando existir;
   - modelo do kit, quando o kit for variacao;
   - anuncio separado, quando o kit tiver vinculo proprio.

## Fluxo recomendado

1. Confirme que o produto base ja existe no sistema e esta com estoque vindo do Bling.
2. Crie a oferta em `Produtos > Ofertas`.
3. Escolha se o kit aparece no site.
4. Escolha a estrategia da Shopee.
5. Salve.
6. Va em `Configuracoes > Shopee`.
7. Sincronize o kit:
   - se for `Variacao`, o modal ja deve sugerir o grupo `Unidade / Kit N un`;
   - se for `Item separado`, publique como anuncio normal.
8. Depois de publicado, as proximas atualizacoes de estoque do Bling atualizam o estoque do kit na Shopee.

## Observacoes de operacao

- Para kit por quantidade, prefira manter apenas um produto filho com a quantidade desejada.
- Para combo de produtos diferentes, inclua todos os filhos e suas quantidades.
- Se a oferta estiver oculta no site, ela ainda pode ser usada na Shopee.
- Se uma oferta ja estiver vinculada a Shopee, o botao no card deve abrir o link do anuncio em vez de mostrar apenas mensagem de aviso.
- Se a Shopee nao receber estoque, verifique se existe linha em `shopee_products` para o produto/kit com `shopee_item_id` e, quando for variacao, `shopee_model_id`.

## Verificacao tecnica desta entrega

Comandos executados:

- `node tmp-tests\product-offer-engine.test.mjs`
- `node tmp-tests\shopee-offer-mapping.test.mjs`
- `node tmp-tests\bling-shopee-stock-sync.test.mjs`
- `npm.cmd run build`

Commits principais:

- `25a9501 feat(offers): add offer calculation engine`
- `aaf0002 feat(offers): add offer metadata migrations`
- `6d588bb feat(offers): expose VPS offer endpoints`
- `8befd13 feat(offers): add admin offer center`
- `7fe02a9 feat(offers): show site offers`
- `cc565ab feat(offers): map offers to Shopee variations`
- `0766fe9 feat(offers): sync kit stock to Shopee from Bling`
