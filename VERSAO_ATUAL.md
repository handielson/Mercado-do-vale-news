# Versao Atual

```text
version: v1.1.85-shopee-universal-defaults
date: 2026-06-22
status: pending
release_vps: pendente
branch: codex/publish-delivery-ops-20260614
summary: Templates Shopee agora incluem defaults universais por ID, aplicados a qualquer categoria com placeholders de SKU e dimensoes da embalagem.
```

## O que entra no v1.1.85

- Template padrao `universal_defaults` para atributos Shopee recorrentes, como garantia, condicao, certificado, SKU e dimensoes da embalagem.
- Envio para Shopee mescla defaults universais, defaults do template por categoria e preenchimento automatico da categoria, mantendo o template especifico com prioridade.
- Placeholders em atributos Shopee, como `{sku}` e `{package_dimensions}`, sao resolvidos antes de preencher os campos da publicacao.
- Tela de templates permite adicionar/remover defaults manuais por ID de atributo, inclusive atributos que ainda nao apareceram na categoria carregada.
- O servico de templates preserva defaults obrigatorios mesmo quando a loja ja tem templates salvos na VPS.

## Validacoes

- `node tmp-tests\shopee-universal-attribute-defaults-static.test.mjs`
- `node tmp-tests\shopee-template-engine.test.mjs`
- `node tmp-tests\shopee-template-service-vps-static.test.mjs`
- `node tmp-tests\shopee-templates-page-static.test.mjs`
- `npm.cmd run build`

## Observacoes

- `node tmp-tests\shopee-template-service-static.test.mjs` continua dependendo de `supabase/add_shopee_templates.sql`, arquivo ausente neste checkout apos a migracao de templates Shopee para VPS table-data.
