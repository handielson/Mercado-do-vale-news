import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import PaymentSection from '../components/pdv/PaymentSection';
import { adjustFinalCreditPayment, calculateSalePaymentTotals, prepareSalePayments, restoreCreditPayments } from '../utils/saleCalculations';
import { recalculateAPrazoPayment } from '../utils/installmentCalculations';
import type { PaymentMethod, SaleItem } from '../types/sale';
import type { PdvPixPayment } from '../types/pdvDisplay';
import '../index.css';

const items = [{ unit_price: 100000, quantity: 1, discount: 0, unit_cost: 50000, is_gift: false }] as SaleItem[];
const fees = [1, 2, 3, 6, 10, 12].map(installments => ({ payment_method: 'credit', installments, applied_fee: installments === 1 ? 0 : 10, operator_fee: 2 }));
function Preview() {
    const [payments, setPayments] = useState<PaymentMethod[]>([]);
    const [discount, setDiscount] = useState(0);
    const [finalDiscount, setFinalDiscount] = useState(0);
    const [pix, setPix] = useState<PdvPixPayment | null>(null);
    const [saved, setSaved] = useState('');
    const totals = calculateSalePaymentTotals(items, payments, discount, 0, finalDiscount);
    const addPayment = (payment: PaymentMethod) => setPayments(current => recalculateAPrazoPayment([...current, payment], totals.baseTotal + current.reduce((sum, p) => sum + (p.method === 'a_prazo' ? 0 : p.fee_amount || 0), 0)));
    return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-2xl">
        <h1 className="mb-4 text-xl font-bold">PDV · Ambiente de teste</h1>
        <PaymentSection total={totals.total} payments={payments} paymentFees={fees}
            onAddPayment={addPayment} onRemovePayment={index => { setPayments(current => restoreCreditPayments(current).filter((_, i) => i !== index)); setFinalDiscount(0); }}
            promotionalDiscount={discount} onPromotionalDiscountChange={setDiscount}
            finalAdjustmentDiscount={finalDiscount} maxFinalAdjustmentDiscount={totals.totalBeforeFinalAdjustment}
            onApplyFinalPaymentAmount={target => { const next = adjustFinalCreditPayment(totals.baseTotal, payments, target); setPayments(next.payments); setFinalDiscount(next.discount); }}
            onResetFinalPaymentAmount={() => { setPayments(restoreCreditPayments(payments)); setFinalDiscount(0); }}
            selectedCustomer={{ id: 'test', name: 'Cliente de teste' }}
            onSelectInstallment={(installments, amount, fee_amount, operator_fee_amount, operator_fee_percentage, fee_percentage) => addPayment({ method: 'credit', amount, fee_amount, total_with_fee: amount + fee_amount, installments, operator_fee_amount, operator_fee_percentage, fee_percentage })}
            pdvPixPayment={pix}
            onCreatePdvPixPayment={amount => setPix({ id: 'pix-test', amount, status: 'pending' } as PdvPixPayment)}
            onRefreshPdvPixPayment={() => { if (pix) { addPayment({ method: 'pix', amount: pix.amount, total_with_fee: pix.amount, pix_status: 'approved', pix_payment_id: pix.id }); setPix({ ...pix, status: 'approved' }); } }}
            onCancelPdvPixPayment={() => setPix(null)} />
        <button className="mt-4 rounded bg-slate-800 p-3 text-white" onClick={() => setSaved(JSON.stringify({ total: totals.total, payments: prepareSalePayments(totals.total, payments) }))}>Simular salvamento</button>
        <pre data-testid="saved" className="whitespace-pre-wrap break-all">{saved}</pre>
    </div><Toaster /></main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
