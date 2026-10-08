# v1.2.579-seo-soft-404

Data: 2026-10-08. Branch: main. Tag: v1.2.579-seo-soft-404.
Release VPS: /var/www/mdv-site/releases/20261008-181902-seo-soft-404
Status: publicada; cache antigo do Cloudflare pendente de limpeza ou expiracao.

Rotas validas derivadas de routes/index.tsx para Nginx; desconhecidas
retornam 404. WordPress removido e feeds retornam 410. Categorias antigas
consultam o cadastro oficial e redirecionam 301 para a categoria equivalente;
ausencias retornam 410 e falhas temporarias 503. Produtos antigos com ID
numerico redirecionam apenas quando o slug resolve produto publico real.

Paginacao vazia recebe noindex, follow apos todos os lotes, sem erro.
A resposta HTTP das listagens continua 200; agrupamentos, busca, filtros,
visibilidade, precos e estoque mantidos.

API seletiva com backup e preservacao de personalizacoes remotas.
Frontend completo e Nginx publicados separadamente. Testes focados,
sintaxe, build, preflight remoto e nginx -t isolado aprovados.
Validacao publica: 200 nas rotas reais, 404 em caminhos invalidos, 301 em categorias/produtos existentes e 410 nos removidos. Busca 5G indexavel e pagina 999 vazia noindex confirmadas no navegador. API mysql.ok=true. Cloudflare ainda serve HTML antigo 200 em uma URL WordPress; purge recusado com 401. Auditoria preservou 34 worktrees auxiliares (dirty ou not_merged_into_origin_main). Codigo b72e2183 e correcao Nginx 2a26a1cd em origin/main. Tag adicional de recuperacao: v1.2.579-seo-soft-404-validado.
Quatro arquivos Shopee preexistentes fora do escopo.

Arquivos:
- deploy-vps-server-only.cjs
- infra/nginx/mdv-site-production.conf
- infra/nginx/mdv-site-staging.conf
- package.json
- pages/catalog/catalogPagination.js
- pages/catalog/index.tsx
- scripts/sync-nginx-spa-routes.cjs
- scripts/deploy-seo-soft-404.cjs
- server.js
- services/legacyCatalogSeo.cjs
- tmp-tests/legacy-category-nginx-seo-static.test.mjs
- tmp-tests/seo-soft-404.test.cjs
- vps_server.cjs
- vps_server.js
- docs/operacional/2026-10-08-seo-soft-404.md
- public/VERSION.json
- VERSAO_ATUAL.md
- docs/versoes/2026-10-08-v1.2.579-seo-soft-404.md
