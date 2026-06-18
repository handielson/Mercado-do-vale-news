# Delivery Admin Unrestricted Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que a baixa administrativa de uma entrega exija somente uma observacao, ignorando todas as pendencias operacionais.

**Architecture:** O fluxo normal continua usando todas as validacoes de conclusao. Quando `adminOverride` estiver ativo, o backend retorna uma lista vazia de bloqueios e a interface administrativa habilita a acao apenas quando a justificativa estiver preenchida.

**Tech Stack:** Node.js, Fastify, React, TypeScript e testes estaticos em Node.js.

---

### Task 1: Regressao da baixa administrativa

**Files:**
- Modify: `tmp-tests/delivery-ops-status-gallery-static.test.mjs`

- [ ] Atualizar o teste para exigir liberacao total.
- [ ] Executar `node tmp-tests/delivery-ops-status-gallery-static.test.mjs` e confirmar a falha atual.

### Task 2: Liberar a baixa administrativa

**Files:**
- Modify: `vps_server.js`
- Modify: `vps_server.cjs`
- Modify: `components/admin/sales/SaleDetailsModal.tsx`

- [ ] Retornar `[]` em `getCustomerDeliveryCompletionBlockers` quando `adminOverride` estiver ativo.
- [ ] Manter obrigatorio somente `adminReason` em `completeCustomerDeliveryJob`.
- [ ] Fazer a interface habilitar e enviar a baixa apenas com observacao preenchida.
- [ ] Executar o teste de regressao e confirmar PASS.

### Task 3: Verificacao

- [ ] Executar `node tmp-tests/delivery-ops-status-gallery-static.test.mjs`.
- [ ] Executar `node tmp-tests/delivery-admin-complete-error-static.test.mjs`.
- [ ] Executar `npm.cmd run build`.
