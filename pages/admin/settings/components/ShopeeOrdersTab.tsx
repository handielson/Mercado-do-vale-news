import React, { useState, useEffect } from 'react';
import { Loader2, Package, Search, ExternalLink, Mail, Clock, CheckCircle2, XCircle, Truck, Calculator } from 'lucide-react';
import { toast } from 'sonner';

interface ShopeeOrdersTabProps {
    isConnected: boolean;
}

export default function ShopeeOrdersTab({ isConnected }: ShopeeOrdersTabProps) {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQ, setSearchQ] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [trackingData, setTrackingData] = useState<Record<string, any>>({});
    const [loadingTracking, setLoadingTracking] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (isConnected) {
            fetchOrders();
            // Atualiza de fundo a cada 5 minutos
            const interval = setInterval(() => fetchOrders(true), 5 * 60 * 1000);
            return () => clearInterval(interval);
        }
    }, [isConnected, statusFilter]);

    const fetchOrders = async (forceRefresh = false) => {
        const cacheKey = `shopee_orders_${statusFilter}`;
        
        if (!forceRefresh) {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    // Usa o cache se tiver menos de 5 minutos
                    if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
                        setOrders(parsed.orders);
                        return;
                    }
                } catch (e) {}
            }
        }

        setLoading(true);
        try {
            // Shopee allows max 15 days for create_time range. Let's get last 14 days.
            const timeTo = Math.floor(Date.now() / 1000);
            const timeFrom = timeTo - (14 * 24 * 60 * 60);

            // 1. Fetch Order List
            let url = `/api/shopee-actions?action=get_order_list&time_from=${timeFrom}&time_to=${timeTo}&page_size=50`;
            if (statusFilter !== 'ALL') {
                url += `&order_status=${statusFilter}`;
            }

            const listRes = await fetch(url);
            const listData = await listRes.json();

            if (listData.error) {
                toast.error(`Erro ao buscar pedidos: ${listData.error}`);
                setLoading(false);
                return;
            }

            const orderList = listData.response?.order_list || [];
            
            if (orderList.length === 0) {
                setOrders([]);
                localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), orders: [] }));
                setLoading(false);
                return;
            }

            // 2. Fetch Order Details in batches (max 50 per request)
            const orderSns = orderList.map((o: any) => o.order_sn);
            const detailsRes = await fetch(`/api/shopee-actions?action=get_order_detail&order_sn_list=${orderSns.join(',')}`);
            const detailsData = await detailsRes.json();

            if (detailsData.error) {
                toast.error(`Erro ao buscar detalhes: ${detailsData.error}`);
            } else {
                const newOrders = detailsData.response?.order_list || [];
                setOrders(newOrders);
                localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), orders: newOrders }));
            }

        } catch (error) {
            toast.error('Erro de conexão ao buscar pedidos Shopee.');
        } finally {
            setLoading(false);
        }
    };

    const handleShipOrder = async (orderSn: string) => {
        toast.loading(`Preparando envio do pedido #${orderSn}...`, { id: 'ship' });
        try {
            const res = await fetch(`/api/shopee-actions?action=ship_order&order_sn=${orderSn}`);
            const data = await res.json();
            
            if (data.error) {
                toast.error(`Erro: ${data.message || data.error}`, { id: 'ship' });
                return;
            }
            
            toast.success(`Pedido #${orderSn} preparado para envio!`, { id: 'ship' });
            fetchOrders(); // refresh
        } catch (error) {
            toast.error('Erro de conexão.', { id: 'ship' });
        }
    };

    const handleTracking = async (orderSn: string) => {
        if (trackingData[orderSn]) {
            // toggle off
            setTrackingData(prev => { const n = {...prev}; delete n[orderSn]; return n; });
            return;
        }

        setLoadingTracking(prev => ({ ...prev, [orderSn]: true }));
        try {
            const res = await fetch(`/api/shopee-actions?action=get_tracking_info&order_sn=${orderSn}`);
            const data = await res.json();
            if (data.error) {
                toast.error(`Erro Rastreio: ${data.error}`);
            } else {
                setTrackingData(prev => ({ ...prev, [orderSn]: data.response?.tracking_info || [] }));
            }
        } catch {
            toast.error('Erro de conexão ao buscar rastreio.');
        } finally {
            setLoadingTracking(prev => ({ ...prev, [orderSn]: false }));
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'UNPAID': return <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">Aguardando Pagamento</span>;
            case 'READY_TO_SHIP': return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold flex items-center gap-1"><Clock className="w-3 h-3"/>A Enviar</span>;
            case 'PROCESSED': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">Processado</span>;
            case 'SHIPPED': return <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold flex items-center gap-1"><Truck className="w-3 h-3"/>Enviado</span>;
            case 'COMPLETED': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/>Concluído</span>;
            case 'CANCELLED': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold flex items-center gap-1"><XCircle className="w-3 h-3"/>Cancelado</span>;
            default: return <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">{status}</span>;
        }
    };

    if (!isConnected) {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center text-amber-800">
                <Package className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold mb-1">Loja não conectada</h3>
                <p className="text-sm">Conecte sua conta da Shopee na aba "Configurações" para visualizar e gerenciar seus pedidos.</p>
            </div>
        );
    }

    const filteredOrders = orders.filter(o => {
        if (!searchQ) return true;
        const q = searchQ.toLowerCase();
        return o.order_sn?.toLowerCase().includes(q) || 
               o.recipient_address?.name?.toLowerCase().includes(q);
    });

    return (
        <div className="space-y-6">
            {/* Headers and Filters */}
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        value={searchQ} 
                        onChange={e => setSearchQ(e.target.value)}
                        placeholder="Buscar por ID do Pedido ou Nome do Cliente..."
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 bg-white" 
                    />
                </div>
                <div className="flex gap-2">
                    <select 
                        value={statusFilter} 
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2 border border-slate-200 bg-white rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500"
                    >
                        <option value="ALL">Todos os Status</option>
                        <option value="UNPAID">Aguardando Pgto</option>
                        <option value="READY_TO_SHIP">A Enviar</option>
                        <option value="SHIPPED">Enviado</option>
                        <option value="COMPLETED">Concluído</option>
                        <option value="CANCELLED">Cancelado</option>
                    </select>
                    <button 
                        onClick={() => fetchOrders(true)}
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors"
                    >
                        Atualizar
                    </button>
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
                    <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-base font-semibold text-slate-700">Nenhum pedido encontrado</p>
                    <p className="text-sm mt-1">Tente ajustar os filtros ou o termo de busca.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredOrders.map(order => (
                        <div key={order.order_sn} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pb-4 border-b border-slate-100">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-base font-bold text-slate-800">#{order.order_sn}</h3>
                                        {getStatusBadge(order.order_status)}
                                    </div>
                                    <p className="text-xs text-slate-500 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Criado em: {new Date(order.create_time * 1000).toLocaleString('pt-BR')}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-slate-500">Total Pago</p>
                                    <p className="text-lg font-bold text-[#ee4d2d]">
                                        R$ {order.total_amount?.toFixed(2) || '0.00'}
                                    </p>
                                    {order.estimated_shipping_fee && (
                                        <p className="text-xs text-slate-400 mt-1">
                                            Frete: R$ {order.estimated_shipping_fee.toFixed(2)}
                                        </p>
                                    )}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Buyer Info */}
                                <div>
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Comprador</p>
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                                            <span className="font-bold text-slate-500">
                                                {order.recipient_address?.name?.charAt(0) || '?'}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{order.recipient_address?.name || 'Cliente Oculto'}</p>
                                            <p className="text-xs text-slate-500">
                                                {order.recipient_address?.city}, {order.recipient_address?.state} - CEP: {order.recipient_address?.zipcode}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Items */}
                                <div>
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Itens ({order.item_list?.length || 0})</p>
                                    <div className="space-y-2">
                                        {(order.item_list || []).map((item: any, idx: number) => (
                                            <div key={idx} className="flex gap-3 text-sm">
                                                <div className="flex-1">
                                                    <p className="font-medium text-slate-700 line-clamp-1">{item.item_name}</p>
                                                    {item.model_name && <p className="text-xs text-slate-500">Var: {item.model_name}</p>}
                                                </div>
                                                <div className="font-semibold text-slate-800 whitespace-nowrap">
                                                    {item.model_quantity_purchased}x
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Tracking Details */}
                            {trackingData[order.order_sn] && (
                                <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50 rounded-xl p-4">
                                    <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Truck className="w-4 h-4 text-orange-500" />
                                            Histórico de Rastreio
                                        </div>
                                        {order.tracking_no && (
                                            <span className="text-xs font-mono bg-white px-2 py-1.5 rounded-lg border border-slate-200 text-slate-700 shadow-sm">
                                                {order.tracking_no}
                                            </span>
                                        )}
                                    </h4>
                                    <div className="space-y-3 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                                        {trackingData[order.order_sn].map((event: any, i: number) => (
                                            <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                                <div className="flex items-center justify-center w-6 h-6 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-orange-500 text-slate-500 group-[.is-active]:text-emerald-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                                    <div className="w-2 h-2 bg-white rounded-full"></div>
                                                </div>
                                                <div className="w-[calc(100%-3rem)] md:w-[calc(50%-1.5rem)] bg-white p-3 rounded border border-slate-200 shadow-sm">
                                                    <div className="flex items-center justify-between space-x-2 mb-1">
                                                        <div className="font-bold text-slate-900 text-xs">{event.description || event.status}</div>
                                                        <time className="font-mono text-[10px] text-orange-500">{new Date(event.update_time * 1000).toLocaleString('pt-BR')}</time>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {trackingData[order.order_sn].length === 0 && (
                                            <p className="text-xs text-slate-500 italic pl-8">Nenhum evento de rastreio encontrado.</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap gap-2 justify-end">
                                <button 
                                    onClick={() => handleTracking(order.order_sn)}
                                    disabled={loadingTracking[order.order_sn]}
                                    className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-bold hover:bg-blue-100 transition-colors flex items-center gap-2"
                                >
                                    {loadingTracking[order.order_sn] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                                    Rastrear
                                </button>
                                {order.order_status === 'READY_TO_SHIP' && (
                                    <button 
                                        onClick={() => handleShipOrder(order.order_sn)}
                                        className="px-4 py-2 bg-[#ee4d2d] text-white rounded-xl text-sm font-bold hover:bg-[#d73f21] transition-colors"
                                    >
                                        Preparar Envio
                                    </button>
                                )}
                                <a 
                                    href={`https://seller.shopee.com.br/portal/sale/order/${order.order_sn}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors flex items-center gap-1"
                                >
                                    <ExternalLink className="w-4 h-4" /> Detalhes na Shopee
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
