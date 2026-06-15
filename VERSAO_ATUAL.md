# Versao Atual

```text
version: v1.1.23-sales-payment-label-hotfix
date: 2026-06-15
status: published
release_vps: /var/www/mdv-site/releases/20260615-165931-v1123-sales-payment-label-hotfix
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Corrige crash ao abrir detalhes de uma venda causado por `getPaymentLabel is not defined`.
- O modal de venda agora renderiza o rotulo das formas de pagamento a partir de `buildPaymentPresentation(payment)`.
- Atualiza a guarda de regressao para impedir que `getPaymentLabel(payment.method)` volte a ser usado como helper solto no JSX.

## Como Recuperar

Use a tag/versao `v1.1.23-sales-payment-label-hotfix` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-15-v1.1.23-sales-payment-label-hotfix.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260615-165931-v1123-sales-payment-label-hotfix`.
- Esta versao altera apenas o frontend; a API VPS nao precisa ser reiniciada.
