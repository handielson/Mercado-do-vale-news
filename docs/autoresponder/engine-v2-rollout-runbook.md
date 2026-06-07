# Runbook De Rollout Do Engine V2

## Objetivo

Manter `AUTORESPONDER_ENGINE_V2=1` na VPS de forma reversivel, validar produto e compra pelo motor novo e so entao liberar a remocao dos fallbacks legados.

## Regra De Seguranca

Nao remover `if (!isAutoresponderEngineV2Enabled()) return null;` de produto/compra nem blocos `purchaseFlow.status === ...` antes de validar uma rodada real de atendimento em producao.

## Pre-check Local

```powershell
node --check vps_server.js
node --check vps_server.cjs
node --check server.js
node tmp-tests\autoresponder-engine-v2-rollout-static.test.mjs
node tmp-tests\autoresponder-core-scenarios.cjs
npm.cmd run build
```

## Dry-run Da Flag Na VPS

```powershell
node tools\set-autoresponder-engine-v2-vps.cjs
```

Esperado:

- Mostra o app PM2 alvo.
- Mostra o caminho remoto do `.env`.
- Mostra o valor atual de `AUTORESPONDER_ENGINE_V2`.
- Nao grava arquivo e nao reinicia PM2.

## Ativacao Controlada

```powershell
$env:AUTORESPONDER_ENGINE_V2_APPLY="1"
$env:AUTORESPONDER_ENGINE_V2_VALUE="1"
node tools\set-autoresponder-engine-v2-vps.cjs
```

Esperado:

- Cria backup remoto `.env.autoresponder-engine-v2-*.bak`.
- Atualiza `AUTORESPONDER_ENGINE_V2="1"`.
- Executa `pm2 restart <app> --update-env`.

Observacao: em 2026-06-07 a flag ja estava ativa na VPS. Repetir esta etapa somente se o dry-run mostrar valor diferente de `1`.

## Validacao Pos-ativacao

```powershell
curl.exe -i -s "https://api.xiaomipetrolina.com.br/health"
node tmp-tests\autoresponder-core-scenarios.cjs
```

Depois dos cenarios automaticos, validar uma conversa real controlada.

## Rodada Real Controlada

Use um remetente controlado, de preferencia um telefone de teste da equipe sem conversa ativa. Antes de iniciar, registre:

- Ambiente: producao.
- URL/API usada.
- App PM2 alvo.
- Commit/deploy ativo, quando disponivel.
- Data/hora de inicio.
- Timezone.
- Remetente usado.
- Valor atual de `AUTORESPONDER_ENGINE_V2` pelo dry-run.
- Resultado de `/health`.
- Resultado de `tmp-tests/autoresponder-core-scenarios.cjs`.

Os cenarios automaticos em `/autoresponder/test-flow` nao substituem esta rodada real, porque eles validam partes do fluxo sem comprovar envio real pelo WhatsApp, pausa operacional e entrega do resumo ao atendente.

Roteiro minimo:

- Buscar produto.
- Escolher produto/variacao.
- Iniciar compra.
- Escolher entrega ou retirada.
- Escolher pagamento.
- Chegar ao handoff sem queda para fallback legado.

Roteiro sugerido de mensagens:

```text
redmi note 15
1
comprar
1
1
finalizar
entrega
56320690
123
pix
Nome Cliente Teste
00000000000
```

Critérios de aprovacao:

- A busca mostra produtos reais e rodape de escolha.
- A evidencia registra produto escolhido com nome, SKU/id ou variacao, preco e posicao escolhida.
- A escolha abre detalhe do produto correto, nao troca para outro produto depois de `comprar`.
- O carrinho mantem item e quantidade ao escolher entrega, consultar CEP e escolher pagamento.
- O CEP dentro da compra pede numero/complemento sem cair na entrega avulsa.
- A forma de pagamento fica salva no resumo.
- O handoff cria/atualiza cliente quando aplicavel, pausa a conversa e entrega resumo ao atendente.
- Depois da pausa, o bot nao envia nova resposta automatica ao remetente de teste.
- Nenhuma resposta mostra instabilidade, lista fora de contexto ou fallback legado inesperado.

Critérios de falha critica:

- Produto escolhido muda depois de `comprar`.
- Carrinho perde item ou quantidade.
- CEP da compra e tratado como entrega avulsa.
- Pagamento nao fica salvo.
- Handoff nao pausa a conversa.
- Atendente nao recebe resumo.
- API retorna erro 5xx.
- Resposta cai em fallback legado inesperado, mensagem de instabilidade ou lista fora de contexto.

Evidencia minima para liberar remocao do legado:

- Captura ou transcricao completa com timestamps das mensagens do cliente e respostas do bot.
- Horario aproximado do handoff.
- Confirmacao de que a conversa ficou pausada para atendimento humano.
- Confirmacao de que o resumo chegou ao atendente.
- Confirmacao de que nao houve resposta automatica depois da pausa.
- Registro em `docs/autoresponder/engine-v2-rollout-audit.md` e `docs/autoresponder/cleanup-inventory.md`.

Se qualquer criterio falhar, executar rollback imediatamente, registrar responsavel e horario da decisao, assumir manualmente o remetente de teste se necessario e manter os caminhos legados.

## Rollback

Se qualquer validacao critica falhar:

```powershell
$env:AUTORESPONDER_ENGINE_V2_APPLY="1"
$env:AUTORESPONDER_ENGINE_V2_VALUE="0"
node tools\set-autoresponder-engine-v2-vps.cjs
curl.exe -i -s "https://api.xiaomipetrolina.com.br/health"
node tools\set-autoresponder-engine-v2-vps.cjs
```

Evidencia esperada do rollback:

- Backup remoto do `.env` foi criado antes da alteracao.
- PM2 reiniciou com `--update-env`.
- `/health` retornou sucesso depois do restart.
- Dry-run final mostrou `AUTORESPONDER_ENGINE_V2: 0`.
- Logs pos-rollback nao mostram erro critico.

Pos-rollback operacional:

- Registrar conversas afetadas.
- Pausar ou assumir manualmente o remetente de teste.
- Avisar atendimento.
- Limpar ou cancelar cliente/pedido teste se algum registro real tiver sido criado.

## Criterio Para Remover Legado

Somente depois de tudo abaixo:

- `AUTORESPONDER_ENGINE_V2=1` publicado na VPS.
- `/health` retorna sucesso depois do restart.
- `tmp-tests/autoresponder-core-scenarios.cjs` passa contra a API publicada.
- Uma rodada real confirma produto, compra, entrega/pagamento e handoff pelo motor novo.
- Evidencias da rodada real foram registradas antes da remocao do legado.
- `docs/autoresponder/engine-v2-rollout-audit.md` e `docs/autoresponder/cleanup-inventory.md` registram a data da validacao.
