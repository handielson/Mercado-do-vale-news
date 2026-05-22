# Migração VPS

Este documento define as regras para conduzir a migração do Mercado do Vale para a VPS, com foco em remover dependências da Vercel e usar a VPS como infraestrutura principal do sistema.

## Objetivo Principal

Usar ao máximo a VPS para hospedar, executar e controlar o sistema.

A VPS deve ser tratada como o centro da aplicação:

- frontend;
- APIs;
- webhooks;
- rotinas agendadas;
- uploads;
- arquivos públicos;
- logs;
- processos Node;
- banco operacional sempre que possível;
- deploy e rollback.

Tudo que não puder ir para a VPS deve ter justificativa clara e alternativa proposta.

## Regra 1 - VPS Primeiro

Antes de escolher qualquer serviço externo, perguntar:

> Isso pode rodar de forma segura, estável e sustentável na VPS?

Se a resposta for sim, a preferência é VPS.

Exemplos que devem ir para VPS:

- site React/Vite servido por Nginx;
- rotas `/api/*` em Fastify/Node;
- webhooks Bling, Shopee, Mercado Pago e Telegram;
- cron jobs;
- geração de sitemap;
- HTML SEO de produto;
- proxy seguro para operações administrativas;
- uploads e arquivos públicos;
- logs da aplicação;
- deploy com PM2/Nginx.

## Regra 2 - Exceções Precisam de Alternativa

Se algo não for para a VPS, deve ser registrado com:

1. motivo técnico;
2. risco de manter fora;
3. alternativa principal;
4. alternativa de contingência;
5. plano futuro para reduzir dependência, se fizer sentido.

Modelo:

```text
Item:
Por que não vai para VPS agora:
Risco:
Alternativa escolhida:
Alternativa reserva:
Plano futuro:
```

Exemplo:

```text
Item: CDN global
Por que não vai para VPS agora: CDN exige presença em múltiplas regiões.
Risco: dependência externa para cache e proteção.
Alternativa escolhida: Cloudflare.
Alternativa reserva: Nginx direto sem CDN, com cache local.
Plano futuro: manter Cloudflare apenas como borda, sem lógica de aplicação.
```

## Regra 3 - Cloudflare é Borda, Não Aplicação

Cloudflare pode ser usado para:

- DNS;
- CDN;
- cache de assets estáticos;
- WAF/proteção;
- SSL/proxy;
- túnel para Synology quando necessário.

Cloudflare não deve virar substituto da aplicação.

Evitar colocar lógica de negócio em Workers ou regras complexas se a VPS puder resolver.

## Regra 4 - Vercel Deve Sair do Caminho Crítico

A migração só será considerada concluída quando:

- `mercadodovale.com.br` não depender da Vercel;
- `www.mercadodovale.com.br` não depender da Vercel;
- nenhum webhook externo apontar para Vercel;
- nenhum OAuth callback apontar para Vercel;
- nenhum cron depender de Vercel;
- deploy não usar `npx vercel`;
- logs e rollback existirem fora da Vercel.

Enquanto isso não acontecer, Vercel ainda é dependência ativa.

## Regra 5 - Migrar em Segundo Plano e Trocar no Final

A migração deve ser feita por partes pequenas, mas sem trocar o domínio principal antes da validação completa.

Fluxo recomendado:

1. criar staging na VPS;
2. subir frontend na VPS;
3. migrar APIs por bloco;
4. rodar testes de regressão;
5. validar webhooks e OAuth;
6. validar SEO e sitemap;
7. baixar TTL do DNS;
8. trocar domínio principal;
9. monitorar;
10. manter rollback temporário.

## Regra 6 - Regressão Antes de Trocar

Cada bloco migrado deve ter comparação entre produção atual e staging VPS.

Testar no mínimo:

- status HTTP;
- corpo principal da resposta;
- redirects;
- headers importantes;
- autenticação;
- permissão admin/customer;
- payloads de webhook;
- SEO;
- sitemap;
- comportamento no navegador.

Nenhuma troca definitiva deve acontecer sem checklist de regressão.

## Regra 7 - Manter Caminhos Públicos Sempre que Possível

Para reduzir risco com integrações externas, preservar os caminhos atuais:

- `/api/bling`;
- `/api/bling-webhook`;
- `/api/auth/callback/bling`;
- `/api/shopee`;
- `/api/shopee-catalog`;
- `/api/shopee-actions`;
- `/api/shopee-webhook`;
- `/api/mercadopago-webhook`;
- `/api/vps-proxy`;
- `/sitemap.xml`;
- `/produto/:slug`.

Se algum caminho precisar mudar, documentar:

- onde ele é usado;
- quem precisa ser atualizado;
- como validar;
- como reverter.

## Regra 8 - Nginx na Frente, Fastify Atrás

Arquitetura preferida:

- Nginx serve `dist/`;
- Nginx faz fallback SPA para `index.html`;
- Nginx proxya `/api/*` para Fastify;
- Fastify executa APIs, webhooks e jobs;
- PM2 mantém Fastify vivo;
- Certbot ou Cloudflare cuidam de SSL;
- Cloudflare fica na borda.

Evitar expor Node diretamente na internet sem proxy reverso.

## Regra 9 - PM2 Para Processos Node

Todo processo Node permanente na VPS deve rodar sob PM2 ou equivalente.

Requisitos:

- nome claro do processo;
- diretório documentado;
- `.env` documentado;
- logs acessíveis;
- comando de restart;
- comando de rollback;
- healthcheck.

## Regra 10 - Deploy Com Rollback

Deploy na VPS deve permitir voltar versão.

Preferência:

- releases com pasta versionada;
- symlink `current`;
- symlink/pasta `previous`;
- rollback sem rebuild;
- logs preservados.

Evitar sobrescrever produção sem caminho simples de volta.

## Regra 11 - Segredos Fora do Código

Nenhum segredo real deve ser colocado em arquivos versionados.

Usar:

- `.env` na VPS;
- secrets do GitHub Actions;
- `.env.example` ou `.env.vps.example` apenas com nomes e placeholders.

Segredos incluem:

- chaves Supabase;
- `SYNC_SECRET`;
- `VPS_SYNC_KEY`;
- credenciais Bling;
- credenciais Shopee;
- Mercado Pago;
- Telegram;
- Synology;
- Google Contacts;
- senhas SSH/MySQL.

## Regra 12 - Banco na VPS Sempre que Viável

Para dados operacionais novos, preferir MySQL na VPS.

Supabase pode permanecer quando:

- ainda for necessário para autenticação;
- a migração do módulo ainda não existir;
- houver risco alto em migrar junto com a saída da Vercel.

Mas cada permanência no Supabase deve ser marcada como dependência externa e entrar no plano futuro de redução.

## Regra 13 - Logs e Diagnóstico na VPS

Todo bloco migrado deve ter forma clara de diagnóstico:

- PM2 logs;
- Nginx access/error logs;
- logs de cron;
- logs de webhook;
- healthcheck;
- mensagens de erro copiáveis quando houver UI.

Se a Vercel deixar de existir, a VPS precisa mostrar o que está acontecendo.

## Regra 14 - Sem Big Bang Sem Staging

Não trocar DNS direto para uma implementação não testada.

Obrigatório antes do DNS:

- domínio ou subdomínio staging;
- frontend abrindo;
- APIs críticas funcionando;
- regressão mínima rodada;
- plano de rollback definido.

## Regra 15 - Ordem de Prioridade

Prioridade da migração:

1. frontend na VPS em staging;
2. Nginx/SSL/staging;
3. `/api/vps-proxy`;
4. SEO e sitemap;
5. Bling;
6. Shopee;
7. shipping;
8. Telegram;
9. cron;
10. DNS final;
11. monitoramento pós-troca;
12. limpeza de Vercel.

## Regra 16 - Documentar ao Fim de Cada Mudança

Ao finalizar qualquer mudança da migração, documentar o que foi feito antes de seguir para a próxima etapa.

A documentação deve registrar:

- data da mudança;
- objetivo;
- arquivos alterados;
- rotas/domínios afetados;
- variáveis de ambiente envolvidas;
- comandos executados;
- testes/regressões realizados;
- resultado da validação;
- pendências;
- riscos restantes;
- rollback disponível;
- decisão para o próximo passo.

Modelo mínimo:

```text
Data:
Mudança:
Objetivo:
Arquivos/infra alterados:
Rotas afetadas:
Validação:
Resultado:
Pendências:
Rollback:
Próximo passo:
```

Se a mudança for commitada, informar também o hash do commit.

Essa regra vale para alterações pequenas e grandes. Nenhuma etapa da migração deve ficar apenas "na memória".

## Regra 17 - Debug Copiável Rico em Detalhes

Todo processo crítico migrado deve oferecer debug copiável quando falhar.

O objetivo é conseguir identificar processos defeituosos sem depender apenas de mensagem genérica na tela ou de tentativa e erro.

Aplicar especialmente em:

- importação Bling;
- sincronização Shopee;
- webhooks;
- OAuth callbacks;
- cron jobs;
- `/api/vps-proxy`;
- uploads;
- geração de sitemap;
- SEO de produto;
- operações administrativas que gravam dados;
- comunicação VPS, Supabase, Synology ou APIs externas.

O debug copiável deve conter, quando aplicável:

- timestamp;
- ambiente;
- rota ou operação;
- método HTTP;
- status HTTP;
- mensagem bruta do erro;
- etapa onde falhou;
- IDs envolvidos;
- SKU/produto/pedido, quando houver;
- payload resumido;
- resposta resumida da API externa;
- configuração relevante sem segredo;
- origem/destino da chamada;
- usuário/admin/customer envolvido, se seguro;
- tentativa atual e total de tentativas;
- instrução curta do que copiar para análise.

Nunca incluir no debug:

- tokens;
- senhas;
- service role key;
- access token;
- refresh token;
- `SYNC_SECRET`;
- `VPS_SYNC_KEY`;
- dados sensíveis completos de cliente;
- cartões ou dados de pagamento.

Quando houver risco de segredo, mascarar:

```text
abcd1234...wxyz7890
```

Formato recomendado:

```json
{
  "timestamp": "2026-05-20T00:00:00.000Z",
  "environment": "production",
  "operation": "bling-import",
  "stage": "create-model",
  "rawMessage": "mensagem original do erro",
  "http": {
    "method": "POST",
    "route": "/api/bling",
    "status": 500
  },
  "context": {
    "productId": "id",
    "sku": "sku",
    "externalId": "id externo"
  },
  "safeConfig": {
    "usesVps": true,
    "hasSupabaseUrl": true,
    "hasSyncKey": true
  }
}
```

Sempre que uma falha nova for descoberta por debug copiável, avaliar se o debug precisa ser enriquecido para a próxima investigação.

## Regra 18 - Alimentar o Documento com Rotas

Este documento deve funcionar como inventário vivo das rotas durante a migração.

Ao criar, migrar, alterar, remover ou validar qualquer rota, atualizar a seção "Mapa de Rotas" deste documento.

Cada rota deve registrar:

- caminho público;
- origem atual;
- destino planejado;
- status da migração;
- tipo da rota;
- responsável técnico;
- autenticação exigida;
- dependências externas;
- variáveis de ambiente envolvidas;
- regra de Nginx, se houver;
- teste/regressão associado;
- data da última validação;
- observações e riscos.

Status permitidos:

- `vercel`;
- `vps-staging`;
- `vps-produção`;
- `migrada`;
- `pendente`;
- `bloqueada`;
- `desativada`.

Tipos sugeridos:

- `frontend`;
- `api`;
- `webhook`;
- `oauth`;
- `seo`;
- `sitemap`;
- `cron`;
- `proxy`;
- `arquivo`;
- `admin`;
- `publica`.

Modelo:

```text
Rota:
Origem atual:
Destino planejado:
Status:
Tipo:
Auth:
Dependências:
Env vars:
Nginx:
Teste:
Última validação:
Observações:
```

Nenhuma rota crítica deve ser migrada sem atualizar o mapa.

## Matriz de Decisão

| Item | Preferência | Alternativa Permitida |
| --- | --- | --- |
| Frontend | VPS + Nginx | Cloudflare cache |
| APIs | VPS + Fastify | Nenhuma sem justificativa |
| Webhooks | VPS + Fastify | Nenhuma sem justificativa |
| Cron | VPS crontab/systemd/PM2 | Serviço externo só com justificativa |
| SSL | Certbot ou Cloudflare Origin Cert | Cloudflare Flexible não recomendado |
| CDN | Cloudflare | Nginx direto temporariamente |
| Banco operacional | MySQL VPS | Supabase temporário por módulo |
| Auth | VPS futuro | Supabase temporário |
| Logs | PM2/Nginx/arquivos | Serviço externo complementar |
| Deploy | GitHub Actions para VPS | manual temporário |
| Rollback | symlink release | restaurar backup manual temporário |

## Fluxo de Deploy do Site na VPS

Este é o fluxo operacional para publicar o frontend sem Vercel.

1. Gerar build do site:

```bash
npm run build
```

2. Enviar o build para a VPS:

```bash
npm run deploy:vps-site
```

O script deve publicar a pasta `dist/` em um release versionado dentro de:

```text
/var/www/mdv-site/releases
```

Cada deploy cria uma pasta própria, por exemplo:

```text
/var/www/mdv-site/releases/20260520-180705
```

3. Trocar o release ativo por symlink:

```text
/var/www/mdv-site/current
```

Antes da troca, o release anterior deve ficar preservado em:

```text
/var/www/mdv-site/previous
```

4. Servir o site pelo Nginx:

- `root` aponta para `/var/www/mdv-site/current`;
- assets versionados de `/assets/*` usam cache longo;
- rotas SPA como `/admin/*` caem no `index.html`;
- `/api/*` é proxy reverso para o Fastify/PM2;
- `/sitemap.xml` e `/produto/:slug` ficam reservadas antes do fallback SPA porque precisam de SEO/HTML próprio.

5. Validar após o deploy:

- `curl -I` no domínio ou staging;
- abrir `/`;
- abrir `/admin/products`;
- validar assets `/assets/*`;
- validar `/api/status`;
- validar `/api/vps-proxy?path=/status`;
- checar logs do Nginx e PM2.

6. Rollback:

Se o deploy falhar, voltar o symlink `current` para `previous`:

```bash
ln -sfn /var/www/mdv-site/previous /var/www/mdv-site/current
```

Depois validar novamente `GET /`, `/admin/products` e `/api/status`.

7. Produção e fallback:

- enquanto a regressão completa não terminar, Vercel fica como fallback temporário;
- a VPS staging deve provar site, API, login, admin, pagamento, webhooks, SEO e sitemap antes da troca DNS;
- no corte final, Cloudflare/DNS aponta `mercadodovale.com.br` e `www.mercadodovale.com.br` para a VPS;
- se a troca final apresentar falha, reverter DNS/Cloudflare para o fallback temporário ou voltar `current` para `previous`, conforme a origem do problema.

## Checklist de Cada Bloco

Antes de considerar um bloco migrado:

- [ ] roda na VPS;
- [ ] não depende da Vercel;
- [ ] tem env documentado;
- [ ] tem log;
- [ ] tem teste/regressão;
- [ ] tem rollback;
- [ ] tem impacto conhecido;
- [ ] foi validado em staging;
- [ ] não quebrou produção atual.

Antes de commit/deploy de um bloco que altere runtime da VPS:

- [ ] revisar o diff completo dos arquivos da VPS antes de stagear, principalmente `vps_server.cjs`, `vps_server.js`, `api/vps-proxy.ts`, `infra/nginx/*.conf` e `vercel.json`;
- [ ] confirmar se o diff grande de `vps_server.cjs` e `vps_server.js` pertence ao mesmo bloco ou se precisa ser dividido em commits menores;
- [ ] rodar os testes estaticos `tmp-tests/vps-*` diretamente relacionados ao bloco alterado;
- [ ] rodar validacoes de sintaxe/build aplicaveis, como `node --check vps_server.js`, `node --check vps_server.cjs` e `npm.cmd run build` quando houver impacto no frontend/proxy;
- [ ] stagear somente os arquivos do bloco da VPS, deixando fora alteracoes paralelas, reports e testes nao relacionados;
- [ ] criar commit separado para a VPS com mensagem objetiva;
- [ ] fazer `push` para `origin/main`;
- [ ] executar o deploy operacional na VPS quando o commit alterar `vps_server.*`, Nginx, cron, PM2 ou scripts executados no servidor;
- [ ] validar pos-deploy com status HTTP, logs e/ou PM2 antes de considerar o bloco publicado;
- [ ] registrar no diario da migracao o hash do commit, comandos de validacao, resultado do deploy e pendencias restantes.

## Definição de Pronto

A migração para VPS estará pronta quando:

- o domínio principal apontar para a VPS;
- o site abrir pela VPS;
- `/api/*` rodar na VPS;
- webhooks chegarem na VPS;
- OAuth callbacks funcionarem na VPS;
- cron rodar na VPS;
- SEO e sitemap funcionarem na VPS;
- logs e rollback estiverem operacionais;
- Vercel puder ser desligada sem impacto.

## Mapa de Rotas

Esta seção deve ser alimentada ao longo da migração.

