# v1.2.609-rascunhos-json

Data: 11/10/2026. Branch: main. Tag: v1.2.609-rascunhos-json.
Release MDV: /var/www/mdv-site/releases/20261011-231242-rascunhos-json.
Status: publicada e validada. Commit: e9241ac3.

Correcao da lista administrativa de rascunhos: mysql2 ja interpreta colunas do tipo JSON retornadas por JSON_EXTRACT. O endpoint tentava JSON.parse novamente sobre UUID, titulo e datas simples, causando HTTP 500. A consulta leve agora projeta os oito campos como CHAR, mantendo a serializacao JSON ate a unica decodificacao. Titulos parecidos com JSON preservam seu tipo e conteudo; revisao e flags preservam numero/booleano/null.

O teste antigo simulava somente strings JSON serializadas; o fixture agora reproduz a decodificacao automatica real do driver, e o teste novo falha antes da correcao. Inclui UUID, datas, titulos numericos, true, null, aspas, listas, Unicode e booleanos ausentes/falsos. Nao retorna snapshots na lista.

Publisher seletivo aceita a baseline revisada do modulo de rascunhos da release v1.2.607, a versao atual ou instalacao ausente. Rejeita drift desconhecido; preflight e repeticao testados. Preserva entrypoints remotos e integracoes, com backup, sintaxe, rollback e healthcheck pelo fluxo oficial.

Escopo: modulo autenticado de rascunhos e publisher; site atualizado para a versao. Nenhuma gravacao ou migration no banco, arquivo de rascunho ou flag de producao. Rascunhos existentes preservados.

Validacoes locais: 38 testes focados de rascunhos, publisher, familia e cadastro 3D; sintaxe dos servidores, modulo e publisher. Build e verificacao publica seguem no fechamento.

Arquivos da entrega:
- services/productFormDraftsServer.cjs
- scripts/deploy-product-registration.cjs
- tmp-tests/product-form-drafts.test.cjs
- tmp-tests/deploy-product-registration.test.cjs
- public/VERSION.json
- VERSAO_ATUAL.md
- docs/versoes/2026-10-11-v1.2.609-rascunhos-json.md

## Fechamento da publicacao

Publicado e validado em 11/10/2026. Commit: e9241ac3. Tag v1.2.609-rascunhos-json enviada ao origin; main sincronizada. Site ativo: /var/www/mdv-site/releases/20261011-231242-rascunhos-json. Site 3DMV preservado.

API publicada seletivamente: somente services/productFormDraftsServer.cjs mudou no runtime. mdv-api reiniciada com healthcheck aprovado. Backup: /var/www/mdv-api/backups/product-form-drafts-1791760478300. Nenhum entrypoint remoto, migration, flag, banco ou arquivo privado alterado. API /status HTTP 200 com mysql.ok=true; lista anonima HTTP 401.

Lista autenticada foi conferida antes com o erro 500 e depois com o rascunho existente disponivel para continuar. Novo reload confirmou versao 609, card Mini Esqueleto com a mesma data de atualizacao e nenhum erro ou aviso de console. Sem salvar, arquivar ou excluir registros. Evidencia: .local/publish-609-drafts.png.

38 testes focados passaram; testes novos reproduziram falha antes do ajuste. Sintaxe, preflight seletivo, build local e build do deploy aprovados. Home HTTP 200 e VERSION.json correspondente. Guardas de runtime sem Supabase e rotas aprovadas; nenhum rastro de Supabase no bundle. Avisos conhecidos: Browserslist e tempos de plugins sem falha; helper de credenciais Git nao impediu push.

Autoajuste operacional aplicado no publisher do repositorio e seu teste: baseline revisada para atualizar modulo existente sem sobrescrever drift. Skill publish-vps executada sem modificar seus arquivos. Temporarios de build/deploy/auditoria removidos ao concluir; evidencia mantida.

Preexistentes preservados: docs/print3d-production.md, scripts/shopee-auto-print.cjs, docs/operacional/2026-10-07-shopee-glaucia-impressao-lenovo.md, scripts/prepare-shopee-personal-account-update.cjs, tmp-tests/fixtures/print3d-plate-ui.stl e tmp-tests/shopee-personal-account-update.test.cjs.

Auditoria e limpeza obrigatorias: 0 candidatos, 0 removidos; 34 worktrees bloqueadas preservadas:
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

## Historico anterior

# v1.2.608-cadastro-3d-menus

Data: 11/10/2026. Branch: main. Tag: v1.2.608-cadastro-3d-menus.
Release MDV: /var/www/mdv-site/releases/20261011-230349-cadastro-3d-menus.
Status: publicada e validada em producao. Commit da release: de0753ee.

