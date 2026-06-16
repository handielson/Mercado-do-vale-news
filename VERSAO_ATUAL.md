# Versao Atual

```text
version: v1.1.45-pdv-sales-repair-global
date: 2026-06-16
status: published
release_vps: /var/www/mdv-site/releases/20260616-151404-v1145-pdv-sales-repair-global
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Bloqueia finalizacao duplicada no PDV com trava sincronica, evitando varios pedidos por clique repetido.
- Faz o lucro real valer de forma global em modal, dashboard e resumo de vendas: total recebido menos custo dos itens, taxa da maquina e entrega.
- Adiciona acao administrativa para atualizar custos/lucro de uma venda inteira sem alterar numero, data ou dados basicos.
- Corrige historico legado com `sale_items` gravados com `unit_price`/`subtotal` zerados, recalculando na leitura e evitando novos zeros na escrita.
- Ajusta o PDV para exibir/adicionar apenas unidades serializadas disponiveis, sem mostrar IMEI vendido vindo de `specs` legado.
- Reorganiza o texto de orcamento do WhatsApp por variantes reais de RAM/memoria/preco/cores.
- Mantem as correcoes anteriores de recibo/termo e do input de valor unitario no PDV.

## Dados Corrigidos Na VPS

- Unidade `fc8d3b8a-04f7-4f5e-be46-4bc347b5e577` atualizada para serial `AT2209901430`.

## Como Recuperar

Use a tag/versao `v1.1.45-pdv-sales-repair-global` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-16-v1.1.45-pdv-sales-repair-global.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260616-151404-v1145-pdv-sales-repair-global`.
- Esta versao altera frontend/admin/PDV e arquivos publicos de versao; publicar site.
