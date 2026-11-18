# Devolução de itens (Parte 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Em Detalhes da venda, "Devolver itens": escolher itens/quantidades, calcular o valor pago de cada um, estornar na mesma forma em que entrou (ou informar outra), devolver estoque e aparelhos (aparelho volta ao Depósito / Entrada / Conferencia), gerar recibo de devolução em PDF (WhatsApp/imprimir) e finalizar quando o recibo assinado e os comprovantes obrigatórios estiverem no sistema.

**Architecture:** `services/saleReturnCore.cjs` (funções puras: itens devolvíveis e valor pago, divisão do estorno por forma de pagamento, regras de pendência). `services/saleReturnServer.cjs` (tabelas, rotas admin, transação da devolução, arquivos em `private-uploads/sale-returns`, WhatsApp). `services/stockMovementRestoration.cjs` ganha devolução limitada por produto/quantidade dentro de uma transação existente. Frontend: `SaleReturnModal`, recibo em PDF com jsPDF, página `/admin/devolucoes` com as pendentes.

**Tech Stack:** Node/Fastify + mysql2, React + TS + jsPDF, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-18-historico-do-aparelho-design.md` (seção 6 e decisões do usuário).

## Global Constraints

- Valor pago do item = total do item × (total da venda − taxas de cartão − frete cobrado) ÷ soma dos totais dos itens; centavos, arredondamento no último item para fechar a soma. Caso Eliany: Poco = **191617** (R$ 1.916,17).
- O total da devolução pode ser reduzido pelo operador, nunca aumentado acima do devolvível (soma dos itens escolhidos menos o já devolvido daquela venda).
- "Mesma forma": dinheiro → Pix → débito → crédito → demais, limitado pelo que entrou em cada forma menos o já estornado (`sale_partial_refunds` + devoluções). Cartão com juros: estorno = parte do produto × `total_with_fee ÷ amount`. Caso Eliany só o Poco: dinheiro 30000 + crédito 161617 de produto → **180849** no cartão.
- "Outra forma": métodos `money`, `pix`, `transfer`, `card`, `other`; soma = total da devolução.
- Comprovante obrigatório: Pix manual (sem id de estorno do Mercado Pago), transferência e cartão. Dinheiro: o comprovante é o recibo assinado.
- Recibo assinado sempre obrigatório. `pendente` → `finalizada` quando tudo que é obrigatório estiver enviado.
- Dinheiro exige caixa aberto (`cash_session_id` do caixa aberto; sem caixa → 409 "Abra o caixa para devolver em dinheiro.").
- Crediário (`a_prazo`) fora: 409 "Venda no crediário: ajuste pelo crediário." (YAGNI agora).
- Pix com `mercado_pago_payment_id` no modo "mesma forma" estorna pelo Mercado Pago antes de gravar, como o estorno parcial de hoje.
- Aparelho devolvido: `units.status='available'`, `sale_id/sold_at` nulos, local Depósito / Entrada / Conferencia, evento `returned_to_incoming` com motivo "Devolução #<código>". Produto comum: volta ao local de onde saiu.
- Devolver todos os itens: `sales.payment_status='cancelled'` e `return_status='full'`; parcial: `return_status='partial'`. Lucro: `sales.profit` passa a descontar (valor devolvido − custo devolvido); o lucro original fica em `sales.profit_before_returns`.
- Recibo PDF: loja, cliente (nome, CPF), venda original (código, data, itens), itens devolvidos com IMEI/serial, valores, formas de estorno, motivo, operador, campo de assinatura; com dinheiro, acima da assinatura: "Declaro que recebi de Mercado do Vale a quantia de R$ X (valor por extenso) em dinheiro, referente à devolução dos itens acima da venda #N."
- Arquivos: só admin; jpg/png/webp/pdf até 12 MB; nunca públicos.
- Área da cliente: item devolvido sai mascarado (regra da v1.2.861 estendida).
- Servidor nos dois arquivos; módulos no `deploy-vps-server-only.cjs`; publicação pelo `publicar.md`.

## Review Focus

1. Duas devoluções simultâneas da mesma venda/item: a segunda não passa do devolvível (`FOR UPDATE` na venda).
2. Mercado Pago aceita o estorno e o banco falha: o id do estorno fica registrado no erro/log para conciliação manual.
3. Venda com estorno parcial de pagamento anterior: "mesma forma" respeita o saldo de cada forma.
4. Item com quantidade > 1 devolvido em duas vezes: estoque e valor acompanham.
5. Arquivo grande/inválido: 400/413 sem gravar nada.

---

### Task 1: Cálculos da devolução (puro)
**Files:** Create `services/saleReturnCore.cjs`; Test `tmp-tests/sale-return-core.test.cjs` (fixture: venda/itens da Eliany, anonimizada).
**Produces:** `itemPaidValues(sale, items) -> Map<saleItemId, cents>`; `returnableItems(sale, items, returnedRows) -> Array<{ saleItemId, productId, name, sku, quantity, returnedQuantity, returnableQuantity, unitValueCents, serializedUnitId, imei }>`; `planSameMethodRefund(payments, amountCents, refundedByIndex) -> Array<{ paymentIndex, method, goodsCents, refundCents, gatewayPaymentId }>`; `validateOtherRefunds(list, amountCents) -> list`; `requiredProofs(refunds) -> refundIds`; `returnStatusOf({ refunds, files }) -> 'pendente'|'finalizada'`; `amountInWords(cents) -> string` ("trezentos reais").
- [ ] testes (valores dos Global Constraints, soma fecha em centavos, limites, estorno parcial anterior, por extenso 30000/191617/215118) → FAIL → implementar → PASS → commit.

### Task 2: Devolução limitada de estoque comum
**Files:** Modify `services/stockMovementRestoration.cjs` (`restoreStockMovements(pool, opts, helpers)` aceita `opts.limits: Map<productId, qty>` e `opts.connection` — usa a conexão dada sem abrir/fechar transação); Test `tmp-tests/stock-movement-restoration-limits.test.cjs`.
- [ ] testes (limite devolve só o pedido; segunda chamada completa; sem limite = comportamento atual) → FAIL → implementar → PASS (+ testes existentes de restauração) → commit.

### Task 3: Servidor da devolução
**Files:** Create `services/saleReturnServer.cjs`; Modify `vps_server.js`/`.cjs` (registro, colunas `sales.return_status`, `sales.profit_before_returns`, tabelas no boot, `/customer/purchases` com itens devolvidos), `services/customerSaleVisibility.cjs` (máscara por item devolvido), `deploy-vps-server-only.cjs`; Test `tmp-tests/sale-return-routes.test.cjs`.
**Produces (admin):** `GET /admin/sales/:saleId/returns` → `{ returnable, returns }`; `POST /admin/sales/:saleId/returns` body `{ items:[{sale_item_id, quantity}], reason, amount_cents?, refund_mode:'same'|'other', refunds?:[{method, amount_cents}], cash_session_id? }` → `{ return }`; `GET /admin/sale-returns?status=pendente`; `POST /admin/sale-returns/:id/files` `{ kind:'proof'|'signed', refund_id?, file_name, file_base64 }`; `GET /admin/sale-returns/:id/files/:fileId`; `POST /admin/sale-returns/:id/whatsapp` `{ pdf_base64 }`.
- [ ] testes (401; devolução parcial grava itens/estornos, aparelho volta ao Depósito com evento, venda `partial`, lucro ajustado; total `full` + `cancelled`; acima do devolvível 409; dinheiro sem caixa 409; crediário 409; arquivo inválido/grande 400/413; status vira finalizada; cliente mascarada) → FAIL → implementar → PASS → commit.

### Task 4: Telas
**Files:** Create `services/saleReturnService.ts`, `utils/saleReturnReceiptPdf.ts`, `components/admin/sales/SaleReturnModal.tsx`, `pages/admin/sales/SaleReturnsPage.tsx`; Modify `components/admin/sales/SaleDetailsModal.tsx` (botão "Devolver itens" e lista "Devoluções desta venda"), `routes/index.tsx` (`/admin/devolucoes`), `layouts/AdminLayout.tsx` (menu "Devoluções"), nginx SPA; Test `tmp-tests/sale-return-ui-static.test.mjs`.
- [ ] teste estático (textos e chamadas; declaração de recebimento no PDF) → FAIL → implementar → teste + build → commit.

### Task 5: Publicação
- [ ] versão `v1.2.864-devolucao-de-itens`; validações; merge/tag/push; API; nginx; site; verificar no navegador sem registrar devolução real (abrir o modal na venda da Eliany, conferir valores sugeridos R$ 1.916,17 e divisão; não confirmar); limpar.
