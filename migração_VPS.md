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
| `/` | Vercel static | VPS Nginx `dist/` | vps-staging-validado-http | frontend | pública | `curl -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/`; `node tmp-tests/vps-site-deploy-script-static.test.mjs`; `node tmp-tests/vps-nginx-staging-config-static.test.mjs`; `npm run build` | deploy executado na VPS em `/var/www/mdv-site/releases/20260520-180705`; Nginx staging instalado; DNS de staging ainda pendente |
| `/admin/*` | Vercel static | VPS Nginx `dist/` | vps-staging-validado-http | frontend/admin | Supabase auth no app | `curl -I -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/admin/products`; login + refresh direto em staging após DNS | fallback SPA validado via HTTP 200; falta validação no navegador com DNS ou hosts local |
| `/api/vps-proxy` | Vercel Function | VPS Fastify | vps-staging-validado-http | proxy/api | Supabase admin/customer + sync key | `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`; `node --check vps_server.js`; `node --check vps_server.cjs`; `curl /api/vps-proxy?path=/status`; `curl /api/vps-proxy?path=/products?limit=1`; `curl /api/vps-proxy?path=/company-settings` sem token | rota compatível criada, deployada e validada no staging; falta regressão com sessão admin real |
| `/api/bling` | Vercel Function | VPS Fastify | pendente | api/oauth | conforme `resource` | produtos, detalhe, reconcile, OAuth | preservar query `resource` |
| `/api/auth/callback/bling` | Vercel rewrite | VPS Fastify | pendente | oauth | callback externo | reconectar Bling | preservar URL pública |
| `/api/bling-webhook` | Vercel Function | VPS Fastify | pendente | webhook | segredo/validação quando disponível | payload Bling simulado | rota crítica |
| `/api/mercadopago-webhook` | Vercel rewrite | VPS Fastify | vps-staging-validado-http | webhook | validação Mercado Pago | `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`; `node --check vps_server.js`; `node --check vps_server.cjs`; `curl --resolve ... GET /api/mercadopago-webhook`; `curl --resolve ... POST payload não-MP`; `curl --resolve ... POST payment id=0` | rota Fastify deployada no staging; confirma pagamento real no Mercado Pago antes de atualizar pedido; debug copiável validado sem segredos |
| `/api/shopee` | Vercel Function | VPS Fastify | pendente | oauth/api | Shopee assinatura | OAuth Shopee | preservar callback |
| `/api/shopee-catalog` | Vercel Function | VPS Fastify | pendente | api | admin | listar categorias/atributos/upload | atenção a upload e timeout |
| `/api/shopee-actions` | Vercel Function | VPS Fastify | pendente | api | admin | pedidos/etiquetas/sync | atenção a assinatura Shopee |
| `/api/shopee-webhook` | Vercel Function | VPS Fastify | pendente | webhook | assinatura Shopee | payload Shopee simulado | preservar headers/body |
| `/api/shipping` | Vercel Function | VPS Fastify | pendente | api | admin/public conforme uso | cotação Melhor Envio | revisar tokens |
| `/api/telegram-webhook` | Vercel Function | VPS Fastify | pendente | webhook | token/segredo | payload Telegram simulado | se ativo |
| `/api/cron-dispatcher` | Vercel Cron/Function | VPS cron + Fastify/script | pendente | cron | `CRON_SECRET` | execução manual e log | substituir Vercel Cron |
| `/sitemap.xml` | Vercel rewrite/function | VPS Fastify via Nginx | vps-staging-validado-http | sitemap/seo | pública | `node tmp-tests/vps-sitemap-fastify-static.test.mjs`; `node --check vps_server.js`; `node --check vps_server.cjs`; `curl /api/sitemap`; `curl /sitemap.xml` | Nginx faz proxy para `/api/sitemap`; rota Fastify deployada e validada no staging com XML, cache, HTTPS canônico e debug copiável |
| `/produto/:slug` | Vercel rewrite/function | VPS Fastify via Nginx | pendente | seo | pública | HTML com OG/canonical | não pode cair só no SPA |
| `/api/brasilapi-ncm` | Vercel rewrite/proxy | VPS Fastify | vps-staging-validado-http | api/proxy | pública | `curl /api/brasilapi-ncm?search=8517`; `node tmp-tests/vps-proxy-fastify-route-static.test.mjs` | rota direta criada no Fastify, deployada e validada com cache |

## Registro de Mudanças

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