| Rota | Origem Atual | Destino Planejado | Status | Tipo | Auth | Teste/Validação | Observações |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | Vercel static | VPS Nginx `dist/` | vps-staging-validado-http | frontend | pública | `curl -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/`; `node tmp-tests/vps-staging-frontend-proxy-check-static.test.mjs`; `STAGING_FRONTEND_PROXY_LIVE=true node tmp-tests/vps-staging-frontend-proxy-check.cjs`; `node tmp-tests/vps-site-deploy-script-static.test.mjs`; `node tmp-tests/vps-nginx-staging-config-static.test.mjs`; `npm run build` | deploy executado na VPS em `/var/www/mdv-site/releases/20260520-180705`; Nginx staging instalado; raiz staging validada com HTTP 200 via host header; DNS/browser ainda pendente |
| `/admin/*` | Vercel static | VPS Nginx `dist/` | vps-staging-validado-http | frontend/admin | Supabase auth no app | `curl -I -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/admin/products`; `STAGING_FRONTEND_PROXY_LIVE=true node tmp-tests/vps-staging-frontend-proxy-check.cjs`; login + refresh direto em staging após DNS | fallback SPA `/admin/products` validado via HTTP 200; falta validação no navegador com DNS ou hosts local e sessão admin real |
| `/api/vps-proxy` | Vercel Function | VPS Fastify | vps-staging-validado-http | proxy/api | Supabase admin/customer + sync key | `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`; `node tmp-tests/vps-staging-frontend-proxy-check-static.test.mjs`; `STAGING_FRONTEND_PROXY_LIVE=true node tmp-tests/vps-staging-frontend-proxy-check.cjs`; `node --check vps_server.js`; `node --check vps_server.cjs`; `curl /api/vps-proxy?path=/status`; `curl /api/vps-proxy?path=/products?limit=1`; `curl /api/vps-proxy?path=/company-settings` sem token | rota compatível criada, deployada e validada no staging; status/produtos públicos OK e `/company-settings` sem sessão bloqueado; falta regressão com sessão admin real |
| `/api/bling` | Vercel Function | VPS Fastify | vps-staging-validado-http | api/oauth | conforme `resource` | `node tmp-tests/vps-bling-resource-parity-static.test.mjs`; `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`; `node tmp-tests/vps-bling-products-fastify-static.test.mjs`; `node tmp-tests/vps-bling-product-detail-fastify-static.test.mjs`; `node tmp-tests/vps-bling-product-update-fastify-static.test.mjs`; `node tmp-tests/vps-bling-diagnostics-fastify-static.test.mjs`; `node tmp-tests/vps-bling-admin-helpers-fastify-static.test.mjs`; `node tmp-tests/vps-bling-webhook-fastify-static.test.mjs`; `node tmp-tests/vps-bling-stock-fastify-static.test.mjs`; `node tmp-tests/vps-bling-stock-sync-guarded-check-static.test.mjs`; `node tmp-tests/vps-bling-stock-sync-guarded-check.cjs`; `node tmp-tests/vps-bling-product-update-guarded-check-static.test.mjs`; `node tmp-tests/vps-bling-product-update-guarded-check.cjs`; `node tmp-tests/vps-bling-finance-mutation-guarded-check-static.test.mjs`; `node tmp-tests/vps-bling-finance-mutation-guarded-check.cjs`; `node tmp-tests/vps-bling-sync-prices-fastify-static.test.mjs`; `node tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`; `node tmp-tests/vps-bling-finance-fastify-static.test.mjs`; `node tmp-tests/vps-bling-nf-fastify-static.test.mjs`; `curl /api/bling?resource=oauth-callback&error=access_denied`; `curl POST /api/bling?resource=exchange` sem credenciais; `curl /api/bling?resource=categories` sem Authorization; `curl /api/bling?resource=products` sem Authorization; `curl /api/bling?resource=product-detail`; `curl /api/bling?resource=product-detail&id=0`; `curl /api/bling?resource=stock` sem Authorization; `curl POST /api/bling?resource=stock-sync` sem body; `curl GET /api/bling?resource=sync-prices-vps`; `curl /api/bling?resource=reconcile&dryRun=true` sem auth; `curl /api/bling?resource=finance&resourceType=pagar&action=list` sem Authorization; `curl /api/bling?resource=nf-detail` sem tipo; `curl POST /api/bling?resource=product-update-fiscal` sem body; `curl POST /api/bling?resource=product-update-dimensions` sem body; `curl GET /api/bling?resource=webhook`; `curl GET /api/bling?resource=image-proxy`; `curl GET /api/bling?resource=debug-product`; `curl GET /api/bling?resource=debug-diagnostic`; `curl POST /api/bling?resource=fix-profile`; `curl POST /api/bling?resource=sync-model-brand`; `curl POST /api/bling?resource=fix-bling-id` | inventário de recursos do `api/bling.ts` coberto no Fastify da VPS; guards de `stock-sync`, atualização fiscal/dimensões e financeiro preparados sem execução real; validações reais controladas ainda pendentes antes do corte final |
| `/api/auth/callback/bling` | Vercel rewrite | VPS Fastify | vps-staging-validado-http | oauth | callback externo | `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`; `node tmp-tests/vps-oauth-preflight-check-static.test.mjs`; `OAUTH_PREFLIGHT_LIVE=true node tmp-tests/vps-oauth-preflight-check.cjs`; `curl /api/auth/callback/bling` sem code | callback preservado na VPS; preflight OAuth sanitizado validado; falta reconexão real com código OAuth válido do Bling |
| `/api/bling-webhook` | Vercel Function | VPS Fastify | vps-staging-validado-http | webhook | segredo/validação quando disponível | `node tmp-tests/vps-bling-webhook-fastify-static.test.mjs`; `node tmp-tests/vps-bling-webhook-simulation-static.test.mjs`; `node --check tmp-tests/vps-bling-webhook-simulation.cjs`; `node tmp-tests/vps-bling-webhook-simulation.cjs`; `curl GET /api/bling-webhook`; `curl GET /api/bling?resource=webhook` | handler Fastify deployado; guard de payload Bling preparado e validado sem envio; POST real/simulado fica para janela controlada por gravar logs/estoque/preço |
| `/api/mercadopago-webhook` | Vercel rewrite | VPS Fastify | vps-staging-validado-http | webhook | validação Mercado Pago | `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`; `node tmp-tests/vps-mercadopago-webhook-simulation-static.test.mjs`; `node --check tmp-tests/vps-mercadopago-webhook-simulation.cjs`; `node tmp-tests/vps-mercadopago-webhook-simulation.cjs`; `node --check vps_server.js`; `node --check vps_server.cjs`; `curl --resolve ... GET /api/mercadopago-webhook`; `curl --resolve ... POST payload não-MP`; `curl --resolve ... POST payment id=0` | rota Fastify deployada no staging; guard de payload Mercado Pago preparado e validado sem envio; confirma pagamento real no Mercado Pago antes de atualizar pedido; debug copiável validado sem segredos |
| `/api/shopee` | Vercel Function | VPS Fastify | vps-staging-validado-http | oauth/api | Shopee assinatura | `node tmp-tests/vps-shopee-oauth-fastify-static.test.mjs`; `node tmp-tests/vps-oauth-preflight-check-static.test.mjs`; `OAUTH_PREFLIGHT_LIVE=true node tmp-tests/vps-oauth-preflight-check.cjs`; `curl /api/shopee?action=callback` sem parâmetros; `curl /api/shopee` sem action | OAuth `auth`/`callback` migrado; preflight sanitizado validou URL Shopee; falta reconexão real com código Shopee válido antes de atualizar callback definitivo |
| `/api/shopee-catalog` | Vercel Function | VPS Fastify | vps-staging-validado-http | api | admin | `node tmp-tests/vps-shopee-catalog-read-fastify-static.test.mjs`; `node tmp-tests/vps-shopee-catalog-mutations-fastify-static.test.mjs`; `node tmp-tests/vps-shopee-catalog-media-full-fastify-static.test.mjs`; `node tmp-tests/vps-shopee-add-item-media-guarded-check-static.test.mjs`; `node tmp-tests/vps-shopee-add-item-media-guarded-check.cjs`; `curl /api/shopee-catalog?action=attributes`; `curl /api/shopee-catalog?action=search_attribute_values`; `curl /api/shopee-catalog?action=get_item_base_info`; `curl GET /api/shopee-catalog?action=update_stock`; `curl GET /api/shopee-catalog?action=upload_image`; `curl GET /api/shopee-catalog?action=upload_video` | ações de leitura, mutações diretas, upload de imagem/vídeo e `get_full_catalog` migrados; guard de upload de mídia preparado sem execução real; falta validação real controlada antes do corte final |
| `/api/shopee-actions` | Vercel Function | VPS Fastify | vps-staging-validado-http | api | admin | `node tmp-tests/vps-shopee-actions-read-fastify-static.test.mjs`; `node tmp-tests/vps-shopee-actions-refresh-fastify-static.test.mjs`; `node tmp-tests/vps-shopee-actions-mutations-fastify-static.test.mjs`; `node tmp-tests/vps-shopee-actions-add-item-fastify-static.test.mjs`; `node tmp-tests/vps-shopee-mutation-guarded-check-static.test.mjs`; `node tmp-tests/vps-shopee-mutation-guarded-check.cjs`; `node tmp-tests/vps-shopee-ship-order-guarded-check-static.test.mjs`; `node tmp-tests/vps-shopee-ship-order-guarded-check.cjs`; `node tmp-tests/vps-shopee-add-item-media-guarded-check-static.test.mjs`; `node tmp-tests/vps-shopee-add-item-media-guarded-check.cjs`; `curl /api/shopee-actions`; `curl /api/shopee-actions?action=get_order_detail`; `curl /api/shopee-actions?action=get_tracking_info`; `curl GET /api/shopee-actions?action=update_stock&product_id=test&stock=1`; `curl GET /api/shopee-actions?action=ship_order&order_sn=TEST`; `curl GET /api/shopee-actions?action=add_item&product_id=test` | ações de leitura, `refresh_token`, `ship_order`, `update_stock`, `update_price` e `add_item` migrados; guards de escrita preparados sem execução real; falta validação real controlada antes do corte final |
| `/api/shopee-webhook` | Vercel Function | VPS Fastify | vps-staging-validado-http | webhook | assinatura Shopee | `node tmp-tests/vps-shopee-webhook-fastify-static.test.mjs`; `node tmp-tests/vps-shopee-webhook-order-simulation-static.test.mjs`; `node --check tmp-tests/vps-shopee-webhook-order-simulation.cjs`; `node tmp-tests/vps-shopee-webhook-order-simulation.cjs`; `curl GET /api/shopee-webhook`; `curl POST /api/shopee-webhook {}` | handler deployado; POST vazio retorna sucesso sem acionar n8n; guard de payload `code=3` preparado e validado sem envio; falta payload real/simulado de pedido em janela controlada |
| `/api/shipping` | Vercel Function | VPS Fastify | vps-staging-validado-http | api | admin/public conforme uso | `node tmp-tests/vps-shipping-fastify-static.test.mjs`; `node tmp-tests/vps-shipping-quote-guarded-simulation-static.test.mjs`; `node --check tmp-tests/vps-shipping-quote-guarded-simulation.cjs`; `node tmp-tests/vps-shipping-quote-guarded-simulation.cjs`; `node tmp-tests/vps-melhor-envio-label-guarded-simulation-static.test.mjs`; `node --check tmp-tests/vps-melhor-envio-label-guarded-simulation.cjs`; `node tmp-tests/vps-melhor-envio-label-guarded-simulation.cjs`; `node --check vps_server.js`; `node --check vps_server.cjs`; `curl POST /api/shipping?provider=frenet&action=calculate`; `curl POST /api/shipping?provider=melhor-envio&action=calculate` sem token | rota compatível deployada no staging para Frenet e Melhor Envio; guards de cotacao e etiqueta preparados e validados sem envio; validação real com token/pedido fica para regressão controlada |
| `/api/telegram-webhook` | Vercel Function | VPS Fastify | vps-staging-validado-http | webhook | `TELEGRAM_WEBHOOK_SECRET` configurado na VPS | `node tmp-tests/vps-telegram-webhook-fastify-static.test.mjs`; `node tmp-tests/vps-telegram-set-webhook-static.test.mjs`; `node tmp-tests/vps-telegram-webhook-ping-static.test.mjs`; `node tmp-tests/vps-telegram-webhook-command-static.test.mjs`; `curl GET /api/telegram-webhook`; `curl POST {}`; `curl POST payload /ping sem segredo`; `node tmp-tests/vps-telegram-set-webhook.cjs`; `node tmp-tests/vps-telegram-webhook-ping.cjs`; `node tmp-tests/vps-telegram-webhook-command.cjs /vendas`; `node tmp-tests/vps-telegram-webhook-command.cjs /estoque`; `node tmp-tests/vps-telegram-webhook-command.cjs /relatorio`; `node tmp-tests/vps-telegram-webhook-command.cjs /top10`; `node tmp-tests/vps-telegram-webhook-command.cjs /pedidos`; `node tmp-tests/vps-telegram-webhook-command.cjs /clientes`; `node tmp-tests/vps-telegram-webhook-command.cjs "/modelo iphone"`; `node tmp-tests/vps-telegram-webhook-command.cjs "/categoria celulares"` | handler Fastify publicado; comandos migrados; webhook real do Telegram aponta para `api.xiaomipetrolina.com.br`; comandos principais reais controlados validados via chat configurado |
| `/api/cron-dispatcher` | Vercel Cron/Function | VPS cron + Fastify/script | vps-staging-validado-http | cron | `CRON_SECRET` configurado na VPS | `node tmp-tests/vps-cron-dispatcher-fastify-static.test.mjs`; `node tmp-tests/vps-migration-secrets-set-static.test.mjs`; `node tmp-tests/vps-cron-dispatcher-install-static.test.mjs`; `curl /api/cron-dispatcher` sem segredo; `crontab -l` | handler Fastify publicado; chamada pública sem segredo retorna `401`; cron instalado na VPS em `0 22 * * *`; entradas antigas para `www.mercadodovale.com.br/api/cron-dispatcher` removidas |
| `/sitemap.xml` | Vercel rewrite/function | VPS Fastify via Nginx | vps-producao-validado-http | sitemap/seo | pública | `node tmp-tests/vps-sitemap-fastify-static.test.mjs`; `node tmp-tests/vps-seo-special-slugs-check-static.test.mjs`; `SEO_SPECIAL_SLUGS_LIVE=true node tmp-tests/vps-seo-special-slugs-check.cjs`; `node tmp-tests/vps-seo-production-host-check-static.test.mjs`; `SEO_PRODUCTION_HOST_LIVE=true node tmp-tests/vps-seo-production-host-check.cjs`; `SEO_PRODUCTION_HOST_LIVE=true SEO_PRODUCTION_HOST=www.mercadodovale.com.br node tmp-tests/vps-seo-production-host-check.cjs`; `node tmp-tests/vps-nginx-production-config-static.test.mjs`; `node tmp-tests/vps-nginx-production-config-install-static.test.mjs`; `node --check vps_server.js`; `node --check vps_server.cjs`; `curl /api/sitemap`; `curl /sitemap.xml` | Nginx produção instalado na VPS; raiz `mercadodovale.com.br` redireciona `301` para `https://www.mercadodovale.com.br`; `www` serve sitemap `200` com `2136` URLs e `2133` produtos |
| `/produto/:slug` | Vercel rewrite/function | VPS Fastify via Nginx | vps-producao-validado-http | seo | pública | `node tmp-tests/vps-seo-produto-fastify-static.test.mjs`; `node tmp-tests/vps-seo-special-slugs-check-static.test.mjs`; `SEO_SPECIAL_SLUGS_LIVE=true node tmp-tests/vps-seo-special-slugs-check.cjs`; `SEO_SPECIAL_SLUGS_LIVE=true SEO_SPECIAL_SLUGS_HOST=www.mercadodovale.com.br SEO_SPECIAL_SLUGS_SITEMAP_URL=http://76.13.232.162/sitemap.xml node tmp-tests/vps-seo-special-slugs-check.cjs`; `node tmp-tests/vps-seo-production-host-check-static.test.mjs`; `SEO_PRODUCTION_HOST_LIVE=true node tmp-tests/vps-seo-production-host-check.cjs`; `SEO_PRODUCTION_HOST_LIVE=true SEO_PRODUCTION_HOST=www.mercadodovale.com.br node tmp-tests/vps-seo-production-host-check.cjs`; `node --check vps_server.js`; `node --check vps_server.cjs`; `curl /api/seo-produto?slug=abracadeira-nylon-enforca-gato-300x36mm-bom-5495`; `curl /produto/abracadeira-nylon-enforca-gato-300x36mm-bom-5495` | rota Fastify deployada e validada no staging e no host `www` da config produção; slugs especiais retornam `200`, canonical `www.mercadodovale.com.br`, `og:type=product` e `2` JSON-LD |
| `/api/brasilapi-ncm` | Vercel rewrite/proxy | VPS Fastify | vps-staging-validado-http | api/proxy | pública | `curl /api/brasilapi-ncm?search=8517`; `node tmp-tests/vps-proxy-fastify-route-static.test.mjs` | rota direta criada no Fastify, deployada e validada com cache |

Nota atualizada do mapa Shopee em 2026-05-21: `/api/shopee-catalog` teve leitura real de loja, categorias, logística, itens e modelos validada por `tmp-tests/vps-shopee-live-read-check.cjs`; `/api/shopee-actions` teve leitura real de pedidos, rastreio e pagamento validada por `tmp-tests/vps-shopee-order-live-read-check.cjs`. Mutações reais (`update_stock`, `update_price`, `ship_order`) permanecem bloqueadas por guard scripts até existir produto/pedido explicitamente controlado para teste.

### Checklist ativo antes do corte final

Este é o checklist operacional atual. Entradas antigas no histórico abaixo continuam como trilha de auditoria, mas os itens marcados como leitura real Bling/Shopee já foram cobertos pelos validadores sanitizados.

Concluído em leitura real pela VPS:

- Bling: categorias, produtos, detalhe de produto, NFe/NFCe, detalhe de NFe, financeiro receber/pagar e estoque filtrado por produto descoberto.
- Shopee: loja, categorias, logística, lista de itens, detalhe de item, modelos, pedidos, detalhe de pedido, rastreio e pagamento/escrow.
- Telegram: webhook real apontando para `api.xiaomipetrolina.com.br` e comandos principais validados no chat configurado.
- Cron dispatcher: rota protegida por segredo, cron instalado na VPS para `0 22 * * *` e primeira execução real observada com sucesso no log.
- SEO: comparação pública de sitemap feita; produção atual redireciona para `www.mercadodovale.com.br` com 3 URLs, VPS staging retorna milhares de URLs de produtos; 8 slugs especiais do sitemap staging revalidados com canonical, OG product e JSON-LD.
- Bling reconcile: apply real controlado executado para o plano revisado de `7` estoques e `57` nomes. A conferência pós-apply revelou que o dry-run ainda lia Supabase antigo; o reconciliador foi corrigido para montar o plano a partir do MySQL da VPS. Após deploy da correção, novo dry-run real retornou `8` mudanças de estoque e `20` mudanças de nome, com detalhes salvos em `tmp-tests/vps-bling-reconcile-dry-run-details-output.json`.
- Bling diagnostics: `debug-product` e `debug-diagnostic` validados com `blingId` real pela VPS, com saída sanitizada.
- Bling image proxy: `image-proxy` validado com imagem real de produto Bling pela VPS, com saída sanitizada.
- Bling sync-prices-vps: `dryRun=true` real validado na VPS nas páginas `0`, `1` e `48`; aplicação real controlada da página `0` sincronizou `50` itens em `/products/batch` com HTTP `200`.
- Staging frontend/proxy: revalidado live pela VPS com host `staging.mercadodovale.com.br`; raiz e `/admin/products` retornam HTML `200`, `/api/vps-proxy?path=/status` e leitura pública de produtos retornam JSON `200`, e `/company-settings` sem sessão continua bloqueado com `403`.
- OAuth preflight: revalidado live pela VPS; callback Bling sem code redireciona para `/admin/settings/bling`, exchange Bling sem credenciais retorna `400`, callback Shopee sem parâmetros retorna `400` e geração de URL Shopee retorna host oficial com redirect para `www.mercadodovale.com.br`.

Pendente para corte final:

- Regressão segura: antes de qualquer execução controlada, rodar `node tmp-tests/vps-migration-guard-regression.cjs` para confirmar que os guards continuam em modo não-mutante por padrão.
- Bling escrita: `stock-sync`, atualização fiscal/dimensões e mutações financeiras guardados e prontos para caso controlado; `sync-prices-vps` e próxima aplicação do `reconcile` somente após revisar os `8` estoques e `20` nomes restantes do plano atual.
- Shopee escrita: `update_stock`, `update_price`, `add_item`, upload de mídia e `ship_order` guardados; execução real somente com produto/pedido/mídia explicitamente controlados.
- Webhooks: validar payload Bling, Shopee e Mercado Pago em janela controlada antes de trocar callbacks definitivos.
- OAuth: reconectar Bling e Shopee com código real válido pela VPS.
- Staging/frontend: validar DNS/hosts de staging, navegador, login/admin real e `/api/vps-proxy` com sessão.
- Shipping: cotação Frenet/Melhor Envio e etiqueta Melhor Envio com pedido de teste.
- SEO: config Nginx de produção instalada na VPS; `mercadodovale.com.br` redireciona para `https://www.mercadodovale.com.br`, `www` serve `/sitemap.xml` com `2136` URLs e produtos SEO `200`; falta validar DNS final/browser depois do corte.
- Operação: cron da Vercel removido do `vercel.json`; callbacks restantes da Vercel ficam para depois da regressão final.

## Registro de Mudanças

### 2026-05-22 - Preparacao de testes controlados Shopee/shipping/webhooks

Mudanca: executadas validacoes seguras para preparar os proximos testes controlados de escrita, sem alterar estoque, preco, pedidos, etiquetas ou webhooks reais.

Objetivo: avancar o checklist enquanto o DNS de staging ainda nao esta disponivel publicamente, separando o que ja pode ser validado em modo seguro do que exige escolha explicita de produto/pedido/midia de teste.

Arquivos/infra alterados:

- `migração_VPS.md`

Validacao:

- tentativa de adicionar `76.13.232.162 staging.mercadodovale.com.br` no `hosts` local: negada pelo Windows com `Access denied`; nenhuma entrada foi aplicada.
- `node tmp-tests/vps-shopee-test-candidate-discovery-static.test.mjs`: `ok`.
- `node tmp-tests/vps-shopee-test-candidate-discovery.cjs`: `ok=true`, `candidate_count=50`, `test_like_count=0`; candidatos sanitizados indicam produtos vinculados e ativos, mas nenhum claramente marcado como teste.
- `node tmp-tests/vps-shopee-full-catalog-guarded-check.cjs`: dry-run padrao `ok=true`, `full_catalog_executed=false`, `reason=dry_run_enabled`.
- `DRY_RUN=false CONFIRM_SHOPEE_FULL_CATALOG_READ=I_UNDERSTAND_SHOPEE_FULL_CATALOG_READ SHOPEE_FULL_CATALOG_MAX_PAGES=1 SHOPEE_FULL_CATALOG_MAX_ITEMS=5 SHOPEE_FULL_CATALOG_PAGE_SIZE=5 node tmp-tests/vps-shopee-full-catalog-guarded-check.cjs`: `ok=true`, leitura real pequena executada, `status=200`, `item_count=5`, sem mutacao.
- `node tmp-tests/vps-shipping-quote-guarded-simulation.cjs`: `ok=true`, `quote_sent=false`, `mutation_executed=false`, `reason=missing_SHIPPING_TEST_PROVIDER`.
- `node tmp-tests/vps-melhor-envio-label-guarded-simulation.cjs`: `ok=true`, `label_requested=false`, `mutation_executed=false`, `reason=missing_MELHOR_ENVIO_TEST_CARRIER_ID`.
- `node tmp-tests/vps-mercadopago-webhook-simulation.cjs`: `ok=true`, `webhook_sent=false`, `reason=missing_MERCADOPAGO_TEST_PAYMENT_ID`.
- `node tmp-tests/vps-bling-webhook-simulation.cjs`: `ok=true`, `webhook_sent=false`, `reason=missing_BLING_TEST_WEBHOOK_EVENT`.
- `node tmp-tests/vps-shopee-webhook-order-simulation.cjs`: `ok=true`, `webhook_sent=false`, `reason=missing_SHOPEE_TEST_WEBHOOK_ORDER_SN`.

Resultado: leitura real pequena do catalogo completo Shopee passou pela VPS; os guards de shipping, etiqueta e webhooks continuam sem executar nada por padrao. Ainda nao existe candidato Shopee claramente marcado como teste, entao mutacoes reais seguem bloqueadas ate escolher/criar um item controlado.

Pendencias:

- escolher ou criar produto Shopee de teste para `update_stock`, `update_price`, `add_item` e upload de midia;
- escolher pedido Shopee controlado para `ship_order` e simulacao de webhook;
- escolher pagamento Mercado Pago de teste para simulacao real controlada;
- escolher evento Bling controlado para validar webhook com efeito esperado;
- obter permissao/admin local ou configurar DNS publico para validar `staging.mercadodovale.com.br` no navegador real.

Rollback: nenhuma mudanca de runtime foi feita nesta etapa.

### 2026-05-22 - Checagem DNS para proximo passo de navegador/login

Mudanca: conferido o estado publico dos dominios antes de tentar a validacao real de navegador, login/admin e corte final.

Objetivo: identificar se o bloqueio atual esta em codigo/VPS ou em DNS antes de avancar para testes autenticados.

Arquivos/infra alterados:

- `migração_VPS.md`

Validacao:

- `Resolve-DnsName mercadodovale.com.br`: resolve para `76.76.21.21`, IP da Vercel.
- `Resolve-DnsName www.mercadodovale.com.br`: resolve como `CNAME cname.vercel-dns.com`, com IPs Vercel.
- `Resolve-DnsName staging.mercadodovale.com.br`: sem resposta publica.
- `curl -I https://www.mercadodovale.com.br/sitemap.xml`: `405 Method Not Allowed` pela Vercel em `HEAD`.
- `curl GET https://www.mercadodovale.com.br/sitemap.xml`: `200`, `text/xml`, `644` bytes, indicando sitemap publico atual pequeno na Vercel.
- `curl GET -H "Host: www.mercadodovale.com.br" http://76.13.232.162/sitemap.xml`: `200`, `application/xml`, `511078` bytes, confirmando sitemap completo servido pela VPS com host de producao.
- `curl GET -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/admin/products`: `200`, `text/html`, confirmando fallback SPA staging direto na VPS.

Resultado: o proximo bloqueio nao e codigo da VPS; e DNS/hosts para validar navegador real e sessao admin. O site publico principal ainda depende da Vercel, enquanto a VPS ja responde corretamente quando recebe o `Host` esperado.

Pendencias:

- criar/apontar `staging.mercadodovale.com.br` para `76.13.232.162` ou validar via arquivo `hosts`;
- apos DNS/hosts, abrir staging no navegador real e validar login/admin com sessao;
- depois da regressao autenticada, preparar corte de `mercadodovale.com.br` e `www.mercadodovale.com.br` para a VPS.

Rollback: nenhuma mudanca de runtime foi feita nesta etapa.

### 2026-05-22 - Revalidacao live read-only Bling/Shopee, cron e guards

Mudanca: executada nova rodada do checklist ativo com validacoes read-only pela VPS, conferindo integracoes externas sem mutacao real.

Objetivo: avancar os proximos passos antes do corte final, confirmando que as rotas migradas continuam respondendo e que os guards de escrita permanecem bloqueando execucoes acidentais.

Arquivos/infra alterados:

- `migração_VPS.md`

Rotas afetadas:

- `/api/bling`
- `/api/shopee-actions`
- `/api/shopee-catalog`
- `/api/cron-dispatcher`
- `/sitemap.xml`
- `/produto/:slug`

Validacao:

- `Resolve-DnsName staging.mercadodovale.com.br`: sem resposta publica no momento da checagem.
- `curl https://staging.mercadodovale.com.br/` e `curl http://staging.mercadodovale.com.br/`: sem resposta publica por ausencia de DNS/host acessivel.
- `node tmp-tests/vps-migration-guard-regression.cjs`: `ok=true`, `checked=28`, `failed=0`, `mutation_executed=false`.
- `node tmp-tests/vps-shopee-live-read-check.cjs`: `ok=true`, loja/categorias/logistica/lista de itens/detalhe/modelos `200`; `catalog_categories` retornou `2038` categorias e lista de itens retornou `5` itens.
- `node tmp-tests/vps-shopee-order-live-read-check.cjs`: `ok=true`, pedidos/detalhe/rastreio/escrow `200`, com pedido descoberto automaticamente.
- `node tmp-tests/vps-cron-dispatcher-log-check.cjs`: `ok=true`, crontab com entrada ativa, log existente e ultima execucao real `Cron ran successfully. Dispatched 1 templates.`
- `node tmp-tests/vps-bling-live-read-check.cjs`: `ok=true`, categorias `71`, produtos `100`, NFe `100`, NFCe `34`.
- `node tmp-tests/vps-bling-stock-live-read-check.cjs`: `ok=true`, produto descoberto e estoque filtrado `200`.
- `node tmp-tests/vps-bling-finance-live-read-check.cjs`: `ok=true`, receber lista/detalhe e pagar lista/detalhe `200`.
- `SEO_SPECIAL_SLUGS_LIVE=true node tmp-tests/vps-seo-special-slugs-check.cjs`: `ok=true`, sitemap `200`, `2133` URLs de produto e `8` slugs inspecionados com canonical, OG product e JSON-LD.
- `node tmp-tests/vps-bling-detail-live-read-check.cjs`: primeira tentativa retornou `429` no detalhe de produto Bling e `200` no detalhe de NFe; apos aguardar a janela de rate limit e repetir somente o teste, retornou `ok=true` com detalhe de produto e NFe `200`.
- `node tmp-tests/vps-bling-diagnostics-live-read-check.cjs`: `ok=true`, `debug-product` e `debug-diagnostic` responderam com saida sanitizada.
- `node tmp-tests/vps-bling-image-proxy-live-check.cjs`: `ok=true`, imagem real retornou `200`, `image/png`.
- `node tmp-tests/vps-bling-sync-prices-dry-run-check.cjs`: `ok=true`, `dryRun=true`, `wouldSync=50`, `total=2443`, sem executar `/products/batch`.

Resultado: as leituras reais Bling/Shopee e SEO continuam funcionando pela VPS; o cron esta instalado e com log real de sucesso; as mutacoes seguem bloqueadas por padrao. O unico incidente foi `429` temporario do Bling no detalhe de produto, resolvido com retry apos pausa, indicando limite externo e nao regressao da rota.

Pendencias:

- apontar/validar DNS publico de `staging.mercadodovale.com.br` ou usar `hosts` local definitivo para validar navegador sem proxy;
- validar login/admin real com sessao autenticada e `/api/vps-proxy` protegido;
- executar somente em janela controlada as mutacoes guardadas de Bling, Shopee, webhooks e shipping;
- validar DNS final/browser apos apontamento publico.

Rollback: nenhuma mudanca de runtime foi feita nesta etapa; se alguma regressao aparecer, usar os backups de runtime/Nginx registrados nas entradas anteriores.

### 2026-05-22 - Instalação e validação do Nginx de produção na VPS

Mudanca: instalada a config `infra/nginx/mdv-site-production.conf` na VPS e ajustado o validador SEO para tratar `mercadodovale.com.br` como host raiz que redireciona para o canonical `www`.

Objetivo: remover o bloqueador de `404` em `/sitemap.xml` no host de producao antes do corte de DNS, preservando a regra de canonical em `www.mercadodovale.com.br`.

Arquivos/infra alterados:

- `infra/nginx/mdv-site-production.conf`
- `tmp-tests/vps-seo-production-host-check.cjs`
- `tmp-tests/vps-seo-production-host-check-static.test.mjs`
- `migração_VPS.md`
- `/etc/nginx/sites-available/mdv-site-production.conf`
- `/etc/nginx/sites-enabled/mdv-site-production.conf`