Cadastro 3D: impressoras sugeridas com Bambu Lab A1 preenchida, filamentos com amostras de cor e inclusao de novos IDs cadastrados, duracoes HH:MM inclusive acima de 24h, insumos editaveis por lote, custos fixos, imposto estimado e energia. A referencia editavel da A1 e 95 W medios para PLA em 220 V, conforme https://wiki.bambulab.com/en/a1/manual/faq. Consumo em kWh = W / 1000 x horas; custo usa a tarifa informada. Custos e consumos salvos continuam preservados. Copia do pai permanece independente.

Peso em kg com preenchimento de tres casas decimais ao digitar. Menus de produtos agrupados em Cadastro, Sites e vendas, Midia e impressao; abas do formulario em grade responsiva sem rolagem horizontal.

Catalogo solicita produtos compactos e invalida o cache anterior, mantendo informacoes comerciais dos cartoes. No preview local, filamentos centrais e pendentes sao combinados por ID sem alterar registros ou aprovacoes; esse servico e exclusivo do ambiente local.

Escopo: frontend/painel MDV e servico de preview local versionado. API e site 3DMV preservados; nenhum deploy de API, migration ou alteracao de flags.

Validacoes: 80 testes focados (cadastro, custos, rascunhos, familia, filamentos, medidas, menus e catalogo), suite money, sintaxe de localPrint3dFilaments.cjs e servidores existentes. Build e validacao de producao seguem no fechamento.

Arquivos da entrega:
- components/products/Print3dProductEntry.tsx
- components/products/Print3dRegistrationEditor.tsx
- components/products/ProductForm.tsx
- components/products/sections/ProductSpecifications.tsx
- pages/admin/products/ProductListPage.tsx
- services/catalogSectionsService.ts
- services/localPrint3dFilaments.cjs
- services/print3dRegistration.ts
- tmp-tests/catalog-public-image-fallback-static.test.mjs
- tmp-tests/catalog-public-regressions-static.test.mjs
- tmp-tests/catalog-sections-cache-validity.test.cjs
- tmp-tests/local-print3d-filaments.test.cjs
- tmp-tests/print3d-measurements.test.cjs
- tmp-tests/print3d-product-entry.test.cjs
- tmp-tests/print3d-product-specifications-render.test.cjs
- tmp-tests/print3d-registration.test.mjs
- tmp-tests/product-create-feedback.test.cjs
- tmp-tests/product-list-actions.test.cjs
- utils/print3dMeasurements.js
- public/VERSION.json
- VERSAO_ATUAL.md
- docs/versoes/2026-10-11-v1.2.608-cadastro-3d-menus.md

## Fechamento da publicacao

Publicado e validado em 11/10/2026. Commit de codigo: de0753ee. Tag v1.2.608-cadastro-3d-menus enviada ao origin; main sincronizada. Release ativa: /var/www/mdv-site/releases/20261011-230349-cadastro-3d-menus. Site 3DMV preservado.

80 testes focados e suite money aprovados; build de validacao e build oficial do deploy aprovados. Guardas de runtime sem Supabase e rotas Nginx aprovadas; bundle sem dependencia Supabase. Home, produtos e novo cadastro 3D HTTP 200; VERSION.json confere a versao e release. API nao publicada nem reiniciada; /status HTTP 200 com mysql.ok=true.

Navegador integrado autenticado confirmou catalogo com produtos reais, os tres grupos do menu, grade de abas com scrollWidth=clientWidth=927, A1 preenchida, 95 W, duracoes HH:MM, energia, imposto e insumos. Lista de filamentos de producao mostrou os sete cadastrados com cores. Sem erros de console; aviso preexistente de companyContext usa ID padrao VPS. Nao foram gravados produtos, rascunhos ou uploads de teste.

Avisos conhecidos: Browserslist desatualizado e tempos de plugins, sem falha no build. Helper local de credenciais Git nao impediu push. Skill publish-vps executada sem alteracao. Evidencias mantidas em .local/publish-608-production.png e .local/publish-608-parameters.png. Logs temporarios desta publicacao removidos ao concluir.

Preexistentes preservados fora do commit: docs/print3d-production.md, scripts/shopee-auto-print.cjs, docs/operacional/2026-10-07-shopee-glaucia-impressao-lenovo.md, scripts/prepare-shopee-personal-account-update.cjs, tmp-tests/fixtures/print3d-plate-ui.stl e tmp-tests/shopee-personal-account-update.test.cjs.

Auditoria e limpeza obrigatorias: 0 candidatos, 0 removidos; 34 worktrees bloqueadas preservadas:
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


## Historico anterior

# v1.2.607-rascunhos-placas-precos

Data: 11/10/2026. Branch: main. Tag: v1.2.607-rascunhos-placas-precos.
Release MDV: /var/www/mdv-site/releases/20261011-214056-rascunhos-placas-precos.
Status: publicada e validada em producao. Commit da release: 3b0d49bc.

