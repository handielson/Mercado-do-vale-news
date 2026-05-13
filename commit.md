# Guia de Commit e Deploy

Atualizado em `24/04/2026`.

Este arquivo existe para evitar erro e retrabalho quando eu precisar comitar algo neste projeto de novo.

## Regra-mestra a partir de agora

Quando voce pedir para `comitar`, o entendimento padrao deve ser:

1. fazer o commit
2. fazer o `push`
3. se a mudanca precisar refletir no projeto web, garantir que ela chegue em `main` e verificar a Vercel
4. se a mudanca afetar runtime, servicos ou scripts da VPS, fazer tambem o deploy na VPS

Ou seja: **nao parar no commit local**, salvo se voce pedir explicitamente para parar antes.

## Estado atual do sistema

### Git

- branch local atual desta raiz: `master`
- `origin/master`: `7d4e0d0` — `docs(synology): add NAS recovery runbook`
- `origin/main`: `ca63f7e` — `docs(synology): add NAS recovery runbook`
- `origin/HEAD` aponta para `origin/main`

### Vercel

- projeto: `mercado-do-vale-news`
- branch que aciona deploy Git: `main`
- `master` **nao** gera deploy automatico na Vercel
- motivo: existe um [vercel.json](/C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/vercel.json:1) na raiz com:

```json
{
  "git": {
    "deploymentEnabled": {
      "master": false
    }
  }
}
```

- o ultimo deploy verificado da Vercel para o commit do `Synology.md` foi:
  - SHA: `ca63f7e46fc47dcd0f080b6fb1beb810350a6630`
  - mensagem: `docs(synology): add NAS recovery runbook`
  - branch: `main`
  - status verificado: `READY`

### Estrutura importante deste repositorio

- esta raiz nao e a branch de producao da Vercel
- o [package.json](/C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/package.json:1) da raiz e minimo e tem so `mysql2`
- por isso, empurrar commit apenas para `master` normalmente **nao** basta para aparecer na Vercel
- quando houver interesse em deploy web, o commit precisa chegar em `main`

### Estado do worktree no momento deste documento

- existem mudancas locais nao commitadas e arquivos soltos nesta raiz
- por isso, qualquer commit futuro precisa ser **sempre isolado por arquivo**
- se for necessario levar algo para `main` sem sujar o estado atual, o caminho mais seguro e usar um `git worktree` isolado

## Regra pratica para pedidos de commit

Quando voce pedir algo como:

- `vamos comitar o arquivo X`
- `comita isso`
- `sobe para a vercel`
- `precisa deploy na vps?`

eu devo seguir esta regra:

1. conferir o nome exato do arquivo
2. verificar se ele esta modificado, novo ou com diferenca de maiuscula/minuscula
3. stagear **somente** o(s) arquivo(s) pedido(s)
4. criar commit com mensagem objetiva
5. manter fora do commit qualquer mudanca paralela do worktree
6. fazer `push` depois do commit, por padrao
7. se a mudanca precisar aparecer no projeto web, garantir que o commit chegue em `main`
8. verificar se a Vercel criou o deployment esperado
9. confirmar se precisa ou nao deploy na VPS

## Como decidir o destino do commit

### Caso 1: commit sem impacto em Vercel ou VPS

Se o pedido for apenas algo como:

- guardar historico
- salvar documentacao
- registrar um arquivo interno

mesmo assim eu **nao** devo parar no commit local.

O padrao agora e:

- fazer commit
- fazer `push` para o remoto correto
- informar onde o commit ficou

Se nao houver impacto em Vercel nem em VPS, o fluxo termina depois do `push`.

### Caso 2: precisa aparecer na Vercel

Se o pedido implicar:

- site precisa refletir a mudanca
- "nao chegou na Vercel"
- "quero que deploye"
- producao web precisa receber a alteracao

entao o commit precisa chegar em `main`.

Se eu estiver em `master` com worktree sujo, o procedimento correto e:

1. criar um `git worktree` isolado apontando para `origin/main`
2. aplicar o commit desejado nesse worktree, normalmente com `cherry-pick`
3. dar `push origin main`
4. verificar se a Vercel criou o deployment

Importante:

- `push` para `master` sozinho nao atende esse caso
- so considero o fluxo completo quando o commit estiver em `main` e o deployment da Vercel tiver sido confirmado

## Como decidir se precisa deploy na VPS

### Nao precisa deploy na VPS