Validacao:

- `node tmp-tests/vps-migration-guard-regression-static.test.mjs`
- `node tmp-tests/vps-migration-guard-regression.cjs`: `ok=true`, `checked=28`, `failed=0`, `mutation_executed=false`.
- `node tmp-tests/vps-seo-production-host-check-static.test.mjs`: falhou antes do ajuste por falta de `redirect_ok`; passou depois.
- `node tmp-tests/vps-nginx-production-config-static.test.mjs`
- `node tmp-tests/vps-nginx-production-config-install-static.test.mjs`
- `node tmp-tests/vps-nginx-production-config-install.cjs`: dry-run com `reason=dry_run_enabled`.
- `DRY_RUN=false CONFIRM_NGINX_PRODUCTION_INSTALL=I_UNDERSTAND_NGINX_PRODUCTION_INSTALL node tmp-tests/vps-nginx-production-config-install.cjs`: `installed=true`, backup remoto criado, `nginx -t` e reload executados.
- `curl -I -H "Host: mercadodovale.com.br" http://76.13.232.162/sitemap.xml`: `301`, `Location: https://www.mercadodovale.com.br/sitemap.xml`.
- `curl -I -H "Host: www.mercadodovale.com.br" http://76.13.232.162/sitemap.xml`: `200`, `Content-Type: application/xml; charset=utf-8`.
- `SEO_PRODUCTION_HOST_LIVE=true node tmp-tests/vps-seo-production-host-check.cjs`: `ok=true`, redirect raiz `301`, sitemap `200`, `2136` URLs, `2133` URLs de produto, 3 produtos `200` com canonical/OG/JSON-LD.
- `SEO_PRODUCTION_HOST_LIVE=true SEO_PRODUCTION_HOST=www.mercadodovale.com.br node tmp-tests/vps-seo-production-host-check.cjs`: `ok=true`.
- `SEO_SPECIAL_SLUGS_LIVE=true SEO_SPECIAL_SLUGS_LIMIT=5 SEO_SPECIAL_SLUGS_HOST=www.mercadodovale.com.br SEO_SPECIAL_SLUGS_SITEMAP_URL=http://76.13.232.162/sitemap.xml node tmp-tests/vps-seo-special-slugs-check.cjs`: `ok=true`, 5 slugs especiais com `200`, canonical `www.mercadodovale.com.br`, `og:type=product`, `2` JSON-LD e sem canonical da home.

Resultado: o host de producao no IP da VPS deixou de retornar `404`; a config Nginx de producao serve sitemap/produtos no `www` e redireciona o dominio raiz para o canonical.

Pendencias:

- validar DNS final/browser apos apontamento publico;
- manter rollback via backup remoto do arquivo em `/etc/nginx/sites-available/mdv-site-production.conf.backup.*` se houver regressao;
- seguir com validacao de navegador/login/admin real e execucoes controladas restantes.

Rollback: restaurar backup remoto da config anterior em `/etc/nginx/sites-available/mdv-site-production.conf.backup.*`, rodar `nginx -t` e recarregar Nginx.

### 2026-05-22 - Validacao browser do staging e ajuste /vps-proxy

Mudanca: corrigido o caminho legado `/vps-proxy` no Nginx staging/producao para encaminhar ao Fastify, liberado tracking publico de banners no guard do `/api/vps-proxy` sem abrir rotas protegidas, e adicionada a origem `https://staging.mercadodovale.com.br` no CORS da VPS.

Objetivo: validar a vitrine no navegador contra a VPS antes do DNS publico, mantendo protecoes de admin e testes sem mutacao real para writes sensiveis.

Arquivos alterados:

- `infra/nginx/mdv-site-staging.conf`
- `infra/nginx/mdv-site-production.conf`
- `vps_server.js`
- `vps_server.cjs`
- `api/vps-proxy.ts`
- `tmp-tests/vps-nginx-staging-config-static.test.mjs`
- `tmp-tests/vps-nginx-production-config-static.test.mjs`
- `tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `tmp-tests/vps-cors-origins-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-nginx-staging-config-static.test.mjs`: ok.
- `node tmp-tests/vps-nginx-production-config-static.test.mjs`: ok.
- `node tmp-tests/vps-nginx-production-config-install-static.test.mjs`: ok.
- instalacao Nginx staging/producao na VPS com `nginx -t` e reload: ok, backups remotos criados.
- `node tmp-tests/vps-cors-origins-static.test.mjs`: ok.
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`: ok.
- `npx tsx tmp-tests/vps-proxy-target.test.ts`: ok.
- `node --check vps_server.js`: ok.
- `node --check vps_server.cjs`: ok.
- deploy do `vps_server.js` para `/var/www/mdv-api/server.js` e `/var/www/mdv-api/vps_server.js` com backup e `pm2 restart mdv-api`: ok, ultimo backup `20260522142638`.
- `curl POST /vps-proxy?path=/banners/00000000-0000-4000-8000-000000000000/view` com `Origin: https://staging.mercadodovale.com.br`: `200`, `{"ok":true}`, sem alterar banner real.
- `curl POST /vps-proxy?path=/banners/00000000-0000-4000-8000-000000000000/view` com `Origin: https://www.mercadodovale.com.br`: `200`, `{"ok":true}`.
- `curl /vps-proxy?path=/company-settings` sem sessao: `403`, `{"error":"Admin required"}`.
- `STAGING_FRONTEND_PROXY_LIVE=true node tmp-tests/vps-staging-frontend-proxy-check.cjs`: `ok=true`; `/`, `/admin/products`, status e produtos `200`; `/company-settings` sem sessao `403`.
- browser via proxy local simulando Origin real de staging: vitrine renderizou produtos, tracking de banner `200`, console sem erros de rede/JSON; screenshot `reports/vps-staging-browser-origin-proxy-home.png`.
- `node tmp-tests/vps-migration-guard-regression.cjs`: `ok=true`, `checked=28`, `failed=0`, `mutation_executed=false`.
- `npm run build`: primeira execucao bloqueada pelo sandbox ao ler `vite.config.ts`; repetida fora do sandbox e concluida com sucesso.

Resultado: a vitrine staging na VPS foi validada em navegador com o mesmo perfil de Origin esperado para o dominio real; o fallback SPA e os dados publicos passam pelo Nginx/Fastify sem HTML sendo interpretado como JSON; tracking publico de banner funciona sem credencial e rotas protegidas continuam bloqueadas.

Pendencias:

- apontar/validar DNS publico de `staging.mercadodovale.com.br` ou usar hosts local definitivo;
- validar login/admin real com sessao autenticada;
- manter observacao sobre chamadas diretas restantes ao Supabase, que ainda existem em partes da vitrine, mas nao bloquearam a renderizacao no teste atual.

Rollback: restaurar backups remotos do Nginx em `/etc/nginx/sites-available/*.backup.*` e do servidor em `/var/www/mdv-api/.codex-backups/*20260522142638.bak`, depois rodar `nginx -t`, recarregar Nginx e `pm2 restart mdv-api --update-env`.

### 2026-05-22 - Revalidacao local do checklist frontend VPS

Mudanca: reexecutadas as validacoes locais do bloco de deploy estatico do frontend VPS e alinhado o plano `2026-05-20-vps-staging-frontend.md` com os passos ja concluidos.

Objetivo: manter o checklist testado antes de avancar para etapas com credencial/VPS real, sem trocar DNS nem redeployar producao.

Arquivos alterados:

- `docs/superpowers/plans/2026-05-20-vps-staging-frontend.md`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-site-deploy-script-static.test.mjs`: ok.
- `node tmp-tests/vps-migration-guard-regression-static.test.mjs`: ok.
- `node tmp-tests/vps-migration-guard-regression.cjs`: `ok=true`, `checked=28`, `failed=0`, `mutation_executed=false`.
- `npm run build`: primeira execucao bloqueada pelo sandbox ao ler `vite.config.ts`; repetida fora do sandbox e concluida com sucesso.

Resultado: o bloco de frontend VPS segue valido localmente e os guards continuam impedindo mutacoes por padrao.

Pendencias:

- instalar/ativar Nginx de producao na VPS para `mercadodovale.com.br` e `www.mercadodovale.com.br`;
- repetir validacao SEO do host de producao no IP da VPS;
- validar navegador/login/admin real no staging quando DNS/hosts estiver disponivel.

Rollback: nenhum; validacao e registro documental apenas.

### 2026-05-22 - Revalidacao SEO de slugs especiais no staging

Mudanca: reexecutada a validacao read-only de slugs especiais do sitemap staging antes de avançar no checklist.

Objetivo: confirmar novamente que a rota SEO de produto na VPS segue gerando HTML valido para slugs longos/especiais enquanto o host de producao ainda depende da instalacao Nginx.

Arquivos alterados:

- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-migration-guard-regression-static.test.mjs`
- `node tmp-tests/vps-migration-guard-regression.cjs`: `checked=28`, `failed=0`, `mutation_executed=false`.
- `node tmp-tests/vps-seo-special-slugs-check-static.test.mjs`
- `node --check tmp-tests/vps-seo-special-slugs-check.cjs`
- `node tmp-tests/vps-seo-special-slugs-check.cjs`: `live_read=false`, `reason=missing_SEO_SPECIAL_SLUGS_LIVE_true`.
- `SEO_SPECIAL_SLUGS_LIVE=true SEO_SPECIAL_SLUGS_LIMIT=8 node tmp-tests/vps-seo-special-slugs-check.cjs`: `ok=true`, sitemap staging `200`, `2133` URLs de produto, `8` slugs inspecionados, todos com HTTP `200`, canonical para `staging.mercadodovale.com.br`, `og:type=product`, `2` JSON-LD e sem canonical da home.

Resultado: SEO de produto no staging segue consistente para slugs especiais. O bloqueador restante de SEO continua restrito ao host de producao/Nginx.

Pendencias:

- instalar config Nginx de producao;
- repetir validacao do host `www.mercadodovale.com.br` no IP da VPS;
- depois disso, validar DNS final.

Rollback: nenhum; registro documental apenas.

### 2026-05-22 - Revalidacao live OAuth e SEO producao

Mudanca: reexecutados preflight OAuth live e leitura SEO do host de producao no IP da VPS, sem trocar codigo OAuth nem instalar Nginx.

Objetivo: manter o checklist testado antes das etapas que exigem acao externa real, separando rotas OAuth funcionais do bloqueador atual de Nginx producao.

Arquivos alterados:

- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-oauth-preflight-check-static.test.mjs`
- `node --check tmp-tests/vps-oauth-preflight-check.cjs`
- `node tmp-tests/vps-oauth-preflight-check.cjs`: `live_read=false`, `reason=missing_OAUTH_PREFLIGHT_LIVE_true`.
- `OAUTH_PREFLIGHT_LIVE=true node tmp-tests/vps-oauth-preflight-check.cjs`: `ok=true`, Bling callback sem code `302`, Bling exchange sem credenciais `400`, Shopee callback sem parametros `400`, Shopee auth `200` com `auth_host=partner.shopeemobile.com` e `redirect_host=www.mercadodovale.com.br`.
- `node tmp-tests/vps-seo-production-host-check-static.test.mjs`
- `node --check tmp-tests/vps-seo-production-host-check.cjs`
- `node tmp-tests/vps-seo-production-host-check.cjs`: `live_read=false`, `reason=missing_SEO_PRODUCTION_HOST_LIVE_true`.
- `SEO_PRODUCTION_HOST_LIVE=true node tmp-tests/vps-seo-production-host-check.cjs`: `ok=false`, `/sitemap.xml` `404` para `mercadodovale.com.br`.
- `SEO_PRODUCTION_HOST_LIVE=true SEO_PRODUCTION_HOST=www.mercadodovale.com.br node tmp-tests/vps-seo-production-host-check.cjs`: `ok=false`, `/sitemap.xml` `404` para `www.mercadodovale.com.br`.
- `node tmp-tests/vps-nginx-production-config-static.test.mjs`
- `node tmp-tests/vps-nginx-production-config-install-static.test.mjs`
- `node tmp-tests/vps-nginx-production-config-install.cjs`: `installed=false`, `dry_run=true`, `reason=missing_VPS_SITE_HOST`.

Resultado: OAuth preflight segue consistente e sanitizado. SEO producao continua bloqueado ate instalar/ativar a config Nginx de producao na VPS.

Pendencias:

- reconectar Bling e Shopee com codigo real valido em janela controlada;
- fornecer host/credencial de instalacao Nginx ou executar o instalador guardado na janela de corte;
- repetir `SEO_PRODUCTION_HOST_LIVE=true SEO_PRODUCTION_HOST=www.mercadodovale.com.br node tmp-tests/vps-seo-production-host-check.cjs` apos instalar a config.

Rollback: nenhum; registro documental apenas.

### 2026-05-22 - Revalidacao live do staging frontend/proxy

Mudanca: reexecutada a validacao live do staging frontend e do proxy VPS em modo somente leitura.

Objetivo: confirmar que o site estatico servido pela VPS, o fallback SPA de admin e o proxy publico continuam respondendo antes de avançar para testes com sessao real.

Arquivos alterados:

- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-staging-frontend-proxy-check-static.test.mjs`
- `STAGING_FRONTEND_PROXY_LIVE=true node tmp-tests/vps-staging-frontend-proxy-check.cjs`: `ok=true`, `live_read=true`, raiz `200`, `/admin/products` `200`, `/api/vps-proxy?path=/status` `200`, `/api/vps-proxy?path=/products?limit=1` `200`, `/api/vps-proxy?path=/company-settings` `403`.

Resultado: staging publico e proxy VPS seguem respondendo conforme esperado; a rota sensivel de configuracoes continua bloqueada sem sessao.

Pendencias:

- validar no navegador com DNS/hosts local;
- fazer login admin real e repetir `/api/vps-proxy` com sessao autenticada.

Rollback: nenhum; registro documental apenas.

### 2026-05-22 - Regressão agregada dos guards da migração

Mudanca: criado runner local para executar os guards e testes estaticos principais da migração VPS em modo seguro, sem configurar confirmações nem desativar dry-run.

Objetivo: ter um comando único de regressão antes de qualquer execução controlada, cobrindo escrita Bling, escrita Shopee, webhooks, shipping, OAuth, SEO de produção e instalação Nginx guardada.

Arquivos alterados:

- `tmp-tests/vps-migration-guard-regression.cjs`
- `tmp-tests/vps-migration-guard-regression-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-migration-guard-regression-static.test.mjs`
- `node --check tmp-tests/vps-migration-guard-regression.cjs`
- `node tmp-tests/vps-migration-guard-regression.cjs`: `checked=28`, `failed=0`, `mutation_executed=false`.

Resultado: os guards principais continuam seguros por padrão. O runner falha se algum script sair com erro ou se aparecer marcador de execução real como `mutation_executed=true`, `quote_sent=true`, `label_requested=true`, `webhook_sent=true`, `live_read=true` ou `install_executed=true`.

Pendencias:

- rodar este comando antes de cada janela real de OAuth, webhook, shipping, Bling/Shopee escrita ou instalação Nginx;
- expandir o runner se novos guards forem adicionados ao checklist.

Rollback: remover os dois arquivos `tmp-tests/vps-migration-guard-regression*`; nenhuma infra foi alterada.

### 2026-05-22 - Guard para Shopee add_item e mídia controlados

Mudanca: criado runner guardado para validar `add_item`, `upload_image` e `upload_video` pela VPS sem publicar produto nem enviar mídia para a Shopee por acidente.

Objetivo: completar a cobertura de escrita Shopee pendente no checklist, separando publicação de item e upload de mídia em modos explícitos, sempre com dry-run por padrão.

Arquivos alterados:

- `tmp-tests/vps-shopee-add-item-media-guarded-check.cjs`
- `tmp-tests/vps-shopee-add-item-media-guarded-check-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-shopee-add-item-media-guarded-check-static.test.mjs`
- `node --check tmp-tests/vps-shopee-add-item-media-guarded-check.cjs`
- `node tmp-tests/vps-shopee-add-item-media-guarded-check.cjs`: `mutation_executed=false`, `reason=missing_SHOPEE_TEST_WRITE_KIND`.
- `SHOPEE_TEST_WRITE_KIND=add_item SHOPEE_TEST_ADD_ITEM_PRODUCT_ID=product-test node tmp-tests/vps-shopee-add-item-media-guarded-check.cjs`: `mutation_executed=false`, `reason=dry_run_enabled`.
- `SHOPEE_TEST_WRITE_KIND=upload_image SHOPEE_TEST_MEDIA_DATA_URL=not-data-url node tmp-tests/vps-shopee-add-item-media-guarded-check.cjs`: `mutation_executed=false`, `reason=missing_or_invalid_SHOPEE_TEST_MEDIA_DATA_URL`.
- `SHOPEE_TEST_WRITE_KIND=add_item SHOPEE_TEST_ADD_ITEM_PRODUCT_ID=product-test DRY_RUN=false node tmp-tests/vps-shopee-add-item-media-guarded-check.cjs`: `mutation_executed=false`, `reason=missing_explicit_confirmation`.

Resultado: `add_item`, `upload_image` e `upload_video` ficaram preparados para janela controlada, mas nenhuma mutacao real foi executada. O envio so ocorre com `DRY_RUN=false`, `CONFIRM_SHOPEE_TEST_ADD_ITEM_MEDIA=I_UNDERSTAND_SHOPEE_TEST_ADD_ITEM_MEDIA` e dados explícitos para o modo escolhido.

Pendencias:

- selecionar produto local sem vínculo Shopee para `add_item`;
- selecionar imagem/vídeo de teste explicitamente autorizado para upload;
- conferir no painel Shopee e no vínculo local antes de considerar a escrita Shopee validada.

Rollback: remover os dois arquivos `tmp-tests/vps-shopee-add-item-media-guarded-check*`; nenhuma infra foi alterada.

### 2026-05-22 - Guard para Bling financeiro controlado

Mudanca: criado runner guardado para validar mutacoes financeiras Bling via `/api/bling?resource=finance` sem executar criacao, atualizacao, baixa ou cancelamento por acidente.

Objetivo: preparar a validacao controlada de `create`, `update`, `baixar` e `cancelar` para `pagar|receber`, mantendo Authorization e corpo financeiro apenas em variaveis de ambiente e imprimindo somente metadados sanitizados.

Arquivos alterados:

- `tmp-tests/vps-bling-finance-mutation-guarded-check.cjs`
- `tmp-tests/vps-bling-finance-mutation-guarded-check-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-bling-finance-mutation-guarded-check-static.test.mjs`
- `node --check tmp-tests/vps-bling-finance-mutation-guarded-check.cjs`
- `node tmp-tests/vps-bling-finance-mutation-guarded-check.cjs`: `mutation_executed=false`, `reason=missing_BLING_FINANCE_TEST_ACTION`.
- `BLING_FINANCE_TEST_ACTION=create BLING_FINANCE_TEST_RESOURCE_TYPE=receber BLING_FINANCE_TEST_AUTHORIZATION="Bearer TEST" BLING_FINANCE_TEST_BODY_JSON='{"descricao":"teste"}' node tmp-tests/vps-bling-finance-mutation-guarded-check.cjs`: `mutation_executed=false`, `reason=dry_run_enabled`.
- `BLING_FINANCE_TEST_ACTION=create BLING_FINANCE_TEST_RESOURCE_TYPE=receber BLING_FINANCE_TEST_AUTHORIZATION="Bearer TEST" BLING_FINANCE_TEST_BODY_JSON='{"descricao":"teste"}' DRY_RUN=false node tmp-tests/vps-bling-finance-mutation-guarded-check.cjs`: `mutation_executed=false`, `reason=missing_explicit_confirmation`.
- `BLING_FINANCE_TEST_ACTION=cancelar BLING_FINANCE_TEST_RESOURCE_TYPE=pagar BLING_FINANCE_TEST_AUTHORIZATION="Bearer TEST" node tmp-tests/vps-bling-finance-mutation-guarded-check.cjs`: `mutation_executed=false`, `reason=missing_BLING_FINANCE_TEST_ID`.
- `node tmp-tests/vps-bling-finance-fastify-static.test.mjs`

Resultado: mutacoes financeiras Bling ficaram preparadas para janela controlada, mas nenhuma mutacao real foi executada. O envio so ocorre com `DRY_RUN=false`, `CONFIRM_BLING_FINANCE_MUTATION=I_UNDERSTAND_BLING_FINANCE_MUTATION`, Authorization explicita, `resourceType` valido e payload/id conforme a acao.

Pendencias:

- definir uma conta financeira de teste para `update`, `baixar` ou `cancelar`;
- definir payload minimo seguro para `create` em `pagar` ou `receber`;
- conferir no Bling e na VPS o efeito financeiro antes de liberar callbacks/corte final.

Rollback: remover os dois arquivos `tmp-tests/vps-bling-finance-mutation-guarded-check*`; nenhuma infra foi alterada.

### 2026-05-22 - Guard para Bling fiscal/dimensões controlado

Mudanca: criado runner guardado para validar `/api/bling?resource=product-update-fiscal` e `/api/bling?resource=product-update-dimensions` sem executar mutacao real por acidente.

Objetivo: preparar a validacao controlada de atualizacoes fiscais e logisticas de produto no Bling, mantendo dupla trava antes de qualquer POST real.

Arquivos alterados:

- `tmp-tests/vps-bling-product-update-guarded-check.cjs`
- `tmp-tests/vps-bling-product-update-guarded-check-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-bling-product-update-guarded-check-static.test.mjs`
- `node --check tmp-tests/vps-bling-product-update-guarded-check.cjs`
- `node tmp-tests/vps-bling-product-update-guarded-check.cjs`: `mutation_executed=false`, `reason=missing_BLING_TEST_PRODUCT_UPDATE_BLING_ID`.
- `BLING_TEST_PRODUCT_UPDATE_BLING_ID=123456 BLING_TEST_PRODUCT_UPDATE_NCM=12345678 node tmp-tests/vps-bling-product-update-guarded-check.cjs`: `mutation_executed=false`, `reason=dry_run_enabled`.
- `BLING_PRODUCT_UPDATE_KIND=dimensions BLING_TEST_PRODUCT_UPDATE_BLING_IDS=1,2,3,4 BLING_TEST_PRODUCT_UPDATE_PESO_BRUTO=1 node tmp-tests/vps-bling-product-update-guarded-check.cjs`: `mutation_executed=false`, `reason=too_many_bling_ids`.
- `BLING_TEST_PRODUCT_UPDATE_BLING_ID=123456 BLING_TEST_PRODUCT_UPDATE_NCM=12345678 DRY_RUN=false node tmp-tests/vps-bling-product-update-guarded-check.cjs`: `mutation_executed=false`, `reason=missing_explicit_confirmation`.

Resultado: atualizacao fiscal/dimensoes ficou preparada para janela controlada, mas nenhuma mutacao real foi executada. O envio so ocorre com `DRY_RUN=false` e `CONFIRM_BLING_PRODUCT_UPDATE=I_UNDERSTAND_BLING_PRODUCT_UPDATE`, alem de IDs e campos explicitamente informados.

Pendencias:

- selecionar produto Bling explicitamente controlado para teste fiscal;
- selecionar ate `3` produtos Bling controlados para teste de dimensoes/peso;
- conferir no Bling e na VPS se a atualizacao preserva estoque e demais campos do cadastro.

Rollback: remover os dois arquivos `tmp-tests/vps-bling-product-update-guarded-check*`; nenhuma infra foi alterada.

### 2026-05-22 - Guard para Bling stock-sync controlado

Mudanca: criado runner guardado para validar baixa de estoque Bling via `/api/bling?resource=stock-sync` sem executar mutacao real por acidente.

Objetivo: preparar a validacao controlada de `stock-sync`, que grava movimento de saida no Bling, mantendo dupla trava antes de qualquer POST real.

Arquivos alterados:

- `tmp-tests/vps-bling-stock-sync-guarded-check.cjs`
- `tmp-tests/vps-bling-stock-sync-guarded-check-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-bling-stock-sync-guarded-check-static.test.mjs`
- `node --check tmp-tests/vps-bling-stock-sync-guarded-check.cjs`
- `node tmp-tests/vps-bling-stock-sync-guarded-check.cjs`: `mutation_executed=false`, `reason=missing_BLING_TEST_STOCK_SYNC_BLING_ID`.
- `BLING_TEST_STOCK_SYNC_BLING_ID=123456 BLING_TEST_STOCK_SYNC_QUANTITY=1 node tmp-tests/vps-bling-stock-sync-guarded-check.cjs`: `mutation_executed=false`, `reason=dry_run_enabled`.
- `BLING_TEST_STOCK_SYNC_BLING_ID=123456 BLING_TEST_STOCK_SYNC_QUANTITY=6 node tmp-tests/vps-bling-stock-sync-guarded-check.cjs`: `mutation_executed=false`, `reason=quantity_above_guard_limit`.
- `BLING_TEST_STOCK_SYNC_BLING_ID=123456 BLING_TEST_STOCK_SYNC_QUANTITY=1 DRY_RUN=false node tmp-tests/vps-bling-stock-sync-guarded-check.cjs`: `mutation_executed=false`, `reason=missing_explicit_confirmation`.
- `node tmp-tests/vps-bling-stock-fastify-static.test.mjs`

