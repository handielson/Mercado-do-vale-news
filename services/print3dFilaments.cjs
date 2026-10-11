'use strict';
const { createHash } = require('node:crypto');
const { FILAMENT_ID } = require('./print3dMaterialStock.cjs');
const fail = (statusCode, message) => { throw Object.assign(new Error(message), { statusCode }); };
const key = value => String(value || '').normalize('NFKC').trim().toLocaleLowerCase('pt-BR');
const version = items => createHash('sha256').update(JSON.stringify(items || [])).digest('hex');
const parse = value => typeof value === 'string' ? JSON.parse(value) : (value || {});
function costPerKg(item) {
  if (Number.isSafeInteger(item.costPerKgCents)) return item.costPerKgCents;
  return item.spoolGrams > 0 ? Math.round(item.spoolCostCents * 1000 / item.spoolGrams) : 0;
}
function normalizeFilament(input, references, previous) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(400, 'Cadastro de filamento inválido.');
  const id = String(input.id || '');
  if (!FILAMENT_ID.test(id)) fail(400, 'Identificador de filamento inválido.');
  const choose = (field, list) => {
    if (typeof input[field] !== 'string' || input[field].length > (field === 'color' ? 120 : 191) || /[\u0000-\u001f\u007f]/.test(input[field])) fail(400, 'Marca, material ou cor inválida.');
    const found = list.find(name => key(name) === key(input[field])) ||
      (previous?.[field] && key(previous[field]) === key(input[field]) ? previous[field] : undefined);
    if (!found) fail(400, `Selecione ${field === 'brand' ? 'uma marca' : field === 'material' ? 'um material' : 'uma cor'} cadastrada.`);
    return found;
  };
  const brand = choose('brand', references.brands);
  const material = choose('material', references.materials);
  const color = choose('color', references.colors);
  if (`${material} · ${brand}`.length > 191) fail(400, 'Marca e material combinados devem ter até 191 caracteres.');
  if (!Number.isSafeInteger(input.costPerKgCents) || input.costPerKgCents <= 0 || input.costPerKgCents > 100000000) fail(400, 'Informe um custo por kg válido em centavos.');
  // Stable IDs are consumed by immutable recipes and the physical stock ledger.
  if (previous && (key(previous.color) !== key(color) || (previous.brand && key(previous.brand) !== key(brand)) || (previous.material && key(previous.material) !== key(material))))
    fail(409, 'Marca, material e cor de um filamento salvo não mudam. Cadastre outra combinação para não misturar o estoque.');
  if (input.active !== undefined && typeof input.active !== 'boolean') fail(400, 'Status inválido.');
  return { id, brand, material, color, name:`${material} · ${brand}`, costPerKgCents:input.costPerKgCents,
    spoolGrams:1000, spoolCostCents:input.costPerKgCents, active:input.active !== false };
}
function upsertFilament(items, input, references) {
  const previous = items.find(item => item.id === input.id);
  const item = normalizeFilament(input, references, previous);
  if (items.some(other => other.id !== item.id && key(other.brand) === key(item.brand) && key(other.material) === key(item.material) && key(other.color) === key(item.color)))
    fail(409, 'Esta combinação de marca, material e cor já existe. Edite o cadastro existente.');
  if (!previous && items.length >= 2000) fail(400, 'Limite de filamentos atingido.');
  return previous ? items.map(other => other.id === item.id ? item : other) : [...items, item];
}
function stockInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Lançamento de estoque inválido.');
  const quantity = Number(body.quantity_grams);
  const milli = Math.round(quantity * 1000);
  const action = body.action;
  if (action !== undefined && !['used','deactivate'].includes(action)) fail(400, 'Operação de filamento inválida.');
  const deactivating = action === 'deactivate';
  if (!['receipt','adjustment'].includes(body.reason) || !FILAMENT_ID.test(String(body.filament_id || '')) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.idempotency_key || '')
    || typeof body.quantity_grams !== 'number' || !Number.isFinite(quantity) || (!milli && !deactivating) || (!deactivating && Math.abs(quantity) > 1000000) || Math.abs(quantity * 1000 - milli) > 0.000001
    || (body.reason === 'receipt' && quantity <= 0)) fail(400, 'Informe entrada positiva ou ajuste em gramas, com até três casas decimais.');
  let note = String(body.note || '').trim();
  if (action) {
    if (body.reason !== 'adjustment' || (action === 'used' && quantity >= 0) || (deactivating && quantity !== -body.expected_grams)) fail(400, 'Usado deve baixar uma quantidade; desativar deve retirar o saldo inteiro.');
    const prefix = action === 'used' ? 'Usado | ' : 'Desativado | ';
    if (!note.startsWith(prefix)) note = prefix + note;
  }
  if (body.entry_date !== undefined) {
    const date = body.entry_date;
    if (body.reason !== 'receipt' || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) fail(400, 'Data de entrada inválida.');
    const prefix = `Data de entrada: ${date} | `;
    if (!note.startsWith(prefix)) note = prefix + note;
  }
  if (!note || note.length > 500 || /[\u0000-\u001f\u007f]/.test(note)) fail(400, 'Informe o motivo do lançamento (até 500 caracteres).');
  if (typeof body.expected_grams !== 'number' || !Number.isFinite(body.expected_grams) || body.expected_grams < 0 || body.expected_grams > 999999999.999 || Math.abs(body.expected_grams * 1000 - Math.round(body.expected_grams * 1000)) > 0.000001) fail(400, 'Atualize o saldo antes de movimentar.');
  return { filament_id:body.filament_id, idempotency_key:body.idempotency_key.toLowerCase(), quantity_grams:milli / 1000, reason:body.reason, note, expected_grams:body.expected_grams, ...(action ? {action} : {}), ...(body.entry_date ? {entry_date:body.entry_date} : {}) };
}
function applyStock(balance, movements, body) {
  const input = stockInput(body);
  const replay = movements.find(m => m.movement_key === input.idempotency_key);
  if (replay) {
    if (replay.filament_id !== input.filament_id || Number(replay.quantity_delta_grams) !== input.quantity_grams || replay.reason !== input.reason || replay.note !== input.note) fail(409, 'Este lançamento já foi usado com outros dados.');
    return { balance, replayed:true, input };
  }
  if (Math.round(balance * 1000) !== Math.round(input.expected_grams * 1000)) fail(409, 'O saldo mudou. Atualize antes de lançar novamente.');
  const next = (Math.round(balance * 1000) + Math.round(input.quantity_grams * 1000)) / 1000;
  if (next < 0) fail(409, 'O lançamento deixaria o estoque negativo.');
  if (next > 999999999.999) fail(400, 'Saldo excede a capacidade do estoque.');
  return { balance:next, replayed:false, input };
}
function initialReceipt(body, filament, items) {
  if (body === undefined) return undefined;
  const input = stockInput(body);
  if (input.filament_id !== filament.id || input.reason !== 'receipt' || input.expected_grams !== 0) fail(400, 'Entrada inicial deve pertencer ao novo filamento, com saldo inicial zero.');
  if (items.some(f => f.id === filament.id)) fail(409, 'Filamento já cadastrado. Use Movimentar estoque para outra entrada.');
  if (filament.active === false) fail(409, 'Escolha um filamento ativo para registrar a entrada.');
  return input;
}
module.exports = { fail, key, version, parse, costPerKg, normalizeFilament, upsertFilament, stockInput, applyStock, initialReceipt };
