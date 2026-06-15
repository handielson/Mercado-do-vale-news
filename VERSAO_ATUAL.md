# Versao Atual

```text
version: v1.1.27-delivery-public-admin-complete
date: 2026-06-15
status: published
release_vps: /var/www/mdv-site/releases/20260615-192101-v1127-delivery-public-admin-complete
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- O link publico do entregador em `/delivery/:token` agora esta registrado no roteador do frontend e nao cai mais no 404 interno do app.
- A baixa administrativa da entrega continua exigindo motivo e dados estruturais da entrega, mas nao exige Pix aprovado nem foto de comprovacao.
- A API VPS aplica a mesma regra da baixa administrativa, mantendo Pix/foto obrigatorios apenas para a finalizacao normal feita pelo entregador.
- Protecoes de regressao cobrem a rota publica e a diferenca entre conclusao normal e baixa administrativa.

## Como Recuperar

Use a tag/versao `v1.1.27-delivery-public-admin-complete` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-15-v1.1.27-delivery-public-admin-complete.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260615-192101-v1127-delivery-public-admin-complete`.
- Esta versao altera frontend/admin e API VPS; publicar site e reiniciar API.