Resultado: a baixa de estoque Bling ficou preparada para janela controlada, mas nenhuma mutacao real foi executada. O envio so ocorre com `BLING_TEST_STOCK_SYNC_BLING_ID`, `BLING_TEST_STOCK_SYNC_QUANTITY` entre `1` e `5`, `DRY_RUN=false` e `CONFIRM_BLING_STOCK_SYNC=I_UNDERSTAND_BLING_STOCK_SYNC`.

Pendencias:

- selecionar produto Bling explicitamente controlado para teste;
- executar uma baixa pequena e conferir movimento/estoque no Bling e na VPS;
- decidir se o limite operacional do guard deve continuar em `5` unidades para testes futuros.

Rollback: remover os dois arquivos `tmp-tests/vps-bling-stock-sync-guarded-check*`; nenhuma infra foi alterada.

### 2026-05-22 - Preflight OAuth Bling/Shopee pela VPS

Mudanca: criado runner sanitizado para validar rotas OAuth da VPS sem trocar codigo real nem imprimir URL assinada completa.

Objetivo: reduzir risco antes da reconexao real de Bling e Shopee, comprovando callbacks/validacoes e geracao da URL de autorizacao Shopee.

Arquivos alterados:

- `tmp-tests/vps-oauth-preflight-check.cjs`
- `tmp-tests/vps-oauth-preflight-check-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-oauth-preflight-check-static.test.mjs`
- `node --check tmp-tests/vps-oauth-preflight-check.cjs`
- `node tmp-tests/vps-oauth-preflight-check.cjs`: `live_read=false`, `reason=missing_OAUTH_PREFLIGHT_LIVE_true`.
- `OAUTH_PREFLIGHT_LIVE=true node tmp-tests/vps-oauth-preflight-check.cjs`: Bling callback sem code retornou `302` para `/admin/settings/bling`; Bling exchange vazio retornou `400 Missing client_id or client_secret`; Shopee callback sem parametros retornou `400`; Shopee auth retornou `200`, `auth_host=partner.shopeemobile.com`, `auth_path=/api/v2/shop/auth_partner`, `redirect_host=www.mercadodovale.com.br`.
- `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-oauth-fastify-static.test.mjs`

Resultado: preflight OAuth da VPS passou sem troca de token real. A URL assinada/partner id/signature nao foram impressos; apenas host/path e host de redirect foram registrados.

Pendencias:

- reconectar Bling com codigo OAuth valido gerado no provedor;
- reconectar Shopee com codigo/shop_id validos;
- decidir se `SHOPEE_REDIRECT_BASE_URL` deve continuar em `www.mercadodovale.com.br` ou apontar temporariamente para dominio/API da VPS enquanto o DNS principal nao corta.

Rollback: remover os dois arquivos `tmp-tests/vps-oauth-preflight-check*`; nenhuma infra foi alterada.

### 2026-05-22 - Validação pública de staging frontend e vps-proxy

Mudanca: criado runner read-only para validar a superficie publica do staging pela VPS antes da validacao de navegador com sessao real.

Objetivo: isolar a pendencia de login/admin real comprovando que Nginx staging, fallback SPA e `/api/vps-proxy` respondem corretamente sem credenciais.

Arquivos alterados:

- `tmp-tests/vps-staging-frontend-proxy-check.cjs`
- `tmp-tests/vps-staging-frontend-proxy-check-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-staging-frontend-proxy-check-static.test.mjs`
- `node --check tmp-tests/vps-staging-frontend-proxy-check.cjs`
- `node tmp-tests/vps-staging-frontend-proxy-check.cjs`: `live_read=false`, `reason=missing_STAGING_FRONTEND_PROXY_LIVE_true`.
- `STAGING_FRONTEND_PROXY_LIVE=true node tmp-tests/vps-staging-frontend-proxy-check.cjs`: `/` HTTP `200` HTML, `/admin/products` HTTP `200` HTML, `/api/vps-proxy?path=/status` HTTP `200`, `/api/vps-proxy?path=/products?limit=1` HTTP `200`, `/api/vps-proxy?path=/company-settings` HTTP `403` sem sessao.
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`

Resultado: a parte publica do staging e o contrato sem sessao do `/api/vps-proxy` estao validados. A pendencia restante permanece limitada a DNS/hosts local, navegador e login/admin real com sessao.

Pendencias:

- configurar DNS/hosts para `staging.mercadodovale.com.br` abrir no navegador;
- validar login/admin real e chamadas protegidas de `/api/vps-proxy` com sessao;
- repetir fluxo no host de producao apos instalar Nginx de producao.

Rollback: remover os dois arquivos `tmp-tests/vps-staging-frontend-proxy-check*`; nenhuma infra foi alterada.

### 2026-05-22 - Preparação do host SEO de produção

Mudanca: criados validador read-only do host de produção, config Nginx de produção e instalador guardado para publicar a config na VPS.

Objetivo: fechar a etapa "validar host de produção antes do DNS final" sem depender da Vercel, comprovando `/sitemap.xml` e `/produto/:slug` com `Host: mercadodovale.com.br`/`www.mercadodovale.com.br`.

Arquivos alterados:

- `infra/nginx/mdv-site-production.conf`
- `tmp-tests/vps-nginx-production-config-static.test.mjs`
- `tmp-tests/vps-nginx-production-config-install.cjs`
- `tmp-tests/vps-nginx-production-config-install-static.test.mjs`
- `tmp-tests/vps-seo-production-host-check.cjs`
- `tmp-tests/vps-seo-production-host-check-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-seo-production-host-check-static.test.mjs`
- `node --check tmp-tests/vps-seo-production-host-check.cjs`
- `node tmp-tests/vps-seo-production-host-check.cjs`: `live_read=false`, `reason=missing_SEO_PRODUCTION_HOST_LIVE_true`.
- `SEO_PRODUCTION_HOST_LIVE=true node tmp-tests/vps-seo-production-host-check.cjs`: com `Host: mercadodovale.com.br`, `/sitemap.xml` retornou `404` no IP da VPS.
- `SEO_PRODUCTION_HOST_LIVE=true SEO_PRODUCTION_HOST=www.mercadodovale.com.br node tmp-tests/vps-seo-production-host-check.cjs`: com `Host: www.mercadodovale.com.br`, `/sitemap.xml` retornou `404` no IP da VPS.
- `node tmp-tests/vps-nginx-production-config-static.test.mjs`
- `node tmp-tests/vps-nginx-production-config-install-static.test.mjs`
- `node --check tmp-tests/vps-nginx-production-config-install.cjs`
- `node tmp-tests/vps-nginx-production-config-install.cjs`: `installed=false`, `reason=missing_VPS_SITE_HOST`.

Resultado: o checklist achou uma pendencia real antes do DNS: a VPS ainda nao responde pelos hosts de producao no Nginx. A config local foi preparada para redirecionar `mercadodovale.com.br` para `https://www.mercadodovale.com.br$request_uri` e servir site/API/SEO no `www`; a instalacao ficou bloqueada porque o ambiente local nao tem `VPS_SITE_HOST`/`VPS_SITE_USER`/credencial SSH disponiveis para este instalador.

Pendencias:

- fornecer `VPS_SITE_HOST`, `VPS_SITE_USER` e `VPS_SITE_PASSWORD` ou `VPS_SITE_PRIVATE_KEY`, ou aprovar outro mecanismo de acesso existente;
- executar `DRY_RUN=false CONFIRM_NGINX_PRODUCTION_INSTALL=I_UNDERSTAND_NGINX_PRODUCTION_INSTALL node tmp-tests/vps-nginx-production-config-install.cjs`;
- repetir `SEO_PRODUCTION_HOST_LIVE=true SEO_PRODUCTION_HOST=www.mercadodovale.com.br node tmp-tests/vps-seo-production-host-check.cjs`;
- decidir se o host raiz deve apenas redirecionar para `www` ou tambem servir canonical sem `www`.

Rollback: remover `infra/nginx/mdv-site-production.conf` e os arquivos `tmp-tests/vps-nginx-production-config-*`/`tmp-tests/vps-seo-production-host-check*`; nenhuma infra foi alterada nesta etapa.

### 2026-05-22 - Validação SEO de slugs especiais no staging

Mudanca: criado verificador read-only para selecionar slugs especiais do sitemap staging e validar HTML SEO de produto pela VPS.

Objetivo: fechar a pendencia de revisao de slugs especiais antes do DNS final, garantindo canonical, Open Graph de produto e JSON-LD sem depender da Vercel.

Arquivos alterados:

- `tmp-tests/vps-seo-special-slugs-check.cjs`
- `tmp-tests/vps-seo-special-slugs-check-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-seo-special-slugs-check-static.test.mjs`
- `node --check tmp-tests/vps-seo-special-slugs-check.cjs`
- `node tmp-tests/vps-seo-special-slugs-check.cjs`: `live_read=false`, `reason=missing_SEO_SPECIAL_SLUGS_LIVE_true`.
- `SEO_SPECIAL_SLUGS_LIVE=true SEO_SPECIAL_SLUGS_LIMIT=8 node tmp-tests/vps-seo-special-slugs-check.cjs`: sitemap staging HTTP `200`, `2133` URLs de produto, `8` slugs inspecionados com HTTP `200`, `text/html`, canonical para `staging.mercadodovale.com.br`, `og:type=product`, `2` blocos JSON-LD e sem canonical da home.

Resultado: slugs longos, numericos e com muitos segmentos retornaram HTML SEO correto via VPS staging. Nenhum endpoint mutante foi chamado; o script usa apenas GET publico.

Pendencias:

- repetir com host de producao apontando para a VPS antes do corte DNS final;
- revisar se a queda de `2136` para `2133` URLs entre validacoes de sitemap era esperada por alteracao de catalogo/SEO.

Rollback: remover os dois arquivos `tmp-tests/vps-seo-special-slugs-check*`; nenhuma infra foi alterada.

### 2026-05-22 - Guard para simulacao de etiqueta Melhor Envio

Mudanca: criado runner guardado para validar o fluxo de etiqueta Melhor Envio no `/api/shipping?provider=melhor-envio&action=label` sem criar carrinho, checkout ou etiqueta por acidente.

Objetivo: preparar a validacao controlada da parte mais sensivel do shipping migrado para a VPS, separando etiqueta do guard de cotacao.

Arquivos alterados:

- `tmp-tests/vps-melhor-envio-label-guarded-simulation.cjs`
- `tmp-tests/vps-melhor-envio-label-guarded-simulation-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-melhor-envio-label-guarded-simulation-static.test.mjs`
- `node --check tmp-tests/vps-melhor-envio-label-guarded-simulation.cjs`
- `node tmp-tests/vps-melhor-envio-label-guarded-simulation.cjs`: `label_requested=false`, `reason=missing_MELHOR_ENVIO_TEST_CARRIER_ID`.
- `MELHOR_ENVIO_TEST_CARRIER_ID=1 MELHOR_ENVIO_TEST_FROM_CEP=56300000 MELHOR_ENVIO_TEST_TO_NAME="Cliente Teste" MELHOR_ENVIO_TEST_TO_DOCUMENT=00000000000 MELHOR_ENVIO_TEST_TO_ADDRESS="Rua Teste" MELHOR_ENVIO_TEST_TO_CITY=Petrolina MELHOR_ENVIO_TEST_TO_DISTRICT=Centro MELHOR_ENVIO_TEST_TO_STATE=PE MELHOR_ENVIO_TEST_TO_POSTAL_CODE=56300000 MELHOR_ENVIO_TEST_TO_NUMBER=1 node tmp-tests/vps-melhor-envio-label-guarded-simulation.cjs`: `label_requested=false`, `reason=dry_run_enabled`.
- `MELHOR_ENVIO_TEST_TOKEN=TEST_TOKEN MELHOR_ENVIO_TEST_CARRIER_ID=1 MELHOR_ENVIO_TEST_FROM_CEP=56300000 MELHOR_ENVIO_TEST_TO_NAME="Cliente Teste" MELHOR_ENVIO_TEST_TO_DOCUMENT=00000000000 MELHOR_ENVIO_TEST_TO_ADDRESS="Rua Teste" MELHOR_ENVIO_TEST_TO_CITY=Petrolina MELHOR_ENVIO_TEST_TO_DISTRICT=Centro MELHOR_ENVIO_TEST_TO_STATE=PE MELHOR_ENVIO_TEST_TO_POSTAL_CODE=56300000 MELHOR_ENVIO_TEST_TO_NUMBER=1 DRY_RUN=false node tmp-tests/vps-melhor-envio-label-guarded-simulation.cjs`: `label_requested=false`, `reason=missing_explicit_confirmation`.
- `node tmp-tests/vps-shipping-fastify-static.test.mjs`

Resultado: a simulacao de etiqueta Melhor Envio ficou preparada, mas nenhuma etiqueta foi solicitada. O envio so ocorre com dados completos do destinatario/produto, `MELHOR_ENVIO_TEST_TOKEN`, `DRY_RUN=false` e `CONFIRM_MELHOR_ENVIO_LABEL_SIMULATION=I_UNDERSTAND_MELHOR_ENVIO_LABEL_SIMULATION`.

Pendencias:

- executar etiqueta em janela controlada com token sandbox/producao e pedido de teste explicitamente aprovado;
- validar que o retorno sanitizado confirma `order_id`/URL sem imprimir token ou dados pessoais;
- confirmar no Melhor Envio se a etiqueta gerada e cancelavel/reversivel antes de qualquer teste em producao.

Rollback: remover os dois arquivos `tmp-tests/vps-melhor-envio-label-guarded-simulation*`; nenhuma infra foi alterada.

### 2026-05-22 - Guard para simulacao de cotacao shipping

Mudanca: criado runner guardado para validar cotacao Frenet/Melhor Envio no `/api/shipping` sem disparar chamada real por acidente.

Objetivo: preparar a validacao controlada do frete migrado para a VPS, cobrindo apenas `action=calculate`; geracao de etiqueta Melhor Envio permanece fora deste runner.

Arquivos alterados:

- `tmp-tests/vps-shipping-quote-guarded-simulation.cjs`
- `tmp-tests/vps-shipping-quote-guarded-simulation-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-shipping-quote-guarded-simulation-static.test.mjs`
- `node --check tmp-tests/vps-shipping-quote-guarded-simulation.cjs`
- `node tmp-tests/vps-shipping-quote-guarded-simulation.cjs`: `quote_sent=false`, `reason=missing_SHIPPING_TEST_PROVIDER`.
- `SHIPPING_TEST_PROVIDER=frenet SHIPPING_TEST_FROM_CEP=56300000 SHIPPING_TEST_TO_CEP=01001000 node tmp-tests/vps-shipping-quote-guarded-simulation.cjs`: `quote_sent=false`, `reason=dry_run_enabled`.
- `SHIPPING_TEST_PROVIDER=melhor-envio SHIPPING_TEST_FROM_CEP=56300000 SHIPPING_TEST_TO_CEP=01001000 node tmp-tests/vps-shipping-quote-guarded-simulation.cjs`: `quote_sent=false`, `reason=dry_run_enabled`.
- `SHIPPING_TEST_PROVIDER=frenet SHIPPING_TEST_FROM_CEP=56300000 SHIPPING_TEST_TO_CEP=01001000 SHIPPING_TEST_TOKEN=TEST_TOKEN DRY_RUN=false node tmp-tests/vps-shipping-quote-guarded-simulation.cjs`: `quote_sent=false`, `reason=missing_explicit_confirmation`.

Resultado: a simulacao de cotacao Frenet/Melhor Envio ficou preparada, mas nenhuma cotacao real foi enviada. O envio so ocorre com `SHIPPING_TEST_PROVIDER`, `SHIPPING_TEST_FROM_CEP`, `SHIPPING_TEST_TO_CEP`, `SHIPPING_TEST_TOKEN`, `DRY_RUN=false` e `CONFIRM_SHIPPING_QUOTE_SIMULATION=I_UNDERSTAND_SHIPPING_QUOTE_SIMULATION`.

Pendencias:

- executar cotacao real em janela controlada com token e CEPs de teste explicitamente aprovados;
- validar retorno sanitizado para Frenet e Melhor Envio;
- preparar validacao separada para etiqueta Melhor Envio com pedido de teste.

Rollback: remover os dois arquivos `tmp-tests/vps-shipping-quote-guarded-simulation*`; nenhuma infra foi alterada.

### 2026-05-22 - Guard para simulacao de payload Mercado Pago webhook

Mudanca: criado runner guardado para validar payload simulado no `/api/mercadopago-webhook` sem consultar pagamento real ou atualizar pedido por acidente.

Objetivo: preparar a validacao controlada do webhook Mercado Pago migrado para a VPS antes de trocar callbacks definitivos.

Arquivos alterados:

- `tmp-tests/vps-mercadopago-webhook-simulation.cjs`
- `tmp-tests/vps-mercadopago-webhook-simulation-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-mercadopago-webhook-simulation-static.test.mjs`
- `node --check tmp-tests/vps-mercadopago-webhook-simulation.cjs`
- `node tmp-tests/vps-mercadopago-webhook-simulation.cjs`: `webhook_sent=false`, `reason=missing_MERCADOPAGO_TEST_PAYMENT_ID`.
- `MERCADOPAGO_TEST_PAYMENT_ID=0 node tmp-tests/vps-mercadopago-webhook-simulation.cjs`: `webhook_sent=false`, `reason=dry_run_enabled`.
- `MERCADOPAGO_TEST_PAYMENT_ID=0 DRY_RUN=false node tmp-tests/vps-mercadopago-webhook-simulation.cjs`: `webhook_sent=false`, `reason=missing_explicit_confirmation`.

Resultado: a simulacao de payload Mercado Pago ficou preparada, mas nenhum webhook foi enviado. O envio so ocorre com `MERCADOPAGO_TEST_PAYMENT_ID`, `DRY_RUN=false` e `CONFIRM_MERCADOPAGO_WEBHOOK_SIMULATION=I_UNDERSTAND_MERCADOPAGO_WEBHOOK_SIMULATION`.

Pendencias:

- executar simulacao em janela controlada com pagamento/pedido de teste explicitamente aprovado;
- validar debug de lookup e ausencia de atualizacao indevida quando o pagamento nao for aprovado;
- depois validar recebimento real do Mercado Pago antes de apontar webhook definitivo.

Rollback: remover os dois arquivos `tmp-tests/vps-mercadopago-webhook-simulation*`; nenhuma infra foi alterada.

### 2026-05-22 - Guard para simulacao de payload Bling webhook

Mudanca: criado runner guardado para validar payload simulado no `/api/bling-webhook` sem acionar atualizacao de estoque/preco/nome por acidente.

Objetivo: preparar a validacao controlada dos webhooks Bling migrados para a VPS, cobrindo eventos de estoque/produto antes de trocar callbacks definitivos.

Arquivos alterados:

- `tmp-tests/vps-bling-webhook-simulation.cjs`
- `tmp-tests/vps-bling-webhook-simulation-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-bling-webhook-simulation-static.test.mjs`
- `node --check tmp-tests/vps-bling-webhook-simulation.cjs`
- `node tmp-tests/vps-bling-webhook-simulation.cjs`: `webhook_sent=false`, `reason=missing_BLING_TEST_WEBHOOK_EVENT`.
- `BLING_TEST_WEBHOOK_EVENT=estoque BLING_TEST_WEBHOOK_SKU=TEST-SKU BLING_TEST_WEBHOOK_STOCK=1 node tmp-tests/vps-bling-webhook-simulation.cjs`: `webhook_sent=false`, `reason=dry_run_enabled`.
- `BLING_TEST_WEBHOOK_EVENT=estoque BLING_TEST_WEBHOOK_SKU=TEST-SKU BLING_TEST_WEBHOOK_STOCK=1 DRY_RUN=false node tmp-tests/vps-bling-webhook-simulation.cjs`: `webhook_sent=false`, `reason=missing_explicit_confirmation`.

Resultado: a simulacao de payload Bling ficou preparada, mas nenhum webhook foi enviado. O envio so ocorre com `BLING_TEST_WEBHOOK_EVENT`, `BLING_TEST_WEBHOOK_SKU` ou `BLING_TEST_WEBHOOK_BLING_ID`, `DRY_RUN=false` e `CONFIRM_BLING_WEBHOOK_SIMULATION=I_UNDERSTAND_BLING_WEBHOOK_SIMULATION`.

Pendencias:

- executar simulacao em janela controlada com SKU/produto explicitamente aprovado;
- validar registro em `webhook_logs` e efeito esperado em estoque/preco/nome;
- depois validar recebimento real do Bling antes de apontar webhook definitivo.

Rollback: remover os dois arquivos `tmp-tests/vps-bling-webhook-simulation*`; nenhuma infra foi alterada.

### 2026-05-22 - Guard para simulacao de payload Shopee webhook

Mudanca: criado runner guardado para validar payload simulado de pedido no `/api/shopee-webhook` sem acionar envio para n8n por acidente.

Objetivo: preparar a validacao controlada do Push Mechanism da Shopee (`code=3`, status de pedido) antes de trocar callbacks definitivos, mantendo dupla trava para qualquer envio real de simulacao.

Arquivos alterados:

- `tmp-tests/vps-shopee-webhook-order-simulation.cjs`
- `tmp-tests/vps-shopee-webhook-order-simulation-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-shopee-webhook-order-simulation-static.test.mjs`
- `node --check tmp-tests/vps-shopee-webhook-order-simulation.cjs`
- `node tmp-tests/vps-shopee-webhook-order-simulation.cjs`: `webhook_sent=false`, `reason=missing_SHOPEE_TEST_WEBHOOK_ORDER_SN`.
- `SHOPEE_TEST_WEBHOOK_ORDER_SN=TEST-ORDER SHOPEE_TEST_WEBHOOK_STATUS=READY_TO_SHIP node tmp-tests/vps-shopee-webhook-order-simulation.cjs`: `webhook_sent=false`, `reason=dry_run_enabled`.
- `SHOPEE_TEST_WEBHOOK_ORDER_SN=TEST-ORDER SHOPEE_TEST_WEBHOOK_STATUS=READY_TO_SHIP DRY_RUN=false node tmp-tests/vps-shopee-webhook-order-simulation.cjs`: `webhook_sent=false`, `reason=missing_explicit_confirmation`.

Resultado: a simulacao de payload Shopee ficou preparada, mas nenhum webhook `code=3` foi enviado. O envio so ocorre com `SHOPEE_TEST_WEBHOOK_ORDER_SN`, `SHOPEE_TEST_WEBHOOK_STATUS`, `DRY_RUN=false` e `CONFIRM_SHOPEE_WEBHOOK_ORDER_SIMULATION=I_UNDERSTAND_SHOPEE_WEBHOOK_ORDER_SIMULATION`.

Pendencias:

- executar a simulacao em janela controlada com pedido/loja de teste explicitamente aprovados;
- validar logs/n8n apos a simulacao;
- depois validar recebimento real da Shopee antes de apontar webhook definitivo.

Rollback: remover os dois arquivos `tmp-tests/vps-shopee-webhook-order-simulation*`; nenhuma infra foi alterada.

### 2026-05-22 - Bling reconcile pos-apply usando MySQL da VPS

Mudança: após o apply real controlado do plano revisado, o dry-run pós-apply ainda retornou o plano antigo. A investigação mostrou que a aplicação atualizou a VPS/MySQL, mas o planejador do reconcile ainda montava o plano lendo produtos do Supabase, que ficou como fonte antiga durante a migração. O planejador agora busca os produtos mapeados diretamente em `products` no MySQL da VPS.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`
- `tmp-tests/vps-bling-reconcile-apply-guarded.cjs`
- `tmp-tests/vps-bling-reconcile-apply-guarded-static.test.mjs`
- `tools/check-bling-reconcile-apply-readiness.mjs`
- `tmp-tests/bling-reconcile-apply-readiness-cli-static.test.mjs`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260522005919.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260522005919.bak`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-reconcile-stock-fallback-static.test.mjs`
- `node tmp-tests/vps-bling-reconcile-dry-run-details-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `node tmp-tests/vps-bling-reconcile-dry-run-check.cjs`
- `node tmp-tests/vps-bling-reconcile-dry-run-details-check.cjs`
- `node tools/review-bling-reconcile-plan.mjs`
- `node tmp-tests/vps-bling-reconcile-apply-guarded-static.test.mjs`
- `node tmp-tests/bling-reconcile-apply-readiness-cli-static.test.mjs`
- `node tmp-tests/bling-reconcile-apply-readiness-cli.test.mjs`
- `node tmp-tests/bling-reconcile-apply-readiness-cli-fails-on-guard.test.mjs`
- `node tmp-tests/bling-reconcile-apply-readiness-cli-fails-on-guard-result.test.mjs`
- `node --check tmp-tests/vps-bling-reconcile-apply-guarded.cjs`
- `node --check tools/check-bling-reconcile-apply-readiness.mjs`
- `node tools/check-bling-reconcile-apply-readiness.mjs`

