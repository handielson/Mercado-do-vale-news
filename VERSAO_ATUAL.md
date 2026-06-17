# Versao Atual

```text
version: v1.1.50-pdv-layout-name-imei
date: 2026-06-17
status: pending_deploy
release_vps: pendente
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Formata visualmente os nomes de clientes no PDV com a primeira letra maiuscula de cada nome.
- Mantem o seletor de unidade serializada por radio.
- Mostra cada unidade serializada em uma unica linha no formato `IMEI 1 | IMEI 2 | Serial`.
- Aumenta a fonte do seletor de unidade serializada para melhorar a leitura no balcao.
- Nao altera o dado salvo do cliente nem a estrutura usada para registrar a venda.

## Como Recuperar

Use a tag/versao `v1.1.50-pdv-layout-name-imei` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-17-v1.1.50-pdv-layout-name-imei.md
```

## Publicacao

- Release VPS: `pendente`.
- Esta versao altera somente frontend/admin/PDV; site deve ser publicado. A API VPS nao precisa de novo deploy.
