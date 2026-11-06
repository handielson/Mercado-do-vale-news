// entry-location-groups-v1: o Local da Entrada mostra os locais agrupados pelo depósito.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupEntryLocations, defaultEntryLocationId, NO_DEPOSIT_LABEL } from '../components/entrada/entryLocationGroups.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const deposits = [
  { id: 'dep', name: 'Depósito', is_default: false, is_active: true },
  { id: 'loja', name: 'Loja', is_default: true, is_active: true },
  { id: 'velho', name: 'Antigo', is_default: false, is_active: false },
];
const loc = (id, deposit_id, name, extra = {}) => ({ id, deposit_id, name, is_active: true, is_default: false, ...extra });
const locations = [
  loc('c10', 'loja', 'Caixa 10'),
  loc('c2', 'loja', 'Caixa 02'),
  loc('c1', 'loja', 'Caixa 1'),
  loc('geral', 'loja', 'Estoque Geral', { is_default: true }),
  loc('p1', 'dep', 'Prateleira 1'),
  loc('dg', 'dep', 'Estoque Geral'),
  loc('inativo', 'loja', 'Caixa 99', { is_active: false }),
  loc('x', 'velho', 'Caixa Velha'),
  loc('orfao', 'sumiu', 'Balcão'),
];

test('agrupa por depósito, com o padrão primeiro e o nome do depósito como título', () => {
  const groups = groupEntryLocations(locations, deposits);
  assert.deepEqual(groups.map(g => g.label), ['Loja', 'Depósito', NO_DEPOSIT_LABEL]);
  assert.deepEqual(groups.map(g => g.depositId), ['loja', 'dep', null]);
});

test('dentro do depósito: local padrão no topo e o resto em ordem natural', () => {
  const [loja, dep] = groupEntryLocations(locations, deposits);
  assert.deepEqual(loja.locations.map(l => l.name), ['Estoque Geral', 'Caixa 1', 'Caixa 02', 'Caixa 10']);
  assert.deepEqual(dep.locations.map(l => l.name), ['Estoque Geral', 'Prateleira 1']);
});

test('local inativo e local de depósito desativado ficam fora', () => {
  const ids = groupEntryLocations(locations, deposits).flatMap(g => g.locations.map(l => l.id));
  assert.ok(!ids.includes('inativo'));
  assert.ok(!ids.includes('x'));
  assert.ok(ids.includes('orfao'), 'local com depósito desconhecido não some: vai para "Sem depósito"');
});

test('pré-seleção: local padrão do depósito padrão', () => {
  assert.equal(defaultEntryLocationId(groupEntryLocations(locations, deposits)), 'geral');
  assert.equal(defaultEntryLocationId([]), '');
});

test('depósitos sem carregar: locais aparecem sem grupo em vez de sumir', () => {
  const groups = groupEntryLocations(locations, null);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, null);
  assert.equal(groups[0].locations.length, 8);
});

test('Manual, Bipar e Foto usam o select agrupado (nada de lista solta de locais)', () => {
  const hook = read('components/entrada/EntryLockFields.tsx');
  assert.match(hook, /listDeposits\(\)/);
  assert.match(hook, /<optgroup key=\{[^}]+\} label=\{group\.label\}>/);
  for (const tab of ['ManualEntryTab', 'ScanEntryTab', 'PhotoEntryTab']) {
    const source = read(`components/entrada/${tab}.tsx`);
    assert.match(source, /<EntryLocationOptions groups=\{locationGroups\} \/>/, `${tab} deve usar EntryLocationOptions`);
    assert.doesNotMatch(source, /locations\.map\(l => <option/, `${tab} não pode voltar à lista sem depósito`);
  }
});
