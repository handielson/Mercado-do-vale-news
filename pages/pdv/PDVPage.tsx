import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowLeft } from 'lucide-react';
import { Product } from '../../types/product';
import { SaleItem, PaymentMethod, SaleInput, DeliveryType } from '../../types/sale';
import { calculateSaleTotals, calculateTotalPaid, calculateDeliveryTotal } from '../../utils/saleCalculations';
import ProductSearchSection from '../../components/pdv/ProductSearchSection';
import CustomerSection from '../../components/pdv/CustomerSection';
import PaymentSection from '../../components/pdv/PaymentSection';
import DeliverySection from '../../components/pdv/DeliverySection';
import ReceiptPreview from '../../components/pdv/ReceiptPreview';
import InstallmentCalculator from '../../components/pdv/InstallmentCalculator';
import { createSale } from '../../services/saleService';
import { toast } from 'sonner';

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

    // Estado do desconto promocional
    const [promotionalDiscount, setPromotionalDiscount] = useState(0);

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

    // Calcular totais
    const { total: itemsTotal } = calculateSaleTotals(cartItems);

    // Calcular desconto de brindes (valor integral dos produtos marcados como brinde)
    const giftDiscount = cartItems.reduce((sum, item) => {
        if (item.is_gift) {
            return sum + (item.unit_price * item.quantity);
        }
        return sum;
    }, 0);

    // Calcular total de juros/taxas dos pagamentos
    const totalFees = payments.reduce((sum, p) => {
        const fee = (p.fee_amount || 0);
        return sum + fee;
    }, 0);

    // Total = Produtos - Brindes - Desconto Promocional + Entrega Cliente + Juros
    const total = itemsTotal - giftDiscount - promotionalDiscount + deliveryCostCustomer + totalFees;
    const totalPaid = calculateTotalPaid(payments);
    const remainingBalance = total - totalPaid;

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

            toast.success('Venda finalizada com sucesso!', {
                description: `Venda #${sale.id.slice(0, 8)} criada`
            });

            // Limpar tudo
            setCartItems([]);
            setSelectedCustomer(undefined);
            setPayments([]);
            setDeliveryType(undefined);
            setDeliveryPersonId(undefined);
            setDeliveryCostStore(0);
            setDeliveryCostCustomer(0);

            // TODO: Navegar para página de detalhes da venda
            // navigate(`/ admin / sales / ${ sale.id } `);
        } catch (error) {
            console.error('Erro ao finalizar venda:', error);
            toast.error('Erro ao finalizar venda. Verifique os dados e tente novamente.');
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
        </div>
    );
}
