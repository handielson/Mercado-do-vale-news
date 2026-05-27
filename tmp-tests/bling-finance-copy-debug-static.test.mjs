import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/blingFinanceService.ts', 'utf8');
const page = readFileSync('pages/admin/financial/FinancialPage.tsx', 'utf8');
const debugBuilder = service.match(/function buildFinanceDebug[\s\S]*?\n\}/)?.[0] || '';

assert.match(service, /export interface BlingFinanceDebug/, 'finance service must expose a structured debug payload');
assert.match(service, /export class BlingFinanceError extends Error/, 'finance service must throw a typed debug error');
assert.match(service, /buildFinanceDebug\(url, options, res, json, retriedAfter401\)/, 'finance service must attach request and response context on failures');
assert.match(service, /upstreamDebug: json\?\.debug/, 'finance debug must preserve VPS upstream debug');
assert.doesNotMatch(debugBuilder, /Authorization/i, 'finance debug must not expose Authorization headers');
assert.doesNotMatch(debugBuilder, /(access_token|refresh_token|client_secret)/i, 'finance debug must not expose Bling secrets');

assert.match(page, /lastDebug/, 'FinancialPage must keep the latest debug payload visible');
assert.match(page, /Copiar debug/, 'FinancialPage must render a copy debug action');
assert.match(page, /navigator\.clipboard\.writeText\(financeDebugText\(entry\)\)/, 'FinancialPage must copy the formatted debug payload');
assert.match(page, /handleFinanceError\('Erro ao buscar contas'/, 'FinancialPage must capture list errors with debug');
assert.match(page, /handleFinanceError\('Erro ao registrar baixa'/, 'FinancialPage must capture payment errors with debug');
assert.match(page, /handleFinanceError\('Erro ao editar'/, 'FinancialPage must capture edit errors with debug');

console.log('bling finance copy debug static checks ok');
