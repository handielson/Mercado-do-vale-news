# Filtro de aparelhos já disponíveis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ocultar opcionalmente da fila os aparelhos já disponíveis à venda e esclarecer que produto encontrado ainda precisa de finalização do aparelho.

**Architecture:** A página de cadastro por foto mantém uma preferência local para o filtro e deriva a lista visível a partir dos itens já carregados. A fila recebe somente a lista derivada; nenhuma API ou regra comercial é alterada.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Node assert estático.

## Global Constraints

- Apenas o status `completed` pode ser ocultado pelo filtro.
- O filtro começa desativado e não persiste dados.
- Não alterar serviços, rotas, banco, estoque, preço, IMEI ou finalização.
- Manter o agrupamento existente aplicado sobre a lista visível.

---

### Task 1: Cobrir o filtro e os textos com teste estático

**Files:**
- Modify: `tmp-tests/smartphone-photo-intake-navigation-static.test.mjs`
- Modify: `tmp-tests/smartphone-photo-intake-server-static.test.mjs`

**Interfaces:**
- Consumes: fonte de `SmartphonePhotoIntakePage.tsx`, `PhotoIntakeQueue.tsx` e `PhotoIntakeReviewCard.tsx`.
- Produces: guardas para a cópia e para o filtro visual de `completed`.

- [ ] **Step 1: Escrever as expectativas que falham**

```js
assert.match(intakePage, /hideCompleted[\s\S]*item\.status !== 'completed'/);
assert.match(intakePage, /Ocultar já disponíveis/);
assert.match(reviewCard, /Produto encontrado\.[\s\S]*Falta concluir este aparelho/);
assert.match(queue, /Produto encontrado/);
```

- [ ] **Step 2: Rodar a guarda e confirmar a falha**

Run: `node tmp-tests/smartphone-photo-intake-navigation-static.test.mjs`

Expected: falha porque o filtro e os novos textos ainda não existem.

- [ ] **Step 3: Manter as proteções anteriores de agrupamento e avanço da fila**

Não remover as expectativas de agrupamento, ordenação e seleção do próximo aparelho pendente.
Atualizar a guarda de servidor que exigia `Produto já cadastrado` para preservar a garantia de não criar outro produto com a cópia nova.

### Task 2: Implementar o filtro visual e a cópia simplificada

**Files:**
- Modify: `pages/admin/products/SmartphonePhotoIntakePage.tsx`
- Modify: `components/products/photo-intake/PhotoIntakeQueue.tsx`
- Modify: `components/products/photo-intake/PhotoIntakeReviewCard.tsx`

**Interfaces:**
- Consumes: `SmartphonePhotoIntake.status` e os itens carregados pela página.
- Produces: `visibleItems` derivado e o controle `Ocultar já disponíveis`.

- [ ] **Step 1: Adicionar o estado local do filtro**

```tsx
const [hideCompleted, setHideCompleted] = useState(false);
const visibleItems = useMemo(
  () => hideCompleted ? items.filter(item => item.status !== 'completed') : items,
  [hideCompleted, items],
);
```

- [ ] **Step 2: Derivar agrupamento, contador e seleção da lista visível**

Usar `visibleItems` no agrupamento e na fila. Ao ativar o filtro, trocar a seleção somente quando o item atual estiver concluído.

- [ ] **Step 3: Adicionar o controle acessível na fila**

```tsx
<button type="button" onClick={() => setHideCompleted(value => !value)} aria-pressed={hideCompleted}>
  Ocultar já disponíveis
</button>
```

- [ ] **Step 4: Simplificar os avisos**

Trocar a etiqueta de fila por `Produto encontrado` e trocar o aviso por `Produto encontrado. O produto já existe. Falta concluir este aparelho para disponibilizá-lo à venda.`

- [ ] **Step 5: Rodar a guarda focada**

Run: `node tmp-tests/smartphone-photo-intake-navigation-static.test.mjs`

Expected: PASS.

### Task 3: Validar e publicar a entrega

**Files:**
- Modify: `public/VERSION.json`
- Modify: `VERSAO_ATUAL.md`
- Create: `docs/versoes/2026-08-17-v1.2.253-filtro-aparelhos-disponiveis.md`

**Interfaces:**
- Consumes: validações e versão em vigor.
- Produces: release versionada, commitada, enviada a `main` e publicada na VPS.

- [ ] **Step 1: Rodar as guardas do cadastro por foto**

Run: `npm.cmd run test:smartphone-photo-intake`

Expected: PASS.

- [ ] **Step 2: Rodar o build de produção**

Run: `npm.cmd run build`

Expected: PASS sem dependência operacional do Supabase.

- [ ] **Step 3: Versionar e registrar a entrega**

Atualizar os três artefatos obrigatórios para `v1.2.253-filtro-aparelhos-disponiveis`.

- [ ] **Step 4: Revisar, stagear e publicar somente os arquivos do escopo**

Run: `npm.cmd run publish:vps-plan -- --slug filtro-aparelhos-disponiveis --summary "Oculta aparelhos já disponíveis e esclarece a pendência de venda"`

Esperado: plano de deploy somente de site.

- [ ] **Step 5: Criar recuperação e validar produção**

Criar commit, tag, push em `main`, executar `npm.cmd run deploy:vps-site` e confirmar HTTP 200 no site e a versão publicada em `/VERSION.json`.
