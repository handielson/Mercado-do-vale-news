/**
 * CheckoutPage — Dados do cliente + entrega + método de pagamento
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { shippingService } from '@/services/shippingService';
import { createOrder } from '@/services/orderService';
import { formatCurrency } from '@/utils/saleCalculations';
import type { ShippingOption } from '@/types/shipping';
import type { OrderDeliveryType, OrderPaymentMethod, OrderShippingAddress } from '@/types/order';
import { MapPin, CreditCard, Truck, Package, ChevronRight, Loader2 } from 'lucide-react';

interface CheckoutForm {
    customer_name: string;
    customer_phone: string;
    customer_email: string;
    delivery_type: OrderDeliveryType;
    cep: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    payment_method: OrderPaymentMethod;
}

const INITIAL_FORM: CheckoutForm = {
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    delivery_type: 'pickup',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    payment_method: 'pix',
};

export default function CheckoutPage() {
    const { items, subtotal, clear } = useCart();
    const navigate = useNavigate();

    const [form, setForm] = useState<CheckoutForm>(INITIAL_FORM);
    const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
    const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
    const [loadingShipping, setLoadingShipping] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (items.length === 0) {
        navigate('/carrinho');
        return null;
    }

    const set = (field: keyof CheckoutForm) => (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => setForm(prev => ({ ...prev, [field]: e.target.value }));

    // Busca CEP e calcula frete
    const handleCepBlur = async () => {
        const cep = form.cep.replace(/\D/g, '');
        if (cep.length !== 8) return;

        setLoadingShipping(true);
        setShippingOptions([]);
        setSelectedShipping(null);

        try {
            // Endereço via ViaCEP
            const viaCep = await fetch(`https://viacep.com.br/ws/${cep}/json/`).then(r => r.json());
            if (!viaCep.erro) {
                setForm(prev => ({
                    ...prev,
                    street: viaCep.logradouro || prev.street,
                    neighborhood: viaCep.bairro || prev.neighborhood,
                    city: viaCep.localidade || prev.city,
                    state: viaCep.uf || prev.state,
                }));
            }

            // Calcula opções de frete
            const options = await shippingService.calculate({
                to_cep: cep,
                order_value: subtotal,
            });
            setShippingOptions(options);
        } catch {
            setError('Não foi possível calcular o frete. Tente novamente.');
        } finally {
            setLoadingShipping(false);
        }
    };

    const shippingCost = selectedShipping?.price ?? 0;
    const total = subtotal + shippingCost;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!form.customer_name.trim() || !form.customer_phone.trim()) {
            setError('Nome e telefone são obrigatórios.');
            return;
        }
        if (form.delivery_type === 'delivery' && !selectedShipping) {
            setError('Selecione uma opção de entrega.');
            return;
        }

        setSubmitting(true);
        try {
            const shippingAddress: OrderShippingAddress | undefined =
                form.delivery_type === 'delivery'
                    ? {
                        cep: form.cep,
                        street: form.street,
                        number: form.number,
                        complement: form.complement,
                        neighborhood: form.neighborhood,
                        city: form.city,
                        state: form.state,
                    }
                    : undefined;

            const order = await createOrder({
                customer_name: form.customer_name,
                customer_phone: form.customer_phone,
                customer_email: form.customer_email || undefined,
                items: items.map(i => ({
                    product_id: i.product.id,
                    product_name: i.product.name,
                    product_sku: i.product.sku || undefined,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                    subtotal: i.unit_price * i.quantity,
                })),
                payment_method: form.payment_method,
                delivery_type: form.delivery_type,
                shipping_address: shippingAddress,
                shipping_cost: shippingCost,
            });

            clear();
            navigate(`/pedido/${order.id}/confirmacao`);
        } catch (err: any) {
            setError(err.message || 'Erro ao criar pedido. Tente novamente.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-2xl mx-auto px-4 py-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">Finalizar compra</h1>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Dados pessoais */}
                    <section className="bg-white rounded-2xl p-5 shadow-sm">
                        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <ChevronRight className="w-4 h-4 text-blue-600" />
                            Seus dados
                        </h2>
                        <div className="space-y-3">
                            <input
                                required
                                placeholder="Nome completo *"
                                value={form.customer_name}
                                onChange={set('customer_name')}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                                required
                                placeholder="WhatsApp / Telefone *"
                                value={form.customer_phone}
                                onChange={set('customer_phone')}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                                placeholder="E-mail (opcional)"
                                type="email"
                                value={form.customer_email}
                                onChange={set('customer_email')}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </section>

                    {/* Entrega */}
                    <section className="bg-white rounded-2xl p-5 shadow-sm">
                        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <Truck className="w-4 h-4 text-blue-600" />
                            Entrega
                        </h2>
                        <div className="flex gap-3 mb-4">
                            {(['pickup', 'delivery'] as OrderDeliveryType[]).map(type => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => {
                                        setForm(prev => ({ ...prev, delivery_type: type }));
                                        setSelectedShipping(null);
                                    }}
                                    className={`flex-1 py-3 rounded-xl border-2 font-semibold transition-all flex items-center justify-center gap-2 ${form.delivery_type === type
                                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                                        : 'border-gray-200 text-gray-500'
                                        }`}
                                >
                                    {type === 'pickup' ? <Package className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                                    {type === 'pickup' ? 'Retirada' : 'Entrega'}
                                </button>
                            ))}
                        </div>

                        {form.delivery_type === 'delivery' && (
                            <div className="space-y-3">
                                <input
                                    placeholder="CEP *"
                                    value={form.cep}
                                    onChange={set('cep')}
                                    onBlur={handleCepBlur}
                                    maxLength={9}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                {loadingShipping && (
                                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Calculando frete...
                                    </div>
                                )}
                                {form.street && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            placeholder="Rua"
                                            value={form.street}
                                            onChange={set('street')}
                                            className="border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 col-span-2"
                                        />
                                        <input
                                            placeholder="Número"
                                            value={form.number}
                                            onChange={set('number')}
                                            className="border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <input
                                            placeholder="Complemento"
                                            value={form.complement}
                                            onChange={set('complement')}
                                            className="border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <input
                                            placeholder="Bairro"
                                            value={form.neighborhood}
                                            onChange={set('neighborhood')}
                                            className="border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <input
                                            placeholder="Cidade"
                                            value={form.city}
                                            onChange={set('city')}
                                            className="border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                )}

                                {/* Opções de frete */}
                                {shippingOptions.length > 0 && (
                                    <div className="space-y-2 mt-2">
                                        <p className="text-sm font-medium text-gray-700">Escolha o frete:</p>
                                        {shippingOptions.map(opt => (
                                            <label
                                                key={opt.id}
                                                className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedShipping?.id === opt.id
                                                    ? 'border-blue-600 bg-blue-50'
                                                    : 'border-gray-200 hover:border-blue-300'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="radio"
                                                        name="shipping"
                                                        checked={selectedShipping?.id === opt.id}
                                                        onChange={() => setSelectedShipping(opt)}
                                                        className="accent-blue-600"
                                                    />
                                                    <div>
                                                        <p className="font-semibold text-sm text-gray-800">{opt.name}</p>
                                                        <p className="text-xs text-gray-500">{opt.daysLabel}</p>
                                                    </div>
                                                </div>
                                                <span className="font-bold text-green-600">
                                                    {opt.isFree ? 'Grátis' : formatCurrency(opt.price)}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {/* Pagamento */}
                    <section className="bg-white rounded-2xl p-5 shadow-sm">
                        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-blue-600" />
                            Pagamento
                        </h2>
                        <div className="space-y-2">
                            {[
                                { value: 'pix', label: '🔵 PIX (instantâneo)', desc: 'Aprovação imediata' },
                                { value: 'credit_card', label: '💳 Cartão de Crédito', desc: 'Até 12x' },
                                { value: 'debit_card', label: '💳 Cartão de Débito', desc: 'À vista' },
                                { value: 'on_delivery', label: '💵 Pagar na entrega/retirada', desc: 'Dinheiro ou cartão' },
                            ].map(opt => (
                                <label
                                    key={opt.value}
                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.payment_method === opt.value
                                        ? 'border-blue-600 bg-blue-50'
                                        : 'border-gray-200 hover:border-blue-300'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="payment"
                                        value={opt.value}
                                        checked={form.payment_method === opt.value as OrderPaymentMethod}
                                        onChange={() => setForm(prev => ({ ...prev, payment_method: opt.value as OrderPaymentMethod }))}
                                        className="accent-blue-600"
                                    />
                                    <div>
                                        <p className="font-semibold text-sm text-gray-800">{opt.label}</p>
                                        <p className="text-xs text-gray-500">{opt.desc}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* Resumo */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm space-y-2">
                        <div className="flex justify-between text-gray-600 text-sm">
                            <span>Subtotal ({items.length} {items.length === 1 ? 'item' : 'itens'})</span>
                            <span>{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600 text-sm">
                            <span>Frete</span>
                            <span className={shippingCost === 0 && form.delivery_type === 'delivery' ? 'text-gray-400' : 'text-green-600 font-medium'}>
                                {form.delivery_type === 'pickup'
                                    ? '— (retirada)'
                                    : shippingCost === 0
                                        ? 'Selecione o CEP'
                                        : formatCurrency(shippingCost)
                                }
                            </span>
                        </div>
                        <div className="border-t pt-2 flex justify-between font-bold text-lg text-gray-900">
                            <span>Total</span>
                            <span className="text-blue-600">{formatCurrency(total)}</span>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-60"
                    >
                        {submitting ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Processando...</>
                        ) : (
                            <>Confirmar pedido<ChevronRight className="w-5 h-5" /></>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
