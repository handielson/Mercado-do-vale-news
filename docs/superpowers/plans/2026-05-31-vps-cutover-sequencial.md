# VPS Cutover Sequencial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Concluir a migracao Supabase/Vercel para VPS em uma sequencia dependente, validando primeiro runtime admin/publico e deixando dominio/webhooks externos para depois.

**Architecture:** O corte segue uma cadeia: guards locais sem Supabase operacional, flags finais ligadas, validacao admin/publico, build, deploy VPS, auditor de legado Vercel, checagens HTTP/DNS e checklist manual de provedores externos. Cada etapa so avanca quando a anterior passa, reduzindo risco de quebrar admin, catalogo publico, checkout, pedidos ou PDV.

**Tech Stack:** React 18 + Vite, TypeScript services, Fastify VPS, MySQL via `/table-data`, Node static tests, PowerShell on Windows.

---

## File Structure

- `config/migration.ts`: fonte das flags `USE_VPS`; no corte final, `customers`, `orders`, `pdv` e `sales` devem ficar `true`.
- `tmp-tests/vps-final-flags-static.test.mjs`: novo teste estatico para impedir regressao das flags finais.
- `tmp-tests/vps-cutover-sequence-static.test.mjs`: novo teste estatico para garantir que a sequencia de verificacao esta documentada e executavel.
- `docs/superpowers/plans/2026-05-31-vps-cutover-sequencial.md`: este plano, usado como checklist da execucao.
- `migracao_supabase.md`: diario tecnico da remocao Supabase, com resultados dos testes de cada etapa.
- `migracao_VPS.md`: diario tecnico da migracao VPS, com resultados de deploy/corte externo.

---

### Task 1: Guardar as flags finais da VPS

**Files:**
- Create: `tmp-tests/vps-final-flags-static.test.mjs`
- Modify: `config/migration.ts`
- Document: `migracao_supabase.md`
- Document: `migracao_VPS.md`

- [ ] **Step 1: Write the failing test**

Create `tmp-tests/vps-final-flags-static.test.mjs`:

```js
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const source = readFileSync('config/migration.ts', 'utf8');

for (const flag of ['customers', 'orders', 'pdv', 'sales']) {
  const enabled = new RegExp(`${flag}:\\s*true`).test(source);
  assert.equal(enabled, true, `USE_VPS.${flag} must be true for the final VPS cutover`);
}

assert.doesNotMatch(source, /customers:\s*false|orders:\s*false|pdv:\s*false|sales:\s*false/, 'final cutover flags must not remain false');

console.log('vps final flags static checks passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node tmp-tests\vps-final-flags-static.test.mjs
```

Expected: FAIL while `config/migration.ts` still has `customers`, `orders`, `pdv`, or `sales` set to `false`.

- [ ] **Step 3: Enable the final flags**

In `config/migration.ts`, replace the final block with:

```ts
    customers:   true,
    orders:      true,
    pdv:         true,
    sales:       true,
```

- [ ] **Step 4: Run focused flag test**

Run:

```powershell
node tmp-tests\vps-final-flags-static.test.mjs
```

Expected: PASS with `vps final flags static checks passed`.

- [ ] **Step 5: Update migration docs**

Append to `migracao_supabase.md` and `migracao_VPS.md`:

```md
## 2026-05-31 - Flags finais VPS ativadas

Mudanca: `USE_VPS.customers`, `USE_VPS.orders`, `USE_VPS.pdv` e `USE_VPS.sales` foram ativadas para concluir o corte de runtime admin/publico na VPS.

Sequencia: esta etapa depende do auditor Supabase operacional zerado e precede validacao admin/publica, build, deploy VPS e corte externo Vercel.

Validacao:
- `node tmp-tests\vps-final-flags-static.test.mjs`: OK.

Rollback: voltar essas quatro flags para `false` somente se uma validacao funcional bloquear admin, catalogo publico, checkout, pedidos ou PDV.
```

---

### Task 2: Rodar a bateria local que bloqueia retorno ao Supabase/Vercel

