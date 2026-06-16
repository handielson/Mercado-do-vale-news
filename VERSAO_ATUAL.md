# Versao Atual

```text
version: v1.1.29-pdv-counter-customer
date: 2026-06-15
status: published
release_vps: /var/www/mdv-site/releases/20260615-214800-v1129-pdv-counter-customer
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- O PDV voltou a ter acao de venda rapida para o cadastro existente `Cliente Balcao`.
- A selecao busca o cliente cadastrado por nome normalizado ou marcador `is_walk_in_customer`.
- O fluxo nao cria novo `Cliente Balcao`; se o cadastro sumir, mostra erro claro.
- Venda balcão fica marcada como `Venda rapida sem cadastro` e nao recebe Moedas do Vale.
- Protecao de regressao cobre botao, pagina PDV, servico de clientes e tipos.

## Como Recuperar

Use a tag/versao `v1.1.29-pdv-counter-customer` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-15-v1.1.29-pdv-counter-customer.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260615-214800-v1129-pdv-counter-customer`.
- Esta versao altera apenas o frontend do PDV; publicar site.