Rascunhos compartilhados do cadastro incompleto de produtos, com lista para continuar em qualquer computador e controle de revisao contra sobrescrita concorrente. Salvar rascunho preserva formulario, variacoes, arquivos e parametros sem criar produto ou estoque. Concluir e arquivar preservam o registro privado.

Cadastro 3D com Arquivos e URL, Parametros e placas e Precos. Custo por produto completo vem do calculo canonico, em centavos. O operador informa os precos de venda. Copiar a base privada do pai cria configuracoes independentes nos filhos, preservadas inclusive na edicao detalhada da variacao. Variacoes continuam na ultima etapa e a familia e salva junta.

API seletiva: modulo de rascunhos e gancho autenticado nos entrypoints remotos, com backup, verificacao de sintaxe, rollback e healthcheck. Sem migrations nem mudancas nas flags de producao 3D. JSON usa admin_preferences existente; arquivos privados em /var/www/mdv-api/private/product-form-drafts. O backup integral existente da API inclui essa pasta e o backup MySQL inclui admin_preferences. Deploys preservam o diretorio.

Escopo: painel/site MDV e API. Site 3DMV e trabalhos preexistentes de Shopee e documentacao/fixture nao entram nesta publicacao.

Validacoes locais: 37 testes focados, suite money, sintaxe dos servidores, diff sem erros. Build e verificacao publica seguem no registro de fechamento abaixo.

Arquivos da entrega:
- components/products/Print3dRegistrationEditor.tsx
- components/products/ProductFamilyEditor.tsx
- components/products/ProductForm.tsx
- components/products/sections/ProductPricing.tsx
- deploy-vps-server-only.cjs
- docs/operacional/rascunhos-cadastro-produtos.md
- docs/print3d-production.md
- infra/nginx/mdv-site-production.conf
- infra/nginx/mdv-site-staging.conf
- layouts/AdminLayout.tsx
- pages/admin/products/ProductDraftsPage.tsx
- pages/admin/products/ProductFormPage.tsx
- pages/admin/products/ProductListPage.tsx
- routes/index.tsx
- scripts/deploy-product-registration.cjs
- services/print3dRegistration.ts
- services/productFormDrafts.ts
- services/productFormDraftsServer.cjs
- tmp-tests/deploy-product-registration.test.cjs
- tmp-tests/family-registration.test.mjs
- tmp-tests/print3d-registration.test.mjs
- tmp-tests/product-create-feedback.test.cjs
- tmp-tests/product-form-drafts.test.cjs
- tmp-tests/product-form-serialized-units-static.test.mjs
- vps_server.cjs
- public/VERSION.json
- VERSAO_ATUAL.md
- docs/versoes/2026-10-11-v1.2.607-rascunhos-placas-precos.md

## Fechamento da publicacao

Publicado e validado em 11/10/2026. Commit da release: 3b0d49bc. Tag v1.2.607-rascunhos-placas-precos enviada ao origin; main sincronizada.

API seletiva reiniciada; backup de recuperacao: /var/www/mdv-api/backups/product-form-drafts-1791755040721. Status HTTP 200 com mysql.ok=true; rascunhos anonimos HTTP 401. Nenhuma migration ou flag alterada. Site completo publicado na release acima; home e lista de rascunhos HTTP 200, VERSION.json confere. As rotas Nginx ativas ja abrangem /admin/products/drafts pelo padrao de produtos; nao foi necessario recarregar Nginx.

Chrome autenticado conferiu lista de rascunhos sem falhas, abas Arquivos e URL, Parametros e placas, Precos e Variacoes por ultimo, base do pai e arquivos por placa. Sem gravar produtos, rascunhos ou uploads de teste em producao. Edicao independente, custos e retomada com arquivos foram verificados localmente. Sem erro de console; aviso preexistente de companyContext usa ID padrao VPS. Build: aviso Browserslist desatualizado, sem falha; guardas de runtime/editor aprovadas. Aviso local do helper de credenciais Git nao impediu push do commit/tag. Publicacao executada pela skill publish-vps; sem atualizacao da skill.

Temporarios de build/deploy/auditoria removidos; evidencia de tela mantida em .local/publish-607-production.png. Alteracoes preexistentes preservadas: docs/print3d-production.md (somente os novos paragrafos desta entrega foram stageados), scripts/shopee-auto-print.cjs, docs/operacional/2026-10-07-shopee-glaucia-impressao-lenovo.md, scripts/prepare-shopee-personal-account-update.cjs, tmp-tests/fixtures/print3d-plate-ui.stl e tmp-tests/shopee-personal-account-update.test.cjs.

Auditoria obrigatoria: 0 candidatos, 0 removidos e 34 worktrees bloqueadas preservadas:
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

## Historico

# v1.2.606-variacoes-ultima-etapa

Data: 11/10/2026. Branch: main. Tag: v1.2.606-variacoes-ultima-etapa.
Release MDV: /var/www/mdv-site/releases/20261011-204442-variacoes-ultima-etapa.
Status: publicada e validada em produção. Commit da release: a922f922.

