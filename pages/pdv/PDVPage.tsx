import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, Ticket, X as XIcon } from 'lucide-react';
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
import { createSale } from '../../services/saleService';
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
import { productService } from '../../services/products';
import { warrantyTemplateService } from '../../services/warrantyTemplates';
import { teamService } from '../../services/team';
import { getEffectiveRetailPrice, normalizeCentValue } from '../../utils/promoPrice';
import { buildPdvProductName } from '../../utils/pdvProductDisplay';

interface Customer {
    id: string;
    name: string;
    cpf_cnpj?: string;
    email?: string;
    phone?: string;
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

    // Estado dos pagamentos
    const [payments, setPayments] = useState<PaymentMethod[]>([]);

    // Estado da entrega
    const [deliveryType, setDeliveryType] = useState<DeliveryType | undefined>();
    const [deliveryPersonId, setDeliveryPersonId] = useState<string | undefined>();
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

    // Estado do termo de garantia — N termos (1 por aparelho serializado)
    const [showWarrantyModal, setShowWarrantyModal] = useState(false);
    const [lastSaleId, setLastSaleId] = useState<string>('');
    const [lastSaleData, setLastSaleData] = useState<any>(null);
    const [warrantyContents, setWarrantyContents] = useState<string[]>([]);
    const [warrantyDeliveryType, setWarrantyDeliveryType] = useState<DeliveryTypeWarranty>('store_pickup');
    const [warrantyTemplate, setWarrantyTemplate] = useState('');
    const [warrantyTagDataList, setWarrantyTagDataList] = useState<Record<string, string>[]>([]);
    // Meta de cada termo (id pré-gerado p/ numero_documento + unit vinculada) — paralelo ao warrantyContents
    const [warrantyDocsMeta, setWarrantyDocsMeta] = useState<Array<{ id: string; serialized_unit_id: string }>>([]);

    // Entregadores reais do VPS (role = 'delivery')
    const [deliveryPersons, setDeliveryPersons] = React.useState<{ id: string; name: string }[]>([]);

    const loadDeliveryPersons = React.useCallback(() => {
        teamService.list({ role: 'delivery', is_active: true })
            .then(members => setDeliveryPersons(members.map(m => ({ id: m.id, name: m.name }))))
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
    };


    // Estado das taxas de pagamento
    const [paymentFees, setPaymentFees] = useState<any[]>([]);

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
    const totalBeforeFinalAdjustment = itemsTotal - giftDiscount - promotionalDiscount + deliveryCostCustomer + totalFees;
    const maxFinalAdjustmentDiscount = Math.max(0, totalBeforeFinalAdjustment);
    const appliedFinalAdjustmentDiscount = Math.min(finalAdjustmentDiscount, maxFinalAdjustmentDiscount);
    const total = Math.max(0, totalBeforeFinalAdjustment - appliedFinalAdjustmentDiscount);
    const totalPaid = calculateTotalPaid(payments);
    const remainingBalance = total - totalPaid;

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
        const unitPrice = getEffectiveRetailPrice(product);
        const unitCost = normalizeCentValue(product.price_cost);

        const newItem: SaleItem = {
            id: crypto.randomUUID(),
            product_id: product.id,
            product_name: buildPdvProductName(product.name, (product as any).specs),
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
        setDeliveryCostStore(costStore);
        setDeliveryCostCustomer(costCustomer);
    };

    // Handler de seleção de parcela
    const handleSelectInstallment = (installments: number, amount: number, feeAmount: number) => {
        const totalWithFee = amount + feeAmount;
        const newPayment: PaymentMethod = {
            method: 'credit',
            amount: totalWithFee, // Valor total que o cliente vai pagar (COM juros)
            installments: installments,
            fee_percentage: (feeAmount / amount) * 100,
            fee_amount: feeAmount,
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

    // Finalizar venda
    const handleFinalizeSale = async () => {
        if (!selectedCustomer) {
            toast.error('Selecione um cliente');
            return;
        }

        if (cartItems.length === 0) {
            toast.error('Adicione produtos ao carrinho');
            return;
        }

        const deliveryTotal = deliveryCostStore + deliveryCostCustomer;

        const saleInput: SaleInput = {
            customer_id: selectedCustomer.id,
            // seller_id: TODO - pegar do usuário logado
            items: cartItems,
            payment_methods: payments,
            notes: undefined,
            delivery_type: deliveryType,
            delivery_person_id: deliveryPersonId,
            delivery_cost_store: deliveryCostStore,
            delivery_cost_customer: deliveryCostCustomer,
            delivery_total: deliveryTotal,
            promotional_discount: promotionalDiscount + appliedFinalAdjustmentDiscount,
            referral_code: referralCode.trim() || undefined
        };

        try {
            const sale = await createSale(saleInput);
            // Registrar uso do cupom se houver
            if (appliedCoupon) {
                await applyCoupon(appliedCoupon.id);
                handleClearCoupon();
            }

            // Creditar Moedas do Vale pelo valor final pago
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

            toast.success('Venda finalizada com sucesso!', {
                description: `Venda #${sale.id.slice(0, 8)} criada`
            });

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
                items: cartItems
            });

            // Gerar termo de garantia
            await generateWarrantyTerm(sale, selectedCustomer, cartItems);

            // Limpar todo o PDV
            setCartItems([]);
            setSelectedCustomer(undefined);
            setPayments([]);
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
            toast.error('Erro ao finalizar venda. Verifique os dados e tente novamente.');
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
    const generateWarrantyTerm = async (sale: any, customer: Customer, items: SaleItem[]) => {
        try {
            const settings = await companySettingsService.get();
            if (!settings || !settings.warranty_template) {
                console.warn('Template de garantia não configurado');
                return;
            }

            const serializedItems = items.filter(i => (i as any).serialized_unit?.unitId);
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

        const serializedItems = (lastSaleData.items || []).filter((i: any) => i.serialized_unit?.unitId);
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
                        />

                        <ProductSearchSection onAddToCart={handleAddToCart} />

                        <CartItemsSection
                            items={cartItems}
                            warrantyOptions={warrantyOptions}
                            onUpdateQuantity={handleUpdateQuantity}
                            onRemoveItem={handleRemoveItem}
                            onUpdateWarranty={handleUpdateWarranty}
                            onUpdatePrice={handleUpdatePrice}
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

                        {/* Cupom de desconto */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
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
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-2">
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
                            onFinalAdjustmentDiscountChange={setFinalAdjustmentDiscount}
                            onApplyFinalPaymentAmount={handleApplyFinalPaymentAmount}
                        />
                    </div>

                    {/* Coluna Direita: Preview do Comprovante (50%) */}
                    <div>
                        <ReceiptPreview
                            customer={selectedCustomer}
                            items={cartItems}
                            deliveryType={deliveryType}
                            deliveryCostStore={deliveryCostStore}
                            deliveryCostCustomer={deliveryCostCustomer}
                            payments={payments}
                            promotionalDiscount={promotionalDiscount}
                            finalAdjustmentDiscount={appliedFinalAdjustmentDiscount}
                            onFinalizeSale={handleFinalizeSale}
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
        </div>
    );
}
