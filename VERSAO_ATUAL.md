# v1.2.600-sku-nome-automatico

Data: 10/10/2026. Branch: main. Tag: v1.2.600-sku-nome-automatico.
Release MDV: /var/www/mdv-site/releases/20261010-211100-sku-nome-automatico.
Release 3DMV: /var/www/print3d-site/releases/20261010-211100-sku-nome-automatico.
Status: preparada; deploy e validação pública pendentes.

SKU automático para novos cadastros com campo vazio: quatro letras reconhecíveis e quatro números sequenciais por prefixo. Nome persistido em texto simples, por exemplo Vaso decorativo - VASO0003. Reserva de SKU na mesma conexão da transação; SKUs existentes e manuais preservados. Preview consulta o catálogo e os rascunhos locais, sem publicar ao salvar; aprovação recusada mantém o rascunho. Deploy API seletivo com backup, preservando drift remoto. 44 testes e guardas Bling/PDV aprovados. Quatro arquivos Shopee preexistentes fora do escopo.

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
