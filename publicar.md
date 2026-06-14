# Guia de Publicacao

Atualizado em `14/06/2026`.

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
2. procurar arquivos soltos, temporarios ou nao commitados relacionados ao assunto antes de mexer;
3. revisar o diff dos arquivos relacionados;
4. criar ou atualizar protecao contra regressao e refatoracao para a mudanca;
5. atualizar a versao da entrega em `public/VERSION.json`, `VERSAO_ATUAL.md` e `docs/versoes/`;
6. stagear somente o que pertence ao assunto;
7. rodar as validacoes relevantes;
8. criar commit com mensagem objetiva;
9. criar tag/versao quando a publicacao for ponto de recuperacao;
10. fazer `git push origin main`, salvo pedido contrario, sempre fora do sandbox com permissao elevada no Codex;
11. se afetar frontend publico/admin, publicar o site na VPS, sempre fora do sandbox com permissao elevada no Codex;
12. se afetar API, cron, webhook ou servidor, publicar/reiniciar a API na VPS, sempre fora do sandbox com permissao elevada no Codex;
13. verificar o dominio final e endpoints afetados, sempre fora do sandbox com permissao elevada no Codex quando usar rede externa;
14. conferir novamente `git status` e remover ou registrar qualquer lixo gerado nesta edicao;
15. registrar no resumo final o que foi publicado, validado, reiniciado, versionado e limpo.

Nunca usar `git add .` neste projeto. Stagear por arquivo.

## Regra De Versao

Toda publicacao precisa deixar um ponto facil de recuperacao.

Arquivos obrigatorios:

- `public/VERSION.json`: versao visivel no site depois do deploy, acessivel por `/VERSION.json`;
- `VERSAO_ATUAL.md`: resumo humano da versao atual;
- `docs/versoes/YYYY-MM-DD-vX.Y.Z-<assunto>.md`: registro copiavel do que entrou.

Regra pratica:

1. aumentar a versao antes de publicar;
2. registrar data, branch, release VPS, arquivos alterados e validacoes;
3. se a publicacao ja tiver release VPS, preencher o caminho exato `/var/www/mdv-site/releases/YYYYMMDD-HHMMSS`;
4. se ainda nao publicou, deixar `release_vps` como `pendente` e atualizar logo apos o deploy;
5. criar tag Git para pontos importantes de recuperacao, por exemplo `v1.1.0-bling-spec-autofill`;
6. quando precisar recuperar algo, procurar primeiro o arquivo em `docs/versoes/` e depois usar a tag/commit registrado.

Nao colocar versao no nome de componentes como `ProductForm-v1.tsx`. A versao pertence a release inteira, nao a um arquivo isolado.

## Regras Obrigatorias Para Codex

Estas regras existem para economizar tempo e evitar regressao:

- Nao tentar `git push`, `npm.cmd run deploy:vps-site`, `node deploy-vps-server-only.cjs` nem `curl.exe` de verificacao publica dentro do sandbox. Chamar direto `shell_command` com `sandbox_permissions: "require_escalated"`.
- Antes de implantar qualquer funcao ou ajuste, procurar arquivos soltos relacionados ao assunto com `git status --short`, `git ls-files --others --exclude-standard` e `rg` por nomes/termos do dominio alterado.
- Toda mudanca de comportamento, texto critico, recibo, calculo, rota, status, integracao, permissao ou fluxo de usuario deve ter protecao contra regressao. Quando a mudanca puder ser afetada por refatoracao, a protecao deve ser pensada para falhar se o comportamento sumir, mesmo que arquivos mudem de lugar.
- Ao terminar cada publicacao, conferir o que ficou sujo. Arquivos temporarios, scripts de diagnostico, logs, assets gerados ou testes experimentais criados nessa edicao devem ser removidos ou commitados de proposito. Nao deixar lixo nao publicado para virar regressao depois.
- Se ja existirem arquivos soltos de outro trabalho do usuario ou de outro fluxo, nao apagar. Registrar que sao preexistentes e stagear somente o escopo atual.

## Caminho Padrao Mais Rapido

Para a maioria das publicacoes da VPS, o fluxo certo e este:

1. conferir o estado do repo e garantir que o commit certo ja foi preparado;
2. rodar o deploy oficial, que ja faz o build por conta propria, sempre fora do sandbox com permissao elevada:

```powershell
npm.cmd run deploy:vps-site
```

Quando a publicacao tiver versao registrada, fixar o nome da release para bater com `public/VERSION.json`:

```powershell
$env:VPS_SITE_RELEASE_NAME='20260614-190454-v110-bling-spec'
npm.cmd run deploy:vps-site
```