Resultado sanitizado:

- Apply real anterior: `applied.stockChanges=7`, `applied.nameChanges=57`, `failed_count=0`.
- Antes da correção de fonte, o dry-run pós-apply ainda retornava `7` estoques e `57` nomes por ler Supabase antigo.
- Após trocar a fonte local para MySQL da VPS e redeployar, o dry-run real retornou `planned.stockChanges=8`, `planned.nameChanges=20`, `totals.localProducts=2437`, `totals.localMappedProducts=2435`, `totals.remoteProducts=6107`, `totals.remoteStocks=2435`.
- Detalhes atuais salvos em `tmp-tests/vps-bling-reconcile-dry-run-details-output.json`.
- Revisão local atual: estoque com `8` mudanças, `1` aumento, `7` reduções, `1` zeragem, delta total `-11`; nomes com `20` mudanças, `5` apenas sufixo de cor e `15` renomes fora desse padrão. Flags: `stock_zeroing_present`, `name_changes_not_limited_to_color_suffix`, `duplicate_previous_names_split_by_color`.
- Readiness atual passou apenas em preflight local (`applied=false`, `reason=preflight_only`) e agora exige confirmação explícita também para renomes fora do padrão: `CONFIRM_BLING_RECONCILE_UNSAFE_RENAMES=I_REVIEWED_UNSAFE_RENAMES` e lista exata em `CONFIRM_BLING_RECONCILE_UNSAFE_RENAME_SKUS`.
- Hash atual do artefato revisado: `9d17d0158c4965217bc4b4921e48b5c934427f8ae81b596c21ece9af7c4d74e9`.

Resultado: o bug de conferência foi isolado e corrigido. O reconcile não está zerado ainda; os `8` estoques e `20` nomes restantes são o novo plano real contra MySQL da VPS e precisam de revisão antes de novo apply.

### 2026-05-21 - Remocao local do cron da Vercel apos cron VPS validado

Mudanca: removido o bloco `crons` do `vercel.json` depois de validar que `/api/cron-dispatcher` roda no Fastify da VPS, que o wrapper da VPS preserva o agendamento `0 22 * * *` e que o log real da VPS ja mostrou execucao bem-sucedida.

Arquivos/infra alterados:

- `vercel.json`
- `tmp-tests/vercel-cron-disabled-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vercel-cron-disabled-static.test.mjs`
- `node tmp-tests/vps-cron-dispatcher-fastify-static.test.mjs`
- `node tmp-tests/vps-cron-dispatcher-install-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`

Resultado: a configuracao versionada da Vercel nao agenda mais `/api/cron-dispatcher`; a rota e o instalador da VPS seguem cobertos por testes estaticos, e a checagem de sintaxe dos artefatos da VPS passou. Antes do desligamento final da Vercel, ainda falta revisar callbacks/OAuth e webhooks externos.

### 2026-05-21 - Bling reconcile real em dry-run pela VPS com saldos filtrados

Mudança: criado executor guardado para chamar `/api/bling?resource=reconcile&dryRun=true` localmente na VPS, usando `CRON_SECRET` apenas no shell remoto e imprimindo só contagens. Depois do primeiro dry-run, corrigido o reconciliador para buscar saldos filtrados por `idsProdutos[]` quando a listagem geral de saldos do Bling vier vazia, com throttle/retry para respeitar o limite de `3` requisições por segundo do Bling.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-reconcile-dry-run-check.cjs`
- `tmp-tests/vps-bling-reconcile-dry-run-check-static.test.mjs`
- `tmp-tests/vps-bling-reconcile-stock-fallback-static.test.mjs`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521233240.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521233240.bak`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-bling-reconcile-dry-run-check-static.test.mjs`
- `node tmp-tests/vps-bling-reconcile-stock-fallback-static.test.mjs`
- `node tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`
- `node --check tmp-tests/vps-bling-reconcile-dry-run-check.cjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `node tmp-tests/vps-bling-reconcile-dry-run-check.cjs`

Resultado sanitizado:

- `dryRun`: `true`.
- `planned.stockChanges`: `7`.
- `planned.nameChanges`: `57`.
- `totals.localProducts`: `2435`.
- `totals.localMappedProducts`: `2435`.
- `totals.remoteProducts`: `6107`.
- `totals.remoteStocks`: `2435`.

Resultado: o caminho real de reconciliação pela VPS funciona em modo planejamento e não aplicou nenhuma alteração. A causa do `remoteStocks: 0` era a listagem geral de saldos do Bling vindo vazia; a consulta filtrada por IDs mapeados retorna os saldos necessários. Antes de executar aplicação real, revisar os `7` estoques e `57` nomes planejados.

### 2026-05-21 - Detalhamento do plano Bling reconcile dry-run

Mudança: adicionado modo protegido `details=true` ao `dryRun` do Bling reconcile e executor local para salvar o plano detalhado em JSON, sem aplicar mudanças.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-reconcile-dry-run-details-static.test.mjs`
- `tmp-tests/vps-bling-reconcile-dry-run-details-check.cjs`
- `tmp-tests/vps-bling-reconcile-dry-run-details-check-static.test.mjs`
- `tmp-tests/vps-bling-reconcile-dry-run-details-output.json`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521234002.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521234002.bak`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-bling-reconcile-dry-run-details-static.test.mjs`
- `node tmp-tests/vps-bling-reconcile-dry-run-details-check-static.test.mjs`
- `node --check tmp-tests/vps-bling-reconcile-dry-run-details-check.cjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `node tmp-tests/vps-bling-reconcile-dry-run-details-check.cjs`

Resultado:

- `planned.stockChanges`: `7`.
- `planned.nameChanges`: `57`.
- Estoques: `2` reduções de `-1` (`SGB400`, `EP-743-BRA`) e `5` aumentos de `+1` (`LJH074`, `CCSRMN70PRE`, `P3DRN504G`, `P3DI13PM`, `CCSIP1212PBG`).
- Nomes: `57/57` adicionam sufixo `Cor:...` e `57/57` mantêm o nome anterior como prefixo.

Resultado: plano detalhado pronto para revisão antes de aplicação real. Nenhuma alteração foi aplicada.

Preparação guardada para aplicação:

- `tmp-tests/vps-bling-reconcile-apply-guarded.cjs`
- `tmp-tests/vps-bling-reconcile-apply-guarded-static.test.mjs`
- `services/blingReconcilePlanReview.js`
- `tools/review-bling-reconcile-plan.mjs`
- `tmp-tests/bling-reconcile-plan-review.test.mjs`
- `tmp-tests/bling-reconcile-plan-review-cli-static.test.mjs`

Validação:

- `node tmp-tests/vps-bling-reconcile-apply-guarded-static.test.mjs`
- `node --check tmp-tests/vps-bling-reconcile-apply-guarded.cjs`
- `node tmp-tests/vps-bling-reconcile-apply-guarded.cjs`
- `node tmp-tests/bling-reconcile-plan-review.test.mjs`
- `node tmp-tests/bling-reconcile-plan-review-cli-static.test.mjs`
- `node --check tools/review-bling-reconcile-plan.mjs`
- `node tools/review-bling-reconcile-plan.mjs`
- `DRY_RUN=false CONFIRM_BLING_RECONCILE_APPLY=I_UNDERSTAND_BLING_RECONCILE_APPLY node tmp-tests/vps-bling-reconcile-apply-guarded.cjs` sem `CONFIRM_BLING_RECONCILE_ZEROING`
- `BLING_RECONCILE_MAX_REVIEW_AGE_MS=0 DRY_RUN=false CONFIRM_BLING_RECONCILE_APPLY=I_UNDERSTAND_BLING_RECONCILE_APPLY node tmp-tests/vps-bling-reconcile-apply-guarded.cjs`
- `DRY_RUN=false CONFIRM_BLING_RECONCILE_APPLY=I_UNDERSTAND_BLING_RECONCILE_APPLY CONFIRM_BLING_RECONCILE_ZEROING=I_REVIEWED_STOCK_ZEROING node tmp-tests/vps-bling-reconcile-apply-guarded.cjs` sem `CONFIRM_BLING_RECONCILE_ZEROING_SKUS`
- `node tmp-tests/vps-bling-reconcile-apply-guarded-hash-mismatch.test.mjs`
- `node tmp-tests/vps-bling-reconcile-apply-guarded-preflight.test.mjs`
- `BLING_RECONCILE_PREFLIGHT_ONLY=1 DRY_RUN=false CONFIRM_BLING_RECONCILE_APPLY=I_UNDERSTAND_BLING_RECONCILE_APPLY CONFIRM_BLING_RECONCILE_ZEROING=I_REVIEWED_STOCK_ZEROING CONFIRM_BLING_RECONCILE_ZEROING_SKUS=EP-743-BRA,SGB400 CONFIRM_BLING_RECONCILE_SOURCE_SHA256=0f7cc05fb14ac84e8027fe437a485ee8eedbbda86902d634974d54c19c8f0dfd node tmp-tests/vps-bling-reconcile-apply-guarded.cjs`
- `node tmp-tests/bling-reconcile-apply-readiness-cli-static.test.mjs`
- `node tmp-tests/bling-reconcile-apply-readiness-cli.test.mjs`
- `node tmp-tests/bling-reconcile-apply-readiness-cli-refuses-apply.test.mjs`
- `node tmp-tests/bling-reconcile-apply-readiness-cli-fails-on-guard.test.mjs`
- `node tmp-tests/bling-reconcile-apply-readiness-cli-fails-on-guard-result.test.mjs`
- `node tools/check-bling-reconcile-apply-readiness.mjs`

Resultado: executor não aplica nada por padrão. Para aplicação real, exige `DRY_RUN=false` e `CONFIRM_BLING_RECONCILE_APPLY=I_UNDERSTAND_BLING_RECONCILE_APPLY`.

Revisão local do plano:

- Estoque: `7` mudanças, `5` aumentos, `2` reduções, `2` zeragens (`SGB400`, `EP-743-BRA`), delta máximo absoluto `1`, delta total `+3`.
- Nomes: `57` mudanças, `57/57` limitadas a sufixo de cor (`Cor:`/`COR:`), `0` renomes fora desse padrão.
- Riscos restantes: revisar as `2` zeragens de estoque e aceitar explicitamente que `11` grupos de nomes iguais serão separados por cor.
- Relatórios locais gerados e ignorados pelo Git: `reports/bling-reconcile-review.md` e `reports/bling-reconcile-review.json`.

Trava adicional antes de aplicar:

- O executor agora lê `reports/bling-reconcile-review.json` antes de abrir SSH.
- A revisão inclui SHA-256 do artefato `tmp-tests/vps-bling-reconcile-dry-run-details-output.json`; se o hash atual divergir, o apply bloqueia como `review_source_hash_mismatch`.
- O bloqueio de hash mismatch tem teste de execução local com artefatos temporários e não abre SSH.
- O relatório precisa ser fresco; por padrão, revisões com mais de `30` minutos são bloqueadas como `stale_review`.
- Se houver `stock_zeroing_present`, ele bloqueia mesmo com `DRY_RUN=false` e confirmação geral.
- Para aplicar um plano com zeragem, passa a exigir também `CONFIRM_BLING_RECONCILE_ZEROING=I_REVIEWED_STOCK_ZEROING`.
- Além disso, exige confirmação da lista exata normalizada em `CONFIRM_BLING_RECONCILE_ZEROING_SKUS`; para o plano atual, o valor esperado é `EP-743-BRA,SGB400`.
- Validação local sem essa confirmação retornou `applied=false`, `reason=stock_zeroing_present`, `stockZeroing=["SGB400","EP-743-BRA"]`.
- Validação local com idade máxima artificial `0` retornou `applied=false`, `reason=stale_review`.
- Validação local com confirmação de zeragem, mas sem lista de SKUs, retornou `applied=false`, `reason=stock_zeroing_sku_list_mismatch`.
- Revisão atual gerada com `Source SHA-256: 0f7cc05fb14ac84e8027fe437a485ee8eedbbda86902d634974d54c19c8f0dfd`.
- Para apply/preflight direto no guard, também é exigido `CONFIRM_BLING_RECONCILE_SOURCE_SHA256=0f7cc05fb14ac84e8027fe437a485ee8eedbbda86902d634974d54c19c8f0dfd`.
- Modo preflight local adicionado com `BLING_RECONCILE_PREFLIGHT_ONLY=1`; quando todas as travas passam, retorna `applied=false`, `reason=preflight_only`, `localGuardsPassed=true` e não abre SSH.
- Preflight do plano atual passou localmente com as confirmações exatas, mantendo `stockZeroing=["SGB400","EP-743-BRA"]`.
- Comando preferido de pré-check local: `node tools/check-bling-reconcile-apply-readiness.mjs`. Ele regenera a revisão, executa o preflight com a lista de zeragem extraída do próprio relatório e retorna `localGuardsPassed=true` sem SSH/apply.
- O comando de readiness também aceita `--input`, `--markdown-output` e `--json-output`, permitindo testar artefatos temporários sem depender do plano real.
- O comando aceita `--zeroing-skus` para validar uma lista explícita; se qualquer guard local falhar, sai com código diferente de zero e escreve o JSON no stderr.
- Quando passa, o readiness imprime `requiredApplyEnv` com `DRY_RUN=false`, confirmações de apply/zeragem, lista de SKUs e SHA-256 esperado. Não inclui segredo.
- O comando de readiness recusa `--apply` explicitamente; ele é somente leitura.

### 2026-05-21 - Validação real controlada de Bling diagnostics pela VPS

Mudança: criado executor sanitizado para validar `debug-product` e `debug-diagnostic` com um `blingId` real já descoberto no plano do reconcile.

Arquivos/infra alterados:

- `tmp-tests/vps-bling-diagnostics-live-read-check.cjs`
- `tmp-tests/vps-bling-diagnostics-live-read-check-static.test.mjs`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-bling-diagnostics-live-read-check-static.test.mjs`
- `node --check tmp-tests/vps-bling-diagnostics-live-read-check.cjs`
- `node tmp-tests/vps-bling-diagnostics-live-read-check.cjs`

Resultado sanitizado:

- `debug-product`: HTTP indireto OK, `data` recebido com chaves esperadas de produto.
- `debug-diagnostic`: `stockStatus` `200`, `productStatus` `200`, `stockItems` `1`, `productItems` `1`.

Resultado: diagnóstico real de produto e saldo do Bling passa pela VPS sem imprimir nome, SKU, saldo, token ou corpo bruto.

### 2026-05-21 - Validação real controlada de Bling image-proxy pela VPS

Mudança: criado executor sanitizado para descobrir uma imagem real de produto Bling via `debug-product` e validar o proxy `/api/bling?resource=image-proxy`.

Arquivos/infra alterados:

- `tmp-tests/vps-bling-image-proxy-live-check.cjs`
- `tmp-tests/vps-bling-image-proxy-live-check-static.test.mjs`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-bling-image-proxy-live-check-static.test.mjs`
- `node --check tmp-tests/vps-bling-image-proxy-live-check.cjs`
- `node tmp-tests/vps-bling-image-proxy-live-check.cjs`

Resultado sanitizado:

- `status`: `200`.
- `contentType`: `image/png`.
- `bytes`: `471268`.
- `triedProducts`: `1`.

Resultado: `image-proxy` passou com imagem real pela VPS sem imprimir URL da imagem, nome do produto, SKU, saldo, token ou corpo bruto.

### 2026-05-21 - Validação dry-run real de Bling sync-prices-vps pela VPS

Mudança: adicionado `dryRun=true` ao `sync-prices-vps`, corrigido o header `Range` do Supabase/PostgREST e removida a coluna inexistente `products.is_combo` do select/payload da VPS.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-sync-prices-dry-run-static.test.mjs`
- `tmp-tests/vps-bling-sync-prices-dry-run-check.cjs`
- `tmp-tests/vps-bling-sync-prices-dry-run-check-static.test.mjs`
- `tmp-tests/vps-bling-sync-prices-supabase-diagnostic.cjs`
- `tmp-tests/vps-bling-sync-prices-supabase-diagnostic-static.test.mjs`
- `tmp-tests/vps-bling-sync-prices-fastify-static.test.mjs`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521235514.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521235514.bak`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-bling-sync-prices-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-sync-prices-dry-run-static.test.mjs`
- `node tmp-tests/vps-bling-sync-prices-dry-run-check-static.test.mjs`
- `node --check tmp-tests/vps-bling-sync-prices-dry-run-check.cjs`
- `node tmp-tests/vps-bling-sync-prices-supabase-diagnostic-static.test.mjs`
- `node --check tmp-tests/vps-bling-sync-prices-supabase-diagnostic.cjs`
- `node tmp-tests/vps-bling-sync-prices-supabase-diagnostic.cjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `node tmp-tests/vps-bling-sync-prices-dry-run-check.cjs`

Diagnóstico:

- A primeira execução retornou `Supabase products fetch failed: 400`.
- Diagnóstico sanitizado mostrou `column products.is_combo does not exist`.
- O select foi ajustado para o schema real e o `Range` passou a usar `Range-Unit: items` com `Range: 0-49`.

Resultado sanitizado:

- `dryRun`: `true`.
- `wouldSync`: `50`.
- `page`: `0`.
- `total`: `2443`.
- `hasMore`: `true`.
- `nextPage`: `1`.
- Página `1`: `wouldSync` `50`, `hasMore=true`, `nextPage=2`; amostra sanitizada confirmou preservação de `bling_parent_id` em itens com variação.
- Página `48`: `wouldSync` `43`, `hasMore=false`, `nextPage=null`.

Resultado: `sync-prices-vps` está validado em modo planejamento real pela VPS, sem escrita em `/products/batch`.

Preparação guardada para aplicação:

- `tmp-tests/vps-bling-sync-prices-apply-guarded.cjs`
- `tmp-tests/vps-bling-sync-prices-apply-guarded-static.test.mjs`

Validação:

- `node tmp-tests/vps-bling-sync-prices-apply-guarded-static.test.mjs`
- `node --check tmp-tests/vps-bling-sync-prices-apply-guarded.cjs`
- `node tmp-tests/vps-bling-sync-prices-apply-guarded.cjs`

Resultado: executor não aplica nada por padrão. Para aplicação real, exige `DRY_RUN=false` e `CONFIRM_BLING_SYNC_PRICES_APPLY=I_UNDERSTAND_BLING_SYNC_PRICES_APPLY`.

Aplicação real controlada:

- Primeira tentativa da página `0`: `ok=false`, erro `fetch failed` ao chamar `/products/batch`.
- Causa: chamada local montava `https://127.0.0.1:4000` por padrão; Fastify local responde em HTTP.
- Correção: `getVpsBatchBaseUrl` agora detecta host local (`127.0.0.1`, `localhost`, `::1`) e usa `http`.
- Backup do deploy da correção:
  - `/var/www/mdv-api/.codex-backups/server.js.20260522000235.bak`
  - `/var/www/mdv-api/.codex-backups/vps_server.js.20260522000235.bak`
- Reexecução da página `0`: `ok=true`, `synced=50`, `total=2443`, `hasMore=true`, `nextPage=1`, `vpsStatus=200`.

### 2026-05-21 - Comparação pública de sitemap produção vs VPS

Mudança: criado comparador público de sitemap para contar URLs da produção atual e do staging da VPS sem usar credenciais.

Arquivos/infra alterados:

- `tmp-tests/vps-sitemap-public-compare.cjs`
- `tmp-tests/vps-sitemap-public-compare-static.test.mjs`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-sitemap-public-compare-static.test.mjs`
- `node --check tmp-tests/vps-sitemap-public-compare.cjs`
- `node tmp-tests/vps-sitemap-public-compare.cjs`

Resultado:

- Produção atual: `https://mercadodovale.com.br/sitemap.xml` redireciona para `www.mercadodovale.com.br`, retorna HTTP `200`, `text/xml`, `3` URLs (`/`, `/privacidade`, `/faq`).
- VPS staging: `http://76.13.232.162/sitemap.xml` com `Host: staging.mercadodovale.com.br` retorna HTTP `200`, `application/xml`, `2136` URLs, host canônico `staging.mercadodovale.com.br`.
- Diferença: VPS staging tem `2133` URLs a mais que a produção atual.

Resultado: o sitemap da VPS está substancialmente mais completo que o sitemap público atual. Antes do DNS final, ainda falta validar o host de produção e revisar slugs especiais.

### 2026-05-21 - Observação real do cron-dispatcher na VPS

Mudança: criado observador somente leitura para verificar a entrada do crontab e o log do cron-dispatcher sem ler `.env` remoto nem imprimir segredo.

Arquivos/infra alterados:

- `tmp-tests/vps-cron-dispatcher-log-check.cjs`
- `tmp-tests/vps-cron-dispatcher-log-check-static.test.mjs`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-cron-dispatcher-log-check-static.test.mjs`
- `node --check tmp-tests/vps-cron-dispatcher-log-check.cjs`
- `node tmp-tests/vps-cron-dispatcher-log-check.cjs`

Resultado sanitizado:

- `crontab_has_entry`: `true`.
- `log_exists`: `true`.
- `log_meta`: `120 bytes|2026-05-21 22:00:04.169945859 +0000`.
- última linha do log: `Cron ran successfully. Dispatched 1 templates.`

Resultado: o cron da VPS executou com sucesso e disparou 1 template. Nenhum `Authorization`, `CRON_SECRET` ou conteúdo de `.env` foi impresso.

### 2026-05-21 - Validação real controlada de leituras Bling pela VPS

Mudança: executadas consultas reais de leitura Bling passando por `api.xiaomipetrolina.com.br`, com token salvo lido do Supabase e saída sanitizada.

Arquivos/infra alterados:

- `tmp-tests/vps-bling-live-read-check.cjs`
- `tmp-tests/vps-bling-live-read-check-static.test.mjs`
- `tmp-tests/vps-bling-detail-live-read-check.cjs`
- `tmp-tests/vps-bling-detail-live-read-check-static.test.mjs`
- `tmp-tests/vps-bling-finance-live-read-check.cjs`
- `tmp-tests/vps-bling-finance-live-read-check-static.test.mjs`
- `tmp-tests/vps-bling-stock-live-read-check.cjs`
- `tmp-tests/vps-bling-stock-live-read-check-static.test.mjs`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-bling-live-read-check-static.test.mjs`
- `node --check tmp-tests/vps-bling-live-read-check.cjs`
- `node tmp-tests/vps-bling-live-read-check.cjs`
- `node tmp-tests/vps-bling-detail-live-read-check-static.test.mjs`
- `node --check tmp-tests/vps-bling-detail-live-read-check.cjs`
- `node tmp-tests/vps-bling-detail-live-read-check.cjs`
- `node tmp-tests/vps-bling-finance-live-read-check-static.test.mjs`
- `node --check tmp-tests/vps-bling-finance-live-read-check.cjs`
- `node tmp-tests/vps-bling-finance-live-read-check.cjs`
- `node tmp-tests/vps-bling-stock-live-read-check-static.test.mjs`
- `node --check tmp-tests/vps-bling-stock-live-read-check.cjs`
- `node tmp-tests/vps-bling-stock-live-read-check.cjs`

Resultados sanitizados:

- `/api/bling?resource=categories&page=1`: HTTP `200`, `71` categorias.
- `/api/bling?resource=products&page=1`: HTTP `200`, `100` produtos.
- `/api/bling?resource=nfe&pagina=1`: HTTP `200`, `100` notas.
- `/api/bling?resource=nfce&pagina=1`: HTTP `200`, `34` notas.
- `/api/bling?resource=product-detail&id=<descoberto>`: HTTP `200`, detalhe recebido.
- `/api/bling?resource=nf-detail&tipo=nfe&id=<descoberto>`: HTTP `200`, detalhe de NFe recebido.
- `/api/bling?resource=finance&resourceType=receber&action=list`: HTTP `200`, `100` contas.
- `/api/bling?resource=finance&resourceType=receber&action=get&id=<descoberto>`: HTTP `200`, detalhe recebido.
- `/api/bling?resource=finance&resourceType=pagar&action=list`: HTTP `200`, `10` contas.
- `/api/bling?resource=finance&resourceType=pagar&action=get&id=<descoberto>`: HTTP `200`, detalhe recebido.
- `/api/bling?resource=stock&page=1`: HTTP `200`, lista normalizada com `0` saldos.
- `/api/bling?resource=stock&page=1&idsProdutos[]=<descoberto>`: HTTP `200`, lista com `1` saldo.

