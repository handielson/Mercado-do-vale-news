# Versao Atual

```text
version: v1.1.69-evolution-typing-presence
date: 2026-06-19
status: published
release_vps: /var/www/mdv-site/releases/20260619-090350-v1169-evolution-typing-presence
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- O bot automatico do WhatsApp envia presenca `digitando` pela Evolution API antes de cada resposta.
- A simulacao fica restrita ao fluxo automatico do webhook Evolution e nao afeta mensagens manuais de atendentes.
- Falhas no envio de presenca sao tratadas como nao criticas, mantendo o envio da resposta normal.
- Guarda de regressao cobre o endpoint de presenca, a ordem antes do envio de texto e a exclusao do fluxo manual.

## Como Recuperar

Use a tag/versao `v1.1.69-evolution-typing-presence` ou o arquivo:

`docs/versoes/2026-06-19-v1.1.69-evolution-typing-presence.md`