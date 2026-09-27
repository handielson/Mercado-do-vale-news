'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reservePriorityStock, reservePriorityStockOnConnection } = require('../services/priorityStockReservation.cjs');

function fixture(initial, { failMovement = false } = {}) {
  const state = { rows: initial.map(row => ({ ...row })), movements: [], connections: 0 };
  let previousLock = Promise.resolve();
  const pool = { async getConnection() {
    state.connections++;
    let rows;
    let movements;
    let unlock;
    let finished = false;
    return {
      async beginTransaction() {},
      async query(sql, params) {
        if (sql.includes('FROM products WHERE id=? LIMIT 1 FOR UPDATE')) {
          const wait = previousLock;
          previousLock = new Promise(resolve => { unlock = resolve; });
          await wait;
          rows = state.rows.map(row => ({ ...row }));
          movements = [];
          return [[{ id: params[0], company_id: 'company-1' }]];
        }
        if (sql.includes('FROM product_stock_locations psl')) {
          return [rows.filter(row => row.product_id === params[0] && row.quantity > row.reserved_quantity)];
        }
        if (sql.startsWith('UPDATE product_stock_locations')) {
          const row = rows.find(candidate => candidate.id === params[1]);
          if (!row || row.quantity - row.reserved_quantity < params[2]) return [{ affectedRows: 0 }];
          row.reserved_quantity += params[0];
          return [{ affectedRows: 1 }];
        }
        if (sql.startsWith('INSERT INTO stock_location_movements')) {
          if (failMovement) throw new Error('movement_failed');
          movements.push(params);
          return [{ affectedRows: 1 }];
        }
        throw new Error(`SQL inesperado: ${sql}`);
      },
      async commit() { state.rows = rows; state.movements.push(...movements); finished = true; unlock(); },
      async rollback() { if (!finished) { finished = true; unlock?.(); } },
      release() {},
    };
  } };
  return { pool, state };
}

const input = (quantity, referenceId = 'order-1') => ({
  product_id: 'product-1', quantity, reference_type: 'order_reservation', reference_id: referenceId,
});

test('dois pedidos concorrentes não reservam a mesma última peça', async () => {
  const { pool, state } = fixture([{ id: 'stock-1', product_id: 'product-1', company_id: 'company-1',
    deposit_id: 'deposit-1', location_id: 'location-1', quantity: 1, reserved_quantity: 0 }]);
  const results = await Promise.all([reservePriorityStock(pool, input(1, 'order-a')), reservePriorityStock(pool, input(1, 'order-b'))]);
  assert.deepEqual(results.map(result => result.status), [200, 400]);
  assert.equal(state.rows[0].reserved_quantity, 1);
  assert.equal(state.movements.length, 1);
});

test('reserva em mais de um local só confirma após todos os movimentos', async () => {
  const rows = [1, 2].map((quantity, index) => ({ id: `stock-${index}`, product_id: 'product-1', company_id: 'company-1',
    deposit_id: `deposit-${index}`, location_id: `location-${index}`, quantity, reserved_quantity: 0 }));
  const good = fixture(rows);
  const response = await reservePriorityStock(good.pool, input(3));
  assert.equal(response.status, 200);
  assert.deepEqual(response.reservations.map(row => row.quantity_reserved), [1, 2]);
  assert.equal(good.state.movements.length, 2);

  const failed = fixture(rows, { failMovement: true });
  await assert.rejects(reservePriorityStock(failed.pool, input(3)), /movement_failed/);
  assert.deepEqual(failed.state.rows.map(row => row.reserved_quantity), [0, 0]);
  assert.equal(failed.state.movements.length, 0);
});

test('recusa quantidade fracionada ou acima do saldo sem movimentação', async () => {
  const { pool, state } = fixture([{ id: 'stock-1', product_id: 'product-1', company_id: 'company-1',
    deposit_id: 'deposit-1', location_id: 'location-1', quantity: 2, reserved_quantity: 0 }]);
  assert.equal((await reservePriorityStock(pool, input(0.5))).status, 400);
  assert.equal(state.connections, 0);
  assert.equal((await reservePriorityStock(pool, input(3))).status, 400);
  assert.equal(state.rows[0].reserved_quantity, 0);
  assert.equal(state.movements.length, 0);
});

test('reserva participa da transação do pedido sem confirmar sozinha', async () => {
  const { pool, state } = fixture([{ id: 'stock-1', product_id: 'product-1', company_id: 'company-1',
    deposit_id: 'deposit-1', location_id: 'location-1', quantity: 2, reserved_quantity: 0 }]);
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  const outcome = await reservePriorityStockOnConnection(connection, input(1));
  assert.equal(outcome.status, 200);
  assert.equal(state.rows[0].reserved_quantity, 0);
  assert.equal(state.movements.length, 0);
  await connection.rollback();
  connection.release();
  assert.equal(state.rows[0].reserved_quantity, 0);
  assert.equal(state.movements.length, 0);
});
