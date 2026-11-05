import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import writeXlsxFile from 'write-excel-file/node';
import { readSheet } from 'read-excel-file/node';
import { rowsToObjects } from '../utils/excel.ts';
import { ENTRY_TEMPLATE_HEADERS, templateExampleRows, rowsToLines } from '../components/entrada/spreadsheetRows.js';

const ctx = {
  models: [{ id: 'm1', name: 'Redmi 15', category_id: 'c1' }],
  categories: [{ id: 'c2', name: 'Acessórios' }],
  locations: [{ id: 'l1', name: 'Loja', code: 'LJ', is_default: true }],
};

test('xlsx real: escrever, ler e converter em linhas', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'excel-rt-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'entrada.xlsx');
  const [phone, cable] = templateExampleRows();
  const toRow = rec => ENTRY_TEMPLATE_HEADERS.map(h => rec[h] === '' ? null : rec[h]);
  const phoneRow = toRow({ ...phone, 'IMEI 1': Number(phone['IMEI 1']) }); // IMEI numérico
  const data = [ENTRY_TEMPLATE_HEADERS, phoneRow, ENTRY_TEMPLATE_HEADERS.map(() => null), toRow(cable)];
  await writeXlsxFile(data).toFile(file);

  const rows = await readSheet(file);
  const records = rowsToObjects(rows);
  assert.equal(records.length, 2);
  assert.deepEqual(records.map(r => r.__row), [2, 4]);
  assert.ok(!Object.keys(records[0]).includes('__row'));

  const r = rowsToLines(records, ctx);
  assert.deepEqual(r.issues, []);
  assert.equal(r.lines.length, 2);
  assert.equal(r.lines[0].item.identity.imei1, phone['IMEI 1']);
  assert.equal(r.lines[0].item.name, 'Redmi 15');
  assert.equal(r.lines[1].item.quantity, 10);
  assert.equal(r.lines[1].item.cost_cents, 850);
});

test('rowsToObjects: vazio e cabeçalho sem dados', () => {
  assert.deepEqual(rowsToObjects([]), []);
  assert.deepEqual(rowsToObjects([['A']]), []);
});
