import React, { useState, useEffect } from 'react';
import { ShoppingBag, X, Calendar, User, UserCheck, Package, DollarSign, CreditCard, Banknote, Truck, AlertCircle, RefreshCw, FileText, Receipt, ExternalLink, Copy, Download } from 'lucide-react';
import { printSaleReceipt, PrintReceiptBenefits } from '../../../utils/printSaleReceipt';
import { SaleWithItems } from '../../../types/sale';
import { cancelSale, refundSale, deleteSale, patchSale, updateSaleCostsAndProfit } from '../../../services/saleService';
import { toast } from 'sonner';
import { companySettingsService } from '../../../services/companySettingsService';
import { replaceWarrantyTags, applyWarrantyDisplayFlags, renderWarrantyBothCopies, getWarrantyDeclaration, formatWarrantyDate, formatWarrantyPhone, formatWarrantyCpfCnpj } from '../../../utils/warrantyTagReplacement';
import { getCoinBalance, getCoinsEarnedForReference } from '../../../services/cashbackService';
import { benefitService } from '../../../services/benefitService';
import { vpsApiService } from '../../../services/vpsApiService';
import { warrantyTemplateService } from '../../../services/warrantyTemplates';
import { teamService } from '../../../services/team';
import {
    adminCompleteDeliveryJob,
    createDeliveryJobFromSale,
    getCustomerDeliveryJobLogs,
    getCustomerDeliveryJobBySaleId,
    getDeliveryJob,
    type CustomerDeliveryJob,
    type CustomerDeliveryJobLog,
    type CustomerDeliveryProof,
} from '../../../services/customerDeliveryService';
import {
    buildPaymentPresentation,
    buildSaleItemPresentation,
    formatCurrencyCents,
    getSaleCollectedTotal,
    getSaleCostTotal,
    getSaleRealProfit,
    SaleProfitData
} from '../../../utils/salePresentation';
import { SignedWarrantyDocumentSection } from './SignedWarrantyDocumentSection';

interface SaleDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    sale: SaleWithItems | null;
    onStatusChange: () => void; // Triggered after cancel or refund to reload lists
}

function parseSaleFinalizationWarnings(logValue: string): string[] {
    if (!logValue.trim()) return [];
    try {
        const parsed = JSON.parse(logValue) as { finalization_warnings?: Array<{ message?: unknown }> };
        return (parsed.finalization_warnings || [])
            .map((warning) => String(warning?.message || '').trim())
            .filter(Boolean);
    } catch {
        return [];
    }
}

function buildCurrentSaleProfitData(updated: SaleWithItems): NonNullable<SaleProfitData> {
    return {
        sale_id: updated.id,
        total_cents: getSaleCollectedTotal(updated),
        cost_total_cents: updated.cost_total,
        profit_cents: updated.profit,
        items: updated.items.map((item: any) => ({
            sale_item_id: item.id,
            product_id: item.product_id,
            product_name: item.product_name,
            sku: item.product_sku,
            quantity: item.quantity,
            unit_price: item.unit_price,
            unit_cost: item.unit_cost,
            item_profit: Number(item.total || 0) - (Number(item.unit_cost || 0) * Number(item.quantity || 1)),
        })),
    };
}

