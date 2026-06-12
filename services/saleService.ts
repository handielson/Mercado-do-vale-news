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
import { cancelReferralReward, processReferralReward } from './cashbackService';
import { unitService } from './units';
import { stockLocationService } from './stockLocationService';
import { vpsApiService } from './vpsApiService';
import { vpsClient } from './vpsClient';
import { deliveryCreditService } from './deliveryCreditService';
import { moneyToCents } from '../utils/money';

const decrementSaleStockByPriority = async (item: SaleItem, saleId: string): Promise<void> => {
    if (!item.product_id) return;

    try {
        await stockLocationService.decrementStockByPriority({
            product_id: item.product_id,
            quantity: item.quantity,
            reason: `Venda PDV #${saleId}`,
            reference_type: 'sale',
            reference_id: saleId,
            notes: 'Baixa automatica por prioridade: Loja Principal antes dos demais depositos.',
        });
        return;
    } catch (priorityError) {
        console.error(`[saleService] Falha na baixa por prioridade do produto ${item.product_id}:`, priorityError);
    }
};

type SaleStockRestoreItem = {
    product_id: string | null;
    quantity: number;
};

const restoreSaleStockForItems = async (
    saleId: string,
    items: SaleStockRestoreItem[] | null | undefined,
    reason: string
): Promise<void> => {
    try {
        await stockLocationService.restoreSaleStockByLocation({
            sale_id: saleId,
            reason,
            notes: 'Devolucao automatica pelo fluxo de venda PDV.',
        });
        return;
    } catch (restoreError) {
        console.error(`[saleService] Falha ao restaurar estoque por local da venda ${saleId}:`, restoreError);
    }
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

function createLocalId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
    const data = { ...row };
    if (data.payment_methods) {
        data.payment_methods = serializeJsonValue(data.payment_methods);
    }
    delete data.items;
    delete data.customer;
    delete data.seller;
    delete data.status;
    return data;
}

function serializeSaleItemRowForTable(item: SaleItem, saleId: string): Record<string, unknown> {
    return {
        sale_id: saleId,
        product_id: item.product_id || null,
        product_name: item.product_name || null,
        product_sku: item.product_sku || null,
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        total: item.total || 0,
        warranty_months: item.warranty_months || 0,
        imei: item.serialized_unit?.imei1 || item.serialized_unit?.serial || null,
        serialized_unit_id: item.serialized_unit?.unitId || null,
        unit_cost: item.unit_cost || 0,
    };
}


function normalizePaymentMethods(paymentMethods: PaymentMethod[]): PaymentMethod[] {
    return paymentMethods.map((payment) => ({
        ...payment,
        amount: moneyToCents(payment.amount),
        fee_amount: (payment as any).fee_amount == null && (payment as any).fee_cents == null
            ? payment.fee_amount
            : moneyToCents((payment as any).fee_amount ?? (payment as any).fee_cents),
        operator_fee_amount: (payment as any).operator_fee_amount == null && (payment as any).operator_fee_cents == null
            ? payment.operator_fee_amount
            : moneyToCents((payment as any).operator_fee_amount ?? (payment as any).operator_fee_cents),
        total_with_fee: moneyToCents((payment as any).total_with_fee ?? (payment as any).total_with_fee_cents ?? payment.amount),
    }));
}

function getDefaultDebtDueDate(): string {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    return dueDate.toISOString().split('T')[0];
}

function getAPrazoPayment(paymentMethods: PaymentMethod[] = []): PaymentMethod | null {
    return paymentMethods.find(payment => payment.method === 'a_prazo' && Number(payment.amount) > 0) || null;
}

async function createCustomerDebtForAPrazoSale(saleInput: SaleInput, sale: Sale): Promise<void> {
    const aPrazoPayment = getAPrazoPayment(saleInput.payment_methods);
    if (!aPrazoPayment) return;
    if (!saleInput.customer_id) return;

    await vpsClient.post('/financial/customer-debts/from-sale', {
        customer_id: saleInput.customer_id,
        sale_id: sale.id,
        valor_total: aPrazoPayment.amount,
        descricao: `Venda PDV #${sale.id.slice(0, 8).toUpperCase()}`,
        data_vencimento: aPrazoPayment.due_date || getDefaultDebtDueDate(),
    });
}