**Files:**
- No code changes expected.
- Verify: `tools/audit-supabase-operational-dependencies.mjs`
- Verify: `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- Verify: `tmp-tests/no-supabase-runtime-package-static.test.mjs`
- Verify: `tmp-tests/no-vercel-runtime-literals-static.test.mjs`
- Verify: `tmp-tests/legacy-deploy-removal-static.test.mjs`
- Verify: `tmp-tests/legacy-deploy-removal-readiness-static.test.mjs`

- [ ] **Step 1: Run Supabase operational audit**

Run:

```powershell
node tools\audit-supabase-operational-dependencies.mjs
```

Expected: JSON with `"ok": true`, `"from": 0`, `"rpc": 0`, `"storage": 0`, and no violations.

- [ ] **Step 2: Run Supabase operational static guard**

Run:

```powershell
node tmp-tests\supabase-operational-dependency-guard-static.test.mjs
```

Expected: PASS with `supabase operational dependency guard static checks passed`.

- [ ] **Step 3: Run Supabase runtime package guard**

Run:

```powershell
node tmp-tests\no-supabase-runtime-package-static.test.mjs
```

Expected: PASS, confirming no runtime `@supabase/supabase-js` or retired client files.

- [ ] **Step 4: Run Vercel runtime literal guard**

Run:

```powershell
node tmp-tests\no-vercel-runtime-literals-static.test.mjs
```

Expected: PASS with `no Vercel runtime literals static checks passed`.

- [ ] **Step 5: Run legacy deploy removal guards**

Run:

```powershell
node tmp-tests\legacy-deploy-removal-static.test.mjs
node tmp-tests\legacy-deploy-removal-readiness-static.test.mjs
```

Expected: both PASS. If either fails, stop before build/deploy and remove only the reported legacy artifact.

---

### Task 3: Validar fluxos admin que dependem de clientes, vendas, pedidos e PDV

**Files:**
- No code changes expected unless a test fails.
- Verify: `tmp-tests/customer-service-vps-static.test.mjs`
- Verify: `tmp-tests/orders-service-vps-static.test.mjs`
- Verify: `tmp-tests/sale-service-vps-table-data-static.test.mjs`
- Verify: `tmp-tests/pdv-product-service-vps-only-static.test.mjs`
- Verify: `tmp-tests/admin-login-vps-customer-fallback-static.test.mjs`
- Verify: `tmp-tests/auth-context-vps-customer-static.test.mjs`
- Verify: `tmp-tests/vps-auth-cutover-static.test.mjs`

- [ ] **Step 1: Run customer service guard**

Run:

```powershell
node tmp-tests\customer-service-vps-static.test.mjs
```

Expected: PASS, confirming `services/customers.ts` does not use Supabase for `customers`.

- [ ] **Step 2: Run orders service guard**

Run:

```powershell
node tmp-tests\orders-service-vps-static.test.mjs
```

Expected: PASS, confirming `services/orderService.ts` does not use Supabase for `orders` or `order_items`.

- [ ] **Step 3: Run sales service guard**

Run:

```powershell
node tmp-tests\sale-service-vps-table-data-static.test.mjs
```

Expected: PASS, confirming `services/saleService.ts` uses `/table-data/sales` and `/table-data/sale_items`.

- [ ] **Step 4: Run PDV product service guard**

Run:

```powershell
node tmp-tests\pdv-product-service-vps-only-static.test.mjs
```

Expected: PASS, confirming PDV product search is VPS-only.

- [ ] **Step 5: Run VPS auth cutover guards**

Run:

```powershell
node tmp-tests\admin-login-vps-customer-fallback-static.test.mjs
node tmp-tests\auth-context-vps-customer-static.test.mjs
node tmp-tests\vps-auth-cutover-static.test.mjs
```

Expected: all PASS, confirming admin/customer login uses VPS auth context and services.

---

### Task 4: Validar fluxos publicos dependentes da VPS

**Files:**
- No code changes expected unless a test fails.
- Verify: `tmp-tests/catalog-public-image-fallback-static.test.mjs`
- Verify: `tmp-tests/public-company-settings-vps-only-static.test.mjs`
- Verify: `tmp-tests/public-product-custom-fields-optional-static.test.mjs`
- Verify: `tmp-tests/public-product-spec-groups-static.test.mjs`
- Verify: `tmp-tests/public-product-variant-grouping-static.test.mjs`
- Verify: `tmp-tests/order-tracking-vps-products-static.test.mjs`
- Verify: `tmp-tests/catalog-product-views-vps-static.test.mjs`

- [ ] **Step 1: Run public catalog guards**

Run:

```powershell
node tmp-tests\catalog-public-image-fallback-static.test.mjs
node tmp-tests\public-company-settings-vps-only-static.test.mjs
node tmp-tests\catalog-product-views-vps-static.test.mjs
```

Expected: all PASS, confirming catalog support data and product views are VPS-based.

- [ ] **Step 2: Run public product page guards**

Run:

```powershell
node tmp-tests\public-product-custom-fields-optional-static.test.mjs
node tmp-tests\public-product-spec-groups-static.test.mjs
node tmp-tests\public-product-variant-grouping-static.test.mjs
```

Expected: all PASS, confirming PDP behavior does not require Supabase support tables.

- [ ] **Step 3: Run order tracking guard**

Run:

```powershell
node tmp-tests\order-tracking-vps-products-static.test.mjs
```

Expected: PASS, confirming public order tracking reads product/unit details via VPS paths.

---

### Task 5: Build local de producao

**Files:**
- No code changes expected unless build fails.
- Verify: `package.json`
- Verify: `vite.config.ts`

- [ ] **Step 1: Run production build**

Run:

```powershell
npm.cmd run build
```

Expected: PASS. Known chunk/dynamic import warnings are acceptable if there are no TypeScript/Vite errors.

- [ ] **Step 2: Stop on build errors**

If build fails, fix only the first concrete TypeScript/Vite error. Then rerun:

```powershell
npm.cmd run build
```

Expected: PASS before proceeding to deploy.

---

### Task 6: Deploy site na VPS e validar HTTP basico

**Files:**
- Use: `scripts/deploy-vps-site.cjs`
- Document: `migracao_VPS.md`

- [ ] **Step 1: Deploy frontend to VPS**

Run:

```powershell
npm.cmd run deploy:vps-site
```

Expected: PASS, with release path under `/var/www/mdv-site/releases/` and `current` updated on the VPS.

- [ ] **Step 2: Validate public homepage**

Run:

```powershell
curl.exe -L -s -o NUL -w "%{http_code} %{url_effective}\n" "https://mercadodovale.com.br/"
```

Expected: `200 https://www.mercadodovale.com.br/`.

