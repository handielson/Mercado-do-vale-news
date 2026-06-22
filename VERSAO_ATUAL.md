# Versao Atual

```text
version: v1.1.90-bling-sync-prefill-autosave
date: 2026-06-22
status: published
release_vps: pendente
branch: codex/publish-delivery-ops-20260614
summary: Corrige importação de findBlingProductByExactSku na aba Básico e implementa preenchimento e sincronização automáticos de descrição, GTIN/EAN e dimensões ao importar produtos do Bling.
```

## O que entrou no v1.1.90

- Corrigida importação de `findBlingProductByExactSku` que causava falha ao tentar buscar SKU manualmente na aba Básico do modal de modelos.
- Implementada rotina automática de sincronização: ao importar ou puxar dimensões de produtos do Bling, a descrição do produto e o GTIN/EAN são agora automaticamente preenchidos/sincronizados na ficha do Modelo do banco de dados (evitando a necessidade de preenchimento manual secundário).

## Validacoes

- `npm run build` (Build de produção validado sem erros)