Variações como última aba, depois do cadastro completo do pai e dos dados fiscais. Fotos, descrição e canais do pai vêm antes. Os arquivos de produção dos filhos ficam junto das variações. O botão Salvar família e variações mantém o salvamento conjunto existente, sem exigir cadastro prévio do pai. Produtos simples e filhos avulsos mantêm suas abas de produção, estoque e preços.

Seletor de cores dos produtos filtrável, com amostra antes do nome tanto na lista como na seleção. RGB personalizado e quadriculado das cores translúcidas preservados. O campo continua gravando o nome cadastrado; atualização com falha mantém a lista anterior e permite nova tentativa. Clique no campo ainda focado reabre as opções.

Publicação exclusiva do painel/site MDV. API, dados comerciais e site 3DMV permanecem na release anterior. Seis arquivos preexistentes de Shopee/documentação/fixture ficam fora do escopo.

Validações: 45 testes focados aprovados, incluindo navegação do pai com/sem 3D, filhos avulsos, salvamento/retry da família, amostras de cores, teclado e atualização. 45 testes e build aprovados, com guardas de Supabase e do editor alcançável. Site e cadastro HTTP 200, VERSION.json correspondente à release, API saudável com mysql.ok=true sem reinício. Chrome autenticado confirmou a última aba e as amostras reais das cores, sem salvar produtos ou arquivos e sem erros de console. Aviso preexistente de contexto da empresa usa o ID padrão VPS. Browserslist desatualizado é aviso do build. Main sincronizada; seis alterações preexistentes fora do escopo preservadas. Auditoria: zero resíduos removidos e 34 worktrees bloqueadas preservadas, listadas na nota desta versão. Nenhuma mudança na skill foi necessária.

Arquivos da entrega:
- components/products/ProductForm.tsx
- components/products/selectors/ColorSelect.tsx
- components/ui/SearchableSelect.tsx
- tmp-tests/filament-color-select.test.mjs
- tmp-tests/product-create-feedback.test.cjs
- public/VERSION.json
- VERSAO_ATUAL.md
- docs/versoes/2026-10-11-v1.2.606-variacoes-ultima-etapa.md

## Histórico

# v1.2.605-cadastro-variacoes

Data: 11/10/2026. Branch: main. Tag: v1.2.605-cadastro-variacoes.
Release MDV: /var/www/mdv-site/releases/20261011-195330-cadastro-variacoes.
Release 3DMV: /var/www/print3d-site/releases/20261011-195330-cadastro-variacoes.
Status: publicada e validada em producao. Commit da release: 9b28cdde.

Cadastro de familias e variacoes na mesma tela: atributos, SKU complementar imutavel, EAN proprio, fotos/video com envio ao Synology e campos individuais ou herdados. Capa do pai com fallback de filho para familias antigas. Descricao HTML resolvida pela API nos dois sites, preservando o valor original no editor.

Fichas privadas por SKU/revisao, lote com varias placas, consumo e tempo por placa, custos em centavos, anexos e link de origem. Ativacao autorizada apenas de MDV_PRINT3D_RECIPES_ENABLED; pedidos, pagamentos e producao automatica permanecem desligados. Schema existente, sem migration ou gravacao comercial de teste.

171 testes focados/regressivos e guardas aprovados, alem de money e filtro admin TypeScript. Builds isolados, deploy seletivo, status autenticados e Chrome de producao conferidos. Ambos VERSION.json correspondem a esta release; API com mysql.ok=true. Defesa adicional exige o editor de variacoes no bundle realmente alcancavel. Alteracoes Shopee e documento/fixture preexistentes fora do escopo.

Fichas e arquivos privados habilitados; acesso anonimo retorna 401. Editor conferido com tres placas para dez produtos, sem salvar dados de teste. Upload real ao NAS nao executado nesta validacao. Checkout temporario limpo removido, recuperavel pelo commit; 34 worktrees bloqueados preservados. Main sincronizada com origin/main, com seis arquivos preexistentes fora do escopo mantidos.

Detalhes: docs/versoes/2026-10-11-v1.2.605-cadastro-variacoes.md.

## Historico

# v1.2.604-filamentos-amostras

Data: 11/10/2026. Branch: main. Tag: v1.2.604-filamentos-amostras.
Release: /var/www/mdv-site/releases/20261011-162111-filamentos-amostras.
Status: publicada e validada em producao. Commit da release: 387811d9.

Amostras antes dos nomes no seletor filtravel de cores dos filamentos, na lista e no valor selecionado. Cor simples e degrade de duas ou tres cores usam a mesma lista cadastrada e os tons personalizados. Contratos de estoque e custos preservados.

Publicacao exclusiva do painel/site MDV, com build isolado; sem API, migration, gravacao comercial ou aprovacao de rascunhos. Detalhes: docs/versoes/2026-10-11-v1.2.604-filamentos-amostras.md.

