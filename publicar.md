# Guia de Publicacao

Atualizado em `01/06/2026`.

Este arquivo e o runbook principal para commit, push e publicacao do Mercado do Vale.

## Estado Atual

- branch de producao: `main`
- remoto: `origin` em `https://github.com/handielson/Mercado-do-vale-news.git`
- producao web: Cloudflare + VPS
- frontend: Nginx servindo `/var/www/mdv-site/current`
- releases do site: `/var/www/mdv-site/releases/YYYYMMDD-HHMMSS`
- release anterior: `/var/www/mdv-site/previous`
- API: Fastify/Node na VPS via PM2 (`mdv-api`)
- arquivos estaticos e midias: Synology/NAS via VPS/CDN

## Regra Mestra

Quando o pedido for `comitar`, `publicar`, `deployar` ou equivalente:

1. conferir `git status`;
2. revisar o diff dos arquivos relacionados;
3. stagear somente o que pertence ao assunto;
4. rodar as validacoes relevantes;
5. criar commit com mensagem objetiva;
6. fazer `git push origin main`, salvo pedido contrario;
7. se afetar frontend publico/admin, publicar o site na VPS;
8. se afetar API, cron, webhook ou servidor, publicar/reiniciar a API na VPS;
9. verificar o dominio final e endpoints afetados;
10. registrar no resumo final o que foi publicado, validado e reiniciado.

Nunca usar `git add .` neste projeto. Stagear por arquivo.

## Sandbox Do Synology Drive

O workspace fica dentro do Synology Drive e o sandbox pode bloquear Git, build, deploy e acesso de rede. Quando uma tentativa falhar com erro como `Access is denied`, `Could not resolve vite.config.ts`, `connect EACCES`, DNS bloqueado ou erro de permissao em pasta sincronizada, repetir o mesmo comando fora do sandbox com aprovacao.

Para Codex, usar este caminho no `shell_command`:

```text
sandbox_permissions: "require_escalated"
justification: "Quer permitir rodar este comando fora do sandbox? O Synology Drive/sandbox bloqueou a operacao necessaria para publicar."
```

Prefixos uteis para pedir regra persistente quando fizer sentido:

```text
["npm", "run", "build"]
["npm", "run", "deploy:vps-site"]
["node", "deploy-vps-server-only.cjs"]
["git", "push"]
```

Nao tentar contornar com comandos destrutivos. Repetir exatamente o comando necessario, com escopo claro.

## Validacoes Comuns

Rodar conforme o escopo alterado:

```powershell
npm.cmd run build
node tools\audit-legacy-deploy-removal-readiness.mjs
```

Se um teste citar tecnologia aposentada apenas como guarda de regressao, isso e aceitavel. O runtime nao deve depender dela.

## Publicar Frontend Na VPS

Use este fluxo quando a mudanca afetar paginas, componentes, estilos, rotas, assets ou qualquer comportamento visivel no site/admin.

1. garantir que `origin/main` recebeu o commit correto:

```powershell
git ls-remote origin refs/heads/main
```

2. preferir worktree limpo dentro do repo, para o script carregar tambem os envs do workspace principal:

```powershell
git fetch origin main
git worktree add .worktrees\publish-site origin/main
```

3. no worktree limpo:

```powershell
cd .worktrees\publish-site
npm.cmd ci
Select-String -Path "..\..\.env.vps.local","..\..\.env.local","..\..\.env","..\..\.env.production" -Pattern "^(VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY)=" | ForEach-Object { "$($_.Path):$($_.Line.Split('=')[0])" }
npm.cmd run build
npm.cmd run deploy:vps-site
```

O script `scripts/deploy-vps-site.cjs` le `.env.vps.local` e `.env.local` do worktree e, quando o worktree esta dentro de `.worktrees`, tambem do workspace principal.

### Trava Critica: Variaveis Vite/Supabase

Antes de qualquer `npm.cmd run build` usado para producao, confirmar que as variaveis publicas do Vite existem no ambiente de build. Elas sao embutidas no JavaScript no momento do build; se faltarem, o site pode subir com HTML `200`, mas quebrar no navegador com:

```text
Uncaught Error: Missing Supabase environment variables
```

Variaveis obrigatorias enquanto houver codigo usando `services/supabase.ts` ou `import.meta.env.VITE_SUPABASE_*`:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Checar nomes sem imprimir valores:

```powershell
Select-String -Path ".env.vps.local",".env.local",".env",".env.production","..\..\.env.vps.local","..\..\.env.local","..\..\.env","..\..\.env.production" -Pattern "^(VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY)=" | ForEach-Object { "$($_.Path):$($_.Line.Split('=')[0])" }
```

Resultado minimo esperado: aparecerem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em algum arquivo carregado pelo build. Se nao aparecerem, parar a publicacao e corrigir os envs antes de buildar/deployar.

Depois do build, conferir que o bundle nao manteve o erro de env:

```powershell
Select-String -Path "dist\assets\*.js" -Pattern "Missing Supabase environment variables"
```

Se esse texto aparecer no bundle e as variaveis nao foram confirmadas no passo anterior, nao publicar.

Variaveis esperadas para publicar:

```text
VPS_SITE_HOST
VPS_SITE_USER
VPS_SITE_PASSWORD ou VPS_SITE_PRIVATE_KEY
VPS_SITE_ROOT=/var/www/mdv-site
```

Se ja houver build validado e for necessario publicar sem rebuild:

```powershell
$env:VPS_SITE_SKIP_BUILD='1'
npm.cmd run deploy:vps-site
```

Usar `VPS_SITE_SKIP_BUILD=1` somente depois de validar que `dist/` veio do commit correto.

## Verificar Site Publicado

Depois da publicacao, a saida esperada inclui:

```text
Site release active: /var/www/mdv-site/releases/YYYYMMDD-HHMMSS
Nginx root should point to: /var/www/mdv-site/current
```

Verificar publicamente:

```powershell
curl.exe -L -s -o NUL -w "%{http_code} %{url_effective}\n" "https://mercadodovale.com.br/"
curl.exe -L -s "https://www.mercadodovale.com.br/" | Select-String -Pattern "assets/index-.*\.js|<title>"
```

Resultado esperado:

```text
200 https://www.mercadodovale.com.br/
```

HTTP `200` sozinho nao prova que o app carregou. Abrir o site em navegador/DevTools e verificar console depois de reload sem cache. Nao pode haver erro fatal como:

```text
Missing Supabase environment variables
```

Sinal esperado no navegador: a pagina renderiza conteudo real do catalogo/admin, nao apenas o skeleton inicial.

Quando necessario, verificar no servidor:

```text
readlink /var/www/mdv-site/current
test -f /var/www/mdv-site/current/index.html
ls /var/www/mdv-site/current/assets
```

## Rollback Do Frontend

O deploy mantem o symlink `previous`. Para rollback:

```text
ln -sfn /var/www/mdv-site/previous /var/www/mdv-site/current
```

Depois, conferir o dominio publico novamente.

## Publicar API Na VPS

Use este fluxo quando mudar:

- `vps_server.js`
- `vps_server.cjs`
- rotas Fastify
- webhooks
- jobs/cron
- scripts usados pelo servidor
- configuracao PM2/Nginx relacionada a API

Comando principal:

```powershell
node deploy-vps-server-only.cjs
```

Depois conferir:

```text
pm2 status mdv-api
pm2 logs mdv-api --lines 80
curl -i https://www.mercadodovale.com.br/api/health
```

Se a mudanca afetar webhook, validar o endpoint especifico em modo read-only quando possivel.

## Credenciais E Env

Nao imprimir segredos no chat, logs, commits ou documentacao.

Fontes locais esperadas:

```text
C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\.env.vps.local
C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\.env.local
C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\.env
C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\.env.production
```

Para localizar nomes de variaveis sem expor valores:

```powershell
Select-String -Path ".env.vps.local",".env.local",".env",".env.production",".env.vps.example" -Pattern "VPS_SITE_|VITE_VPS_SYNC_KEY|MYSQL_|SYNOLOGY_|BLING_|SHOPEE_|MERCADO_" | ForEach-Object { "$($_.Path):$($_.LineNumber):$($_.Line.Split('=')[0])" }
```

## Checklist Final

Antes de responder que terminou:

1. dizer quais arquivos entraram no escopo;
2. listar validacoes rodadas;
3. informar se houve commit e push;
4. informar se o frontend foi publicado e qual release ficou ativa;
5. informar se a API foi publicada/reiniciada;
6. informar qualquer bloqueio de sandbox e se foi repetido fora dele;
7. nao esconder warnings relevantes, mas separar warnings conhecidos de erro real.

Frase curta para seguir: commit pequeno, push em `main`, publicacao VPS quando necessario, verificacao no dominio final.