Resultado: leituras reais de categorias, produtos, detalhe de produto, NFe, NFCe, detalhe de NFe, estoque e financeiro `list/get` passam pela VPS com Authorization válido. Nenhum token, produto, SKU, cliente, documento, nota, saldo, valor, link de pagamento ou corpo bruto foi impresso, e nenhuma mutação foi acionada.

Pendências:

- manter create/update/baixar/cancelar fora até existir ambiente ou caso aprovado.

### 2026-05-21 - Validação limitada guardada de Shopee Catalog completo

Mudança: adicionados limites `max_pages` e `max_items` à rota `get_full_catalog` e criado executor controlado para validar a leitura completa em ensaio pequeno.

Arquivos/infra alterados:

- `tmp-tests/vps-shopee-full-catalog-guarded-check.cjs`
- `tmp-tests/vps-shopee-full-catalog-guarded-check-static.test.mjs`
- `tmp-tests/vps-shopee-catalog-media-full-fastify-static.test.mjs`
- `vps_server.js`
- `vps_server.cjs`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521191110.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521191110.bak`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-shopee-full-catalog-guarded-check-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-media-full-fastify-static.test.mjs`
- `node --check tmp-tests/vps-shopee-full-catalog-guarded-check.cjs`
- `node tmp-tests/vps-shopee-full-catalog-guarded-check.cjs`: `full_catalog_executed` `false`, skip por `dry_run_enabled`.
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `DRY_RUN=false CONFIRM_SHOPEE_FULL_CATALOG_READ=I_UNDERSTAND_SHOPEE_FULL_CATALOG_READ SHOPEE_FULL_CATALOG_MAX_PAGES=1 SHOPEE_FULL_CATALOG_MAX_ITEMS=5 node tmp-tests/vps-shopee-full-catalog-guarded-check.cjs`: HTTP `200`, `item_count` `5`, sem erro.

Como executar a validação real em janela controlada:

- executar com `DRY_RUN=false` e `CONFIRM_SHOPEE_FULL_CATALOG_READ=I_UNDERSTAND_SHOPEE_FULL_CATALOG_READ`;
- ajustar `SHOPEE_FULL_CATALOG_MAX_PAGES` e `SHOPEE_FULL_CATALOG_MAX_ITEMS` para limitar o ensaio;
- opcionalmente ajustar `SHOPEE_FULL_CATALOG_PAGE_SIZE` entre `1` e `100`;
- manter saída sanitizada, apenas com contagem de itens e chaves de resposta.

Resultado: validação limitada de `get_full_catalog` passou pela VPS com 1 página e 5 itens. A varredura total do catálogo continua reservada para janela explícita.

Pendências:

- executar varredura total de `get_full_catalog` apenas em janela controlada, se ainda for necessária.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521191110.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Preparação guardada para mutações Shopee de produto na VPS

Mudança: criados executores controlados para validar `update_stock`, `update_price` e `ship_order` somente com produto/pedido de teste explícitos.

Arquivos/infra alterados:

- `tmp-tests/vps-shopee-mutation-guarded-check.cjs`
- `tmp-tests/vps-shopee-mutation-guarded-check-static.test.mjs`
- `tmp-tests/vps-shopee-ship-order-guarded-check.cjs`
- `tmp-tests/vps-shopee-ship-order-guarded-check-static.test.mjs`
- `tmp-tests/vps-shopee-test-candidate-discovery.cjs`
- `tmp-tests/vps-shopee-test-candidate-discovery-static.test.mjs`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-shopee-mutation-guarded-check-static.test.mjs`
- `node --check tmp-tests/vps-shopee-mutation-guarded-check.cjs`
- `node tmp-tests/vps-shopee-mutation-guarded-check.cjs`: `mutation_executed` `false`, skip por `missing_SHOPEE_TEST_PRODUCT_ID`.
- `SHOPEE_TEST_PRODUCT_ID=TEST-PRODUCT DRY_RUN=false node tmp-tests/vps-shopee-mutation-guarded-check.cjs`: `mutation_executed` `false`, skip por `missing_explicit_confirmation`.
- `node tmp-tests/vps-shopee-ship-order-guarded-check-static.test.mjs`
- `node --check tmp-tests/vps-shopee-ship-order-guarded-check.cjs`
- `node tmp-tests/vps-shopee-ship-order-guarded-check.cjs`: `mutation_executed` `false`, skip por `missing_SHOPEE_TEST_ORDER_SN`.
- `SHOPEE_TEST_ORDER_SN=TEST-ORDER DRY_RUN=false node tmp-tests/vps-shopee-ship-order-guarded-check.cjs`: `mutation_executed` `false`, skip por `missing_explicit_confirmation`.
- `node tmp-tests/vps-shopee-test-candidate-discovery-static.test.mjs`
- `node --check tmp-tests/vps-shopee-test-candidate-discovery.cjs`
- `node tmp-tests/vps-shopee-test-candidate-discovery.cjs`: `candidate_count` `50`, `test_like_count` `0`, saída sem SKU/nome/item/model.

Como executar a validação real em janela controlada:

- definir `SHOPEE_TEST_PRODUCT_ID` com um produto de teste já vinculado à Shopee;
- definir `SHOPEE_TEST_STOCK` e `SHOPEE_TEST_PRICE_CENTS` com valores de teste;
- executar com `DRY_RUN=false` e `CONFIRM_SHOPEE_TEST_MUTATION=I_UNDERSTAND_SHOPEE_TEST_MUTATION`.
- para `ship_order`, definir `SHOPEE_TEST_ORDER_SN` com pedido controlado e executar com `DRY_RUN=false` e `CONFIRM_SHOPEE_TEST_SHIP_ORDER=I_UNDERSTAND_SHOPEE_TEST_SHIP_ORDER`.

Resultado: trilhas de mutação de produto e envio preparadas com dupla trava. A descoberta encontrou produtos vinculados à Shopee, mas nenhum candidato claramente marcado como teste. Nenhuma mutação real foi executada neste passo.

Pendências:

- criar ou selecionar produto de teste vinculado à Shopee para validar `update_stock` e `update_price`;
- selecionar pedido de teste/controlado para validar `ship_order`.

### 2026-05-21 - Validação real controlada de leitura Shopee pela VPS

Mudança: executadas consultas reais de leitura Shopee por `api.xiaomipetrolina.com.br`, com saída sanitizada.

Arquivos/infra alterados:

- `tmp-tests/vps-shopee-live-read-check.cjs`
- `tmp-tests/vps-shopee-live-read-check-static.test.mjs`
- `tmp-tests/vps-shopee-order-live-read-check.cjs`
- `tmp-tests/vps-shopee-order-live-read-check-static.test.mjs`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-shopee-live-read-check-static.test.mjs`
- `node --check tmp-tests/vps-shopee-live-read-check.cjs`
- `node tmp-tests/vps-shopee-live-read-check.cjs`
- `node tmp-tests/vps-shopee-order-live-read-check-static.test.mjs`
- `node --check tmp-tests/vps-shopee-order-live-read-check.cjs`
- `node tmp-tests/vps-shopee-order-live-read-check.cjs`

Resultados sanitizados:

- `/api/shopee-actions?action=get_shop_info`: HTTP `200`, sem erro.
- `/api/shopee-catalog?action=shop_info`: HTTP `200`, sem erro.
- `/api/shopee-catalog?action=categories&page_size=5`: HTTP `200`, `category_list` com `2038` itens.
- `/api/shopee-catalog?action=logistics_channel_list`: HTTP `200`, `logistics_channel_list` com `2` canais.
- `/api/shopee-catalog?action=get_item_list&page_size=5&item_status=NORMAL`: HTTP `200`, `item` com `5` itens; item descoberto para validações encadeadas.
- `/api/shopee-catalog?action=get_item_base_info&item_id_list=<descoberto>`: HTTP `200`, `item_list` com `1` item; warning Shopee não bloqueante sobre frete estimado do canal `90006`.
- `/api/shopee-catalog?action=get_model_list&item_id=<descoberto>`: HTTP `200`, `model` com `4` modelos.
- `/api/shopee-actions?action=get_order_list&page_size=5&time_range_field=create_time&time_from=<janela>&time_to=<janela>`: HTTP `200`, `order_list` com `5` pedidos; pedido descoberto para validações encadeadas.
- `/api/shopee-actions?action=get_order_detail&order_sn_list=<descoberto>`: HTTP `200`, `order_list` com `1` pedido.
- `/api/shopee-actions?action=get_tracking_info&order_sn=<descoberto>`: HTTP `200`, `tracking_info` com `3` eventos.
- `/api/shopee-actions?action=get_escrow_detail&order_sn=<descoberto>`: HTTP `200`, resposta de pagamento recebida.

Resultado: credenciais/assinatura Shopee na VPS estão funcionando para leituras reais de loja, catálogo, item, modelos, pedidos, rastreio e pagamento. Nenhum ID, `order_sn`, dado de comprador, SKU, preço ou token foi impresso, e nenhuma mutação foi acionada.

Pendências:

- atualizar a linha do mapa de rotas para refletir a leitura real Shopee validada;
- validar mutações em produto/pedido de teste antes do corte final.

### 2026-05-21 - Validação real controlada do Telegram Webhook na VPS

Mudança: executado `/ping` real passando pelo webhook da VPS com `x-telegram-bot-api-secret-token`.

Objetivo: confirmar o ciclo Telegram -> VPS Fastify -> Telegram sem expor `bot_token`, `TELEGRAM_WEBHOOK_SECRET` ou `chat_id` no terminal.

Arquivos/infra alterados:

- `tmp-tests/vps-telegram-webhook-ping.cjs`
- `tmp-tests/vps-telegram-webhook-ping-static.test.mjs`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-telegram-webhook-ping-static.test.mjs`
- `node --check tmp-tests/vps-telegram-webhook-ping.cjs`
- `node tmp-tests/vps-telegram-webhook-ping.cjs`: `webhook_status` `200`, `webhook_body` `{ "ok": true }`, usando o chat configurado.
- `tail /var/log/mdv-cron-dispatcher.log`: log ainda não existe porque a primeira execução agendada ainda não ocorreu.

Resultado: webhook Telegram na VPS validado com comando real controlado. O próximo ponto de observação é o primeiro ciclo agendado do cron-dispatcher.

Pendências:

- observar `/var/log/mdv-cron-dispatcher.log` após 22:00 UTC;
- remover callbacks/domínios restantes da Vercel após regressão completa.

### 2026-05-21 - Validação real controlada dos comandos Telegram `/vendas`, `/estoque`, `/relatorio`, `/top10` e `/pedidos`

Mudança: executados comandos de leitura do bot pelo webhook da VPS, usando o chat configurado no banco e o `TELEGRAM_WEBHOOK_SECRET` da VPS.

Arquivos/infra alterados:

- `tmp-tests/vps-telegram-webhook-command.cjs`
- `tmp-tests/vps-telegram-webhook-command-static.test.mjs`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-telegram-webhook-command-static.test.mjs`
- `node --check tmp-tests/vps-telegram-webhook-command.cjs`
- `node tmp-tests/vps-telegram-webhook-command.cjs /vendas`: `webhook_status` `200`, `webhook_body` `{ "ok": true }`.
- `node tmp-tests/vps-telegram-webhook-command.cjs /estoque`: `webhook_status` `200`, `webhook_body` `{ "ok": true }`.
- `node tmp-tests/vps-telegram-webhook-command.cjs /relatorio`: `webhook_status` `200`, `webhook_body` `{ "ok": true }`.
- `node tmp-tests/vps-telegram-webhook-command.cjs /top10`: `webhook_status` `200`, `webhook_body` `{ "ok": true }`.
- `node tmp-tests/vps-telegram-webhook-command.cjs /pedidos`: `webhook_status` `200`, `webhook_body` `{ "ok": true }`.

Resultado: comandos de leitura que consultam vendas, produtos, ranking de itens e pedidos responderam pelo caminho Telegram -> VPS Fastify -> Supabase -> Telegram.

Pendências:

- observar `/var/log/mdv-cron-dispatcher.log` após 22:00 UTC;
- remover callbacks/domínios restantes da Vercel após regressão completa.

### 2026-05-21 - Validação real controlada dos comandos Telegram `/clientes`, `/modelo` e `/categoria`

Mudança: executados os últimos comandos principais de leitura do bot pelo webhook da VPS.

Validação:

- `node tmp-tests/vps-telegram-webhook-command-static.test.mjs`
- `node --check tmp-tests/vps-telegram-webhook-command.cjs`
- `node tmp-tests/vps-telegram-webhook-command.cjs /clientes`: `webhook_status` `200`, `webhook_body` `{ "ok": true }`.
- `node tmp-tests/vps-telegram-webhook-command.cjs "/modelo iphone"`: `webhook_status` `200`, `webhook_body` `{ "ok": true }`.
- `node tmp-tests/vps-telegram-webhook-command.cjs "/categoria celulares"`: `webhook_status` `200`, `webhook_body` `{ "ok": true }`.

Resultado: comandos principais do bot Telegram foram validados pelo caminho Telegram -> VPS Fastify -> Supabase -> Telegram.

Pendências:

- observar `/var/log/mdv-cron-dispatcher.log` após 22:00 UTC;
- remover callbacks/domínios restantes da Vercel após regressão completa.

### 2026-05-21 - Instalação do Cron Dispatcher na VPS e remoção do cron da Vercel no repositório

Mudança: instalado wrapper `/var/www/mdv-api/cron/cron-dispatcher.sh` na VPS e configurada entrada crontab `0 22 * * *` para chamar `https://api.xiaomipetrolina.com.br/api/cron-dispatcher` com `Authorization: Bearer ${CRON_SECRET}`.

Objetivo: substituir a agenda da Vercel por cron local da VPS mantendo o mesmo horário UTC do `vercel.json`.

Arquivos/infra alterados:

- `vercel.json`
- `tmp-tests/vps-cron-dispatcher-install.cjs`
- `tmp-tests/vps-cron-dispatcher-install-static.test.mjs`
- `tmp-tests/vercel-cron-disabled-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/cron/cron-dispatcher.sh`
- crontab da VPS

Validação:

- `date +%Z` na VPS: `UTC`.
- `node tmp-tests/vps-cron-dispatcher-install-static.test.mjs`
- `node --check tmp-tests/vps-cron-dispatcher-install.cjs`
- `node tmp-tests/vps-cron-dispatcher-install.cjs`: dry-run com `forceTemplateId=__codex_probe__`, sem instalar crontab.
- `node tmp-tests/vps-cron-dispatcher-install.cjs --apply`: instalou entrada no crontab.
- `crontab -l | grep cron-dispatcher`: sobrou apenas `0 22 * * * /var/www/mdv-api/cron/cron-dispatcher.sh >> /var/log/mdv-cron-dispatcher.log 2>&1`.
- `node tmp-tests/vercel-cron-disabled-static.test.mjs`: `vercel.json` não define mais `crons`.

Resultado: cron-dispatcher está agendado na VPS. Duas entradas antigas no crontab que chamavam `https://www.mercadodovale.com.br/api/cron-dispatcher` foram removidas para não passar mais pela produção/Vercel.

Pendências:

- observar `/var/log/mdv-cron-dispatcher.log` após a próxima execução real;
- fazer deploy/push da alteração de `vercel.json` quando for hora de garantir que futuros deploys da Vercel não recriem cron;
- remover Vercel do caminho final de DNS/callbacks após regressão completa.

Rollback: remover a linha `/var/www/mdv-api/cron/cron-dispatcher.sh` do crontab e, se necessário, restaurar temporariamente as chamadas antigas para `https://www.mercadodovale.com.br/api/cron-dispatcher`.

### 2026-05-21 - Configuração de segredos e ativação do webhook Telegram na VPS

Mudança: configurados `CRON_SECRET` e `TELEGRAM_WEBHOOK_SECRET` dedicados no `.env` da VPS e registrado o webhook real do Telegram para a rota da VPS.

Objetivo: remover os fallbacks temporários de autenticação e tirar o webhook Telegram do caminho da Vercel.

Arquivos/infra alterados:

- `tmp-tests/vps-migration-secrets-set.cjs`
- `tmp-tests/vps-migration-secrets-set-static.test.mjs`
- `tmp-tests/vps-telegram-set-webhook.cjs`
- `tmp-tests/vps-telegram-set-webhook-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/.env`
- `/var/www/mdv-api/.codex-backups/.env.20260521134644.bak`
- webhook configurado na API do Telegram

Validação:

- `node tmp-tests/vps-migration-secrets-set-static.test.mjs`
- `node --check tmp-tests/vps-migration-secrets-set.cjs`
- `node tmp-tests/vps-migration-secrets-set.cjs`: criou `CRON_SECRET` e `TELEGRAM_WEBHOOK_SECRET` com 64 caracteres cada; valores não foram impressos.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, API online após restart.
- `curl -i https://api.xiaomipetrolina.com.br/api/cron-dispatcher`: `401 Unauthorized`.
- `curl -i -X POST https://api.xiaomipetrolina.com.br/api/telegram-webhook --data @tmp-tests/telegram-webhook-ping-payload.json`: `401 Unauthorized` sem secret token.
- `node tmp-tests/vps-telegram-set-webhook-static.test.mjs`
- `node --check tmp-tests/vps-telegram-set-webhook.cjs`
- `node tmp-tests/vps-telegram-set-webhook.cjs`: `getWebhookInfo` antes apontava para `https://www.mercadodovale.com.br/api/telegram-webhook`; depois apontou para `https://api.xiaomipetrolina.com.br/api/telegram-webhook`, com `allowed_updates` = `message`, `edited_message`.

Resultado: o Telegram já envia novos updates para a rota da VPS usando `secret_token`. Chamadas públicas sem o secret token ficam bloqueadas.

Pendências:

- executar `/ping` real no chat do bot para confirmar o ciclo Telegram -> VPS -> Telegram;
- instalar cron na VPS para `/api/cron-dispatcher`;
- remover/desativar o Vercel Cron antigo após o cron da VPS ser validado.

Rollback:

- restaurar `/var/www/mdv-api/.codex-backups/.env.20260521134644.bak` para `/var/www/mdv-api/.env` e reiniciar `pm2 restart mdv-api --update-env`;
- reconfigurar o webhook do Telegram para `https://www.mercadodovale.com.br/api/telegram-webhook`, se for necessário voltar temporariamente para Vercel.

### 2026-05-21 - Deploy e validação staging do Telegram Webhook na VPS

Mudança: adicionada e publicada no Fastify da VPS a rota `/api/telegram-webhook`.

Objetivo: migrar o bot administrativo do Telegram para a VPS, preservando os comandos `/ping`, `/ajuda`, `/start`, `/help`, `/menu`, `/vendas`, `/relatorio`, `/top10`, `/estoque`, `/preco`, `/pedidos`, `/clientes`, `/modelo` e `/categoria`.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-telegram-webhook-fastify-static.test.mjs`
- `tmp-tests/telegram-webhook-ping-payload.json`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521134129.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521134129.bak`

Rotas/tabelas afetadas:

- `/api/telegram-webhook`
- `telegram_settings`
- `sales`
- `sale_items`
- `products`
- `orders`
- `customers`
- `categories`
- `models`
- `https://api.telegram.org/bot.../sendMessage`

Validação:

- `node tmp-tests/vps-telegram-webhook-fastify-static.test.mjs`
- `node tmp-tests/vps-cron-dispatcher-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-media-full-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-add-item-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, API online após restart.
- `curl -i https://api.xiaomipetrolina.com.br/api/telegram-webhook`: `200 OK`, `{ "ok": true }`.
- `curl -i -X POST https://api.xiaomipetrolina.com.br/api/telegram-webhook --data {}`: `200 OK`, `{ "ok": true }`.
- `curl -i -X POST https://api.xiaomipetrolina.com.br/api/telegram-webhook --data @tmp-tests/telegram-webhook-ping-payload.json`: `503 Service Unavailable`, `{ "error": "TELEGRAM_WEBHOOK_SECRET not configured" }`.

Resultado: rota publicada, mas processamento de mensagens com texto fica travado até existir `TELEGRAM_WEBHOOK_SECRET`. Isso evita disparo público do bot enquanto o webhook real do Telegram não for registrado com secret token.

Pendências:

- configurar `TELEGRAM_WEBHOOK_SECRET` no `.env` da VPS;
- registrar o webhook do Telegram apontando para `https://api.xiaomipetrolina.com.br/api/telegram-webhook` com `secret_token`;
- executar `/ping` real controlado;
- validar comandos de leitura com banco real;
- desligar o webhook antigo da Vercel após confirmação.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521134129.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging do Cron Dispatcher na VPS

Mudança: adicionada e publicada no Fastify da VPS a rota `/api/cron-dispatcher`.

Objetivo: substituir a Vercel Cron/Function por execução controlada na VPS, preservando templates agendados do Telegram, variáveis de empresa, vendas do dia, estoque, agenda Instagram e tags customizadas de `system_tags`.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-cron-dispatcher-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521133159.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521133159.bak`

Rotas/ações afetadas:

- `/api/cron-dispatcher`
- `telegram_settings`
- `company_settings`
- `sales`
- `products`
- `instagram_schedule`
- `system_tags`
- `https://api.telegram.org/bot.../sendMessage`

Validação:

- `node tmp-tests/vps-cron-dispatcher-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-media-full-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-add-item-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, API online após restart.
- `curl -i https://api.xiaomipetrolina.com.br/api/cron-dispatcher`: `401 Unauthorized`, `{ "error": "Unauthorized" }`.

Resultado: rota publicada e protegida. A primeira validação mostrou que o atalho por IP local ficava permissivo demais atrás do Nginx; a guarda foi corrigida para exigir segredo sempre. Como `CRON_SECRET` dedicado ainda não está configurado na VPS, a rota aceita `SYNC_SECRET` como fallback temporário.

Pendências:

- configurar `CRON_SECRET` dedicado no `.env` da VPS;
- criar/ativar a chamada agendada na própria VPS com `Authorization: Bearer <CRON_SECRET>`;
- executar um disparo real controlado com `forceTemplateId`;
- comparar o resultado/log contra a Vercel antes de desligar o cron antigo.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521133159.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de mídia e catálogo completo Shopee Catalog

Mudança: adicionadas e publicadas no Fastify da VPS as ações `upload_image`, `upload_video` e `get_full_catalog` dentro de `/api/shopee-catalog`.

Objetivo: completar a cobertura do handler Vercel de Shopee Catalog na VPS, preservando upload multipart de imagem, upload de vídeo em partes com MD5 e polling, e varredura paginada do catálogo com detalhes em lotes.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-shopee-catalog-media-full-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521130314.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521130314.bak`

Rotas/ações afetadas:

- `/api/shopee-catalog?action=upload_image`
- `/api/shopee-catalog?action=upload_video`
- `/api/shopee-catalog?action=get_full_catalog`
- `/api/v2/media_space/upload_image`
- `/api/v2/media_space/init_video_upload`
- `/api/v2/media_space/upload_video_part`
- `/api/v2/media_space/complete_video_upload`
- `/api/v2/media_space/get_video_upload_result`

Validação:

- `node tmp-tests/vps-shopee-catalog-media-full-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-mutations-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-read-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-add-item-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-mutations-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-read-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, API online após restart.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-catalog?action=upload_image"`: `405 Method Not Allowed`, `{ "error": "POST required" }`.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-catalog?action=upload_video"`: `405 Method Not Allowed`, `{ "error": "POST required" }`.

Resultado: mídia e catálogo completo estão publicados. As validações HTTP seguras confirmaram bloqueio de uploads por GET, sem enviar mídia para a Shopee.

Pendências:

- validar upload real de imagem com arquivo controlado;
- validar upload real de vídeo pequeno/controlado;
- validar `get_full_catalog` em janela controlada por consultar a Shopee real;
- comparar retorno contra a Vercel antes do corte final.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521130314.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de Shopee Actions add_item

Mudança: adicionada e publicada no Fastify da VPS a ação `add_item` dentro de `/api/shopee-actions`.

Objetivo: preservar o fluxo legado que cria item Shopee a partir de produto da VPS, bloqueia duplicidade quando já existe vínculo, sobe imagens do produto para a Shopee quando possível, cria o item e grava `shopee_item_id` de volta no produto da VPS.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-shopee-actions-add-item-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521125742.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521125742.bak`

