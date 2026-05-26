import fs from 'node:fs';
import assert from 'node:assert/strict';

const pdvPage = fs.readFileSync('pages/pdv/PDVPage.tsx', 'utf8');
const paymentSection = fs.readFileSync('components/pdv/PaymentSection.tsx', 'utf8');
const receiptPreview = fs.readFileSync('components/pdv/ReceiptPreview.tsx', 'utf8');
const saleService = fs.readFileSync('services/saleService.ts', 'utf8');
const displayHelper = fs.readFileSync('utils/pdvProductDisplay.ts', 'utf8');

assert.match(
    pdvPage,
    /const handleApplyFinalPaymentAmount = \(targetTotal: number\)/,
    'PDV must expose a final payment amount handler after card installments are selected'
);

assert.match(
    pdvPage,
    /targetCreditTotal = safeTargetTotal - paymentsWithoutAdjustedCredit/,
    'final adjustment must recalculate the selected credit payment instead of only changing sale total'
);

assert.match(
    paymentSection,
    /Valor final cobrado/,
    'payment section must show a final charged amount control'
);

assert.match(
    paymentSection,
    /Parcelas atuais/,
    'payment section must show recalculated installments after the final adjustment'
);

assert.match(
    paymentSection,
    /formatCurrency\(payment\.total_with_fee \?\? payment\.amount\)/,
    'payment list must display the adjusted paid amount'
);

assert.match(
    receiptPreview,
    /formatCurrency\(payment\.total_with_fee \?\? payment\.amount\)/,
    'receipt preview must display the adjusted paid amount'
);

assert.match(
    saleService,
    /const promotionalDiscount = Math\.max\(0, saleInput\.promotional_discount \|\| 0\)/,
    'sale service must persist promotional/final adjustment discounts in sale totals'
);

assert.match(
    displayHelper,
    /productNameAlreadyIncludesColor/,
    'PDV product display helper must avoid duplicate color labels'
);

assert.match(
    pdvPage,
    /buildPdvProductName\(product\.name, \(product as any\)\.specs\)/,
    'PDV cart item names must use the display helper'
);

console.log('pdv final payment adjustment static checks passed');
