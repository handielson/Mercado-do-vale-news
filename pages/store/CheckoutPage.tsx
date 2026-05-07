/**
 * CheckoutPage — Dados do cliente + entrega + método de pagamento
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { shippingService } from '@/services/shippingService';
import { createOrder } from '@/services/orderService';
import { paymentIntegrationService } from '@/services/paymentIntegrationService';
import type { PaymentIntegration } from '@/types/paymentIntegration';
import { formatCurrency, calculateCartVolume } from '@/utils/saleCalculations';
import type { ShippingOption } from '@/types/shipping';
import type { OrderDeliveryType, OrderPaymentMethod, OrderShippingAddress, PaymentGateway } from '@/types/order';
import type { CardFormData } from '@/services/providers/mercadoPagoProvider';
import MercadoPagoCardBrick from '@/components/payment/MercadoPagoCardBrick';
import { MapPin, CreditCard, Truck, Package, ChevronRight, Loader2, User } from 'lucide-react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

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
    selected_payment: string; // 'pix', 'on_delivery' or gateway names ('mercado_pago' etc)
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
    selected_payment: 'pix',
};

export default function CheckoutPage() {
    const { items, subtotal, clear, isHydrated } = useCart();
    const { customer } = useSupabaseAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const state = location.state as {
        selectedWarranty?: any,
        warrantyPrice?: number,
        warrantyProductName?: string,
        warrantyProductId?: string,
        warrantyImageUrl?: string,
        referralCode?: string,
        referralName?: string,
        delivery?: { type: 'pickup' | 'delivery', shippingOption?: any },
    } || {};

    const [form, setForm] = useState<CheckoutForm>(() => {
        let base = INITIAL_FORM;
        const saved = sessionStorage.getItem('mv_checkout_form');
        if (saved) {
            try { base = JSON.parse(saved); } catch (e) { }
        }
        // delivery_type do carrinho tem prioridade sobre sessionStorage
        if (state.delivery?.type) {
            base = { ...base, delivery_type: state.delivery.type };
        }
        return base;
    });

    useEffect(() => {
        sessionStorage.setItem('mv_checkout_form', JSON.stringify(form));
    }, [form]);
    const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
    const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(
        state.delivery?.type === 'delivery' && state.delivery?.shippingOption
            ? state.delivery.shippingOption
            : null
    );
    const [loadingShipping, setLoadingShipping] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [paymentRejected, setPaymentRejected] = useState<string | null>(null); // mensagem de rejeição
    const [activeGateways, setActiveGateways] = useState<PaymentIntegration[]>([]);
    const isRedirectingToGateway = useRef(false);

    useEffect(() => {
        paymentIntegrationService.getIntegrations()
            .then(data => setActiveGateways(data.filter(g => g.is_active)))
            .catch(console.error);
    }, []);

    // Pré-preenche form com dados do cliente logado
    useEffect(() => {
        if (customer) {
            setForm(prev => ({
                ...prev,
                customer_name: customer.name || prev.customer_name,
                customer_phone: customer.phone || prev.customer_phone,
                customer_email: customer.email || prev.customer_email,
            }));
        }
    }, [customer?.id]);

    useEffect(() => {
        if (isHydrated && items.length === 0 && !submitting && !isRedirectingToGateway.current) {
            navigate('/carrinho');
        }
    }, [isHydrated, items.length, navigate, submitting]);

    const set = (field: keyof CheckoutForm) => (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => setForm(prev => ({ ...prev, [field]: e.target.value }));

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, ''); // Remove on-digits
        if (val.length > 11) val = val.slice(0, 11); // Max 11 digits

        let masked = val;
        if (val.length > 2) {
            masked = `(${val.substring(0, 2)}) ${val.substring(2)}`;
            if (val.length > 7) {
                masked = `(${val.substring(0, 2)}) ${val.substring(2, 7)}-${val.substring(7)}`;
            }
        }
        setForm(prev => ({ ...prev, customer_phone: masked }));
    };

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
            const res = await shippingService.calculate({
                to_cep: cep,
                order_value: subtotal,
                ...calculateCartVolume(items)
            });
            setShippingOptions(res.options);
        } catch {
            setError('Não foi possível calcular o frete. Tente novamente.');
        } finally {
            setLoadingShipping(false);
        }
    };

    // selectedShipping.price é em reais; subtotal em centavos → convertemos para centavos
    const shippingCost = Math.round((selectedShipping?.price ?? 0) * 100);
    const total = subtotal + shippingCost;
    const mpGateway = activeGateways.find(g => g.gateway_name === 'mercado_pago');
    const isMpCardSelected = form.selected_payment === 'mercado_pago_pro';

    // Submissao normal (PIX, entrega, etc.)
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Dados do cliente já vêm do useEffect acima
        if (!form.customer_name.trim()) {
            setError('Não foi possível obter seus dados. Faça login novamente.');
            return;
        }
        if (form.delivery_type === 'delivery' && !selectedShipping) {
            setError('Selecione uma opção de entrega.');
            return;
        }

        // Se cartão MP selecionado, o submit é feito pelo Brick (não por aqui)
        if (isMpCardSelected) return;

        await submitOrder();
    };

    // Brick callback: recebe o token do cartão tokenizado
    const handleCardBrickSubmit = async (cardFormData: CardFormData) => {
        setError('');
        // Dados do cliente já vêm do useEffect
        if (!form.customer_name.trim()) {
            setError('Não foi possível obter seus dados. Faça login novamente.');
            return;
        }
        if (form.delivery_type === 'delivery' && !selectedShipping) {
            setError('Selecione uma opção de entrega.');
            return;
        }
        await submitOrder(cardFormData);
    };

    const submitOrder = async (cardFormData?: CardFormData) => {
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

            const isGateway = form.selected_payment.includes('_pix') || form.selected_payment.includes('_pro');
            let gatewayToSave: PaymentGateway | undefined;
            let paymentMethodToSave: OrderPaymentMethod = form.selected_payment as OrderPaymentMethod;

            if (isGateway) {
                if (form.selected_payment.startsWith('mercado_pago')) {
                    gatewayToSave = 'mercado_pago';
                    paymentMethodToSave = form.selected_payment === 'mercado_pago_pro' ? 'credit_card' : 'pix';
                }
            }

            const productItems = items.map(i => ({
                product_id: i.product.id,
                product_name: i.product.name,
                product_sku: i.product.sku || undefined,
                product_image_url: i.product.images?.[0] || undefined,
                product_color: i.product.specs?.color || i.product.specs?.Cor || undefined,
                quantity: i.quantity,
                unit_price: i.unit_price,
                subtotal: i.unit_price * i.quantity,
            }));

            // Utilizamos os dados precisos do produto salvos no sessionStorage ou passados via state.
            const savedWarrantyRaw = sessionStorage.getItem('mv_cart_warranty');
            const savedWarranty = savedWarrantyRaw ? JSON.parse(savedWarrantyRaw) : state.selectedWarranty;

            const wProductId = sessionStorage.getItem('mv_cart_warrantyProductId') || state.warrantyProductId || items[0]?.product.id || '';
            const wProductName = sessionStorage.getItem('mv_cart_warrantyProductName') || state.warrantyProductName || items[0]?.product.name || 'Produto';
            const wProductImageUrl = sessionStorage.getItem('mv_cart_warrantyImageUrl') || state.warrantyImageUrl || items[0]?.product.images?.[0] || undefined;

            const rawPrice = sessionStorage.getItem('mv_cart_warrantyPrice');
            const sessionPrice = rawPrice ? parseInt(rawPrice, 10) : 0;
            const wPrice = sessionPrice > 0 ? sessionPrice : (state.warrantyPrice || 0);

            const warrantyItem = savedWarranty && wPrice > 0 ? [{
                product_id: wProductId,
                product_name: `Garantia Estendida +${savedWarranty.months}m — ${wProductName}`,
                product_image_url: wProductImageUrl,
                quantity: 1,
                unit_price: wPrice,
                subtotal: state.warrantyPrice || 0,
            }] : [];

            const order = await createOrder({
                customer_id: customer?.id || undefined,
                customer_name: form.customer_name,
                customer_phone: form.customer_phone,
                customer_email: form.customer_email || undefined,
                customer_document: customer?.cpf_cnpj || undefined,
                items: [...productItems, ...warrantyItem],
                payment_method: paymentMethodToSave,
                payment_gateway: gatewayToSave,
                delivery_type: form.delivery_type,
                shipping_address: shippingAddress,
                shipping_cost: shippingCost,
                shipping_origin_cep: selectedShipping?.origin_cep || undefined,
                shipping_origin_label: selectedShipping?.origin_label || undefined,
                referral_code: state.referralCode || undefined,
                referral_name: state.referralName || undefined,
                notes: form.complement || undefined,
                // Token do Brick para checkout transparente (se cartão MP)
                ...(cardFormData ? { card_form_data: cardFormData } : {}),
            } as any);


            // Se tem URL de checkout PRO (fallback redirect), redireciona
            if (order.gateway_payment_url) {
                isRedirectingToGateway.current = true;
                clear();
                sessionStorage.removeItem('mv_checkout_form');
                window.location.href = order.gateway_payment_url;
                return;
            }
            clear();
            sessionStorage.removeItem('mv_checkout_form');
            // Passa dados relevantes via state para a confirmação
            navigate(`/pedido/${order.id}/confirmacao`, {
                state: {
                    pix_data: (order as any).gateway_pix_data,
                    payment_status: (order as any).gateway_payment_status,
                }
            });
        } catch (err: any) {
            const msg = err.message || '';
            // Rejeições de cartão têm tratamento visual separado
            if (msg.toLowerCase().includes('recusado') || msg.toLowerCase().includes('pagamento')) {
                setPaymentRejected(msg);
            } else {
                setError(msg || 'Erro ao criar pedido. Tente novamente.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    // Tela visual de rejeição de pagamento
    if (paymentRejected) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                <div className="max-w-sm w-full text-center">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
                        <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Pagamento não aprovado</h2>
                    <p className="text-gray-500 text-sm mb-6">{paymentRejected}</p>
                    <div className="space-y-3">
                        <button
                            onClick={() => setPaymentRejected(null)}
                            className="w-full bg-blue-600 text-white font-medium py-3 rounded-xl hover:bg-blue-700 transition-colors"
                        >
                            Tentar com outro cartão
                        </button>
                        <button
                            onClick={() => { setPaymentRejected(null); setForm(prev => ({ ...prev, selected_payment: 'mercado_pago_pix' })); }}
                            className="w-full border border-gray-200 text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            Pagar com PIX
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-2xl mx-auto px-4 py-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">Finalizar compra</h1>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Cliente logado */}
                    <section className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">{customer?.name || form.customer_name || 'Cliente'}</p>
                            <p className="text-xs text-gray-400 truncate">{customer?.email || form.customer_email}</p>
                        </div>
                        <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full whitespace-nowrap">✓ Logado</span>
                    </section>



                    <section className="bg-white rounded-2xl p-5 shadow-sm">
                        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-blue-600" />
                            Pagamento
                        </h2>
                        <div className="space-y-2">
                            {/* Gateways Online (Se houver) */}
                            {activeGateways.map(gateway => {
                                const isMp = gateway.gateway_name === 'mercado_pago';
                                return (
                                    <div key={gateway.gateway_name} className="space-y-2">
                                        <label
                                            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.selected_payment === `${gateway.gateway_name}_pix`
                                                ? 'border-blue-600 bg-blue-50'
                                                : 'border-gray-200 hover:border-blue-300'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="payment"
                                                value={`${gateway.gateway_name}_pix`}
                                                checked={form.selected_payment === `${gateway.gateway_name}_pix`}
                                                onChange={() => setForm(prev => ({ ...prev, selected_payment: `${gateway.gateway_name}_pix` }))}
                                                className="accent-blue-600"
                                            />
                                            <div>
                                                <p className="font-semibold text-sm text-gray-800">🔵 Pagar com PIX ({isMp ? 'Mercado Pago' : gateway.gateway_name})</p>
                                                <p className="text-xs text-gray-500">Aprovação imediata na tela</p>
                                            </div>
                                        </label>

                                        {isMp && (
                                            <>
                                                <label
                                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.selected_payment === 'mercado_pago_pro'
                                                        ? 'border-blue-600 bg-blue-50'
                                                        : 'border-gray-200 hover:border-blue-300'
                                                        }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="payment"
                                                        value="mercado_pago_pro"
                                                        checked={form.selected_payment === 'mercado_pago_pro'}
                                                        onChange={() => setForm(prev => ({ ...prev, selected_payment: 'mercado_pago_pro' }))}
                                                        className="accent-blue-600"
                                                    />
                                                    <div>
                                                        <p className="font-semibold text-sm text-gray-800">💳 Cartão de Crédito / Parcelamento</p>
                                                        <p className="text-xs text-gray-500">Formulário seguro direto nesta página (Mercado Pago)</p>
                                                    </div>
                                                </label>
                                                {/* Formulário do Brick embutido — aparece ao selecionar cartão */}
                                                {isMpCardSelected && mpGateway?.public_key && (
                                                    <div className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50">
                                                        <p className="text-xs text-blue-600 font-medium mb-3 flex items-center gap-1">
                                                            🔒 Formulário protegido pelo Mercado Pago
                                                        </p>
                                                        <MercadoPagoCardBrick
                                                            publicKey={mpGateway.public_key}
                                                            amount={(total + (state.warrantyPrice || 0)) / 100}
                                                            customerEmail={form.customer_email}
                                                            onSubmit={handleCardBrickSubmit}
                                                            onError={(err) => setError('Erro no formulário de pagamento. Tente novamente.')}
                                                            submitting={submitting}
                                                        />
                                                    </div>
                                                )}
                                                {isMpCardSelected && !mpGateway?.public_key && (
                                                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-xs text-yellow-700">
                                                        ⚠️ Public Key do Mercado Pago não configurada no painel admin.
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Fallback de métodos offline se não tiver gateway online, ou adicionar Pagar na Entrega sempre */}
                            {activeGateways.length === 0 && [
                                { value: 'pix', label: '🔵 PIX (Transferência Manual)', desc: 'Chave fornecida ao final' },
                                { value: 'credit_card', label: '💳 Cartão de Crédito', desc: 'Até 12x (Máquina)' },
                                { value: 'debit_card', label: '💳 Cartão de Débito', desc: 'À vista' },
                            ].map(opt => (
                                <label
                                    key={opt.value}
                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.selected_payment === opt.value
                                        ? 'border-blue-600 bg-blue-50'
                                        : 'border-gray-200 hover:border-blue-300'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="payment"
                                        value={opt.value}
                                        checked={form.selected_payment === opt.value}
                                        onChange={() => setForm(prev => ({ ...prev, selected_payment: opt.value }))}
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
                        {state.warrantyPrice && state.warrantyPrice > 0 ? (
                            <div className="flex justify-between text-gray-500 text-sm">
                                <span>Garantia (+{state.selectedWarranty?.months}m)</span>
                                <span>+ {formatCurrency(state.warrantyPrice)}</span>
                            </div>
                        ) : null}
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
                            <span className="text-blue-600">{formatCurrency(total + (state.warrantyPrice || 0))}</span>
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

                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="w-full text-blue-600 text-sm font-medium py-2 hover:underline transition-colors"
                    >
                        ← Continuar comprando
                    </button>
                </form>
            </div>
        </div >
    );
}
