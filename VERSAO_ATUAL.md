# Versao Atual

```text
version: v1.1.66-delivery-admin-complete-toast
date: 2026-06-18
status: published
release_vps: /var/www/mdv-site/releases/20260618-174244-v1166-delivery-admin-complete-toast
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- A baixa administrativa de entrega agora exibe a mensagem retornada pela VPS quando nao puder concluir.
- Erros estruturados como `Entrega nao pode ser concluida: ...` aparecem em toast para o admin em vez de apenas piscar a tela.
- O carregamento da acao volta ao normal no `finally`, preservando o fluxo atual de sucesso.
- Uma guarda estatica protege a exibicao do erro na baixa administrativa de entrega.

## Como Recuperar

Use a tag/versao `v1.1.66-delivery-admin-complete-toast` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-18-v1.1.66-delivery-admin-complete-toast.md
```

## Publicacao

- Release VPS publicada: `/var/www/mdv-site/releases/20260618-174244-v1166-delivery-admin-complete-toast`.
- Esta versao altera `public/VERSION.json`; site VPS publicado para refletir a versao.
- Esta versao nao altera API; `mdv-api` nao precisa ser reiniciado.
