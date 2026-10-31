'use strict';

// Ajuste manual do custo de compra de um produto (sem Bling).
// Regras:
// - custo em centavos inteiros (0 é válido);
// - concorrência otimista: o custo anterior informado precisa bater com o atual;
// - aparelhos com IMEI usam o custo de cada unidade e a média móvel: recusa;
// - variação que herda o custo do pai: recusa (alterar no pai/família);
// - grava evidência em specs._acquisition_cost e uma linha em product_price_history;
// - não altera vendas já registradas.

const crypto = require('node:crypto');

const MAX_COST_CENTS = 100_000_000; // R$ 1.000.000,00

class ManualCostError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function parseJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value) || {}; } catch { return {}; }
}

function normalizeCostInput(body = {}) {
  const costCents = Number(body.cost_cents);
  if (!Number.isSafeInteger(costCents) || costCents < 0 || costCents > MAX_COST_CENTS) {
    throw new ManualCostError(400, 'invalid_cost', 'Informe um custo válido em centavos (0 ou maior).');
  }
  const hasExpected = Object.prototype.hasOwnProperty.call(body, 'expected_cost_cents');
  const expectedRaw = body.expected_cost_cents;
  const expected = expectedRaw === null || expectedRaw === undefined || expectedRaw === '' ? null : Number(expectedRaw);
  if (!hasExpected || (expected !== null && !Number.isSafeInteger(expected))) {
    throw new ManualCostError(400, 'expected_cost_required', 'Informe o custo anterior exibido na tela.');
  }
  const note = String(body.note || '').trim().slice(0, 300);
  return { costCents, expectedCostCents: expected, note };
}

/** Por que o custo deste produto não pode ser editado aqui (null = pode). */
function manualCostLockReason(product, unitCount = 0) {
  if (!product) return 'Produto não encontrado.';
  if (Number(product.is_parent) === 1) return 'Produto pai de família: altere o custo nas variações.';
  if (Number(unitCount) > 0) return 'Aparelho com IMEI: o custo vem da compra de cada unidade e da média móvel.';
  const custom = parseJson(product.custom_fields);
  if (custom.inherit_parent_cost === true) return 'Variação herda o custo do produto pai: altere no cadastro da família.';
  return null;
}

function costBasisOf(product) {
  const evidence = parseJson(product?.specs)._acquisition_cost;
  return evidence && typeof evidence === 'object' ? String(evidence.basis || '') || null : null;
}

function createProductManualCostService({ pool, randomUUID = crypto.randomUUID }) {
  async function updateCost(productId, body, actor = {}) {
    const id = String(productId || '').trim();
    if (!id) throw new ManualCostError(400, 'product_required', 'Produto não informado.');
    const input = normalizeCostInput(body);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [[product]] = await connection.query(
        `SELECT id, sku, name, is_parent, price_cost, price_retail, price_reseller, price_wholesale, specs, custom_fields
           FROM products WHERE id = ? LIMIT 1 FOR UPDATE`,
        [id],
      );
      if (!product) throw new ManualCostError(404, 'product_not_found', 'Produto não encontrado.');
      const [[units]] = await connection.query('SELECT COUNT(*) AS total FROM units WHERE product_id = ?', [id]);
      const lockReason = manualCostLockReason(product, units?.total);
      if (lockReason) throw new ManualCostError(409, 'cost_locked', lockReason);

      const currentCost = product.price_cost === null || product.price_cost === undefined ? null : Math.round(Number(product.price_cost));
      if (currentCost !== input.expectedCostCents) {
        throw new ManualCostError(409, 'cost_changed', 'O custo deste produto mudou desde que a tela foi aberta. Atualize e tente de novo.');
      }

      const specs = parseJson(product.specs);
      const previousEvidence = specs._acquisition_cost && typeof specs._acquisition_cost === 'object' ? specs._acquisition_cost : null;
      const evidence = {
        basis: 'manual_operator',
        source: 'admin_manual_cost',
        costCents: input.costCents,
        previousCostCents: currentCost,
        previousBasis: previousEvidence?.basis || null,
        changedAt: new Date().toISOString(),
        changedBy: actor.customerId || null,
        context: String(actor.context || '').slice(0, 80) || null,
        note: input.note || null,
      };
      await connection.query(
        `UPDATE products
            SET price_cost = ?,
                specs = JSON_SET(COALESCE(specs, JSON_OBJECT()), '$._acquisition_cost', CAST(? AS JSON)),
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [input.costCents, JSON.stringify(evidence), id],
      );
      await connection.query(
        `INSERT INTO product_price_history (id, product_id, price_cost, price_retail, price_reseller, price_wholesale)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), id, input.costCents, product.price_retail ?? 0, product.price_reseller ?? 0, product.price_wholesale ?? 0],
      );
      await connection.commit();
      return {
        ok: true,
        product: { id, sku: product.sku, name: product.name, price_cost: input.costCents, previous_price_cost: currentCost, cost_basis: 'manual_operator' },
      };
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }

  return { updateCost };
}

module.exports = {
  ManualCostError,
  normalizeCostInput,
  manualCostLockReason,
  costBasisOf,
  createProductManualCostService,
};