function normalizeSaleRow(row: any): Sale {
    const rawTotal = moneyToCents(row.total);
    const discountTotal = moneyToCents(row.discount_total ?? row.discount);
    const total = rawTotal;
    const paymentMethods = Array.isArray(row.payment_methods)
        ? row.payment_methods
        : parseJsonField(row.payment_methods, paymentMethodFromSalesTable(row.payment_method, rawTotal));

    return {
        ...row,
        subtotal: !row.subtotal ? total + discountTotal : moneyToCents(row.subtotal),
        discount_total: discountTotal,
        total,
        cost_total: moneyToCents(row.cost_total),
        profit: moneyToCents(row.profit),
        delivery_cost_store: moneyToCents(row.delivery_cost_store),
        delivery_cost_customer: moneyToCents(row.delivery_cost_customer),
        delivery_total: moneyToCents(row.delivery_total),
        promotional_discount: moneyToCents(row.promotional_discount),
        final_adjustment_discount: moneyToCents(row.final_adjustment_discount),
        payment_methods: normalizePaymentMethods(paymentMethods),
        status: row.status || (row.payment_status === 'cancelled' ? 'cancelled' : 'completed'),
    } as Sale;
}

function normalizeSaleItemRow(row: any): SaleItem {
    const quantity = Number(row.quantity) || 0;
    const unitPrice = moneyToCents(row.unit_price);
    const total = row.total == null ? unitPrice * quantity : moneyToCents(row.total);

    return {
        ...row,
        quantity,
        unit_price: unitPrice,
        unit_cost: moneyToCents(row.unit_cost),
        discount: moneyToCents(row.discount),
        subtotal: row.subtotal == null ? total : moneyToCents(row.subtotal),
        total,
        is_gift: row.is_gift === true || row.is_gift === 1,
    } as SaleItem;
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
    const saleItems = rows.filter(row => String(row.sale_id || '') === String(saleId));
    return saleItems.map(row => normalizeSaleItemRow(row));
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
    const sale = normalizeSaleRow(saleRow);
    const items = saleItemRows.map(row => normalizeSaleItemRow(row));

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

function normalizeCustomerName(value: unknown): string {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}

function isWalkInCustomerRow(row: any): boolean {
    const value = row?.is_walk_in_customer;
    return value === true || value === 1 || value === '1' || normalizeCustomerName(row?.name) === 'cliente balcao';
}

async function isWalkInCustomerId(customerId?: string | null): Promise<boolean> {
    if (!customerId) return false;
    const customers = await loadTableRows<any>('customers');
    const customer = customers.find(row => String(row.id || '') === String(customerId));
    return isWalkInCustomerRow(customer);
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
    delete tablePatch.subtotal;
    delete tablePatch.discount_total;
    delete tablePatch.cost_total;
    delete tablePatch.profit;
    delete tablePatch.items;
    delete tablePatch.customer;
    delete tablePatch.seller;

    if (tablePatch.payment_methods) {
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

        const saleId = createLocalId();
        const saleData = {
            id: saleId,
            customer_id: saleInput.customer_id,
            seller_id: saleInput.seller_id,
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
            delivery_person_id: saleInput.delivery_person_id || null,
            delivery_person_customer_id: saleInput.delivery_person_customer_id || null,
            delivery_cost_store: saleInput.delivery_cost_store || 0,
            delivery_cost_customer: saleInput.delivery_cost_customer || 0,
            delivery_total: saleInput.delivery_total || 0,
            promotional_discount: promotionalDiscount,
            coupon_code: saleInput.coupon_code || null,
            coupon_id: saleInput.coupon_id || null,
            final_adjustment_discount: saleInput.final_adjustment_discount || 0,
            referral_code: saleInput.referral_code || null,
        };

        // Insert sale
        const sale = normalizeSaleRow(await vpsClient.post<Sale>(
            '/table-data/sales',
            serializeSaleRowForTable(saleData)
        ));
        if (!sale) throw new Error('Failed to create sale');

        // Insert sale items (persiste serialized_unit_id pra rastreio do IMEI)
        const saleItems = saleInput.items.map(item => serializeSaleItemRowForTable(item, sale.id));

        try {
            await vpsClient.post('/table-data/sale_items/bulk', saleItems);
            if (saleInput.delivery_person_customer_id && saleInput.delivery_total && saleInput.delivery_total > 0) {
                await vpsClient.post('/delivery/jobs/from-sale', { sale_id: sale.id });
            }
        } catch (itemsError) {
            // Rollback: delete sale if items insertion fails
            await deleteSaleRow(sale.id);
            throw itemsError;
        }

        const serializedItems = saleInput.items.filter(i => (i as any).serialized_unit?.unitId);
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
            try {
                await deleteSaleRow(sale.id);
            } catch (rollbackError) {
                console.error(`[saleService] Falha ao desfazer venda ${sale.id} apos erro na baixa serializada:`, rollbackError);
            }
            throw err;
        }

        try {
            await createCustomerDebtForAPrazoSale(saleInput, sale);
        } catch (debtError) {
            try {
                await deleteSaleRow(sale.id);
            } catch (rollbackError) {
                console.error(`[saleService] Falha ao desfazer venda ${sale.id} apos erro no crediario:`, rollbackError);
            }
            throw debtError;
        }

        // Marca units serializadas como vendidas (VPS) — markAsSold dispara
        // syncProductStock que decrementa products.stock_quantity automaticamente.
        const alreadyMarkedSerializedItems: typeof serializedItems = [];
        for (const item of alreadyMarkedSerializedItems) {
            try {
                await unitService.markAsSold((item as any).serialized_unit.unitId, undefined, sale.id);
            } catch (err) {
                console.error(`[saleService] Falha ao marcar unit como sold:`, err);
            }
        }

        // Estoque manual (não-serializado) baixa primeiro da Loja Principal, depois dos demais depositos.
        const itemsWithInventory = saleInput.items.filter(
            item => item.track_inventory && item.product_id && !(item as any).serialized_unit?.unitId
        );
        for (const item of itemsWithInventory) {
            await decrementSaleStockByPriority(item, sale.id);
        }

        // Sync bidirecional: deduzir estoque no Bling (fire-and-forget, não bloqueia a venda)
        const itemsToSyncBling = saleInput.items.filter(
            item => item.track_inventory && item.product_id
        );
        for (const item of itemsToSyncBling) {
            syncStockToBling(
                item.product_id!,
                item.quantity,
                `Venda #${sale.id} — PDV Mercado do Vale`,
                { comboSelections: item.comboSelections, unitPriceCents: item.unit_price }
            ).catch(() => { /* já logado internamente */ });
        }

        // Create delivery credit if applicable
        if (saleInput.delivery_person_id && saleInput.delivery_total && saleInput.delivery_total > 0) {
            const deliveryCredit = {
                delivery_person_id: saleInput.delivery_person_id,
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
            const walkInCustomer = await isWalkInCustomerId(saleInput.customer_id);
            if (promoStatus.isActive && saleInput.customer_id && !walkInCustomer) {
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

        return sale;
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
        const [saleRows, saleItems, customers, teamMembers] = await Promise.all([
            loadTableRows<any>('sales'),
            loadTableRows<any>('sale_items'),
            loadTableRows<any>('customers'),
            loadTableRows<any>('team_members'),
        ]);

        const customerById = new Map(customers.map(row => [String(row.id), row]));
        const sellerById = new Map(teamMembers.map(row => [String(row.id), row]));

        return saleRows
            .map((saleRow) => {
                const rawItems = saleItems.filter(row => String(row.sale_id || '') === String(saleRow.id));
                const sale = normalizeSaleRow(saleRow);
                return { sale, rawItems };
            })
            .map(({ sale, rawItems }) => ({
                sale,
                items: rawItems.map(row => normalizeSaleItemRow(row)),
            }))
            .filter(({ sale }) => saleMatchesFilters(sale, filters))
            .sort((a, b) => String(b.sale.created_at || '').localeCompare(String(a.sale.created_at || '')))
            .map(({ sale, items }) => {
                const customer = customerById.get(String(sale.customer_id || ''));
                const seller = sellerById.get(String(sale.seller_id || ''));
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
                } as SaleWithItems;
            });
    } catch (error) {
        console.error('Error fetching sales:', error);
        throw error;
    }
};

/**
 * Cancel a sale
 */
export const cancelSale = async (id: string): Promise<void> => {
    try {
        // Fetch items before cancelling to restore stock
        const items = await loadSaleItemsBySaleId(id);

        await patchSale(id, { status: 'cancelled' });

        await restoreSaleStockForItems(id, items, `Cancelamento PDV #${id}`);

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

        await patchSale(id, { status: 'refunded' });

        await restoreSaleStockForItems(id, items, `Estorno PDV #${id}`);

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

        await restoreSaleStockForItems(id, items, `Exclusao PDV #${id}`);

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
        const total_revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
        const total_profit = sales.reduce((sum, sale) => sum + sale.profit, 0);
        const total_cost = sales.reduce((sum, sale) => sum + sale.cost_total, 0);
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
