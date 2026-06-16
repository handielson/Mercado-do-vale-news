import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, Ticket, X as XIcon, Printer, FileText, User, CheckCircle2, RotateCcw, Copy, Download, AlertTriangle } from 'lucide-react';
import { Product } from '../../types/product';
import { SaleItem, PaymentMethod, SaleInput, DeliveryType } from '../../types/sale';
import { calculateSaleTotals, calculateTotalPaid } from '../../utils/saleCalculations';
import ProductSearchSection from '../../components/pdv/ProductSearchSection';
import CartItemsSection from '../../components/pdv/CartItemsSection';
import CustomerSection from '../../components/pdv/CustomerSection';
import PaymentSection from '../../components/pdv/PaymentSection';
import DeliverySection from '../../components/pdv/DeliverySection';
import ReceiptPreview from '../../components/pdv/ReceiptPreview';
import InstallmentCalculator from '../../components/pdv/InstallmentCalculator';
import { WarrantyTermModal } from '../../components/warranty/WarrantyTermModal';
import { printSaleReceipt } from '../../utils/printSaleReceipt';
import { printPixQr } from '../../utils/printPixQr';
import { createSale } from '../../services/saleService';
import { pdvDisplayService } from '../../services/pdvDisplayService';
import { buildPdvPixPrintData } from '../../services/pdvDisplayService';
import { warrantyDocumentService } from '../../services/warrantyDocumentService';
import { companySettingsService } from '../../services/companySettingsService';
import { replaceWarrantyTags, applyWarrantyDisplayFlags, getWarrantyDeclaration, formatWarrantyDate, formatWarrantyPhone, formatWarrantyCpfCnpj } from '../../utils/warrantyTagReplacement';
import { WarrantyTagData, DeliveryTypeWarranty } from '../../types/warrantyDocument';
import { WarrantyOption } from '../../types/companySettings';
import { toast } from 'sonner';
import { validateCoupon, applyCoupon, type Coupon } from '../../services/couponService';
import { earnCoinsForPurchase } from '../../services/cashbackService';
import { telegramBotService } from '../../services/telegramBot';
import { brandService } from '../../services/brands';
import { categoryService } from '../../services/categories';
import { customerService } from '../../services/customers';
import { productService } from '../../services/products';
import { warrantyTemplateService } from '../../services/warrantyTemplates';
import { teamService } from '../../services/team';
import { getEffectiveCustomerPrice, normalizeCentValue } from '../../utils/promoPrice';
import { buildPdvProductName } from '../../utils/pdvProductDisplay';
import type { PdvDisplay, PdvPixPayment } from '../../types/pdvDisplay';
import {
    buildPdvSaleFinalizationLog,
    copyPdvSaleFinalizationLogText,
    downloadPdvSaleFinalizationLogText,
    serializePdvSaleFinalizationLog,
    updatePdvSaleFinalizationLog,
    type PdvSaleFinalizationLog
} from '../../utils/pdvSaleFinalizationLog';

type FinalizeStep = {
    id: string;
    label: string;
    status: 'idle' | 'saving' | 'done' | 'error';
    detail?: string;
    debug?: unknown;
};

