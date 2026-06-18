# Versao Atual

```text
version: v1.1.63-customer-debt-pix-auth
date: 2026-06-18
status: published
release_vps: /var/www/mdv-site/releases/20260618-150339-v1163-customer-debt-pix-auth
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Clientes autenticados voltam a gerar Pix Mercado Pago no crediario pelo perfil financeiro.
- O proxy da VPS reconhece as rotas financeiras proprias do cliente sem exigir permissao administrativa.
- O proxy preserva o bearer token do cliente nessas rotas e nao injeta `x-sync-key`, mantendo a validacao de titularidade no backend.
- A consulta de pagamentos por `debt_id` tambem fica limitada ao cliente autenticado quando nao for admin/sync.
- Uma guarda estatica protege o contrato para evitar regressao do `403 Admin required` no fluxo de Pix do crediario.

## Como Recuperar

Use a tag/versao `v1.1.63-customer-debt-pix-auth` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-18-v1.1.63-customer-debt-pix-auth.md
```

## Publicacao

- Release VPS publicada: `/var/www/mdv-site/releases/20260618-150339-v1163-customer-debt-pix-auth`.
- Esta versao altera `public/VERSION.json`; site VPS publicado para refletir a versao.
- Esta versao altera `vps_server.js` e `vps_server.cjs`; API VPS publicada e reiniciada.
