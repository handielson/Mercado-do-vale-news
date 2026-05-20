# Estudo: remover Vercel e hospedar o Mercado do Vale na VPS

Data: 2026-05-20

## Objetivo

Tirar o projeto totalmente da Vercel e deixar o site principal `mercadodovale.com.br` hospedado na VPS, mantendo a VPS como ponto unico para:

- servir o frontend React/Vite;
- responder as rotas `/api/*`;
- receber webhooks;
- executar rotinas agendadas;
- manter proxy seguro para rotas administrativas;
- preservar SEO de produto e sitemap.

Este estudo trata de sair da Vercel. Ele nao remove Supabase, Bling, Shopee, Mercado Pago, Synology ou Cloudflare; esses continuam sendo dependencias externas enquanto nao forem migrados em projetos separados.

## Estado atual encontrado

### Frontend

O projeto e um app React/Vite.

- Build: `npm run build`
- Saida estatica: `dist/`
- Entrada SPA: `index.html`
- Roteamento client-side via React Router.

Hoje a Vercel serve o `dist` e usa rewrites para mandar rotas do app para `index.html`.

### Vercel

Arquivo relevante: `vercel.json`.

Uso atual da Vercel:

- Static hosting do frontend.
- Serverless functions em `api/*.ts`.
- Rewrite de SPA: `/(qualquer coisa)` para `/index.html`.
- Rewrite SEO de produto: `/produto/:slug` para `/api/seo-produto?slug=:slug`.
- Rewrite sitemap: `/sitemap.xml` para `/api/sitemap`.
- Rewrite Bling OAuth: `/api/auth/callback/bling` para `/api/bling?resource=oauth-callback`.
- Rewrite Mercado Pago: `/api/mercadopago-webhook` para `/api/bling-webhook`.
- Rewrite BrasilAPI NCM: `/api/brasilapi-ncm` para `/api/vps-proxy?brasilapi=ncm`.
- Cron diario: `/api/cron-dispatcher` as 22:00.

### VPS atual

Ja existe API Fastify grande na VPS.

Arquivos relevantes:

- `vps_server.cjs`
- `vps_server.js`
- `server.js`
- `deploy.cjs`
- `deploy_vps_server.cjs`
- `.env.vps.example`

Dominio/API atual:

- `api.xiaomipetrolina.com.br` aponta para a VPS `76.13.232.162`.
- `mercadodovale.com.br` ainda aponta para a infraestrutura da Vercel.

Servidor atual:

- Fastify em `PORT`, documentado como `3001` no exemplo de env.
- PM2 roda a API em `/var/www/mdv-api`.
- A API ja serve uploads em `/images/*`.
- A API ja possui muitas rotas de catalogo, produtos, marcas, categorias, imagens, banners, company settings, shipping, coupons, favoritos, Synology, autoresponder etc.

O que ainda nao esta pronto para substituir a Vercel:

- servir `dist/` do frontend pelo mesmo Fastify ou por Nginx;
- converter/copiar as rotas `api/*.ts` da Vercel para Fastify;
- configurar Nginx para dominio principal;
- trocar DNS do dominio principal para a VPS;
- substituir Vercel Cron por cron/PM2/systemd timer na VPS;
- revisar callbacks externos configurados em Bling, Shopee, Mercado Pago e Telegram.

## Inventario das rotas Vercel

### Rotas criticas

Estas precisam migrar antes de apontar o dominio para a VPS.

| Rota atual | Arquivo | Funcao | Plano na VPS |
| --- | --- | --- | --- |
| `/api/vps-proxy` | `api/vps-proxy.ts` | Proxy seguro do frontend para a VPS; injeta `x-sync-key`; valida admin/customer via Supabase | Recriar como rota Fastify ou eliminar se frontend falar direto com a mesma origem |
| `/api/bling` | `api/bling.ts` | Bling OAuth, produtos, categorias, estoque, detalhes, reconcile, sync de modelo/marca, sync de precos | Migrar para Fastify mantendo `resource` por query para compatibilidade |
| `/api/bling-webhook` | `api/bling-webhook.ts` | Webhook Bling e Mercado Pago via rewrite | Migrar para Fastify; preservar URL publica |
| `/api/shopee` | `api/shopee.ts` | OAuth/callback Shopee | Migrar para Fastify; preservar callback configurado na Shopee |
| `/api/shopee-catalog` | `api/shopee-catalog.ts` | Catalogo Shopee, assinatura, upload imagem/video, variacoes | Migrar para Fastify; atencao a body limit/upload |
| `/api/shopee-actions` | `api/shopee-actions.ts` | Pedidos, etiquetas, sincronizacoes, publicar item | Migrar para Fastify |
| `/api/shopee-webhook` | `api/shopee-webhook.ts` | Webhook Shopee | Migrar para Fastify; conferir assinatura |
| `/api/shipping` | `api/shipping.ts` | Melhor Envio | Migrar para Fastify |
| `/api/telegram-webhook` | `api/telegram-webhook.ts` | Telegram bot/webhook | Migrar para Fastify |
| `/api/cron-dispatcher` | `api/cron-dispatcher.ts` | Rotina agendada diaria | Migrar para script/rota interna executada por cron |

