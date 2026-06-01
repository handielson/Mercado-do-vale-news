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
    SaleItem
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

function serializeSaleRowForTable<T extends Record<string, unknown>>(row: T): T {
    return {
        ...row,
        payment_methods: serializeJsonValue(row.payment_methods),
    };
}

function normalizeSaleRow(row: any): Sale {
    return {
        ...row,
        subtotal: Number(row.subtotal) || 0,
        discount_total: Number(row.discount_total) || 0,
        total: Number(row.total) || 0,
        cost_total: Number(row.cost_total) || 0,
        profit: Number(row.profit) || 0,
        delivery_cost_store: Number(row.delivery_cost_store) || 0,
        delivery_cost_customer: Number(row.delivery_cost_customer) || 0,
        delivery_total: Number(row.delivery_total) || 0,
        promotional_discount: Number(row.promotional_discount) || 0,
        payment_methods: parseJsonField(row.payment_methods, []),
    } as Sale;
}

function normalizeSaleItemRow(row: any): SaleItem {
    return {
        ...row,
        quantity: Number(row.quantity) || 0,
        unit_price: Number(row.unit_price) || 0,
        unit_cost: Number(row.unit_cost) || 0,
        discount: Number(row.discount) || 0,
        subtotal: Number(row.subtotal) || 0,
        total: Number(row.total) || 0,
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
    return rows
        .filter(row => String(row.sale_id || '') === String(saleId))
        .map(normalizeSaleItemRow);
}

async function loadSaleWithItemsById(saleId: string): Promise<SaleWithItems | null> {
    const sales = await loadSaleRows();
    const sale = sales.find(row => String(row.id) === String(saleId));
    if (!sale) return null;

    const [items, customers, teamMembers] = await Promise.all([
        loadSaleItemsBySaleId(saleId),
        loadTableRows<any>('customers'),
        loadTableRows<any>('team_members'),
    ]);

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

async function patchSale(id: string, patch: Partial<Sale>): Promise<Sale> {
    return normalizeSaleRow(await vpsClient.patch<any>(
        `/table-data/sales/${encodeURIComponent(id)}?pk=id`,
        patch
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
        const saleTotal = Math.max(0, totals.total + (saleInput.delivery_cost_customer || 0) - promotionalDiscount);

        // Prepare sale data
        const isValidUUID = (id?: string) =>
            !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        const saleId = createLocalId();
        const saleData = {
            id: saleId,
            customer_id: saleInput.customer_id,
            seller_id: saleInput.seller_id,
            subtotal: totals.subtotal,
            discount_total: discountTotal,
            total: saleTotal,
            cost_total: totals.cost_total,
            profit: totals.profit - promotionalDiscount,
            payment_methods: saleInput.payment_methods,
            notes: saleInput.notes,
            status: 'completed' as const,

            // Delivery fields
            delivery_type: saleInput.delivery_type,
            // Only send delivery_person_id if it is a real UUID (not a mock placeholder)
            delivery_person_id: isValidUUID(saleInput.delivery_person_id)
                ? saleInput.delivery_person_id
                : undefined,
            delivery_cost_store: saleInput.delivery_cost_store || 0,
            delivery_cost_customer: saleInput.delivery_cost_customer || 0,
            delivery_total: saleInput.delivery_total || 0
        };

        // Insert sale
        const sale = normalizeSaleRow(await vpsClient.post<Sale>(
            '/table-data/sales',
            serializeSaleRowForTable(saleData)
        ));
        if (!sale) throw new Error('Failed to create sale');

        // Insert sale items (persiste serialized_unit_id pra rastreio do IMEI)
        const saleItems = saleInput.items.map(item => ({
            sale_id: sale.id,
            product_id: item.product_id,
            product_name: item.product_name,
            product_sku: item.product_sku,
            quantity: item.quantity,
            unit_price: item.unit_price,
            unit_cost: item.unit_cost,
            discount: item.discount,
            subtotal: item.subtotal,
            total: item.total,
            is_gift: item.is_gift,
            serialized_unit_id: (item as any).serialized_unit?.unitId || null,
        }));

        try {
            await vpsClient.post('/table-data/sale_items/bulk', saleItems);
        } catch (itemsError) {
            // Rollback: delete sale if items insertion fails
            await deleteSaleRow(sale.id);
            throw itemsError;
        }

        // Marca units serializadas como vendidas (VPS) — markAsSold dispara
        // syncProductStock que decrementa products.stock_quantity automaticamente.
        const serializedItems = saleInput.items.filter(i => (i as any).serialized_unit?.unitId);
        for (const item of serializedItems) {
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
        for (const item of itemsWithInventory) {
            syncStockToBling(
                item.product_id!,
                item.quantity,
                `Venda #${sale.id} — PDV Mercado do Vale`,
                { comboSelections: item.comboSelections }
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
        const [sales, saleItems, customers, teamMembers] = await Promise.all([
            loadSaleRows(),
            loadTableRows<any>('sale_items'),
            loadTableRows<any>('customers'),
            loadTableRows<any>('team_members'),
        ]);

        const customerById = new Map(customers.map(row => [String(row.id), row]));
        const sellerById = new Map(teamMembers.map(row => [String(row.id), row]));

        return sales
            .filter(sale => saleMatchesFilters(sale, filters))
            .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
            .map((sale) => {
                const customer = customerById.get(String(sale.customer_id || ''));
                const seller = sellerById.get(String(sale.seller_id || ''));
                return {
                    ...sale,
                    items: saleItems
                        .filter(row => String(row.sale_id || '') === String(sale.id))
                        .map(normalizeSaleItemRow),
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
