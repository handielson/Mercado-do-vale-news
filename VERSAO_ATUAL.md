# v1.2.585-bling-connection-status

Data: 08/10/2026. Branch: main. Tag: v1.2.585-bling-connection-status.
Release do site: /var/www/mdv-site/releases/20261008-205307-bling-connection-status.

Complemento sempre editavel abaixo do titulo do pai, preservando nome oficial e documentos. Debug OAuth limpo ao retornar com sucesso ou confirmar consulta. Nova rota administrativa de leitura /admin/bling/connection-status: consulta limitada ao Bling, timeout, cache curto invalidado por novo token, sem dados privados na resposta. Conexao monitorada separadamente da automacao fiscal no Status do sistema.

API: deploy seletivo pelo fluxo oficial com --bling-connection-health-only; preserva alteracoes remotas e faz backup antes do restart. Nenhuma migration.

Validacoes: 31 testes passaram, guarda de estoque PDV, sintaxe e preflight remoto. Build e validacao publica no deploy.

Arquivos:
- components/products/CatalogTitleEditor.tsx
- components/products/ProductCard.tsx
- pages/admin/settings/BlingPage.tsx
- services/systemStatusModel.ts
- services/systemStatusService.ts
- services/blingConnectionHealth.cjs
- server.js
- vps_server.js
- vps_server.cjs
- deploy-vps-server-only.cjs
- scripts/deploy-bling-connection-health.cjs
- tmp-tests/bling-connection-health.test.cjs
- tmp-tests/system-status.test.cjs
- tmp-tests/product-family-card-render.test.cjs
- public/VERSION.json
- VERSAO_ATUAL.md
- docs/versoes/2026-10-08-v1.2.585-bling-connection-status.md

Publicacao e auditoria final: pendentes de validacao. Arquivos Shopee preexistentes preservados fora do escopo.

## Validacao final

Commit publicado: 9e016321. Tag v1.2.585-bling-connection-status enviada com main. Site ativo /var/www/mdv-site/releases/20261008-205307-bling-connection-status; homepage HTTP 200 e VERSION.json correspondente. API seletiva publicada antes do frontend; backup /var/www/mdv-api/backups/bling-connection-health-1791492901933; mdv-api reiniciado e /status confirmou mysql.ok=true. Rota de diagnostico sem autenticacao retorna 401.

Chrome autenticado: Bling mostra Conexao confirmada, debug OAuth ausente; Status do sistema mostra conexao confirmada e fiscal separado; campos de complemento visiveis mesmo com detalhes recolhidos. Console sem erros nas paginas verificadas. Nenhum complemento foi salvo em produto durante o teste.

31 testes focados, guarda PDV, sintaxe e build passaram. Avisos conhecidos: CRLF, Browserslist antigo e credential helper do Git; push e deploy concluídos. Skill sem alteracoes; fluxo seletivo especifico acrescentado ao deploy oficial.

Auditoria de worktrees: 0 candidatos, 0 removidos, 34 bloqueados. {"dirty":25,"not_merged_into_origin_main":9}. Quatro arquivos Shopee preexistentes preservados.

Worktrees bloqueados (preservados):
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
