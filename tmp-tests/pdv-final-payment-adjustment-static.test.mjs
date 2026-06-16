import fs from 'node:fs';
import assert from 'node:assert/strict';

const pdvPage = fs.readFileSync('pages/pdv/PDVPage.tsx', 'utf8');
const paymentSection = fs.readFileSync('components/pdv/PaymentSection.tsx', 'utf8');
const receiptPreview = fs.readFileSync('components/pdv/ReceiptPreview.tsx', 'utf8');
const saleService = fs.readFileSync('services/saleService.ts', 'utf8');
const displayHelper = fs.readFileSync('utils/pdvProductDisplay.ts', 'utf8');
const salePresentation = fs.readFileSync('utils/salePresentation.ts', 'utf8');

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
    pdvPage,
    /const adjustedCreditBaseAmount = Math\.round\(targetCreditTotal \/ \(1 \+ appliedFeeRate\)\)/,
    'final adjustment must keep credit amount as the base amount before customer fee'
);

assert.match(
    pdvPage,
    /fee_amount: adjustedCreditFeeAmount/,
    'final adjustment must recalculate the customer fee separately from the base amount'
);

assert.match(
    pdvPage,
    /operator_fee_amount: adjustedOperatorFeeAmount/,
    'final adjustment must recalculate the operator fee from the adjusted base amount'
);

assert.match(
    pdvPage,
    /const saleForPrint = \{ \.\.\.lastSaleData\.sale, customer: lastSaleData\.customer, items: lastSaleData\.items \}/,
    'success modal receipt must carry the selected customer into printSaleReceipt'
);

assert.match(
    pdvPage,
    /setShowSuccessModal\(false\);[\s\S]*setShowWarrantyModal\(true\);/,
    'success modal must be closed before opening the warranty modal so the term is actionable'
);

assert.match(
    salePresentation,
    /const hasDetailedPaymentCosts = payments\.some/,
    'sale financial summary must detect detailed payment operator costs'
);

assert.match(
    salePresentation,
    /const inferredBaseAmount = totalWithFee > 0 && feeAmount > 0 && rawAmount === totalWithFee\s*\?\s*Math\.max\(0, totalWithFee - feeAmount\)\s*:\s*rawAmount/,
    'payment presentation must infer the card base amount by subtracting customer fee from bad legacy card totals'
);

assert.match(
    salePresentation,
    /return sum \+ getPaymentBaseAmount\(payment\)/,
    'sale financial summary must sum base payment amounts instead of total card amounts with customer fees'
);

assert.match(
    salePresentation,
    /getSaleCollectedTotal\(sale, profitData\)[\s\S]*- getSaleCostTotal\(sale, profitData\)[\s\S]*- operatorFeeTotal/,
    'sale financial summary must recompute real profit from collected total, item cost and operator fee'
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
    saleService,
    /const realProfit = saleTotal - customerFeeTotal - totals\.cost_total - paymentOperatorFeeTotal - \(saleInput\.delivery_total \|\| 0\)/,
    'sale service must subtract customer card fee from the card total before calculating real profit'
);

assert.match(
    displayHelper,
    /productNameAlreadyIncludesColor/,
    'PDV product display helper must avoid duplicate color labels'
);

assert.match(
    pdvPage,
    /buildPdvProductName\(product\.name, \(product as any\)\.specs, unitData\)/,
    'PDV cart item names must use the display helper'
);

console.log('pdv final payment adjustment static checks passed');
