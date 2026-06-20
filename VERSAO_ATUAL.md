# Versao Atual

```text
version: v1.1.73-whatsapp-test-button
date: 2026-06-20
status: pending
release_vps: /var/www/mdv-site/releases/20260620-132000-v1173-whatsapp-test-button
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Corrige o botao `Enviar teste` dos templates automaticos de WhatsApp importando corretamente o servico de envio.
- Quando o envio teste falhar no navegador, a tela passa a mostrar a mensagem real retornada pelo cliente/API em vez do erro generico.
- Mantem o envio de teste usando o telefone dinamico dos Dados da Empresa, com fallback `87988032612`.

## Como Recuperar

Use a tag/versao `v1.1.73-whatsapp-test-button` ou o arquivo:

`docs/versoes/2026-06-20-v1.1.73-whatsapp-test-button.md`
