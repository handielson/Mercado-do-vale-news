# Guia de Commit e Deploy

Atualizado em `23/05/2026`.

Este arquivo existe para guiar commits neste projeto sem misturar trabalho paralelo e sem reintroduzir dependÃªncia do deploy antigo.

## Estado Atual

- branch atual de produÃ§Ã£o: `main`
- remoto: `origin` em `https://github.com/handielson/Mercado-do-vale-news.git`
- Ãºltimo commit visto: `2113109` (`fix(stock): show transfer success toast`)
- produÃ§Ã£o web: Cloudflare + VPS
- frontend: Nginx servindo `/var/www/mdv-site/current`
- API: Fastify/Node na VPS via PM2 (`mdv-api`)
- o deploy antigo saiu do caminho crÃ­tico

## Regra-Mestra

Quando o pedido for `comitar`, o fluxo padrÃ£o Ã©:

1. conferir `git status`;
2. revisar o diff dos arquivos relacionados;
3. stagear somente o que pertence ao assunto do commit;
4. rodar as validaÃ§Ãµes relevantes;
5. criar commit com mensagem objetiva;
6. fazer `push origin main`;
7. se afetar frontend, publicar na VPS ou confirmar que jÃ¡ foi publicado;
8. se afetar API/cron/webhook, publicar/reiniciar a VPS ou registrar por que nÃ£o foi feito;
9. atualizar `migraÃ§Ã£o_VPS.md` quando a mudanÃ§a fizer parte da migraÃ§Ã£o.

NÃ£o parar no commit local salvo se o usuÃ¡rio pedir explicitamente.

## Deploy Legado Removido

NÃ£o usar o deploy antigo como destino de publicaÃ§Ã£o.

O repositÃ³rio nÃ£o deve voltar a ter:

- configuracao da plataforma de deploy antiga;
- pasta `api/` com Serverless Functions;
- runtime Node da plataforma antiga;
- rewrites ou cron jobs da plataforma antiga;
- CORS permitindo o dominio antigo como fallback.

Teste de guarda:

```powershell
node tmp-tests\legacy-deploy-removal-static.test.mjs
```

Auditoria:

```powershell
node tools\audit-legacy-deploy-removal-readiness.mjs
```

O resultado esperado Ã©:

```text
ready_to_remove_legacy_deploy=true
legacy_config_present=false
legacy_rewrites_count=0
legacy_api_files_count=0
cors_allows_legacy_fallback=false
blockers=[]
```

## Commit Atual Planejado

Mensagem sugerida:

```text
chore(vps): remove legacy deploy remnants
```

Escopo principal:

- remover a configuracao do deploy legado;
- remover functions legadas em `api/`;
- remover o runtime legado de `package.json` e `package-lock.json`;
- manter a regra com `tmp-tests/legacy-deploy-removal-static.test.mjs`;
- atualizar `migraÃ§Ã£o_VPS.md` com a limpeza do deploy legado;
- incluir as correÃ§Ãµes jÃ¡ feitas e validadas para Bling import/update e financeiro/cache VPS, se o objetivo for fechar o pacote atual da migraÃ§Ã£o.

Antes de commitar, revisar com cuidado porque o worktree contÃ©m mudanÃ§as de vÃ¡rios blocos da migraÃ§Ã£o VPS.

## Arquivos Que Parecem Pertencer ao Pacote Atual

Limpeza do deploy legado:

- configuracao do deploy legado (removida)
- `api/**` (removido)
- `package.json`
- `package-lock.json`
- `tmp-tests/legacy-deploy-removal-static.test.mjs`

DocumentaÃ§Ã£o e auditoria:

- `migraÃ§Ã£o_VPS.md`
- `tools/audit-legacy-deploy-removal-readiness.mjs`
- `tmp-tests/legacy-deploy-removal-readiness-static.test.mjs`
- `tmp-tests/public-endpoint-confirmations.mjs`
- `tmp-tests/integration-config-confirmations.mjs`

- `reports/cloudflare-dns-before-2026-05-23T01-50-49-386Z.json`

VPS/site/API usados na migraÃ§Ã£o:

- `vps_server.js`
- `vps_server.cjs`
- `infra/nginx/mdv-site-production.conf`
- `scripts/deploy-vps-site.cjs`
- `tmp-tests/vps-deploy-site-from-deploy-constants.cjs`
- `tmp-tests/vps-deploy-server-only.cjs`

Bling/financeiro/import:

- `pages/admin/settings/BlingPage.tsx`
- `pages/admin/financial/FinancialPage.tsx`
- `services/blingService.ts`
- `services/blingFinanceService.ts`
- `tmp-tests/bling-import-existing-category-optional-static.test.mjs`
- `tmp-tests/bling-import-preserve-images-static.test.mjs`
- `tmp-tests/bling-finance-service-url-static.test.mjs`
- `tmp-tests/bling-finance-vps-cache-static.test.mjs`
- `tmp-tests/vps-bling-finance-cache-live-check.cjs`