28 testes aprovados, build isolado e Chrome de producao conferidos. Checkout temporario removido; 76 alteracoes preexistentes e 34 worktrees bloqueados preservados.

## Historico

# v1.2.603-cores-translucidas

Data: 11/10/2026. Branch: main. Tag: v1.2.603-cores-translucidas.
Release: /var/www/mdv-site/releases/20261011-160009-cores-translucidas.
Status: publicada e validada. Commit/tag da release: 8f7b8864 / v1.2.603-cores-translucidas.

13 sugestoes de cores translucidas na paleta compartilhada, com amostra quadriculada. Hexadecimal do cadastro tem prioridade; tons personalizados e registros antigos preservados. Azul e Azul Translucido continuam identidades distintas no estoque. Sugestoes exigem cadastro explicito e nao geram registros automaticamente. Atualizacao de cores ignora cache antigo sem apagar a lista em caso de falha.

Publicacao exclusiva do painel/site MDV, sem API, migration, aprovacao de rascunhos ou gravacao comercial. Build isolado para nao incluir os outros trabalhos locais. Detalhes: docs/versoes/2026-10-11-v1.2.603-cores-translucidas.md.

28 testes e build isolado aprovados. Home/painel HTTP 200, VERSION.json correspondente e API com mysql.ok=true. Chrome autenticado confirmou as 13 sugestoes, Azul Translucido e tons personalizados, sem salvar testes ou erros de console. Checkout de publicacao removido; 34 worktrees antigas bloqueadas preservadas. Main sincronizada; 76 alteracoes preexistentes fora do escopo mantidas.

## Historico

# v1.2.602-filamentos-degrade

Data: 11/10/2026. Branch: main. Tag: v1.2.602-filamentos-degrade.
Release: /var/www/mdv-site/releases/20261011-153123-filamentos-degrade.
Status: publicada e validada. Commit/tag da release: 073abe71 / v1.2.602-filamentos-degrade.

Marca digitavel/filtrante e degrade de duas ou tres cores registradas lado a lado. Custo e estoque pertencem a combinacao completa; registros antigos preservados. Deploy seletivo de dois modulos da API antes do painel. Nenhum novo schema, ativacao da producao 3D ou aprovacao de rascunhos. Alteracoes preexistentes de produtos permanecem fora do escopo.

Detalhes: docs/versoes/2026-10-11-v1.2.602-filamentos-degrade.md.

36 testes e build isolado aprovados. API seletiva reiniciada, mysql.ok=true, estoque e movimentos intactos (hash conferido), sem migration ou aprovacao de rascunhos. Home/painel HTTP 200 e VERSION.json correspondente. Chrome autenticado confirmou marca filtrante, tres cores na mesma linha e amostra degrade, sem salvar teste e sem erros. Worktree temporaria desregistrada e junction removida; exclusao dos residuos fisicos bloqueada pela politica do ambiente. 34 antigas bloqueadas preservadas. Main sincronizada; alteracoes preexistentes fora do escopo.

## Historico

# v1.2.601-filamentos-estoque

Data: 11/10/2026. Branch: main. Tag: v1.2.601-filamentos-estoque.
Release MDV: /var/www/mdv-site/releases/20261011-120000-filamentos-estoque.
Status: publicada e validada em produção. Commit/tag da release: 9307703f / v1.2.601-filamentos-estoque.

Página própria Filamentos e estoque: marca/material/cor compartilhados, custo por kg, entrada com quantidade em kg, data e canal de compra; controles compactos −/+, cores sempre visíveis, baixa Usado e Desativar retirando o saldo. Resumo agrupado por material + cor entre marcas. Ledger preservado e reenvios idempotentes. Rascunhos locais só são enviados por aprovação explícita.

Migração 054 aditiva autorizada com backup e conferência de integridade. Flag MDV_PRINT3D_FILAMENT_STOCK_ENABLED independente; módulo completo de produção 3D permanece desligado. Publicação seletiva da API e build isolado, sem incluir as mudanças preexistentes de produtos, placas e Shopee.

49 testes aprovados (26 focados e 23 de estoque/produção existente), build do commit isolado, API online/mysql.ok=true, rota sem sessão 401, homepage e painel HTTP 200 e VERSION.json correto. Chrome confirmou listas reais, amostra da cor, entrada acima de 1 kg e campos data/canal, sem salvar cadastro de teste e sem erros de console. Backup SQL/env: /var/www/mdv-api/backups/print3d-filaments-1791730518173; backup código: /var/www/mdv-api/backups/print3d-filaments-code-1791730537723. Nginx recebeu somente a rota nova, com backup e nginx -t aprovado. Rascunhos não enviados. Auditoria removeu a worktree limpa desta publicação e preservou 34 antigas bloqueadas, listadas no registro da versão. Main sincronizada; mudanças preexistentes preservadas.

