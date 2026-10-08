# v1.2.583-family-card-compact

Data: 2026-10-08. Branch: main. Tag: v1.2.583-family-card-compact.
Release VPS: /var/www/mdv-site/releases/20261008-202919-family-card-compact
Status: publicada e validada.

Cards de familia representam o pai, com nome, SKU e estoque total no resumo.
Iniciam recolhidos; seta acessivel abre os detalhes e variacoes por memoria/cor.
Edicao individual dos filhos e selecao em lote preservadas. Familia orfa sinalizada.
Somente frontend administrativo; dados, API e site publico nao alterados.

Protecao: teste de renderizacao do componente real com dependencias isoladas.
Validacoes: render, agrupamento de familias, complemento de titulo e build.
Quatro arquivos Shopee preexistentes preservados fora do escopo.

Publicacao validada. Commit de codigo: bdddc734; tag enviada e main sincronizada.
Homepage HTTP 200 e VERSION.json confirmado. Painel autenticado carregou cards
compactos; C17 Plus expandiu com nome/SKU do pai e filhos por memoria/cor,
recolheu corretamente e nao apresentou erros no console. Nenhum dado alterado.
12 testes passaram e build aprovado. API nao alterada nem reiniciada.
Skill publish-vps seguida sem alteracoes. Warnings conhecidos de Browserslist,
CRLF e credential helper nao impediram build/push/deploy.
Limpeza segura: 0 removidos; 34 worktrees bloqueados preservados.
Quatro arquivos Shopee preexistentes continuam fora do escopo.

Worktrees bloqueados:
- C:/tmp/mdv-model-fix-clean: dirty
- C:/tmp/mdv-phone-filter: dirty
- C:/tmp/mdv-publish-surgical-20260612-b: dirty
- C:/tmp/mdv-refactor-repair-20260612: dirty
- C:/tmp/mdv-virtual-ram-deploy: dirty
- C:/Users/Nitro/Documents/Codex/2026-10-02/task/ml-local-preview: dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-phone-memory-filter-20260801: dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-price-followup-20260716: not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-product-search-specialist-20260725: not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-remove-generic-freight-example-20260718: not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/sale-message-order-number-20260716: not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mdv-perf-main: dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-admin-app: not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-displays-pix: dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-sales-push-20260728: dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-integrate: not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-reformulation: dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/meta-smartphones-sem-preco-20260825: dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/new-model-regressions: dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdp-model-shortcut-publish: dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdv-sale-repair-publish: dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-autoresponder-editable: dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-family-page-jump: dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-receipt-private-payment-20260613: dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-sales-summary-20260613: not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-whatsapp-order: dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/repair-refactor-product-build: dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/signed-warranty-synology: dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/system-backup-admin-20260613: not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-bulk-release-20260727: dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-shop-foundation: not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-n8n-context-handoff-fix: dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-publish-novo-bot: dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-status-contacts-fix: dirty