O formato aceito e `YYYYMMDD-HHMMSS` ou `YYYYMMDD-HHMMSS-label`.

No Codex, nao tentar esse comando primeiro dentro do sandbox. Ele precisa abrir SSH para a VPS e normalmente falha com `connect EACCES` ou bloqueio equivalente. Chamar direto o `shell_command` com:

```text
sandbox_permissions: "require_escalated"
justification: "Permite conectar via SSH ao VPS para publicar a release do site?"
prefix_rule: ["npm.cmd", "run", "deploy:vps-site"]
```

3. conferir a saida do script, que deve mostrar `Site release active` e o `current`;
4. validar a URL publica afetada no navegador ou por `curl` tambem fora do sandbox com permissao elevada;
5. registrar a release ativa neste arquivo ou na nota da entrega.

Use `VPS_SITE_SKIP_BUILD=1` somente quando o `dist/` ja tiver sido gerado e validado exatamente a partir do commit que sera publicado. Fora isso, deixe o script reconstruir o bundle.

O deploy do site sempre publica o `dist/` inteiro em uma nova release dentro de `/var/www/mdv-site/releases/YYYYMMDD-HHMMSS` e depois troca o symlink `/var/www/mdv-site/current`. Nao publicar apenas arquivos modificados do frontend: o Vite gera nomes com hash e pode alterar chunks compartilhados, CSS, manifest implicito no `index.html` e dependencias mesmo quando a mudanca parece pequena. O rollback tambem depende de cada release estar completa.

Use worktree separado apenas quando houver necessidade real de isolamento. Para publicacao normal, ele nao e obrigatorio e costuma atrasar.

## Sandbox Do Synology Drive

O workspace fica dentro do Synology Drive e o sandbox pode bloquear Git, build, deploy e acesso de rede. Para `git push`, publicacao na VPS e verificacao publica externa, nao fazer tentativa inicial dentro do sandbox: executar direto fora do sandbox com permissao elevada. Quando outros comandos falharem com erro como `Access is denied`, `Could not resolve vite.config.ts`, `connect EACCES`, DNS bloqueado ou erro de permissao em pasta sincronizada, repetir o mesmo comando fora do sandbox com aprovacao.

Na pratica, publicacao na VPS e verificacao externa quase sempre batem no sandbox. Para evitar perder tempo, ja executar estes comandos com permissao elevada:

```text
sandbox_permissions: "require_escalated"
justification: "Quer permitir rodar este comando fora do sandbox? Publicacao/verificacao externa na VPS costuma ser bloqueada pelo sandbox."
```

Comandos que devem ir direto com permissao elevada:

```powershell
git push origin main
git push origin HEAD:main
npm.cmd run deploy:vps-site
node deploy-vps-server-only.cjs
curl.exe -s -I https://www.mercadodovale.com.br/
curl.exe -s -I https://www.mercadodovale.com.br/admin/financeiro
curl.exe -s -i https://api.xiaomipetrolina.com.br/status
```

Para Codex, usar este caminho no `shell_command`:

```text
sandbox_permissions: "require_escalated"
justification: "Quer permitir rodar este comando fora do sandbox? O Synology Drive/sandbox bloqueou a operacao necessaria para publicar."
```

Prefixos uteis para pedir regra persistente quando fizer sentido:

```text
["npm.cmd", "run", "build"]
["npm.cmd", "run", "deploy:vps-site"]
["node", "deploy-vps-server-only.cjs"]
["curl.exe"]
["git", "push"]
```

Nao tentar contornar com comandos destrutivos. Repetir exatamente o comando necessario, com escopo claro.

Observacao importante: se `npm.cmd run deploy:vps-site` demorar muito e estourar timeout, repetir com timeout maior. O deploy pode subir centenas de assets e precisa terminar ate exibir `Site release active`.

## Registro Da Publicacao 09/06/2026

Ultima publicacao confirmada:

```text
Site release active: /var/www/mdv-site/releases/20260609-151407
Nginx root: /var/www/mdv-site/current
Verificacao publica: https://www.mercadodovale.com.br/admin/financial/crediario?customer_id=8f0b9fab-64c5-4f8b-aa86-e7b6a063f63b retornou HTTP 200
```

Atualizacao complementar publicada em `09/06/2026`:

```text
Site release active: /var/www/mdv-site/releases/20260609-154254
API VPS: mdv-api reiniciada via PM2 e ficou online
Verificacao publica crediario: HTTP 200
Verificacao publica API: https://api.xiaomipetrolina.com.br/status retornou HTTP 200, mysql.ok=true
```

