# Versao Atual

```text
version: v1.1.64-customer-pix-order-refresh
date: 2026-06-18
status: published
release_vps: /var/www/mdv-site/releases/20260618-154234-v1164-customer-pix-order-refresh
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Pix Mercado Pago do crediario agora pode ser conferido manualmente pelo botao `Conferir pagamento` e tambem consulta automaticamente enquanto estiver pendente.
- Quando o Mercado Pago confirma o Pix, a tela recarrega o financeiro sem o cliente precisar sair e voltar.
- O historico do crediario mostra o pagamento como `Pago via Mercado Pago` com data e hora.
- O proxy da VPS libera de forma restrita o fluxo `Fazer Pedido` do carrinho para cliente autenticado criar seu proprio pedido, itens e reserva de estoque.
- Guardas estaticas protegem a conferencia instantanea do Pix e o caminho de pedido do cliente.

## Como Recuperar

Use a tag/versao `v1.1.64-customer-pix-order-refresh` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-18-v1.1.64-customer-pix-order-refresh.md
```

## Publicacao

- Release VPS publicada: `/var/www/mdv-site/releases/20260618-154234-v1164-customer-pix-order-refresh`.
- Esta versao altera `public/VERSION.json`; site VPS publicado para refletir a versao.
- Esta versao altera `vps_server.js` e `vps_server.cjs`; API VPS publicada e reiniciada.
