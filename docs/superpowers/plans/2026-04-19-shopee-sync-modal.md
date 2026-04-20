# Shopee Sync Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir a publicacao rapida da Shopee para suportar layout melhor, envio de fotos/video do sistema e payload valido com `weight` numerico.

**Architecture:** O modal rapido continua em `ShopeePage.tsx`, mas passa a reutilizar os mesmos conceitos do editor detalhado: midia selecionavel, upload para Shopee antes da publicacao e payload tipado corretamente. A interface do passo "Dados" sera reorganizada para separar resumo/midia dos campos de preenchimento.

**Tech Stack:** React 18, TypeScript/TSX, fetch, Supabase, endpoints serverless da Shopee.

---

### Task 1: Corrigir payload de criacao do item

**Files:**
- Modify: `pages/admin/settings/ShopeePage.tsx`
- Test: `pages/admin/settings/shopeeSyncDefaults.test.mjs`

- [ ] Revisar o `handleSync` do modal rapido e alinhar o payload de `add_item` com tipos numericos corretos.
- [ ] Garantir que `weight` seja enviado como `number`, nunca `string`.
- [ ] Garantir que `normal_stock`, `original_price` e `category_id` continuem numericos.
- [ ] Validar localmente com script simples e tentativa de publicacao real.

### Task 2: Levar fotos e video do sistema para o modal rapido

**Files:**
- Modify: `pages/admin/settings/ShopeePage.tsx`
- Verify: `api/shopee-catalog.ts`

- [ ] Adicionar estado de midia ao modal rapido para imagens e video.
- [ ] Prepopular imagens com `product.images`.
- [ ] Prepopular video com `product.video_url` quando existir.
- [ ] Reaproveitar o fluxo de upload de imagem/video antes de chamar `add_item`.
- [ ] Enviar `image.image_id_list` e `video_info.video_id_list` no payload final.

### Task 3: Ajustar layout do passo "Dados"

**Files:**
- Modify: `pages/admin/settings/ShopeePage.tsx`

- [ ] Reorganizar o conteudo em duas colunas para desktop e uma coluna em telas menores.
- [ ] Criar um card lateral com resumo do produto, contadores e preview de midia.
- [ ] Melhorar espacamento, hierarquia visual e leitura dos campos obrigatorios/opcionais.
- [ ] Manter o passo "Confirmar" enxuto e consistente com os dados escolhidos.

### Task 4: Revisao e verificacao

**Files:**
- Modify if needed: `pages/admin/settings/ShopeePage.tsx`
- Run: `node pages/admin/settings/shopeeSyncDefaults.test.mjs`

- [ ] Rodar a verificacao do helper existente.
- [ ] Revisar regressao no fluxo rapido quando o produto nao tiver video.
- [ ] Confirmar que nao ha mais serializacao incorreta de `weight`.
- [ ] Registrar riscos remanescentes caso o endpoint do Bling continue retornando `401` no ambiente local.
