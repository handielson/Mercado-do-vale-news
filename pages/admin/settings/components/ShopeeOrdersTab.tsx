import React, { useState, useEffect } from 'react';
import { Loader2, Package, Search, ExternalLink, Mail, Clock, CheckCircle2, XCircle, Truck, Calculator, DollarSign } from 'lucide-react';
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
    const [escrowData, setEscrowData] = useState<Record<string, any>>({});
    const [loadingEscrow, setLoadingEscrow] = useState<Record<string, boolean>>({});

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

            if (listData.error === 'invalid_access_token' || listData.error === 'error_auth') {
                toast.loading('Sessão expirada. Renovando token automaticamente...', { id: 'shopee-auth' });
                const rRefresh = await fetch('/api/shopee-actions?action=refresh_token');
                if (rRefresh.ok) {
                    toast.success('Sessão renovada! Carregando pedidos...', { id: 'shopee-auth' });
                    return fetchOrders(forceRefresh);
                } else {
                    toast.error('Token expirado há muito tempo. Por favor, conecte a loja novamente na aba Configurações.', { id: 'shopee-auth', duration: 10000 });
                    setLoading(false);
                    return;
                }
            }

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

            if (data.error === 'invalid_access_token' || data.error === 'error_auth') {
                toast.loading('Sessão expirada. Renovando token automaticamente...', { id: 'shopee-auth' });
                const rRefresh = await fetch('/api/shopee-actions?action=refresh_token');
                if (rRefresh.ok) {
                    toast.success('Sessão renovada! Buscando rastreio...', { id: 'shopee-auth' });
                    setLoadingTracking(prev => ({ ...prev, [orderSn]: false }));
                    return handleTracking(orderSn);
                }
            }

            if (data.error) {
                toast.error(`Erro Rastreio: ${data.error}`);
            } else {
                setTrackingData(prev => ({ ...prev, [orderSn]: data.response || null }));
            }
        } catch {
            toast.error('Erro de conexão ao buscar rastreio.');
        } finally {
            setLoadingTracking(prev => ({ ...prev, [orderSn]: false }));
        }
    };

    const handlePrintLocal = async (orderSn: string) => {
        toast.loading(`Disparando impressão local (Resumo/Etiqueta) para #${orderSn}...`, { id: `print-${orderSn}` });
        try {
            const res = await fetch(`http://localhost:8080/print-order?order_sn=${orderSn}&type=both`);
            if (!res.ok) throw new Error();
            toast.success(`Impressão de Resumo e Etiqueta enviada para as impressoras locais!`, { id: `print-${orderSn}` });
        } catch {
            toast.error(`Sem conexão com as impressoras. O painel no PC do caixa está rodando o PM2?`, { id: `print-${orderSn}` });
        }
    };

    const handleEscrow = async (orderSn: string) => {
        if (escrowData[orderSn]) {
            setEscrowData(prev => { const n = {...prev}; delete n[orderSn]; return n; });
            return;
        }

        setLoadingEscrow(prev => ({ ...prev, [orderSn]: true }));
        try {
            const res = await fetch(`/api/shopee-actions?action=get_escrow_detail&order_sn=${orderSn}`);
            const data = await res.json();

            if (data.error === 'invalid_access_token' || data.error === 'error_auth') {
                toast.loading('Sessão expirada. Renovando token automaticamente...', { id: 'shopee-auth' });
                const rRefresh = await fetch('/api/shopee-actions?action=refresh_token');
                if (rRefresh.ok) {
                    toast.success('Sessão renovada! Buscando finanças...', { id: 'shopee-auth' });
                    setLoadingEscrow(prev => ({ ...prev, [orderSn]: false }));
                    return handleEscrow(orderSn);
                }
            }

            if (data.error) {
                toast.error(`Finanças indisponíveis: ${data.message || data.error}`);
            } else {
                setEscrowData(prev => ({ ...prev, [orderSn]: data.response?.order_income || { no_data: true } }));
            }
        } catch {
            toast.error('Erro de conexão ao buscar finanças.');
        } finally {
            setLoadingEscrow(prev => ({ ...prev, [orderSn]: false }));
        }
    };

    const handleCopySummary = (order: any) => {
        const tData = trackingData[order.order_sn] || {};
        const finalTrackingNo = tData.tracking_number_explicit || tData.tracking_number || tData.logistics_tracking_no || tData.first_mile_tracking_number || tData.last_mile_tracking_number || order.tracking_no || 'Ainda não gerado';

        const itemsText = (order.item_list || []).map((item: any) => {
            const varText = item.model_name && item.model_name !== '' ? ` (Var: ${item.model_name})` : '';
            return `- ${item.model_quantity_purchased}x ${item.item_name}${varText}`;
        }).join('\n');

        const dateStr = new Date(order.create_time * 1000).toLocaleString('pt-BR');

        const message = `📦 *Resumo do Pedido Shopee*\n` +
                        `*Pedido:* #${order.order_sn}\n` +
                        `*Data:* ${dateStr}\n\n` +
                        `🛍️ *Itens:*\n${itemsText}\n\n` +
                        `💰 *Total:* R$ ${(order.total_amount || 0).toFixed(2)}\n\n` +
                        `🚚 *Rastreio:* ${finalTrackingNo}\n` +
                        `*Status:* ${order.order_status}\n\n` +
                        `Obrigado por comprar conosco!`;

        navigator.clipboard.writeText(message);
        toast.success(`Resumo copiado para a área de transferência!`);
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
                                        {(() => {
                                            const tData = trackingData[order.order_sn] || {};
                                            const finalTrackingNo = tData.tracking_number_explicit || tData.tracking_number || tData.logistics_tracking_no || tData.first_mile_tracking_number || tData.last_mile_tracking_number || order.tracking_no;
                                            return finalTrackingNo ? (
                                                <span className="text-xs font-mono bg-white px-2 py-1.5 rounded-lg border border-slate-200 text-slate-700 shadow-sm flex items-center gap-1">
                                                    {finalTrackingNo}
                                                </span>
                                            ) : null;
                                        })()}
                                    </h4>
                                    <div className="space-y-3 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                                        {(trackingData[order.order_sn].tracking_info || []).map((event: any, i: number) => (
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
                                        {(!trackingData[order.order_sn].tracking_info || trackingData[order.order_sn].tracking_info.length === 0) && (
                                            <p className="text-xs text-slate-500 italic pl-8">Nenhum evento de rastreio encontrado.</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap gap-2 justify-end">
                                <button 
                                    onClick={() => handleCopySummary(order)}
                                    className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors flex items-center gap-2"
                                >
                                    📋 Copiar Resumo
                                </button>
                                <button 
                                    onClick={() => handlePrintLocal(order.order_sn)}
                                    className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors flex items-center gap-2"
                                >
                                    <Calculator className="w-4 h-4 hidden" />
                                    🖨️ Imprimir Resumo
                                </button>
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
                                <button 
                                    onClick={() => handleEscrow(order.order_sn)}
                                    disabled={loadingEscrow[order.order_sn]}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors flex items-center gap-1 disabled:opacity-50"
                                >
                                    {loadingEscrow[order.order_sn] ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                                    Detalhes Financeiros
                                </button>
                            </div>

                            {/* Escrow Details */}
                            {escrowData[order.order_sn] && (
                                <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50 rounded-xl p-4">
                                    <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <DollarSign className="w-4 h-4 text-green-600" />
                                        Resumo Financeiro
                                    </h4>
                                    
                                    {escrowData[order.order_sn].no_data ? (
                                        <div className="text-sm text-slate-500 bg-white p-3 rounded-lg border border-slate-200">
                                            As taxas e o lucro líquido só ficam disponíveis após o repasse/conclusão do pedido pela Shopee. O valor de venda registrado é de <strong>R$ {order.total_amount?.toFixed(2)}</strong>.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                                <div className="text-xs font-semibold text-slate-500 mb-1">Preço de Venda</div>
                                                <div className="text-lg font-bold text-slate-800">
                                                    R$ {(escrowData[order.order_sn].buyer_total_amount || order.total_amount || 0).toFixed(2)}
                                                </div>
                                            </div>
                                            <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm">
                                                <div className="text-xs font-semibold text-rose-500 mb-1">Taxas Shopee (Estimadas)</div>
                                                <div className="text-lg font-bold text-rose-600">
                                                    - R$ {((escrowData[order.order_sn].buyer_total_amount || order.total_amount || 0) - (escrowData[order.order_sn].escrow_amount || 0)).toFixed(2)}
                                                </div>
                                            </div>
                                            <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm">
                                                <div className="text-xs font-semibold text-emerald-600 mb-1">Seu Lucro Líquido (A Receber)</div>
                                                <div className="text-lg font-bold text-emerald-600">
                                                    R$ {(escrowData[order.order_sn].escrow_amount || 0).toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