## Histórico

# v1.2.600-sku-nome-automatico

Data: 10/10/2026. Branch: main. Tag: v1.2.600-sku-nome-automatico.
Release MDV: /var/www/mdv-site/releases/20261010-211100-sku-nome-automatico.
Release 3DMV: /var/www/print3d-site/releases/20261010-211100-sku-nome-automatico.
Status: publicada e validada em produção. Commit da release: da63f435.

SKU automático para novos cadastros com campo vazio: quatro letras reconhecíveis e quatro números sequenciais por prefixo. Nome persistido em texto simples, por exemplo Vaso decorativo - VASO0003. Reserva de SKU na mesma conexão da transação; SKUs existentes e manuais preservados. Preview consulta o catálogo e os rascunhos locais, sem publicar ao salvar; aprovação recusada mantém o rascunho. Deploy API seletivo com backup, preservando drift remoto. 44 testes e guardas Bling/PDV aprovados. Quatro arquivos Shopee preexistentes fora do escopo.

Ambos os sites ativos com VERSION.json correto e HTTP 200; painel de cadastro renderizado no Chrome sem erros de console. API server.js online, mysql.ok=true; hash do módulo SKU instalado igual ao local e execução isolada confirmou nome/SKU sem gravação comercial. Backup API: /var/www/mdv-api/backups/product-auto-sku-1791677437608. Manutenção pública 3DMV preservada. Auditoria final: nenhum resíduo removido; 34 worktrees bloqueados preservados e listados no registro da versão. Main sincronizada com origin/main; somente as quatro alterações Shopee preexistentes permanecem.

## Histórico

# v1.2.599-medidas-3d-mm

Data: 10/10/2026. Branch: main. Tag: v1.2.599-medidas-3d-mm.
Release MDV: /var/www/mdv-site/releases/20261010-235533-medidas-3d-mm.
Release 3DMV: /var/www/print3d-site/releases/20261010-235533-medidas-3d-mm.
Status: publicada e validada em produção. Commit da release: b4f6faaa.

Altura, largura e profundidade em mm na aba Características e nos anúncios dos dois sites. Um único conjunto de medidas: dimensions em cm no contrato interno, convertido na interface; peso em kg. API pública envia as medidas existentes, sem duplicar campos ou alterar descrição do pai. Preview conserva rascunhos locais até aprovação. 40 testes e dois builds aprovados. Releases MDV e 3DMV ativas; ambos os domínios respondem 200 com VERSION.json correto. Dois módulos da API publicados seletivamente com backup; mdv-api online e mysql.ok=true. Navegador confirmou os quatro campos e prévia 35/20/12 mm sem salvar produto. Manutenção pública 3DMV mantida. Quatro arquivos Shopee preexistentes preservados. Auditoria: zero removidos, 34 bloqueados preservados (lista no registro desta versão).

## Histórico

# v1.2.598-atalho-categoria

Data: 10/10/2026. Branch: main. Tag: v1.2.598-atalho-categoria.
Release: /var/www/mdv-site/releases/20261010-233645-atalho-categoria.
Status: publicada e validada em produção. Commit da release: 9332d9ec.

Atalho + de categoria abre a página completa Nova Categoria em outra aba, preservando o produto em preenchimento. Removido o cadastro rápido antigo com formulário aninhado. Atualizar lista ignora cache; hierarquia e IDs preservados. Sete testes e build aprovados, homepage HTTP 200 e VERSION.json correto. Navegador confirmou clique, nova aba, nome/categoria preservados e ausência de erros de console. API não reiniciada; status saudável/mysql.ok=true. Nenhum produto ou categoria salvo. Quatro arquivos Shopee preexistentes fora da release. Auditoria: zero removidos, 34 bloqueados preservados (lista no registro desta versão).

## Histórico

# v1.2.597-materiais-3d

Data: 10/10/2026. Branch: main. Tag: v1.2.597-materiais-3d.
Release: /var/www/mdv-site/releases/20261010-232931-materiais-3d.
Status: publicada e validada em produção. Commit da release: a1647a47.

Cadastro compartilhado de 15 tipos de material e novas inclusões no campo Material. Nova rota /admin/print3d/material-types separada da rota existente /admin/print3d/materials (estoque de filamentos). Teste registra ambos os módulos Fastify juntos para impedir duplicidade de rota. Nenhum produto, SKU, preço ou estoque alterado.

24 testes aprovados (17 focados + 7 de produção existente), build sem runtime Supabase, homepage HTTP 200 e VERSION.json correto. API seletiva reiniciada; /status ok=true/mysql.ok=true e rota sem sessão retorna 401. Chrome confirmou 15 opções, seleção PLA e modal Novo material sem erros de console; nenhum produto ou material de teste salvo. Backup API: /var/www/mdv-api/backups/print3d-materials-1791675025682. Main sincronizada; quatro arquivos Shopee preexistentes preservados. Auditoria: zero removidos, 34 worktrees bloqueados preservados. Skill publish-vps atualizada com a lição de conflitos entre registradores de rota e validada.

