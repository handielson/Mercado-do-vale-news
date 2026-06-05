# Runbook De Rollout Do Engine V2

## Objetivo

Ativar `AUTORESPONDER_ENGINE_V2=1` na VPS de forma reversivel, validar produto e compra pelo motor novo e so entao liberar a remocao dos fallbacks legados.

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

## Validacao Pos-ativacao

```powershell
curl.exe -i -s "https://api.xiaomipetrolina.com.br/health"
node tmp-tests\autoresponder-core-scenarios.cjs
```

Depois dos cenarios automaticos, validar uma conversa real controlada:

- Buscar produto.
- Escolher produto/variacao.
- Iniciar compra.
- Escolher entrega ou retirada.
- Escolher pagamento.
- Chegar ao handoff sem queda para fallback legado.

## Rollback

Se qualquer validacao critica falhar:

```powershell
$env:AUTORESPONDER_ENGINE_V2_APPLY="1"
$env:AUTORESPONDER_ENGINE_V2_VALUE="0"
node tools\set-autoresponder-engine-v2-vps.cjs
curl.exe -i -s "https://api.xiaomipetrolina.com.br/health"
```

## Criterio Para Remover Legado

Somente depois de tudo abaixo:

- `AUTORESPONDER_ENGINE_V2=1` publicado na VPS.
- `/health` retorna sucesso depois do restart.
- `tmp-tests/autoresponder-core-scenarios.cjs` passa contra a API publicada.
- Uma rodada real confirma produto, compra, entrega/pagamento e handoff pelo motor novo.
- `docs/autoresponder/engine-v2-rollout-audit.md` e `docs/autoresponder/cleanup-inventory.md` registram a data da validacao.
