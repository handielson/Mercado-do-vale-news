import test from 'node:test';
import assert from 'node:assert/strict';
import { accountingPeriod, calcSimples, currentAccountingCompetence, SIMPLES_ANEXOS } from '../services/simplesNacional.ts';

test('limites oficiais, inclusive o centavo após cada faixa, em todos os anexos', () => {
    const limits = [180000, 360000, 720000, 1800000, 3600000, 4800000];
    for (const anexo of Object.keys(SIMPLES_ANEXOS)) {
        limits.forEach((limit, i) => {
            assert.equal(calcSimples(limit, anexo).faixa, i + 1);
            if (i < 5) assert.equal(calcSimples(limit + .01, anexo).faixa, i + 2);
        });
    }
    assert.equal(calcSimples(1500000, 'I').faixa, 4);
    assert.equal(calcSimples(2000000, 'I').faixa, 5);
    assert.equal(calcSimples(4000000, 'I').faixa, 6);
});
test('fórmula efetiva e deduções dos cinco anexos', () => {
    assert.ok(Math.abs(calcSimples(224348.74, 'I').aliquotaEfetiva - .04652336367032861) < 1e-12);
    const expected = { I: [.19,378000], II: [.30,720000], III: [.33,648000], IV: [.33,828000], V: [.305,540000] };
    for (const [anexo, [rate, deduction]] of Object.entries(expected)) {
        const result = calcSimples(4800000, anexo);
        assert.equal(result.aliquotaNominal, rate);
        assert.equal(result.deducao, deduction);
        assert.equal(result.aliquotaEfetiva, (4800000 * rate - deduction) / 4800000);
    }
});
test('dados inválidos e excesso do limite não produzem uma alíquota falsa', () => {
    for (const value of [0, -1, NaN, Infinity, 4800000.01]) assert.equal(calcSimples(value, 'I'), null);
    assert.equal(calcSimples(100000, 'invalid'), null);
});
test('RBT12 usa meses fechados anteriores, incluindo virada de ano e fevereiro bissexto', () => {
    const october = accountingPeriod('2026-10');
    assert.equal(october.from, '2025-10-01');
    assert.equal(october.to, '2026-09-30');
    assert.equal(october.currentFrom, '2026-10-01');
    assert.equal(october.currentTo, '2026-10-31');
    assert.equal(october.months.length, 12);
    assert.equal(accountingPeriod('2026-01').from, '2025-01-01');
    assert.equal(accountingPeriod('2026-01').to, '2025-12-31');
    assert.equal(accountingPeriod('2024-03').to, '2024-02-29');
    assert.equal(accountingPeriod('2026-13'), null);
    assert.equal(accountingPeriod(''), null);
    assert.equal(accountingPeriod('2027-01'), null);
});
test('competência segue São Paulo na virada de mês UTC', () => {
    assert.equal(currentAccountingCompetence(new Date('2026-10-01T01:00:00Z')), '2026-09');
});
