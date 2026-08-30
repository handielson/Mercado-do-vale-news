/**
 * Sale Service
 * Service for managing sales (PDV) in VPS
 */

import {
    Sale,
    SaleInput,
    SaleWithItems,
    SaleFilters,
    SaleSummary,
    SaleItem,
    PaymentMethod,
    PaymentMethodType
} from '../types/sale';
import { calculateSaleTotals } from '../utils/saleCalculations';
import { promotionService } from './promotionService';
import { benefitService } from './benefitService';
import { syncStockToBling } from './blingService';
import type { BlingComboSelection } from './blingComboStock';
import { cancelReferralReward, processReferralReward } from './cashbackService';
import { unitService } from './units';
import { stockLocationService } from './stockLocationService';
import { vpsApiService } from './vpsApiService';
import { vpsClient } from './vpsClient';
import { deliveryCreditService } from './deliveryCreditService';
import { moneyReaisToCents, moneyToCents } from '../utils/money';
import { getSaleCollectedTotal, getSaleCostTotal, getSaleRealProfit } from '../utils/salePresentation';
import { UnitStatus } from '../utils/field-standards';
import type { StockLocationPriorityDecrementResult, StockLocationSaleRestoreResult } from '../types/stock-location';
import type { OrderWithItems } from '../types/order';
import { formatReferenceNumber } from '../utils/referenceNumber';

const decrementSaleStockByPriority = async (item: SaleItem, saleId: string): Promise<StockLocationPriorityDecrementResult[]> => {
    if (!item.product_id) return [];

    try {
        return await stockLocationService.decrementStockByPriority({
            product_id: item.product_id,
            quantity: item.quantity,
            reason: `Venda PDV #${formatReferenceNumber(saleId)}`,
            reference_type: 'sale',
            reference_id: saleId,
            notes: 'Baixa automatica por prioridade: Loja Principal antes dos demais depositos.',
        });
    } catch (priorityError) {
        console.error(`[saleService] Falha na baixa por prioridade do produto ${item.product_id}:`, priorityError);
        throw priorityError;
    }
};
type SaleStockRestoreItem = {
    product_id: string | null;
    quantity: number;
    serialized_unit_id?: string | null;
    serialized_unit?: { unitId?: string | null } | null;
    combo_selections?: BlingComboSelection[] | null;
    comboSelections?: BlingComboSelection[] | null;
};

const restoreSaleStockForItems = async (
    saleId: string,
    items: SaleStockRestoreItem[] | null | undefined,
    reason: string
): Promise<StockLocationSaleRestoreResult[]> => {
    try {
        return await stockLocationService.restoreSaleStockByLocation({
            sale_id: saleId,
            reason,
            notes: 'Devolucao automatica pelo fluxo de venda PDV.',
        });
    } catch (restoreError) {
        console.error(`[saleService] Falha ao restaurar estoque por local da venda ${saleId}:`, restoreError);
        throw restoreError;
    }
};

const releaseSaleSerializedUnits = async (
    saleId: string,
    items: SaleStockRestoreItem[] | null | undefined
): Promise<Set<string>> => {
    const unitToProduct = new Map<string, string>();
    for (const item of items || []) {
        const unitId = String(item.serialized_unit_id || item.serialized_unit?.unitId || '').trim();
        const productId = String(item.product_id || '').trim();
        if (unitId && productId) unitToProduct.set(unitId, productId);
    }
    if (unitToProduct.size === 0) return new Set();

    const units = await unitService.listByIds([...unitToProduct.keys()]);
    const releasedProductIds = new Set<string>();
    for (const unit of units) {
        if (String(unit.sale_id || '') !== saleId) continue;
        if (![UnitStatus.SOLD, UnitStatus.RESERVED].includes(unit.status)) continue;
        await unitService.release(unit.id);
        const productId = unitToProduct.get(unit.id);
        if (productId) releasedProductIds.add(productId);
    }
    return releasedProductIds;
};

const syncReturnedSaleStockToBling = async (
    items: SaleStockRestoreItem[] | null | undefined,
    returnedProductIds: Set<string>,
    notes: string
): Promise<void> => {
    for (const item of items || []) {
        const productId = String(item.product_id || '').trim();
        const quantity = Number(item.quantity) || 0;
        if (!productId || quantity <= 0 || !returnedProductIds.has(productId)) continue;
        await syncStockToBling(productId, quantity, notes, {
            operation: 'E',
            comboSelections: item.combo_selections || item.comboSelections || undefined,
        });
    }
};

const restoreCancelledSaleInventory = async (
    saleId: string,
    items: SaleStockRestoreItem[] | null | undefined,
    reason: string
): Promise<void> => {
    const restored = await restoreSaleStockForItems(saleId, items, reason);
    const returnedProductIds = new Set(
        restored.map((row) => String(row.product_id || '')).filter(Boolean)
    );
    const releasedProductIds = await releaseSaleSerializedUnits(saleId, items);
    for (const productId of releasedProductIds) returnedProductIds.add(productId);
    await syncReturnedSaleStockToBling(items, returnedProductIds, reason);
};

interface TableDataResponse<T> {
    rows?: T[];
    total?: number;
}