Rotas/ações afetadas:

- `/api/shopee-actions?action=add_item`
- `/api/v2/media_space/upload_image`
- `/api/v2/product/add_item`
- `/products/:id` via `PUT` para persistir `shopee_item_id`

Validação:

- `node tmp-tests/vps-shopee-actions-add-item-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-mutations-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-read-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-refresh-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-mutations-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-read-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, API online após restart.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-actions?action=add_item&product_id=test"`: `405 Method Not Allowed`, `{ "error": "POST required" }`.

Resultado: `add_item` está publicado, mas protegido contra GET para evitar criação acidental por URL. Nenhuma criação real de item foi executada neste bloco.

Pendências:

- validar criação real com produto de teste ainda não vinculado;
- confirmar upload de imagens reais em produto controlado;
- comparar payload e resposta contra a Vercel antes do corte final.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521125742.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de mutações Shopee Actions

Mudança: adicionadas e publicadas no Fastify da VPS as ações mutáveis `ship_order`, `update_stock` e `update_price` dentro de `/api/shopee-actions`.

Objetivo: remover mais uma dependência da Vercel nas operações Shopee, preservando pré-checagens antes de `ship_order`, bloqueio idempotente para envio já preparado, leitura do produto na VPS antes de alterar estoque/preço e conversão de preço em centavos para valor Shopee.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-shopee-actions-mutations-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521125410.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521125410.bak`

Rotas/ações afetadas:

- `/api/shopee-actions?action=ship_order`
- `/api/shopee-actions?action=update_stock`
- `/api/shopee-actions?action=update_price`

Validação:

- `node tmp-tests/vps-shopee-actions-mutations-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-read-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-refresh-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-mutations-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-read-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, API online após restart.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-actions?action=update_stock&product_id=test&stock=1"`: `405 Method Not Allowed`, `{ "error": "POST required" }`.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-actions?action=ship_order&order_sn=TEST"`: `405 Method Not Allowed`, `{ "error": "POST required" }`.

Resultado: as ações mutáveis estão publicadas, mas protegidas contra GET para evitar alteração por URL. Nenhuma chamada real de alteração foi executada neste bloco.

Pendências:

- validar `update_stock`/`update_price` com produto Shopee de teste;
- validar `ship_order` com pedido controlado em status correto;
- validar `add_item` com produto de teste após a migração separada;
- comparar comportamento contra a Vercel antes do corte final.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521125410.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de mutações Shopee Catalog

Mudança: adicionadas e publicadas no Fastify da VPS as mutações diretas de `/api/shopee-catalog`.

Objetivo: preservar compatibilidade com o handler Vercel para operações de catálogo que alteram produto, preço, estoque, variações e status, mantendo assinatura HMAC, renovação automática de token, validação de `POST` e debug copiável sem segredos.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-shopee-catalog-mutations-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521124802.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521124802.bak`

Rotas/ações afetadas:

- `/api/shopee-catalog?action=add_item`
- `/api/shopee-catalog?action=update_price`
- `/api/shopee-catalog?action=update_stock`
- `/api/shopee-catalog?action=update_model`
- `/api/shopee-catalog?action=init_tier_variation`
- `/api/shopee-catalog?action=delete_item`
- `/api/shopee-catalog?action=update_item_status`
- `/api/shopee-catalog?action=update_item`

Validação:

- `node tmp-tests/vps-shopee-catalog-mutations-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-read-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-read-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-refresh-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, API online após restart.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-catalog?action=update_stock"`: `405 Method Not Allowed`, `{ "error": "POST required" }`.

Resultado: mutações diretas estão publicadas em staging. A validação HTTP segura confirmou que chamadas sem `POST` são bloqueadas antes de qualquer envio à Shopee. A implementação preserva a expansão de `price_list` para modelos reais, busca dados fiscais antes de `update_item` e atualiza GTIN em modelos quando necessário.

Pendências:

- validar uma mutação real com produto de teste;
- migrar upload de imagem/vídeo e o `get_full_catalog`;
- migrar mutações restantes de `/api/shopee-actions` (`ship_order`, `add_item`, `update_stock`, `update_price`).

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521124802.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de Shopee Actions refresh_token

Mudança: adicionada a ação explícita `refresh_token` dentro de `/api/shopee-actions` no Fastify da VPS.

Objetivo: preservar compatibilidade com o frontend/fluxos legados que chamam renovação manual de token, reutilizando o helper central já usado pelo catálogo para assinar `/api/v2/auth/access_token/get` e persistir `shopee_access_token`/`shopee_refresh_token`.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-shopee-actions-refresh-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521123620.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521123620.bak`

Rotas/ações afetadas:

- `/api/shopee-actions?action=refresh_token`

Validação:

- `node tmp-tests/vps-shopee-actions-refresh-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-read-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-read-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-actions"`: `400 Bad Request`, `{ "error": "action obrigatória" }`.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-actions?action=get_order_detail"`: `400 Bad Request`, `{ "error": "order_sn_list não fornecido" }`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API online após restart.

Resultado: a renovação explícita está publicada na VPS, mas não foi chamada em HTTP real neste bloco para evitar rotação de token fora de janela controlada.

Pendências:

- acionar `refresh_token` uma vez com monitoramento quando for necessário renovar credenciais;
- migrar ações mutáveis `ship_order`, `add_item`, `update_stock` e `update_price`;
- comparar comportamento contra a Vercel antes do corte final.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521123620.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de Shopee Actions leitura

Mudança: adicionada a rota `/api/shopee-actions` ao Fastify da VPS para ações de consulta/leitura.

Objetivo: migrar consultas operacionais da Shopee sem acionar alterações de pedido ou produto, reutilizando os helpers assinados do Shopee Catalog e a renovação automática de token.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-shopee-actions-read-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521123248.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521123248.bak`

Rotas/ações afetadas:

- `/api/shopee-actions?action=get_shop_info`
- `/api/shopee-actions?action=get_order_list`
- `/api/shopee-actions?action=get_escrow_list`
- `/api/shopee-actions?action=get_order_detail`
- `/api/shopee-actions?action=get_tracking_info`
- `/api/shopee-actions?action=get_escrow_detail`
- `/api/shopee-actions?action=get_shipping_document`

Validação:

- `node tmp-tests/vps-shopee-actions-read-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-read-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-actions"`: `400 Bad Request`, `{ "error": "action obrigatória" }`.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-actions?action=get_order_detail"`: `400 Bad Request`, `{ "error": "order_sn_list não fornecido" }`.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-actions?action=get_tracking_info"`: `400 Bad Request`, `{ "error": "order_sn não fornecido" }`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API online após restart.

Resultado: Shopee Actions leitura está disponível na VPS em staging e as validações HTTP seguras não consultam pedidos reais nem disparam envio/etiqueta.

Pendências:

- validar consultas reais com pedido Shopee controlado;
- migrar ações mutáveis `ship_order`, `add_item`, `update_stock` e `update_price` com validações anti-duplicidade;
- comparar comportamento contra a Vercel antes do corte final.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521123248.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de Shopee Catalog leitura

Mudança: adicionada a rota `/api/shopee-catalog` ao Fastify da VPS para ações de consulta/leitura.

Objetivo: migrar a parte segura do catálogo Shopee antes das mutações, preservando assinatura HMAC com `access_token`/`shop_id`, renovação automática de token expirado e validações locais para parâmetros obrigatórios.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-shopee-catalog-read-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521122840.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521122840.bak`

Rotas/ações afetadas:

- `/api/shopee-catalog?action=categories`
- `/api/shopee-catalog?action=attributes`
- `/api/shopee-catalog?action=search_attribute_values`
- `/api/shopee-catalog?action=brand_list`
- `/api/shopee-catalog?action=shop_info`
- `/api/shopee-catalog?action=logistics_channel_list`
- `/api/shopee-catalog?action=warehouse_list`
- `/api/shopee-catalog?action=warehouse_detail`
- `/api/shopee-catalog?action=warehouse_locations`
- `/api/shopee-catalog?action=get_item_list`
- `/api/shopee-catalog?action=get_item_base_info`
- `/api/shopee-catalog?action=get_model_list`
- `/api/shopee-catalog?action=debug`

Validação:

- `node tmp-tests/vps-shopee-catalog-read-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-catalog?action=attributes"`: `400 Bad Request`, `{ "error": "category_id required" }`.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-catalog?action=search_attribute_values"`: `400 Bad Request`, `{ "error": "attribute_id required" }`.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-catalog?action=get_item_base_info"`: `400 Bad Request`, `{ "error": "item_id_list required" }`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API online após restart.

Resultado: Shopee Catalog leitura está disponível na VPS em staging e as validações HTTP seguras não acionam chamadas reais de catálogo nem alteram dados.

Pendências:

- validar consultas reais de leitura com credenciais Shopee em janela controlada;
- migrar ações mutáveis do catálogo (`add_item`, `update_price`, `update_stock`, `update_model`, `init_tier_variation`, `delete_item`, `update_item_status`, `update_item`, `upload_image`, `upload_video`);
- migrar `/api/shopee-actions`;
- comparar comportamento contra a Vercel antes do corte final.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521122840.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de Shopee webhook

Mudança: adicionada a rota `/api/shopee-webhook` ao Fastify da VPS.

Objetivo: mover para a VPS o receptor de Push Mechanism da Shopee, preservando `POST` com resposta `{ "message": "success" }` para evitar retry e encaminhamento opcional de eventos de pedido para `n8n_webhook_url`.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-shopee-webhook-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521122207.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521122207.bak`

Rotas afetadas:

- `/api/shopee-webhook`

Validação:

- `node tmp-tests/vps-shopee-webhook-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-resource-parity-static.test.mjs`
- `node tmp-tests/vps-bling-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-webhook"`: `405 Method Not Allowed`.
- `curl -i -X POST "https://api.xiaomipetrolina.com.br/api/shopee-webhook" --data "{}"`: `200 OK`, `{ "message": "success" }`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: webhook Shopee passa pelo VPS em staging; a validação segura não aciona n8n porque não envia `code=3` com dados de pedido.

Pendências:

- validar payload simulado `code=3` com `ordersn/status` em janela controlada;
- validar recebimento real da Shopee antes de apontar webhook definitivo;
- migrar `/api/shopee-catalog` e `/api/shopee-actions`;
- comparar comportamento contra a Vercel antes do corte final.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521122207.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de Shopee OAuth

Mudança: adicionada a rota `/api/shopee` ao Fastify da VPS para as ações `auth` e `callback`.

Objetivo: iniciar a migração Shopee pela etapa de OAuth/callback, preservando assinatura HMAC SHA256, escolha live/sandbox, callback estável `/api/shopee?action=callback` e gravação dos tokens em `company_settings`.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-shopee-oauth-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521121650.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521121650.bak`

Rotas afetadas:

- `/api/shopee?action=auth`
- `/api/shopee?action=callback`

Validação:

- `node tmp-tests/vps-shopee-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-resource-parity-static.test.mjs`
- `node tmp-tests/vps-bling-admin-helpers-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee?action=callback"`: `400 Bad Request`, `Parâmetros ausentes (code, shop_id)`.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee"`: `404 Not Found`, `Route not found or missing action`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: OAuth Shopee passa pelo VPS em staging sem trocar token em validação segura.

Pendências:

- validar `action=auth` com credenciais reais e conferir URL gerada;
- validar callback real com `code`/`shop_id` da Shopee em janela controlada;
- migrar `/api/shopee-catalog`, `/api/shopee-actions` e `/api/shopee-webhook`;
- comparar comportamento contra a Vercel antes de apontar callbacks definitivos.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521121650.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Auditoria final de paridade do `/api/bling`

Mudança: criado teste de paridade entre os recursos declarados em `api/bling.ts` e os recursos migrados no Fastify da VPS.

Objetivo: garantir que nenhum `resource` do handler Bling original ficou sem equivalente no `vps_server.js`/`vps_server.cjs` antes de passar para o próximo módulo da migração.

Arquivos alterados:

- `tmp-tests/vps-bling-resource-parity-static.test.mjs`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-bling-resource-parity-static.test.mjs`

Resultado: todos os recursos encontrados em `api/bling.ts` estão presentes nos dois artefatos da VPS, incluindo a rota combinada `nfe|nfce` e a lista de recursos migrados no erro de recurso inválido.

Pendências:

- validações reais controladas para rotas que gravam ou consultam Bling com token real;
- comparação final contra Vercel antes do corte de DNS/callbacks;
- seguir para módulos ainda pendentes da migração, começando por Shopee.

### 2026-05-21 - Deploy e validação staging de Bling admin helpers

Mudança: adicionados os recursos `fix-profile`, `sync-model-brand` e `fix-bling-id` ao `/api/bling` do Fastify na VPS.

Objetivo: mover para a VPS as rotas administrativas auxiliares que corrigem perfil, sincronizam marca de modelo e ajustam `bling_id` por SKU, preservando respostas e validações do handler original.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-admin-helpers-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521120827.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521120827.bak`

Rotas afetadas:

- `/api/bling?resource=fix-profile`
- `/api/bling?resource=sync-model-brand`
- `/api/bling?resource=fix-bling-id`

Validação:

- `node tmp-tests/vps-bling-admin-helpers-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-diagnostics-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-webhook-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-product-update-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i -X POST "https://api.xiaomipetrolina.com.br/api/bling?resource=fix-profile" --data "{}"`: `400 Bad Request`, `userId is required`.
- `curl -i -X POST "https://api.xiaomipetrolina.com.br/api/bling?resource=sync-model-brand" --data "{}"`: `400 Bad Request`, `model_id and brand_name are required`.
- `curl -i -X POST "https://api.xiaomipetrolina.com.br/api/bling?resource=fix-bling-id" --data "{}"`: `400 Bad Request`, `sku e blingId são obrigatórios`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: as rotas administrativas auxiliares passam pelo VPS em staging e validam payload antes de qualquer escrita.

Pendências:

- validar `fix-profile` com usuário real apenas quando necessário;
- validar `sync-model-brand` com modelo/marca controlados;
- validar `fix-bling-id` com SKU de teste ou caso real aprovado;
- comparar comportamento contra a Vercel antes do corte final.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521120827.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de Bling diagnostics

Mudança: adicionados os recursos `image-proxy`, `debug-product` e `debug-diagnostic` ao `/api/bling` do Fastify na VPS.

Objetivo: mover para a VPS as rotas auxiliares de proxy seguro de imagem e diagnóstico de produto/estoque do Bling, preservando validações de host, HTTPS obrigatório e fallback para token salvo em `company_settings`.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-diagnostics-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521120309.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521120309.bak`

Rotas afetadas:

- `/api/bling?resource=image-proxy`
- `/api/bling?resource=debug-product`
- `/api/bling?resource=debug-diagnostic`

Validação:

- `node tmp-tests/vps-bling-diagnostics-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-product-detail-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-product-update-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-webhook-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-nf-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i "https://api.xiaomipetrolina.com.br/api/bling?resource=image-proxy"`: `400 Bad Request`, `Missing url parameter`.
- `curl -i "https://api.xiaomipetrolina.com.br/api/bling?resource=debug-product"`: `400 Bad Request`, `blingId is required`.
- `curl -i "https://api.xiaomipetrolina.com.br/api/bling?resource=debug-diagnostic"`: `400 Bad Request`, `blingId is required`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: `image-proxy`, `debug-product` e `debug-diagnostic` passam pelo VPS em staging; as chamadas de validação não consultam o Bling nem alteram dados.

Pendências:

- validar `image-proxy` com URL real de host permitido;
- validar `debug-product` e `debug-diagnostic` com `blingId` real em janela controlada;
- migrar rotas administrativas auxiliares restantes (`fix-profile`, `sync-model-brand`, `fix-bling-id`).

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521120309.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de Bling webhook

Mudança: adicionada a rota dedicada `/api/bling-webhook` ao Fastify da VPS e preservada a compatibilidade legada `/api/bling?resource=webhook`, incluindo `webhook-logs`.

Objetivo: mover para a VPS o recebimento de webhooks do Bling, mantendo logs em `webhook_logs`, tratamento de eventos de estoque/produto, fallback de estoque e despacho compatível para payloads de Mercado Pago que cheguem por rewrite legado.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-webhook-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521115830.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521115830.bak`

Rotas afetadas:

- `/api/bling-webhook`
- `/api/bling?resource=webhook`
- `/api/bling?resource=webhook-logs`

Validação:

- `node tmp-tests/vps-bling-webhook-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-product-update-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-products-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-product-detail-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-stock-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-sync-prices-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-finance-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-nf-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i https://api.xiaomipetrolina.com.br/api/bling-webhook`: `200 OK`, `{ ok: true, mode: "vps-fastify", accepts: "POST" }`.
- `curl -i "https://api.xiaomipetrolina.com.br/api/bling?resource=webhook"`: `200 OK`, `{ ok: true, mode: "vps-fastify", accepts: "POST" }`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: `/api/bling-webhook`, `/api/bling?resource=webhook` e `webhook-logs` passam pelo VPS em staging. O handler mantém logs, eventos de estoque/produto, busca de estoque no Bling quando há token, fallback não-zero do payload e bloqueio contra zerar estoque quando a API falha.

Pendências:

- validar POST simulado em janela controlada, pois grava `webhook_logs` e pode acionar atualização de produto;
- validar webhook real do Bling antes de apontar o callback definitivo;
- implementar sincronização Shopee direta no handler VPS ou confirmar que o retorno `stockTargets` pelo endpoint local cobre o fluxo necessário;
- comparar comportamento contra a Vercel antes do corte final.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521115830.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de Bling product updates

Mudança: adicionados os recursos `product-update-fiscal` e `product-update-dimensions` ao `/api/bling` do Fastify na VPS.

Objetivo: mover para a VPS as atualizações de tributação e dimensões/peso de produtos no Bling, preservando busca do produto atual antes do `PUT` para não sobrescrever campos não informados.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-product-update-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521113351.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521113351.bak`

Rotas afetadas:

- `/api/bling?resource=product-update-fiscal`
- `/api/bling?resource=product-update-dimensions`

Validação:

- `node tmp-tests/vps-bling-product-update-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-products-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-product-detail-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-stock-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-sync-prices-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-finance-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-nf-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i -X POST "https://api.xiaomipetrolina.com.br/api/bling?resource=product-update-fiscal" --data "{}"`: `400 Bad Request`, `blingId required`.
- `curl -i -X POST "https://api.xiaomipetrolina.com.br/api/bling?resource=product-update-dimensions" --data "{}"`: `400 Bad Request`, `blingIds array and updateData required`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: `product-update-fiscal` e `product-update-dimensions` passam pelo VPS em staging, usam fallback de token salvo em `company_settings`, removem `estoque` antes do `PUT` e mantêm debug copiável sem corpo bruto ou tokens.

Pendências:

- validar atualização fiscal real apenas em produto de teste/controlado;
- validar atualização de dimensões real apenas em produto de teste/controlado;
- comparar resposta contra a Vercel antes do corte final;
- migrar webhooks e rotas auxiliares restantes.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521113351.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de Bling NFe/NFCe

Mudança: adicionados os recursos `nfe`, `nfce` e `nf-detail` ao `/api/bling` do Fastify na VPS.

Objetivo: mover para a VPS a listagem e consulta de detalhe de notas fiscais do Bling, preservando fallback para token salvo em `company_settings`.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-nf-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521112818.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521112818.bak`

Rotas afetadas:

- `/api/bling?resource=nfe`
- `/api/bling?resource=nfce`
- `/api/bling?resource=nf-detail&tipo=nfe&id=...`
- `/api/bling?resource=nf-detail&tipo=nfce&id=...`

Validação:

- `node tmp-tests/vps-bling-nf-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-finance-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-sync-prices-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-stock-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-stock-live-read-check.cjs`
- `node tmp-tests/vps-bling-product-detail-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-products-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shipping-fastify-static.test.mjs`
- `node tmp-tests/vps-seo-produto-fastify-static.test.mjs`
- `node tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/bling?resource=nf-detail"`: `400 Bad Request`, `tipo must be nfe or nfce`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: `nfe`, `nfce` e `nf-detail` passam pelo VPS em staging, preservam filtros de emissão (`dataEmissaoInicio/Fim` e nomes nativos do Bling), `situacao`, paginação e debug copiável sem segredos.

Pendências:

- validar listagem real com Authorization/token salvo em sessão/admin controlado;
- validar detalhe de NF-e/NFC-e real não-mutável;
- comparar resposta contra a Vercel antes do corte final;
- migrar atualizações fiscais/dimensões, webhooks e rotas auxiliares restantes.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521112818.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Deploy e validação staging de Bling finance

Mudança: adicionado o recurso `finance` ao `/api/bling` do Fastify na VPS.

Objetivo: mover para a VPS o proxy de Contas a Pagar/Receber do Bling, preservando ações de listagem, detalhe, criação, atualização, baixa e cancelamento.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-finance-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260520213350.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260520213350.bak`

Rotas afetadas:

- `/api/bling?resource=finance&resourceType=pagar`
- `/api/bling?resource=finance&resourceType=receber`

Validação:

- `node tmp-tests/vps-bling-finance-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-sync-prices-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-stock-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-product-detail-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-products-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shipping-fastify-static.test.mjs`
- `node tmp-tests/vps-seo-produto-fastify-static.test.mjs`
- `node tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/bling?resource=finance&resourceType=pagar&action=list"`: `401 Unauthorized`, `Missing Authorization header`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: `finance` passa pelo VPS em staging, exige Authorization do cliente, preserva `resourceType=pagar|receber`, filtros de vencimento/situação, `list/get/create/update/baixar/cancelar`, e debug copiável sem corpo financeiro bruto ou tokens.

Pendências:

- validar listagem real com Authorization válido em sessão/admin controlado;
- validar detalhe de conta real não-mutável;
- validar create/update/baixar/cancelar apenas em ambiente/controlado de teste;
- migrar NFe/NFCe, atualizações fiscais/dimensões, webhooks e rotas auxiliares restantes.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260520213350.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Deploy e validação staging de Bling reconcile

Mudança: adicionado o recurso `reconcile` ao `/api/bling` do Fastify na VPS.

Objetivo: mover para a VPS a reconciliação entre produtos locais mapeados por `bling_id`, produtos/saldos do Bling e atualização local de estoque/nome, mantendo suporte a `dryRun`.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260520210523.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260520210523.bak`

Rotas afetadas:

- `/api/bling?resource=reconcile`
- `/products/stock`
- `/products/name`

Validação:

- `node tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-sync-prices-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-stock-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-product-detail-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-products-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shipping-fastify-static.test.mjs`
- `node tmp-tests/vps-seo-produto-fastify-static.test.mjs`
- `node tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/bling?resource=reconcile&dryRun=true"`: `401 Unauthorized`, confirmando barreira de autorização sem executar reconciliação.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: `reconcile` passa pelo VPS em staging, exige autorização (`CRON_SECRET`, sync key ou cron user-agent), preserva `dryRun`, monta plano local, busca produtos/saldos do Bling, aplica estoque/nome quando autorizado e mantém sync para `/products/stock` e `/products/name`.

Pendências:

- executar `dryRun=true` real com segredo controlado;
- comparar totais e planned changes contra a Vercel;
- executar aplicação real apenas após revisar o plano;
- migrar `finance`, atualizações fiscais/dimensões e webhooks restantes.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260520210523.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Deploy e validação staging de Bling sync-prices-vps

Mudança: adicionado o recurso `sync-prices-vps` ao `/api/bling` do Fastify na VPS.

Objetivo: permitir que a própria VPS leia preço/estoque do Supabase em páginas de 50 produtos e sincronize para `/products/batch`, preservando vínculos Bling usados por webhooks e reconciliação.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-sync-prices-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260520204120.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260520204120.bak`

Rotas afetadas:

- `/api/bling?resource=sync-prices-vps&page=...`
- `/products/batch`

Validação:

- `node tmp-tests/vps-bling-sync-prices-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-stock-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-product-detail-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-products-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shipping-fastify-static.test.mjs`
- `node tmp-tests/vps-seo-produto-fastify-static.test.mjs`
- `node tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/bling?resource=sync-prices-vps&page=0"`: `405 Method Not Allowed`, confirmando rota sem executar sync real via GET.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: `sync-prices-vps` passa pelo VPS em staging, preserva paginação de 50 itens, `Range`/count do Supabase, campos `bling_id`, `bling_parent_id` e `parent_id`, e autenticação de `/products/batch` via sync key sem expor segredo em debug.

Pendências:

