# Versao Atual

```text
version: v1.1.53-pdv-receipt-serial-preview
date: 2026-06-17
status: published
release_vps: /var/www/mdv-site/releases/20260617-113047-v1153-pdv-receipt-serial-preview
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- A busca Nome/SKU do PDV agora tambem encontra produtos quando o termo digitado bate com IMEI 1, IMEI 2 ou Serial de uma unidade disponivel.
- O campo de busca IMEI/Serial do PDV e o campo `Serial` do cadastro passam a gravar/exibir letras maiusculas independente da digitacao.
- A tabela inferior do painel do modelo passa a focar nas unidades vendidas.
- Cada vendido mostra SKU, IMEI/serial, numero do pedido com link para a venda, valor da venda, custo e lucro.
- O retorno/lucro de unidade vendida usa os itens reais da venda quando houver `sale_items`, mantendo estimativa apenas como fallback.
- O preview do recibo do PDV agora mostra os identificadores da unidade escolhida abaixo do produto, incluindo `Serial` para receptores.

## Como Recuperar

Use a tag/versao `v1.1.53-pdv-receipt-serial-preview` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-17-v1.1.53-pdv-receipt-serial-preview.md
```

## Publicacao

- Release VPS publicada: `/var/www/mdv-site/releases/20260617-113047-v1153-pdv-receipt-serial-preview`.
- Esta versao altera frontend/admin e endpoint VPS do PDV; site e API VPS publicados.