function FinalizeProgress({
    steps,
    log,
    onCopyLog,
    onDownloadLog,
}: {
    steps: FinalizeStep[];
    log?: PdvSaleFinalizationLog | null;
    onCopyLog?: (log: PdvSaleFinalizationLog) => void;
    onDownloadLog?: (log: PdvSaleFinalizationLog) => void;
}) {
    if (steps.length === 0) return null;

    return (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-slate-800">Finalizacao da venda</div>
            {log && (
                <div className="mb-3 flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => onCopyLog?.(log)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        <Copy size={14} />
                        Copiar log
                    </button>
                    <button
                        type="button"
                        onClick={() => onDownloadLog?.(log)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        <Download size={14} />
                        Baixar TXT
                    </button>
                </div>
            )}
            <div className="space-y-2">
                {steps.map((step) => (
                    <div key={step.id} className="flex items-start justify-between gap-3 text-sm">
                        <div>
                            <div className="font-medium text-slate-700">{step.label}</div>
                            {step.detail && <div className="text-xs text-slate-500">{step.detail}</div>}
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                            {step.status}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function extractFinalizeDebug(error: unknown, saleInput?: SaleInput) {
    const debug = error && typeof error === 'object'
        ? (error as any).debug || (error as any).response?.debug || (error as any).response?.data?.debug || (error as any).data?.debug
        : null;

    return {
        message: error instanceof Error ? error.message : String(error || 'Erro desconhecido'),
        name: error instanceof Error ? error.name : typeof error,
        debug,
        sale: saleInput ? {
            customer_id: saleInput.customer_id,
            payment_methods: saleInput.payment_methods.map((payment) => ({
                method: payment.method,
                amount: payment.amount,
                total_with_fee: payment.total_with_fee,
                due_date: (payment as any).due_date,
            })),
            item_count: saleInput.items.length,
            items: saleInput.items.map((item) => ({
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total: item.total,
                serialized_unit_id: (item as any).serialized_unit?.unitId || null,
            })),
            promotional_discount: saleInput.promotional_discount,
            delivery_total: saleInput.delivery_total,
        } : undefined,
        timestamp: new Date().toISOString(),
    };
}

interface Customer {
    id: string;
    name: string;
    cpf_cnpj?: string;
    email?: string;
    phone?: string;
    customer_type?: 'wholesale' | 'resale' | 'retail' | 'ADMIN';
    admin_preview_type?: 'retail' | 'resale' | 'wholesale';
    is_walk_in_customer?: boolean;
}

function extractDeliveryPersonCustomerId(
    personId: string | undefined,
    deliveryPersons: Array<{ id: string; customer_id?: string }>
): string | undefined {
    const selected = deliveryPersons.find(person => person.id === personId);
    if (selected?.customer_id) return selected.customer_id;
    return personId?.startsWith('customer:') ? personId.slice('customer:'.length) : undefined;
}

const WARRANTY_TERM_CATEGORY_KEYS = new Set([
    'smartphones-e-tablet',
    'smartphones-e-tablets',
    'smartphone-e-tablet',
    'smartphone-e-tablets',
    'celular',
    'celulares',
]);

function normalizeWarrantyCategoryKey(value: unknown): string {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/&/g, ' e ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function isWarrantyTermCategoryValue(value: unknown): boolean {
    return WARRANTY_TERM_CATEGORY_KEYS.has(normalizeWarrantyCategoryKey(value));
}

export default function PDVPage() {
    const navigate = useNavigate();

    // Estado do carrinho
    const [cartItems, setCartItems] = useState<SaleItem[]>([]);
    const [warrantyOptions, setWarrantyOptions] = useState<WarrantyOption[]>([]);

    React.useEffect(() => {
        companySettingsService.get().then(settings => {
            if (settings?.extended_warranty_options) {
                setWarrantyOptions(settings.extended_warranty_options.filter(o => o.active));
            }
        }).catch(() => { });
    }, []);

    // Estado do cliente
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>();
    const [isSelectingWalkInCustomer, setIsSelectingWalkInCustomer] = useState(false);

    // Estado dos pagamentos
    const [payments, setPayments] = useState<PaymentMethod[]>([]);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [finalizeSteps, setFinalizeSteps] = useState<FinalizeStep[]>([]);
    const [activeFinalizationLog, setActiveFinalizationLog] = useState<PdvSaleFinalizationLog | null>(null);
    const [pdvPixPayment, setPdvPixPayment] = useState<PdvPixPayment | null>(null);
    const [pdvPixLoading, setPdvPixLoading] = useState(false);
    const [pdvPixCashierKey, setPdvPixCashierKey] = useState(() => localStorage.getItem('pdv_pix_cashier_key') || 'caixa-01');
    const [pdvPixDisplayId, setPdvPixDisplayId] = useState(() => localStorage.getItem('pdv_pix_display_id') || '');
    const [pdvPixDisplays, setPdvPixDisplays] = useState<PdvDisplay[]>([]);

    // Estado da entrega
    const [deliveryType, setDeliveryType] = useState<DeliveryType | undefined>();
    const [deliveryPersonId, setDeliveryPersonId] = useState<string | undefined>();
    const [deliveryPersonCustomerId, setDeliveryPersonCustomerId] = useState<string>('');
    const [deliveryCostStore, setDeliveryCostStore] = useState(0);
    const [deliveryCostCustomer, setDeliveryCostCustomer] = useState(0);

    // Estado do desconto promocional (inclui desconto de cupom)
    const [promotionalDiscount, setPromotionalDiscount] = useState(0);
    // Desconto de ajuste final (aplicado por ultimo no fechamento)
    const [finalAdjustmentDiscount, setFinalAdjustmentDiscount] = useState(0);

    // Estado do cupom
    const [couponCode, setCouponCode] = useState('');
    const [couponLoading, setCouponLoading] = useState(false);
    const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
    const [couponError, setCouponError] = useState<string | null>(null);

    // Estado da Indicação (Moedas do Vale)
    const [referralCode, setReferralCode] = useState('');
    const [saleNotes, setSaleNotes] = useState('');

    // Estado do termo de garantia — N termos (1 por aparelho serializado)
    const [showWarrantyModal, setShowWarrantyModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [lastSaleId, setLastSaleId] = useState<string>('');
    const [lastSaleData, setLastSaleData] = useState<any>(null);
    const [warrantyContents, setWarrantyContents] = useState<string[]>([]);
    const [warrantyDeliveryType, setWarrantyDeliveryType] = useState<DeliveryTypeWarranty>('store_pickup');
    const [warrantyTemplate, setWarrantyTemplate] = useState('');
    const [warrantyTagDataList, setWarrantyTagDataList] = useState<Record<string, string>[]>([]);
    // Meta de cada termo (id pré-gerado p/ numero_documento + unit vinculada) — paralelo ao warrantyContents
    const [warrantyDocsMeta, setWarrantyDocsMeta] = useState<Array<{ id: string; serialized_unit_id: string }>>([]);

    // Entregadores reais do VPS (role = 'delivery')
    const [deliveryPersons, setDeliveryPersons] = React.useState<{ id: string; name: string; customer_id?: string }[]>([]);

    const loadDeliveryPersons = React.useCallback(() => {
        Promise.all([
            teamService.list({ role: 'delivery', is_active: true }),
            customerService.list({ is_active: true, is_delivery_worker: true }),
        ])
            .then(([members, customers]) => {
                const teamOptions = members.map(m => ({ id: m.id, name: m.name }));
                const customerOptions = customers.map(customer => ({
                    id: `customer:${customer.id}`,
                    name: `${customer.name} (cliente)`,
                    customer_id: customer.id,
                }));
                setDeliveryPersons([...teamOptions, ...customerOptions]);
            })
            .catch(() => { /* falha silenciosa — seção de entrega fica sem entregadores */ });
    }, []);

    React.useEffect(() => {
        loadDeliveryPersons();
    }, [loadDeliveryPersons]);

    const handleDeliveryPersonCreated = (person: { id: string; name: string }) => {
        setDeliveryPersons(current => {
            if (current.some(item => item.id === person.id)) return current;
            return [person, ...current];
        });
        setDeliveryPersonId(person.id);
        setDeliveryPersonCustomerId('');
    };


    // Estado das taxas de pagamento
    const [paymentFees, setPaymentFees] = useState<any[]>([]);

    const handleCopyFinalizationLog = async (log: PdvSaleFinalizationLog) => {
        try {
            await copyPdvSaleFinalizationLogText(log);
            toast.success('Log da venda copiado');
        } catch (error) {
            console.error('Erro ao copiar log da venda:', error);
            toast.error('Nao foi possivel copiar o log');
        }
    };

    const handleDownloadFinalizationLog = (log: PdvSaleFinalizationLog) => {
        downloadPdvSaleFinalizationLogText(log);
    };

    // Buscar taxas de pagamento do VPS
    React.useEffect(() => {
        const fetchPaymentFees = async () => {
            try {
                const { paymentFeesService } = await import('../../services/payment-fees');
                const fees = await paymentFeesService.list();
                setPaymentFees(fees);
            } catch (error) {
                console.error('Erro ao buscar taxas de pagamento:', error);
                toast.error('Erro ao carregar taxas de pagamento');
            }
        };
        fetchPaymentFees();
    }, []);

    // Total em centavos dos itens (sem brindes)
    const { total: itemsTotal } = calculateSaleTotals(cartItems);
    const giftDiscount = cartItems.reduce((sum, item) => item.is_gift ? sum + (item.unit_price * item.quantity) : sum, 0);
    const totalFees = payments.reduce((sum, p) => sum + (p.fee_amount || 0), 0);
    const hasAPrazoPayment = payments.some(payment => payment.method === 'a_prazo');
    const totalBeforeFinalAdjustment = itemsTotal - giftDiscount - promotionalDiscount + deliveryCostCustomer + totalFees;
    const maxFinalAdjustmentDiscount = Math.max(0, totalBeforeFinalAdjustment);
    const appliedFinalAdjustmentDiscount = Math.min(finalAdjustmentDiscount, maxFinalAdjustmentDiscount);
    const total = Math.max(0, totalBeforeFinalAdjustment - appliedFinalAdjustmentDiscount);
    const totalPaid = calculateTotalPaid(payments);
    const remainingBalance = total - totalPaid;
    const pixPaymentPending = pdvPixPayment && ['creating', 'pending'].includes(pdvPixPayment.status);

    // Total do carrinho em R$ para o cupom (sem taxas, sem entrega)
    const cartTotalForCoupon = (itemsTotal - giftDiscount) / 100;

    const handleApplyCoupon = async () => {
        if (!couponCode.trim()) return;
        setCouponLoading(true);
        setCouponError(null);
        const result = await validateCoupon(couponCode, cartTotalForCoupon, 'ADMIN');
        if (!result.valid || !result.coupon) {
            setCouponError(result.error ?? 'Cupão inválido');
            setAppliedCoupon(null);
        } else {
            setAppliedCoupon(result.coupon);
            // discount em R$ → converter para centavos para o promotionalDiscount
            setPromotionalDiscount(Math.round((result.discount ?? 0) * 100));
            toast.success(`Cupom ${result.coupon.code} aplicado!`);
        }
        setCouponLoading(false);
    };

    const handleClearCoupon = () => {
        setAppliedCoupon(null);
        setCouponCode('');
        setCouponError(null);
        setPromotionalDiscount(0);
    };

    // Adicionar produto ao carrinho
    const handleAddToCart = (
        product: Product,
        quantity: number,
        unitData?: { unitId: string; imei1?: string; imei2?: string; serial?: string }
    ) => {
        // Unidades serializadas (com IMEI) são sempre itens individuais — nunca agrupa
        const isSerialized = !!unitData;

        if (!isSerialized) {
            const existingItemIndex = cartItems.findIndex(item => item.product_id === product.id && !item.serialized_unit);

            if (existingItemIndex >= 0) {
                // Produto normal já existe, atualizar quantidade
                const newItems = [...cartItems];
                const newQuantity = newItems[existingItemIndex].quantity + quantity;

                if (product.track_inventory && product.stock_quantity !== undefined) {
                    if (newQuantity > product.stock_quantity) {
                        toast.error(`Estoque insuficiente. Disponível: ${product.stock_quantity}`);
                        return;
                    }
                }

                newItems[existingItemIndex].quantity = newQuantity;
                newItems[existingItemIndex].subtotal = newItems[existingItemIndex].unit_price * newItems[existingItemIndex].quantity;
                newItems[existingItemIndex].total = product.is_gift
                    ? 0
                    : newItems[existingItemIndex].subtotal;
                setCartItems(newItems);
                return;
            }
        }

        // Novo item (produto normal ou unidade serializada individual)
        const unitPrice = getEffectiveCustomerPrice(product, selectedCustomer);
        const unitCost = normalizeCentValue(product.price_cost);

        const newItem: SaleItem = {
            id: crypto.randomUUID(),
            product_id: product.id,
            product_name: buildPdvProductName(product.name, (product as any).specs, unitData),
            product_sku: product.sku,
            quantity: isSerialized ? 1 : quantity, // serializado sempre = 1
            unit_price: unitPrice,
            unit_cost: unitCost,
            discount: product.is_gift ? unitPrice : 0,
            subtotal: unitPrice * (isSerialized ? 1 : quantity),
            total: product.is_gift ? 0 : unitPrice * (isSerialized ? 1 : quantity),
            is_gift: product.is_gift || false,
            track_inventory: product.track_inventory || false,
            stock_quantity: product.stock_quantity,
            product_specs: (product as any).specs || {},
            product_brand: (product as any).brand || '',
            product_model: product.model || product.name || '',
            product_category_id: (product as any).category_id || '',
            product_category_slug: (product as any).category_slug || '',
            product_category_name: (product as any).category_name || (product as any).category || '',
            // Dados da unidade serializada (IMEI/Serial)
            ...(unitData && { serialized_unit: unitData }),
        };
        setCartItems([...cartItems, newItem]);
    };

    // Atualizar quantidade de item

    const handleUpdateQuantity = (itemId: string, quantity: number) => {
        if (quantity < 1) return;

        const newItems = cartItems.map(item => {
            if (item.id === itemId) {
                const subtotal = (item.unit_price * quantity) + (item.warranty_price || 0);
                return {
                    ...item,
                    quantity,
                    subtotal,
                    total: item.is_gift ? 0 : subtotal
                };
            }
            return item;
        });
        setCartItems(newItems);
    };

    // Atualizar preço unitário de um item
    const syncAPrazoPaymentAmount = (nextItems: SaleItem[]) => {
        if (!payments.some(payment => payment.method === 'a_prazo')) return;

        const nextTotals = calculateSaleTotals(nextItems);
        const nextGiftDiscount = nextItems.reduce((sum, item) => item.is_gift ? sum + (item.unit_price * item.quantity) : sum, 0);
        const currentTotalFees = payments.reduce((sum, payment) => sum + (payment.fee_amount || 0), 0);
        const nextTotalBeforeFinalAdjustment = nextTotals.total - nextGiftDiscount - promotionalDiscount + deliveryCostCustomer + currentTotalFees;
        const nextFinalAdjustmentDiscount = Math.min(finalAdjustmentDiscount, Math.max(0, nextTotalBeforeFinalAdjustment));
        const nextSaleTotal = Math.max(0, nextTotalBeforeFinalAdjustment - nextFinalAdjustmentDiscount);

        setPayments(currentPayments => {
            let aPrazoIndex = -1;
            for (let index = currentPayments.length - 1; index >= 0; index -= 1) {
                if (currentPayments[index].method === 'a_prazo') {
                    aPrazoIndex = index;
                    break;
                }
            }

            if (aPrazoIndex < 0) return currentPayments;

            const paidWithoutAPrazo = currentPayments.reduce((sum, payment, index) => {
                if (index === aPrazoIndex) return sum;
                return sum + (payment.total_with_fee ?? payment.amount ?? 0);
            }, 0);
            const nextAPrazoAmount = Math.max(0, nextSaleTotal - paidWithoutAPrazo);

            return currentPayments.map((payment, index) => {
                if (index !== aPrazoIndex) return payment;
                return {
                    ...payment,
                    amount: nextAPrazoAmount,
                    total_with_fee: nextAPrazoAmount
                };
            });
        });
    };

    const handleUpdatePrice = (itemId: string, newPrice: number) => {
        const newItems = cartItems.map(item => {
            if (item.id === itemId && !item.is_gift) {
                // Se o item tem "warranty_months", precisamos re-calcular o preço da garantia 
                // pois a garantia é um % do valor base. Mas dependendo de como as regras 
                // da empresa funcionam, pode-se querer manter fixo. 
                // Aqui iremos manter o preço da garantia anterior (ou atualizar se preferir).
                // Como não sabemos a porcentagem exata aqui sem as options, vamos manter o valor da garantia como está,
                // ou apenas somá-lo ao novo subtotal.
                
                const subtotal = (newPrice * item.quantity) + (item.warranty_price || 0);
                return {
                    ...item,
                    unit_price: newPrice,
                    subtotal,
                    total: subtotal,
                    // Ao editar o preço manualmente, nós atualizamos o "discount" interno pra bater com getEffectiveRetailPrice?
                    // "discount" não é rigorosamente essencial no PDV desde que o subtotal esteja correto, mas podemos mantê-lo.
                    discount: (item.unit_price - newPrice) > 0 ? (item.unit_price - newPrice) : 0
                };
            }
            return item;
        });
        setCartItems(newItems);
        syncAPrazoPaymentAmount(newItems);
    };

    const handleUpdateItemPrice = (itemId: string, newPrice: number) => {
        handleUpdatePrice(itemId, newPrice);
    };

    // Remover item do carrinho
    const handleRemoveItem = (itemId: string) => {
        setCartItems(cartItems.filter(item => item.id !== itemId));
        toast.info('Item removido do carrinho');
    };

    // Atualizar garantia do item
    const handleUpdateWarranty = (itemId: string, selectedWarranty: WarrantyOption | null) => {
        setCartItems(current => current.map(item => {
            if (item.id === itemId) {
                if (selectedWarranty) {
                    const price = Math.round((item.unit_price * selectedWarranty.percentage) / 100);
                    const subtotal = (item.unit_price * item.quantity) + price;
                    return { ...item, warranty_months: selectedWarranty.months, warranty_price: price, subtotal, total: item.is_gift ? 0 : subtotal };
                } else {
                    const subtotal = (item.unit_price * item.quantity);
                    return { ...item, warranty_months: undefined, warranty_price: undefined, subtotal, total: item.is_gift ? 0 : subtotal };
                }
            }
            return item;
        }));
    };

    // Limpar carrinho
    const handleClearCart = () => {
        if (window.confirm('Deseja realmente limpar o carrinho?')) {
            setCartItems([]);
            setPayments([]);
            setPdvPixPayment(null);
            setFinalAdjustmentDiscount(0);
            toast.info('Carrinho limpo');
        }
    };

    // Adicionar pagamento
    const handleAddPayment = (payment: PaymentMethod) => {
        setPayments([...payments, payment]);
    };

    // Remover pagamento
    const handleRemovePayment = (index: number) => {
        setPayments(payments.filter((_, i) => i !== index));
        setFinalAdjustmentDiscount(0);
        toast.info('Pagamento removido');
    };

    // Handler de mudança de entrega
    const handleDeliveryChange = (
        type: DeliveryType | undefined,
        personId: string | undefined,
        costStore: number,
        costCustomer: number
    ) => {
        setDeliveryType(type);
        setDeliveryPersonId(personId);
        setDeliveryPersonCustomerId(extractDeliveryPersonCustomerId(personId, deliveryPersons) || '');
        setDeliveryCostStore(costStore);
        setDeliveryCostCustomer(costCustomer);
    };

    const isWalkInCustomer = (customer?: Customer): boolean => customer?.is_walk_in_customer === true;

    const handleSelectWalkInCustomer = async () => {
        try {
            setIsSelectingWalkInCustomer(true);
            const customer = await customerService.getWalkInCustomer();
            setSelectedCustomer(customer);
            handleDeliveryChange('store_pickup', undefined, 0, 0);
            toast.success('Venda rápida selecionada', {
                description: 'Cliente Balcão com retirada na loja.'
            });
        } catch (error: any) {
            console.error('Erro ao selecionar Cliente Balcão:', error);
            toast.error(error?.message || 'Erro ao selecionar Cliente Balcão');
        } finally {
            setIsSelectingWalkInCustomer(false);
        }
    };

    // Handler de seleção de parcela
    const handleSelectInstallment = (
        installments: number,
        amount: number,
        feeAmount: number,
        operatorFeeAmount: number,
        operatorFeePercentage: number,
        appliedFeePercentage: number
    ) => {
        const totalWithFee = amount + feeAmount;
        const newPayment: PaymentMethod = {
            method: 'credit',
            amount,
            installments: installments,
            fee_percentage: appliedFeePercentage,
            fee_amount: feeAmount,
            operator_fee_percentage: operatorFeePercentage,
            operator_fee_amount: operatorFeeAmount,
            total_with_fee: totalWithFee
        };
        setFinalAdjustmentDiscount(0);
        setPayments([...payments, newPayment]);
        toast.success(`Pagamento de ${installments}x adicionado`);
    };

    const handleApplyFinalPaymentAmount = (targetTotal: number) => {
        let creditPaymentIndex = -1;
        for (let index = payments.length - 1; index >= 0; index -= 1) {
            if (payments[index].method === 'credit') {
                creditPaymentIndex = index;
                break;
            }
        }

        if (creditPaymentIndex < 0) {
            toast.error('Selecione um pagamento no cartao antes do ajuste final');
            return;
        }

        const safeTargetTotal = Math.max(0, Math.min(Math.round(targetTotal), totalBeforeFinalAdjustment));
        const paymentsWithoutAdjustedCredit = payments.reduce((sum, payment, index) => {
            if (index === creditPaymentIndex) return sum;
            return sum + (payment.total_with_fee ?? payment.amount ?? 0);
        }, 0);
        const targetCreditTotal = safeTargetTotal - paymentsWithoutAdjustedCredit;

        if (targetCreditTotal < 0) {
            toast.error('O valor final nao pode ser menor que os pagamentos ja informados');
            return;
        }

        const nextPayments = payments.map((payment, index) => {
            if (index !== creditPaymentIndex) return payment;

            return {
                ...payment,
                amount: targetCreditTotal,
                total_with_fee: targetCreditTotal
            };
        });

        setPayments(nextPayments);
        setFinalAdjustmentDiscount(Math.max(0, totalBeforeFinalAdjustment - safeTargetTotal));
        toast.success('Ajuste final aplicado e parcelas recalculadas');
    };

    const rememberPdvPixDisplayConfig = (displayId = pdvPixDisplayId, cashierKey = pdvPixCashierKey) => {
        localStorage.setItem('pdv_pix_display_id', displayId.trim());
        localStorage.setItem('pdv_pix_cashier_key', cashierKey.trim() || 'caixa-01');
    };

    const cashierDisplayOptions = React.useMemo(() => {
        return pdvPixDisplays.filter((display) => (
            display.is_active && (display.type === 'cashier' || display.type === 'hybrid')
        ));
    }, [pdvPixDisplays]);

    const loadPdvPixDisplays = React.useCallback(async () => {
        try {
            const displays = await pdvDisplayService.listDisplays();
            setPdvPixDisplays(displays);

            const currentDisplayId = pdvPixDisplayId.trim();
            const cashierKey = pdvPixCashierKey.trim() || 'caixa-01';
            const options = displays.filter((display) => (
                display.is_active && (display.type === 'cashier' || display.type === 'hybrid')
            ));
            const currentStillAvailable = options.some((display) => display.id === currentDisplayId);
            if (currentDisplayId && currentStillAvailable) return;

            const matchingCashier = options.find((display) => String(display.cashier_key || '').trim() === cashierKey);
            const nextDisplayId = (matchingCashier || options[0])?.id || '';
            if (nextDisplayId) {
                setPdvPixDisplayId(nextDisplayId);
                rememberPdvPixDisplayConfig(nextDisplayId, cashierKey);
            }
        } catch (error) {
            console.error('Erro ao carregar displays do PDV:', error);
        }
    }, [pdvPixCashierKey, pdvPixDisplayId]);

    React.useEffect(() => {
        loadPdvPixDisplays();
    }, [loadPdvPixDisplays]);

    const addApprovedPdvPixPayment = (payment: PdvPixPayment) => {
        setPayments(currentPayments => {
            if (currentPayments.some(item => item.pix_payment_id === payment.id)) return currentPayments;
            return [
                ...currentPayments,
                {
                    method: 'pix',
                    amount: payment.amount,
                    total_with_fee: payment.amount,
                    pix_payment_id: payment.id,
                    mercado_pago_payment_id: payment.mercado_pago_payment_id || undefined,
                    pix_status: 'approved'
                }
            ];
        });
    };

    const handleShowPdvPixOnDisplay = async () => {
        if (!pdvPixPayment) {
            toast.error('Gere um Pix antes de exibir no display');
            return;
        }
        const display_id = pdvPixDisplayId.trim();
        if (!display_id) {
            toast.error('Informe o Display ID vinculado ao caixa');
            return;
        }

        try {
            setPdvPixLoading(true);
            rememberPdvPixDisplayConfig();
            await pdvDisplayService.setActivePix(display_id, pdvPixPayment.id);
            toast.success('Pix enviado para o display');
        } catch (error: any) {
            toast.error(error?.message || 'Erro ao enviar Pix para o display');
        } finally {
            setPdvPixLoading(false);
        }
    };

    const handleCreatePdvPixPayment = async (amount: number) => {
        try {
            setPdvPixLoading(true);
            const display_id = pdvPixDisplayId.trim();
            const cashier_key = pdvPixCashierKey.trim() || 'caixa-01';
            rememberPdvPixDisplayConfig(display_id, cashier_key);

            const payment = await pdvDisplayService.createPixPayment({
                amount,
                display_id: display_id || null,
                cashier_key,
                local_reference: crypto.randomUUID(),
                description: 'Venda PDV Mercado do Vale',
                payer_email: selectedCustomer?.email || undefined
            });

            setPdvPixPayment(payment);

            if (display_id) {
                await pdvDisplayService.setActivePix(display_id, payment.id);
            }

            if (payment.status === 'approved') {
                addApprovedPdvPixPayment(payment);
                toast.success('Pix aprovado e adicionado ao pagamento');
            } else {
                toast.success('Pix gerado. Aguarde o pagamento do cliente.');
            }
        } catch (error: any) {
            toast.error(error?.message || 'Erro ao gerar Pix Mercado Pago');
        } finally {
            setPdvPixLoading(false);
        }
    };

    const handleRefreshPdvPixPayment = async () => {
        if (!pdvPixPayment) return;

        try {
            setPdvPixLoading(true);
            const payment = await pdvDisplayService.refreshPixPaymentStatus(pdvPixPayment.id);
            setPdvPixPayment(payment);

            if (payment.status === 'approved') {
                addApprovedPdvPixPayment(payment);
                if (pdvPixDisplayId.trim()) {
                    await pdvDisplayService.clearActivePix(pdvPixDisplayId.trim());
                }
                toast.success('Pix aprovado e adicionado ao pagamento');
                return;
            }

            if (payment.status === 'rejected' || payment.status === 'expired' || payment.status === 'error') {
                toast.error('Pix nao aprovado. Gere uma nova cobranca se necessario.');
                return;
            }

            toast.info('Pix ainda pendente');
        } catch (error: any) {
            toast.error(error?.message || 'Erro ao atualizar pagamento Pix');
        } finally {
            setPdvPixLoading(false);
        }
    };

    const handleCancelPdvPixPayment = async () => {
        if (!pdvPixPayment) return;
        if (pdvPixPayment.status === 'approved') {
            toast.error('Pix aprovado nao pode ser cancelado localmente');
            return;
        }

        try {
            setPdvPixLoading(true);
            if (pdvPixDisplayId.trim()) {
                await pdvDisplayService.clearActivePix(pdvPixDisplayId.trim());
            }
            setPdvPixPayment(null);
            toast.info('Pix cancelado no PDV');
        } catch (error: any) {
            toast.error(error?.message || 'Erro ao cancelar Pix no display');
        } finally {
            setPdvPixLoading(false);
        }
    };

    const handlePrintPdvPixQr = () => {
        if (!pdvPixPayment) {
            toast.error('Gere um Pix antes de imprimir o QR');
            return;
        }

        printPixQr(buildPdvPixPrintData({
            payment: pdvPixPayment,
            storeName: 'Mercado do Vale',
            items: cartItems,
            instructions: 'Pague com Pix e aguarde a confirmacao no caixa.'
        }));
    };

    // Finalizar venda
    const handleFinalizeSale = async () => {
        if (pixPaymentPending) {
            toast.error('Aguarde o Pix ser aprovado antes de finalizar a venda');
            return;
        }

        if (!selectedCustomer) {
            toast.error('Selecione um cliente');
            return;
        }

        if (cartItems.length === 0) {
            toast.error('Adicione produtos ao carrinho');
            return;
        }

        setIsFinalizing(true);
        const initialFinalizeSteps: FinalizeStep[] = [
            { id: 'validate', label: 'Validando venda', status: 'saving' },
            { id: 'sale', label: 'Registrando venda na VPS', status: 'idle' },
            { id: 'debt', label: 'Criando debito do cliente', status: 'idle' },
            { id: 'receipt', label: 'Preparando comprovante', status: 'idle' },
        ];
        setFinalizeSteps(initialFinalizeSteps);
        const updateFinalizeStep = (id: string, status: FinalizeStep['status'], detail?: string, debug?: unknown) => {
            setFinalizeSteps((current) => current.map((step) => step.id === id ? { ...step, status, detail, debug } : step));
        };

        const deliveryTotal = deliveryCostStore + deliveryCostCustomer;

        const saleInput: SaleInput = {
            customer_id: selectedCustomer.id,
            // seller_id: TODO - pegar do usuário logado
            items: cartItems,
            payment_methods: payments,
            notes: undefined,
            delivery_type: deliveryType,
            delivery_person_id: deliveryPersonId,
            delivery_person_customer_id: extractDeliveryPersonCustomerId(deliveryPersonId, deliveryPersons),
            delivery_cost_store: deliveryCostStore,
            delivery_cost_customer: deliveryCostCustomer,
            delivery_total: deliveryTotal,
            promotional_discount: promotionalDiscount + appliedFinalAdjustmentDiscount,
            referral_code: referralCode.trim() || undefined
        };

        let finalizationLog = buildPdvSaleFinalizationLog({
            saleInput,
            steps: initialFinalizeSteps,
            pdvState: {
                customer: selectedCustomer,
                cartItems,
                payments,
                pdvPixPayment,
                deliveryType,
                deliveryPersonId,
                deliveryPersonCustomerId,
                deliveryCostStore,
                deliveryCostCustomer,
                deliveryTotal,
                promotionalDiscount,
                appliedFinalAdjustmentDiscount,
                finalAdjustmentDiscount,
                appliedCoupon,
                referralCode,
                saleNotes,
                totals: calculateSaleTotals(cartItems),
                totalPaid: calculateTotalPaid(payments),
                createdFromPath: window.location.pathname,
            },
        });
        saleInput.finalization_status = 'success';
        saleInput.finalization_log = serializePdvSaleFinalizationLog(finalizationLog);
        saleInput.finalization_error_summary = undefined;
        setActiveFinalizationLog(finalizationLog);

        try {
            updateFinalizeStep('validate', 'done');
            updateFinalizeStep('sale', 'saving');
            if (hasAPrazoPayment) updateFinalizeStep('debt', 'saving');
            const sale = await createSale(saleInput);
            finalizationLog = updatePdvSaleFinalizationLog(finalizationLog, {
                sale_id: sale.id,
                status: sale.finalization_status === 'needs_review' ? 'needs_review' : 'success',
                errors: sale.finalization_error_summary ? [{
                    step: 'createSale',
                    message: sale.finalization_error_summary,
                    timestamp: new Date().toISOString(),
                }] : [],
            });
            setActiveFinalizationLog(finalizationLog);
            updateFinalizeStep('sale', 'done');
            if (hasAPrazoPayment) updateFinalizeStep('debt', 'done');
            // Registrar uso do cupom se houver
            if (appliedCoupon) {
                await applyCoupon(appliedCoupon.id);
                handleClearCoupon();
            }

            // Creditar Moedas do Vale pelo valor final pago
            if (!isWalkInCustomer(selectedCustomer)) {
            try {
                const totals = calculateSaleTotals(cartItems);
                const couponDiscount = appliedCoupon
                    ? (totals.subtotal * ((appliedCoupon as any).discount_percent ?? 0)) / 100
                    : 0;
                const finalPaid = Math.max(0, totals.subtotal - couponDiscount + deliveryCostCustomer - appliedFinalAdjustmentDiscount);
                // finalPaid is in cents, earnCoinsForPurchase expects Reais
                const coinsEarned = await earnCoinsForPurchase(selectedCustomer.id, finalPaid / 100, sale.id);
                if (coinsEarned > 0) {
                    toast.success(`🪙 +${coinsEarned} Moedas do Vale!`, {
                        description: `${selectedCustomer.name} acumulou moedas nesta compra.`
                    });
                }
            } catch {
                // Erro nas moedas não bloqueia a venda
            }
            }

            if (sale.finalization_status === 'needs_review') {
                toast.warning('Venda registrada com erros para corrigir', {
                    description: `Venda #${sale.id.slice(0, 8)} salva com log de recuperacao`
                });
            } else {
                toast.success('Venda registrada com sucesso', {
                    description: `Venda #${sale.id.slice(0, 8)} criada`
                });
            }

            // Disparo silencioso para o Telegram
            try {
                const isMultiple = cartItems.length > 1;
                const firstItem = cartItems[0];
                const newStock = firstItem.track_inventory && firstItem.stock_quantity !== undefined
                    ? firstItem.stock_quantity - firstItem.quantity
                    : 0;

                // Cálculo do Lucro (Subtotal final cobrado - Custo total dos itens)
                const totalCost = cartItems.reduce((acc, item) => acc + (item.unit_cost * item.quantity), 0);
                const grossProfit = total - totalCost; // 'total' já embute descontos promocionais e subtrai frete do cliente, mas frete do admin/loja tb tira? Não, vamos ser simples
                // Lucro limpo
                const profitMargin = grossProfit > 0 ? grossProfit : 0;

                // Formas de Pagamento
                const paymentMethodsList = payments.map(p => {
                    if (p.method === 'money') return 'Dinheiro';
                    if (p.method === 'pix') return 'Pix';
                    if (p.method === 'credit') return `Cartão de Crédito (${p.installments}x)`;
                    if (p.method === 'debit') return 'Cartão de Débito';
                    return p.method;
                }).join(', ') || 'Não informado';

                // Entregador
                let entregadorNome = 'Retirada na Loja';
                let entregadorPix = '-';
                if (deliveryPersonId && (deliveryType === 'store_delivery' || deliveryType === 'hybrid_delivery')) {
                    const person = deliveryPersons.find(p => p.id === deliveryPersonId);
                    entregadorNome = person?.name || 'Entregador';
                    try {
                        const memberFull = await teamService.getById(deliveryPersonId);
                        if (memberFull?.pix_key) entregadorPix = memberFull.pix_key;
                    } catch { /* ignora */ }
                }

                telegramBotService.notifySale({
                    id_venda: sale.id.slice(0, 8).toUpperCase(),
                    cliente: selectedCustomer.name,
                    telefone: selectedCustomer.phone || 'Não informado',
                    produto: isMultiple ? `${cartItems.length} itens diversificados` : firstItem.product_name,
                    modelo: isMultiple ? '-' : (firstItem.product_name.split(',')[0] || firstItem.product_name),
                    valor: `R$ ${(total / 100).toFixed(2).replace('.', ',')}`,
                    lucro: `R$ ${(profitMargin / 100).toFixed(2).replace('.', ',')}`,
                    pagamento: paymentMethodsList,
                    desconto: (promotionalDiscount + appliedFinalAdjustmentDiscount) > 0
                        ? `R$ ${((promotionalDiscount + appliedFinalAdjustmentDiscount) / 100).toFixed(2).replace('.', ',')}`
                        : 'Nenhum',
                    estoque: isMultiple ? '-' : String(newStock),
                    entregador: entregadorNome,
                    entregador_pix: entregadorPix,
                });
            } catch (e) {
                // Ignore silent error
            }

            // Salvar dados para geração do termo
            setLastSaleId(sale.id);
            setLastSaleData({
                sale,
                customer: selectedCustomer,
                items: cartItems,
                finalizationLog,
            });

            // Mostrar modal de sucesso
            setShowSuccessModal(true);

            // Limpar todo o PDV
            setCartItems([]);
            setSelectedCustomer(undefined);
            setPayments([]);
            setPdvPixPayment(null);
            setDeliveryType(undefined);
            setDeliveryPersonId(undefined);
            setDeliveryCostStore(0);
            setDeliveryCostCustomer(0);
            setPromotionalDiscount(0);
            setFinalAdjustmentDiscount(0);
            setReferralCode('');
            handleClearCoupon();
        } catch (error) {
            console.error('Erro ao finalizar venda:', error);
            const debug = extractFinalizeDebug(error, saleInput);
            finalizationLog = updatePdvSaleFinalizationLog(finalizationLog, {
                status: 'failed',
                errors: [{
                    step: 'createSale',
                    message: debug.message,
                    name: debug.name,
                    debug,
                    timestamp: new Date().toISOString(),
                }],
            });
            setActiveFinalizationLog(finalizationLog);
            const detail = error instanceof Error ? error.message : 'Erro desconhecido ao finalizar venda';
            setFinalizeSteps((current) => current.map((step) => step.status === 'saving' ? { ...step, status: 'error', detail, debug } : step));
            toast.error('Erro ao finalizar venda. Verifique os dados e tente novamente.');
        } finally {
            setIsFinalizing(false);
        }
    };

    // Resolve dias de garantia: product.warranty_template_id → brand → category → 90
    const resolveWarrantyDays = async (
        item: SaleItem,
        brandsByName: Map<string, { warranty_days?: number }>
    ): Promise<number> => {
        try {
            const product = item.product_id ? await productService.getById(item.product_id) : null;
            if (product?.warranty_type === 'custom' && product.warranty_template_id) {
                const template = await warrantyTemplateService.getById(product.warranty_template_id);
                if (template?.duration_days) return template.duration_days;
            }
            const brandName = ((item as any).product_brand || product?.brand || '').toLowerCase();
            const brand = brandsByName.get(brandName);
            if (brand?.warranty_days) return brand.warranty_days;
            if (product?.category_id) {
                const cat = await categoryService.getById(product.category_id);
                if (cat?.warranty_days) return cat.warranty_days;
            }
        } catch (e) {
            console.warn('[warranty] Falha ao resolver dias de garantia, usando default 90:', e);
        }
        return 90;
    };

    // Constrói WarrantyTagData para um item serializado específico
    const buildTagData = (
        item: SaleItem,
        sale: any,
        customer: Customer,
        settings: any,
        days: number,
        type: DeliveryTypeWarranty,
        documentId: string
    ): WarrantyTagData => {
        const specs = (item as any).product_specs || {};
        const unit = (item as any).serialized_unit || {};
        return {
            nome_loja: settings.company_name || '',
            endereco: settings.address || '',
            telefone: formatWarrantyPhone(settings.phone || ''),
            email: settings.email || '',
            cnpj: formatWarrantyCpfCnpj(settings.cnpj || ''),
            logo: (settings as any).logo || settings.receipt_logo_url || '',
            nome_cliente: customer.name,
            cpf_cliente: formatWarrantyCpfCnpj(customer.cpf_cnpj || ''),
            telefone_cliente: formatWarrantyPhone(customer.phone || ''),
            email_cliente: customer.email || '',
            numero_venda: sale.id.slice(0, 8).toUpperCase(),
            numero_documento: documentId.slice(0, 8).toUpperCase(),
            data_compra: formatWarrantyDate(new Date()),
            produto: item.product_name,
            marca: (item as any).product_brand || '',
            modelo: (item as any).product_model || '',
            cor: specs.color || '',
            ram: specs.ram || '',
            memoria: specs.storage || '',
            imei1: unit.imei1 || specs.imei1 || '',
            imei2: unit.imei2 || specs.imei2 || '',
            dias_garantia: String(days),
            tipo_garantia: 'Garantia Legal',
            declaracao_recebimento: getWarrantyDeclaration(type),
        };
    };

    // Gera N termos (1 por aparelho serializado). Sem serializados → não abre modal.
    const loadWarrantyEligibleSerializedItems = async (items: SaleItem[]): Promise<SaleItem[]> => {
        const eligibleItems: SaleItem[] = [];

        for (const item of items) {
            if (!(item as any).serialized_unit?.unitId) continue;

            if (
                isWarrantyTermCategoryValue((item as any).product_category_slug) ||
                isWarrantyTermCategoryValue((item as any).product_category_name)
            ) {
                eligibleItems.push(item);
                continue;
            }

            try {
                const product = item.product_id ? await productService.getById(item.product_id) : null;
                if (!product) continue;

                if (
                    isWarrantyTermCategoryValue((product as any).category_slug) ||
                    isWarrantyTermCategoryValue((product as any).category_name) ||
                    isWarrantyTermCategoryValue((product as any).category)
                ) {
                    eligibleItems.push(item);
                    continue;
                }

                const categoryId = (product as any).category_id || (item as any).product_category_id;
                if (categoryId) {
                    const category = await categoryService.getById(categoryId);
                    if (isWarrantyTermCategoryValue(category?.slug) || isWarrantyTermCategoryValue(category?.name)) {
                        eligibleItems.push(item);
                    }
                }
            } catch (error) {
                console.warn('[warranty] Falha ao validar categoria para termo:', error);
            }
        }

        return eligibleItems;
    };

    const generateWarrantyTerm = async (sale: any, customer: Customer, items: SaleItem[]) => {
        try {
            const settings = await companySettingsService.get();
            if (!settings || !settings.warranty_template) {
                console.warn('Template de garantia não configurado');
                return;
            }

            const serializedItems = await loadWarrantyEligibleSerializedItems(items);
            if (serializedItems.length === 0) {
                // Sem aparelho serializado — não emite termo (acessórios não geram garantia)
                return;
            }

            const brands = await brandService.list();
            const brandsByName = new Map<string, { warranty_days?: number }>();
            brands.forEach(b => brandsByName.set(b.name.toLowerCase(), b));

            const initialType: DeliveryTypeWarranty =
                deliveryType === 'delivery' ? 'delivery' : 'store_pickup';
            const contents: string[] = [];
            const tagDataList: Record<string, string>[] = [];
            const docsMeta: Array<{ id: string; serialized_unit_id: string }> = [];

            for (const item of serializedItems) {
                const days = await resolveWarrantyDays(item, brandsByName);
                const docId = crypto.randomUUID();
                const tagData = buildTagData(item, sale, customer, settings, days, initialType, docId);
                const filtered = applyWarrantyDisplayFlags(tagData as any, settings);
                const content = replaceWarrantyTags(settings.warranty_template, filtered);
                contents.push(content);
                tagDataList.push(filtered as any);
                docsMeta.push({ id: docId, serialized_unit_id: (item as any).serialized_unit.unitId });
            }

            setWarrantyContents(contents);
            setWarrantyTagDataList(tagDataList);
            setWarrantyDocsMeta(docsMeta);
            setWarrantyTemplate(settings.warranty_template);
            setWarrantyDeliveryType(initialType);
            setShowWarrantyModal(true);
        } catch (error) {
            console.error('Erro ao gerar termo de garantia:', error);
            toast.error('Erro ao gerar termo de garantia');
        }
    };

    // Regenera todos os termos quando o tipo de entrega muda
    const handleWarrantyDeliveryTypeChange = async (type: DeliveryTypeWarranty) => {
        setWarrantyDeliveryType(type);
        if (!lastSaleData) return;

        const settings = await companySettingsService.get();
        if (!settings || !settings.warranty_template) return;

        const serializedItems = await loadWarrantyEligibleSerializedItems(lastSaleData.items || []);
        if (serializedItems.length === 0) return;

        const brands = await brandService.list();
        const brandsByName = new Map<string, { warranty_days?: number }>();
        brands.forEach(b => brandsByName.set(b.name.toLowerCase(), b));

        // Reaproveita os UUIDs já gerados em generateWarrantyTerm pra manter
        // consistência do numero_documento (mesmo se mudar tipo de entrega).
        const contents: string[] = [];
        const tagDataList: Record<string, string>[] = [];
        for (let i = 0; i < serializedItems.length; i++) {
            const item = serializedItems[i];
            const days = await resolveWarrantyDays(item, brandsByName);
            const docId = warrantyDocsMeta[i]?.id || crypto.randomUUID();
            const tagData = buildTagData(item, lastSaleData.sale, lastSaleData.customer, settings, days, type, docId);
            const filtered = applyWarrantyDisplayFlags(tagData as any, settings);
            const content = replaceWarrantyTags(settings.warranty_template, filtered);
            contents.push(content);
            tagDataList.push(filtered as any);
        }

        setWarrantyContents(contents);
        setWarrantyTagDataList(tagDataList);
    };

    // Imprimir recibo a partir do modal (dados da última venda)
    const handlePrintReceiptFromModal = async () => {
        if (!lastSaleData) return;
        try {
            const settings = await companySettingsService.get();
            if (!settings) return;
            // Monta map keyed por item.id com IMEI/serial da unit em memória
            const specsByItem: Record<string, Record<string, string>> = {};
            (lastSaleData.items || []).forEach((it: any) => {
                if (it.serialized_unit) {
                    specsByItem[it.id] = {
                        imei1: it.serialized_unit.imei1 || '',
                        imei2: it.serialized_unit.imei2 || '',
                        serial: it.serialized_unit.serial || '',
                    };
                }
            });
            const saleForPrint = { ...lastSaleData.sale, items: lastSaleData.items };
            printSaleReceipt(saleForPrint as any, settings, specsByItem);
        } catch (e) {
            console.error(e);
        }
    };

    // Salvar termo de garantia
    const handleGenerateWarranty = async (signature: string) => {
        if (!lastSaleData) return;

        try {
            // 1 documento por aparelho serializado, cada com seu UUID/numero_documento.
            const failures: string[] = [];
            for (let i = 0; i < warrantyContents.length; i++) {
                const meta = warrantyDocsMeta[i];
                if (!meta) continue;
                try {
                    await warrantyDocumentService.create({
                        id: meta.id,
                        sale_id: lastSaleId,
                        customer_id: lastSaleData.customer.id,
                        serialized_unit_id: meta.serialized_unit_id,
                        delivery_type: warrantyDeliveryType,
                        customer_signature: signature,
                        warranty_content: warrantyContents[i],
                    });
                } catch (err) {
                    console.error(`[warranty] Falha ao salvar termo ${i + 1}:`, err);
                    failures.push(`Termo ${i + 1}`);
                }
            }

            if (failures.length === 0) {
                toast.success(`${warrantyContents.length} termo(s) de garantia salvo(s)!`);
            } else if (failures.length < warrantyContents.length) {
                toast.error(`Falha parcial: ${failures.join(', ')} não foram salvos`);
            } else {
                throw new Error('Falha ao salvar todos os termos');
            }
            setShowWarrantyModal(false);
        } catch (error) {
            console.error('Erro ao salvar termo de garantia:', error);
            toast.error('Erro ao salvar termo de garantia');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/admin')}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                    <ShoppingCart size={28} />
                                    PDV - Ponto de Venda
                                </h1>
                                <p className="text-sm text-slate-600">Sistema de vendas</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Coluna Esquerda: Formulário (50%) */}
                    <div className="space-y-6">
                        <CustomerSection
                            selectedCustomer={selectedCustomer}
                            onSelectCustomer={setSelectedCustomer}
                            onSelectWalkInCustomer={handleSelectWalkInCustomer}
                            isSelectingWalkInCustomer={isSelectingWalkInCustomer}
                        />

                        <ProductSearchSection
                            customer={selectedCustomer}
                            onAddToCart={handleAddToCart}
                        />

                        <CartItemsSection
                            items={cartItems}
                            warrantyOptions={warrantyOptions}
                            allowPriceEdit={hasAPrazoPayment}
                            onUpdateQuantity={handleUpdateQuantity}
                            onRemoveItem={handleRemoveItem}
                            onUpdateWarranty={handleUpdateWarranty}
                            onUpdatePrice={handleUpdatePrice}
                            onUpdateItemPrice={handleUpdateItemPrice}
                        />

                        <DeliverySection
                            deliveryType={deliveryType}
                            deliveryPersonId={deliveryPersonId}
                            deliveryCostStore={deliveryCostStore}
                            deliveryCostCustomer={deliveryCostCustomer}
                            deliveryPersons={deliveryPersons}
                            onDeliveryChange={handleDeliveryChange}
                            onDeliveryPersonCreated={handleDeliveryPersonCreated}
                        />

                        <div data-pdv-commercial-options className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {/* Cupom de desconto */}
                        <div data-pdv-option-card="coupon" className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                            <div className="flex items-center gap-2 mb-1">
                                <Ticket className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-semibold text-slate-700">Cupom de Desconto</span>
                            </div>
                            {appliedCoupon ? (
                                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                    <span className="text-sm text-green-800 font-medium">
                                        ✅ <strong>{appliedCoupon.code}</strong> — R$ {(promotionalDiscount / 100).toFixed(2).replace('.', ',')} de desconto
                                    </span>
                                    <button onClick={handleClearCoupon} className="p-1 hover:bg-green-100 rounded text-green-700">
                                        <XIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <input
                                        value={couponCode}
                                        onChange={e => setCouponCode(e.target.value.toUpperCase())}
                                        onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                                        placeholder="CÓDIGO DO CUPOM"
                                        className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none font-mono uppercase text-sm"
                                    />
                                    <button
                                        onClick={handleApplyCoupon}
                                        disabled={couponLoading || !couponCode.trim()}
                                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                    >
                                        {couponLoading ? '...' : 'Aplicar'}
                                    </button>
                                </div>
                            )}
                            {couponError && <p className="text-xs text-red-600">{couponError}</p>}
                        </div>

                        {/* Código de Indicação */}
                        <div data-pdv-option-card="referral" className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-2">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">🤝</span>
                                    <span className="text-sm font-semibold text-purple-800">Código de Indicação (Moedas)</span>
                                </div>
                            </div>
                            <input
                                value={referralCode}
                                onChange={e => setReferralCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                                placeholder="CÓDIGO (Ex: MV-A1B2C)"
                                className="w-full px-3 py-2 border-2 border-purple-200 rounded-lg focus:border-purple-500 focus:outline-none font-mono uppercase text-sm bg-white"
                            />
                            <p className="text-xs text-purple-600/80">Recompensa o divulgador que indicou esta venda.</p>
                        </div>
                        </div>


                        <PaymentSection
                            total={total}
                            payments={payments}
                            onAddPayment={handleAddPayment}
                            onRemovePayment={handleRemovePayment}
                            paymentFees={paymentFees}
                            onSelectInstallment={handleSelectInstallment}
                            promotionalDiscount={promotionalDiscount}
                            onPromotionalDiscountChange={setPromotionalDiscount}
                            finalAdjustmentDiscount={appliedFinalAdjustmentDiscount}
                            maxFinalAdjustmentDiscount={maxFinalAdjustmentDiscount}
                            selectedCustomer={selectedCustomer}
                            onUpdatePayment={(index, updated) => {
                                const next = [...payments];
                                next[index] = updated;
                                setPayments(next);
                            }}
                            pdvPixPayment={pdvPixPayment}
                            pdvPixLoading={pdvPixLoading}
                            pdvPixDisplayId={pdvPixDisplayId}
                            pdvPixCashierKey={pdvPixCashierKey}
                            pdvPixDisplays={cashierDisplayOptions}
                            onPdvPixDisplayIdChange={(displayId) => {
                                setPdvPixDisplayId(displayId);
                                localStorage.setItem('pdv_pix_display_id', displayId.trim());
                            }}
                            onPdvPixCashierKeyChange={(cashierKey) => {
                                setPdvPixCashierKey(cashierKey);
                                localStorage.setItem('pdv_pix_cashier_key', cashierKey.trim() || 'caixa-01');
                            }}
                            onCreatePdvPixPayment={handleCreatePdvPixPayment}
                            onRefreshPdvPixPayment={handleRefreshPdvPixPayment}
                            onShowPdvPixOnDisplay={handleShowPdvPixOnDisplay}
                            onPrintPdvPixQr={handlePrintPdvPixQr}
                            onCancelPdvPixPayment={handleCancelPdvPixPayment}
                            onFinalAdjustmentDiscountChange={setFinalAdjustmentDiscount}
                            onApplyFinalPaymentAmount={handleApplyFinalPaymentAmount}
                        />
                    </div>

                    <div>
                        <FinalizeProgress
                            steps={finalizeSteps}
                            log={activeFinalizationLog}
                            onCopyLog={handleCopyFinalizationLog}
                            onDownloadLog={handleDownloadFinalizationLog}
                        />
                        <ReceiptPreview
                            customer={selectedCustomer}
                            items={cartItems}
                            deliveryType={deliveryType}
                            deliveryCostStore={deliveryCostStore}
                            deliveryCostCustomer={deliveryCostCustomer}
                            payments={payments}
                            promotionalDiscount={promotionalDiscount}
                            finalAdjustmentDiscount={appliedFinalAdjustmentDiscount}
                            hasPendingPixPayment={Boolean(pixPaymentPending)}
                            onFinalizeSale={handleFinalizeSale}
                            isFinalizing={isFinalizing}
                        />
                    </div>
                </div>
            </div>

            {/* Warranty Term Modal */}
            <WarrantyTermModal
                isOpen={showWarrantyModal}
                onClose={() => setShowWarrantyModal(false)}
                warrantyContents={warrantyContents}
                onGenerate={handleGenerateWarranty}
                warrantyTemplate={warrantyTemplate}
                warrantyTagDataList={warrantyTagDataList}
                onPrintReceipt={handlePrintReceiptFromModal}
            />

            {/* Sale Success Modal */}
            {showSuccessModal && lastSaleData && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full p-6 mx-4 animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                                lastSaleData.sale?.finalization_status === 'needs_review'
                                    ? 'bg-amber-50 text-amber-600'
                                    : 'bg-green-50 text-green-600'
                            }`}>
                                {lastSaleData.sale?.finalization_status === 'needs_review'
                                    ? <AlertTriangle size={40} />
                                    : <CheckCircle2 size={40} />}
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 mb-1">
                                {lastSaleData.sale?.finalization_status === 'needs_review'
                                    ? 'Venda registrada com erros para corrigir'
                                    : 'Venda registrada com sucesso'}
                            </h2>
                            <p className="text-sm text-slate-500 mb-6 font-mono text-center">Código: #{lastSaleId?.slice(0, 8).toUpperCase()}</p>

                            <div className="w-full space-y-3">
                                {lastSaleData.finalizationLog && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => handleCopyFinalizationLog(lastSaleData.finalizationLog)}
                                            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl transition-colors border border-slate-200"
                                        >
                                            <Copy size={16} />
                                            Copiar log
                                        </button>
                                        <button
                                            onClick={() => handleDownloadFinalizationLog(lastSaleData.finalizationLog)}
                                            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl transition-colors border border-slate-200"
                                        >
                                            <Download size={16} />
                                            Baixar TXT
                                        </button>
                                    </div>
                                )}
                                <button
                                    onClick={() => {
                                        handlePrintReceiptFromModal();
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl transition-colors"
                                >
                                    <Printer size={18} />
                                    Imprimir Comprovante
                                </button>

                                {lastSaleData.items.some((it: any) => it.serialized_unit?.unitId) && (
                                    <button
                                        onClick={() => {
                                            generateWarrantyTerm(lastSaleData.sale, lastSaleData.customer, lastSaleData.items);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-xl transition-colors border border-blue-100"
                                    >
                                        <FileText size={18} />
                                        Gerar Termo de Garantia
                                    </button>
                                )}

                                <button
                                    onClick={() => {
                                        setShowSuccessModal(false);
                                        navigate(`/admin/customers/${lastSaleData.customer.id}`);
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold rounded-xl transition-colors border border-purple-100"
                                >
                                    <User size={18} />
                                    Ver no Cadastro do Cliente
                                </button>

                                <button
                                    onClick={() => {
                                        setShowSuccessModal(false);
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors shadow-sm"
                                >
                                    <RotateCcw size={18} />
                                    Nova Venda
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