Locais de estoque:

- `pages/admin/inventory/StockLocationsPage.tsx`
- `services/stockLocationService.ts`
- `types/stock-location.ts`
- `supabase/migrations/20260522000100_deactivate_stock_paths.sql`
- `tools/apply-stock-deactivation-migration.mjs`
- `tmp-tests/stock-location-deactivation-static.test.mjs`
- `tmp-tests/stock-location-duplicate-error-static.test.mjs`
- `tmp-tests/stock-location-movement-log-actions-static.test.mjs`
- `tmp-tests/stock-location-movement-product-label-static.test.mjs`

Bling reconcile/CDC e diagnÃ³sticos controlados:

- `services/blingReconcilePlanReview.js`
- `tools/check-bling-reconcile-apply-readiness.mjs`
- `tools/review-bling-reconcile-plan.mjs`
- `tmp-tests/bling-reconcile-*`
- `tmp-tests/vps-bling-reconcile-*`
- `tmp-tests/fix-bling-product-cdc-*`

Arquivos de relatÃ³rio/screenshot devem ser revisados antes de entrar no commit. NÃ£o incluir imagem ou JSON de relatÃ³rio se nÃ£o for Ãºtil para auditoria.

## ValidaÃ§Ãµes JÃ¡ Rodadas Nesta Etapa

- `node tmp-tests\bling-import-existing-category-optional-static.test.mjs`
- `node tmp-tests\bling-import-preserve-images-static.test.mjs`
- `node tmp-tests\legacy-deploy-removal-static.test.mjs`
- `npm.cmd run build`
- `node tools\audit-legacy-deploy-removal-readiness.mjs`

## Antes Do Commit

Rodar ou confirmar:

```powershell
node tmp-tests\legacy-deploy-removal-static.test.mjs
npm.cmd run build
node tools\audit-legacy-deploy-removal-readiness.mjs
git diff --cached --name-only
git diff --cached --stat
```

Comandos de Git/build neste projeto geralmente precisam ser executados fora do sandbox por causa do Synology Drive.

## Depois Do Commit

1. `git push origin main`
2. confirmar que o GitHub recebeu o commit;
3. se houver mudanÃ§a ainda nÃ£o publicada no site, rodar deploy VPS do frontend;
4. se houver mudanÃ§a em `vps_server.js`/`vps_server.cjs`, publicar/reiniciar API VPS;
5. conferir domÃ­nio final `https://www.mercadodovale.com.br`;
6. manter monitoramento de PM2, Nginx, Cloudflare e webhooks.

## Deploy VPS Do Frontend

Quando a mudanca afetar o frontend publico/admin, publicar a partir de um worktree limpo. Nao rodar `npm run deploy:vps-site` no worktree principal quando ele estiver sujo, porque o script publica o `dist/` gerado localmente e pode levar mudancas paralelas ainda nao commitadas.

### Regra Anti Tela Branca

Antes de publicar frontend na VPS, garantir que o build do worktree limpo foi gerado com as variaveis `VITE_*` reais do projeto. O erro recorrente de tela branca/skeleton infinito acontece quando o build roda sem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`; nesse caso o bundle final contem `Missing Supabase environment variables` e quebra logo ao carregar.

Regras obrigatorias:

1. nunca publicar `dist/` gerado em worktree limpo sem carregar `.env`, `.env.local` e/ou `.env.production` do projeto principal, ou sem injetar as mesmas variaveis por ambiente;
2. antes do deploy, confirmar que pelo menos `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estao definidas no ambiente do build, sem imprimir os valores;
3. depois do build e antes de trocar a release, verificar que o bundle principal nao contem a string `Missing Supabase environment variables`;
4. se o script de deploy for executado com `VPS_SITE_SKIP_BUILD=1`, isso so pode acontecer depois de um build manual validado com as variaveis `VITE_*` carregadas;
5. depois do deploy, conferir o dominio final e o bundle ativo:

```powershell
curl.exe -L -s -o NUL -w "%{http_code} %{url_effective}\n" "https://mercadodovale.com.br/"
curl.exe -L -s "https://www.mercadodovale.com.br/" | Select-String -Pattern "assets/index-.*\.js|<title>"
```

O resultado esperado e HTTP `200`, URL final em `https://www.mercadodovale.com.br/`, e o bundle ativo sem erro de variaveis ausentes.

Fluxo que funcionou em `25/05/2026`:

1. confirmar que `origin/main` aponta para o commit que deve ir para producao:

```powershell
git ls-remote origin refs/heads/main
```

2. criar um worktree temporario limpo apontando para `origin/main`:

```powershell
git worktree add C:\tmp\mdv-frontend-deploy origin/main
```

3. instalar dependencias nesse worktree:

```powershell
npm.cmd ci
```

4. carregar as credenciais VPS existentes em memoria e executar `scripts/deploy-vps-site.cjs`.

### Onde Encontrar Chaves E Credenciais

Fontes locais conhecidas:

- credenciais SSH da VPS Hostinger usadas pelos scripts antigos:

```text
C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\.claude\worktrees\lucid-banzai-322d36\deploy.cjs
```

Nesse arquivo, procurar somente estes nomes:

```text
VpsHost
VpsUser
VpsPass
```

Eles correspondem ao acesso SSH usado para publicar na VPS. Usar esse arquivo apenas como fonte local de valores para o processo de deploy. Nao imprimir `VpsPass` no chat, logs, commits ou documentacao.

- variaveis gerais do app local:

```text
C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\.env.local
C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\.env
C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\.env.production
```

Nesses arquivos existem chaves como `VITE_VPS_SYNC_KEY`, `SUPABASE_*`, `MYSQL_*`, `SYNOLOGY_*`, `BLING_*`, `SHOPEE_*` e outras integracoes. Eles nao tinham `VPS_SITE_HOST`, `VPS_SITE_USER` ou `VPS_SITE_PASSWORD` quando o deploy de `25/05/2026` foi feito.

- template do ambiente da VPS/API:

```text
C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\.env.vps.example
```

Esse arquivo serve como referencia dos nomes esperados na VPS/API, mas nao deve ser tratado como fonte de segredo real.

O deploy novo do frontend espera receber em ambiente:

```text
VPS_SITE_HOST
VPS_SITE_USER
VPS_SITE_PASSWORD ou VPS_SITE_PRIVATE_KEY
VPS_SITE_ROOT=/var/www/mdv-site
```

Mapeamento usado no deploy que funcionou:

```text
VPS_SITE_HOST     <- VpsHost
VPS_SITE_USER     <- VpsUser
VPS_SITE_PASSWORD <- VpsPass
VPS_SITE_ROOT     <- /var/www/mdv-site
```

Se precisar localizar credenciais sem expor valores, procurar apenas pelos nomes das variaveis:

```powershell
Select-String -Path ".env",".env.local",".env.production",".env.vps.example" -Pattern "VPS_SITE_|VITE_VPS_SYNC_KEY|SUPABASE_|MYSQL_|SYNOLOGY_|BLING_|SHOPEE_" | ForEach-Object { "$($_.Path):$($_.LineNumber):$($_.Line.Split('=')[0])" }
```

No Windows, se o deploy falhar com:

```text
npm run build failed to start: spawnSync npm.cmd EINVAL
```

aplicar no worktree temporario a correcao operacional em `scripts/deploy-vps-site.cjs`:

```js
shell: process.platform === 'win32',
```

Essa correcao ja existia no worktree principal durante o deploy de `25/05/2026`, mas ainda nao fazia parte do commit `1c64cba`. Se ela ainda estiver pendente, considerar commitar em pacote proprio.

Depois do deploy, a saida esperada deve incluir:

```text
Site release active: /var/www/mdv-site/releases/YYYYMMDD-HHMMSS
Nginx root should point to: /var/www/mdv-site/current
```

Verificar no servidor:

```text
readlink /var/www/mdv-site/current
test -f /var/www/mdv-site/current/index.html
ls /var/www/mdv-site/current/assets/PublicProductPage-*.js
```

Verificar publicamente:

```powershell
curl.exe -L -s -o NUL -w "%{http_code} %{url_effective}\n" "https://mercadodovale.com.br/"
```

O resultado final esperado e `200 https://www.mercadodovale.com.br/`.

Exemplo real confirmado em `25/05/2026`:

```text
commit publicado: 1c64cba0624716800965a25c097f788932e9722e
release ativa: /var/www/mdv-site/releases/20260525-014618
asset PDP: /var/www/mdv-site/current/assets/PublicProductPage-CExMp9xy.js
HTTP final: 200 https://www.mercadodovale.com.br/
```

Se criar scripts temporarios para carregar variaveis ou verificar a VPS, criar somente dentro de `C:\tmp\...` e remover depois. Nao commitar esses scripts.

## PendÃªncias Operacionais Fora Do Commit

- conferir nos painÃ©is externos se Bling, Shopee e Mercado Pago apontam para URLs finais em `www.mercadodovale.com.br`;
- fazer regressÃ£o manual com sessÃ£o admin no domÃ­nio final;
- observar payload real de webhooks em janela controlada;
- manter monitoramento 24-72h apÃ³s a limpeza.

## Frase Curta Para Seguir

Comitar sÃ³ o pacote da migraÃ§Ã£o VPS, manter o deploy antigo fora, validar build/auditoria, push em `main`, publicar na VPS quando necessÃ¡rio e registrar o resultado no `migraÃ§Ã£o_VPS.md`.