export default function SaleDetailsModal({ isOpen, onClose, sale, onStatusChange }: SaleDetailsModalProps) {
    const [isCancelling, setIsCancelling] = useState(false);
    const [isRefunding, setIsRefunding] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmAction, setConfirmAction] = useState<'cancel' | 'refund' | 'delete' | null>(null);
    const [isPrintingWarranty, setIsPrintingWarranty] = useState(false);
    const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
    const [isPrintingAll, setIsPrintingAll] = useState(false);
    const [isUpdatingCosts, setIsUpdatingCosts] = useState(false);
    // Map keyed por product_id (specs gerais) e por sale_item.id (IMEI da unit serializada).
    const [productSpecs, setProductSpecs] = useState<Record<string, Record<string, string>>>({});

    const [adminNotes, setAdminNotes] = useState('');
    const [isSavingNotes, setIsSavingNotes] = useState(false);
    const [realProfit, setRealProfit] = useState<SaleProfitData>(null);
    const [isLoadingProfit, setIsLoadingProfit] = useState(false);
    const [deliveryJob, setDeliveryJob] = useState<CustomerDeliveryJob | null>(null);
    const [deliveryProofs, setDeliveryProofs] = useState<CustomerDeliveryProof[]>([]);
    const [deliveryLogs, setDeliveryLogs] = useState<CustomerDeliveryJobLog[]>([]);
    const [adminCompletionReason, setAdminCompletionReason] = useState('');
    const [deliveryPersonName, setDeliveryPersonName] = useState('');
    const [isLoadingDeliveryJob, setIsLoadingDeliveryJob] = useState(false);
    const [isGeneratingDeliveryJob, setIsGeneratingDeliveryJob] = useState(false);
    const [isAdminCompletingDelivery, setIsAdminCompletingDelivery] = useState(false);
    const saleNeedsReview = sale?.finalization_status === 'needs_review';
    const saleFinalizationLog = sale?.finalization_log || '';
    const saleFinalizationWarnings = parseSaleFinalizationWarnings(saleFinalizationLog);
    const deliveryType = sale?.delivery_type;
    const isDeliverySale = Boolean(deliveryType && !['store_pickup', 'pickup'].includes(deliveryType));
    const deliveryPublicUrl = deliveryJob?.token
        ? `${window.location.origin}/delivery/${deliveryJob.token}`
        : '';

    const getDeliveryStatusLabel = (job?: CustomerDeliveryJob | null) => {
        if (!job) return 'Sem pagina vinculada';
        if (job.completed_by_admin_at) return 'Baixa admin';
        if (job.delivery_status === 'delivered') return 'Entregue';
        if (job.delivery_status === 'in_route') return 'Em rota';
        if (job.delivery_status === 'cancelled') return 'Cancelada';
        return 'Pendente';
    };

    const getPaymentStatusLabel = (job?: CustomerDeliveryJob | null) => {
        if (!job) return 'Nao iniciado';
        if (job.payment_status === 'not_required') return 'Nao exige Pix';
        if (job.payment_status === 'approved') return 'Pix aprovado';
        if (job.payment_status === 'pending') return 'Pix pendente';
        if (job.payment_status === 'failed') return 'Pix falhou';
        if (job.payment_status === 'cancelled') return 'Pix cancelado';
        return job.payment_status;
    };

    const getDeliveryCompletionBlockers = (job?: CustomerDeliveryJob | null, proofs: CustomerDeliveryProof[] = [], options?: { adminOverride?: boolean }) => {
        if (options?.adminOverride) return [];
        if (!job) return ['Entrega sem pagina publica vinculada'];
        const blockers: string[] = [];
        const addressText = String(job.delivery_address_text || '').trim();
        const deliveryAmount = Number(job.delivery_amount || 0);
        if (!String(job.buyer_name || '').trim() || String(job.buyer_name || '').trim() === 'Cliente') blockers.push('Cliente da entrega pendente');
        if (!String(job.buyer_phone || '').trim()) blockers.push('Telefone do cliente pendente');
        if (!String(job.delivery_person_customer_id || '').trim()) blockers.push('Entregador pendente');
        if (!Number.isFinite(deliveryAmount) || deliveryAmount <= 0) blockers.push('Valor da entrega pendente');
        if (!addressText || addressText === 'Endereco de entrega nao informado') blockers.push('Endereco da entrega pendente');
        if (!String(job.delivery_route_url || '').trim()) blockers.push('Rota da entrega pendente');
        if (!options?.adminOverride && job.payment_status !== 'approved' && job.payment_status !== 'not_required') blockers.push('Pix da entrega ainda nao aprovado');
        if (!options?.adminOverride && !proofs.some((proof) => String(proof.image_url || '').trim())) blockers.push('Foto de comprovacao obrigatoria');
        return blockers;
    };

    const deliveryCompletionBlockers = getDeliveryCompletionBlockers(deliveryJob, deliveryProofs, { adminOverride: true });
    const canAdminCompleteDelivery = Boolean(adminCompletionReason.trim());

    const handleCopyFinalizationLog = async () => {
        if (!saleFinalizationLog) return;
        try {
            await navigator.clipboard.writeText(saleFinalizationLog);
            toast.success('Log da venda copiado');
        } catch (error) {
            console.error('Erro ao copiar log da venda:', error);
            toast.error('Nao foi possivel copiar o log');
        }
    };

    const handleDownloadFinalizationLog = () => {
        if (!saleFinalizationLog) return;
        const blob = new Blob([saleFinalizationLog], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `venda-pdv-log-${sale?.id || 'sem-id'}.txt`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const loadDeliveryJob = async () => {
        if (!sale?.id || !isDeliverySale) {
            setDeliveryJob(null);
            setDeliveryProofs([]);
            setDeliveryLogs([]);
            return;
        }
        setIsLoadingDeliveryJob(true);
        try {
            const job = await getCustomerDeliveryJobBySaleId(sale.id);
            setDeliveryJob(job);
            if (job?.token) {
                const [details, logs] = await Promise.all([
                    getDeliveryJob(job.token),
                    getCustomerDeliveryJobLogs(job.token),
                ]);
                setDeliveryProofs(Array.isArray(details.proofs) ? details.proofs : details.proof ? [details.proof] : []);
                setDeliveryLogs(logs);
            } else {
                setDeliveryProofs([]);
                setDeliveryLogs([]);
            }
        } catch (error) {
            console.error('Erro ao carregar link da entrega:', error);
            setDeliveryJob(null);
            setDeliveryProofs([]);
            setDeliveryLogs([]);
        } finally {
            setIsLoadingDeliveryJob(false);
        }
    };

    const handleGenerateDeliveryJob = async () => {
        if (!sale?.id) return;
        setIsGeneratingDeliveryJob(true);
        try {
            const job = await createDeliveryJobFromSale(sale.id);
            setDeliveryJob(job);
            if (job?.token) {
                const details = await getDeliveryJob(job.token);
                setDeliveryProofs(Array.isArray(details.proofs) ? details.proofs : details.proof ? [details.proof] : []);
                setDeliveryLogs(await getCustomerDeliveryJobLogs(job.token));
                toast.success('Link da entrega gerado');
            } else {
                toast.error('Entrega sem dados suficientes para gerar link');
            }
        } catch (error) {
            console.error('Erro ao gerar link da entrega:', error);
            toast.error('Nao foi possivel gerar o link da entrega');
        } finally {
            setIsGeneratingDeliveryJob(false);
        }
    };

    const handleAdminCompleteDelivery = async () => {
        if (!deliveryJob?.token) return;
        const reason = adminCompletionReason.trim();
        if (!reason) return toast.error('Informe o motivo da baixa da entrega');
        setIsAdminCompletingDelivery(true);
        try {
            const updated = await adminCompleteDeliveryJob(deliveryJob.token, { admin_completion_reason: reason });
            setDeliveryJob(updated);
            setAdminCompletionReason('');
            setDeliveryLogs(await getCustomerDeliveryJobLogs(deliveryJob.token));
            toast.success('Entrega baixada pelo operador');
            onStatusChange();
        } catch (error) {
            console.error('Erro ao baixar entrega:', error);
            toast.error('Nao foi possivel baixar a entrega');
        } finally {
            setIsAdminCompletingDelivery(false);
        }
    };

    const handleCopyDeliveryLink = async () => {
        if (!deliveryPublicUrl) return;
        try {
            await navigator.clipboard.writeText(deliveryPublicUrl);
            toast.success('Link da entrega copiado');
        } catch (error) {
            console.error('Erro ao copiar link da entrega:', error);
            toast.error('Nao foi possivel copiar o link');
        }
    };

    useEffect(() => {
        if (sale) {
            setAdminNotes(sale.internal_notes || '');
        }
    }, [sale]);

    useEffect(() => {
        if (!isOpen) return;
        void loadDeliveryJob();
    }, [isOpen, sale?.id, isDeliverySale]);

    useEffect(() => {
        if (!isOpen || !sale?.id) return;
        let cancelled = false;
        setIsLoadingProfit(true);
        setRealProfit(null);
        updateSaleCostsAndProfit(sale.id)
            .then((updated) => {
                if (cancelled) return;
                setRealProfit(buildCurrentSaleProfitData(updated));
                onStatusChange();
            })
            .catch((error) => {
                if (cancelled) return;
                console.error('Erro ao atualizar custos atuais da venda:', error);
                toast.error('Nao foi possivel atualizar os custos atuais desta venda');
            })
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
                (data || []).forEach((p: any) => { map[p.id] = p.specs || {}; });
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

    useEffect(() => {
        if (!isOpen || !sale?.delivery_person_id) {
            setDeliveryPersonName('');
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const deliveryPerson = await teamService.getById(sale.delivery_person_id!);
                if (!cancelled) setDeliveryPersonName(deliveryPerson?.name || '');
            } catch (error) {
                console.warn('Erro ao carregar entregador da venda', error);
                if (!cancelled) setDeliveryPersonName('');
            }
        })();

        return () => { cancelled = true; };
    }, [isOpen, sale?.delivery_person_id]);

    const handleReprintWarranty = async () => {
        if (!sale || sale.items.length === 0) return;
        setIsPrintingWarranty(true);
        try {
            const settings = await companySettingsService.get();
            if (!settings?.warranty_template) {
                toast.error('Template de garantia não configurado');
                return;
            }

            const { warrantyDocumentService } = await import('../../../services/warrantyDocumentService');
            const sections: string[] = [];

            // 1) Tenta usar docs já salvos (numero_documento estável). Inclui o que
            //    foi assinado no momento da venda.
            const savedDocs = await warrantyDocumentService.listBySaleId(sale.id);
            if (savedDocs.length > 0) {
                for (const doc of savedDocs) {
                    const copy1 = doc.warranty_content;
                    const copy2 = doc.warranty_content.replace(/Assinatura do Cliente/gi, 'Assinatura da Empresa');
                    sections.push(`<div class="warranty-copy">${copy1}</div>`);
                    sections.push(`<div class="warranty-copy">${copy2}</div>`);
                }
            } else {
                // 2) Fallback: nenhum doc salvo (vendas migradas ou usuário fechou
                //    modal sem salvar). Regenera dos sale_items serializados.
                const serializedItems = sale.items.filter((i: any) => i.serialized_unit_id);
                if (serializedItems.length === 0) {
                    toast.error('Nenhum item serializado nesta venda — sem termo a imprimir');
                    return;
                }

                const units = await vpsApiService.getUnitsBySale(sale.id);
                const unitById = new Map<string, any>();
                (units || []).forEach((u: any) => unitById.set(u.id, u));

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

                for (const item of serializedItems) {
                    const product = item.product_id ? await productService.getById(item.product_id) : null;
                    const productSpecs = product?.specs || {};
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

                    const unit = unitById.get((item as any).serialized_unit_id) || {};
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
            printSaleReceipt({ ...(sale as any), delivery_person_name: deliveryPersonName } as SaleWithItems, settings, productSpecs, benefits);
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

    const handleUpdateCostsAndProfit = async () => {
        if (!sale) return;
        setIsUpdatingCosts(true);
        try {
            const updated = await updateSaleCostsAndProfit(sale.id);
            setRealProfit(buildCurrentSaleProfitData(updated));
            toast.success('Custos recalculados com os valores atuais dos produtos');
            onStatusChange();
        } catch (error: any) {
            console.error('Erro ao atualizar custos/lucro:', error);
            toast.error(error?.message || 'Nao foi possivel atualizar custos e lucro');
        } finally {
            setIsUpdatingCosts(false);
        }
    };

    if (!isOpen || !sale) return null;

    const formatCurrency = (value: number) => {
        return formatCurrencyCents(value);
    };
    const collectedTotal = getSaleCollectedTotal(sale, realProfit);
    const costTotal = getSaleCostTotal(sale, realProfit);
    const realProfitTotal = getSaleRealProfit(sale, realProfit);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const deliveryTypeLabel = (type?: string) => {
        switch (type) {
            case 'pickup':
            case 'store_pickup':
            case undefined:
                return 'Retirada na Loja';
            case 'delivery':
            case 'store_delivery':
                return 'Entrega pela Loja';
            case 'hybrid':
            case 'hybrid_delivery':
                return 'Entrega Hibrida';
            default:
                return type || 'Retirada na Loja';
        }
    };

    const deliveryDetails = () => {
        const type = sale.delivery_type || 'store_pickup';
        const isPickup = type === 'pickup' || type === 'store_pickup';
        return [
            { label: 'Tipo', value: deliveryTypeLabel(type) },
            { label: 'Entregador', value: isPickup ? 'Retirada na Loja' : (deliveryPersonName || 'Nao informado') },
            { label: 'Cobrado do Cliente', value: formatCurrency(sale.delivery_cost_customer || 0) },
            { label: 'Custo da Loja', value: formatCurrency(sale.delivery_cost_store || 0) },
            { label: 'Total do Entregador', value: formatCurrency(sale.delivery_total || 0) },
        ];
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
                    <div className={`rounded-xl border p-4 ${
                        saleNeedsReview
                            ? 'border-amber-200 bg-amber-50 text-amber-900'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    }`}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-bold">
                                    {saleNeedsReview ? 'Venda registrada com erros para corrigir' : 'Venda registrada com sucesso'}
                                </p>
                                {sale.finalization_error_summary && (
                                    <p className="mt-1 text-xs whitespace-pre-line">{sale.finalization_error_summary}</p>
                                )}
                                {saleFinalizationWarnings.length > 0 && (
                                    <div className="mt-2 space-y-1 text-xs font-medium">
                                        {saleFinalizationWarnings.map((warning, index) => (
                                            <p key={`${warning}-${index}`}>{warning}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {saleFinalizationLog && (
                                <div className="flex shrink-0 gap-2">
                                    <button
                                        type="button"
                                        onClick={handleCopyFinalizationLog}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/70 bg-white/70 px-3 py-2 text-xs font-semibold hover:bg-white"
                                    >
                                        <Copy size={14} />
                                        Copiar log
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDownloadFinalizationLog}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/70 bg-white/70 px-3 py-2 text-xs font-semibold hover:bg-white"
                                    >
                                        <Download size={14} />
                                        Baixar TXT
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

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
                                const productAdminHref = item.product_id ? `/admin/products/${encodeURIComponent(item.product_id)}` : '';
                                return (
                                    <div key={index} className="flex justify-between items-start py-3 border-b border-slate-100 last:border-0 last:pb-0">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                {productAdminHref ? (
                                                    <a
                                                        href={productAdminHref}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm font-medium text-slate-800 hover:text-blue-700 hover:underline underline-offset-2"
                                                        title="Abrir produto no admin"
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
                                            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-500">
                                                <span>Custo un.: <strong className="text-slate-700">{formatCurrency(itemView.unitCost)}</strong></span>
                                                <span>Custo item: <strong className="text-slate-700">{formatCurrency(itemView.itemCost)}</strong></span>
                                                <span>Lucro item: <strong className={itemView.itemProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}>{formatCurrency(itemView.itemProfit)}</strong></span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {item.discount > 0 && (
                                                <p className="text-xs text-slate-400 line-through">
                                                    {formatCurrency(itemView.itemSubtotal)}
                                                </p>
                                            )}
                                            <p className="text-sm font-bold text-slate-800">
                                                {formatCurrency(itemView.itemTotal)}
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
                                    <span>{formatCurrency(sale.subtotal || sale.items.reduce((sum, item) => {
                                        const itemView = buildSaleItemPresentation(item, productSpecs, realProfit);
                                        return sum + itemView.itemSubtotal;
                                    }, 0))}</span>
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
                                    <span>{formatCurrency(collectedTotal)}</span>
                                </div>

                                <div className="flex justify-between text-slate-600">
                                    <span>Custo Total</span>
                                    <span>{isLoadingProfit ? 'Atualizando...' : formatCurrency(costTotal)}</span>
                                </div>
                                <p className="text-xs leading-5 text-amber-700">
                                    Os custos salvos desta venda serao substituidos pelos custos atuais dos produtos ao abrir ou atualizar.
                                </p>

                                <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between text-sm font-medium">
                                    <span className="text-emerald-600">Lucro Real</span>
                                    <span className={realProfitTotal >= 0 ? 'text-emerald-700' : 'text-red-700'}>{formatCurrency(realProfitTotal)}</span>
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
                                    return (
                                        <div key={index} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-3">
                                                    {getPaymentIcon(payment.method)}
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-800">
                                                            {paymentView.labelWithInstallments}
                                                        </p>
                                                        <div className="mt-1 space-y-0.5">
                                                            {paymentView.details.map((detail) => (
                                                                <p key={detail} className="text-xs text-slate-500">
                                                                    {detail}
                                                                </p>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                                <p className="text-sm font-bold text-slate-800 whitespace-nowrap">
                                                    {formatCurrency(paymentView.totalWithFee)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    </div>

                    {/* Delivery Section */}
                        <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
                            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                                    <Truck size={16} />
                                    Dados de Logística
                                </h3>
                                {isDeliverySale && (
                                <div className="flex flex-wrap gap-2">
                                    {deliveryPublicUrl ? (
                                        <>
                                            <a
                                                href={deliveryPublicUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                                            >
                                                <ExternalLink size={14} />
                                                Abrir pagina do entregador
                                            </a>
                                            <button
                                                type="button"
                                                onClick={handleCopyDeliveryLink}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                                            >
                                                <Copy size={14} />
                                                Copiar link
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleGenerateDeliveryJob}
                                            disabled={isLoadingDeliveryJob || isGeneratingDeliveryJob}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                                        >
                                            <RefreshCw size={14} className={isLoadingDeliveryJob || isGeneratingDeliveryJob ? 'animate-spin' : ''} />
                                            Gerar link
                                        </button>
                                    )}
                                </div>
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <p className="text-xs text-blue-600 uppercase font-medium">Tipo</p>
                                    <p className="font-medium text-slate-700 mt-1">
                                        {deliveryTypeLabel(sale.delivery_type)}
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
                            {isDeliverySale && (deliveryPublicUrl ? (
                                <div className="mt-4 rounded-lg border border-blue-100 bg-white p-3">
                                    <p className="text-xs font-semibold uppercase text-blue-600">Pagina publica do entregador</p>
                                    <p className="mt-1 break-all text-sm font-medium text-slate-700">{deliveryPublicUrl}</p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Envie esse link para o entregador seguir a rota, gerar/consultar Pix, enviar foto e finalizar a entrega.
                                    </p>
                                </div>
                            ) : (
                                <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                    {isLoadingDeliveryJob
                                        ? 'Procurando pagina publica da entrega...'
                                        : 'Nenhuma pagina publica de entrega vinculada a esta venda ainda.'}
                                </p>
                            ))}
                            {deliveryJob && (
                                <div className="mt-4 grid gap-3 rounded-lg border border-blue-100 bg-white p-3">
                                    <div className="grid gap-3 sm:grid-cols-3">
                                        <div>
                                            <p className="text-xs font-semibold uppercase text-blue-600">Status da entrega</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-800">{getDeliveryStatusLabel(deliveryJob)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase text-blue-600">Status do Pix</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-800">{getPaymentStatusLabel(deliveryJob)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase text-blue-600">Fotos</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-800">{deliveryProofs.length}</p>
                                        </div>
                                    </div>
                                    {deliveryJob.delivery_route_url && (
                                        <a
                                            href={deliveryJob.delivery_route_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                                        >
                                            <ExternalLink size={14} />
                                            Abrir rota
                                        </a>
                                    )}
                                    {deliveryProofs.length > 0 && (
                                        <div>
                                            <p className="mb-2 text-xs font-semibold uppercase text-blue-600">Comprovantes enviados</p>
                                            <div className="grid gap-2 sm:grid-cols-3">
                                                {deliveryProofs.map((proof) => (
                                                    <a key={proof.id} href={proof.image_url} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                                                        <img src={proof.image_url} alt="Foto da entrega" className="h-24 w-full object-cover" />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {deliveryLogs.length > 0 && (
                                        <div>
                                            <p className="mb-2 text-xs font-semibold uppercase text-blue-600">Logs da entrega</p>
                                            <div className="max-h-28 overflow-auto rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                                                {deliveryLogs.map((log) => (
                                                    <p key={log.id}>{new Date(log.created_at).toLocaleString('pt-BR')} - {log.event_type}: {log.message}</p>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {deliveryJob.delivery_status !== 'delivered' && (
                                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                                            <p className="text-xs font-semibold uppercase text-amber-700">Baixa administrativa</p>
                                            {deliveryCompletionBlockers.length > 0 && (
                                                <div className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-amber-800">
                                                    <p className="font-semibold">Pendencias para concluir</p>
                                                    <ul className="mt-1 list-disc space-y-1 pl-4">
                                                        {deliveryCompletionBlockers.map((blocker) => (
                                                            <li key={blocker}>{blocker}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            <textarea
                                                className="mt-2 w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
                                                value={adminCompletionReason}
                                                onChange={(event) => setAdminCompletionReason(event.target.value)}
                                                placeholder="Motivo obrigatorio da baixa pelo operador"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAdminCompleteDelivery}
                                                disabled={isAdminCompletingDelivery || !canAdminCompleteDelivery}
                                                className="mt-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                                            >
                                                {isAdminCompletingDelivery ? 'Baixando...' : 'Baixar entrega'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                </div>

                {sale && (
                    <div className="px-6 pb-4">
                        <SignedWarrantyDocumentSection
                            saleId={sale.id}
                            saleCode={sale.id.slice(0, 8).toUpperCase()}
                        />
                    </div>
                )}

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
                            <button
                                onClick={handleUpdateCostsAndProfit}
                                disabled={isUpdatingCosts}
                                title="Recalcular usando os custos atuais dos produtos e unidades"
                                className="px-3 py-2 bg-emerald-50 text-emerald-700 font-medium rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50 flex items-center gap-2 border border-emerald-200"
                            >
                                <RefreshCw size={16} className={isUpdatingCosts ? 'animate-spin' : ''} />
                                <span className="text-sm">Atualizar Custos/Lucro</span>
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
