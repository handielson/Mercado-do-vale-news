# v1.2.581-catalog-title-upload

Data: 2026-10-08. Branch: main. Tag: v1.2.581-catalog-title-upload.
Release VPS: /var/www/mdv-site/releases/20261008-200544-catalog-title-upload
Status: publicada e validada.

Complemento do título exclusivo do pai, editável com prévia na lista de famílias.
Aparece apenas nos cards e no título da página pública, sem alterar nome oficial,
buscas, agrupamento, PDV, comprovantes, garantia e integrações.

Upload Synology retorna o recibo JSON antes de encerrar o handler async;
arquivo continua em background. Corrige HTTP 200 com corpo vazio em Stories.

Publicação seletiva de API e frontend. Bootstrap adiciona uma coluna opcional
no cadastro de produtos. Nenhum dado comercial alterado em validações.
Quatro arquivos Shopee preexistentes preservados fora do escopo.

API pelo modo --catalog-title-upload-only, com backup, validação de âncoras,
sintaxe e rollback do helper operacional existente. API antes do site.
Registro completo de arquivos em public/VERSION.json.

Validações: testes do recurso e do deploy, regressões de upload, marketing,
Stories, breadcrumb e estoque; sintaxe das três entradas; build.
Os 31 testes funcionais de garantia passaram; teste estático antigo da garantia
possui expectativa de bootstrap já incompatível no HEAD anterior.

Commit de código: 8f0e284e, push em origin/main e tag enviados.
API publicada/reiniciada; mysql.ok=true.
Backup: /var/www/mdv-api/backups/catalog-title-upload-1791490174650.
Homepage HTTP 200 e VERSION.json confirmado. Painel de produtos autenticado
renderizou o editor, sem erros no console. Produto filho retorna o campo do pai.
PATCH sem autenticação recusado com 401. Upload autenticado sem arquivo retornou
400 com JSON válido, sem envio ao NAS. Nenhum dado comercial alterado.
Skill publish-vps seguida, sem alteração na skill.
Auditoria: nenhum worktree removido; 34 bloqueados por sujeira ou commits não
integrados foram preservados. Quatro arquivos Shopee preexistentes são a única
sujeira restante no checkout principal. Lista completa abaixo.

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
