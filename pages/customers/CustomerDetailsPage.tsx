import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Eye, Trash2, User, Mail, Phone, MapPin, FileText, Calendar, CheckCircle, XCircle, Printer, ShoppingBag, RefreshCw, Receipt, DollarSign, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { customerService } from '../../services/customers';
import { Customer } from '../../types/customer';
import CustomerPrintableView from '../../components/customers/CustomerPrintableView';
import { benefitService, BenefitStatus } from '../../services/benefitService';
import { getSales } from '../../services/saleService';
import { SaleWithItems } from '../../types/sale';
import { useVpsAuth } from '../../contexts/VpsAuthContext';
import { companySettingsService } from '../../services/companySettingsService';
import { replaceWarrantyTags, applyWarrantyDisplayFlags, renderWarrantyBothCopies, getWarrantyDeclaration, formatWarrantyDate, formatWarrantyPhone, formatWarrantyCpfCnpj } from '../../utils/warrantyTagReplacement';
import { printSaleReceipt, PrintReceiptBenefits } from '../../utils/printSaleReceipt';
import { getCoinBalance, getCoinsEarnedForReference } from '../../services/cashbackService';
import { generateLegacySalePdf } from '../../utils/legacySalePdfGenerator';
import { vpsApiService } from '../../services/vpsApiService';
import { warrantyTemplateService } from '../../services/warrantyTemplates';
import { getCustomerFinancialSummary, type CustomerFinancialSummary } from '../../services/customerFinancialSummaryService';
import { DeliveryWorkerTab } from '../../components/customer/profile/DeliveryWorkerTab';

/**
 * Customer Details Page
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Database-First Architecture
 * - Read-only view with actions
 * - < 500 lines
 */