## Histórico

# v1.2.596-materiais-3d

Data: 10/10/2026. Branch: main. Tag: v1.2.596-materiais-3d.
Release: /var/www/mdv-site/releases/20261010-232309-materiais-3d.
Status: substituída pela v1.2.597; API restaurada do backup após detectar conflito de rota.

Material nos produtos 3D passa a ser selecionável, com 15 tipos conhecidos e cadastro compartilhado de novos materiais. Fonte de verdade: API/MySQL em admin_preferences; valores legados preservados. Sem migration, alteração de SKU, estoque, preços ou produtos reais. API seletiva com backup, verificações de sintaxe e preservação de código remoto.

Validações: 16 testes focados; sintaxe dos servidores e preflight seletivo aprovados. Alterações Shopee preexistentes fora da release.

## Histórico

# v1.2.595-categorias-hierarquia

Data: 10/10/2026. Branch: main. Tag: v1.2.595-categorias-hierarquia.
Release: /var/www/mdv-site/releases/20261010-231129-categorias-hierarquia.
Status: publicada e validada em produção. Commit da release: a42fd9db.

Seletor de categoria no cadastro de produtos mostra grupos de categorias e subcategorias com caminho completo. A hierarquia vem de parent_id da API, sem alterar categorias, vínculos ou SKUs. Ordem cadastrada preservada. Relações legadas inválidas não escondem opções.

Validações: cinco testes de hierarquia, seis testes da entrada Produto 3D e build. Homepage HTTP 200, VERSION.json correto e API saudável com mysql.ok=true. Navegador confirmou 17 grupos, subcategorias em múltiplos níveis e seleção por ID preservado. Deploy apenas do painel, sem reiniciar API. Mudanças Shopee preexistentes fora do escopo. Auditoria: nenhum worktree removido; 34 bloqueados preservados.

## Histórico

# v1.2.594-produto-3d-entry

Data: 10/10/2026. Branch: main. Tag: v1.2.594-produto-3d-entry.
Release: /var/www/mdv-site/releases/20261010-230200-v12594-produto-3d-entry.
Status: publicada e validada em produção. Commit da release: 81e7b318.

Botão Produto 3D na lista central abre novo cadastro já marcado ou pesquisa o SKU existente para conferência. O cadastro central continua responsável pelo SKU. Após salvar uma variante vendável, o operador segue para ficha e arquivos; produtos pai seguem para suas variações. No localhost, a edição existente mantém o rascunho local.

Validação: seis testes de fluxo; sintaxe dos servidores; build sem runtime Supabase; homepage HTTP 200 e VERSION.json correto; API saudável com mysql.ok=true. Navegador confirmou cadastro novo com impressão 3D marcada e abertura do SKU SFKU3XMVB sem mudar seu identificador. Publicação somente do painel, sem reinício da API ou alteração de produtos reais. Auditoria: zero worktrees removidos, 34 bloqueados preservados (lista no registro desta versão). Alterações Shopee preexistentes preservadas fora da release.

## Histórico

# v1.2.593-phone-brands-dynamic

Data: 09/10/2026. Branch: main. Tag: v1.2.593-phone-brands-dynamic.
Release: /var/www/mdv-site/releases/20261009-203847-phone-brands-dynamic.
Status: publicada e validada em producao.

Gerador passa a oferecer Todas as marcas (automatico) e Marcas especificas a partir dos celulares elegiveis consultados na mesma fonte de estoque/precos. Receita automatica e preservada nas futuras geracoes; receitas legadas continuam especificas ate reparo explicito. Ocultos, pais, combos, vendidos e acessorios continuam excluidos. Bot com selecao explicita e calculos de preco permanecem compativeis.

Reparo autorizado: somente 22 ocorrencias futuras ainda nao geradas/iniciadas nos dois agendamentos conferidos; altera apenas recipe, com backup restrito, transacao e releitura. Horarios, canais e itens ja enviados preservados. Dry-run executado.

Validacao: 33 testes passaram e 1 opcional ignorado; guardas do calendario e sintaxe dos tres servidores passaram. Deploy API seletivo --dynamic-price-tables-only preserva personalizacoes remotas e recusa divergencia da baseline.

Quatro arquivos Shopee preexistentes fora do escopo.

Publicacao concluida: commit b3ac4c17 e tag enviados a main. API seletiva reiniciada e online; /status HTTP 200/mysql.ok=true. Site e VERSION.json HTTP 200. Preview autenticado real: 24 configuracoes, quatro marcas e quatro tabelas, incluindo Oukitel. Chrome apos reload sem cache renderizou catalogo real, complemento e Ver todos, sem erros de console.