function parseJsonField<T>(value: unknown, fallback: T): T {
    if (value == null || value === '') return fallback;
    if (typeof value !== 'string') return value as T;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

function resolveDeliveryPersonCustomerId(saleInput: SaleInput): string | null {
    const explicit = String(saleInput.delivery_person_customer_id || '').trim();
    if (explicit) return explicit;
    const personId = String(saleInput.delivery_person_id || '').trim();
    return personId.startsWith('customer:') ? personId.slice('customer:'.length) : null;
}

function resolveLegacyDeliveryPersonId(saleInput: SaleInput): string | null {
    const personId = String(saleInput.delivery_person_id || '').trim();
    if (!personId || personId.startsWith('customer:')) return null;
    return personId;
}

function createLocalId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type SaleFinalizationIssue = {
    step: string;
    message: string;
    name?: string;
    debug?: unknown;
    timestamp: string;
};

type SaleFinalizationWarning = {
    step: string;
    message: string;
    details?: unknown;
    timestamp: string;
};

function normalizeFinalizationError(error: unknown, step: string): SaleFinalizationIssue {
    const record = error && typeof error === 'object' ? error as any : null;
    return {
        step,
        message: error instanceof Error ? error.message : String(error || 'Erro desconhecido'),
        name: error instanceof Error ? error.name : undefined,
        debug: record?.debug || record?.response?.debug || record?.response?.data?.debug || record?.data?.debug || null,
        timestamp: new Date().toISOString(),
    };
}

function appendIssueToFinalizationLog(
    logValue: unknown,
    saleId: string,
    status: 'success' | 'needs_review',
    issues: SaleFinalizationIssue[],
    warnings: SaleFinalizationWarning[] = []
): string {
    const base = typeof logValue === 'string' && logValue.trim()
        ? parseJsonField<Record<string, unknown>>(logValue, { raw_log: logValue })
        : (logValue && typeof logValue === 'object' ? logValue as Record<string, unknown> : {});
    return JSON.stringify({
        ...base,
        sale_id: saleId,
        finalization_status: status,
        finalization_issues: issues,
        finalization_warnings: warnings,
        updated_at: new Date().toISOString(),
    }, null, 2);
}

function isMainStoreStockDecrement(row: StockLocationPriorityDecrementResult): boolean {
    return Boolean(row.deposit_is_default && row.location_is_default);
}

function formatStockLocationLabel(row: StockLocationPriorityDecrementResult): string {
    const deposit = row.deposit_name || row.deposit_code || row.deposit_id || 'Deposito sem nome';
    const location = row.location_name || row.location_code || row.location_id || 'Local sem nome';
    return `${deposit} / ${location}`;
}
function serializeJsonValue(value: unknown): unknown {
    if (value == null || value === '') return null;
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
}

function summarizePaymentMethodForSalesTable(paymentMethods: PaymentMethod[] = []): string | null {
    const methods = paymentMethods.map(payment => payment.method).filter(Boolean);
    if (methods.length === 0) return null;
    return Array.from(new Set(methods)).join(',');
}

function paymentMethodFromSalesTable(value: unknown, amount: number): PaymentMethod[] {
    const method = String(value || '').split(',')[0].trim() as PaymentMethodType;
    if (!method) return [];
    return [{
        method,
        amount,
        total_with_fee: amount,
    }];
}

function serializeSaleRowForTable<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
    return {
        id: row.id,
        customer_id: row.customer_id || null,
        seller_id: row.seller_id || null,
        total: row.total || 0,
        discount: row.discount || 0,
        subtotal: row.subtotal || 0,
        discount_total: row.discount_total || row.discount || 0,
        cost_total: row.cost_total || 0,
        profit: row.profit || 0,
        payment_method: row.payment_method || null,
        payment_methods: serializeJsonValue(row.payment_methods),
        payment_status: row.payment_status || 'paid',
        notes: row.notes || null,
        delivery_type: row.delivery_type || null,
        delivery_person_id: row.delivery_person_id || null,
        delivery_person_customer_id: row.delivery_person_customer_id || null,
        delivery_cost_store: row.delivery_cost_store || 0,
        delivery_cost_customer: row.delivery_cost_customer || 0,
        delivery_total: row.delivery_total || 0,
        promotional_discount: row.promotional_discount || 0,
        coupon_code: row.coupon_code || null,
        coupon_id: row.coupon_id || null,
        final_adjustment_discount: row.final_adjustment_discount || 0,
        referral_code: row.referral_code || null,
        finalization_status: row.finalization_status || 'success',
        finalization_log: row.finalization_log || null,
        finalization_error_summary: row.finalization_error_summary || null,
        cash_session_id: row.cash_session_id || null,
        refund_cash_session_id: row.refund_cash_session_id || null,
    };
}

function serializeSaleItemRowForTable(item: SaleItem, saleId: string): Record<string, unknown> {
    const quantity = Number(item.quantity) || 1;
    const unitPrice = moneyToCents(item.unit_price || 0);
    const subtotal = moneyToCents(item.subtotal || item.total || unitPrice * quantity || 0);
    const total = moneyToCents(item.total || subtotal || 0);

    return {
        sale_id: saleId,
        product_id: item.product_id || null,
        product_name: item.product_name || null,
        product_sku: item.product_sku || null,
        quantity,
        unit_price: unitPrice,
        unit_cost: moneyToCents(item.unit_cost || 0),
        discount: moneyToCents(item.discount || 0),
        subtotal,
        total,
        warranty_months: item.warranty_months || 0,
        imei: item.serialized_unit?.imei1 || item.serialized_unit?.serial || null,
        serialized_unit_id: item.serialized_unit?.unitId || null,
    };
}

