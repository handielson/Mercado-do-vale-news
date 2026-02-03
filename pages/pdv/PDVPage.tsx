import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowLeft } from 'lucide-react';
import { Product } from '../../types/product';
import { SaleItem, PaymentMethod, SaleInput } from '../../types/sale';
import { calculateSaleTotals } from '../../utils/saleCalculations';
import ProductSearchSection from '../../components/pdv/ProductSearchSection';
import CartSection from '../../components/pdv/CartSection';
import CustomerSection from '../../components/pdv/CustomerSection';
import PaymentSection from '../../components/pdv/PaymentSection';
import SalesSummarySection from '../../components/pdv/SalesSummarySection';
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

    // Calcular totais
    const { total } = calculateSaleTotals(cartItems);

    // Adicionar produto ao carrinho
    const handleAddToCart = (product: Product, quantity: number) => {
        const existingItemIndex = cartItems.findIndex(item => item.product_id === product.id);

        if (existingItemIndex >= 0) {
            // Produto já existe, atualizar quantidade
            const newItems = [...cartItems];
            newItems[existingItemIndex].quantity += quantity;
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
                is_gift: product.is_gift || false
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

        const { subtotal, discount_total, total, cost_total, profit } = calculateSaleTotals(cartItems);

        const saleInput: SaleInput = {
            customer_id: selectedCustomer.id,
            // seller_id: TODO - pegar do usuário logado
            items: cartItems,
            payment_methods: payments,
            notes: undefined
        };

        try {
            // TODO: Implementar saleService.createSale(saleInput)
            console.log('Venda a ser criada:', saleInput);

            // Simulação
            await new Promise(resolve => setTimeout(resolve, 1000));

            toast.success('Venda finalizada com sucesso!', {
                description: `Total: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total / 100)}`
            });

            // Limpar tudo
            setCartItems([]);
            setSelectedCustomer(undefined);
            setPayments([]);

            // TODO: Navegar para página de detalhes da venda ou histórico
            // navigate('/admin/sales');
        } catch (error) {
            console.error('Erro ao finalizar venda:', error);
            toast.error('Erro ao finalizar venda');
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
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Coluna Esquerda: Busca e Carrinho */}
                    <div className="lg:col-span-2 space-y-6">
                        <ProductSearchSection onAddToCart={handleAddToCart} />
                        <CartSection
                            items={cartItems}
                            onUpdateQuantity={handleUpdateQuantity}
                            onRemoveItem={handleRemoveItem}
                            onClearCart={handleClearCart}
                        />
                    </div>

                    {/* Coluna Direita: Cliente, Pagamento e Resumo */}
                    <div className="space-y-6">
                        <CustomerSection
                            selectedCustomer={selectedCustomer}
                            onSelectCustomer={setSelectedCustomer}
                        />
                        <PaymentSection
                            total={total}
                            payments={payments}
                            onAddPayment={handleAddPayment}
                            onRemovePayment={handleRemovePayment}
                        />
                        <SalesSummarySection
                            items={cartItems}
                            customer={selectedCustomer}
                            payments={payments}
                            onFinalizeSale={handleFinalizeSale}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
