import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const mixedSimulator = readFileSync('components/catalog/MixedPaymentSimulator.tsx', 'utf8');
const multiQuote = readFileSync('utils/multiProductQuoteGenerator.ts', 'utf8');
const singleQuote = readFileSync('utils/whatsappMessageGenerator.ts', 'utf8');
const cartShare = readFileSync('utils/cartShareUtils.ts', 'utf8');
const cartPage = readFileSync('pages/store/CartPage.tsx', 'utf8');
const routes = readFileSync('routes/index.tsx', 'utf8');
const calculatorPage = readFileSync('pages/store/QuoteCalculatorPage.tsx', 'utf8');
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

assert.match(singleQuote, /Faça sua simulação:/, 'single-product WhatsApp quote must include calculator link');
assert.match(singleQuote, /Valor do orcamento:/, 'single-product WhatsApp quote must include original quote value');
assert.match(singleQuote, /formatInstallmentLine/, 'single-product WhatsApp quote must format selected and unselected installments consistently');
assert.doesNotMatch(
  sendWhatsAppBlock,
  /selectedInstallment\s*===\s*null[\s\S]{0,180}alert\(/,
  'single-product quote must not block WhatsApp sending when no card installment is selected',
);

assert.match(cartShare, /buildQuoteCalculatorUrl/, 'cart budget sharing must include quote calculator links');
assert.match(cartShare, /mode\?:\s*BudgetTextMode/, 'cart budget sharing must accept a separated or totalized budget mode');
assert.match(cartShare, /Modo:\s*orçamento separado por aparelho/, 'cart budget sharing must label separated multi-device budgets');
assert.match(cartShare, /Resumo somado/, 'cart budget sharing must support a totalized multi-device summary');
assert.match(cartShare, /options\.forEach/, 'cart budget sharing must list 1-12 installments when no installment is selected');
assert.match(cartShare, /formatInstallmentLine/, 'cart budget sharing must use one consistent installment line format');
assert.match(cartShare, /buildRowMixedPaymentState/, 'separated cart budgets must derive Pix/card simulation for each device');
assert.doesNotMatch(
  cartShare,
  /categoryRows\.length\s*===\s*1\s*\?\s*options\.mixedPaymentState\s*:\s*null/,
  'separated multi-device budgets must not drop Pix/card payment details',
);
assert.match(cartShare, /Entrada Pix\/Dinheiro:\s*\$\{brl\(cashCents\)\}/, 'cart budget sharing must always show the Pix/Dinheiro entry value');
assert.match(cartShare, /params\.set\('produto'/, 'cart budget calculator links must include the product name');
assert.match(cartShare, /params\.set\('variacao'/, 'cart budget calculator links must include the selected variation');
assert.match(cartShare, /params\.set\('itens',\s*JSON\.stringify\(quoteItems\)\)/, 'cart budget calculator links must include selectable quote items');
assert.match(cartShare, /calculatorItems:\s*QuoteCalculatorItem\[\]\s*=\s*categoryRows\.map/, 'cart budget sharing must build calculator item cards from budget rows');
assert.match(cartPage, /budgetMode/, 'cart page must let admins choose separated or totalized budget mode');
assert.match(cartPage, /mixedPaymentState:\s*cartMixedPaymentState/, 'cart page copied budget must use the current Pix/card simulation');
assert.match(quoteModal, /onMixedPaymentChange\?\.\(mixedPaymentState\)/, 'QuoteModal inline simulator must expose mixed payment state to CartPage');
assert.match(calculatorPage, /Produto da simulação/, 'public calculator must show product and variation context');
assert.match(calculatorPage, /searchParams\.get\('produto'\)/, 'public calculator must read product name from URL');
assert.match(calculatorPage, /searchParams\.get\('variacao'\)/, 'public calculator must read product variation from URL');
assert.match(calculatorPage, /parseQuoteItems\(searchParams\.get\('itens'\)/, 'public calculator must parse selectable product cards from URL');
assert.match(calculatorPage, /Escolha o aparelho/, 'public calculator must show product-selection cards for multi-item quotes');
assert.match(calculatorPage, /setTotalInput\(formatInput\(item\.total\)\)/, 'public calculator item cards must update the calculator total');
assert.match(calculatorPage, /Compartilhar com a loja/, 'public calculator must let the customer share the selected option with the store');
assert.match(calculatorPage, /Opção escolhida:/, 'public calculator share message must include the selected installment option');

console.log('Quote calculator static checks passed');
