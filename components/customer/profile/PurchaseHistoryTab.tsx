import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Package, RefreshCw, Receipt, FileText, ExternalLink, Check, Clock, X, CreditCard, Truck, Filter, Search, type LucideIcon } from 'lucide-react';
import { useVpsAuth } from '../../../hooks/useVpsAuth';
import { getCustomerPurchaseHistory } from '../../../services/saleService';
import { companySettingsService } from '../../../services/companySettingsService';
import { SaleWithItems } from '../../../types/sale';
import { printSaleReceipt, PrintReceiptBenefits } from '../../../utils/printSaleReceipt';
import { printOnlineOrderReceipt } from '../../../utils/printOnlineOrderReceipt';
import { getCoinBalance, getCoinsEarnedForReference } from '../../../services/cashbackService';
import { generateLegacySalePdf } from '../../../utils/legacySalePdfGenerator';
import { benefitService } from '../../../services/benefitService';
import { vpsApiService } from '../../../services/vpsApiService';
import { getLegacyCustomerPurchases, type LegacyCustomerPurchase } from '../../../services/legacyCustomerPurchasesService';
import { SignedWarrantyDocumentCard } from './SignedWarrantyDocumentCard';
import type { Customer } from '../../../types/customer';
import {
    createCustomerDebtMercadoPagoIntent,
    formatCurrencyCents,
    listCustomerDebts,
    toCents,
    type CustomerDebt,
    type CustomerDebtMercadoPagoIntent,
} from '../../../services/customerDebtService';
import { toast } from 'sonner';

const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v / 100);

const paymentLabel = (m: string): string =>
    ({ money: 'Dinheiro', credit: 'Crédito', debit: 'Débito', pix: 'PIX' }[m] || m);

// Fases do pedido online — ordem de progresso. payment_failed e cancelled
// são estados terminais negativos e tratados separadamente.
const ONLINE_ORDER_STAGES: Array<{
    key: string;
    label: string;
    Icon: LucideIcon;
}> = [
    { key: 'awaiting_payment', label: 'Aguardando pagamento', Icon: Clock },
    { key: 'paid', label: 'Pagamento confirmado', Icon: CreditCard },
    { key: 'preparing', label: 'Em preparação', Icon: Package },
    { key: 'shipped', label: 'Enviado', Icon: Truck },
    { key: 'delivered', label: 'Entregue', Icon: Check },
];

function getStageIndex(status: string): number {
    // Mapeia status atual para o índice da fase concluída mais recente.
    // pending e awaiting_payment caem na fase 0 (aguardando pagamento).
    if (status === 'pending' || status === 'awaiting_payment') return 0;
    const idx = ONLINE_ORDER_STAGES.findIndex(s => s.key === status);
    if (idx >= 0) return idx;
    // 'completed' é equivalente ao último estágio (entregue + finalizado)
    if (status === 'completed') return ONLINE_ORDER_STAGES.length - 1;
    return -1;
}