Normalmente **nao** precisa VPS quando a mudanca for apenas:

- documentacao
- markdown
- notas operacionais
- arquivos usados so para referencia humana

Exemplo:

- `Synology.md` **nao** exigiu deploy na VPS

### Precisa avaliar deploy na VPS

Precisa avaliar deploy na VPS quando a mudanca afetar codigo ou scripts realmente executados no servidor/VPS, por exemplo:

- `vps_server.js`
- `vps_server.cjs`
- servicos PM2
- jobs/cron rodando na VPS
- scripts de deploy para NAS/VPS
- endpoints ou processos que ja foram migrados para a VPS

Se a mudanca mexer nisso, eu nao devo assumir que so Git + Vercel resolvem.

### Regra nova para VPS

Se a mudanca impactar a VPS, o fluxo padrao nao termina em:

- commit
- push
- Vercel

Nesses casos, depois disso eu tambem preciso executar o deploy operacional da VPS ou deixar explicitamente registrado por que ele nao foi feito.

## Procedimento padrao quando voce pedir "comita X" de novo

### Fluxo seguro

1. conferir `git status`
2. localizar o arquivo exato pedido
3. ler o diff desse arquivo
4. stagear apenas esse arquivo
5. commitar com mensagem curta e especifica
6. informar o hash gerado
7. fazer `push` para o remoto apropriado
8. se houver necessidade de Vercel, garantir que o commit chegue em `main`
9. verificar o deployment da Vercel
10. se houver necessidade de VPS, executar tambem o deploy da VPS
11. informar com clareza onde o commit ficou, o status da Vercel e o status da VPS

### O que eu nao devo fazer

- nao incluir arquivos nao pedidos no commit
- nao assumir que `master` faz deploy na Vercel
- nao parar no commit local quando o pedido foi `comitar`
- nao deixar de fazer `push` por padrao
- nao deixar a Vercel sem verificacao quando a mudanca for do app web
- nao ignorar worktree sujo
- nao misturar documentacao com codigo nao relacionado no mesmo commit
- nao presumir deploy na VPS para arquivos de documentacao

## Observacoes praticas para este projeto

### Nome de arquivo importa

Neste caso houve diferenca entre o pedido e o arquivo real:

- pedido: `synology.md`
- arquivo real: `Synology.md`

Entao sempre preciso conferir o nome exato antes de stagear.

### Main e a branch importante para deploy web

Se o objetivo final for ver a mudanca no projeto da Vercel, a verificacao correta e:

- commit chegou em `origin/main`
- a Vercel criou deployment para esse SHA

Empurrar so para `origin/master` nao basta.

### Quando o worktree estiver sujo

Se houver muitas mudancas paralelas, o modo mais seguro e:

- fazer o commit isolado normalmente
- e, se for preciso levar para `main`, usar worktree separado

Isso evita quebrar ou incluir sem querer o que ja estava aberto localmente.

### Git e build sempre fora do sandbox

Neste projeto, por estar em pasta sincronizada pelo Synology Drive e por restricoes do sandbox, comandos de Git e build devem ser executados diretamente fora do sandbox com permissao aprovada. Nao perder tempo tentando primeiro dentro do sandbox quando o objetivo for stage, commit, push ou build de verificacao.

Casos ja observados:

- `git add` pode falhar ao criar `.git/index.lock` com `Permission denied`.
- `npm.cmd run build` pode falhar no sandbox com `Cannot read directory "../../../../..": Access is denied` e `Could not resolve vite.config.ts`.

Conduta correta:

1. para `git status`, `git diff`, `git add`, `git commit`, `git push` e `npm.cmd run build`, usar execucao aprovada fora do sandbox desde o inicio;
2. nao usar comandos destrutivos para resolver lock/permissao;
3. manter o escopo do commit isolado por arquivo;
4. conferir `git status`, `git diff --cached --name-only` e `git diff --cached --stat` antes do commit;
5. so entao commitar e fazer push conforme este guia.

Em resumo: para Git e build neste projeto, o caminho correto e pedir/usar execucao aprovada fora do sandbox, nao mudar o procedimento de commit nem incluir arquivos extras.

## Frase curta para eu seguir no futuro

Quando voce pedir para comitar de novo, a regra e:

`comitar so o que foi pedido, fazer push, levar para main quando precisar aparecer na Vercel, verificar o deployment, e fazer deploy na VPS quando a mudanca atingir a VPS.`