- [ ] **Step 3: Validate admin shell route**

Run:

```powershell
curl.exe -L -s -o NUL -w "%{http_code} %{url_effective}\n" "https://www.mercadodovale.com.br/admin"
```

Expected: `200 https://www.mercadodovale.com.br/admin`.

- [ ] **Step 4: Validate API status**

Run:

```powershell
curl.exe -s -i "https://api.xiaomipetrolina.com.br/status"
```

Expected: HTTP `200 OK`.

- [ ] **Step 5: Document deploy result**

Append to `migracao_VPS.md`:

```md
## 2026-05-31 - Deploy VPS apos corte sequencial

Mudanca: frontend publicado na VPS apos ativar as flags finais de runtime.

Validacao:
- `npm.cmd run deploy:vps-site`: OK.
- `curl https://mercadodovale.com.br/`: 200.
- `curl https://www.mercadodovale.com.br/admin`: 200.
- `curl https://api.xiaomipetrolina.com.br/status`: 200.

Rollback: apontar `/var/www/mdv-site/current` para a release anterior e reiniciar Nginx se necessario.
```

---

### Task 7: Corte externo Vercel somente depois do app validado

**Files:**
- Verify: `tools/audit-legacy-deploy-removal-readiness.mjs`
- Verify: `tmp-tests/legacy-deploy-removal-static.test.mjs`
- Verify: `tmp-tests/legacy-deploy-removal-readiness-static.test.mjs`
- Document: `migracao_VPS.md`

- [ ] **Step 1: Run legacy readiness audit**

Run:

```powershell
node tools\audit-legacy-deploy-removal-readiness.mjs
```

Expected: JSON with `"ready_to_remove_legacy_deploy": true` and empty `"blockers": []`.

- [ ] **Step 2: Confirm DNS if sandbox/network allows**

Run:

```powershell
Resolve-DnsName mercadodovale.com.br -Type A
Resolve-DnsName www.mercadodovale.com.br -Type A
Resolve-DnsName www.mercadodovale.com.br -Type CNAME
```

Expected: apex or `www` resolves to the VPS path, not the legacy Vercel apex IP `76.76.21.21`. If DNS times out locally, record it as inconclusive and verify from an external DNS checker manually.

- [ ] **Step 3: Confirm external provider URLs manually**

Use these expected production URLs:

```text
Bling callback: https://www.mercadodovale.com.br/api/auth/callback/bling
Bling webhook: https://www.mercadodovale.com.br/api/bling-webhook
Shopee callback: https://www.mercadodovale.com.br/api/shopee?action=callback
Shopee webhook: https://www.mercadodovale.com.br/api/shopee-webhook
Mercado Pago webhook: https://www.mercadodovale.com.br/api/mercadopago-webhook
```

Expected: no Bling, Shopee, or Mercado Pago production setting points to the retired Vercel domain.

- [ ] **Step 4: Document external cutover status**

Append to `migracao_VPS.md`:

```md
## 2026-05-31 - Checklist externo pos-corte VPS

Status local:
- `node tools\audit-legacy-deploy-removal-readiness.mjs`: ready/blockers registrados.
- DNS: registrar resultado A/CNAME ou timeout/inconclusivo.

Checklist manual:
- Bling callback e webhook apontam para `www.mercadodovale.com.br`.
- Shopee callback e webhook apontam para `www.mercadodovale.com.br`.
- Mercado Pago webhook aponta para `www.mercadodovale.com.br`.

Rollback: manter URLs antigas somente se uma integracao real falhar e registrar qual provedor bloqueou o corte.
```

---

## Execution Order Gate

Do not start Task 2 until Task 1 passes. Do not start Task 5 until Tasks 2, 3 and 4 pass. Do not start Task 6 until Task 5 passes. Do not start Task 7 until Task 6 passes and the app responds on the VPS.

## Self-Review

- Spec coverage: covers dependency order, admin page, public page, Supabase removal, Vercel removal, VPS deploy, and external provider checklist.
- Placeholder scan: no `TBD`, `TODO`, or ambiguous implementation steps remain.
- Type consistency: flag names match `config/migration.ts`; test commands match existing `tmp-tests` and `tools` paths; deploy command matches `package.json`.
