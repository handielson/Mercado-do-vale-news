# Versao Atual

```text
version: v1.1.71-delivery-overpayment-debt
date: 2026-06-19
status: published
release_vps: /var/www/mdv-site/releases/20260619-173828-v1171-delivery-overpayment-debt
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Pagamento de entregador acima do saldo disponivel deixou de ser bloqueado na aba de entregador do cliente.
- A API calcula o saldo de entregas em transacao e limita a baixa ao saldo realmente disponivel.
- O valor excedente do pagamento vira debito pendente na conta do proprio entregador.
- O retorno da API informa `settlement_amount`, `overpayment_amount` e `overpayment_debt_id` para a tela mostrar sucesso correto.
- Guarda de regressao cobre a tela, o contrato do service e as rotas `vps_server.js`/`vps_server.cjs`.

## Como Recuperar

Use a tag/versao `v1.1.71-delivery-overpayment-debt` ou o arquivo:

`docs/versoes/2026-06-19-v1.1.71-delivery-overpayment-debt.md`
