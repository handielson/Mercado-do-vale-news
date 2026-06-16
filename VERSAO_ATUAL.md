# Versao Atual

```text
version: v1.1.33-delivery-order-number
date: 2026-06-16
status: published
release_vps: /var/www/mdv-site/releases/20260616-051513-v1133-delivery-order-number
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Entregas em aberto e historico do entregador deixam de exibir UUID completo como pedido.
- Quando o backend so tiver UUID legado, o pedido aparece no formato amigavel `#XXXXXXXX`.
- A tela publica da entrega usa o mesmo formato de numero do pedido.
- O historico administrativo tambem troca descricoes antigas com UUID completo pelo identificador amigavel.
- A API ganhou uma rota administrativa protegida para corrigir valor de entrega por `job.id`.
- Correcao operacional preparada para ajustar a entrega da Ana Cleide para `R$ 6,00`.

## Como Recuperar

Use a tag/versao `v1.1.33-delivery-order-number` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-16-v1.1.33-delivery-order-number.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260616-051513-v1133-delivery-order-number`.
- Esta versao altera frontend/admin e API; publicar site e reiniciar API.