### Rotas de SEO/publicacao

Estas afetam indexacao, compartilhamento e paginas publicas.

| Rota atual | Arquivo | Funcao | Plano na VPS |
| --- | --- | --- | --- |
| `/sitemap.xml` | `api/sitemap.ts` | Gera sitemap com produtos da VPS | Migrar para Fastify ou gerar arquivo estatico periodicamente |
| `/produto/:slug` | `api/seo-produto.ts` | HTML SSR simples para SEO/OG antes de cair no SPA | Migrar para Fastify ou Nginx + rota Fastify |
| `/api/brasilapi-ncm` | `api/vps-proxy.ts` | Proxy BrasilAPI NCM com cache | Criar rota Fastify dedicada, ex: `/api/brasilapi-ncm` |

### Bibliotecas compartilhadas

Arquivos em `api/_lib` devem ir junto:

- `api/_lib/bling-price-targets.js`
- `api/_lib/bling-reconcile-core.js`
- `api/_lib/mp-webhook-core.js`
- `api/_lib/shopee-stock-sync.js`

## Estrategia recomendada

### Decisao tecnica principal

Recomendacao: usar Nginx na frente e Fastify atras.

Nginx:

- termina HTTPS;
- serve `dist/` do frontend;
- faz cache e compressao de arquivos estaticos;
- encaminha `/api/*`, `/images/*`, `/video/*`, webhooks e SEO dinamico para Fastify;
- aplica fallback SPA para `index.html`.

Fastify:

- continua como `mdv-api` no PM2;
- recebe rotas de API;
- recebe webhooks;
- recebe rotas SEO dinamicas;
- executa rotas internas protegidas;
- continua servindo uploads se mantivermos `/images/*` nele.

Motivo: separar arquivo estatico de API reduz risco. O Fastify pode servir tudo, mas Nginx e mais robusto para dominio, SSL, cache e fallback.

## Plano de migracao por fases

### Fase 0 - Preparacao e inventario

1. Confirmar processo PM2 atual:
   - nome do app;
   - diretorio real;
   - porta interna;
   - `.env` carregado;
   - logs.

2. Confirmar Nginx/Apache na VPS:
   - se ja existe;
   - quais sites estao configurados;
   - porta usada pelo `api.xiaomipetrolina.com.br`;
   - certificados existentes.

3. Separar variaveis de ambiente:
   - frontend build-time: `VITE_*`;
   - backend runtime: `SUPABASE_*`, `VPS_SYNC_KEY`/`SYNC_SECRET`, Bling, Shopee, Mercado Pago, Google, Telegram, Synology.

4. Remover dependencias de Vercel do desenho:
   - substituir `vercel.json`;
   - nao depender de Vercel Cron;
   - nao depender de Vercel rewrites;
   - nao depender de Vercel env vars.

### Fase 1 - Hospedar o frontend na VPS sem trocar DNS ainda

1. Criar diretorio:

```bash
/var/www/mdv-site/current
```

2. Build local ou na VPS:

```bash
npm ci
npm run build
```

3. Enviar `dist/` para:

```bash
/var/www/mdv-site/current
```

4. Criar host de teste, antes de mexer no dominio principal:

```text
vps.mercadodovale.com.br
```

ou usar subdominio temporario:

```text
staging.mercadodovale.com.br
```

5. Configurar Nginx para SPA:

```nginx
server {
    server_name staging.mercadodovale.com.br;
    root /var/www/mdv-site/current;
    index index.html;

    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Resultado esperado: o app abre na VPS, mas ainda pode chamar APIs na Vercel se nao alterarmos nada.

### Fase 2 - Migrar `/api/vps-proxy`

Esta e a rota mais importante para o app administrativo.

Hoje o frontend chama `/api/vps-proxy?path=/...`. A Vercel valida usuario via Supabase e injeta `x-sync-key` para a VPS.

Opcoes:

1. Manter compatibilidade:
   - criar `fastify.all('/api/vps-proxy')`;
   - reaproveitar logica de `api/vps-proxy.ts`;
   - proxyar internamente para rotas da propria Fastify ou para `api.xiaomipetrolina.com.br`.

2. Simplificar:
   - trocar frontend para chamar rotas da mesma origem direto;
   - mover validacao admin/customer para middlewares Fastify;
   - eliminar proxy intermediario.

Recomendacao para primeira migracao: manter compatibilidade. E menos invasivo e reduz risco.

Depois, numa fase de limpeza, eliminar `/api/vps-proxy`.

### Fase 3 - Migrar rotas Bling

Rotas:

- `/api/auth/callback/bling`
- `/api/bling?resource=...`
- `/api/bling-webhook`
- `/api/mercadopago-webhook`

Tarefas:

1. Criar plugin Fastify `routes/bling.cjs` ou migrar para dentro de `vps_server.cjs` temporariamente.
2. Adaptar handler Vercel `(req, res)` para Fastify `(request, reply)`.
3. Preservar query `resource` para nao quebrar frontend.
4. Preservar redirects do OAuth Bling.
5. Preservar webhooks:
   - Bling;
   - Mercado Pago via alias `/api/mercadopago-webhook`.
6. Atualizar `scripts/bling-reconcile-cron.sh`, que hoje aponta para `https://www.mercadodovale.com.br/api/bling?resource=reconcile`.

Risco especial:

- Webhooks podem precisar de raw body ou assinatura. Confirmar antes de trocar.
- OAuth precisa que o callback cadastrado no Bling continue igual ou seja atualizado no painel Bling.

### Fase 4 - Migrar Shopee

Rotas:

- `/api/shopee`
- `/api/shopee-catalog`
- `/api/shopee-actions`
- `/api/shopee-webhook`

Tarefas:

1. Migrar funcoes de assinatura HMAC.
2. Garantir suporte a upload grande para imagem/video.
3. Garantir timeout adequado; rotas de video podem demorar mais que uma serverless normal.
4. Preservar callback Shopee:

```text
https://www.mercadodovale.com.br/api/shopee
```

ou atualizar no painel Shopee se a rota mudar.

Risco especial:

- Shopee costuma ser sensivel a callback URL, timestamp e assinatura.
- Melhor manter o mesmo dominio e caminho publico.

### Fase 5 - Migrar SEO e sitemap

Rotas:

- `/produto/:slug`
- `/sitemap.xml`

Nginx deve encaminhar essas rotas antes do fallback SPA:

```nginx
location = /sitemap.xml {
    proxy_pass http://127.0.0.1:3001/api/sitemap;
}

location ~ ^/produto/([^/]+)$ {
    proxy_pass http://127.0.0.1:3001/api/seo-produto?slug=$1;
}
```

Alternativa melhor para sitemap:

- gerar `sitemap.xml` em arquivo a cada hora/dia;
- servir estatico pelo Nginx;
- reduz carga e dependencia de runtime.

### Fase 6 - Cron

Substituir Vercel Cron.

Atual:

```json
{
  "path": "/api/cron-dispatcher",
  "schedule": "0 22 * * *"
}
```

Na VPS:

```cron
0 22 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://www.mercadodovale.com.br/api/cron-dispatcher >> /var/log/mdv-cron.log 2>&1
```

Melhor ainda:

- transformar `api/cron-dispatcher.ts` em script Node executado localmente;
- evitar HTTP para cron interno;
- logar em arquivo;
- monitorar saida.

### Fase 7 - Trocar DNS do dominio principal

Estado atual documentado:

- `mercadodovale.com.br` aponta para `76.76.21.21`, que e Vercel.
- `api.xiaomipetrolina.com.br` aponta para `76.13.232.162`, que e VPS.

Troca:

```text
A mercadodovale.com.br -> 76.13.232.162
CNAME www -> mercadodovale.com.br
```

Antes de trocar:

- site staging testado;
- APIs migradas;
- webhooks testados;
- SSL pronto;
- rollback definido.

Rollback:

- voltar DNS para Vercel;
- manter Vercel sem remover por alguns dias;
- TTL baixo antes da troca.

