# Complemento do título no catálogo

Campo opcional `products.catalog_title_complement`, exclusivo do produto pai. A coluna é criada de forma idempotente pelo bootstrap da API operacional `vps_server.cjs` na próxima publicação. Nenhuma migration ou gravação foi executada em produção durante o desenvolvimento.

Na lista administrativa, o editor aparece abaixo do nome da família. Permite escrever até 120 caracteres, conferir uma prévia e salvar ou cancelar. Vazio remove o complemento. Famílias usam o cadastro do pai, inclusive ao trocar a variação selecionada.

`PATCH /products/:id/catalog-title` exige a autenticação administrativa existente e atualiza somente o complemento e `updated_at`; rejeita produtos filhos. A leitura retorna `parent_catalog_title_complement` obtido diretamente do pai. Não há cópia do texto para cada filho.

`services/catalogTitle.js` concatena o nome e o texto para os títulos dos cards públicos e o H1 da página pública. Não modifica o objeto do produto, `name`, o nome da família/modelo, slug, buscas, metadados SEO, carrinho, PDV, comprovantes, termos de garantia ou payloads de marketplaces. As especificações técnicas não contêm esse campo.

Validações: 4 testes em `tmp-tests/catalog-title.test.mjs`, 5 regressões de breadcrumb público, 31 testes funcionais de garantia assinada, sintaxe da API e build de produção passaram. A verificação estática adicional de garantia assinada contém uma expectativa antiga de `runMigrations().then(() => ...)`; a entrada operacional já usa callback async no HEAD anterior e falha nessa expectativa antes desta mudança. Não foi alterada fora do escopo.

Publicação pendente: requer API (módulo `services/catalogTitleServer.cjs` e entrada operacional), criação da coluna pelo bootstrap e frontend juntos, seguindo a skill `publish-vps`. A instalação em VPS deve incluir o módulo novo antes de reiniciar a API. Não publicar somente o frontend, pois o endpoint ainda não existe na versão publicada.
