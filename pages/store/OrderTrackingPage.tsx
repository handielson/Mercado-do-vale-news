/**
 * OrderTrackingPage — Rastreamento público de pedido por ID
 * Acessível sem login via /pedido/:id
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getOrderById } from '@/services/orderService';
import type { OrderWithItems } from '@/types/order';
import { formatCurrency } from '@/utils/saleCalculations';
import {
    Package, CheckCircle, Truck, MapPin, Clock,
    XCircle, AlertCircle, Loader2, MessageCircle
} from 'lucide-react';

const STATUS_CONFIG: Record<string, {
    label: string;
    icon: typeof Package;
    color: string;
    bg: string;
    description: string;
}> = {
    pending: {
        label: 'Aguardando confirmação',
        icon: Clock,
        color: 'text-yellow-600',
        bg: 'bg-yellow-100',
        description: 'Seu pedido foi recebido e está aguardando confirmação de pagamento.',
    },
    awaiting_payment: {
        label: 'Aguardando pagamento',
        icon: AlertCircle,
        color: 'text-orange-600',
        bg: 'bg-orange-100',
        description: 'Finalize o pagamento para confirmarmos seu pedido.',
    },
    paid: {
        label: 'Pagamento confirmado',
        icon: CheckCircle,
        color: 'text-green-600',
        bg: 'bg-green-100',
        description: 'Pagamento confirmado! Estamos separando seus produtos.',
    },
    preparing: {
        label: 'Em preparação',
        icon: Package,
        color: 'text-blue-600',
        bg: 'bg-blue-100',
        description: 'Seus produtos estão sendo separados e embalados.',
    },
    shipped: {
        label: 'A caminho!',
        icon: Truck,
        color: 'text-purple-600',
        bg: 'bg-purple-100',
        description: 'Seu pedido saiu para entrega.',
    },
    delivered: {
        label: 'Entregue',
        icon: MapPin,
        color: 'text-green-600',
        bg: 'bg-green-100',
        description: 'Pedido entregue! Aproveite. 🎉',
    },
    completed: {
        label: 'Concluído',
        icon: CheckCircle,
        color: 'text-green-700',
        bg: 'bg-green-100',
        description: 'Pedido concluído com sucesso!',
    },
    cancelled: {
        label: 'Cancelado',
        icon: XCircle,
        color: 'text-red-600',
        bg: 'bg-red-100',
        description: 'Este pedido foi cancelado.',
    },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
    pix: 'PIX',
    credit_card: 'Cartão de Crédito',
    debit_card: 'Cartão de Débito',
    on_delivery: 'Pagar na entrega',
};

const DELIVERY_LABELS: Record<string, string> = {
    pickup: 'Retirada na loja',
    delivery: 'Entrega',
};

export default function OrderTrackingPage() {
    const { id } = useParams<{ id: string }>();
    const [order, setOrder] = useState<OrderWithItems | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!id) return;
        getOrderById(id)
            .then(data => {
                if (!data) setNotFound(true);
                else setOrder(data);
            })
            .catch(() => setNotFound(true))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (notFound || !order) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center px-4">
                <XCircle className="w-16 h-16 text-red-400 mb-4" />
                <h1 className="text-xl font-bold text-gray-700 mb-2">Pedido não encontrado</h1>
                <p className="text-gray-500 mb-6">Verifique o link recebido e tente novamente.</p>
                <Link to="/" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700">
                    Ir à loja
                </Link>
            </div>
        );
    }

    const config = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
    const StatusIcon = config.icon;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
                {/* Status principal */}
                <div className={`rounded-2xl p-6 flex items-center gap-4 ${config.bg}`}>
                    <div className={`w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-sm flex-shrink-0`}>
                        <StatusIcon className={`w-8 h-8 ${config.color}`} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Status do pedido</p>
                        <h1 className={`text-xl font-bold ${config.color}`}>{config.label}</h1>
                        <p className="text-sm text-gray-600 mt-1">{config.description}</p>
                    </div>
                </div>

                {/* Número do pedido */}
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-1">Pedido</p>
                    <p className="font-mono text-sm text-gray-700 break-all">#{order.id}</p>
                    <p className="text-xs text-gray-400 mt-1">
                        {new Date(order.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                    </p>
                </div>

                {/* Itens */}
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                    <h2 className="font-semibold text-gray-800 mb-4">Itens do pedido</h2>
                    <div className="space-y-3">
                        {order.items.map(item => (
                            <div key={item.id} className="flex justify-between items-center">
                                <div>
                                    <p className="font-medium text-sm text-gray-800">{item.product_name}</p>
                                    <p className="text-xs text-gray-500">
                                        {item.quantity}x {formatCurrency(item.unit_price / 100)}
                                    </p>
                                </div>
                                <p className="font-semibold text-gray-900">
                                    {formatCurrency(item.subtotal / 100)}
                                </p>
                            </div>
                        ))}
                    </div>
                    <div className="border-t mt-4 pt-3 space-y-1">
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>Subtotal</span>
                            <span>{formatCurrency(order.subtotal / 100)}</span>
                        </div>
                        {order.discount > 0 && (
                            <div className="flex justify-between text-sm text-green-600">
                                <span>Desconto</span>
                                <span>-{formatCurrency(order.discount / 100)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>Frete</span>
                            <span>{order.shipping_cost === 0 ? 'Grátis' : formatCurrency(order.shipping_cost / 100)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-gray-900 pt-1">
                            <span>Total</span>
                            <span className="text-blue-600">{formatCurrency(order.total / 100)}</span>
                        </div>
                    </div>
                </div>

                {/* Dados do pedido */}
                <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
                    <h2 className="font-semibold text-gray-800">Detalhes</h2>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <p className="text-gray-500">Pagamento</p>
                            <p className="font-medium text-gray-800">
                                {PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-500">Entrega</p>
                            <p className="font-medium text-gray-800">
                                {DELIVERY_LABELS[order.delivery_type] ?? order.delivery_type}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-500">Cliente</p>
                            <p className="font-medium text-gray-800">{order.customer_name}</p>
                        </div>
                    </div>
                    {order.shipping_address && (
                        <div className="text-sm">
                            <p className="text-gray-500 mb-1">Endereço de entrega</p>
                            <p className="text-gray-800">
                                {order.shipping_address.street}, {order.shipping_address.number}
                                {order.shipping_address.complement ? `, ${order.shipping_address.complement}` : ''
                                } — {order.shipping_address.neighborhood}, {order.shipping_address.city}/{order.shipping_address.state}
                            </p>
                        </div>
                    )}
                </div>

                {/* WhatsApp */}
                <a
                    href={`https://wa.me/55?text=${encodeURIComponent(`Olá! Quero informações sobre meu pedido #${order.id}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-green-500 text-white py-4 rounded-2xl font-semibold hover:bg-green-600 transition-colors shadow-lg"
                >
                    <MessageCircle className="w-5 h-5" />
                    Falar com a loja
                </a>

                <Link
                    to="/"
                    className="block text-center text-blue-600 py-2 font-medium hover:underline"
                >
                    ← Voltar à loja
                </Link>
            </div>
        </div>
    );
}
