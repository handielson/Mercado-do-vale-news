import React, { useState, useEffect } from 'react';
import { ShoppingBag, X, Calendar, User, UserCheck, Package, DollarSign, CreditCard, Banknote, Truck, AlertCircle, RefreshCw, FileText, Receipt, ExternalLink } from 'lucide-react';
import { printSaleReceipt, PrintReceiptBenefits } from '../../../utils/printSaleReceipt';
import { SaleWithItems } from '../../../types/sale';
import { cancelSale, refundSale, deleteSale, patchSale } from '../../../services/saleService';
import { toast } from 'sonner';
import { companySettingsService } from '../../../services/companySettingsService';
import { replaceWarrantyTags, applyWarrantyDisplayFlags, renderWarrantyBothCopies, getWarrantyDeclaration, formatWarrantyDate, formatWarrantyPhone, formatWarrantyCpfCnpj } from '../../../utils/warrantyTagReplacement';
import { getCoinBalance, getCoinsEarnedForReference } from '../../../services/cashbackService';
import { benefitService } from '../../../services/benefitService';
import { vpsApiService } from '../../../services/vpsApiService';
import { vpsClient } from '../../../services/vpsClient';
import { warrantyTemplateService } from '../../../services/warrantyTemplates';
import {
    buildPaymentPresentation,
    buildSaleItemPresentation,
    formatCurrencyCents,
    getSaleCollectedTotal,
    getSaleCostTotal,
    getSaleRealProfit,
    SaleProfitData
} from '../../../utils/salePresentation';

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

    const [adminNotes, setAdminNotes] = useState('');
    const [isSavingNotes, setIsSavingNotes] = useState(false);
    const [realProfit, setRealProfit] = useState<SaleProfitData>(null);
    const [isLoadingProfit, setIsLoadingProfit] = useState(false);

    useEffect(() => {
        if (sale) {
            setAdminNotes(sale.internal_notes || '');
        }
    }, [sale]);

    // Busca lucro real via endpoint dedicado (JOIN com price_cost dos produtos)
    useEffect(() => {
        if (!isOpen || !sale?.id) return;
        let cancelled = false;
        setIsLoadingProfit(true);
        setRealProfit(null);
        vpsClient.get<any>(`/sales/${sale.id}/profit`)
            .then(data => { if (!cancelled) setRealProfit(data); })
            .catch((err) => { console.error('[profit] endpoint falhou:', err?.message || err); })
            .finally(() => { if (!cancelled) setIsLoadingProfit(false); });
        return () => { cancelled = true; };
    }, [isOpen, sale?.id]);

    const handleSaveNotes = async () => {
        if (!sale) return;
        setIsSavingNotes(true);
        try {
            await patchSale(sale.id, { internal_notes: adminNotes });
            toast.success('Observações internas salvas com sucesso!');
            sale.internal_notes = adminNotes;
        } catch (err: any) {
            console.error(err);
            toast.error('Erro ao salvar observações');
        } finally {
            setIsSavingNotes(false);
        }
    };

    useEffect(() => {
        if (!isOpen || !sale?.items?.length) return;
        let cancelled = false;
        (async () => {
            const map: Record<string, Record<string, string>> = {};

            // Specs gerais por product_id (color, ram, storage)
            const productIds = sale.items.map(i => (i as any).product_id).filter(Boolean);
            if (productIds.length) {
                const data = await vpsApiService.getProductsByIds([...new Set(productIds)]);
                (data || []).forEach((p: any) => { map[p.id] = { ...p.specs || {}, sku: p.sku || null }; });
            }

            // IMEIs por sale_item.id — busca units da VPS pela sale_id
            const units = await vpsApiService.getUnitsBySale(sale.id);
            const itemsBySerializedUnit = new Map<string, string>();
            const remainingItemsByProduct = new Map<string, any[]>();
            sale.items.forEach((item: any) => {
                if (item.serialized_unit_id) itemsBySerializedUnit.set(item.serialized_unit_id, item.id);
                const productId = String(item.product_id || '');
                if (productId) {
                    const list = remainingItemsByProduct.get(productId) || [];
                    list.push(item);
                    remainingItemsByProduct.set(productId, list);
                }
            });
            (units || []).forEach((u: any) => {
                const fallbackItem = (remainingItemsByProduct.get(String(u.product_id || '')) || []).shift();
                const itemId = itemsBySerializedUnit.get(u.id) || fallbackItem?.id;
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

            const { productService } = await import('../../../services/products');
            const { categoryService } = await import('../../../services/categories');

            // Filtragem das categorias relacionadas a celulares e tablets
            const filteredItems: any[] = [];
            for (const item of sale.items) {
                if (!item.product_id) continue;
                try {
                    const product = await productService.getById(item.product_id);
                    if (product?.category_id) {
                        const cat = await categoryService.getById(product.category_id);
                        if (cat) {
                            const catName = (cat.name || '').toLowerCase();
                            const catSlug = (cat.slug || '').toLowerCase();
                            const isCellOrTablet =
                                catName.includes('celular') ||
                                catName.includes('smartphone') ||
                                catName.includes('tablet') ||
                                catName.includes('iphone') ||
                                catSlug.includes('celular') ||
                                catSlug.includes('smartphone') ||
                                catSlug.includes('tablet') ||
                                catSlug.includes('iphone');
                            if (isCellOrTablet) {
                                filteredItems.push(item);
                            }
                        }
                    }
                } catch (err) {
                    console.error('Erro ao obter categoria do produto', err);
                }
            }

            if (filteredItems.length === 0) {
                toast.error('Nenhum item celular/tablet encontrado para a garantia.');
                return;
            }

            const units = await vpsApiService.getUnitsBySale(sale.id) || [];
            const unitsByProductId = new Map<string, any[]>();
            units.forEach((unit: any) => {
                const productId = String(unit.product_id || '');
                if (!productId) return;
                const list = unitsByProductId.get(productId) || [];
                list.push(unit);
                unitsByProductId.set(productId, list);
            });

            const itemUnitPairs = filteredItems.map((item: any) => {
                const explicitUnit = item.serialized_unit_id
                    ? units.find((unit: any) => String(unit.id) === String(item.serialized_unit_id))
                    : null;
                const productUnits = unitsByProductId.get(String(item.product_id || '')) || [];
                if (explicitUnit) {
                    const explicitIndex = productUnits.findIndex((unit: any) => String(unit.id) === String(explicitUnit.id));
                    if (explicitIndex >= 0) productUnits.splice(explicitIndex, 1);
                }
                const matchedUnit = explicitUnit || productUnits.shift() || null;
                const itemSpecs = productSpecs[item.id] || productSpecs[item.product_id] || item.product_specs || {};
                const hasSerializedData = Boolean(
                    item.serialized_unit_id ||
                    item.serialized_unit?.unitId ||
                    item.serialized_unit?.imei1 ||
                    item.serialized_unit?.imei2 ||
                    item.serialized_unit?.serial ||
                    matchedUnit?.id ||
                    itemSpecs.imei1 ||
                    itemSpecs.imei2 ||
                    itemSpecs.serial
                );
                return { item, unit: matchedUnit, itemSpecs, hasSerializedData };
            });

            const serializedPairs = itemUnitPairs.filter(pair => pair.hasSerializedData);
            const cellTabletUnitIds = new Set(
                serializedPairs
                    .map(pair => pair.unit?.id || pair.item.serialized_unit_id || pair.item.serialized_unit?.unitId)
                    .filter(Boolean)
                    .map(String)
            );

            const { warrantyDocumentService } = await import('../../../services/warrantyDocumentService');
            const sections: string[] = [];

            // 1) Tenta usar docs já salvos (numero_documento estável). Inclui o que
            //    foi assinado no momento da venda.
            const savedDocs = await warrantyDocumentService.listBySaleId(sale.id);
            const filteredSavedDocs = savedDocs.filter(doc =>
                !doc.serialized_unit_id || cellTabletUnitIds.size === 0 || cellTabletUnitIds.has(String(doc.serialized_unit_id))
            );

            if (savedDocs.length > 0) {
                if (filteredSavedDocs.length === 0) {
                    toast.error('Nenhum termo de garantia de celular/tablet disponível.');
                    return;
                }
                for (const doc of filteredSavedDocs) {
                    const copy1 = doc.warranty_content;
                    const copy2 = doc.warranty_content.replace(/Assinatura do Cliente/gi, 'Assinatura da Empresa');
                    sections.push(`<div class="warranty-copy">${copy1}</div>`);
                    sections.push(`<div class="warranty-copy">${copy2}</div>`);
                }
            } else {
                // 2) Fallback: nenhum doc salvo (vendas migradas ou usuário fechou
                //    modal sem salvar). Regenera dos sale_items serializados.
                if (serializedPairs.length === 0) {
                    toast.error('Nenhum item serializado nesta venda — sem termo a imprimir');
                    return;
                }

                const { brandService } = await import('../../../services/brands');
                const brands = await brandService.list();
                const brandsByName = new Map<string, { warranty_days?: number }>();
                brands.forEach(b => brandsByName.set(b.name.toLowerCase(), b));

                const customer = sale.customer;
                const declaracao = getWarrantyDeclaration(
                    sale.delivery_type === 'delivery' || sale.delivery_type === 'store_delivery' || sale.delivery_type === 'hybrid_delivery'
                        ? 'delivery' : 'store_pickup'
                );

                for (const { item, unit, itemSpecs } of serializedPairs) {
                    const product = item.product_id ? await productService.getById(item.product_id) : null;
                    const productSpecs = product?.specs || {};
                    const mergedSpecs = { ...productSpecs, ...itemSpecs };
                    const brand = product?.brand || (item as any).product_brand || '';
                    const model = product?.model || product?.name || item.product_name;

                    let days = 90;
                    if (product?.warranty_type === 'custom' && product.warranty_template_id) {
                        const template = await warrantyTemplateService.getById(product.warranty_template_id);
                        if (template?.duration_days) days = template.duration_days;
                    } else {
                        const b = brandsByName.get(brand.toLowerCase());
                        if (b?.warranty_days) days = b.warranty_days;
                        else if (product?.category_id) {
                            const cat = await categoryService.getById(product.category_id);
                            if (cat?.warranty_days) days = cat.warranty_days;
                        }
                    }

                    const fallbackDocId = crypto.randomUUID();
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
                        numero_venda: sale.id.slice(0, 8).toUpperCase(),
                        numero_documento: fallbackDocId.slice(0, 8).toUpperCase(),
                        data_compra: formatWarrantyDate(sale.created_at),
                        produto: item.product_name,
                        marca: brand,
                        modelo: model,
                        cor: mergedSpecs.color || '',
                        ram: mergedSpecs.ram || '',
                        memoria: mergedSpecs.storage || '',
                        imei1: unit?.imei_1 || item.serialized_unit?.imei1 || mergedSpecs.imei1 || '',
                        imei2: unit?.imei_2 || item.serialized_unit?.imei2 || mergedSpecs.imei2 || '',
                        serial: unit?.serial || item.serialized_unit?.serial || mergedSpecs.serial || '',
                        dias_garantia: String(days),
                        tipo_garantia: 'Garantia Legal',
                        declaracao_recebimento: declaracao,
                    };
                    const filtered = applyWarrantyDisplayFlags(tagData as any, settings);
                    const { copy1, copy2 } = renderWarrantyBothCopies(settings.warranty_template, filtered);
                    sections.push(`<div class="warranty-copy">${copy1}</div>`);
                    sections.push(`<div class="warranty-copy">${copy2}</div>`);
                }
            }

            const printWindow = window.open('', '_blank');
            if (!printWindow) { toast.error('Permita popups para imprimir'); return; }
            printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Termos de Garantia (${sections.length / 2} aparelho(s) × 2 vias)</title><style>body{font-family:Arial,sans-serif;padding:20px;line-height:1.6}.warranty-copy{page-break-after:always;margin-bottom:40px}.warranty-copy:last-child{page-break-after:auto}</style></head><body>${sections.join('')}</body></html>`);
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
                    ? getCoinsEarnedForReference(customerId, sale.id).catch(() => 0)
                    : Promise.resolve(0),
            ]);
            if (!settings) { toast.error('Configurações da empresa não encontradas'); return; }
            const benefits: PrintReceiptBenefits = {
                coinBalance,
                coinsEarnedThisSale: coinsThisSale,
                benefitStatuses,
            };
            printSaleReceipt(sale, settings, productSpecs, benefits, realProfit);
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

    const formatCurrency = formatCurrencyCents;
    const hasDetailedPaymentMethods = Array.isArray(sale.payment_methods)
        && sale.payment_methods.some((payment: any) => Boolean(
            payment?.installments ||
            payment?.fee_amount ||
            payment?.fee_cents ||
            payment?.operator_fee_amount ||
            payment?.operator_fee_cents ||
            payment?.fee_percentage ||
            payment?.operator_fee_percentage ||
            payment?.total_with_fee ||
            payment?.total_with_fee_cents ||
            payment?.pix_payment_id ||
            payment?.mercado_pago_payment_id ||
            payment?.due_date
        ));
    const cardPaymentCount = (sale.payment_methods || []).filter((payment: any) => (
        payment?.method === 'credit' || payment?.method === 'debit'
    )).length;

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
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-medium">Nome</p>
                                <p className="text-sm font-medium text-slate-800">{sale.customer?.name || 'Cliente Avulso'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-medium">CPF/CNPJ</p>
                                <p className="text-sm text-slate-600">{sale.customer?.cpf_cnpj || 'Não informado'}</p>
                            </div>
                            <div className="flex items-end sm:justify-end">
                                {sale.customer_id ? (
                                    <a
                                        href={`/admin/customers/${encodeURIComponent(sale.customer_id)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline underline-offset-2"
                                        title="Abrir cadastro do cliente"
                                    >
                                        Cadastro do cliente
                                        <ExternalLink size={14} />
                                    </a>
                                ) : (
                                    <span className="text-xs text-slate-400">Sem cadastro vinculado</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Admin Internal Notes */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200">
                        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                            <FileText size={16} className="text-slate-400" />
                            Observações Internas (Restrito)
                        </h3>
                        <div className="space-y-3">
                            <textarea
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                placeholder="Adicione observações internas sobre esta venda..."
                                className="w-full min-h-[80px] p-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                            />
                            <div className="flex justify-end">
                                <button
                                    onClick={handleSaveNotes}
                                    disabled={isSavingNotes || adminNotes === (sale.internal_notes || '')}
                                    className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSavingNotes ? <RefreshCw size={12} className="animate-spin" /> : null}
                                    Salvar Observações
                                </button>
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
                            {sale.items.map((item, index) => {
                                const itemView = buildSaleItemPresentation(item, productSpecs, realProfit);
                                return (
                                    <div key={index} className="grid grid-cols-[1fr_auto] gap-4 py-3 border-b border-slate-100 last:border-0 last:pb-0">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                {item.product_id ? (
                                                    <a
                                                        href={`/produto/${encodeURIComponent(item.product_id)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm font-medium text-slate-800 hover:text-blue-700 hover:underline underline-offset-2"
                                                        title="Abrir pagina do produto"
                                                    >
                                                        {item.product_name}
                                                    </a>
                                                ) : (
                                                    <p className="text-sm font-medium text-slate-800">{item.product_name}</p>
                                                )}
                                                {item.is_gift && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-pink-100 text-pink-700 rounded">
                                                        BRINDE
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {itemView.identifierLine} • Qtd: {item.quantity}
                                                {item.discount > 0 ? ` • Desc: ${formatCurrency(item.discount)}/un` : ''}
                                            </p>
                                            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-500">
                                                <span>Custo un.: <strong className="text-slate-700">{formatCurrency(itemView.unitCost)}</strong></span>
                                                <span>Custo item: <strong className="text-slate-700">{formatCurrency(itemView.itemCost)}</strong></span>
                                                <span>Lucro item: <strong className={itemView.itemProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}>{formatCurrency(itemView.itemProfit)}</strong></span>
                                            </div>
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
                                );
                            })}
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

                                <div className="flex justify-between text-slate-600">
                                    <span>Preço de Custo</span>
                                    <span>{formatCurrency(getSaleCostTotal(sale, realProfit))}</span>
                                </div>
                                {realProfit?.payment_operator_fee_cents ? (
                                    <div className="flex justify-between text-slate-600">
                                        <span>Custo da Máquina</span>
                                        <span>{formatCurrency(realProfit.payment_operator_fee_cents)}</span>
                                    </div>
                                ) : null}
                                {(realProfit?.delivery_payout_cents || sale.delivery_total) ? (
                                    <div className="flex justify-between text-slate-600">
                                        <span>Custo da Entrega</span>
                                        <span>{formatCurrency(realProfit?.delivery_payout_cents || sale.delivery_total || 0)}</span>
                                    </div>
                                ) : null}

                                <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between font-bold text-lg text-slate-800">
                                    <span>Total Pago</span>
                                    <span>{formatCurrency(getSaleCollectedTotal(sale, realProfit))}</span>
                                </div>

                                <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between text-sm font-medium">
                                    <span className="text-emerald-600">Lucro Real</span>
                                    <span className="text-emerald-700">
                                        {isLoadingProfit
                                            ? <span className="text-slate-400 text-xs">Calculando...</span>
                                            : formatCurrency(getSaleRealProfit(sale, realProfit))
                                        }
                                    </span>
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
                                {sale.payment_methods.map((payment, index) => {
                                    const paymentView = buildPaymentPresentation(payment);
                                    const recoveredOperatorFee = (
                                        paymentView.operatorFeeAmount <= 0
                                        && cardPaymentCount === 1
                                        && (payment.method === 'credit' || payment.method === 'debit')
                                        && realProfit?.payment_operator_fee_cents
                                    ) ? realProfit.payment_operator_fee_cents : 0;
                                    return (
                                        <div key={index} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {getPaymentIcon(payment.method)}
                                                    <p className="text-sm font-medium text-slate-800">
                                                        {paymentView.labelWithInstallments}
                                                    </p>
                                                </div>
                                            <p className="text-sm font-bold text-slate-800">
                                                {formatCurrency(paymentView.totalWithFee)}
                                            </p>
                                        </div>
                                            <div className="text-xs text-slate-500 mt-1 ml-7 space-y-0.5">
                                                <p>Valor base: {formatCurrency(paymentView.amount)}</p>
                                                {paymentView.totalWithFee !== paymentView.amount && (
                                                    <p>Total cobrado: {formatCurrency(paymentView.totalWithFee)}</p>
                                                )}
                                                {paymentView.details.map((detail, detailIndex) => (
                                                    <p key={detailIndex}>{detail}</p>
                                                ))}
                                                {recoveredOperatorFee > 0 && (
                                                    <p>Custo da maquina calculado: {formatCurrency(recoveredOperatorFee)}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {!hasDetailedPaymentMethods && (
                                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                    Detalhes do pagamento nao registrados nesta venda. O sistema encontrou apenas a forma resumida salva no historico antigo.
                                </p>
                            )}
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
                                <span className="text-sm">Termo Garantia</span>
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
