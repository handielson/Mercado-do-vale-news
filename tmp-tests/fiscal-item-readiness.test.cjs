const test = require('node:test');
const assert = require('node:assert/strict');
const { validGtin, inspectFiscalSaleItem } = require('../services/fiscalItemReadiness.cjs');

const product = { id: 'p1', ncm: '8517.13.00', origin: '0', cest: '', eans: [] };
const item = { product_id: 'p1', quantity: 1, unit_price: 129900, total: 129900 };
const operation = { unit: 'UN', cfop: '5102', taxTreatment: 'Regra aprovada pelo contador', cestApplicability: 'not_applicable', gtinDecision: 'sem_gtin' };

test('preflight estrutural aceita item com decisões explícitas sem inferir tributos', () => {
  const result = inspectFiscalSaleItem({ product, item, operation });
  assert.equal(result.structurallyReady, true);
  assert.equal(result.fields.ncm, '85171300');
  assert.equal(result.fields.gtin, 'SEM GTIN');
});

test('ausências fiscais retornam pendências sem preencher códigos por padrão', () => {
  const result = inspectFiscalSaleItem({ product: { id: 'p1' }, item, operation: {} });
  assert.equal(result.structurallyReady, false);
  for (const issue of ['ncm_missing_or_invalid', 'origin_missing_or_invalid', 'commercial_unit_missing_or_invalid', 'cfop_missing_or_invalid', 'tax_treatment_missing', 'cest_applicability_undecided', 'gtin_or_sem_gtin_undecided']) {
    assert.ok(result.issues.includes(issue), issue);
  }
});

test('CEST exigido não pode ser omitido; item virtual é segregado', () => {
  const result = inspectFiscalSaleItem({ product: { ...product, is_virtual: true }, item, operation: { ...operation, cestApplicability: 'required' } });
  assert.ok(result.issues.includes('cest_missing_or_invalid'));
  assert.ok(result.issues.includes('virtual_service_requires_separate_document_decision'));
});

test('GTIN válido exige dígito verificador; código inválido não libera item', () => {
  assert.equal(validGtin('7891234567895'), true);
  assert.equal(validGtin('7891234567890'), false);
  const result = inspectFiscalSaleItem({ product: { ...product, eans: ['7891234567890'] }, item, operation });
  assert.ok(result.issues.includes('gtin_invalid'));
});

test('quantidade e dinheiro preservam precisão e centavos inteiros do PDV', () => {
  const result = inspectFiscalSaleItem({ product, item: { ...item, quantity: 1.12345, unit_price: 1299.5 }, operation });
  assert.ok(result.issues.includes('quantity_invalid'));
  assert.ok(result.issues.includes('unit_price_cents_invalid'));
});