function toNumber(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function hasDecimalMoney(value: unknown): boolean {
    const n = Number(value);
    return Number.isFinite(n) && Math.abs(n - Math.round(n)) > 0.001;
}

function looksLikeCentStoredMoney(value: unknown): boolean {
    const n = Math.abs(Number(value));
    return Number.isFinite(n) && Math.abs(n - Math.round(n)) <= 0.001 && n >= 1000;
}

function scaleMoneyValue(value: unknown, moneyScale: number): number {
    return Math.round(toNumber(value) * moneyScale);
}

function normalizePaymentMethods(paymentMethods: PaymentMethod[], moneyScale: number): PaymentMethod[] {
    return paymentMethods.map((payment) => ({
        ...payment,
        amount: scaleMoneyValue(payment.amount, moneyScale),
        fee_amount: payment.fee_amount == null ? payment.fee_amount : scaleMoneyValue(payment.fee_amount, moneyScale),
        operator_fee_amount: (payment as any).operator_fee_amount == null ? (payment as any).operator_fee_amount : scaleMoneyValue((payment as any).operator_fee_amount, moneyScale),
        total_with_fee: scaleMoneyValue(payment.total_with_fee ?? payment.amount, moneyScale),
    }));
}

function getDefaultDebtDueDate(): string {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    return dueDate.toISOString().split('T')[0];
}

function getAPrazoPayment(paymentMethods: PaymentMethod[] = []): PaymentMethod | null {
    const aPrazoPayments = paymentMethods.filter(payment => payment.method === 'a_prazo' && Number(payment.amount) > 0);
    if (aPrazoPayments.length > 1) {
        throw new Error('Venda não pode conter múltiplos pagamentos a prazo.');
    }
    return aPrazoPayments[0] || null;
}

async function createCustomerDebtForAPrazoSale(saleInput: SaleInput, sale: Sale): Promise<void> {
    const aPrazoPayment = getAPrazoPayment(saleInput.payment_methods);
    if (!aPrazoPayment) return;
    if (!saleInput.customer_id) return;

    const saleCode = sale.id.slice(0, 8).toUpperCase();
    const schedule = aPrazoPayment.installment_schedule;

    if (Array.isArray(schedule) && schedule.length > 1) {
        await vpsClient.post('/financial/customer-debts/from-sale', {
            customer_id: saleInput.customer_id,
            sale_id: sale.id,
            valor_total: aPrazoPayment.total_with_fee ?? aPrazoPayment.amount,
            descricao: `Venda PDV #${saleCode}`,
            data_vencimento: schedule[0]?.due_date || aPrazoPayment.due_date || getDefaultDebtDueDate(),
            installments: schedule.map(item => ({
                installment_number: item.installment_number,
                installment_count: item.installment_count,
                amount: item.amount,
                due_date: item.due_date,
                descricao: `Venda PDV #${saleCode} — Parcela ${item.installment_number}/${item.installment_count}`,
            })),
        });
    } else {
        await vpsClient.post('/financial/customer-debts/from-sale', {
            customer_id: saleInput.customer_id,
            sale_id: sale.id,
            valor_total: aPrazoPayment.total_with_fee ?? aPrazoPayment.amount,
            descricao: `Venda PDV #${saleCode}`,
            data_vencimento: aPrazoPayment.due_date || getDefaultDebtDueDate(),
        });
    }
}

function shouldScaleSaleMoneyFromReais(sale: any, saleItems: any[] = []): boolean {
    const saleMoneyValues = [
        sale.total,
        sale.discount,
        sale.discount_total,
        sale.subtotal,
        sale.delivery_total,
        sale.delivery_cost_store,
        sale.delivery_cost_customer,
    ];
    const itemMoneyValues = saleItems.flatMap(item => [
        item.unit_price,
        item.total,
        item.subtotal,
        item.discount,
        item.warranty_price,
    ]);
    const moneyValues = [
        ...saleMoneyValues,
        ...saleItems.flatMap(item => [
            item.unit_price,
            item.total,
            item.subtotal,
            item.discount,
            item.warranty_price,
        ]),
    ];

    if (itemMoneyValues.some(looksLikeCentStoredMoney)) return false;

    return moneyValues.some(hasDecimalMoney);
}

function normalizeSaleRow(row: any, moneyScale = 1): Sale {
    const rawTotal = toNumber(row.total);
    const discountTotal = scaleMoneyValue(row.discount_total ?? row.discount, moneyScale);
    const total = scaleMoneyValue(rawTotal, moneyScale);
    const paymentMethods = Array.isArray(row.payment_methods)
        ? row.payment_methods
        : parseJsonField(row.payment_methods, paymentMethodFromSalesTable(row.payment_method, rawTotal));

    return {
        ...row,
        subtotal: row.subtotal == null ? total + discountTotal : scaleMoneyValue(row.subtotal, moneyScale),
        discount_total: discountTotal,
        total,
        cost_total: scaleMoneyValue(row.cost_total, moneyScale),
        profit: scaleMoneyValue(row.profit, moneyScale),
        delivery_cost_store: scaleMoneyValue(row.delivery_cost_store, moneyScale),
        delivery_cost_customer: scaleMoneyValue(row.delivery_cost_customer, moneyScale),
        delivery_total: scaleMoneyValue(row.delivery_total, moneyScale),
        promotional_discount: scaleMoneyValue(row.promotional_discount, moneyScale),
        payment_methods: normalizePaymentMethods(paymentMethods, moneyScale),
        status: row.status || (row.payment_status === 'cancelled' ? 'cancelled' : 'completed'),
    } as Sale;
}

function saleRowUsesLegacyDecimalItemMoney(saleRow?: any): boolean {
    if (!saleRow) return false;
    const hasModernSubtotal = Number(saleRow.subtotal || 0) > 0;
    const hasModernPaymentMethods = saleRow.payment_methods != null && saleRow.payment_methods !== '';
    const totalLooksDecimalReais = typeof saleRow.total === 'string'
        && /\.\d{2}$/u.test(saleRow.total)
        && !looksLikeCentStoredMoney(saleRow.total);
    return totalLooksDecimalReais && !hasModernSubtotal && !hasModernPaymentMethods;
}

function normalizeSaleItemMoney(value: unknown, saleRow?: any): number {
    return saleRowUsesLegacyDecimalItemMoney(saleRow) ? moneyReaisToCents(value) : moneyToCents(value);
}

function normalizeSaleItemRow(row: any, saleRow?: any): SaleItem {
    const quantity = Number(row.quantity) || 0;
    const rawUnitPrice = normalizeSaleItemMoney(row.unit_price, saleRow);
    const rawTotal = row.total == null ? 0 : normalizeSaleItemMoney(row.total, saleRow);
    const unitPrice = rawUnitPrice > 0
        ? rawUnitPrice
        : (quantity > 0 && rawTotal > 0 ? Math.round(rawTotal / quantity) : 0);
    const total = rawTotal > 0 ? rawTotal : unitPrice * quantity;
    const rawSubtotal = row.subtotal == null ? 0 : normalizeSaleItemMoney(row.subtotal, saleRow);

    return {
        ...row,
        quantity,
        unit_price: unitPrice,
        unit_cost: normalizeSaleItemMoney(row.unit_cost, saleRow),
        discount: normalizeSaleItemMoney(row.discount, saleRow),
        subtotal: rawSubtotal > 0 ? rawSubtotal : total,
        total,
        is_gift: row.is_gift === true || row.is_gift === 1,
    } as SaleItem;
}

function calculateSaleProfitFromCurrentData(sale: SaleWithItems): { total_cost: number; profit: number } {
    const saleWithCurrentItemCosts = {
        ...sale,
        cost_total: 0,
        profit: 0,
    } as SaleWithItems;
    return {
        total_cost: getSaleCostTotal(saleWithCurrentItemCosts),
        profit: getSaleRealProfit(saleWithCurrentItemCosts),
    };
}

async function loadTableRows<T>(tableName: string): Promise<T[]> {
    const allRows: T[] = [];
    const pageSize = 200;

    for (let offset = 0; ; offset += pageSize) {
        const data = await vpsClient.get<TableDataResponse<T>>(
            `/table-data/${encodeURIComponent(tableName)}?limit=${pageSize}&offset=${offset}`
        );
        const rows = Array.isArray(data.rows) ? data.rows : [];
        allRows.push(...rows);
        if (rows.length < pageSize) break;
    }

    return allRows;
}

async function loadSaleRows(): Promise<Sale[]> {
    const rows = await loadTableRows<any>('sales');
    return rows.map(normalizeSaleRow);
}

async function loadSaleItemsBySaleId(saleId: string): Promise<SaleItem[]> {
    const rows = await loadTableRows<any>('sale_items');
    const saleRows = await loadTableRows<any>('sales');
    const sale = saleRows.find(row => String(row.id) === String(saleId));
    const saleItems = rows.filter(row => String(row.sale_id || '') === String(saleId));
    return saleItems.map(row => normalizeSaleItemRow(row, sale));
}

async function loadSaleWithItemsById(saleId: string): Promise<SaleWithItems | null> {
    const [saleRows, itemRows, customers, teamMembers] = await Promise.all([
        loadTableRows<any>('sales'),
        loadTableRows<any>('sale_items'),
        loadTableRows<any>('customers'),
        loadTableRows<any>('team_members'),
    ]);
    const saleRow = saleRows.find(row => String(row.id) === String(saleId));
    if (!saleRow) return null;

    const saleItemRows = itemRows.filter(row => String(row.sale_id || '') === String(saleId));
    const moneyScale = shouldScaleSaleMoneyFromReais(saleRow, saleItemRows) ? 100 : 1;
    const sale = normalizeSaleRow(saleRow, moneyScale);
    const items = saleItemRows.map(row => normalizeSaleItemRow(row, saleRow));

    const customer = customers.find(row => String(row.id || '') === String(sale.customer_id));
    const seller = teamMembers.find(row => String(row.id || '') === String(sale.seller_id || ''));

    return {
        ...sale,
        items,
        customer: customer ? {
            id: String(customer.id),
            name: String(customer.name || ''),
            cpf_cnpj: customer.cpf_cnpj ? String(customer.cpf_cnpj) : undefined,
        } : undefined,
        seller: seller ? {
            id: String(seller.id),
            name: String(seller.name || ''),
        } : undefined,
    };
}

async function loadCustomerNameById(customerId?: string | null): Promise<string> {
    if (!customerId) return 'Cliente';

    const customers = await loadTableRows<any>('customers');
    const customer = customers.find(row => String(row.id || '') === String(customerId));
    return String(customer?.name || 'Cliente');
}

function saleMatchesFilters(sale: Sale, filters?: SaleFilters): boolean {
    if (filters?.customer_id && String(sale.customer_id || '') !== String(filters.customer_id)) return false;
    if (filters?.seller_id && String(sale.seller_id || '') !== String(filters.seller_id)) return false;
    if (filters?.status && sale.status !== filters.status) return false;
    if (filters?.start_date && String(sale.created_at || '') < String(filters.start_date)) return false;
    if (filters?.end_date && String(sale.created_at || '') > String(filters.end_date)) return false;
    if (filters?.min_total && sale.total < filters.min_total) return false;
    if (filters?.max_total && sale.total > filters.max_total) return false;
    return true;
}

export async function patchSale(id: string, patch: Partial<Sale>): Promise<Sale> {
    const tablePatch: Record<string, unknown> = { ...patch };
    if (Object.prototype.hasOwnProperty.call(tablePatch, 'status')) {
        tablePatch.payment_status = tablePatch.status === 'cancelled' || tablePatch.status === 'refunded'
            ? 'cancelled'
            : 'paid';
        delete tablePatch.status;
    }
    if (Object.prototype.hasOwnProperty.call(tablePatch, 'payment_methods')) {
        tablePatch.payment_methods = serializeJsonValue(tablePatch.payment_methods);
    }

    return normalizeSaleRow(await vpsClient.patch<any>(
        `/table-data/sales/${encodeURIComponent(id)}?pk=id`,
        tablePatch
    ));
}

async function deleteSaleRow(id: string): Promise<void> {
    await vpsClient.delete(`/table-data/sales/${encodeURIComponent(id)}?pk=id`);
}

/**
 * Create a new sale
 */
export const createSale = async (saleInput: SaleInput): Promise<Sale> => {
    try {
        const invalidSerializedItem = saleInput.items.find((item) => {
            const serialized = item.serialized_unit;
            const hasIdentifier = Boolean(serialized?.imei1 || serialized?.imei2 || serialized?.serial);
            return hasIdentifier && !serialized?.unitId;
        });
        if (invalidSerializedItem) {
            throw new Error(
                `O item serializado "${invalidSerializedItem.product_name}" nao possui uma unidade de estoque valida. `
                + 'Atualize a busca e selecione um IMEI disponivel antes de concluir a venda.'
            );
        }

        // Calculate totals from items
        const totals = calculateSaleTotals(saleInput.items);

        const promotionalDiscount = Math.max(0, saleInput.promotional_discount || 0);
        const discountTotal = totals.discount_total + (saleInput.delivery_cost_store || 0) + promotionalDiscount;
        const paymentCollectedTotal = (saleInput.payment_methods || []).reduce((sum, payment) => {
            return sum + moneyToCents(payment.total_with_fee ?? payment.amount ?? 0);
        }, 0);
        const customerFeeTotal = (saleInput.payment_methods || []).reduce((sum, payment) => {
            return sum + moneyToCents(payment.fee_amount || 0);
        }, 0);
        const paymentOperatorFeeTotal = (saleInput.payment_methods || []).reduce((sum, payment) => {
            return sum + moneyToCents(payment.operator_fee_amount || 0);
        }, 0);
        const computedSaleTotal = Math.max(0, totals.total + (saleInput.delivery_cost_customer || 0) + customerFeeTotal - promotionalDiscount);
        const saleTotal = paymentCollectedTotal > 0 ? paymentCollectedTotal : computedSaleTotal;
        const realProfit = saleTotal - totals.cost_total - paymentOperatorFeeTotal - (saleInput.delivery_total || 0);
        const finalizationIssues: SaleFinalizationIssue[] = [];
        const finalizationWarnings: SaleFinalizationWarning[] = [];
        const recordFinalizationIssue = (step: string, error: unknown) => {
            const issue = normalizeFinalizationError(error, step);
            finalizationIssues.push(issue);
            console.error(`[saleService] Venda registrada com erro em ${step}:`, error);
            return issue;
        };
        const recordFinalizationWarning = (step: string, message: string, details?: unknown) => {
            const warning = { step, message, details, timestamp: new Date().toISOString() };
            finalizationWarnings.push(warning);
            console.warn(`[saleService] Venda registrada com aviso em ${step}: ${message}`);
            return warning;
        };

        const aPrazoPayments = (saleInput.payment_methods || []).filter(p => p.method === 'a_prazo' && Number(p.amount) > 0);
        if (aPrazoPayments.length > 1) {
            throw new Error('Venda não pode conter múltiplos pagamentos a prazo.');
        }

        const saleId = createLocalId();
        const deliveryPersonCustomerId = resolveDeliveryPersonCustomerId(saleInput);
        const legacyDeliveryPersonId = resolveLegacyDeliveryPersonId(saleInput);
        const saleData = {
            id: saleId,
            customer_id: saleInput.customer_id,
            seller_id: saleInput.seller_id,
            cash_session_id: saleInput.cash_session_id || null,
            total: saleTotal,
            discount: discountTotal,
            payment_method: summarizePaymentMethodForSalesTable(saleInput.payment_methods),
            payment_status: 'paid',
            notes: saleInput.notes,
            payment_methods: saleInput.payment_methods,
            subtotal: totals.subtotal,
            discount_total: discountTotal,
            cost_total: totals.cost_total,
            profit: realProfit,
            delivery_type: saleInput.delivery_type || null,
            delivery_person_id: legacyDeliveryPersonId,
            delivery_person_customer_id: deliveryPersonCustomerId,
            delivery_cost_store: saleInput.delivery_cost_store || 0,
            delivery_cost_customer: saleInput.delivery_cost_customer || 0,
            delivery_total: saleInput.delivery_total || 0,
            promotional_discount: promotionalDiscount,
            coupon_code: saleInput.coupon_code || null,
            coupon_id: saleInput.coupon_id || null,
            final_adjustment_discount: saleInput.final_adjustment_discount || 0,
            referral_code: saleInput.referral_code || null,
            finalization_status: 'success',
            finalization_log: saleInput.finalization_log || null,
            finalization_error_summary: saleInput.finalization_error_summary || null,
        };

        // Insert sale
        const sale = normalizeSaleRow(await vpsClient.post<Sale>(
            '/table-data/sales',
            serializeSaleRowForTable(saleData)
        ));
        if (!sale) throw new Error('Failed to create sale');

        // Insert sale items (persiste serialized_unit_id pra rastreio do IMEI)
        const saleItems = saleInput.items.map(item => serializeSaleItemRowForTable(item, sale.id));

        let saleItemsPersisted = false;
        let saleWhatsAppNotification: Promise<any> | null = null;
        try {
            await vpsClient.post('/table-data/sale_items/bulk', saleItems);
            saleItemsPersisted = true;
            saleWhatsAppNotification = vpsClient.post('/whatsapp/automation/sale-completed', { sale_id: sale.id });
            if (deliveryPersonCustomerId && saleInput.delivery_total && saleInput.delivery_total > 0) {
                await vpsClient.post('/delivery/jobs/from-sale', { sale_id: sale.id });
            }
        } catch (itemsError) {
            recordFinalizationIssue('sale_items', itemsError);
        }

        const serializedItems = saleItemsPersisted
            ? saleInput.items.filter(i => (i as any).serialized_unit?.unitId)
            : [];
        const markedUnitIds: string[] = [];
        try {
            for (const item of serializedItems) {
                const unitId = (item as any).serialized_unit.unitId;
                await unitService.markAsSold(unitId, undefined, sale.id);
                markedUnitIds.push(unitId);
            }
        } catch (err) {
            for (const unitId of markedUnitIds) {
                try {
                    await unitService.release(unitId);
                } catch (releaseError) {
                    console.error(`[saleService] Falha ao liberar unit ${unitId} apos erro na venda ${sale.id}:`, releaseError);
                }
            }
            recordFinalizationIssue('serialized_units', err);
        }

        try {
            await createCustomerDebtForAPrazoSale(saleInput, sale);
        } catch (debtError) {
            recordFinalizationIssue('customer_debt', debtError);
        }


        // Estoque manual (não-serializado) baixa primeiro da Loja Principal, depois dos demais depositos.
        const itemsWithInventory = saleItemsPersisted ? saleInput.items.filter(
            item => item.track_inventory && item.product_id && !(item as any).serialized_unit?.unitId
        ) : [];
        for (const item of itemsWithInventory) {
            try {
                const decrements = await decrementSaleStockByPriority(item, sale.id);
                const fallbackSources = decrements.filter(row => !isMainStoreStockDecrement(row));
                if (fallbackSources.length > 0) {
                    const locations = Array.from(new Set(fallbackSources.map(formatStockLocationLabel))).join(', ');
                    recordFinalizationWarning(
                        'stock_location_fallback',
                        `Produto ${item.product_sku || item.product_name} tirado do local ${locations}.`,
                        { product_id: item.product_id, quantity: item.quantity, sources: fallbackSources }
                    );
                }
            } catch (stockError) {
                recordFinalizationIssue('stock_decrement', stockError);
            }
        }

        // Sync bidirecional: deduzir estoque no Bling (fire-and-forget, não bloqueia a venda)
        const itemsToSyncBling = saleItemsPersisted ? saleInput.items.filter(
            item => item.track_inventory && item.product_id
        ) : [];
        void (async () => {
            for (const item of itemsToSyncBling) {
                await syncStockToBling(
                    item.product_id!,
                    item.quantity,
                    `Venda #${formatReferenceNumber(sale.id)} — PDV Mercado do Vale`,
                    { comboSelections: item.comboSelections }
                );
            }
        })().catch((error) => console.error(`[saleService] Falha ao sincronizar estoque Bling da venda ${sale.id}:`, error));

        // Create delivery credit if applicable
        if (legacyDeliveryPersonId && saleInput.delivery_total && saleInput.delivery_total > 0) {
            const deliveryCredit = {
                delivery_person_id: legacyDeliveryPersonId,
                sale_id: sale.id,
                amount: saleInput.delivery_total,
                delivery_type: saleInput.delivery_type!,
                status: 'pending' as const
            };

            try {
                await deliveryCreditService.create(deliveryCredit);
            } catch (creditError) {
                console.error('Failed to create delivery credit:', creditError);
                // Don't rollback sale, just log the error
            }
        }

        // Apply Promotions
        try {
            const promoStatus = await promotionService.getPromotionStatus('one_year_screen_protector');
            if (promoStatus.isActive && saleInput.customer_id) {
                const productIds = saleInput.items.map(item => item.product_id);
                // Verify if any product is a phone (celulares)
                const productsInSale = await vpsApiService.getProductsByIds(productIds);

                const hasSmartphone = productsInSale?.some(p => p.category_slug === 'celulares' || p.category_slug === 'iphones') || false;

                if (hasSmartphone) {
                    await benefitService.grantScreenProtectorBenefit(saleInput.customer_id, sale.id);
                    console.log(`✅ Promo aplicada: 1 Ano de Película para Cliente ${saleInput.customer_id}`);
                }
            }
        } catch (promoError) {
            console.error('Falha ao processar promoção automático no PDV:', promoError);
        }

        // Process referral code if provided
        if (saleInput.referral_code) {
            try {
                const buyerName = await loadCustomerNameById(saleInput.customer_id);

                const productTotalReais = Math.max(0, totals.subtotal - totals.discount_total - promotionalDiscount) / 100;

                const referralResult = await processReferralReward({
                    referralCode: saleInput.referral_code,
                    buyerId: saleInput.customer_id,
                    purchaseValue: productTotalReais,
                    referenceId: sale.id,
                    referenceType: 'sale',
                    buyerName,
                });

                if (referralResult.success) {
                    console.log(`Referral reward applied: ${referralResult.coins_awarded} coins`);
                } else {
                    console.warn('Referral reward failed or ignored:', referralResult.error);
                }
            } catch (refError) {
                console.error('Unexpected error processing referral:', refError);
            }
        }

        if (saleWhatsAppNotification) {
            try {
                const notification = await saleWhatsAppNotification;
                if (notification?.status !== 'sent') {
                    recordFinalizationWarning(
                        'sale_whatsapp',
                        'A venda foi registrada, mas a confirmacao do WhatsApp nao foi enviada.',
                        { status: notification?.status || 'unknown', reason: notification?.reason || notification?.error || null }
                    );
                }
            } catch (whatsappError) {
                recordFinalizationWarning(
                    'sale_whatsapp',
                    'A venda foi registrada, mas houve falha ao enviar a confirmacao do WhatsApp.',
                    normalizeFinalizationError(whatsappError, 'sale_whatsapp')
                );
            }
        }

        const finalization_status = finalizationIssues.length > 0 ? 'needs_review' : 'success';
        if (finalization_status === 'needs_review' || saleInput.finalization_log) {
            try {
                return await patchSale(sale.id, {
                    finalization_status,
                    finalization_error_summary: finalizationIssues.map(issue => `${issue.step}: ${issue.message}`).join('\n') || null as any,
                    finalization_log: appendIssueToFinalizationLog(saleInput.finalization_log, sale.id, finalization_status, finalizationIssues, finalizationWarnings),
                });
            } catch (finalizationPatchError) {
                console.error(`[saleService] Falha ao atualizar auditoria da venda ${sale.id}:`, finalizationPatchError);
            }
        }

        return {
            ...sale,
            finalization_status,
            finalization_error_summary: finalizationIssues.map(issue => `${issue.step}: ${issue.message}`).join('\n') || undefined,
            finalization_log: appendIssueToFinalizationLog(saleInput.finalization_log, sale.id, finalization_status, finalizationIssues, finalizationWarnings),
        };
    } catch (error) {
        console.error('Error creating sale:', error);
        throw error;
    }
};

/**
 * Get sale by ID with items
 */
export const getSaleById = async (id: string): Promise<SaleWithItems | null> => {
    try {
        return loadSaleWithItemsById(id);
    } catch (error) {
        console.error('Error fetching sale:', error);
        throw error;
    }
};

/**
 * Get sales with optional filters
 */
export const getSales = async (filters?: SaleFilters): Promise<SaleWithItems[]> => {
    try {
        const [saleRows, saleItems, customers, teamMembers, deliveryJobs] = await Promise.all([
            loadTableRows<any>('sales'),
            loadTableRows<any>('sale_items'),
            loadTableRows<any>('customers'),
            loadTableRows<any>('team_members'),
            loadTableRows<any>('customer_delivery_jobs'),
        ]);

        const customerById = new Map(customers.map(row => [String(row.id), row]));
        const sellerById = new Map(teamMembers.map(row => [String(row.id), row]));
        const deliveryJobBySaleId = new Map(deliveryJobs.map(row => [String(row.sale_id || ''), row]));

        return saleRows
            .map((saleRow) => {
                const rawItems = saleItems.filter(row => String(row.sale_id || '') === String(saleRow.id));
                const moneyScale = shouldScaleSaleMoneyFromReais(saleRow, rawItems) ? 100 : 1;
                const sale = normalizeSaleRow(saleRow, moneyScale);
                return { sale, rawItems, saleRow };
            })
            .map(({ sale, rawItems, saleRow }) => ({
                sale,
                items: rawItems.map(row => normalizeSaleItemRow(row, saleRow)),
            }))
            .filter(({ sale }) => saleMatchesFilters(sale, filters))
            .sort((a, b) => String(b.sale.created_at || '').localeCompare(String(a.sale.created_at || '')))
            .map(({ sale, items }) => {
                const customer = customerById.get(String(sale.customer_id || ''));
                const seller = sellerById.get(String(sale.seller_id || ''));
                const deliveryJob = deliveryJobBySaleId.get(String(sale.id || ''));
                return {
                    ...sale,
                    items,
                    customer: customer ? {
                        id: String(customer.id),
                        name: String(customer.name || ''),
                        cpf_cnpj: customer.cpf_cnpj ? String(customer.cpf_cnpj) : undefined,
                    } : undefined,
                    seller: seller ? {
                        id: String(seller.id),
                        name: String(seller.name || ''),
                    } : undefined,
                    delivery_job: deliveryJob ? {
                        id: String(deliveryJob.id || ''),
                        token: String(deliveryJob.token || ''),
                        sale_id: String(deliveryJob.sale_id || ''),
                        payment_status: deliveryJob.payment_status,
                        delivery_status: deliveryJob.delivery_status,
                        delivery_route_url: deliveryJob.delivery_route_url || null,
                        completed_by_admin_at: deliveryJob.completed_by_admin_at || null,
                        admin_completion_reason: deliveryJob.admin_completion_reason || null,
                    } : null,
                } as SaleWithItems;
            });
    } catch (error) {
        console.error('Error fetching sales:', error);
        throw error;
    }
};

interface CustomerPurchasesResponse {
    sales?: any[];
    orders?: any[];
}

export async function getCustomerPurchaseHistory(customerId?: string): Promise<{
    sales: SaleWithItems[];
    orders: OrderWithItems[];
}> {
    const query = customerId ? `?customer_id=${encodeURIComponent(customerId)}` : '';
    const data = await vpsClient.get<CustomerPurchasesResponse>(`/customer/purchases${query}`);

    const sales = (Array.isArray(data.sales) ? data.sales : []).map((saleRow) => {
        const rawItems = Array.isArray(saleRow.items) ? saleRow.items : [];
        const moneyScale = shouldScaleSaleMoneyFromReais(saleRow, rawItems) ? 100 : 1;
        return {
            ...normalizeSaleRow(saleRow, moneyScale),
            items: rawItems.map((row: any) => normalizeSaleItemRow(row, saleRow)),
            customer: saleRow.customer,
        } as SaleWithItems;
    });

    const orders = (Array.isArray(data.orders) ? data.orders : []).map((orderRow) => ({
        ...orderRow,
        shipping_address: parseJsonField(orderRow.shipping_address, null),
        gateway_pix_data: parseJsonField(orderRow.gateway_pix_data, null),
        shipping_cost: Number(orderRow.shipping_cost) || 0,
        subtotal: Number(orderRow.subtotal) || 0,
        discount: Number(orderRow.discount) || 0,
        total: Number(orderRow.total) || 0,
        coupon_discount: Number(orderRow.coupon_discount) || 0,
        coins_spent: Number(orderRow.coins_spent) || 0,
        coins_discount: Number(orderRow.coins_discount) || 0,
        items: (Array.isArray(orderRow.items) ? orderRow.items : []).map((item: any) => ({
            ...item,
            combo_selections: parseJsonField(item.combo_selections, null),
            quantity: Number(item.quantity) || 0,
            unit_price: Number(item.unit_price) || 0,
            subtotal: Number(item.subtotal) || 0,
        })),
    })) as OrderWithItems[];

    return { sales, orders };
}

export const updateSaleCostsAndProfit = async (saleId: string): Promise<SaleWithItems> => {
    const sale = await loadSaleWithItemsById(saleId);
    if (!sale) throw new Error('Venda nao encontrada');

    const productIds = [...new Set((sale.items || []).map(item => String(item.product_id || '')).filter(Boolean))];
    const serializedUnitIds = [...new Set((sale.items || []).map(item => String((item as any).serialized_unit_id || (item as any).serialized_unit?.unitId || '')).filter(Boolean))];

    const [products, units] = await Promise.all([
        productIds.length ? vpsApiService.getProductsByIds(productIds) : Promise.resolve([]),
        serializedUnitIds.length ? unitService.listByIds(serializedUnitIds) : Promise.resolve([]),
    ]);

    const productCostById = new Map((products || []).map((product: any) => [
        String(product.id || ''),
        moneyToCents(product.price_cost || 0),
    ]));
    const unitCostById = new Map((units || []).map((unit: any) => [
        String(unit.id || ''),
        moneyToCents(unit.cost_price || 0),
    ]));

    const updatedItems = (sale.items || []).map((item) => {
        const serializedUnitId = String((item as any).serialized_unit_id || (item as any).serialized_unit?.unitId || '');
        const currentCost = moneyToCents(item.unit_cost || 0);
        const unitCost = serializedUnitId ? unitCostById.get(serializedUnitId) || 0 : 0;
        const productCost = productCostById.get(String(item.product_id || '')) || 0;
        return {
            ...item,
            unit_cost: unitCost > 0 ? unitCost : productCost > 0 ? productCost : currentCost,
        } as SaleItem;
    });

    for (const item of updatedItems) {
        const itemId = String((item as any).id || '');
        if (!itemId) continue;
        await vpsClient.patch<any>(
            `/table-data/sale_items/${encodeURIComponent(itemId)}?pk=id`,
            { unit_cost: item.unit_cost }
        );
    }

    const recalculatedSale = {
        ...sale,
        items: updatedItems,
    } as SaleWithItems;
    const totals = calculateSaleProfitFromCurrentData(recalculatedSale);

    await patchSale(sale.id, {
        cost_total: totals.total_cost,
        profit: totals.profit,
    });

    return {
        ...recalculatedSale,
        cost_total: totals.total_cost,
        profit: totals.profit,
    };
};

// Estornos pertencem ao caixa aberto no momento da operacao, nunca ao caixa
// historico da venda original.
async function resolveRefundCashSessionId(): Promise<string | null> {
    try {
        const { cashRegisterService } = await import('./cashRegisterService');
        const current = await cashRegisterService.getCurrentSession();
        return current.session?.id || null;
    } catch {
        return null;
    }
}

/**
 * Cancel a sale
 */
export const cancelSale = async (id: string): Promise<void> => {
    try {
        // Fetch items before cancelling to restore stock
        const items = await loadSaleItemsBySaleId(id);
        const refundCashSessionId = await resolveRefundCashSessionId();

        await patchSale(id, { status: 'cancelled', refund_cash_session_id: refundCashSessionId } as Partial<Sale>);

        await restoreCancelledSaleInventory(id, items, `Cancelamento PDV #${formatReferenceNumber(id)}`);

        // Cancel associated delivery credits
        await deliveryCreditService.cancelBySaleId(id);

        // Estorna moedas de indicação (se existirem e já tiverem sido pagas)
        cancelReferralReward(id).catch(e => console.error("Erro cancelando moedas de indicação:", e));
    } catch (error) {
        console.error('Error cancelling sale:', error);
        throw error;
    }
};

/**
 * Refund a sale
 */
export const refundSale = async (id: string): Promise<void> => {
    try {
        // Fetch items before refunding to restore stock
        const items = await loadSaleItemsBySaleId(id);
        const refundCashSessionId = await resolveRefundCashSessionId();

        await patchSale(id, { status: 'refunded', refund_cash_session_id: refundCashSessionId } as Partial<Sale>);

        await restoreCancelledSaleInventory(id, items, `Estorno PDV #${formatReferenceNumber(id)}`);

        // Cancel associated delivery credits
        await deliveryCreditService.cancelBySaleId(id);

        // Estorna moedas de indicação (se existirem e já tiverem sido pagas)
        cancelReferralReward(id).catch(e => console.error("Erro cancelando moedas de indicação:", e));
    } catch (error) {
        console.error('Error refunding sale:', error);
        throw error;
    }
};

/**
 * Delete a sale permanently
 */
export const deleteSale = async (id: string): Promise<void> => {
    try {
        // Restore stock before deleting
        const items = await loadSaleItemsBySaleId(id);

        await restoreCancelledSaleInventory(id, items, `Exclusao PDV #${formatReferenceNumber(id)}`);

        // Delete sale (cascade will delete sale_items and delivery_credits)
        await deleteSaleRow(id);
    } catch (error) {
        console.error('Error deleting sale:', error);
        throw error;
    }
};

/**
 * Get sales summary
 */
export const getSalesSummary = async (filters?: SaleFilters): Promise<SaleSummary> => {
    try {
        const sales = (await loadSaleRows())
            .filter(sale => sale.status === 'completed')
            .filter(sale => saleMatchesFilters(sale, filters));

        if (!sales || sales.length === 0) {
            return {
                total_sales: 0,
                total_revenue: 0,
                total_profit: 0,
                total_cost: 0,
                average_ticket: 0,
                profit_margin: 0
            };
        }

        const total_sales = sales.length;
        const total_revenue = sales.reduce((sum, sale) => sum + getSaleCollectedTotal(sale as SaleWithItems), 0);
        const total_profit = sales.reduce((sum, sale) => sum + getSaleRealProfit(sale as SaleWithItems), 0);
        const total_cost = sales.reduce((sum, sale) => sum + getSaleCostTotal(sale as SaleWithItems), 0);
        const average_ticket = total_revenue / total_sales;
        const profit_margin = total_revenue > 0 ? (total_profit / total_revenue) * 100 : 0;

        return {
            total_sales,
            total_revenue,
            total_profit,
            total_cost,
            average_ticket,
            profit_margin
        };
    } catch (error) {
        console.error('Error fetching sales summary:', error);
        throw error;
    }
};