O que entrou nessa atualizacao:

- correcao da escala da venda vinculada no crediario: a divida/pagamentos continuam em centavos, mas os itens e total da venda nao sao divididos por 100 novamente;
- botao `Dar baixa` no crediario admin, com valor parcial/total, forma da baixa (`pix`, `dinheiro`, `cartao`, `outro`) e observacoes;
- bloco de crediario no cadastro do cliente para gerar Pix Mercado Pago;
- cliente pode escolher pagar todos os debitos selecionados ou um valor parcial;
- API do Mercado Pago agora grava `allocations_json` no intent para permitir um Pix unico baixando varios debitos automaticamente no webhook;
- protecoes contra regressao para a rota antiga do crediario, baixa manual, Pix do cliente e alocacao multi-debito.

Validacoes adicionais:

```powershell
node tmp-tests\customer-credit-ledger-route-static.test.mjs
node tmp-tests\customer-profile-credit-payments-static.test.mjs
node tmp-tests\customer-debt-mercadopago-allocation-static.test.mjs
node tmp-tests\customer-details-financial-summary-static.test.mjs
node tmp-tests\sale-service-customer-debt-static.test.mjs
node --check vps_server.js
node --check vps_server.cjs
npm.cmd run build
npm.cmd run deploy:vps-site
node deploy-vps-server-only.cjs
curl.exe -s -I "https://www.mercadodovale.com.br/admin/financial/crediario?customer_id=8f0b9fab-64c5-4f8b-aa86-e7b6a063f63b"
curl.exe -s -i https://api.xiaomipetrolina.com.br/status
```

O que entrou nessa publicacao:

- restauracao da tela antiga de crediario em `/admin/financial/crediario`;
- alias tambem disponivel em `/admin/financeiro/crediario`;
- correcao do atalho do cliente para abrir o crediario com `customer_id`;
- historico de pagamentos do crediario com pedido vinculado e itens da venda;
- resumo financeiro do cliente na tela de detalhes;
- registro automatico de debito em `customer_debts` para venda PDV com pagamento `a_prazo`;
- normalizacao para valores de venda migrados/salvos em centavos com sufixo decimal;
- exibicao do crediario dividindo valores de pagamento, total e itens por 100;
- backfill no financeiro do cliente `Leandro Lino De Oliveira`:
  - pedido `#5EE58EF8`: debito criado com saldo `R$ 597,10`;
  - pedido `#A916C426`: debito e baixas ajustados dividindo por 100, saldo final `R$ 2,77`;
  - saldo em aberto confirmado na VPS: `R$ 599,87`.

Validacoes rodadas antes/depois:

```powershell
node tmp-tests\customer-credit-ledger-route-static.test.mjs
node tmp-tests\customer-details-financial-summary-static.test.mjs
node tmp-tests\sale-service-customer-debt-static.test.mjs
node tmp-tests\sale-service-currency-normalization-static.test.mjs
node tmp-tests\sale-service-vps-table-data-static.test.mjs
npm.cmd run build
npm.cmd run deploy:vps-site
curl.exe -s -I "https://www.mercadodovale.com.br/admin/financial/crediario?customer_id=8f0b9fab-64c5-4f8b-aa86-e7b6a063f63b"
```

Comportamento esperado daqui para frente: toda nova venda `a_prazo` deve criar o debito do cliente automaticamente no financeiro. A tela correta do crediario e `/admin/financial/crediario?customer_id=...`; `/admin/financeiro` e outra tela e nao substitui o crediario. Se uma venda antiga nao aparecer no financeiro, verificar `customer_debts` pelo `sale_id` antes de assumir erro da tela.

## WhatsApp API Evolution Validada 09/06/2026

A pendencia anterior do WhatsApp foi resolvida e conferida contra a VPS em producao:

- `GET https://api.xiaomipetrolina.com.br/status` retornou HTTP 200 com MySQL ok;
- `GET /autoresponder/whatsapp/state` retornou a instancia `mercado_do_vale` em `state: "open"`;
- `GET /autoresponder/whatsapp/debug` confirmou Evolution API `2.3.7` em `http://127.0.0.1:8080`;
- `POST /autoresponder/whatsapp/sync-webhook` confirmou webhook ativo em `https://api.xiaomipetrolina.com.br/autoresponder-webhook` para `CONNECTION_UPDATE` e `MESSAGES_UPSERT`;
- teste controlado com `test-flow` respondeu sem deixar conversa no banco (`cleanup: true`);
- payload Evolution `MESSAGES_UPSERT` com `fromMe: true` e `source: "web"` foi reconhecido como `source: "evolution"` e pausou a conversa como `human_handoff`, sem envio real (`sent: []`).