export default function CustomerDetailsPage() {
    const navigate = useNavigate();
    const { id } = useParams();

    // State
    const { user } = useVpsAuth();
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [benefits, setBenefits] = useState<BenefitStatus[]>([]);
    const [salesHistory, setSalesHistory] = useState<SaleWithItems[]>([]);
    const [financialSummary, setFinancialSummary] = useState<CustomerFinancialSummary | null>(null);
    const [financialSummaryLoading, setFinancialSummaryLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [printingSaleId, setPrintingSaleId] = useState<string | null>(null);
    const [printingReceiptId, setPrintingReceiptId] = useState<string | null>(null);
    const [printingComprovanteId, setPrintingComprovanteId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'compras' | 'beneficios' | 'entregas'>('info');
    // Map: product_id -> specs (for IMEI display in purchase history)
    const [saleProductSpecs, setSaleProductSpecs] = useState<Record<string, Record<string, string>>>();

    const handlePrintReceiptForSale = async (sale: SaleWithItems) => {
        setPrintingReceiptId(sale.id);
        try {
            const customerId = customer?.id;
            const [settings, coinBalance, coinsThisSale] = await Promise.all([
                companySettingsService.get(),
                customerId ? getCoinBalance(customerId).catch(() => null) : Promise.resolve(null),
                customerId
                    ? getCoinsEarnedForReference(customerId, sale.id).catch(() => 0)
                    : Promise.resolve(0),
            ]);
            if (!settings) { toast.error('Configurações não encontradas'); return; }
            const benefitsData: PrintReceiptBenefits = {
                coinBalance,
                coinsEarnedThisSale: coinsThisSale,
                benefitStatuses: benefits,
            };
            printSaleReceipt(sale, settings, saleProductSpecs, benefitsData);
        } catch (e) {
            console.error(e); toast.error('Erro ao gerar o recibo');
        } finally {
            setPrintingReceiptId(null);
        }
    };

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
            const saleForPdf = {
                ...sale,
                id: sale.id,
                sale_date:    sale.created_at,
                total_amount: (sale as any).total_amount ?? (sale as any).total ?? 0,
                payment_method: (sale as any).payment_method || '',
            };
            const pdfBlob = await generateLegacySalePdf({
                sale:         saleForPdf as any,
                customerName: customer?.name || '',
                customerCpf:  customer?.cpf_cnpj || '',
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

    const handleReprintWarrantyForSale = async (sale: SaleWithItems) => {
        if (!sale.items.length) return;
        setPrintingSaleId(sale.id);
        try {
            const settings = await companySettingsService.get();
            if (!settings?.warranty_template) { toast.error('Template de garantia não configurado'); return; }

            const { warrantyDocumentService } = await import('../../services/warrantyDocumentService');
            const sections: string[] = [];

            // 1) Tenta usar docs já salvos
            const savedDocs = await warrantyDocumentService.listBySaleId(sale.id);
            if (savedDocs.length > 0) {
                for (const doc of savedDocs) {
                    const copy1 = doc.warranty_content;
                    const copy2 = doc.warranty_content.replace(/Assinatura do Cliente/gi, 'Assinatura da Empresa');
                    sections.push(`<div class="warranty-copy">${copy1}</div>`);
                    sections.push(`<div class="warranty-copy">${copy2}</div>`);
                }
            } else {
                // 2) Fallback: regenera (cobre vendas migradas com IMEI no SKU e
                //    vendas novas onde usuário não clicou Salvar Termo).
                const serializedItems = sale.items.filter((i: any) => i.serialized_unit_id);
                const isLegacy = serializedItems.length === 0;

                const { vpsApiService } = await import('../../services/vpsApiService');
                const { brandService } = await import('../../services/brands');
                const { categoryService } = await import('../../services/categories');
                const units = isLegacy ? [] : (await vpsApiService.getUnitsBySale(sale.id) || []);
                const unitById = new Map<string, any>();
                units.forEach((u: any) => unitById.set(u.id, u));
                const brands = await brandService.list();
                const brandsByName = new Map<string, { warranty_days?: number }>();
                brands.forEach(b => brandsByName.set(b.name.toLowerCase(), b));

                const cust = sale.customer;
                const declaracao = getWarrantyDeclaration(
                    sale.delivery_type === 'delivery' || sale.delivery_type === 'store_delivery' || sale.delivery_type === 'hybrid_delivery'
                        ? 'delivery' : 'store_pickup'
                );

                const itemsToRender = isLegacy ? sale.items.slice(0, 1) : serializedItems;

                for (const item of itemsToRender) {
                    let specs: Record<string, any> = (item as any).product_specs || {};
                    let brand = (item as any).product_brand || '';
                    let model = (item as any).product_model || '';
                    let categoryId: string | null | undefined = null;
                    let warrantyType: string | undefined;
                    let warrantyTemplateId: string | undefined;

                    if (item.product_id) {
                        const prod = await vpsApiService.getProductById(item.product_id);
                        if (prod) {
                            specs = prod.specs || specs;
                            brand = prod.brand || brand;
                            model = prod.model || prod.name || model;
                            categoryId = prod.category_id;
                            warrantyType = prod.warranty_type;
                            warrantyTemplateId = prod.warranty_template_id;
                        }
                    }

                    const unit = unitById.get((item as any).serialized_unit_id) || {};
                    let imei1 = unit.imei_1 || specs.imei1 || '';
                    let imei2 = unit.imei_2 || specs.imei2 || '';
                    if (!imei1 && item.product_sku) {
                        const parts = item.product_sku.split('/').map((s: string) => s.trim());
                        imei1 = parts[0] || '';
                        imei2 = parts[1] || '';
                    }
                    if (!model) model = item.product_name;

                    let days = 90;
                    if (warrantyType === 'custom' && warrantyTemplateId) {
                        const template = await warrantyTemplateService.getById(warrantyTemplateId);
                        if (template?.duration_days) days = template.duration_days;
                    } else {
                        const b = brandsByName.get(brand.toLowerCase());
                        if (b?.warranty_days) days = b.warranty_days;
                        else if (categoryId) {
                            const cat = await categoryService.getById(categoryId);
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
                        nome_cliente: cust?.name || '',
                        cpf_cliente: formatWarrantyCpfCnpj(cust?.cpf_cnpj || ''),
                        telefone_cliente: '',
                        email_cliente: '',
                        numero_venda: sale.id.slice(0, 8).toUpperCase(),
                        numero_documento: fallbackDocId.slice(0, 8).toUpperCase(),
                        data_compra: formatWarrantyDate(sale.created_at),
                        produto: item.product_name,
                        marca: brand, modelo: model,
                        cor: specs.color || '', ram: specs.ram || '',
                        memoria: specs.storage || '',
                        imei1, imei2,
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

            const pw = window.open('', '_blank');
            if (!pw) { toast.error('Permita popups para imprimir'); return; }
            pw.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Termos de Garantia</title><style>body{font-family:Arial,sans-serif;padding:20px;line-height:1.6}.warranty-copy{page-break-after:always;margin-bottom:40px}.warranty-copy:last-child{page-break-after:auto}</style></head><body>${sections.join('')}</body></html>`);
            pw.document.close(); pw.print();
        } catch (e) {
            console.error(e); toast.error('Erro ao gerar o termo');
        } finally {
            setPrintingSaleId(null);
        }
    };

    // Load customer
    useEffect(() => {
        if (id) {
            loadCustomer(id);
            loadBenefits(id);
            loadSalesHistory(id);
            loadFinancialSummary(id);
        }
    }, [id]);

    const loadBenefits = async (customerId: string) => {
        try {
            const data = await benefitService.getCustomerBenefitsStatus(customerId);
            setBenefits(data);
        } catch (err) {
            console.error('Error loading benefits:', err);
        }
    };

    const loadSalesHistory = async (customerId: string) => {
        try {
            const data = await getSales({ customer_id: customerId });
            setSalesHistory(data);

            const map: Record<string, Record<string, string>> = {};

            // Specs gerais por product_id (ram, storage, color)
            const allProductIds = [...new Set(data.flatMap(s => s.items.map(i => (i as any).product_id)).filter(Boolean))];
            if (allProductIds.length) {
                const prods = await vpsApiService.getProductsByIds(allProductIds);
                (prods || []).forEach((p: any) => { map[p.id] = p.specs || {}; });
            }

            // IMEIs por sale_item.id — busca units VPS para cada venda com items serializados
            for (const sale of data) {
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
            setSaleProductSpecs(map);
        } catch (err) {
            console.error('Error loading sales history:', err);
        }
    };

    const loadFinancialSummary = async (customerId: string) => {
        try {
            setFinancialSummaryLoading(true);
            const summary = await getCustomerFinancialSummary(customerId);
            setFinancialSummary(summary);
        } catch (err) {
            console.error('Error loading customer financial summary:', err);
            setFinancialSummary(null);
        } finally {
            setFinancialSummaryLoading(false);
        }
    };

    const handleRedeem = async (benefitId: string) => {
        if (!user) return;
        try {
            toast.loading('Registrando resgate...', { id: 'redeem' });
            await benefitService.redeemScreenProtector(benefitId, user.id);
            toast.success('Película resgatada com sucesso!', { id: 'redeem' });
            if (id) loadBenefits(id);
        } catch (err: any) {
            toast.error(err.message || 'Erro ao resgatar', { id: 'redeem' });
        }
    };

    const loadCustomer = async (customerId: string) => {
        try {
            setLoading(true);
            const data = await customerService.getById(customerId);
            setCustomer(data);
        } catch (err) {
            console.error('Error loading customer:', err);
            setError('Erro ao carregar cliente');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!id) return;

        try {
            await customerService.delete(id);
            toast.success('Cliente deletado com sucesso');
            navigate('/admin/customers');
        } catch (err) {
            console.error('Error deleting customer:', err);
            toast.error('Erro ao deletar cliente');
        }
    };

    // Print handler
    const handlePrint = () => {
        window.print();
    };

    // Format CPF/CNPJ
    const formatCpfCnpj = (value?: string) => {
        if (!value) return '-';
        if (value.length === 11) {
            return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        }
        return value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    };

    // Format phone
    const formatPhone = (value?: string) => {
        if (!value) return '-';
        return value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    };

    // Format date
    const formatDate = (value: string) => {
        return new Date(value).toLocaleDateString('pt-BR');
    };

    const formatCurrencyCents = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
    };

    // Loading state
    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-slate-600">Carregando...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error || !customer) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    {error || 'Cliente não encontrado'}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/admin/customers')}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{customer.name}</h1>
                        <p className="text-sm text-slate-600">
                            Cadastrado em {formatDate(customer.created_at)}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors no-print"
                    >
                        <Printer className="w-4 h-4" />
                        Imprimir Ficha
                    </button>
                    <Link
                        to={`/admin/customers/${customer.id}/preview`}
                        className="flex items-center gap-2 px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors no-print"
                    >
                        <Eye className="w-4 h-4" />
                        Ver como cliente
                    </Link>
                    <Link
                        to={`/admin/customers/${customer.id}/edit`}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors no-print"
                    >
                        <Edit className="w-4 h-4" />
                        Editar
                    </Link>
                    <button
                        onClick={() => setDeleteConfirm(true)}
                        className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors no-print"
                    >
                        <Trash2 className="w-4 h-4" />
                        Deletar
                    </button>
                </div>
            </div>

            {/* Status Badge */}
            <div className="mb-6">
                {customer.is_active ? (
                    <span className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        <CheckCircle className="w-4 h-4" />
                        Cliente Ativo
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-medium">
                        <XCircle className="w-4 h-4" />
                        Cliente Inativo
                    </span>
                )}
            </div>



            {/* Tabs Navigation */}
            <div className="flex border-b border-slate-200 mb-6 no-print">
                {[
                    { key: 'info', label: 'Informações', icon: <User className="w-4 h-4" /> },
                    { key: 'compras', label: `Compras (${salesHistory.length})`, icon: <ShoppingBag className="w-4 h-4" /> },
                    { key: 'beneficios', label: `Benefícios (${benefits.length})`, icon: <CheckCircle className="w-4 h-4" /> },
                    ...(customer.is_delivery_worker ? [{ key: 'entregas', label: 'Entregas', icon: <Truck className="w-4 h-4" /> }] : []),
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as any)}
                        className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                            }`}
                    >
                        {tab.icon}{tab.label}
                    </button>
                ))}
            </div>

            {/* Tab: Informações */}
            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm no-print">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                            <DollarSign className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-900">Resumo financeiro</h2>
                            <p className="text-xs text-slate-500">
                                {financialSummaryLoading
                                    ? 'Carregando saldos do cliente...'
                                    : `${financialSummary?.totalDebts || 0} registro(s) de crediario`}
                            </p>
                        </div>
                    </div>
                    <Link
                        to={`/admin/financial/crediario?customer_id=${encodeURIComponent(customer.id)}`}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                    >
                        <DollarSign className="h-4 w-4" />
                        Ir ao crediario
                    </Link>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase text-slate-500">Saldo em aberto</p>
                        <p className="mt-1 text-lg font-black text-slate-900">{formatCurrencyCents(financialSummary?.openBalanceCents || 0)}</p>
                    </div>
                    <div className="rounded-lg bg-red-50 p-3">
                        <p className="text-xs font-bold uppercase text-red-600">Vencido</p>
                        <p className="mt-1 text-lg font-black text-red-700">{formatCurrencyCents(financialSummary?.overdueBalanceCents || 0)}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-3">
                        <p className="text-xs font-bold uppercase text-emerald-700">Pago</p>
                        <p className="mt-1 text-lg font-black text-emerald-800">{formatCurrencyCents(financialSummary?.paidTotalCents || 0)}</p>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-3">
                        <p className="text-xs font-bold uppercase text-blue-700">Total gerado</p>
                        <p className="mt-1 text-lg font-black text-blue-800">{formatCurrencyCents(financialSummary?.totalDebtCents || 0)}</p>
                    </div>
                </div>
            </div>

            {activeTab === 'info' && (
                <div className="space-y-6">
                    {/* Basic Info */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <User className="w-5 h-5 text-slate-600" />
                            <h2 className="text-lg font-semibold text-slate-900">Informações Básicas</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">Nome / Razão Social</label>
                                <p className="text-slate-900">{customer.name}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">CPF / CNPJ</label>
                                <p className="text-slate-900">{formatCpfCnpj(customer.cpf_cnpj)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Mail className="w-5 h-5 text-slate-600" />
                            <h2 className="text-lg font-semibold text-slate-900">Contato</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">Email</label>
                                <p className="text-slate-900">{customer.email || '-'}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">Telefone</label>
                                <p className="text-slate-900">{formatPhone(customer.phone)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Address */}
                    {customer.address && Object.keys(customer.address).length > 0 && (
                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <MapPin className="w-5 h-5 text-slate-600" />
                                <h2 className="text-lg font-semibold text-slate-900">Endereço</h2>
                            </div>
                            <div className="space-y-2">
                                <p className="text-slate-900">{customer.address.street}, {customer.address.number}{customer.address.complement && ` - ${customer.address.complement}`}</p>
                                <p className="text-slate-900">{customer.address.neighborhood}</p>
                                <p className="text-slate-900">{customer.address.city} - {customer.address.state}</p>
                                <p className="text-slate-600 text-sm">CEP: {customer.address.zipCode}</p>
                            </div>
                        </div>
                    )}

                    {/* Custom Fields */}
                    {customer.custom_data && Object.keys(customer.custom_data).length > 0 && (
                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <FileText className="w-5 h-5 text-slate-600" />
                                <h2 className="text-lg font-semibold text-slate-900">Informações Adicionais</h2>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                {Object.entries(customer.custom_data).map(([key, value]) => (
                                    <div key={key}>
                                        <label className="block text-sm font-medium text-slate-500 mb-1 capitalize">{key.replace(/_/g, ' ')}</label>
                                        <p className="text-slate-900">{value || '-'}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Metadata */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Calendar className="w-5 h-5 text-slate-600" />
                            <h2 className="text-lg font-semibold text-slate-900">Informações do Sistema</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">Data de Cadastro</label>
                                <p className="text-slate-900">{formatDate(customer.created_at)}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">Última Atualização</label>
                                <p className="text-slate-900">{formatDate(customer.updated_at)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab: Compras */}
            {activeTab === 'compras' && (
                <div className="space-y-4">
                    {salesHistory.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                            <ShoppingBag className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                            Nenhuma compra registrada para este cliente.
                        </div>
                    ) : salesHistory.map((sale) => {
                        const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v / 100);
                        const payments: any[] = sale.payment_methods || [];
                        const paymentLabel = (m: string) => ({ money: 'Dinheiro', credit: 'Crédito', debit: 'Débito', pix: 'PIX' }[m] || m);
                        return (
                            <div key={sale.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                {/* Sale Header */}
                                <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                                            <ShoppingBag className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-slate-800">Pedido #{sale.id.slice(0, 8).toUpperCase()}</div>
                                            <div className="text-xs text-slate-500">{new Date(sale.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {sale.legacy_sale_id && (
                                            <button
                                                onClick={() => handleViewLegacyComprovante(sale)}
                                                disabled={printingComprovanteId === sale.id}
                                                title="Ver Comprovante de Venda (Importado)"
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 transition-colors disabled:opacity-50"
                                            >
                                                <FileText size={13} />
                                                {printingComprovanteId === sale.id ? 'Gerando...' : 'Ver Comprovante'}
                                            </button>
                                        )}
                                        {!sale.legacy_sale_id && (
                                            <button
                                                onClick={() => handlePrintReceiptForSale(sale)}
                                                disabled={printingReceiptId === sale.id}
                                                title="Imprimir Recibo"
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors disabled:opacity-50"
                                            >
                                                {printingReceiptId === sale.id ? <RefreshCw size={13} className="animate-spin" /> : <Receipt size={13} />}
                                                Recibo
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleReprintWarrantyForSale(sale)}
                                            disabled={printingSaleId === sale.id}
                                            title="Reimprimir Termo de Garantia"
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors disabled:opacity-50"
                                        >
                                            {printingSaleId === sale.id
                                                ? <RefreshCw size={13} className="animate-spin" />
                                                : <FileText size={13} />}
                                            Termo de Garantia
                                        </button>
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${sale.status === 'completed' ? 'bg-green-100 text-green-800' :
                                            sale.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                'bg-orange-100 text-orange-800'
                                            }`}>
                                            {sale.status === 'completed' ? 'Concluída' : sale.status === 'cancelled' ? 'Cancelada' : 'Estornada'}
                                        </span>
                                    </div>
                                </div>

                                <div className="p-5 space-y-5">
                                    {/* Items */}
                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Itens</h4>
                                        <div className="space-y-3">
                                            {sale.items.map((item, idx) => {
                                                // Lookup: por sale_item.id (IMEI da unit) → product_id (specs gerais) → item.product_specs (legacy)
                                                const unitSpecs = saleProductSpecs?.[(item as any).id] || {};
                                                const catalogSpecs = saleProductSpecs?.[(item as any).product_id] || {};
                                                const itemSpecs = (item as any).product_specs || {};
                                                const specs = { ...itemSpecs, ...catalogSpecs, ...unitSpecs };
                                                const idParts: string[] = [];
                                                if (specs.imei1) idParts.push(`IMEI 1: ${specs.imei1}`);
                                                if (specs.imei2) idParts.push(`IMEI 2: ${specs.imei2}`);
                                                if (specs.serial) idParts.push(`Serial: ${specs.serial}`);
                                                if (specs.color && !idParts.length) idParts.push(specs.color);
                                                const identifier = idParts.length > 0 ? idParts.join(' | ') : (item.product_sku ? `IMEI: ${item.product_sku}` : null);
                                                return (
                                                    <div key={idx} className="flex justify-between items-start py-2 border-b border-slate-100 last:border-0">
                                                        <div>
                                                            <div className="text-sm font-medium text-slate-800">
                                                                {item.quantity > 1 && <span className="mr-1.5 text-slate-500">{item.quantity}x</span>}
                                                                {item.product_name}
                                                                {item.is_gift && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 bg-pink-100 text-pink-700 rounded">BRINDE</span>}
                                                            </div>
                                                            {identifier && <div className="text-xs text-slate-400 mt-0.5">{identifier}</div>}
                                                            {item.discount > 0 && <div className="text-xs text-orange-600 mt-0.5">Desconto: {fmt(item.discount * item.quantity)}</div>}
                                                        </div>
                                                        <div className="text-sm font-bold text-slate-800 ml-4">{fmt(item.total)}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Financial + Payment */}
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
                                                        <span>Entrega</span>
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


            {/* Tab: Benefícios */}
            {activeTab === 'beneficios' && (
                <div>
                    {benefits.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                            <CheckCircle className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                            Nenhum benefício ativo para este cliente.
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {benefits.map(b => (
                                <div key={b.benefit.id} className="bg-white border border-blue-200 rounded-xl p-4">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-lg">1 Ano de Película Grátis</h3>
                                            <p className="text-sm text-slate-500">Adquirido em: {new Date(b.benefit.granted_at).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-black text-blue-600">{b.monthsRemaining}/12</div>
                                            <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Meses Restantes</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                        <div className="text-sm font-medium text-slate-700">Status do Mês Atual</div>
                                        {b.canRedeemThisMonth ? (
                                            <button
                                                onClick={() => handleRedeem(b.benefit.id)}
                                                className="px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm font-bold shadow-md hover:bg-blue-700 transition"
                                            >
                                                Autorizar Resgate Agora
                                            </button>
                                        ) : (
                                            <span className="text-sm font-bold text-slate-400">
                                                {b.redemptions.some(r => r.year_month === b.currentYearMonth)
                                                    ? 'Resgate do mês já utilizado'
                                                    : (b.monthsRemaining === 0 ? 'Expirado' : 'Não disponível')}
                                            </span>
                                        )}
                                    </div>
                                    {b.redemptions.length > 0 && (
                                        <div className="mt-4">
                                            <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Histórico de Uso</h4>
                                            <ul className="space-y-2">
                                                {b.redemptions.map(r => (
                                                    <li key={r.id} className="flex justify-between text-xs py-1.5 border-b border-slate-200/50 last:border-0 text-slate-600">
                                                        <span>Resgatado em {new Date(r.redeemed_at).toLocaleDateString('pt-BR')}</span>
                                                        <span>Por: {r.redeemed_by_user?.name || 'Admin'} ({r.year_month})</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'entregas' && customer.is_delivery_worker && (
                <DeliveryWorkerTab customer={customer} mode="admin" />
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">
                            Confirmar Exclusão
                        </h3>
                        <p className="text-slate-600 mb-6">
                            Tem certeza que deseja deletar <strong>{customer.name}</strong>?
                            Esta ação não pode ser desfeita.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteConfirm(false)}
                                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                                Deletar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Print View - Hidden, only shown when printing */}
            <CustomerPrintableView customer={customer} showAdminNotes={true} />
        </div>
    );
}
