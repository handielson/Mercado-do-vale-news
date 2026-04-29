import React, { useState, useEffect } from 'react';
import { ShoppingBag, X, Calendar, User, UserCheck, Package, DollarSign, CreditCard, Banknote, Truck, AlertCircle, RefreshCw, FileText, Receipt } from 'lucide-react';
import { printSaleReceipt, PrintReceiptBenefits } from '../../../utils/printSaleReceipt';
import { SaleWithItems } from '../../../types/sale';
import { cancelSale, refundSale, deleteSale } from '../../../services/saleService';
import toast from 'react-hot-toast';
import { supabase } from '../../../services/supabase';
import { companySettingsService } from '../../../services/companySettingsService';
import { replaceWarrantyTags, applyWarrantyDisplayFlags, renderWarrantyBothCopies, getWarrantyDeclaration, formatWarrantyDate, formatWarrantyPhone, formatWarrantyCpfCnpj } from '../../../utils/warrantyTagReplacement';
import { getCoinBalance } from '../../../services/cashbackService';
import { benefitService } from '../../../services/benefitService';
import { vpsApiService } from '../../../services/vpsApiService';

interface SaleDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    sale: SaleWithItems | null;
    onStatusChange: () => void; // Triggered after cancel or refund to reload lists
}

export default function SaleDetailsModal({ isOpen, onClose, sale, onStatusChange }: SaleDetailsModalProps) {
    const [isCancelling, setIsCancelling] = useState(false);
    const [isRefunding, setIsRefunding] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmAction, setConfirmAction] = useState<'cancel' | 'refund' | 'delete' | null>(null);
    const [isPrintingWarranty, setIsPrintingWarranty] = useState(false);
    const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
    const [isPrintingAll, setIsPrintingAll] = useState(false);
    // Map keyed por product_id (specs gerais) e por sale_item.id (IMEI da unit serializada).
    const [productSpecs, setProductSpecs] = useState<Record<string, Record<string, string>>>({});

    useEffect(() => {
        if (!isOpen || !sale?.items?.length) return;
        let cancelled = false;
        (async () => {
            const map: Record<string, Record<string, string>> = {};

            // Specs gerais por product_id (color, ram, storage)
            const productIds = sale.items.map(i => (i as any).product_id).filter(Boolean);
            if (productIds.length) {
                const { data } = await supabase.from('products').select('id, specs').in('id', productIds);
                (data || []).forEach(p => { map[p.id] = p.specs || {}; });
            }

            // IMEIs por sale_item.id — busca units da VPS pela sale_id
            const units = await vpsApiService.getUnitsBySale(sale.id);
            const itemsBySerializedUnit = new Map<string, string>();
            sale.items.forEach((item: any) => {
                if (item.serialized_unit_id) itemsBySerializedUnit.set(item.serialized_unit_id, item.id);
            });
            (units || []).forEach((u: any) => {
                const itemId = itemsBySerializedUnit.get(u.id);
                if (!itemId) return;
                map[itemId] = {
                    ...(map[itemId] || {}),
                    imei1: u.imei_1 || '',
                    imei2: u.imei_2 || '',
                    serial: u.serial || '',
                };
            });

            if (!cancelled) setProductSpecs(map);
        })();
        return () => { cancelled = true; };
    }, [isOpen, sale?.id]);

    const handleReprintWarranty = async () => {
        if (!sale || sale.items.length === 0) return;
        setIsPrintingWarranty(true);
        try {
            const settings = await companySettingsService.get();
            if (!settings?.warranty_template) {
                toast.error('Template de garantia não configurado');
                return;
            }

            // Só emite termo para items serializados
            const serializedItems = sale.items.filter((i: any) => i.serialized_unit_id);
            if (serializedItems.length === 0) {
                toast.error('Nenhum item serializado nesta venda — sem termo a imprimir');
                return;
            }

            // Carrega units VPS pra resolver IMEI por sale_item.id
            const units = await vpsApiService.getUnitsBySale(sale.id);
            const unitById = new Map<string, any>();
            (units || []).forEach((u: any) => unitById.set(u.id, u));

            // Carrega brands pra resolver dias por marca
            const { brandService } = await import('../../../services/brands');
            const { categoryService } = await import('../../../services/categories');
            const { productService } = await import('../../../services/products');
            const brands = await brandService.list();
            const brandsByName = new Map<string, { warranty_days?: number }>();
            brands.forEach(b => brandsByName.set(b.name.toLowerCase(), b));

            const customer = sale.customer;
            const declaracao = getWarrantyDeclaration(
                sale.delivery_type === 'delivery' || sale.delivery_type === 'store_delivery' || sale.delivery_type === 'hybrid_delivery'
                    ? 'delivery' : 'store_pickup'
            );

            const sections: string[] = [];
            for (const item of serializedItems) {
                const product = item.product_id ? await productService.getById(item.product_id) : null;
                const productSpecs = product?.specs || {};
                const brand = product?.brand || (item as any).product_brand || '';
                const model = product?.model || product?.name || item.product_name;

                // Resolve dias
                let days = 90;
                if (product?.warranty_type === 'custom' && product.warranty_template_id) {
                    const { data } = await supabase.from('warranty_templates').select('duration_days').eq('id', product.warranty_template_id).maybeSingle();
                    if (data?.duration_days) days = data.duration_days;
                } else {
                    const b = brandsByName.get(brand.toLowerCase());
                    if (b?.warranty_days) days = b.warranty_days;
                    else if (product?.category_id) {
                        const cat = await categoryService.getById(product.category_id);
                        if (cat?.warranty_days) days = cat.warranty_days;
                    }
                }

                const unit = unitById.get((item as any).serialized_unit_id) || {};
                const tagData = {
                    nome_loja: settings.company_name || '',
                    endereco: settings.address || '',
                    telefone: formatWarrantyPhone(settings.phone || ''),
                    email: settings.email || '',
                    cnpj: formatWarrantyCpfCnpj(settings.cnpj || ''),
                    logo: (settings as any).logo || settings.receipt_logo_url || '',
                    nome_cliente: customer?.name || '',
                    cpf_cliente: formatWarrantyCpfCnpj(customer?.cpf_cnpj || ''),
                    telefone_cliente: '',
                    email_cliente: '',
                    numero_venda: sale.id.slice(0, 8),
                    data_compra: formatWarrantyDate(sale.created_at),
                    produto: item.product_name,
                    marca: brand,
                    modelo: model,
                    cor: productSpecs.color || '',
                    ram: productSpecs.ram || '',
                    memoria: productSpecs.storage || '',
                    imei1: unit.imei_1 || '',
                    imei2: unit.imei_2 || '',
                    dias_garantia: String(days),
                    tipo_garantia: 'Garantia Legal',
                    declaracao_recebimento: declaracao,
                };
                const filtered = applyWarrantyDisplayFlags(tagData as any, settings);
                const { copy1, copy2 } = renderWarrantyBothCopies(settings.warranty_template, filtered);
                sections.push(`<div class="warranty-copy">${copy1}</div>`);
                sections.push(`<div class="warranty-copy">${copy2}</div>`);
            }

            const printWindow = window.open('', '_blank');
            if (!printWindow) { toast.error('Permita popups para imprimir'); return; }
            printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Termos de Garantia (${serializedItems.length} aparelho(s) × 2 vias)</title><style>body{font-family:Arial,sans-serif;padding:20px;line-height:1.6}.warranty-copy{page-break-after:always;margin-bottom:40px}.warranty-copy:last-child{page-break-after:auto}</style></head><body>${sections.join('')}</body></html>`);
            printWindow.document.close();
            printWindow.print();
        } catch (e) {
            console.error(e);
            toast.error('Erro ao gerar o termo de garantia');
        } finally {
            setIsPrintingWarranty(false);
        }
    };

    const handlePrintReceipt = async () => {
        if (!sale) return;
        setIsPrintingReceipt(true);
        try {
            const customerId = sale.customer_id;
            const [settings, coinBalance, benefitStatuses, coinsThisSale] = await Promise.all([
                companySettingsService.get(),
                customerId ? getCoinBalance(customerId).catch(() => null) : Promise.resolve(null),
                customerId ? benefitService.getCustomerBenefitsStatus(customerId).catch(() => []) : Promise.resolve([]),
                customerId
                    ? supabase
                        .from('coin_transactions')
                        .select('amount')
                        .eq('customer_id', customerId)
                        .eq('reference_id', sale.id)
                        .eq('type', 'earn_purchase')
                        .maybeSingle()
                        .then(({ data }) => data?.amount ?? 0)
                        .catch(() => 0)
                    : Promise.resolve(0),
            ]);
            if (!settings) { toast.error('Configurações da empresa não encontradas'); return; }
            const benefits: PrintReceiptBenefits = {
                coinBalance,
                coinsEarnedThisSale: coinsThisSale,
                benefitStatuses,
            };
            printSaleReceipt(sale, settings, productSpecs, benefits);
        } catch (e) {
            console.error(e);
            toast.error('Erro ao gerar o recibo');
        } finally {
            setIsPrintingReceipt(false);
        }
    };

    const handlePrintAll = async () => {
        if (!sale) return;
        setIsPrintingAll(true);
        try {
            // Dispara os dois em paralelo — cada janela abre com seu @page size
            await Promise.all([handleReprintWarranty(), handlePrintReceipt()]);
        } finally {
            setIsPrintingAll(false);
        }
    };

    if (!isOpen || !sale) return null;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value / 100);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleCancel = async () => {
        setIsCancelling(true);
        setConfirmAction(null);
        try {
            await cancelSale(sale.id);
            toast.success('Venda cancelada com sucesso!');
            onStatusChange();
            onClose();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Erro ao cancelar a venda');
        } finally {
            setIsCancelling(false);
        }
    };

    const handleRefund = async () => {
        setIsRefunding(true);
        setConfirmAction(null);
        try {
            await refundSale(sale.id);
            toast.success('Venda estornada com sucesso!');
            onStatusChange();
            onClose();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Erro ao estornar a venda');
        } finally {
            setIsRefunding(false);
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        setConfirmAction(null);
        try {
            await deleteSale(sale.id);
            toast.success('Venda excluída permanentemente!');
            onStatusChange();
            onClose();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Erro ao excluir a venda');
        } finally {
            setIsDeleting(false);
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            case 'refunded': return 'bg-orange-100 text-orange-800';
            default: return 'bg-slate-100 text-slate-800';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'completed': return 'Concluída';
            case 'cancelled': return 'Cancelada';
            case 'refunded': return 'Estornada';
            default: return status;
        }
    };

    const getPaymentIcon = (method: string) => {
        switch (method) {
            case 'pix': return <Package size={16} className="text-teal-500" />;
            case 'money': return <Banknote size={16} className="text-emerald-500" />;
            case 'credit': return <CreditCard size={16} className="text-purple-500" />;
            case 'debit': return <CreditCard size={16} className="text-blue-500" />;
            default: return <DollarSign size={16} />;
        }
    };

    const getPaymentLabel = (method: string) => {
        switch (method) {
            case 'pix': return 'PIX';
            case 'money': return 'Dinheiro';
            case 'credit': return 'Crédito';
            case 'debit': return 'Débito';
            default: return method;
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-50 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-white rounded-t-2xl shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                            <ShoppingBag size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-bold text-slate-800">
                                    Pedido #{sale.id.split('-')[0]}
                                </h2>
                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusStyle(sale.status)}`}>
                                    {getStatusLabel(sale.status)}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                                <span className="flex items-center gap-1">
                                    <Calendar size={14} />
                                    {formatDate(sale.created_at)}
                                </span>
                                {sale.seller && (
                                    <span className="flex items-center gap-1">
                                        <UserCheck size={14} />
                                        Vendedor: {sale.seller.name.split(' ')[0]}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Customer Info */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200">
                        <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <User size={16} className="text-slate-400" />
                            Dados do Cliente
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-medium">Nome</p>
                                <p className="text-sm font-medium text-slate-800">{sale.customer?.name || 'Cliente Avulso'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-medium">CPF/CNPJ</p>
                                <p className="text-sm text-slate-600">{sale.customer?.cpf_cnpj || 'Não informado'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Items List */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200">
                        <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <Package size={16} className="text-slate-400" />
                            Itens do Pedido ({sale.items.length})
                        </h3>
                        <div className="space-y-3">
                            {sale.items.map((item, index) => (
                                <div key={index} className="flex justify-between items-start py-3 border-b border-slate-100 last:border-0 last:pb-0">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-slate-800">{item.product_name}</p>
                                            {item.is_gift && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-pink-100 text-pink-700 rounded">
                                                    BRINDE
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {(() => {
                                                const itemSpecs = productSpecs[(item as any).id] || {};
                                                const productLevel = productSpecs[(item as any).product_id] || {};
                                                const specs = { ...productLevel, ...itemSpecs };
                                                const parts: string[] = [];
                                                if (specs.imei1) parts.push(`IMEI 1: ${specs.imei1}`);
                                                if (specs.imei2) parts.push(`IMEI 2: ${specs.imei2}`);
                                                if (specs.serial) parts.push(`Serial: ${specs.serial}`);
                                                const idLine = parts.length > 0
                                                    ? parts.join(' | ')
                                                    : `SKU: ${item.product_sku || 'N/A'}`;
                                                return `${idLine} • Qtd: ${item.quantity}`;
                                            })()}
                                            {item.discount > 0 ? ` • Desc: ${formatCurrency(item.discount)}/un` : ''}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        {item.discount > 0 && (
                                            <p className="text-xs text-slate-400 line-through">
                                                {formatCurrency(item.unit_price * item.quantity)}
                                            </p>
                                        )}
                                        <p className="text-sm font-bold text-slate-800">
                                            {formatCurrency(item.total)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Financial Summary & Payments */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Summary */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200">
                            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                <DollarSign size={16} className="text-slate-400" />
                                Resumo Financeiro
                            </h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between text-slate-600">
                                    <span>Subtotal Produtos</span>
                                    <span>{formatCurrency(sale.subtotal)}</span>
                                </div>

                                {sale.promotional_discount ? (
                                    <div className="flex justify-between text-green-600">
                                        <span>Desconto Adicional (Cupom/Manual)</span>
                                        <span>-{formatCurrency(sale.promotional_discount)}</span>
                                    </div>
                                ) : null}

                                {sale.delivery_cost_customer ? (
                                    <div className="flex justify-between text-blue-600">
                                        <span>Taxa de Entrega (Cliente)</span>
                                        <span>+{formatCurrency(sale.delivery_cost_customer)}</span>
                                    </div>
                                ) : null}

                                <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between font-bold text-lg text-slate-800">
                                    <span>Total Pago</span>
                                    <span>{formatCurrency(sale.total)}</span>
                                </div>

                                <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between text-sm font-medium">
                                    <span className="text-emerald-600">Lucro Estimado</span>
                                    <span className="text-emerald-700">{formatCurrency(sale.profit)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Payment Methods */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200">
                            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                <CreditCard size={16} className="text-slate-400" />
                                Formas de Pagamento
                            </h3>
                            <div className="space-y-3">
                                {sale.payment_methods.map((payment, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <div className="flex items-center gap-3">
                                            {getPaymentIcon(payment.method)}
                                            <div>
                                                <p className="text-sm font-medium text-slate-800">
                                                    {getPaymentLabel(payment.method)}
                                                    {payment.installments ? ` (${payment.installments}x)` : ''}
                                                </p>
                                                {payment.fee_amount ? (
                                                    <p className="text-xs text-slate-500">
                                                        Inclui {formatCurrency(payment.fee_amount)} de juros maq.
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>
                                        <p className="text-sm font-bold text-slate-800">
                                            {formatCurrency(payment.total_with_fee)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* Delivery Section (If Applicable) */}
                    {sale.delivery_type && sale.delivery_type !== 'store_pickup' && sale.delivery_type !== 'pickup' && (
                        <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
                            <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                                <Truck size={16} />
                                Dados de Logística
                            </h3>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <p className="text-xs text-blue-600 uppercase font-medium">Tipo</p>
                                    <p className="font-medium text-slate-700 mt-1">
                                        {sale.delivery_type === 'store_delivery' || sale.delivery_type === 'delivery' ? 'Entrega Local' : 'Híbrida'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-blue-600 uppercase font-medium">Custo Pago ao Mktplace</p>
                                    <p className="font-medium text-slate-700 mt-1">
                                        {formatCurrency(sale.delivery_cost_store || 0)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-blue-600 uppercase font-medium">Total do Entregador</p>
                                    <p className="font-medium text-slate-700 mt-1">
                                        {formatCurrency(sale.delivery_total || 0)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex flex-col gap-3 shrink-0">
                    {/* Confirmação inline */}
                    {confirmAction && (
                        <div className={`flex items-center justify-between p-3 rounded-lg border ${confirmAction === 'delete' ? 'bg-red-100 border-red-300' : confirmAction === 'cancel' ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
                            <span className="text-sm font-medium text-slate-700">
                                {confirmAction === 'cancel'
                                    ? 'Tem certeza? Esta ação cancelará a venda permanentemente.'
                                    : confirmAction === 'refund'
                                        ? 'Tem certeza? Esta ação marcará a venda como estornada.'
                                        : '⚠️ Excluir permanentemente? O registro será apagado do banco de dados.'}
                            </span>
                            <div className="flex gap-2 ml-4 shrink-0">
                                <button
                                    onClick={() => setConfirmAction(null)}
                                    className="px-3 py-1.5 text-xs text-slate-600 font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                                >
                                    Não, voltar
                                </button>
                                <button
                                    onClick={confirmAction === 'cancel' ? handleCancel : confirmAction === 'refund' ? handleRefund : handleDelete}
                                    disabled={isCancelling || isRefunding || isDeleting}
                                    className={`px-3 py-1.5 text-xs text-white font-medium rounded-lg disabled:opacity-50 flex items-center gap-1 ${confirmAction === 'delete' ? 'bg-red-700 hover:bg-red-800' : confirmAction === 'cancel' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-500 hover:bg-orange-600'}`}
                                >
                                    {(isCancelling || isRefunding || isDeleting) && <RefreshCw size={12} className="animate-spin" />}
                                    Sim, confirmar
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between items-center">
                        {/* Left: print actions */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrintAll}
                                disabled={isPrintingAll || isPrintingWarranty || isPrintingReceipt}
                                title="Imprimir Garantia + Recibo simultaneamente"
                                className="px-3 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                            >
                                {isPrintingAll
                                    ? <RefreshCw size={16} className="animate-spin" />
                                    : <span>🖨️</span>}
                                <span className="text-sm">Imprimir Tudo</span>
                            </button>
                            <div className="w-px h-6 bg-slate-200" />
                            <button
                                onClick={handleReprintWarranty}
                                disabled={isPrintingWarranty || isPrintingAll}
                                title="Reimprimir Termo de Garantia"
                                className="px-3 py-2 bg-blue-50 text-blue-700 font-medium rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 flex items-center gap-2 border border-blue-200"
                            >
                                {isPrintingWarranty
                                    ? <RefreshCw size={16} className="animate-spin" />
                                    : <FileText size={16} />}
                                <span className="text-sm">Garantia</span>
                            </button>
                            <button
                                onClick={handlePrintReceipt}
                                disabled={isPrintingReceipt || isPrintingAll}
                                title="Imprimir Recibo"
                                className="px-3 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center gap-2 border border-slate-200"
                            >
                                {isPrintingReceipt
                                    ? <RefreshCw size={16} className="animate-spin" />
                                    : <Receipt size={16} />}
                                <span className="text-sm">Recibo</span>
                            </button>
                        </div>

                        {/* Right: destructive actions */}
                        <div className="flex items-center gap-2">

                            {sale.status === 'completed' && !confirmAction && (
                                <>
                                    <button
                                        onClick={() => setConfirmAction('refund')}
                                        disabled={isRefunding || isCancelling}
                                        className="px-4 py-2 bg-orange-100 text-orange-700 font-medium rounded-lg hover:bg-orange-200 transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        Estornar Venda
                                    </button>
                                    <button
                                        onClick={() => setConfirmAction('cancel')}
                                        disabled={isRefunding || isCancelling}
                                        className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
                                    >
                                        Cancelar Venda
                                    </button>
                                </>
                            )}

                            {(sale.status === 'cancelled' || sale.status === 'refunded') && !confirmAction && (
                                <button
                                    onClick={() => setConfirmAction('delete')}
                                    disabled={isDeleting}
                                    className="px-4 py-2 bg-red-700 text-white font-medium rounded-lg hover:bg-red-800 transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
                                >
                                    {isDeleting && <RefreshCw size={16} className="animate-spin" />}
                                    Excluir Venda
                                </button>
                            )}
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
}
