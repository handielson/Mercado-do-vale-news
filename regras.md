# Regras Operacionais

Este arquivo registra regras fixas para evitar retrabalho em pontos sensiveis do projeto.

## Arquivos protegidos

### Webhook do Bling

Nao mexer no webhook do Bling sem pedido explicito.

Arquivos relacionados:

- `api/bling-webhook.ts`
- `api/bling.ts`, quando a mudanca envolver `resource=webhook`, `webhook-logs`, `sync-prices-vps` ou `reconcile`
- `bling.md`
- `docs/operacional/bling-webhook-precos.md`
- testes em `tmp-tests/bling-webhook-regressions.test.mjs`, `tmp-tests/bling-sync-prices-vps-regression.test.mjs` e `tmp-tests/external-integrations-total-stock-static.test.mjs`

Se houver pedido explicito para mexer no Bling, seguir processo cuidadoso:

1. ler `bling.md`;
2. entender o fluxo atual antes de alterar;
3. proteger nome, valor e estoque;
4. rodar os testes regressivos do Bling;
5. fazer build;
6. atualizar documentacao quando mudar contrato ou comportamento.

### Synology

Nao mexer em `Synology.md` sem pedido explicito.

Esse arquivo documenta recuperacao/operacao do NAS e nao deve entrar em commits acidentais.

## Commits

Quando for comitar, seguir obrigatoriamente o `commit.md`.

Regras resumidas:

- conferir `git status`;
- stagear somente os arquivos pedidos;
- nao misturar mudancas paralelas;
- criar commit objetivo;
- fazer push por padrao;
- se precisar refletir na Vercel, garantir que o commit chegue em `main`;
- verificar deploy quando aplicavel;
- avaliar deploy da VPS se a mudanca afetar runtime ou scripts da VPS.

## Sandbox

O ambiente de sandbox pode bloquear operacoes de Git e build, especialmente em pastas sincronizadas pelo Synology Drive.

Quando isso acontecer, nao tentar contornar com comandos destrutivos. Usar o fluxo descrito em `commit.md`: repetir o comando necessario com permissao aprovada fora do sandbox e manter o escopo isolado por arquivo.

## Proibicoes sem pedido explicito

### 1. Credenciais e ambientes

Nao alterar arquivos de credenciais ou ambiente sem pedido explicito.

Arquivos sensiveis:

- `.env`
- `.env.local`
- `.env.production`
- `.vercel/*`
- qualquer arquivo com token, chave, senha, segredo ou credencial operacional

Regras:

- pode ler somente quando for necessario para diagnostico;
- nunca imprimir secrets no chat ou em logs;
- nunca commitar credenciais;
- nunca trocar variavel de ambiente de producao por tentativa.

### 2. Deploy, VPS, NAS e servicos

Nao mexer em deploy, VPS, Synology/NAS, PM2, cron ou servicos sem pedido explicito.

Arquivos e areas sensiveis:

- `vps_server.cjs`
- scripts de deploy
- configuracoes PM2
- jobs/cron
- scripts de Synology/NAS
- endpoints ou processos ja migrados para a VPS

Se houver pedido explicito, registrar:

- o que foi alterado;
- como foi testado;
- se foi feito deploy;
- qual servico foi reiniciado, quando aplicavel.

### 3. Endpoints publicos e contratos

Nao alterar endpoints publicos, webhooks ou contratos de payload sem atualizar a documentacao relacionada.

Exemplos:

- `api/*`
- rotas da VPS;
- webhooks;
- payloads de Bling, Shopee, Mercado Pago ou catalogo;
- contratos entre Supabase, Vercel e VPS.

Se o contrato mudar, atualizar o runbook correspondente, como `bling.md`, `commit.md`, `regras.md` ou docs em `docs/operacional`.

### 4. Arquivos gerados, temporarios e grandes

Nao commitar arquivos gerados ou temporarios sem pedido explicito.

Exemplos:

- `.codex-*.log`
- `.codex-*.err.log`
- `dist/`
- `tmp-video-frames/`
- caches locais;
- arquivos temporarios de teste;
- videos ou midias grandes em `public/videos/`;
- assets gerados sem relacao direta com a tarefa.

### 5. Stage e commit

Nunca usar `git add .` neste projeto.

Regras:

- sempre stagear por arquivo: `git add -- arquivo1 arquivo2`;
- antes de commitar, conferir `git diff --cached --name-only`;
- conferir tambem `git diff --cached --stat`;
- nunca incluir mudancas paralelas no mesmo commit;
- seguir sempre `commit.md`.

### 6. Estoque, preco, vendas e integracoes comerciais

Nao mexer em estoque, preco, venda, carrinho, PDV, Bling, Shopee ou VPS comercial sem teste regressivo.

Areas sensiveis:

- Bling;
- Shopee;
- PDV;
- carrinho;
- vendas;
- estoque;
- sincronizacao com VPS;
- precos em centavos/reais;
- webhooks de pagamento.

Antes de concluir, rodar os testes relacionados ao fluxo alterado e registrar quais foram executados.

### 7. Banco, migrations e novas funcoes

Nao alterar migrations, schemas ou SQL sem plano e sem pedido explicito.

Arquivos sensiveis:

- `supabase/*.sql`
- migrations;
- funcoes SQL;
- triggers;
- views;
- politicas/RLS;
- schemas.

Regra principal: qualquer nova funcao operacional gerada deve ser implementada na VPS, nao no Supabase.

Usar Supabase para nova funcao somente se o pedido for explicito ou se houver justificativa tecnica registrada antes da alteracao.

Quando houver mudanca de banco, deixar claro:

- se a migration foi apenas criada;
- se foi aplicada;
- em qual ambiente foi aplicada;
- como validar rollback ou impacto.

### 8. Documentos de regra e runbooks

Nao alterar `Synology.md`, `bling.md`, `commit.md` ou `regras.md` junto com codigo, salvo pedido explicito.

Esses documentos devem ir em commit separado quando forem apenas regra, runbook ou documentacao operacional.

### 9. Comandos destrutivos

Nao executar comandos destrutivos sem pedido explicito.

Exemplos proibidos por padrao:

- `git reset --hard`
- `git checkout -- arquivo`
- `git clean`
- `rm -rf`
- apagar branches;
- apagar arquivos de usuario;
- limpar cache/pasta de build com remocao recursiva;
- reverter mudancas locais sem confirmacao.

Se for realmente necessario, explicar o alvo exato e pedir aprovacao antes.

### 10. Shopee

Nao mexer em Shopee sem olhar a documentacao/logs relacionados.

Areas frageis:

- variacoes;
- estoque;
- GTIN;
- imagens;
- video;
- marca;
- categoria;
- payload de publicacao;
- fallback de item base + `init_tier_variation`.

Qualquer ajuste em Shopee precisa conferir payload enviado e resposta recebida.

### 11. Formato de preco

Nao mudar formato de preco por suposicao.

Regras atuais:

- local/Supabase/VPS: preco em centavos, exemplo `1499`;
- Bling: preco em reais, exemplo `14.99`;
- Shopee: seguir o contrato da Shopee no payload especifico;
- exibicao: formatar para real apenas na camada de UI/relatorio.

Toda conversao de preco precisa ser explicita e testada.

### 12. Producao e deploy

Nao assumir que producao atualizou so porque houve commit ou push.

Regras:

- se for web, confirmar que chegou em `origin/main`;
- se for Vercel, verificar deploy quando possivel;
- se for VPS, confirmar deploy, servico e endpoint;
- se a verificacao for recusada ou impossivel, registrar isso claramente.
