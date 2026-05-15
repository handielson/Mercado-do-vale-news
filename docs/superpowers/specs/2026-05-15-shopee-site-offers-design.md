# Ofertas/Kits para Site e Shopee

Data: 2026-05-15

## Objetivo

Evoluir a tela atual de **Kits & Combos** para uma central de ofertas comerciais. A oferta deve nascer primeiro no sistema, aparecer no site e depois poder ser publicada/sincronizada com a Shopee.

A feature cobre dois tipos de oferta:

- Kit por quantidade do mesmo produto, como `1 unidade`, `Kit 2`, `Kit 5`.
- Combo de produtos diferentes, como `Capa + Pelicula`.

## Decisoes

- A tela atual `Produtos > Kits & Combos` sera reaproveitada e evoluida para `Produtos > Ofertas/Kits`.
- A oferta criada no sistema deve aparecer no site de duas formas:
  - como opcao dentro da pagina do produto principal;
  - como produto/anuncio separado no catalogo, com pagina propria.
- A oferta deve poder refletir na Shopee:
  - como variacao/modelo dentro do anuncio principal quando couber;
  - como anuncio separado quando a Shopee nao aceitar mais dimensoes de variacao.
- O estoque sempre sera calculado em cima do estoque real do Bling.
- SKUs serao gerados automaticamente, mas editaveis antes de salvar/publicar.
- A sincronizacao de estoque com a Shopee deve ser automatica quando o sistema atualizar estoque a partir do Bling.

## Modelo de Oferta

Cada oferta deve ter:

- tipo: `quantity_kit` ou `product_combo`;
- produto principal, quando existir;
- itens componentes e quantidades;
- nome;
- SKU;
- preco de varejo, revenda e atacado;
- imagens;
- descricao;
- status;
- visibilidade no site;
- estrategia Shopee: variacao no anuncio principal ou anuncio separado;
- vinculos Shopee salvos apos publicacao.

Para kits por quantidade, o componente e o proprio produto base com quantidade maior que 1.

Para combos, os componentes sao produtos diferentes, cada um com sua quantidade.

## Site

Ao salvar uma oferta ativa e visivel:

- o catalogo deve exibir a oferta como produto proprio;
- a pagina do produto principal deve listar a oferta como opcao de compra relacionada;
- o carrinho deve tratar a oferta como uma linha vendavel;
- ao vender, o estoque decrementado deve respeitar os componentes da oferta.

Na pagina publica do produto, as ofertas devem aparecer junto das opcoes comerciais do produto, sem substituir o produto unitario.

## Estoque Pelo Bling

O estoque disponivel da oferta e derivado do Bling:

- kit por quantidade: `floor(estoque_bling_produto / quantidade_do_kit)`;
- combo: menor quantidade possivel entre todos os componentes;
- variacao + kit: calcula usando o estoque Bling da variacao/produto especifico.

Exemplos:

- Produto com estoque Bling 10 e kit de 3 unidades: estoque da oferta = 3.
- Combo com 10 capas e 4 peliculas: estoque da oferta = 4.

O sistema nao deve permitir que estoque manual sobrescreva o calculo da oferta para Shopee.

## Shopee

Na central de ofertas, cada oferta pode ser publicada/sincronizada com a Shopee.

Quando couber no anuncio principal, a oferta vira modelo/variacao. Exemplos:

- `Vermelho - 1 un`
- `Vermelho - Kit 2`
- `Azul - 1 un`
- `Azul - Kit 2`

Quando adicionar a oferta exigiria uma terceira dimensao nao suportada pela Shopee, a oferta deve virar anuncio separado.

Combos de produtos diferentes terao escolha por oferta:

- publicar como variacao/opcao dentro de um anuncio existente quando couber;
- publicar como anuncio separado.

## Vinculos Shopee

Apos publicar, o sistema deve salvar vinculo suficiente para atualizar estoque e preco depois:

- `product_id` ou `offer_id`;
- `shopee_item_id`;
- `shopee_model_id`, quando for variacao;
- SKU enviado;
- tipo da oferta;
- quantidade do kit ou componentes do combo;
- data da ultima sincronizacao;
- status.

Esse vinculo deve permitir atualizacao automatica de estoque sem depender de redescobrir o anuncio na Shopee.

## Fluxo Administrativo

1. Usuario entra em `Produtos > Ofertas/Kits`.
2. Clica em `Nova Oferta`.
3. Escolhe `Kit por quantidade` ou `Combo de produtos`.
4. Seleciona produto base ou produtos componentes.
5. Sistema sugere nome, SKU, preco, imagens e descricao.
6. Usuario pode editar nome, SKU, precos, imagens e descricao.
7. Sistema calcula estoque pelo Bling.
8. Usuario salva.
9. Oferta passa a aparecer no site.
10. Usuario publica/sincroniza a oferta com a Shopee pela propria tela.

## Tratamento de Erros

- Se algum componente nao tiver `bling_id`, a oferta deve avisar que nao pode calcular estoque confiavel pelo Bling.
- Se a Shopee rejeitar variacao por limite de dimensoes, o sistema deve sugerir publicacao como anuncio separado.
- Se faltar imagem, categoria Shopee ou atributo obrigatorio, o fluxo deve bloquear publicacao e mostrar o campo pendente.
- Se uma atualizacao automatica de estoque falhar na Shopee, o erro deve ficar visivel para nova tentativa manual.

## Testes

Cobrir pelo menos:

- calculo de estoque de kit por quantidade;
- calculo de estoque de combo por menor componente;
- geracao de SKU padrao editavel;
- decisao entre variacao Shopee e anuncio separado;
- salvamento dos vinculos Shopee por oferta;
- exibicao da oferta no catalogo e na pagina do produto principal;
- sincronizacao de estoque a partir do Bling para modelos/anuncios Shopee.

## Fora do Escopo Inicial

- Criacao automatica de anuncios Shopee sem acao do usuario.
- Promocoes/campanhas nativas da Shopee.
- Regras avancadas de preco dinamico.
- Combos infinitamente aninhados, como combo dentro de combo.
