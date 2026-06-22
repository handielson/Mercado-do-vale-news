# Versao Atual

```text
version: v1.1.91-model-layout-clean-up-sync
date: 2026-06-22
status: published
release_vps: pendente
branch: codex/publish-delivery-ops-20260614
summary: Reorganiza o modal de modelos trazendo descrição, brindes e dimensões/peso para a aba Básico, remove duplicados do Template e da aba JSON, e executa migração de sincronização retroativa.
```

## O que entrou no v1.1.91

- **Reorganização do Modal de Modelos:** A aba **Básico** agora exibe e permite editar os campos principais: Nome, Marca, Categoria Padrão, Categoria Shopee, EANs/GTINs, Descrição Comercial, Brindes e Logística Padrão (peso, largura, altura, profundidade).
- **Limpeza de Telas:** Removidos todos os campos duplicados da aba **Template** (que agora foca apenas nas especificações técnicas específicas) e a seção redundante de revisão na aba **JSON / IA**.
- **Migração do Banco de Dados:** Executado script retroativo no banco de dados da VPS que atualizou 1.330 modelos existentes trazendo descrições, EANs e dimensões dos produtos correspondentes que já haviam sido importados do Bling.

## Validacoes

- `npm run build` (Build de produção validado sem erros)