22 ocorrencias futuras nos dois agendamentos conferidos foram alteradas transacionalmente para Todas as marcas. Releitura validada por ocorrencia; segunda execucao em dry-run encontrou zero legadas restantes. Nenhuma publicacao reenviada. Backup receitas: /var/www/mdv-api/backups/phone-brands-recipes-1791578537569.json. Backup API: /var/www/mdv-api/backups/phone-price-list-1791578481069.

Auditoria apply: 0 removidos; 34 bloqueados preservados.

## Historico

# v1.2.592-n8n-memoria

Data: 09/10/2026. Branch: main. Tag: v1.2.592-n8n-memoria.
Release: /var/www/mdv-site/releases/20261009-201153-n8n-memoria.
Status: publicada e validada em producao.

Rotas company-settings existentes recebem modo optativo view=bot com projecao SQL de horarios, endereco e Pix; nao leem imagens/templates/credenciais de integracao nesse modo. Modo padrao continua igual e sanitizacao publica permanece obrigatoria. Quatro chamadas do workflow ativo passam ao modo enxuto; conexoes, conversas e politicas preservadas. Heap do processo principal n8n passa de aproximadamente 4 GB para 6 GB mantendo os outros argumentos e limite de concorrencia 10/pool 10.

Publicacao concluida: b2632b14, 7f9dfcd0 e 4c740f6f enviados a main, com tag da versao e tag de guardas. Site e VERSION.json HTTP 200; API seletiva reiniciada, status ok=true/mysql.ok=true. Respostas reais privadas/publicas caem de 690552/346014 bytes para 1366/1396 bytes, com valores projetados iguais e auth 401 preservada. Quatro consultas do fluxo ativo atualizadas; main/runner 1/1, health/readiness 200, heap efetivo 6240 MiB. Seis execucoes naturais bem-sucedidas e zero erros fatais de memoria no intervalo inicial de 17:25:35 a 17:27:53. Causa exata do crescimento de memoria ainda nao isolada; validacao curta nao comprova estabilidade prolongada.

Testes de rotas, patch/CAS, replicas exatas, configuracoes de retirada e estoque, sintaxe, schema real e build passaram. Backups restritos com checksums validados; nenhuma conversa reexecutada. Primeira tentativa encontrou espera falsa por nomes semelhantes de servicos; bot restaurado antes da reaplicacao, sem escrita de workflow naquela tentativa. Auditoria apply preservou 34 worktrees bloqueados e removeu zero; quatro arquivos Shopee preexistentes fora do escopo. Runbooks n8n/publicacao atualizados e validados. Detalhes e todos os caminhos em docs/versoes/2026-10-09-v1.2.592-n8n-memoria.md.

## Release anterior: v1.2.591-bling-refresh-safe

Data: 09/10/2026. Branch: main. Tag: v1.2.591-bling-refresh-safe.
Release: /var/www/mdv-site/releases/20261009-193318-bling-refresh-safe.

Renovacao da API nao devolve token antigo apos falha HTTP/configuracao ou resposta invalida. Credenciais preservadas em erro; novo token usado apenas apos salvar. Deploy seletivo altera somente refreshBlingStoredAccessTokenVps e preserva outras customizacoes remotas.

Publicacao concluida: 413a0156 e tag enviados a main. 122 testes passaram; build e sintaxe API validados. API publicada seletivamente com backup e restart; status ok=true/mysql.ok=true. Site e VERSION.json HTTP 200. Handler remoto corresponde ao local e rejeita 503 simulado. Chrome confirmou catalogo real/complemento/Ver todos; 401 limitado a auth/me sem sessao. Sem renovacao real forcada. Auditoria apply: 0 removidos, 34 bloqueados preservados, listados na nota da versao. Quatro arquivos Shopee preexistentes preservados.

## Historico

# v1.2.590-operational-failures

Data: 09/10/2026. Branch: main. Tag: v1.2.590-operational-failures.
Release: /var/www/mdv-site/releases/20261009-185649-operational-failures.

PDV propaga falhas de consulta das unidades e limpa resultados anteriores. Confirmacao por foto exige salvamento bem-sucedido. Lista de campanhas WhatsApp carrega todas as paginas de 200 registros. Somente frontend; nenhum dado comercial alterado. Testes de falha reproduzidos antes da correcao e passando depois.

Publicacao concluida: fd7240bf e tag enviados a main; 79 testes centrais, suites de familias, precos, pagamentos e estoque passaram. Build sem runtime Supabase. Site e versao HTTP 200, API saudavel sem restart. Chrome confirmou PDV/busca, cadastro por foto, marketing, complemento e Ver todos; console sem erros. Bling confirmou leitura bem-sucedida, sem renovacao forcada. Auditoria apply: 0 removidos, 34 bloqueados preservados; caminhos/reasons na nota da versao. Quatro arquivos Shopee preexistentes preservados.

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
