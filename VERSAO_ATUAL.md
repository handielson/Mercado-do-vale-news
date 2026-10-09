# v1.2.590-operational-failures

Data: 09/10/2026. Branch: main. Tag: v1.2.590-operational-failures.
Release: /var/www/mdv-site/releases/20261009-185649-operational-failures.

PDV propaga falhas de consulta das unidades e limpa resultados anteriores. Confirmacao por foto exige salvamento bem-sucedido. Lista de campanhas WhatsApp carrega todas as paginas de 200 registros. Somente frontend; nenhum dado comercial alterado. Testes de falha reproduzidos antes da correcao e passando depois.

## Historico

# v1.2.589-system-regressions

Data: 09/10/2026. Branch: main. Tag: v1.2.589-system-regressions.
Release ativa: /var/www/mdv-site/releases/20261009-183823-system-regressions.

Painel preserva hide_from_catalog; falhas temporarias do Bling preservam credenciais e nunca devolvem token vencido; fallback de URLs exige identificacao exata e unica; complemento salvo atualiza pai, filhos e cache administrativo, inclusive com consulta antiga em andamento. Suite npm.cmd run test:regressions centraliza as protecoes. API e dados comerciais nao fazem parte do deploy.

Publicacao concluida: commit 7c6b9140 e tag enviados a main; 68 testes da suite e 9 complementares passaram. Build sem runtime Supabase; homepage e VERSION.json HTTP 200; API ok=true e mysql.ok=true sem restart. Chrome confirmou Sabor iPhone no painel apos reload e link do pai abrindo C17P6256L com imagem e R$ 1300,00; console sem erros. Renovacao Bling validada com transporte simulado, sem renovar credenciais reais. Auditoria apply: 0 removidos e 34 bloqueados (25 dirty, 9 not_merged_into_origin_main), detalhados na nota da versao. Quatro arquivos Shopee preexistentes preservados.

## Historico

# v1.2.588-admin-title-complement

Data: 08/10/2026. Branch: main. Tag: v1.2.588-admin-title-complement.
Release: /var/www/mdv-site/releases/20261009-000947-admin-title-complement.

O hook administrativo descartava catalog_title_complement e parent_catalog_title_complement recebidos da API. Ambos agora sao preservados nos cards. Texto salvo no pai continua a fonte de verdade; nenhum dado foi regravado. API, consulta publica, precos e documentos permanecem intactos.

Testes do complemento, paginacao, busca serializada e cards de familia passaram. Build e publicacao pelo script oficial concluidos. Chrome confirmou Sabor iPhone no campo do C17 Plus apos reload e console sem erros. Commit baa22fd0 e tag enviados a main. API nao reiniciada. Auditoria: 0 removidos, 34 bloqueados (25 dirty, 9 not_merged_into_origin_main), caminhos registrados na nota da versao. Quatro arquivos preexistentes Shopee preservados.

## Historico

# v1.2.587-public-family-variation

Data: 08/10/2026. Branch: main. Tag: v1.2.587-public-family-variation.
Release: /var/www/mdv-site/releases/20261008-234548-public-family-variation.

Pagina publica usa o resolvedor publico para UUIDs e slugs; o pai e excluido antes do agrupamento de variacoes e nunca renderiza preco zero como opcao Padrao. Links antigos do pai com SKU tambem resolvem um filho publico. Filhos ocultos/inativos nao sao escolhidos. Painel continua acessando o pai por ID interno; nenhum dado comercial foi alterado.

14 testes focados, rotas publicas, SEO Fastify e estoque PDV passaram. Publicacao e validacao final concluidas; deploy seletivo preservou codigo remoto. Quatro arquivos preexistentes Shopee preservados fora do escopo.

## Publicacao validada

Commit c8eefe86 e tag v1.2.587-public-family-variation enviados a main. API publicada seletivamente com backup /var/www/mdv-api/backups/parent-public-link-1791503239385; restart mdv-api concluido; status ok=true e mysql.ok=true. Site ativo /var/www/mdv-site/releases/20261008-234548-public-family-variation; homepage HTTP 200 e VERSION.json correspondente. Build sem runtime Supabase.

Validacao sem credenciais: UUID, slug e endereco antigo com SKU do pai C17 resolvem o filho 10b2a984-c51a-45a6-8d41-5e0926dd1566, is_parent=0, preco 130000 centavos. Pais Poco X8 Pro e Redmi 17 tambem resolvem filhos com preco positivo. HTML do pai e endereco antigo retornam 200 com canonical do filho e sem oferta zero; UUID inexistente continua 410.

Chrome confirmou imagem, SKU C17P6256L e R$ 1300,00, apenas Laranja/Prata, sem opcao Padrao e sem erros no console. Troca para Prata e recarregamento mantiveram SKU C17P6256P e R$ 1300,00. Nenhum dado comercial alterado.

Worktrees: auditoria e apply concluido, 0 candidatos/0 removidos/34 bloqueados (25 dirty, 9 not_merged_into_origin_main). Quatro arquivos preexistentes Shopee preservados. Avisos CRLF, credential helper Git e timings do build nao impediram publicacao. Skill nao alterada.

