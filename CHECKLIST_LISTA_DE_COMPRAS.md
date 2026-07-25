# Checklist de execução — Lista de Compras

Atualizado em: 25/07/2026

## Concluído

- [x] Explorada a arquitetura do painel, rotas, layout, API e persistência.
- [x] Criado e mantido este checklist persistente de retomada.
- [x] Corrigida a persistência para MySQL/VPS; a migration inicial em Supabase foi removida antes de qualquer execução.
- [x] Criadas as tabelas MySQL, APIs VPS, regras de domínio, telas e navegação do módulo.
- [x] Implementada lista principal, inclusões de produto cadastrado/avulso, páginas próprias de orçamento, visão consolidada e compras efetuadas.

## Em andamento

- [ ] Publicar na VPS e validar os endpoints em produção.

## Pendente

- [ ] Executar migration automática no restart da API VPS e validar os endpoints em produção.

## Decisões assumidas

- O módulo usa exclusivamente MySQL/VPS para suas novas tabelas e APIs.
- O acesso segue as rotas administrativas existentes e o mesmo segredo de sincronização das demais operações administrativas da VPS.
- Menor preço válido é a cotação marcada válida, com preço e quantidade positivos, de menor valor unitário.
- O status é progressivo e terminal: Pendente → Orçado → Comprado; Pendente/Orçado → Cancelado. Não há reabertura pelo módulo.
- As vendas diárias são lidas de `sales`/`sale_items` no MySQL quando disponíveis. Para canais ainda externos à VPS, `POST /shopping-list/daily-sales` recebe o consolidado diário e alimenta a mesma lista, sem Supabase.

## Arquivos/telas alterados

- `core/shopping-list-routes.cjs` — schema MySQL, regras e APIs do domínio.
- `migrations/20260725_shopping_list_mysql.sql` — migration MySQL auditável.
- `server.js`, `vps_server.js`, `deploy.cjs` — bootstrap/deploy da API.
- `services/shoppingListService.ts`, `types/shopping-list.ts` — cliente e tipos da API VPS.
- `pages/admin/shopping/*`, `routes/index.tsx`, `layouts/AdminLayout.tsx` — telas e navegação.

## Comandos de validação

- `node --check core/shopping-list-routes.cjs` — aprovado.
- `node --check server.js` e `node --check vps_server.js` — aprovados.
- `node tmp-tests/shopping-list-routes.test.cjs` — pendente.
- `npm run build` — aprovado (aviso preexistente de import dinâmico/estático de `publicCompanySettings`).