## Configuracao Nginx alvo

Exemplo base:

```nginx
server {
    listen 80;
    server_name mercadodovale.com.br www.mercadodovale.com.br;
    return 301 https://www.mercadodovale.com.br$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.mercadodovale.com.br;

    root /var/www/mdv-site/current;
    index index.html;

    client_max_body_size 500M;

    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location /images/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
    }

    location /video/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_read_timeout 300s;
    }

    location = /sitemap.xml {
        proxy_pass http://127.0.0.1:3001/api/sitemap;
        proxy_set_header Host $host;
    }

    location ~ ^/produto/([^/]+)$ {
        proxy_pass http://127.0.0.1:3001/api/seo-produto?slug=$1;
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Esse exemplo precisa ser ajustado conforme porta real do PM2 e certificados existentes.

## Mudancas necessarias no codigo

### Backend

1. Criar adaptador Fastify para handlers Vercel.

Os arquivos `api/*.ts` usam padrao Vercel:

```ts
export default async function handler(req, res) {}
```

Fastify usa:

```js
fastify.all('/api/rota', async (request, reply) => {})
```

Opcao rapida:

- portar manualmente cada arquivo critico.

Opcao mais organizada:

- criar modulos `server/routes/*.cjs`;
- deixar `vps_server.cjs` importar e registrar rotas;
- evitar continuar aumentando um arquivo unico de quase 9 mil linhas.

### Frontend

1. Garantir que as chamadas continuem relativas:

```text
/api/...
```

2. Revisar `services/vpsTransport.js` e `services/vpsProxyBase.ts`.

Hoje em producao ele tende a usar:

```text
/api/vps-proxy
```

Isso pode continuar se a rota existir na VPS.

3. Revisar `SHOPEE_REDIRECT_BASE_URL`.

Deve continuar:

```text
https://www.mercadodovale.com.br
```

### Deploy

Criar scripts separados:

1. `deploy:vps-api`
   - envia `vps_server.js`;
   - envia rotas auxiliares;
   - reinicia PM2.

2. `deploy:vps-site`
   - roda build;
   - envia `dist/`;
   - troca symlink `current`;
   - recarrega Nginx se necessario.

3. `deploy:vps-all`
   - API + site.

## Variaveis de ambiente a levar para VPS

Sem valores reais no documento.

### Build frontend

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_DEV_MODE=false`
- `VITE_VPS_SYNC_KEY`
- `VITE_VPS_BASE_URL`
- `VITE_API_PROXY_TARGET`, se ainda usar em dev
- `SHOPEE_REDIRECT_BASE_URL`

### Runtime backend

- `PORT`
- `NODE_ENV=production`
- `DB_HOST`
- `DB_USER`
- `DB_PASS`
- `DB_NAME`
- `SYNC_SECRET`
- `VPS_SYNC_KEY` ou padronizar com `SYNC_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`, se algum fluxo ainda exigir
- `BLING_CLIENT_ID`
- `BLING_CLIENT_SECRET`
- `BLING_WEBHOOK_SECRET`, se for ativado
- `CRON_SECRET`
- `SHOPEE_ENV`
- credenciais Shopee se nao vierem apenas do Supabase
- Mercado Pago webhook/config, se usado
- Telegram webhook/config, se usado
- Synology vars ja documentadas em `.env.vps.example`
- Google Contacts vars ja documentadas em `.env.vps.example`

Observacao: hoje ha mistura entre `VITE_VPS_SYNC_KEY`, `VPS_SYNC_KEY` e `SYNC_SECRET`. Vale padronizar para:

- frontend: `VITE_VPS_SYNC_KEY`;
- backend: `SYNC_SECRET`;
- compatibilidade temporaria: aceitar tambem `VPS_SYNC_KEY`.

## Riscos principais

1. Webhooks externos
   - Bling, Shopee, Mercado Pago e Telegram podem parar se callback mudar ou se Nginx nao encaminhar body/headers corretamente.

2. OAuth
   - Bling e Shopee precisam callback publico exato.

3. SEO
   - `/produto/:slug` hoje nao e apenas SPA; tem HTML dinamico para crawlers/OG.
   - Se isso virar apenas `index.html`, compartilhamento e indexacao podem piorar.

4. Proxy/admin
   - `/api/vps-proxy` hoje protege writes com validacao admin via Supabase.
   - Se remover sem substituir, abre risco de operacoes administrativas expostas.

5. Cache
   - assets do Vite podem ser cacheados por 1 ano;
   - `index.html` nao deve ficar cacheado por muito tempo;
   - imagens podem ter politica propria.

6. Tamanho de upload
   - Shopee video, Synology video e uploads precisam `client_max_body_size` alto e timeouts maiores.

7. Logs e observabilidade
   - Vercel dava logs por deploy.
   - Na VPS precisa PM2 logs, Nginx access/error logs, cron logs e rotina de limpeza.

## Checklist de validacao antes da troca de DNS

### Site

- [ ] `/` abre na VPS.
- [ ] `/admin/products` abre apos login.
- [ ] `/admin/settings/bling` abre.
- [ ] `/admin/settings/shopee` abre.
- [ ] `/produto/algum-slug-real` retorna HTML com tags SEO/OG.
- [ ] `/sitemap.xml` retorna XML valido.
- [ ] refresh direto em rota interna nao da 404.

### API

- [ ] `/api/vps-proxy?path=/products&limit=1` funciona.
- [ ] writes administrativos continuam exigindo auth/admin.
- [ ] `/api/bling?resource=products` funciona.
- [ ] `/api/bling?resource=product-detail` funciona.
- [ ] `/api/bling-webhook` responde.
- [ ] `/api/shopee-catalog?action=...` funciona nas consultas principais.
- [ ] `/api/shipping` funciona.
- [ ] `/api/brasilapi-ncm` funciona.

### Integracoes

- [ ] Bling OAuth reconecta.
- [ ] Bling webhook chega.
- [ ] Shopee OAuth reconecta.
- [ ] Shopee APIs assinadas funcionam.
- [ ] Mercado Pago webhook chega.
- [ ] Telegram webhook chega, se estiver ativo.
- [ ] Cron diario executa e deixa log.

### Infra

- [ ] HTTPS valido para `mercadodovale.com.br`.
- [ ] HTTPS valido para `www.mercadodovale.com.br`.
- [ ] Redirecionamento apex/www decidido.
- [ ] Nginx reload sem erro.
- [ ] PM2 restart sem erro.
- [ ] Logs acessiveis.
- [ ] Backup do config antigo.
- [ ] Rollback DNS documentado.

## Estimativa de esforco

### Caminho minimo seguro

1. Servir frontend na VPS em staging: baixo risco.
2. Migrar `/api/vps-proxy`: medio risco.
3. Migrar SEO/sitemap: medio risco.
4. Migrar Bling: alto risco.
5. Migrar Shopee: alto risco.
6. Migrar shipping/telegram/cron: medio risco.
7. Trocar DNS: alto impacto, mas baixo risco se tudo acima estiver testado.

Estimativa tecnica: 3 a 6 ciclos de trabalho, dependendo de testes com credenciais reais e webhooks.

### Caminho mais rapido, mas menos limpo

Portar handlers Vercel quase iguais para Fastify dentro do `vps_server.cjs`, manter rotas e queries iguais, e trocar DNS depois.

Vantagem:

- menos mudanca no frontend;
- migra mais rapido.

Desvantagem:

- `vps_server.cjs` fica ainda maior;
- manutencao pior;
- mais dificil testar isolado.

### Caminho recomendado

1. Criar `server/routes` aos poucos.
2. Migrar rotas por modulo.
3. Criar staging na VPS.
4. Testar com dominio temporario.
5. Trocar DNS so no fim.

## Sequencia recomendada de execucao

1. Criar staging do frontend na VPS.
2. Criar Nginx para staging.
3. Criar rota Fastify `/api/vps-proxy` compativel.
4. Apontar build staging para usar a propria origem.
5. Migrar `/api/sitemap` e `/api/seo-produto`.
6. Migrar Bling.
7. Migrar Shopee.
8. Migrar shipping, Telegram e cron.
9. Rodar checklist.
10. Baixar TTL DNS.
11. Apontar `mercadodovale.com.br` e `www` para VPS.
12. Monitorar logs por 24 a 72 horas.
13. So depois remover Vercel do fluxo.

## Definicao de pronto

Considerar "fora da Vercel" somente quando:

- Vercel nao recebe trafego do dominio principal;
- nenhum webhook externo aponta para Vercel;
- nenhum OAuth callback aponta para Vercel;
- cron roda na VPS;
- frontend e APIs rodam na VPS;
- deploy novo nao usa `npx vercel`;
- rollback esta documentado e testado.

