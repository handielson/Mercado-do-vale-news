# Paginas SEO de colecoes do catalogo

## Contexto

O catalogo publico ja possui a pagina de todos os produtos em `/produtos`, meta tags via `Helmet`, canonical, paginacao e carregamento progressivo com cache local. A nova necessidade e criar paginas indexaveis para colecoes comerciais com foco em SEO/Google e sem piorar o desempenho do site.

As colecoes iniciais serao:

- Destaques
- Mais recentes
- Mais vendidos

## Objetivos

- Criar URLs estaveis e amigaveis para o Google.
- Reaproveitar a estrutura atual do catalogo, incluindo grid, filtros basicos, cards, cache e paginacao.
- Evitar landing pages pesadas ou duplicacao de logica.
- Permitir que nomes de colecoes funcionem como atalhos para suas paginas.
- Manter controle de quantidade de produtos por pagina.
- Preparar "Mais vendidos" para usar ranking real no futuro, sem trocar a URL.

## Rotas

As paginas ficarao abaixo de `/produtos`:

- `/produtos/destaques`
- `/produtos/mais-recentes`
- `/produtos/mais-vendidos`

`/produtos` continua sendo a pagina de todos os produtos.

Cada rota deve ter canonical proprio e nao deve depender de query string para representar sua intencao principal. Query string continua reservada para paginacao e filtros secundarios quando necessario.

## Navegacao e atalhos

Os nomes das colecoes devem funcionar como links para suas paginas correspondentes. Isso vale para titulos de secoes na home/catalogo e para eventuais atalhos no menu ou em blocos do catalogo.

Exemplos:

- O titulo "Destaques" aponta para `/produtos/destaques`.
- O titulo "Mais recentes" aponta para `/produtos/mais-recentes`.
- O titulo "Mais vendidos" aponta para `/produtos/mais-vendidos`.

Os links devem ser links reais do React Router (`Link`) para melhorar navegacao interna e permitir rastreamento por crawlers que executam JavaScript.

## Conteudo e SEO

Cada pagina tera metadados especificos:

- `title`
- `meta description`
- `canonical`
- H1 visivel
- texto curto opcional abaixo do H1, se ele ajudar a diferenciar a intencao da pagina

Os textos devem ser diretos, comerciais e locais quando fizer sentido, citando Mercado do Vale e Petrolina-PE sem exagerar em repeticao de palavras-chave.

Exemplos de intencao:

- Destaques: produtos selecionados, ofertas e aparelhos recomendados.
- Mais recentes: novidades e ultimos aparelhos cadastrados.
- Mais vendidos: produtos populares da loja, inicialmente por curadoria e futuramente por vendas reais.

## Fontes de produto

### Destaques

Usa a marcacao de destaque existente no catalogo. A pagina deve filtrar para produtos destacados e ordenar de forma coerente com a experiencia atual.

### Mais recentes

Usa a ordenacao atual por produtos recentes. A pagina deve listar produtos ativos e visiveis usando a mesma regra global do catalogo.

### Mais vendidos

Na primeira versao, a pagina sera uma colecao editorial/curada. Como ainda nao existe ranking confiavel de vendas no catalogo publico, ela pode usar uma fonte temporaria simples:

- produtos destacados como fallback inicial; ou
- um marcador curado especifico, se a estrutura atual permitir sem migracao grande.

A decisao de implementacao deve favorecer o menor risco agora. Quando o sistema tiver ranking real por pedidos, a rota `/produtos/mais-vendidos` continuara igual e apenas a fonte de ordenacao/filtro sera trocada.

## Quantidade e paginacao

As paginas devem respeitar a configuracao global atual de quantidade de produtos por pagina (`products_per_page`) e usar a mesma paginacao de `/produtos`.

Isso evita criar uma configuracao nova agora e mantem o desempenho previsivel. Uma configuracao por colecao pode ser adicionada depois, caso exista necessidade real.

## Desempenho

A implementacao deve reaproveitar `CatalogPage`, `useCatalog`, `catalogService` e `ProductGroupGrid` tanto quanto possivel.

Regras de desempenho:

- Nao duplicar carregamento de secoes, banners ou componentes pesados quando uma pagina de colecao nao precisar deles.
- Evitar buscar mais produtos que o necessario para renderizar a pagina e seus grupos.
- Manter o uso de payload compacto da VPS.
- Preservar cache local para paginas sem busca textual.
- Manter imagens prioritarias limitadas aos primeiros cards visiveis.

## Comportamento esperado

- Acessar `/produtos/destaques` mostra titulo e meta tags de Destaques, com apenas produtos destacados.
- Acessar `/produtos/mais-recentes` mostra titulo e meta tags de Mais recentes, ordenado pelos ultimos produtos cadastrados.
- Acessar `/produtos/mais-vendidos` mostra titulo e meta tags de Mais vendidos, usando curadoria temporaria.
- A paginacao usa a propria rota da colecao, por exemplo `/produtos/destaques?page=2`.
- A pagina de todos os produtos continua funcionando como hoje.

## Fora de escopo

- Criar ranking automatico real de vendas agora.
- Criar painel completo de configuracao por colecao.
- Criar landing pages independentes com layout diferente do catalogo.
- Alterar o modelo de produto ou pedidos, exceto se um pequeno marcador curado for escolhido durante a implementacao.

## Validacao

- Rodar testes existentes de paginacao do catalogo.
- Adicionar teste unitario para a configuracao das colecoes, se a implementacao criar helper novo.
- Validar build.
- Verificar no navegador pelo menos `/produtos`, `/produtos/destaques`, `/produtos/mais-recentes` e `/produtos/mais-vendidos`.
- Conferir no DOM que `title`, `description` e canonical mudam por rota.
