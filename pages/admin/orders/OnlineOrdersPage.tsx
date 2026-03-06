/**
 * OnlineOrdersPage — Painel admin de pedidos online
 * Rota: /admin/pedidos-online
 */
import { useState, useEffect } from 'react';
import { getOrders, updateOrderStatus, completeOnDeliveryOrder, cancelOrder } from '@/services/orderService';
import type { OrderWithItems, OrderStatus } from '@/types/order';
import { formatCurrency } from '@/utils/saleCalculations';
import {
    Package, Truck, CheckCircle, XCircle, Clock,
    RefreshCw, AlertCircle, Loader2, Search
} from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
    pending: 'Aguardando',
    awaiting_payment: 'Ag. Pagamento',
    paid: 'Pago',
    preparing: 'Em Preparo',
    shipped: 'Enviado',
    delivered: 'Entregue',
    completed: 'Concluído',
    cancelled: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    awaiting_payment: 'bg-orange-100 text-orange-800',
    paid: 'bg-green-100 text-green-800',
    preparing: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-teal-100 text-teal-800',
    completed: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
};

const DELIVERY_LABELS: Record<string, string> = {
    pickup: '🏪 Retirada',
    delivery: '🚚 Entrega',
};

const PAYMENT_LABELS: Record<string, string> = {
    pix: 'PIX',
    credit_card: 'Crédito',
    debit_card: 'Débito',
    on_delivery: 'Na entrega',
};

export default function OnlineOrdersPage() {
    const [orders, setOrders] = useState<OrderWithItems[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const loadOrders = async () => {
        setLoading(true);
        try {
            const data = await getOrders(
                filterStatus ? { status: filterStatus as OrderStatus } : undefined
            );
            setOrders(data);
        } catch (err) {
            console.error('[OnlineOrdersPage] Erro ao carregar pedidos:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadOrders(); }, [filterStatus]);

    const handleAction = async (
        orderId: string,
        action: 'paid' | 'preparing' | 'shipped' | 'complete' | 'cancel'
    ) => {
        setActionLoading(orderId + action);
        try {
            if (action === 'complete') {
                await completeOnDeliveryOrder(orderId);
            } else if (action === 'cancel') {
                await cancelOrder(orderId);
            } else {
                await updateOrderStatus(orderId, action as OrderStatus);
            }
            await loadOrders();
        } catch (err: any) {
            alert(`Erro: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    const filtered = orders.filter(o => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
            o.customer_name.toLowerCase().includes(s) ||
            o.customer_phone.includes(s) ||
            o.id.toLowerCase().includes(s)
        );
    });

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Pedidos Online</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        {filtered.length} pedido{filtered.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <button
                    onClick={loadOrders}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
                >
                    <RefreshCw className="w-4 h-4" />
                    Atualizar
                </button>
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        placeholder="Buscar por nome, telefone ou ID..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                    <option value="">Todos os status</option>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                    ))}
                </select>
            </div>

            {/* Lista */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhum pedido encontrado.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(order => (
                        <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                {/* Info principal */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-700'}`}>
                                            {STATUS_LABELS[order.status] ?? order.status}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {DELIVERY_LABELS[order.delivery_type]}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {PAYMENT_LABELS[order.payment_method]}
                                        </span>
                                    </div>

                                    <p className="font-semibold text-gray-900">{order.customer_name}</p>
                                    <p className="text-sm text-gray-500">{order.customer_phone}</p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        #{order.id.slice(0, 8)}... · {new Date(order.created_at).toLocaleDateString('pt-BR', {
                                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </p>
                                </div>

                                {/* Total + itens */}
                                <div className="text-right flex-shrink-0">
                                    <p className="font-bold text-blue-600 text-lg">
                                        {formatCurrency(order.total / 100)}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                                    </p>
                                </div>
                            </div>

                            {/* Itens resumidos */}
                            <div className="mt-3 pt-3 border-t border-gray-100">
                                <p className="text-xs text-gray-500 mb-1">Produtos:</p>
                                <div className="flex flex-wrap gap-1">
                                    {order.items.map(item => (
                                        <span key={item.id} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-lg">
                                            {item.quantity}× {item.product_name}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Ações por status */}
                            <div className="mt-3 flex flex-wrap gap-2">
                                {order.status === 'pending' && (
                                    <>
                                        <ActionButton
                                            label="Confirmar como pago"
                                            icon={<CheckCircle className="w-4 h-4" />}
                                            color="green"
                                            loading={actionLoading === order.id + 'paid'}
                                            onClick={() => handleAction(order.id, 'paid')}
                                        />
                                        <ActionButton
                                            label="Cancelar"
                                            icon={<XCircle className="w-4 h-4" />}
                                            color="red"
                                            loading={actionLoading === order.id + 'cancel'}
                                            onClick={() => handleAction(order.id, 'cancel')}
                                        />
                                    </>
                                )}
                                {order.status === 'paid' && (
                                    <ActionButton
                                        label="Iniciar preparo"
                                        icon={<Package className="w-4 h-4" />}
                                        color="blue"
                                        loading={actionLoading === order.id + 'preparing'}
                                        onClick={() => handleAction(order.id, 'preparing')}
                                    />
                                )}
                                {order.status === 'preparing' && (
                                    <ActionButton
                                        label="Marcar como enviado"
                                        icon={<Truck className="w-4 h-4" />}
                                        color="purple"
                                        loading={actionLoading === order.id + 'shipped'}
                                        onClick={() => handleAction(order.id, 'shipped')}
                                    />
                                )}
                                {(order.status === 'shipped' || order.status === 'delivered') && order.payment_method === 'on_delivery' && (
                                    <ActionButton
                                        label="Finalizar venda (pago na entrega)"
                                        icon={<CheckCircle className="w-4 h-4" />}
                                        color="green"
                                        loading={actionLoading === order.id + 'complete'}
                                        onClick={() => handleAction(order.id, 'complete')}
                                    />
                                )}
                                {order.status === 'pending' && order.payment_method === 'on_delivery' && (
                                    <span className="text-xs text-orange-600 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Aguardando entrega
                                    </span>
                                )}
                                {/* Link de rastreamento */}
                                <a
                                    href={`/pedido/${order.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 ml-auto"
                                >
                                    <AlertCircle className="w-3 h-3" />
                                    Ver página do cliente
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ActionButton({
    label, icon, color, loading, onClick
}: {
    label: string;
    icon: React.ReactNode;
    color: 'green' | 'blue' | 'red' | 'purple';
    loading: boolean;
    onClick: () => void;
}) {
    const colors = {
        green: 'bg-green-600 hover:bg-green-700',
        blue: 'bg-blue-600 hover:bg-blue-700',
        red: 'bg-red-600 hover:bg-red-700',
        purple: 'bg-purple-600 hover:bg-purple-700',
    };

    return (
        <button
            onClick={onClick}
            disabled={loading}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 ${colors[color]}`}
        >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : icon}
            {label}
        </button>
    );
}