Observacao: durante a validacao o autoresponder estava desligado (`enabled: 0`), foi ligado apenas temporariamente para o teste e restaurado para `enabled: 0` ao final.

## Publicacao API Autoresponder 09/06/2026

Publicacao feita com `node deploy-vps-server-only.cjs` seguindo o fluxo deste runbook.

O que entrou:

- trava para o fluxo de captura de nome nao salvar pergunta comercial como nome do contato;
- preservacao do fluxo Evolution/Google Contacts ja validado na VPS;
- correcao manual previa do contato `558796246812`, consolidando a conversa duplicada em uma unica chave com nome `Handielson`.

Validacoes rodadas:

```powershell
node tmp-tests\autoresponder-contact-name-invalid-replies-static.test.mjs
node tmp-tests\autoresponder-google-contact-flow-static.test.mjs
node tmp-tests\autoresponder-whatsapp-evolution-static.test.mjs
node --check vps_server.js
node --check vps_server.cjs
node deploy-vps-server-only.cjs
curl.exe -s -i https://api.xiaomipetrolina.com.br/status
```

Validacao em producao:

- PM2 reiniciou `mdv-api` e ficou `online`;
- `/status` retornou HTTP 200, `mysql.ok=true`;
- arquivo remoto `/var/www/mdv-api/vps_server.js` contem `looksLikeCommercialQuestion`, `normalizeEvolutionWebhookPayload` e `findGoogleContactByPhone`;
- `test-flow` com `oi` + `vende tablet?` respondeu como busca de produto e nao gravou `vende tablet` como nome;
- `autoresponder_settings.enabled` foi restaurado para `0` ao fim do teste.

## Publicacao API Autoresponder Google Contacts 09/06/2026

Motivo: evitar regressao na identificacao de nomes ja salvos no Google Contacts quando o telefone chega do WhatsApp sem o nono digito brasileiro ou quando o contato ainda esta em "Outros contatos".

O que entrou:

- busca de contato primeiro em `people:searchContacts`;
- fallback por `people/me/connections` para comparar telefones direto na lista de contatos quando a busca indexada nao retornar o numero;
- fallback por `otherContacts:search`, sem quebrar o atendimento se o token ainda nao tiver o escopo de "Outros contatos";
- comparacao de telefone brasileiro com e sem o nono digito;
- OAuth local atualizado para pedir tambem `contacts.other.readonly`.

Validacoes rodadas antes da publicacao:

```powershell
node tmp-tests\autoresponder-google-contact-flow-static.test.mjs
node tmp-tests\google-contacts-oauth-static.test.mjs
node tmp-tests\autoresponder-contact-name-invalid-replies-static.test.mjs
node tmp-tests\autoresponder-whatsapp-evolution-static.test.mjs
node --check vps_server.js
node --check vps_server.cjs
```

Publicacao feita com `node deploy-vps-server-only.cjs`.

Validacao em producao:

- PM2 reiniciou `mdv-api` e ficou `online`;
- `/status` retornou HTTP 200, `ok=true`, `mysql.ok=true`;
- arquivo remoto `/var/www/mdv-api/vps_server.js` contem `getAutoresponderPhoneMatchKeys`, `people/me/connections` e `otherContacts:search`;
- `/autoresponder/whatsapp/state` autenticado retornou HTTP 200 com instancia `mercado_do_vale` em `state: "open"`;
- `test-flow` autenticado com `cleanup: true` nao deixou conversa residual. Como `autoresponder_settings.enabled` estava desligado, nao houve replies nesse teste.

Observacao: no teste direto da People API, a conta ja retorna o contato `Handielson Amorim` por nome, mas ainda nao retorna telefone no payload da API apesar de ele aparecer na tela do Google Contacts. Por isso a protecao de nono digito e conexoes ficou no codigo, mas a validacao final do contato especifico tambem depende do Google expor o telefone pelo endpoint.

Pendencias de nome do contato:

- a tabela `autoresponder_contact_name_curation` guarda apenas mensagens rejeitadas durante captura de nome do contato;
- nao substitui a fila de perguntas nao respondidas;
- admin pode salvar o nome manualmente ou ignorar a pendencia;
- publicar API antes do frontend quando houver mudanca de rota/tabela;
- validacao local: `npm.cmd run test:autoresponder:whatsapp`.

## Validacoes Comuns

Rodar conforme o escopo alterado:

```powershell
npm.cmd run build
node tools\audit-legacy-deploy-removal-readiness.mjs
```

Se um teste citar tecnologia aposentada apenas como guarda de regressao, isso e aceitavel. O runtime nao deve depender dela.

## Protecao Contra Regressao E Refatoracao

Toda edicao publicada deve deixar uma defesa proporcional ao risco:

- Bug corrigido: criar teste que falha antes da correcao e passa depois.
- Texto/rotulo importante: criar teste estatico ou de render que impeça o texto antigo de voltar e confirme o texto esperado.
- Recibo, pagamento, entrega, financeiro, estoque, crediario, garantia, login, API e webhooks: sempre criar protecao de regressao.
- Refatoracao: a protecao deve validar comportamento/contrato, nao apenas o nome de uma funcao. Se o teste precisar apontar para arquivo especifico, documentar esse acoplamento e atualizar o teste junto com a refatoracao legitima.
- Se ja houver teste cobrindo exatamente o comportamento, atualizar esse teste em vez de criar duplicado.

Antes de mexer, verificar se ja existe guarda relacionada:

```powershell
rg "termo-da-mudanca|nome-da-rota|nome-do-componente|texto-visivel" tmp-tests components pages services utils vps_server.js vps_server.cjs
```

Depois de mexer, rodar pelo menos a guarda nova/alterada e qualquer teste diretamente relacionado.

## Higiene De Arquivos Da Edicao

Antes de implementar:

```powershell
git status --short
git ls-files --others --exclude-standard
```

Depois de implementar e antes do commit:

```powershell
git status --short
git diff --name-only
git ls-files --others --exclude-standard
```

Regras:

- arquivos criados para diagnostico temporario devem ser removidos antes do commit;
- testes de regressao, scripts permanentes e docs atualizadas devem ser commitados de proposito;
- logs como `deploy-vps-site.log`, dumps locais e assets gerados fora do fluxo normal nao devem ficar soltos;
- nunca limpar mudancas preexistentes do usuario sem pedido explicito;
- no resumo final, informar se a worktree ficou limpa ou quais arquivos preexistentes ficaram fora do escopo.

## Publicar Frontend Na VPS

Use este fluxo quando a mudanca afetar paginas, componentes, estilos, rotas, assets ou qualquer comportamento visivel no site/admin.

1. garantir que `origin/main` recebeu o commit correto:

```powershell
git ls-remote origin refs/heads/main
```

2. se for necessario isolar a publicacao, criar worktree limpo dentro do repo para manter os envs do workspace principal:

```powershell
git fetch origin main
git worktree add .worktrees\publish-site origin/main
```

3. no workspace escolhido, fazer o deploy:

```powershell
npm.cmd run deploy:vps-site
```

O script `scripts/deploy-vps-site.cjs` le `.env.vps.local` e `.env.local` do worktree e, quando o worktree esta dentro de `.worktrees`, tambem do workspace principal.

### Trava Critica: Supabase e Somente Legado

Antes de qualquer `npm.cmd run build` usado para producao, confirmar que o bundle nao voltou a depender do Supabase. A regra atual e:

```text
Supabase e somente fonte legada temporaria. Nada novo deve ler, escrever, sincronizar ou vincular Supabase.
```

Rodar a trava:

```powershell
node scripts\assert-no-supabase-runtime.cjs
```

O `npm.cmd run build` tambem roda essa trava no `prebuild`. Se falhar, parar a publicacao e migrar o fluxo para VPS/MySQL antes de publicar.

Depois do build, conferir que o bundle publicado nao contem rastros operacionais do Supabase:

```powershell
Select-String -Path "dist\assets\*.js" -Pattern "services/supabase|@supabase/supabase-js|VITE_SUPABASE|Missing Supabase environment variables"
```

Se aparecer qualquer resultado, nao publicar.

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

HTTP `200` sozinho nao prova que o app carregou. Abrir o site em navegador/DevTools e verificar console depois de reload sem cache. Nao pode haver erro fatal nem dependencia operacional de Supabase no bundle, como:

```text
Missing Supabase environment variables
services/supabase
@supabase/supabase-js
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
6. informar que `push`, deploy e verificacoes externas foram feitos direto com permissao elevada quando aplicavel;
7. informar qual protecao contra regressao/refatoracao foi criada ou atualizada;
8. informar a auditoria de arquivos soltos e se algo foi limpo;
9. nao esconder warnings relevantes, mas separar warnings conhecidos de erro real.

Frase curta para seguir: commit pequeno, push em `main`, publicacao VPS quando necessario, verificacao no dominio final.