- executar sync real controlada com `POST` em página pequena;
- comparar resultado de uma página contra a Vercel;
- confirmar contagem e `hasMore/nextPage` em execução real;
- migrar `reconcile`, `finance`, atualizações fiscais/dimensões e webhooks restantes.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260520204120.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Deploy e validação staging de Bling stock/stock-sync

Mudança: adicionados os recursos `stock` e `stock-sync` ao `/api/bling` do Fastify na VPS.

Objetivo: permitir leitura de saldos do Bling pela VPS e preparar a baixa de estoque via `stock-sync`, preservando o contrato usado pelo PDV/pedidos.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-stock-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260520203451.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260520203451.bak`

Rotas afetadas:

- `/api/bling?resource=stock`
- `/api/bling?resource=stock&idsProdutos[]=...`
- `/api/bling?resource=stock-sync`

Validação:

- `node tmp-tests/vps-bling-stock-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-product-detail-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-products-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shipping-fastify-static.test.mjs`
- `node tmp-tests/vps-seo-produto-fastify-static.test.mjs`
- `node tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/bling?resource=stock"`: `401 Unauthorized`, `Missing Authorization header`.
- `curl -X POST -H "Host: staging.mercadodovale.com.br" -H "Content-Type: application/json" --data-raw "{}" "http://76.13.232.162/api/bling?resource=stock-sync"`: `400 Bad Request`, `blingId and quantity required`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: `stock` e `stock-sync` passam pelo VPS em staging, com validação de Authorization/payload, suporte a `idsProdutos[]`, normalização de 400 do Bling para `{ data: [] }`, baixa `operacao: 'S'` e debug copiável sem tokens.

Validação real posterior: `node tmp-tests/vps-bling-stock-live-read-check.cjs` confirmou `GET /api/bling?resource=stock&page=1` e `GET /api/bling?resource=stock&page=1&idsProdutos[]=<descoberto>` via VPS com saída sanitizada.

Pendências:

- validar baixa real com produto de teste e quantidade controlada;
- comparar `stock` e `stock-sync` contra a Vercel antes do corte final;
- migrar `sync-prices-vps`, `reconcile`, `finance`, atualizações fiscais/dimensões e webhooks restantes.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260520203451.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Deploy e validação staging de Bling product-detail

Mudança: adicionado o recurso `product-detail` ao `/api/bling` do Fastify na VPS.

Objetivo: permitir que a VPS busque detalhe completo de produto do Bling, incluindo variações e estoque normalizado, usando Authorization recebido ou token salvo em `company_settings` com refresh quando expirado.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-product-detail-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260520202945.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260520202945.bak`

Rotas afetadas:

- `/api/bling?resource=product-detail&id=...`
- `/api/bling?resource=product-detail&id=...&variacoes=1`

Validação:

- `node tmp-tests/vps-bling-product-detail-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-products-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shipping-fastify-static.test.mjs`
- `node tmp-tests/vps-seo-produto-fastify-static.test.mjs`
- `node tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/bling?resource=product-detail"`: `400 Bad Request`, `Product ID required`.
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/bling?resource=product-detail&id=0"`: `404 Not Found` retornado pelo Bling, confirmando proxy/autenticação até o upstream.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: `product-detail` passa pelo VPS em staging, preserva variações (`variacoes=1`), soma saldos do Bling em `stock_quantity` e não expõe tokens/client secret em debug copiável.

Pendências:

- validar detalhe real com um `id` Bling existente em sessão/admin controlado;
- comparar detalhe de produto e variação contra a Vercel;
- migrar `stock`, `stock-sync`, `sync-prices-vps`, `reconcile`, `finance`, atualizações fiscais/dimensões e webhooks restantes.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260520202945.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Deploy e validação staging de Bling categories/products

Mudança: adicionados os recursos `categories` e `products` ao `/api/bling` do Fastify na VPS.

Objetivo: mover para a VPS a listagem de categorias e a busca/listagem de produtos do Bling, preservando Authorization do cliente, busca por nome/SKU e fallback de busca solta.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-products-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260520202530.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260520202530.bak`

Rotas afetadas:

- `/api/bling?resource=categories`
- `/api/bling?resource=products`
- `/api/bling?resource=products&search=...`

Validação:

- `node tmp-tests/vps-bling-products-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shipping-fastify-static.test.mjs`
- `node tmp-tests/vps-seo-produto-fastify-static.test.mjs`
- `node tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/bling?resource=categories"`: `401 Unauthorized`, `Missing Authorization header`.
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/bling?resource=products&page=1"`: `401 Unauthorized`, `Missing Authorization header`.
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/bling?resource=products&search=cabo"`: `401 Unauthorized`, `Missing Authorization header`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: recursos `categories` e `products` passam pelo VPS em staging, mantendo o contrato de autorização e sem incluir Authorization em debug copiável.

Pendências:

- validar listagem real com token Bling válido em sessão/admin controlado;
- comparar busca direta e busca fallback contra a Vercel;
- migrar `product-detail`, `stock`, `stock-sync`, `sync-prices-vps`, `reconcile`, `finance` e webhooks restantes.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260520202530.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Deploy e validação staging de Bling OAuth/exchange

Mudança: criada e deployada a primeira fatia do Bling no Fastify da VPS, cobrindo callback OAuth e troca de token por `/api/bling?resource=exchange`.

Objetivo: tirar o callback OAuth do caminho da Vercel preservando os caminhos públicos atuais (`/api/auth/callback/bling` e `/api/bling`).

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `tmp-tests/vps-shipping-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260520201711.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260520201711.bak`

Rotas afetadas:

- `/api/auth/callback/bling`
- `/api/bling?resource=oauth-callback`
- `/api/bling?resource=exchange`

Validação:

- `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shipping-fastify-static.test.mjs`
- `node tmp-tests/vps-seo-produto-fastify-static.test.mjs`
- `node tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/auth/callback/bling"`: `302 Found`, `Location: /admin/settings/bling?error=missing_code`.
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/bling?resource=oauth-callback&error=access_denied"`: `302 Found`, `Location: /admin/settings/bling?error=access_denied`.
- `curl -X POST -H "Host: staging.mercadodovale.com.br" -H "Content-Type: application/json" --data-raw "{}" "http://76.13.232.162/api/bling?resource=exchange"`: `400 Bad Request`, `Missing client_id or client_secret`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: callback OAuth do Bling e endpoint de exchange respondem pela VPS em staging, com redirects preservados e sem expor `client_secret`/body bruto em payloads de debug.

Pendências:

- validar reconexão real com código OAuth válido do Bling;
- migrar recursos de produtos/detalhe/reconcile dentro de `/api/bling`;
- migrar e validar `/api/bling-webhook`;
- comparar comportamento com a Vercel antes do corte final.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260520201711.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Deploy e validação staging de `/api/shipping`

Mudança: criada e deployada a rota `/api/shipping` diretamente no Fastify da VPS.

Objetivo: remover a dependência da Vercel para cálculo/geração de frete mantendo o contrato usado pelo frontend (`provider` e `action` por query string).

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-shipping-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260520200921.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260520200921.bak`

Rotas afetadas:

- `/api/shipping?provider=frenet&action=calculate`
- `/api/shipping?provider=melhor-envio&action=calculate`
- `/api/shipping?provider=melhor-envio&action=label`

Validação:

- `node tmp-tests/vps-shipping-fastify-static.test.mjs`
- `node tmp-tests/vps-seo-produto-fastify-static.test.mjs`
- `node tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -X POST -H "Host: staging.mercadodovale.com.br" -H "Content-Type: application/json" --data-raw "{}" "http://76.13.232.162/api/shipping?provider=frenet&action=calculate"`: `400 Bad Request`, `Token Frenet nao fornecido`, debug copiável sem segredo.
- `curl -X POST -H "Host: staging.mercadodovale.com.br" -H "Content-Type: application/json" --data-raw "{}" "http://76.13.232.162/api/shipping?provider=melhor-envio&action=calculate"`: `400 Bad Request`, `Token do Melhor Envio nao fornecido`, debug copiável sem segredo.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: rota validada no staging com validação de payload, contratos de Frenet e Melhor Envio preservados, `User-Agent` do Melhor Envio mantido e debug copiável sem incluir tokens.

Pendências:

- validar cotação real com token Frenet em ambiente controlado;
- validar cotação real com token Melhor Envio em sandbox/produção controlada;
- validar fluxo de etiqueta Melhor Envio com pedido de teste;
- confirmar no navegador a cotação da PDP pelo staging.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260520200921.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Deploy e validação staging de `/api/seo-produto`

Mudança: criada e deployada a rota `/api/seo-produto` diretamente no Fastify da VPS para atender `/produto/:slug` via Nginx.

Objetivo: remover a dependência da Vercel para HTML SEO de produto antes do corte de DNS do site.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-seo-produto-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260520195648.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260520195648.bak`

Rotas afetadas:

- `/api/seo-produto`
- `/produto/:slug`

Validação:

- `node tmp-tests/vps-seo-produto-fastify-static.test.mjs`
- `node tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `node tmp-tests/vps-nginx-staging-config-static.test.mjs`
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/api/seo-produto?slug=abracadeira-nylon-enforca-gato-300x36mm-bom-5495`: `200 OK`, `Content-Type: text/html; charset=utf-8`.
- `curl -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/produto/abracadeira-nylon-enforca-gato-300x36mm-bom-5495`: `200 OK`, `Content-Type: text/html; charset=utf-8`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: rota validada no staging com HTML `text/html`, tags Open Graph de produto, canonical para `https://staging.mercadodovale.com.br/produto/...`, JSON-LD de `Product` e `BreadcrumbList`, cache `s-maxage=60, stale-while-revalidate=300`, busca MySQL por slug/UUID e fallback para `index.html` quando o produto não existir. Os metadados antigos da home (`og:type=website`, canonical da home e Twitter Card antigo) foram removidos antes da injeção. O preço no Schema.org mantém a convenção da base em centavos (`1790.00` -> `17.90`).

Pendências:

- validar outros slugs reais, incluindo produto sem imagem e produto com descrição longa;
- comparar HTML SEO da VPS contra o HTML atual da Vercel antes do corte final;
- validar visualmente no navegador quando o DNS/hosts de staging estiver configurado.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260520195648.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Preparação do deploy estático do frontend na VPS

Mudança: criado o primeiro fluxo de deploy do frontend para a VPS, ainda sem executar troca de DNS.

Objetivo: permitir subir o `dist/` do Vite para a VPS em releases versionados, com symlink `current` e `previous` para rollback.

Arquivos/infra alterados:

- `scripts/deploy-vps-site.cjs`
- `package.json`
- `tmp-tests/vps-site-deploy-script-static.test.mjs`
- `docs/superpowers/plans/2026-05-20-vps-staging-frontend.md`
- `migração_VPS.md`

Rotas afetadas:

- `/`
- `/admin/*`, indiretamente, por serem rotas SPA servidas pelo mesmo `dist/`

Validação:

- `node tmp-tests/vps-site-deploy-script-static.test.mjs`
- `npm run build`

Resultado: teste estático passou e build Vite passou. Produção atual não foi alterada.

Pendências:

- configurar variáveis `VPS_SITE_HOST`, `VPS_SITE_USER`, `VPS_SITE_PASSWORD` ou `VPS_SITE_PRIVATE_KEY`, e `VPS_SITE_ROOT`;
- executar `npm run deploy:vps-site`;
- configurar Nginx staging apontando para `${VPS_SITE_ROOT}/current`;
- validar staging no navegador.

Rollback: após primeiro deploy, o script imprimirá comando `rollback` usando symlink `previous`.

Próximo passo: preparar Nginx staging para servir `${VPS_SITE_ROOT}/current` com fallback SPA.

### 2026-05-20 - Preparação do Nginx staging para frontend VPS

Mudança: criado template Nginx para servir o frontend em `staging.mercadodovale.com.br`.

Objetivo: deixar a VPS pronta para servir `${VPS_SITE_ROOT}/current` com fallback SPA, cache longo para assets e reservas de proxy para `/api`, `/sitemap.xml` e `/produto/:slug`.

Arquivos/infra alterados:

- `infra/nginx/mdv-site-staging.conf`
- `tmp-tests/vps-nginx-staging-config-static.test.mjs`
- `migração_VPS.md`

Rotas afetadas:

- `/`
- `/admin/*`
- `/api/*`, como proxy reservado para Fastify local
- `/sitemap.xml`, como rota reservada antes do fallback SPA
- `/produto/:slug`, como rota reservada antes do fallback SPA

Validação:

- `node tmp-tests/vps-nginx-staging-config-static.test.mjs`
- `node tmp-tests/vps-site-deploy-script-static.test.mjs`

Resultado: testes estáticos passaram. Produção atual não foi alterada.

Pendências:

- instalar `infra/nginx/mdv-site-staging.conf` na VPS;
- habilitar site no Nginx;
- validar `nginx -t`;
- recarregar Nginx;
- apontar/criar DNS de staging, se ainda não existir;
- executar deploy do `dist/`;
- validar no navegador.

Rollback: remover/desabilitar o site staging do Nginx ou voltar symlink `current` para `previous`.

Próximo passo: instalar e validar o staging real na VPS.

### 2026-05-20 - Execução do deploy e instalação do Nginx staging na VPS

Mudança: executado o primeiro deploy real do frontend na VPS e instalado o site Nginx de staging.

Objetivo: validar que a VPS consegue servir o build Vite sem depender da Vercel, mantendo rollback por symlink.

Arquivos/infra alterados:

- `/var/www/mdv-site/releases/20260520-180705`
- `/var/www/mdv-site/current`
- `/var/www/mdv-site/previous`
- `/etc/nginx/sites-available/mdv-site-staging`
- `/etc/nginx/sites-enabled/mdv-site-staging`
- `migração_VPS.md`

Rotas afetadas:

- `/`
- `/admin/*`
- `/assets/*`

Validação:

- `nginx -t`: configuração válida.
- `systemctl reload nginx`: recarga executada.
- `curl -I -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/`: `200 OK`.
- `curl -I -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/admin/products`: `200 OK`, confirmando fallback SPA.
- `curl -I -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/assets/index-DgFecivF.js`: `200 OK` com `Cache-Control: public, max-age=31536000, immutable`.
- `curl -I -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/assets/index-DgIrOX85.css`: `200 OK` com `Cache-Control: public, max-age=31536000, immutable`.

Resultado: o frontend está servido pela VPS em staging via `Host` header. A produção atual não foi alterada e continua apontando para a Vercel.

Pendências:

- criar/apontar DNS `staging.mercadodovale.com.br` para `76.13.232.162`;
- validar no navegador usando o domínio de staging;
- validar login/admin no staging;
- iniciar migração das rotas `/api/*` para Fastify na VPS.

Rollback: apontar `/var/www/mdv-site/current` para `/var/www/mdv-site/previous` ou desabilitar `mdv-site-staging` no Nginx.

Próximo passo: criar o DNS de staging ou validar via arquivo `hosts`, depois começar pelo bloco `/api/vps-proxy`.

### 2026-05-20 - Preparação da rota Fastify `/api/vps-proxy`

Mudança: criada compatibilidade da rota `/api/vps-proxy` diretamente no Fastify da VPS.

Objetivo: remover a Vercel do caminho crítico do proxy admin/cliente sem mudar ainda o contrato usado pelo frontend.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `infra/nginx/mdv-site-staging.conf`
- `tmp-tests/vps-nginx-staging-config-static.test.mjs`
- `migração_VPS.md`

Rotas afetadas:

- `/api/vps-proxy`
- `/api/brasilapi-ncm`
- `/api/*` no Nginx staging

Validação:

- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `curl -i -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/api/status`: encontrou `502 Bad Gateway` antes da correção, indicando proxy Nginx apontando para porta incorreta.

Resultado: código da rota Fastify foi preparado e o problema de porta do Nginx staging foi identificado. Produção atual não foi alterada.

Pendências:

- aplicar Nginx staging corrigido para `127.0.0.1:4000`;
- fazer deploy da API (`vps_server.js`) na VPS;
- validar `/api/status`, `/api/vps-proxy?path=/status`, `/api/vps-proxy?path=/products&limit=1` e `/api/brasilapi-ncm?search=8517`;
- validar uma chamada admin real com sessão Supabase;
- documentar resultado da regressão depois do deploy.

Rollback: reverter `vps_server.js` na VPS pelo backup do deploy da API ou remover o site staging do Nginx.

Próximo passo: aplicar a correção do Nginx staging e fazer deploy controlado da API.

### 2026-05-20 - Deploy e validação staging de `/api/vps-proxy`

Mudança: aplicada a correção do Nginx staging para a porta real do Fastify (`127.0.0.1:4000`) e feito deploy manual da API VPS.

Objetivo: validar a rota `/api/vps-proxy` fora da Vercel, mantendo o mesmo contrato do frontend.

Arquivos/infra alterados:

- `/etc/nginx/sites-available/mdv-site-staging`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/services/vpsUploadPathPolicy.cjs`
- `/var/www/mdv-api/.codex-backups/20260520-184952`
- `migração_VPS.md`

Rotas afetadas:

- `/api/vps-proxy`
- `/api/brasilapi-ncm`
- `/api/*` no staging Nginx

Validação:

- `nginx -t`: configuração válida.
- `systemctl reload nginx`: recarga executada.
- `node --check /var/www/mdv-api/server.js`: sintaxe válida antes do restart.
- `pm2 restart mdv-api --update-env`: processo `mdv-api` online.
- `curl -i -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/vps-proxy?path=%2Fstatus"`: `200 OK`.
- `curl -i -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/vps-proxy?path=%2Fproducts%3Flimit%3D1"`: `200 OK`.
- `curl -i -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/brasilapi-ncm?search=8517"`: `200 OK`.
- `curl -i -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/vps-proxy?path=%2Fcompany-settings"` sem sessão: `403 Admin required`, confirmando bloqueio administrativo.
- `curl -i "https://api.xiaomipetrolina.com.br/status"`: `200 OK`, confirmando API atual online após restart.

Resultado: `/api/vps-proxy` e `/api/brasilapi-ncm` já funcionam no staging pela VPS. A validação com sessão admin real ainda precisa ser feita no navegador depois do DNS/hosts de staging.

Pendências:

- validar login/admin real usando o domínio de staging;
- testar uma escrita administrativa pequena e reversível;
- decidir se o frontend em staging deve forçar proxy local para todas as chamadas VPS;
- manter produção principal na Vercel até regressão de navegador.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/20260520-184952/server.js` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

Próximo passo: validar navegador com staging e seguir para `/api/bling` ou callbacks OAuth, mantendo Vercel fora do caminho novo.

### 2026-05-20 - Preparação da rota Fastify `/api/mercadopago-webhook`

Mudança: criada a rota `/api/mercadopago-webhook` diretamente no Fastify da VPS, substituindo o rewrite da Vercel que hoje despacha para o webhook do Bling.

Objetivo: receber notificações do Mercado Pago na VPS e validar o pagamento real pela API oficial antes de atualizar o pedido no Supabase.

Arquivos alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `migração_VPS.md`

Rotas afetadas:

- `/api/mercadopago-webhook`

Validação local:

- `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`

Debug copiável:

- Respostas de erro controlado retornam `debug` com `timestamp`, `operation`, `step`, `paymentId`, status upstream e mensagem bruta limitada.
- Tokens e chaves não são retornados no debug.

Pendências:

- fazer deploy da API VPS;
- validar `GET /api/mercadopago-webhook` em staging;
- validar `POST /api/mercadopago-webhook` com payload não-MP;
- validar payload MP simulado, sem atualizar pedido real;
- depois da validação, trocar status da rota para `vps-staging-validado-http`.

Rollback: restaurar o backup anterior de `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Deploy e validação staging de `/sitemap.xml`

Mudança: feito deploy manual da API VPS com a rota `/api/sitemap` e validação do proxy Nginx de `/sitemap.xml`.

Objetivo: comprovar que o sitemap público já pode sair da Vercel e ser servido pela VPS.

Arquivos/infra alterados:

- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/services/vpsUploadPathPolicy.cjs`
- `/var/www/mdv-api/.codex-backups/20260520193807`
- `migração_VPS.md`

Rotas afetadas:

- `/api/sitemap`
- `/sitemap.xml`

Validação:

- `node --check /var/www/mdv-api/server.js`: sintaxe válida antes do restart.
- `pm2 restart mdv-api --update-env`: processo `mdv-api` online.
- `curl -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/api/sitemap`: `200 OK`, `Content-Type: application/xml; charset=utf-8`.
- `curl -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/sitemap.xml`: `200 OK`, `Content-Type: application/xml; charset=utf-8`.
- Ambas as respostas retornaram `cache-control: s-maxage=3600, stale-while-revalidate=86400`.
- Ambas as respostas geraram 2131 entradas `<url>`.
- As URLs canônicas saíram com `https://staging.mercadodovale.com.br/...`, mesmo o teste HTTP passando pela VPS.
- `curl -i "https://api.xiaomipetrolina.com.br/status"`: `200 OK`, confirmando API atual online após restart.

Resultado: `/sitemap.xml` está validada no staging pela VPS. A rota filtra produtos com slug/nome, remove pais e itens `exclude_from_seo`, escapa XML e força HTTPS canônico fora de localhost.

Pendências:

- comparar quantidade de URLs com sitemap atual da Vercel antes do corte final;
- validar o sitemap de produção com `Host: mercadodovale.com.br` antes da troca DNS;
- decidir se duplicatas de slug devem ser limpas no banco ou deduplicadas na geração.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/20260520193807/server.js` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Deploy e validação staging de `/api/mercadopago-webhook`

Mudança: feito deploy manual da API VPS com a rota `/api/mercadopago-webhook`.

Objetivo: comprovar que o webhook do Mercado Pago já pode responder pela VPS em staging, com debug copiável em falhas controladas.

Arquivos/infra alterados:

- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/services/vpsUploadPathPolicy.cjs`
- `/var/www/mdv-api/.codex-backups/20260520191224`
- `migração_VPS.md`

Rotas afetadas:

- `/api/mercadopago-webhook`

Validação:

- `node --check /var/www/mdv-api/server.js`: sintaxe válida antes do restart.
- `pm2 restart mdv-api --update-env`: processo `mdv-api` online.
- `curl -i -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/mercadopago-webhook"`: `200 OK`.
- `curl --resolve staging.mercadodovale.com.br:80:76.13.232.162 -i -H "Content-Type: application/json" --data-raw "{\"type\":\"test\"}" "http://staging.mercadodovale.com.br/api/mercadopago-webhook"`: `200 OK`, `ignored`.
- `curl --resolve staging.mercadodovale.com.br:80:76.13.232.162 -i -H "Content-Type: application/json" --data-raw "{\"type\":\"payment\",\"data\":{\"id\":\"0\"}}" "http://staging.mercadodovale.com.br/api/mercadopago-webhook"`: `200 OK`, `payment lookup failed` com `debug` copiável.
- `curl -i "https://api.xiaomipetrolina.com.br/status"`: `200 OK`, confirmando API atual online após restart.

Resultado: `/api/mercadopago-webhook` está validada no staging pela VPS. O payload simulado não atualizou pedido real e retornou diagnóstico copiável com `timestamp`, `operation`, `step`, `paymentId`, status do Mercado Pago e mensagem bruta limitada.

Pendências:

- testar com uma notificação real do Mercado Pago em ambiente controlado;
- após regressão real, trocar o endpoint público do Mercado Pago para a rota VPS definitiva;
- decidir se o rewrite da Vercel será removido somente no corte final ou mantido temporariamente como compatibilidade.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/20260520191224/server.js` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Preparação da rota Fastify `/api/sitemap`

Mudança: criada a geração de sitemap diretamente no Fastify da VPS para atender `/sitemap.xml` via Nginx.

Objetivo: remover a dependência da Vercel para o sitemap público antes do corte de DNS do site.

Arquivos alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `tmp-tests/vps-site-deploy-runbook-static.test.mjs`
- `migração_VPS.md`

Rotas afetadas:

- `/api/sitemap`
- `/sitemap.xml`

Validação local:

- `node tmp-tests/vps-site-deploy-runbook-static.test.mjs`
- `node tmp-tests/vps-site-deploy-script-static.test.mjs`
- `node tmp-tests/vps-nginx-staging-config-static.test.mjs`
- `node tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`

Debug copiável:

- Falhas na geração retornam `debug` com `timestamp`, `operation`, `step` e `rawMessage`.
- O sitemap não retorna segredos nem dados sensíveis.

Pendências:

- fazer deploy da API VPS;
- validar `/api/sitemap` em staging;
- validar `/sitemap.xml` pelo Nginx staging;
- confirmar que URLs de produto aparecem com o host correto;
- depois da validação, trocar status da rota para `vps-staging-validado-http`.

Rollback: restaurar o backup anterior de `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.
