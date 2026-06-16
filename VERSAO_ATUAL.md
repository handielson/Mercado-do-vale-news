# Versao Atual

```text
version: v1.1.46-pdv-budget-serial-format
date: 2026-06-16
status: published
release_vps: /var/www/mdv-site/releases/20260616-152700-v1146-pdv-budget-serial-format
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Formata o texto de orcamento do WhatsApp no mesmo padrao legivel do compartilhamento de categoria.
- Lista cada variante disponivel como item numerado proprio, com RAM/memoria, preco PIX, parcelamento em 12x e cores.
- Faz o PDV buscar unidades reais por produto para exibir IMEI/Serial disponivel, inclusive quando o cadastro nao tem specs legadas.
- Remove a mensagem confusa `Sem unidade disponivel` da linha do resultado de produto; se nao houver identificador valido, mostra o SKU.
- Mantem as correcoes anteriores de PDV/vendas, lucro real, recibo, termo e input de valor unitario.

## Dados Corrigidos Na VPS

- Nenhuma correcao direta de banco nesta release.

## Como Recuperar

Use a tag/versao `v1.1.46-pdv-budget-serial-format` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-16-v1.1.46-pdv-budget-serial-format.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260616-152700-v1146-pdv-budget-serial-format`.
- Esta versao altera frontend/admin/PDV e arquivos publicos de versao; publicar site.
