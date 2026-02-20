import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, Ticket, X as XIcon } from 'lucide-react';
import { Product } from '../../types/product';
import { SaleItem, PaymentMethod, SaleInput, DeliveryType } from '../../types/sale';
import { calculateSaleTotals, calculateTotalPaid } from '../../utils/saleCalculations';
import ProductSearchSection from '../../components/pdv/ProductSearchSection';
import CustomerSection from '../../components/pdv/CustomerSection';
import PaymentSection from '../../components/pdv/PaymentSection';
import DeliverySection from '../../components/pdv/DeliverySection';
import ReceiptPreview from '../../components/pdv/ReceiptPreview';
import InstallmentCalculator from '../../components/pdv/InstallmentCalculator';
import { WarrantyTermModal } from '../../components/warranty/WarrantyTermModal';
import { createSale } from '../../services/saleService';
import { warrantyDocumentService } from '../../services/warrantyDocumentService';
import { companySettingsService } from '../../services/companySettingsService';
import { replaceWarrantyTags, getWarrantyDeclaration, formatWarrantyDate, formatWarrantyPhone, formatWarrantyCpfCnpj } from '../../utils/warrantyTagReplacement';
import { WarrantyTagData, DeliveryTypeWarranty } from '../../types/warrantyDocument';
import { toast } from 'sonner';
import { validateCoupon, applyCoupon, type Coupon } from '../../services/couponService';
import { earnCoinsForPurchase } from '../../services/cashbackService';

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

    // Estado do cupom
    const [couponCode, setCouponCode] = useState('');
    const [couponLoading, setCouponLoading] = useState(false);
    const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
    const [couponError, setCouponError] = useState<string | null>(null);

    // Estado do termo de garantia
    const [showWarrantyModal, setShowWarrantyModal] = useState(false);
    const [lastSaleId, setLastSaleId] = useState<string>('');
    const [lastSaleData, setLastSaleData] = useState<any>(null);
    const [warrantyContent, setWarrantyContent] = useState('');
    const [warrantyDeliveryType, setWarrantyDeliveryType] = useState<DeliveryTypeWarranty>('store_pickup');

    // Mock de entregadores (TODO: buscar do Supabase)
    const deliveryPersons = [
        { id: '1', name: 'João Silva' },
        { id: '2', name: 'Maria Santos' },
        { id: '3', name: 'Pedro Oliveira' }
    ];


    // Estado das taxas de pagamento
    const [paymentFees, setPaymentFees] = useState<any[]>([]);

    // Buscar taxas de pagamento do Supabase
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
    const total = itemsTotal - giftDiscount - promotionalDiscount + deliveryCostCustomer + totalFees;
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
    const handleAddToCart = (product: Product, quantity: number) => {
        const existingItemIndex = cartItems.findIndex(item => item.product_id === product.id);

        if (existingItemIndex >= 0) {
            // Produto já existe, atualizar quantidade
            const newItems = [...cartItems];
            const newQuantity = newItems[existingItemIndex].quantity + quantity;

            // Validar estoque
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
        } else {
            // Novo produto
            const newItem: SaleItem = {
                id: crypto.randomUUID(), // ID temporário para o frontend
                product_id: product.id,
                product_name: product.name,
                product_sku: product.sku,
                quantity,
                unit_price: product.price_retail, // Preço varejo em centavos
                unit_cost: product.price_cost, // Custo em centavos
                discount: product.is_gift ? product.price_retail : 0, // Desconto integral para brindes
                subtotal: product.price_retail * quantity,
                total: product.is_gift ? 0 : product.price_retail * quantity,
                is_gift: product.is_gift || false,
                // Controle de estoque
                track_inventory: product.track_inventory || false,
                stock_quantity: product.stock_quantity
            };
            setCartItems([...cartItems, newItem]);
        }
    };

    // Atualizar quantidade de item
    const handleUpdateQuantity = (itemId: string, quantity: number) => {
        if (quantity < 1) return;

        const newItems = cartItems.map(item => {
            if (item.id === itemId) {
                const subtotal = item.unit_price * quantity;
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

    // Remover item do carrinho
    const handleRemoveItem = (itemId: string) => {
        setCartItems(cartItems.filter(item => item.id !== itemId));
        toast.info('Item removido do carrinho');
    };

    // Limpar carrinho
    const handleClearCart = () => {
        if (window.confirm('Deseja realmente limpar o carrinho?')) {
            setCartItems([]);
            setPayments([]);
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
        setPayments([...payments, newPayment]);
        toast.success(`Pagamento de ${installments}x adicionado`);
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
            promotional_discount: promotionalDiscount
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
                const totals = calculateSaleTotals(cartItems, promotionalDiscount);
                const couponDiscount = appliedCoupon
                    ? (totals.subtotal * ((appliedCoupon as any).discount_percent ?? 0)) / 100
                    : 0;
                const finalPaid = Math.max(0, totals.subtotal - couponDiscount + deliveryCostCustomer);
                const coinsEarned = await earnCoinsForPurchase(selectedCustomer.id, finalPaid, sale.id);
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


            // Salvar dados para geração do termo
            setLastSaleId(sale.id);
            setLastSaleData({
                sale,
                customer: selectedCustomer,
                items: cartItems
            });

            // Gerar termo de garantia
            await generateWarrantyTerm(sale, selectedCustomer, cartItems);

            // Limpar carrinho
            setCartItems([]);
            setSelectedCustomer(undefined);
            setPayments([]);
            setDeliveryType(undefined);
            setDeliveryPersonId(undefined);
            setDeliveryCostStore(0);
            setDeliveryCostCustomer(0);
        } catch (error) {
            console.error('Erro ao finalizar venda:', error);
            toast.error('Erro ao finalizar venda. Verifique os dados e tente novamente.');
        }
    };

    // Gerar termo de garantia
    const generateWarrantyTerm = async (sale: any, customer: Customer, items: SaleItem[]) => {
        try {
            // Buscar configurações da empresa
            const settings = await companySettingsService.get();

            if (!settings || !settings.warranty_template) {
                console.warn('Template de garantia não configurado');
                return;
            }

            // Pegar primeiro produto (ou concatenar se múltiplos)
            const firstItem = items[0];

            // Preparar dados para substituição de tags
            const tagData: WarrantyTagData = {
                // Empresa
                nome_loja: settings.company_name || '',
                endereco: settings.address || '',
                telefone: formatWarrantyPhone(settings.phone || ''),
                email: settings.email || '',
                cnpj: formatWarrantyCpfCnpj(settings.cnpj || ''),
                logo: settings.receipt_logo_url || '',

                // Cliente
                nome_cliente: customer.name,
                cpf_cliente: formatWarrantyCpfCnpj(customer.cpf_cnpj || ''),
                telefone_cliente: formatWarrantyPhone(customer.phone || ''),
                email_cliente: customer.email || '',

                // Venda
                numero_venda: sale.id.slice(0, 8),
                data_compra: formatWarrantyDate(new Date()),

                // Produto (primeiro item)
                produto: firstItem.product_name,
                marca: '', // TODO: buscar do produto
                modelo: '',
                cor: '',
                ram: '',
                memoria: '',
                imei1: '',
                imei2: '',

                // Garantia
                dias_garantia: '90', // TODO: calcular baseado no produto
                tipo_garantia: 'Garantia Legal',

                // Declaração (será atualizada quando usuário selecionar tipo)
                declaracao_recebimento: getWarrantyDeclaration(
                    deliveryType === 'delivery' ? 'delivery' : 'store_pickup'
                )
            };

            // Substituir tags no template
            const content = replaceWarrantyTags(settings.warranty_template, tagData);

            setWarrantyContent(content);
            setWarrantyDeliveryType(deliveryType === 'delivery' ? 'delivery' : 'store_pickup');
            setShowWarrantyModal(true);
        } catch (error) {
            console.error('Erro ao gerar termo de garantia:', error);
            toast.error('Erro ao gerar termo de garantia');
        }
    };

    // Atualizar tipo de entrega do termo
    const handleWarrantyDeliveryTypeChange = async (type: DeliveryTypeWarranty) => {
        setWarrantyDeliveryType(type);

        // Regenerar termo com nova declaração
        if (lastSaleData) {
            const settings = await companySettingsService.get();
            if (!settings || !settings.warranty_template) return;

            const firstItem = lastSaleData.items[0];
            const tagData: WarrantyTagData = {
                nome_loja: settings.company_name || '',
                endereco: settings.address || '',
                telefone: formatWarrantyPhone(settings.phone || ''),
                email: settings.email || '',
                cnpj: formatWarrantyCpfCnpj(settings.cnpj || ''),
                logo: settings.receipt_logo_url || '',
                nome_cliente: lastSaleData.customer.name,
                cpf_cliente: formatWarrantyCpfCnpj(lastSaleData.customer.cpf_cnpj || ''),
                telefone_cliente: formatWarrantyPhone(lastSaleData.customer.phone || ''),
                email_cliente: lastSaleData.customer.email || '',
                numero_venda: lastSaleData.sale.id.slice(0, 8),
                data_compra: formatWarrantyDate(new Date()),
                produto: firstItem.product_name,
                marca: '',
                modelo: '',
                cor: '',
                ram: '',
                memoria: '',
                imei1: '',
                imei2: '',
                dias_garantia: '90',
                tipo_garantia: 'Garantia Legal',
                declaracao_recebimento: getWarrantyDeclaration(type)
            };

            const content = replaceWarrantyTags(settings.warranty_template, tagData);
            setWarrantyContent(content);
        }
    };

    // Salvar termo de garantia
    const handleGenerateWarranty = async (signature: string) => {
        if (!lastSaleData) return;

        try {
            await warrantyDocumentService.create({
                sale_id: lastSaleId,
                customer_id: lastSaleData.customer.id,
                delivery_type: warrantyDeliveryType,
                customer_signature: signature,
                warranty_content: warrantyContent
            });

            toast.success('Termo de garantia gerado com sucesso!');
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

                        <DeliverySection
                            deliveryType={deliveryType}
                            deliveryPersonId={deliveryPersonId}
                            deliveryCostStore={deliveryCostStore}
                            deliveryCostCustomer={deliveryCostCustomer}
                            deliveryPersons={deliveryPersons}
                            onDeliveryChange={handleDeliveryChange}
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

                        <PaymentSection
                            total={total}
                            payments={payments}
                            onAddPayment={handleAddPayment}
                            onRemovePayment={handleRemovePayment}
                            paymentFees={paymentFees}
                            onSelectInstallment={handleSelectInstallment}
                            promotionalDiscount={promotionalDiscount}
                            onPromotionalDiscountChange={setPromotionalDiscount}
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
                            onFinalizeSale={handleFinalizeSale}
                        />
                    </div>
                </div>
            </div>

            {/* Warranty Term Modal */}
            <WarrantyTermModal
                isOpen={showWarrantyModal}
                onClose={() => setShowWarrantyModal(false)}
                warrantyContent={warrantyContent}
                deliveryType={warrantyDeliveryType}
                onDeliveryTypeChange={handleWarrantyDeliveryTypeChange}
                onGenerate={handleGenerateWarranty}
            />
        </div>
    );
}
