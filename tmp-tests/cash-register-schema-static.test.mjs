import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const server = readFileSync('vps_server.js', 'utf8');
const serverCjs = readFileSync('vps_server.cjs', 'utf8');

function assertSchema(source, label) {
  for (const snippet of [
    'CREATE TABLE IF NOT EXISTS pdv_cash_sessions',
    'CREATE TABLE IF NOT EXISTS pdv_cash_closings',
    'CREATE TABLE IF NOT EXISTS pdv_cash_movements',
    'CREATE TABLE IF NOT EXISTS pdv_cash_events',
    'CREATE TABLE IF NOT EXISTS pdv_cash_rectifications',
    'CREATE TABLE IF NOT EXISTS pdv_cash_documents',
    "open_operator_key VARCHAR(80) GENERATED ALWAYS AS (IF(status = 'open', operator_user_id, NULL)) STORED",
    'UNIQUE KEY uniq_cash_session_open_operator (open_operator_key)',
    'UNIQUE KEY uniq_cash_closing_session_version (session_id, version)',
    'report_snapshot_json LONGTEXT NOT NULL',
    "type ENUM('opening_float','sangria','suprimento','deposito','retirada','ajuste') NOT NULL",
    "kind ENUM('closing_report','rectification_report') NOT NULL",
    "status ENUM('pending','uploaded','failed') NOT NULL DEFAULT 'pending'",
  ]) {
    assert.ok(source.includes(snippet), `${label} must include ${snippet}`);
  }

  for (const [table, column] of [
    ['sales', 'cash_session_id'],
    ['sales', 'refund_cash_session_id'],
    ['pdv_pix_payments', 'cash_session_id'],
    ['customer_debt_payments', 'cash_session_id'],
    ['customer_delivery_settlements', 'cash_session_id'],
    ['customer_delivery_ledger', 'cash_session_id'],
  ]) {
    assert.ok(
      source.includes(`addColumnIfMissing('${table}', '${column}', 'VARCHAR(80) NULL')`),
      `${label} must add ${table}.${column}`
    );
  }
}

assertSchema(server, 'vps_server.js');
assertSchema(serverCjs, 'vps_server.cjs');

console.log('cash register schema static checks passed');
