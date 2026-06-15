# Versao Atual

```text
version: v1.1.25-pdv-card-operator-fee
date: 2026-06-15
status: published
release_vps: /var/www/mdv-site/releases/20260615-180606-v1125-pdv-card-operator-fee
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- PDV passa a receber da calculadora de parcelas o custo da operadora e o percentual da maquina.
- Pagamentos de cartao parcelado agora gravam `operator_fee_amount` e `operator_fee_percentage` no TXT de finalizacao e em `payment_methods`.
- O pagamento de cartao passa a preservar `amount` como valor base e `total_with_fee` como valor cobrado.
- Reparo manual aplicado na venda `cc27f233-5f8e-4e3e-b06f-79d43f876de4` usando o `finalization_log` salvo.

## Como Recuperar

Use a tag/versao `v1.1.25-pdv-card-operator-fee` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-15-v1.1.25-pdv-card-operator-fee.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260615-180606-v1125-pdv-card-operator-fee`.
- Esta versao altera apenas o frontend do PDV; a API VPS ja suporta os campos.
