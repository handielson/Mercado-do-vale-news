import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const mixedSimulator = readFileSync('components/catalog/MixedPaymentSimulator.tsx', 'utf8');
const multiQuote = readFileSync('utils/multiProductQuoteGenerator.ts', 'utf8');
const singleQuote = readFileSync('utils/whatsappMessageGenerator.ts', 'utf8');
const cartShare = readFileSync('utils/cartShareUtils.ts', 'utf8');
const cartPage = readFileSync('pages/store/CartPage.tsx', 'utf8');
const routes = readFileSync('routes/index.tsx', 'utf8');
const quoteModal = readFileSync('components/catalog/QuoteModal.tsx', 'utf8');
const sendWhatsAppBlock = quoteModal.split('const handleSendWhatsApp = async () => {')[1]?.split('// Buy online:')[0] || '';

assert.ok(existsSync('pages/store/QuoteCalculatorPage.tsx'), 'public quote calculator page must exist');
assert.match(routes, /path:\s*"\/calculadora-orcamento"/, 'public quote calculator route must be registered');

assert.match(mixedSimulator, /Valor do orçamento/, 'mixed simulator must show original quote value');
assert.match(mixedSimulator, /cardOptions\??:\s*CardOption\[\]/, 'mixed payment state must expose all card options');
assert.match(mixedSimulator, /Array\.from\(\{\s*length:\s*12\s*\}/, 'mixed simulator must fallback to 1-12 installments');

assert.match(multiQuote, /Calculadora do orcamento:/, 'multi-product WhatsApp quote must include calculator link');
assert.match(multiQuote, /Valor do orcamento:/, 'multi-product WhatsApp quote must include original quote value');
assert.match(multiQuote, /Parcelamento do restante no cartao:/, 'multi-product WhatsApp quote must list card installments when none is selected');
assert.match(multiQuote, /options\.forEach/, 'multi-product WhatsApp quote must iterate all installment options');

assert.match(singleQuote, /Calculadora:/, 'single-product WhatsApp quote must include calculator link');
assert.match(singleQuote, /Valor do orcamento:/, 'single-product WhatsApp quote must include original quote value');
assert.match(singleQuote, /Parcelamento do restante no cartao:/, 'single-product WhatsApp quote must list card installments when none is selected');
assert.doesNotMatch(
  sendWhatsAppBlock,
  /selectedInstallment\s*===\s*null[\s\S]{0,180}alert\(/,
  'single-product quote must not block WhatsApp sending when no card installment is selected',
);

assert.match(cartShare, /buildQuoteCalculatorUrl/, 'cart budget sharing must include quote calculator links');
assert.match(cartShare, /mode\?:\s*BudgetTextMode/, 'cart budget sharing must accept a separated or totalized budget mode');
assert.match(cartShare, /Modo:\s*orçamento separado por aparelho/, 'cart budget sharing must label separated multi-device budgets');
assert.match(cartShare, /Resumo somado/, 'cart budget sharing must support a totalized multi-device summary');
assert.match(cartPage, /budgetMode/, 'cart page must let admins choose separated or totalized budget mode');
assert.match(cartPage, /mixedPaymentState:\s*cartMixedPaymentState/, 'cart page copied budget must use the current Pix/card simulation');
assert.match(quoteModal, /onMixedPaymentChange\?\.\(mixedPaymentState\)/, 'QuoteModal inline simulator must expose mixed payment state to CartPage');

console.log('Quote calculator static checks passed');