function getStatusBadge(status: string): { label: string; className: string } {
    switch (status) {
        case 'paid':
            return { label: 'Pago', className: 'bg-emerald-100 text-emerald-800' };
        case 'preparing':
            return { label: 'Em preparação', className: 'bg-blue-100 text-blue-800' };
        case 'shipped':
            return { label: 'Enviado', className: 'bg-indigo-100 text-indigo-800' };
        case 'delivered':
            return { label: 'Entregue', className: 'bg-green-100 text-green-800' };
        case 'completed':
            return { label: 'Concluído', className: 'bg-green-100 text-green-800' };
        case 'awaiting_payment':
            return { label: 'Aguardando pagamento', className: 'bg-yellow-100 text-yellow-800' };
        case 'pending':
            return { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' };
        case 'cancelled':
            return { label: 'Cancelado', className: 'bg-red-100 text-red-800' };
        case 'payment_failed':
            return { label: 'Pagamento recusado', className: 'bg-red-100 text-red-800' };
        case 'refunded':
        case 'returned':
            return { label: 'Estornado/Devolvido', className: 'bg-orange-100 text-orange-800' };
        default:
            return { label: status || 'Desconhecido', className: 'bg-slate-100 text-slate-800' };
    }
}

interface PurchaseHistoryTabProps {
    customerOverride?: Customer;
}

export const PurchaseHistoryTab: React.FC<PurchaseHistoryTabProps> = ({ customerOverride }) => {
    const { customer } = useVpsAuth();
    const effectiveCustomer = customerOverride || customer;
    const [sales, setSales] = useState<SaleWithItems[]>([]);
    const [productSpecs, setProductSpecs] = useState<Record<string, Record<string, string>>>({});
    const [loading, setLoading] = useState(true);
    const [printingReceiptId, setPrintingReceiptId] = useState<string | null>(null);
    const [printingComprovanteId, setPrintingComprovanteId] = useState<string | null>(null);
    const [legacyPurchases, setLegacyPurchases] = useState<LegacyCustomerPurchase[]>([]);
    const [companyHeader, setCompanyHeader] = useState<{ name: string; logoUrl: string }>({ name: 'Mercado do Vale', logoUrl: '' });
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'attention'>('all');
    const [customerDebts, setCustomerDebts] = useState<CustomerDebt[]>([]);
    const [pixDebtScope, setPixDebtScope] = useState<'all' | string>('all');
    const [pixAmountMode, setPixAmountMode] = useState<'full' | 'partial'>('full');
    const [pixPartialValue, setPixPartialValue] = useState('');
    const [creatingDebtPix, setCreatingDebtPix] = useState(false);
    const [debtPixIntent, setDebtPixIntent] = useState<CustomerDebtMercadoPagoIntent | null>(null);

    useEffect(() => {
        companySettingsService.get()
            .then(s => setCompanyHeader({
                name: s?.company_name || 'Mercado do Vale',
                logoUrl: s?.receipt_logo_url || '',
            }))
            .catch(() => { /* mantém fallback */ });
    }, []);

    const handleViewLegacyComprovante = async (sale: SaleWithItems) => {
        setPrintingComprovanteId(sale.id);
        try {
            const settings = await companySettingsService.get();
            const company = {
                name:    settings?.company_name || 'Mercado do Vale',
                address: settings?.address      || '',
                phone:   settings?.phone        || '',
                cnpj:    settings?.cnpj         || '',
            };
            const items = sale.items.map(item => {
                const sku = item.product_sku || '';
                const imeiParts = sku.split('/').map((s: string) => s.trim());
                return {
                    phone: {
                        id: item.id,
                        device_type: '',
                        imei1: imeiParts[0] || '',
                        imei2: imeiParts[1] || '',
                        brand_id: (item as any).product_brand || '',
                        model: (item as any).product_model || item.product_name || '',
                        version: '',
                        ram:     (item as any).product_specs?.ram || '',
                        storage: (item as any).product_specs?.storage || '',
                        color:   (item as any).product_specs?.color || '',
                        buy_price: 0,
                        sell_price_suggested: item.unit_price || 0,
                        status: '',
                        quantity: item.quantity || 1,
                        condition: 'USED' as const,
                        entry_date: sale.created_at,
                        updated_at: sale.created_at,
                    },
                    brand: undefined,
                    quantity:   item.quantity   || 1,
                    unit_price: item.unit_price || 0,
                    subtotal:   (item.unit_price || 0) * (item.quantity || 1),
                };
            });
            const pdfBlob = await generateLegacySalePdf({
                sale:         { ...sale, sale_date: sale.created_at, total_amount: (sale as any).total_amount ?? 0, payment_method: (sale as any).payment_method || '' } as any,
            customerName: effectiveCustomer?.name || '',
            customerCpf:  (effectiveCustomer as any)?.cpf_cnpj || '',
                items,
                company,
            });
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 30_000);
        } catch (e) {
            console.error(e);
            toast.error('Erro ao gerar comprovante');
        } finally {
            setPrintingComprovanteId(null);
        }
    };

    const handlePrintReceipt = async (sale: SaleWithItems) => {
        setPrintingReceiptId(sale.id);
        try {
            // Pedidos online têm estrutura diferente — usa um recibo dedicado
            if ((sale as any).is_online_order) {
                const settings = await companySettingsService.get().catch(() => null);
                printOnlineOrderReceipt({
                    id: sale.id,
                    created_at: sale.created_at,
                    status: String(sale.status),
                    total: sale.total,
                    discount_total: sale.discount_total,
                    delivery_total: (sale as any).delivery_total,
                    items: sale.items.map(it => ({
                        product_name: it.product_name,
                        product_sku: it.product_sku,
                        quantity: it.quantity,
                        unit_price: (it as any).unit_price,
                        subtotal: it.subtotal,
                    })),
                    payment_methods: (sale as any).payment_methods,
                    delivery_type: (sale as any).delivery_type,
                    shipping_address: (sale as any).shipping_address,
                    shipping_cost: (sale as any).shipping_cost,
                    payment_gateway: (sale as any).payment_gateway,
                    gateway_payment_id: (sale as any).gateway_payment_id,
                    gateway_pix_data: (sale as any).gateway_pix_data,
                    customer_name: effectiveCustomer?.name,
                    customer_cpf: (effectiveCustomer as any)?.cpf_cnpj,
                }, settings);
                return;
            }
            const customerId = effectiveCustomer?.id;
            const [settings, coinBalance, benefitStatuses, coinsThisSale] = await Promise.all([
                companySettingsService.get(),
                customerId ? getCoinBalance(customerId).catch(() => null) : Promise.resolve(null),
                customerId ? benefitService.getCustomerBenefitsStatus(customerId).catch(() => []) : Promise.resolve([]),
                customerId
                    ? getCoinsEarnedForReference(customerId, sale.id).catch(() => 0)
                    : Promise.resolve(0),
            ]);
            if (!settings) return;
            const benefits: PrintReceiptBenefits = {
                coinBalance,
                coinsEarnedThisSale: coinsThisSale,
                benefitStatuses,
            };
            printSaleReceipt(sale, settings, productSpecs, benefits);
        } catch (e) {
            console.error(e);
        } finally {
            setPrintingReceiptId(null);
        }
    };

    useEffect(() => {
        if (!effectiveCustomer?.id) return;
        (async () => {
            try {
                // Fetch PDV Sales and Online Orders simultaneously
                const [purchaseHistory, debtRows] = await Promise.all([
                    getCustomerPurchaseHistory(effectiveCustomer.id),
                    listCustomerDebts(effectiveCustomer.id).catch(() => []),
                ]);
                const { sales: pdvSales, orders: onlineOrders } = purchaseHistory;
                setCustomerDebts(debtRows);
                getLegacyCustomerPurchases(effectiveCustomer.id)
                    .then(setLegacyPurchases)
                    .catch((error) => {
                        console.error('Erro ao carregar historico legado:', error);
                        setLegacyPurchases([]);
                    });

                // Map online orders to match the Sale structure for UI compatibility.
                // Preservamos o status original do pedido (awaiting_payment, paid,
                // preparing, shipped, delivered, completed, cancelled, payment_failed)
                // para o cliente ver a fase real, mesmo que o admin altere manualmente.
                const mappedOrders = onlineOrders.map(order => ({
                    id: order.id,
                    created_at: order.created_at,
                    status: order.status,
                    total: order.total,
                    discount_total: order.discount,
                    delivery_total: order.shipping_cost,
                    items: order.items.map(item => ({
                        product_id: item.product_id,
                        quantity: item.quantity,
                        product_name: item.product_name,
                        product_sku: item.product_sku,
                        subtotal: item.subtotal,
                        warranty_months: 0,
                        warranty_price: 0
                    })),
                    payment_methods: [{
                        method: order.payment_method === 'credit_card' ? 'credit' :
                            order.payment_method === 'pix' ? 'pix' :
                                order.payment_method === 'on_delivery' ? 'Dinheiro/Cartão (Entrega)' : 'Dinheiro',
                        amount: order.total,
                        installments: 1
                    }],
                    // Campos extras pra renderização rica (pedido online):
                    is_online_order: true,
                    delivery_type: order.delivery_type,
                    shipping_address: order.shipping_address,
                    shipping_cost: order.shipping_cost,
                    shipping_origin_cep: (order as any).shipping_origin_cep,
                    shipping_origin_label: (order as any).shipping_origin_label,
                    payment_gateway: order.payment_gateway,
                    payment_method: order.payment_method,
                    gateway_payment_id: order.gateway_payment_id,
                    gateway_pix_data: order.gateway_pix_data,
                    gateway_payment_url: order.gateway_payment_url,
                })) as unknown as SaleWithItems[];

                // Merge and sort
                const combined = [...pdvSales, ...mappedOrders].sort((a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );

                setSales(combined);
                const map: Record<string, Record<string, string>> = {};
                const allIds = [...new Set(combined.flatMap(s => s.items.map(i => (i as any).product_id)).filter(Boolean))];
                if (allIds.length) {
                    const prods = await vpsApiService.getProductsByIds(allIds);
                    (prods || []).forEach((p: any) => { map[p.id] = p.specs || {}; });
                }
                // IMEI por sale_item.id — busca units VPS para vendas com items serializados
                try {
                    for (const sale of combined) {
                        const hasSerialized = sale.items.some((i: any) => i.serialized_unit_id);
                        if (!hasSerialized) continue;
                        const units = await vpsApiService.getUnitsBySale(sale.id);
                        const unitToItem = new Map<string, string>();
                        sale.items.forEach((it: any) => {
                            if (it.serialized_unit_id) unitToItem.set(it.serialized_unit_id, it.id);
                        });
                        (units || []).forEach((u: any) => {
                            const itemId = unitToItem.get(u.id);
                            if (!itemId) return;
                            map[itemId] = {
                                ...(map[itemId] || {}),
                                imei1: u.imei_1 || '',
                                imei2: u.imei_2 || '',
                                serial: u.serial || '',
                            };
                        });
                    }
                } catch (e) { /* fallback: continua sem IMEI da unit */ }
                setProductSpecs(map);
            } catch (e) {
                console.error('Erro ao carregar histórico:', e);
            } finally {
                setLoading(false);
            }
        })();
    }, [effectiveCustomer?.id]);

    const purchaseSummary = useMemo(() => {
        const activeStatuses = new Set(['pending', 'awaiting_payment', 'paid', 'preparing', 'shipped']);
        const completedStatuses = new Set(['delivered', 'completed']);
        const attentionStatuses = new Set(['cancelled', 'payment_failed', 'refunded', 'returned']);

        return sales.reduce(
            (acc, sale) => {
                const status = String(sale.status);
                acc.totalSpent += Number(sale.total) || 0;
                if (activeStatuses.has(status)) acc.active += 1;
                if (completedStatuses.has(status)) acc.completed += 1;
                if (attentionStatuses.has(status)) acc.attention += 1;
                return acc;
            },
            { total: sales.length, active: 0, completed: 0, attention: 0, totalSpent: 0 }
        );
    }, [sales]);

    const filteredSales = useMemo(() => {
        if (statusFilter === 'all') return sales;
        const statusGroups = {
            active: new Set(['pending', 'awaiting_payment', 'paid', 'preparing', 'shipped']),
            completed: new Set(['delivered', 'completed']),
            attention: new Set(['cancelled', 'payment_failed', 'refunded', 'returned']),
        };
        return sales.filter((sale) => statusGroups[statusFilter].has(String(sale.status)));
    }, [sales, statusFilter]);

    const legacySummary = useMemo(() => {
        return legacyPurchases.reduce(
            (acc, purchase) => {
                acc.total += 1;
                acc.totalSpent += Number(purchase.total) || 0;
                if (!acc.lastDate || String(purchase.sale_date || '') > acc.lastDate) {
                    acc.lastDate = String(purchase.sale_date || '');
                }
                return acc;
            },
            { total: 0, totalSpent: 0, lastDate: '' }
        );
    }, [legacyPurchases]);

    const formatDate = (value?: string | null) => {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleDateString('pt-BR');
    };

    const filters = [
        { id: 'all' as const, label: 'Todos os pedidos', count: purchaseSummary.total },
        { id: 'active' as const, label: 'Em andamento', count: purchaseSummary.active },
        { id: 'completed' as const, label: 'Concluidos', count: purchaseSummary.completed },
        { id: 'attention' as const, label: 'Atencao', count: purchaseSummary.attention },
    ];

    const openCustomerDebts = useMemo(() => {
        return customerDebts
            .filter((debt) => toCents(debt.saldo_devedor) > 0 && String(debt.status || '').toLowerCase() !== 'paid')
            .sort((a, b) => String(a.data_vencimento || '').localeCompare(String(b.data_vencimento || '')));
    }, [customerDebts]);

    const selectedPixDebts = useMemo(() => {
        if (pixDebtScope === 'all') return openCustomerDebts;
        return openCustomerDebts.filter((debt) => debt.id === pixDebtScope);
    }, [openCustomerDebts, pixDebtScope]);

    const selectedPixFullAmount = useMemo(() => {
        return selectedPixDebts.reduce((sum, debt) => sum + toCents(debt.saldo_devedor), 0);
    }, [selectedPixDebts]);

    const parsePixPartialValue = () => {
        const normalized = pixPartialValue.replace(/\./g, '').replace(',', '.').trim();
        const amount = Number(normalized);
        return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
    };

    const buildDebtPixAllocations = (targetAmount: number) => {
        let remaining = targetAmount;
        return selectedPixDebts.flatMap((debt) => {
            if (remaining <= 0) return [];
            const balance = toCents(debt.saldo_devedor);
            const value = Math.min(balance, remaining);
            remaining -= value;
            return value > 0 ? [{ debt_id: debt.id, valor_liquido: value }] : [];
        });
    };

    const createDebtPixPayment = async () => {
        const targetAmount = pixAmountMode === 'full' ? selectedPixFullAmount : parsePixPartialValue();
        if (targetAmount <= 0) {
            toast.error('Informe um valor valido para gerar o Pix');
            return;
        }
        if (targetAmount > selectedPixFullAmount) {
            toast.error('O valor escolhido e maior que o saldo selecionado');
            return;
        }
        const allocations = buildDebtPixAllocations(targetAmount);
        if (allocations.length === 0) {
            toast.error('Nenhum debito em aberto selecionado');
            return;
        }
        setCreatingDebtPix(true);
        try {
            const intent = await createCustomerDebtMercadoPagoIntent({
                debt_id: allocations[0].debt_id,
                valor_liquido: targetAmount,
                metodo: 'pix',
                allocations,
            });
            setDebtPixIntent(intent);
            toast.success('Pix gerado');
        } catch (err: any) {
            toast.error(err?.message || 'Erro ao gerar Pix Mercado Pago');
        } finally {
            setCreatingDebtPix(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <RefreshCw className="animate-spin text-blue-600" size={28} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                {companyHeader.logoUrl && (
                    <img
                        src={companyHeader.logoUrl}
                        alt={companyHeader.name}
                        className="h-14 w-14 rounded-xl border border-slate-200 bg-white object-contain p-1"
                    />
                )}
                <div>
                    <p className="text-sm font-semibold text-blue-700">Central de compras</p>
                    <h2 className="mt-1 text-2xl font-semibold text-slate-800">Historico de Compras</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Pedidos, comprovantes, pagamentos e entrega em {companyHeader.name}.
                    </p>
                </div>
                <a
                    href="/cliente/catalogo"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                    <Package className="h-4 w-4" />
                    Comprar novamente
                </a>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                    <p className="text-xs font-bold uppercase text-slate-500">Pedidos recentes</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-800">{purchaseSummary.total}</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-4 ring-1 ring-blue-100">
                    <p className="text-xs font-bold uppercase text-blue-700">Em andamento</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-800">{purchaseSummary.active}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                    <p className="text-xs font-bold uppercase text-emerald-700">Concluidos</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-800">{purchaseSummary.completed}</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-100">
                    <p className="text-xs font-bold uppercase text-amber-700">Total investido</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-800">{fmt(purchaseSummary.totalSpent)}</p>
                </div>
            </div>

            {legacyPurchases.length > 0 && (
                <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-amber-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-amber-700">Historico do sistema antigo</p>
                            <h3 className="mt-1 text-xl font-semibold text-slate-800">Compras legadas</h3>
                            <p className="mt-1 text-sm text-slate-500">
                                Registros importados apenas para consulta. Nao movimentam estoque, caixa, crediario, cashback ou Bling.
                            </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="rounded-xl bg-amber-50 px-3 py-2">
                                <div className="font-bold text-slate-800">{legacySummary.total}</div>
                                <div className="text-slate-500">compras</div>
                            </div>
                            <div className="rounded-xl bg-amber-50 px-3 py-2">
                                <div className="font-bold text-slate-800">{fmt(legacySummary.totalSpent)}</div>
                                <div className="text-slate-500">total</div>
                            </div>
                            <div className="rounded-xl bg-amber-50 px-3 py-2">
                                <div className="font-bold text-slate-800">{formatDate(legacySummary.lastDate)}</div>
                                <div className="text-slate-500">ultima</div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 space-y-3">
                        {legacyPurchases.map((purchase) => (
                            <article key={purchase.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                                                <Clock className="h-3 w-3" />
                                                Informativo
                                            </span>
                                            <span className="text-sm font-bold text-slate-800">Venda legada #{purchase.legacy_sale_id}</span>
                                        </div>
                                        <p className="mt-1 text-sm text-slate-500">
                                            {formatDate(purchase.sale_date)}
                                            {purchase.payment_method ? ` · ${paymentLabel(purchase.payment_method)}` : ''}
                                            {purchase.installments && purchase.installments > 1 ? ` · ${purchase.installments}x` : ''}
                                        </p>
                                    </div>
                                    <div className="text-left sm:text-right">
                                        <div className="text-xs font-bold uppercase text-slate-400">Total legado</div>
                                        <div className="text-lg font-bold text-slate-900">{fmt(purchase.total)}</div>
                                    </div>
                                </div>

                                {purchase.items.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        {purchase.items.map((item, index) => (
                                            <div key={`${purchase.id}-${index}`} className="flex items-start justify-between gap-4 border-t border-slate-200 pt-2 text-sm">
                                                <div>
                                                    <div className="font-medium text-slate-800">
                                                        {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.description}
                                                    </div>
                                                    {item.identifier && <div className="mt-0.5 text-xs text-slate-500">{item.identifier}</div>}
                                                </div>
                                                <div className="shrink-0 font-bold text-slate-800">{fmt(item.subtotal)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {purchase.notes && (
                                    <div className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-500">
                                        {purchase.notes}
                                    </div>
                                )}
                            </article>
                        ))}
                    </div>
                </section>
            )}

            {openCustomerDebts.length > 0 && (
                <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-emerald-700">Crediario</p>
                            <h3 className="mt-1 text-xl font-semibold text-slate-800">Pagar debitos em aberto</h3>
                            <p className="mt-1 text-sm text-slate-500">
                                Saldo selecionado: <strong>{formatCurrencyCents(selectedPixFullAmount)}</strong>
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setDebtPixIntent(null)}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                        >
                            Atualizar Pix
                        </button>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                        <div className="space-y-3">
                            <label className="block">
                                <span className="text-sm font-bold text-slate-700">Conta para pagar</span>
                                <select
                                    value={pixDebtScope}
                                    onChange={(event) => {
                                        setPixDebtScope(event.target.value);
                                        setDebtPixIntent(null);
                                    }}
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                >
                                    <option value="all">Pagar todos os debitos</option>
                                    {openCustomerDebts.map((debt) => (
                                        <option key={debt.id} value={debt.id}>
                                            {debt.descricao || 'Debito'} - {formatCurrencyCents(debt.saldo_devedor)}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="grid gap-2 sm:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPixAmountMode('full');
                                        setDebtPixIntent(null);
                                    }}
                                    className={`rounded-xl border px-3 py-2 text-sm font-bold ${pixAmountMode === 'full' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'}`}
                                >
                                    Valor completo
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPixAmountMode('partial');
                                        setDebtPixIntent(null);
                                    }}
                                    className={`rounded-xl border px-3 py-2 text-sm font-bold ${pixAmountMode === 'partial' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'}`}
                                >
                                    Valor parcial
                                </button>
                            </div>

                            {pixAmountMode === 'partial' && (
                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700">Valor parcial</span>
                                    <input
                                        value={pixPartialValue}
                                        onChange={(event) => {
                                            setPixPartialValue(event.target.value);
                                            setDebtPixIntent(null);
                                        }}
                                        placeholder="0,00"
                                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                    />
                                </label>
                            )}

                            <button
                                type="button"
                                onClick={createDebtPixPayment}
                                disabled={creatingDebtPix}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                                {creatingDebtPix ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                                Pagar via Pix
                            </button>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            {debtPixIntent ? (
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs font-bold uppercase text-slate-500">Pix Mercado Pago</p>
                                        <p className="mt-1 text-2xl font-semibold text-slate-800">{formatCurrencyCents(debtPixIntent.valor_liquido)}</p>
                                    </div>
                                    {debtPixIntent.qr_code_base64 && (
                                        <img
                                            src={`data:image/png;base64,${debtPixIntent.qr_code_base64}`}
                                            alt="QR Code Pix Mercado Pago"
                                            className="mx-auto h-44 w-44 rounded-lg bg-white p-2"
                                        />
                                    )}
                                    {debtPixIntent.qr_code && (
                                        <textarea
                                            readOnly
                                            value={debtPixIntent.qr_code}
                                            className="h-24 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"
                                        />
                                    )}
                                    {debtPixIntent.checkout_url && (
                                        <a
                                            href={debtPixIntent.checkout_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                            Abrir Mercado Pago
                                        </a>
                                    )}
                                    <p className="text-xs text-slate-500">A baixa acontece automaticamente quando o Mercado Pago confirmar o Pix.</p>
                                </div>
                            ) : (
                                <div className="flex h-full min-h-52 flex-col items-center justify-center text-center text-slate-500">
                                    <CreditCard className="mb-3 h-8 w-8 text-emerald-600" />
                                    <p className="text-sm font-bold text-slate-700">Escolha valor completo ou parcial</p>
                                    <p className="mt-1 text-xs">Depois gere o Pix para pagar direto pelo Mercado Pago.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            )}

            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2 px-2 text-sm font-bold text-slate-700">
                    <Filter className="h-4 w-4 text-slate-400" />
                    Filtrar pedidos
                </div>
                <div className="flex gap-2 overflow-x-auto">
                    {filters.map((filter) => (
                        <button
                            key={filter.id}
                            type="button"
                            aria-pressed={statusFilter === filter.id}
                            onClick={() => setStatusFilter(filter.id)}
                            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${statusFilter === filter.id
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            {filter.label}
                            <span className={`rounded-full px-2 py-0.5 text-xs ${statusFilter === filter.id ? 'bg-white/20 text-white' : 'bg-white text-slate-500'}`}>
                                {filter.count}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {sales.length === 0 && legacyPurchases.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
                    <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                        <ShoppingBag className="text-slate-400" size={32} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        Nenhuma compra realizada
                    </h3>
                    <p className="text-slate-600 mb-6">
                        Você ainda não realizou compras. Explore nosso catálogo!
                    </p>
                    <a
                        href="/cliente/catalogo"
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                    >
                        <Package size={20} />
                        Ver Catalogo
                    </a>
                </div>
            ) : sales.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
                    <ShoppingBag className="mx-auto h-8 w-8 text-slate-400" />
                    <h3 className="mt-3 text-lg font-bold text-slate-900">Nenhum pedido novo encontrado</h3>
                    <p className="mt-1 text-sm text-slate-500">Este cliente possui apenas historico informativo do sistema antigo.</p>
                </div>
            ) : filteredSales.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
                    <Search className="mx-auto h-8 w-8 text-slate-400" />
                    <h3 className="mt-3 text-lg font-bold text-slate-900">Nenhum pedido neste filtro</h3>
                    <p className="mt-1 text-sm text-slate-500">Troque o filtro para visualizar outros pedidos.</p>
                    <button
                        type="button"
                        onClick={() => setStatusFilter('all')}
                        className="mt-5 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
                    >
                        Todos os pedidos
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredSales.map(sale => {
                        const payments: any[] = (sale as any).payment_methods || [];
                        const isOnlineOrder: boolean = !!(sale as any).is_online_order;
                        const orderStatus: string = String(sale.status);
                        const stageIndex = getStageIndex(orderStatus);
                        const pixTicketUrl: string | undefined = (sale as any).gateway_pix_data?.ticket_url;
                        const paymentGateway: string | undefined = (sale as any).payment_gateway;
                        const gatewayPaymentId: string | undefined = (sale as any).gateway_payment_id;
                        const deliveryType: string | undefined = (sale as any).delivery_type;
                        const shippingAddress = (sale as any).shipping_address as { street?: string; number?: string; complement?: string; neighborhood?: string; city?: string; state?: string; cep?: string } | undefined;
                        const shippingCost: number = Number((sale as any).shipping_cost) || 0;
                        const shippingOriginLabel: string | undefined = (sale as any).shipping_origin_label;
                        const shippingOriginCep: string | undefined = (sale as any).shipping_origin_cep;
                        const isTerminalNegative = orderStatus === 'cancelled' || orderStatus === 'payment_failed';
                        return (
                            <div key={sale.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                {/* Header do pedido */}
                                <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                                            <ShoppingBag className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-slate-800">
                                                Pedido #{sale.id.slice(0, 8).toUpperCase()}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {new Date(sale.created_at).toLocaleDateString('pt-BR', {
                                                    day: '2-digit', month: 'long', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {sale.legacy_sale_id && (
                                            <button
                                                onClick={() => handleViewLegacyComprovante(sale)}
                                                disabled={printingComprovanteId === sale.id}
                                                title="Ver Comprovante de Venda"
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 transition-colors disabled:opacity-50"
                                            >
                                                <FileText size={13} />
                                                {printingComprovanteId === sale.id ? 'Gerando...' : 'Ver Comprovante'}
                                            </button>
                                        )}
                                        {!sale.legacy_sale_id && (
                                            <button
                                                onClick={() => handlePrintReceipt(sale)}
                                                disabled={printingReceiptId === sale.id}
                                                title="Imprimir Recibo"
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors disabled:opacity-50"
                                            >
                                                {printingReceiptId === sale.id
                                                    ? <RefreshCw size={13} className="animate-spin" />
                                                    : <Receipt size={13} />}
                                                Recibo
                                            </button>
                                        )}
                                        {(() => {
                                            const badge = getStatusBadge(String(sale.status));
                                            return (
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badge.className}`}>
                                                    {badge.label}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                </div>

                                <div className="p-5 space-y-5">
                                    {/* Itens */}
                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Itens</h4>
                                        <div className="space-y-3">
                                            {sale.items.map((item, idx) => {
                                                const itemSpecs = productSpecs[(item as any).id] || {};
                                                const productLevel = productSpecs[(item as any).product_id] || {};
                                                const specs = { ...productLevel, ...itemSpecs };
                                                const idParts: string[] = [];
                                                if (specs.imei1) idParts.push(`IMEI 1: ${specs.imei1}`);
                                                if (specs.imei2) idParts.push(`IMEI 2: ${specs.imei2}`);
                                                if (specs.serial) idParts.push(`Serial: ${specs.serial}`);
                                                const identifier = idParts.length > 0
                                                    ? idParts.join(' | ')
                                                    : (item.product_sku ? `SKU: ${item.product_sku}` : null);
                                                return (
                                                    <div key={idx} className="flex justify-between items-start py-2 border-b border-slate-100 last:border-0">
                                                        <div>
                                                            <div className="text-sm font-medium text-slate-800">
                                                                {item.quantity > 1 && <span className="mr-1.5 text-slate-500">{item.quantity}x</span>}
                                                                <Link
                                                                    to={`/?search=${encodeURIComponent(item.product_name)}`}
                                                                    className="hover:text-blue-600 hover:underline transition-colors cursor-pointer"
                                                                >
                                                                    {item.product_name}
                                                                </Link>
                                                            </div>
                                                            {identifier && <div className="text-xs text-slate-400 mt-0.5">{identifier}</div>}
                                                            {(item.warranty_months && item.warranty_months > 0) ? (
                                                                <div className="text-xs text-blue-600 font-medium mt-1">
                                                                    🛡️ Garantia de +{item.warranty_months} Meses (+ {fmt(item.warranty_price || 0)})
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                        <div className="text-sm font-bold text-slate-800 ml-4">{fmt(item.subtotal + (item.warranty_price || 0))}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <SignedWarrantyDocumentCard saleId={sale.id} />

                                    {/* Timeline de progresso (somente pedidos online) */}
                                    {isOnlineOrder && (
                                        <div>
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Progresso do pedido</h4>
                                            {isTerminalNegative ? (
                                                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                                                    <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                                        <X className="w-5 h-5 text-red-600" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-semibold text-red-800">
                                                            {orderStatus === 'cancelled' ? 'Pedido cancelado' : 'Pagamento recusado'}
                                                        </div>
                                                        <div className="text-xs text-red-600 mt-0.5">
                                                            {orderStatus === 'cancelled'
                                                                ? 'Este pedido foi cancelado e não será processado.'
                                                                : 'O pagamento não foi aprovado. Você pode tentar novamente em uma nova compra.'}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <ol className="flex items-start justify-between gap-1">
                                                    {ONLINE_ORDER_STAGES.map((stage, idx) => {
                                                        const reached = stageIndex >= idx;
                                                        const current = stageIndex === idx;
                                                        const StageIcon = stage.Icon;
                                                        return (
                                                            <li key={stage.key} className="flex-1 flex flex-col items-center text-center min-w-0">
                                                                <div className="flex items-center w-full">
                                                                    <div className={`flex-1 h-0.5 ${idx === 0 ? 'invisible' : reached ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                                                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 flex-shrink-0 ${
                                                                        reached
                                                                            ? 'bg-emerald-500 border-emerald-500 text-white'
                                                                            : 'bg-white border-slate-300 text-slate-400'
                                                                    } ${current ? 'ring-4 ring-emerald-100' : ''}`}>
                                                                        <StageIcon size={14} />
                                                                    </div>
                                                                    <div className={`flex-1 h-0.5 ${idx === ONLINE_ORDER_STAGES.length - 1 ? 'invisible' : (stageIndex > idx ? 'bg-emerald-500' : 'bg-slate-200')}`} />
                                                                </div>
                                                                <span className={`mt-2 text-[11px] leading-tight ${current ? 'font-semibold text-slate-800' : reached ? 'text-slate-600' : 'text-slate-400'}`}>
                                                                    {stage.label}
                                                                </span>
                                                            </li>
                                                        );
                                                    })}
                                                </ol>
                                            )}

                                            {/* Detalhes do pagamento (gateway) */}
                                            {(pixTicketUrl || gatewayPaymentId) && (
                                                <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
                                                    <div className="text-xs text-blue-900">
                                                        {paymentGateway === 'mercado_pago' && (
                                                            <div className="font-semibold">Pagamento via Mercado Pago</div>
                                                        )}
                                                        {gatewayPaymentId && (
                                                            <div className="text-blue-700">ID do pagamento: <code className="font-mono">{gatewayPaymentId}</code></div>
                                                        )}
                                                    </div>
                                                    {pixTicketUrl && (
                                                        <a
                                                            href={pixTicketUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                                                        >
                                                            <ExternalLink size={13} />
                                                            Ver no Mercado Pago
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Bloco de entrega */}
                                    {isOnlineOrder && deliveryType && (
                                        <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                                            <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center gap-2">
                                                {deliveryType === 'pickup'
                                                    ? <Package className="w-4 h-4 text-slate-700" />
                                                    : <Truck className="w-4 h-4 text-slate-700" />}
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                                                    {deliveryType === 'pickup' ? 'Retirada na loja' : 'Acompanhar entrega'}
                                                </span>
                                            </div>
                                            <div className="p-4 space-y-3 text-sm">
                                                {deliveryType === 'pickup' ? (
                                                    <>
                                                        <div className="text-slate-700">
                                                            Você vai retirar este pedido diretamente {shippingOriginLabel ? <>na loja em <strong>{shippingOriginLabel}</strong></> : 'na loja'} após a confirmação do pagamento.
                                                        </div>
                                                        {shippingOriginCep && (
                                                            <div className="text-xs text-slate-500">CEP da loja: <span className="font-mono">{shippingOriginCep}</span></div>
                                                        )}
                                                        <div className="text-xs text-slate-500">
                                                            A loja entrará em contato avisando quando o pedido estiver disponível para retirada.
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        {shippingOriginLabel && (
                                                            <div className="text-xs text-slate-500 flex items-center gap-1">
                                                                <Truck size={12} className="text-slate-400" />
                                                                Saindo de <strong className="text-slate-700">{shippingOriginLabel}</strong>
                                                                {shippingOriginCep ? <> · <span className="font-mono">{shippingOriginCep}</span></> : null}
                                                            </div>
                                                        )}
                                                        {shippingAddress ? (
                                                            <div className="bg-white border border-slate-200 rounded-md p-3">
                                                                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Endereço de entrega</div>
                                                                <div className="text-slate-800 font-medium leading-relaxed">
                                                                    {shippingAddress.street}{shippingAddress.number ? `, ${shippingAddress.number}` : ''}
                                                                    {shippingAddress.complement ? <> — <span className="text-slate-600">{shippingAddress.complement}</span></> : null}
                                                                </div>
                                                                <div className="text-slate-600 text-sm mt-0.5">
                                                                    {shippingAddress.neighborhood}
                                                                    {(shippingAddress.city || shippingAddress.state)
                                                                        ? <>{shippingAddress.neighborhood ? ' · ' : ''}{shippingAddress.city}{shippingAddress.state ? `/${shippingAddress.state}` : ''}</>
                                                                        : null}
                                                                </div>
                                                                {shippingAddress.cep && (
                                                                    <div className="text-xs text-slate-500 mt-1">CEP: <span className="font-mono">{shippingAddress.cep}</span></div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="text-xs text-slate-500 italic">Endereço não informado.</div>
                                                        )}
                                                    </>
                                                )}
                                                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                                                    <span className="text-xs text-slate-500">Custo da entrega</span>
                                                    <span className="text-sm font-semibold text-slate-800">{shippingCost > 0 ? fmt(shippingCost) : 'Grátis'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Resumo + Pagamento */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Resumo</h4>
                                            <div className="space-y-1 text-sm">
                                                {sale.discount_total > 0 && (
                                                    <div className="flex justify-between text-slate-500">
                                                        <span>Descontos</span>
                                                        <span className="text-orange-600">- {fmt(sale.discount_total)}</span>
                                                    </div>
                                                )}
                                                {(sale as any).delivery_total > 0 && (
                                                    <div className="flex justify-between text-slate-500">
                                                        <span>Frete / Entrega</span>
                                                        <span>+ {fmt((sale as any).delivery_total)}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between font-bold text-slate-800 pt-1 border-t border-slate-200">
                                                    <span>Total</span>
                                                    <span>{fmt(sale.total)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Pagamento</h4>
                                            <div className="space-y-1">
                                                {payments.map((p: any, i: number) => (
                                                    <div key={i} className="flex justify-between text-sm">
                                                        <span className="text-slate-600">
                                                            {paymentLabel(p.method)}
                                                            {p.method === 'credit' && p.installments > 1 && ` ${p.installments}x`}
                                                        </span>
                                                        <span className="font-medium text-slate-800">{fmt(p.total_with_fee || p.amount)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