Bloqueados preservados:
- C:/tmp/mdv-model-fix-clean — dirty
- C:/tmp/mdv-phone-filter — dirty
- C:/tmp/mdv-publish-surgical-20260612-b — dirty
- C:/tmp/mdv-refactor-repair-20260612 — dirty
- C:/tmp/mdv-virtual-ram-deploy — dirty
- C:/Users/Nitro/Documents/Codex/2026-10-02/task/ml-local-preview — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-phone-memory-filter-20260801 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-price-followup-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-product-search-specialist-20260725 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-remove-generic-freight-example-20260718 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/sale-message-order-number-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mdv-perf-main — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-admin-app — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-displays-pix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-sales-push-20260728 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-integrate — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-reformulation — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/meta-smartphones-sem-preco-20260825 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/new-model-regressions — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdp-model-shortcut-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdv-sale-repair-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-autoresponder-editable — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-family-page-jump — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-receipt-private-payment-20260613 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-sales-summary-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-whatsapp-order — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/repair-refactor-product-build — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/signed-warranty-synology — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/system-backup-admin-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-bulk-release-20260727 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-shop-foundation — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-n8n-context-handoff-fix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-publish-novo-bot — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-status-contacts-fix — dirty


## Registro anterior

# v1.2.586-parent-public-link

Data: 08/10/2026. Branch: main. Tag: v1.2.586-parent-public-link. Release: /var/www/mdv-site/releases/20261008-224025-parent-public-link.

Correcao geral da resolucao SEO de UUID/slug do pai: busca uma variacao publica elegivel, prioriza estoque e mantem rota canonica da variacao. O pai nao aparece como item vendavel separado. Produtos comuns e variacoes conservam precedencia; familias sem filhos elegiveis continuam indisponiveis. Nenhum cadastro comercial, estoque, preco ou schema foi alterado.

Deploy seletivo --parent-public-link-only insere apenas o fallback na funcao SEO dos servidores, com backup e rollback. Preflight detectou server.js remoto com resolver SEO mais rico ja existente; patch preserva essa implementacao, aceitando apenas os baselines verificados.

Validacoes: 10 testes, rotas publicas, SEO Fastify, guarda PDV e sintaxe. Publicacao e auditoria final pendentes de verificacao.

Arquivos:
- server.js
- vps_server.js
- vps_server.cjs
- deploy-vps-server-only.cjs
- scripts/deploy-parent-public-link.cjs
- tmp-tests/seo-parent-family.test.cjs
- public/VERSION.json
- VERSAO_ATUAL.md
- docs/versoes/2026-10-08-v1.2.586-parent-public-link.md

Arquivos Shopee preexistentes preservados fora do escopo.

## Publicacao validada

Commit 583b13be e tag v1.2.586-parent-public-link enviados a main. API publicada seletivamente; backup /var/www/mdv-api/backups/parent-public-link-1791499527265; restart mdv-api concluido, status ok=true e mysql.ok=true. Site ativo /var/www/mdv-site/releases/20261008-224025-parent-public-link, homepage HTTP 200, VERSION.json correspondente, build sem runtime Supabase.

URLs de tres pais (C17 Plus, Poco X8 Pro e Redmi 17) retornaram HTTP 200; UUID inexistente continua HTTP 410. Chrome confirmou o link reportado abrindo C17 Plus com Laranja e Prata; titulo e complemento do pai mantidos; sem erros no console. Nenhum dado comercial alterado.

Worktrees: 0 candidatos, 0 removidos, 34 bloqueados; {"dirty":25,"not_merged_into_origin_main":9}. Quatro arquivos preexistentes Shopee preservados. Skill nao alterada; modo seletivo especifico versionado no deploy oficial. Avisos conhecidos CRLF, Browserslist antigo e credential helper Git nao impediram publicacao.

Bloqueados preservados:
- C:/tmp/mdv-model-fix-clean — dirty
- C:/tmp/mdv-phone-filter — dirty
- C:/tmp/mdv-publish-surgical-20260612-b — dirty
- C:/tmp/mdv-refactor-repair-20260612 — dirty
- C:/tmp/mdv-virtual-ram-deploy — dirty
- C:/Users/Nitro/Documents/Codex/2026-10-02/task/ml-local-preview — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-phone-memory-filter-20260801 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-price-followup-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-product-search-specialist-20260725 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-remove-generic-freight-example-20260718 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/sale-message-order-number-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mdv-perf-main — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-admin-app — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-displays-pix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-sales-push-20260728 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-integrate — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-reformulation — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/meta-smartphones-sem-preco-20260825 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/new-model-regressions — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdp-model-shortcut-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdv-sale-repair-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-autoresponder-editable — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-family-page-jump — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-receipt-private-payment-20260613 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-sales-summary-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-whatsapp-order — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/repair-refactor-product-build — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/signed-warranty-synology — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/system-backup-admin-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-bulk-release-20260727 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-shop-foundation — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-n8n-context-handoff-fix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-publish-novo-bot — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-status-contacts-fix — dirty
