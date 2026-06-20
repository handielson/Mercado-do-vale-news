# Versao Atual

```text
version: v1.1.72-whatsapp-automation-templates
date: 2026-06-20
status: published
release_vps: /var/www/mdv-site/releases/20260620-122546-v1172-whatsapp-automation
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Central de WhatsApp ganhou templates automaticos editaveis por categoria, com trava individual para pausar cada fluxo.
- Fluxos automaticos cobrem cadastro pelo site/admin, compra concluida, aniversariantes do dia e aviso de saida para entrega.
- Cada template pode enviar teste para o telefone salvo em Dados da Empresa, usando `87988032612` como fallback quando o telefone da loja estiver vazio.
- VPS registra logs dos envios automaticos e dos testes, respeita template pausado e evita aniversario duplicado no mesmo dia.
- Pagina do entregador ganhou o botao `Saindo para entrega` para marcar rota e avisar o cliente.

## Como Recuperar

Use a tag/versao `v1.1.72-whatsapp-automation-templates` ou o arquivo:

`docs/versoes/2026-06-20-v1.1.72-whatsapp-automation-templates.md`