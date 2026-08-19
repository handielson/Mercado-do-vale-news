/**
 * OnlineOrdersPage — Painel admin de pedidos online
 * Rota: /admin/pedidos-online
 */
import { useState, useEffect } from 'react';
import { getOrders, updateOrderStatus, completeOnDeliveryOrder, cancelOrder, notifyOrderStatusWhatsApp, refundOrderPayment } from '@/services/orderService';
import { vpsApiService } from '@/services/vpsApiService';
import { companySettingsService } from '@/services/companySettingsService';
import type { CompanySettings } from '@/types/companySettings';
import { printDeliveryReceipt } from '@/utils/printDeliveryReceipt';
import {
    downloadOrderRefundReceiptPdf,
    generateOrderRefundReceiptPdf,
    shareOrderRefundReceiptPdf,
} from '@/utils/orderRefundReceiptPdf';
import type { OrderWithItems, OrderStatus } from '@/types/order';
import { formatCurrency } from '@/utils/saleCalculations';
import { WarrantyTermModal } from '@/components/warranty/WarrantyTermModal';
import { warrantyDocumentService } from '@/services/warrantyDocumentService';
import { renderWarrantyBothCopies } from '@/utils/warrantyTagReplacement';
import { buildGlobalHeader, getHeaderTemplate } from '@/utils/headerBuilder';
import { customerService } from '@/services/customers';
import {
    Package, Truck, CheckCircle, XCircle, Clock,
    RefreshCw, AlertCircle, Loader2, Search, Printer, Shield, RotateCcw, FileDown, MessageCircle
} from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
    pending: 'Aguardando',
    awaiting_payment: 'Ag. Pagamento',
    payment_failed: 'Pgto. Não Concluído',
    paid: 'Pago',
    confirmed: 'Confirmado',
    preparing: 'Em Preparo',
    shipped: 'Enviado',
    delivered: 'Entregue',
    completed: 'Concluído',
    cancelled: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    awaiting_payment: 'bg-orange-100 text-orange-800',
    payment_failed: 'bg-red-100 text-red-700',
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
    const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
    const [warrantyModalOrder, setWarrantyModalOrder] = useState<OrderWithItems | null>(null);
    const [warrantyCustomerCpf, setWarrantyCustomerCpf] = useState('');

    useEffect(() => {
        companySettingsService.get().then(setCompanySettings).catch(console.error);
    }, []);

    const loadOrders = async () => {
        setLoading(true);
        try {
            let data = await getOrders(
                filterStatus ? { status: filterStatus as OrderStatus } : undefined
            );

            // Fallback: busca imagem/cor para itens sem esses dados (pedidos antigos)
            const allItems = data.flatMap(o => o.items);
            const itemsMissing = allItems.filter(i => !i.product_image_url || !i.product_color);
            if (itemsMissing.length > 0) {
                const productIds = [...new Set(itemsMissing.map(i => i.product_id))];
                const products = await vpsApiService.getProductsByIds(productIds);

                if (products) {
                    const map = Object.fromEntries(products.map(p => [p.id, p]));
                    data = data.map(order => ({
                        ...order,
                        items: order.items.map(item => ({
                            ...item,
                            product_image_url: item.product_image_url || map[item.product_id]?.images?.[0] || undefined,
                            product_color: item.product_color || map[item.product_id]?.specs?.color || map[item.product_id]?.specs?.Cor || undefined,
                        }))
                    }));
                }
            }

            setOrders(data);
        } catch (err) {
            console.error('[OnlineOrdersPage] Erro ao carregar pedidos:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadOrders(); }, [filterStatus]);

    const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
        setActionLoading(orderId + newStatus);
        try {
            if (newStatus === 'completed') {
                await completeOnDeliveryOrder(orderId);
            } else if (newStatus === 'cancelled') {
                await cancelOrder(orderId);
            } else {
                await updateOrderStatus(orderId, newStatus);
            }
            // Otimista: atualiza localmente
            setOrders(prev => prev.map(o =>
                o.id === orderId ? { ...o, status: newStatus } : o
            ));
            try {
                const whatsapp = await notifyOrderStatusWhatsApp(orderId);
                if (whatsapp.status !== 'sent') {
                    alert('Situacao atualizada, mas a mensagem de WhatsApp nao foi enviada. Verifique a conexao e tente novamente.');
                }
            } catch {
                alert('Situacao atualizada, mas a mensagem de WhatsApp nao foi enviada. Verifique a conexao e tente novamente.');
            }
        } catch (err: any) {
            alert(`Erro ao atualizar status: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    const handleRefund = async (order: OrderWithItems) => {
        const confirmed = window.confirm(
            `Estornar ${formatCurrency(order.total)} para ${order.customer_name}?\n\n` +
            'O estorno sera solicitado ao Mercado Pago e nao podera ser desfeito pelo sistema.'
        );
        if (!confirmed) return;

        setActionLoading(order.id + 'refund');
        try {
            const result = await refundOrderPayment(order.id);
            const refundedOrder: OrderWithItems = {
                ...order,
                payment_status: 'refunded',
                refund_id: result.refund_id || order.refund_id,
                refunded_at: result.refunded_at || order.refunded_at || new Date().toISOString(),
                refund_amount: result.refund_amount ?? order.refund_amount ?? order.total,
            };
            setOrders(prev => prev.map(item =>
                item.id === order.id ? refundedOrder : item
            ));
            const whatsappMessage = result.whatsapp?.status === 'sent'
                ? ' O cliente foi avisado pelo WhatsApp.'
                : ' O estorno foi concluido, mas o aviso por WhatsApp nao foi enviado.';
            const baseMessage = `${result.already_refunded ? 'Este pagamento ja estava estornado.' : 'Pagamento estornado com sucesso.'}${whatsappMessage}`;

            if (!companySettings) {
                alert(`${baseMessage}\n\nO recibo em PDF ficará disponível assim que as configurações da empresa terminarem de carregar.`);
                return;
            }

            const artifact = generateOrderRefundReceiptPdf(refundedOrder, companySettings);
            const shouldShare = window.confirm(`${baseMessage}\n\nCompartilhar agora o comprovante de estorno em PDF?`);
            if (shouldShare) {
                const shareResult = await shareOrderRefundReceiptPdf(artifact, refundedOrder.customer_phone);
                if (shareResult === 'downloaded') {
                    alert('O PDF foi baixado e a conversa do cliente foi aberta. Anexe o arquivo baixado no WhatsApp.');
                }
            }
        } catch (err: any) {
            alert(`Erro ao estornar pagamento: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    const handlePrintReceipt = async (order: OrderWithItems) => {
        if (!companySettings) { alert('Aguarde carregar as configurações da empresa.'); return; }
        await printDeliveryReceipt(order, companySettings);
    };

    const handleDownloadRefundReceipt = (order: OrderWithItems) => {
        if (!companySettings) { alert('Aguarde carregar as configurações da empresa.'); return; }
        downloadOrderRefundReceiptPdf(generateOrderRefundReceiptPdf(order, companySettings));
    };

    const handleShareRefundReceipt = async (order: OrderWithItems) => {
        if (!companySettings) { alert('Aguarde carregar as configurações da empresa.'); return; }
        setActionLoading(order.id + 'share-refund');
        try {
            const result = await shareOrderRefundReceiptPdf(
                generateOrderRefundReceiptPdf(order, companySettings),
                order.customer_phone,
            );
            if (result === 'downloaded') {
                alert('O PDF foi baixado e a conversa do cliente foi aberta. Anexe o arquivo baixado no WhatsApp.');
            }
        } catch (err: any) {
            alert(`Erro ao preparar o comprovante: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    // Detecta item de garantia estendida no pedido
    const getWarrantyItem = (order: OrderWithItems) =>
        order.items.find(i => i.product_name?.startsWith('Garantia Estendida'));

    const openWarrantyModal = async (order: OrderWithItems) => {
        setWarrantyCustomerCpf('');
        setWarrantyModalOrder(order);
        // Busca CPF do cliente de forma assíncrona
        if ((order as any).customer_id) {
            try {
                const customer = await customerService.getById((order as any).customer_id);
                setWarrantyCustomerCpf(customer?.cpf_cnpj || '');
            } catch { /* sem CPF disponivel */ }
        }
    };

    // Monta warrantyTagData com chaves que batem exatamente com as {{tags}} do template
    const buildWarrantyTagData = (order: OrderWithItems, cpf = warrantyCustomerCpf): Record<string, string> => {
        const warrantyItem = getWarrantyItem(order);
        if (!warrantyItem) return {};

        // Extrai produto coberto e prazo do product_name: "Garantia Estendida +12m — Redmi Note"
        const parts = warrantyItem.product_name.split(' \u2014 ');
        const nonWarrantyItems = order.items.filter(i => !i.product_name?.startsWith('Garantia'));
        const mainProduct = nonWarrantyItems.sort((a, b) => (b.subtotal ?? 0) - (a.subtotal ?? 0))[0];
        let produto = parts[1] || mainProduct?.product_name || '';
        const prazoMatch = warrantyItem.product_name.match(/(\d+)m/);
        const meses = prazoMatch ? parseInt(prazoMatch[1]) : 0;

        const dataCompra = new Date(order.created_at);

        let diasGarantiaLoja = 90;
        const refMatch = produto.match(/\(Ref:\s*(\d+)d\)/);
        if (refMatch) {
            diasGarantiaLoja = parseInt(refMatch[1], 10);
            produto = produto.replace(refMatch[0], '').trim();
        }

        const dataFimLoja = new Date(dataCompra);
        dataFimLoja.setDate(dataFimLoja.getDate() + diasGarantiaLoja);

        const dataInicio = new Date(dataFimLoja);
        dataInicio.setDate(dataInicio.getDate() + 1);

        const dataFim = new Date(dataInicio);
        dataFim.setMonth(dataFim.getMonth() + meses);

        const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR');

        // Cabeçalho A4 ({{cabecalho_a4}})
        let cabecalhoHtml = '';
        if (companySettings) {
            try {
                const rawCabecalho = getHeaderTemplate('default_a4_header', companySettings);
                cabecalhoHtml = buildGlobalHeader(rawCabecalho, companySettings, '');
            } catch { /* sem template de cabeçalho */ }
        }

        return {
            // Cabeçalho
            cabecalho_a4: cabecalhoHtml,
            // Empresa
            nome_loja: companySettings?.company_name || '',
            endereco: companySettings?.address || '',
            telefone: companySettings?.phone || '',
            email: companySettings?.email || '',
            cnpj: companySettings?.cnpj || '',
            logo: (companySettings as any)?.logo_url || '',
            // Cliente
            nome_cliente: order.customer_name || '',
            cpf_cliente: cpf || '',
            telefone_cliente: order.customer_phone || '',
            email_cliente: '',
            // Venda
            numero_venda: `#${order.id.slice(0, 8).toUpperCase()}`,
            data_compra: fmtDate(dataCompra),
            // Produto coberto
            produto,
            modelo: produto,
            marca: '',
            cor: '',
            ram: '',
            memoria: '',
            imei1: '',
            imei2: '',
            // Garantia (inclui tags padrão E tags custom do template)
            dias_garantia: String(meses * 30),
            meses_garantia_estendida: String(meses),
            tipo_garantia: 'Garantia Estendida',
            dias_garantia_loja: `${diasGarantiaLoja} dias`,   // Nova tag disponibilizada
            valor_garantia_estendida: formatCurrency(warrantyItem.subtotal),
            data_inicio_estendida: fmtDate(dataInicio),
            data_fim_estendida: fmtDate(dataFim),
            // Declaração
            declaracao_recebimento: 'Declaro ter recebido este certificado de garantia estendida.',
        };
    };

    const handleSaveWarrantyDoc = async (orderId: string) => {
        const order = orders.find(o => o.id === orderId);
        if (!order || !companySettings?.extended_warranty_template) return;
        const tagData = buildWarrantyTagData(order);
        const { copy1 } = renderWarrantyBothCopies(companySettings.extended_warranty_template, tagData);
        await warrantyDocumentService.create({
            order_id: orderId,
            warranty_content: copy1,
        });
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
                                        {(order as any).shipping_origin_label && order.delivery_type === 'delivery' && (
                                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                                                📍 Enviar de: {(order as any).shipping_origin_label}
                                            </span>
                                        )}
                                        <span className="text-xs text-gray-500">
                                            {PAYMENT_LABELS[order.payment_method]}
                                        </span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${order.payment_status === 'refunded'
                                            ? 'bg-purple-100 text-purple-700'
                                            : order.payment_status === 'paid'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {order.payment_status === 'refunded' ? 'Pagamento estornado' : order.payment_status === 'paid' ? 'Pagamento confirmado' : 'Pagamento pendente'}
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
                                        {formatCurrency(order.total)}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                                    </p>
                                </div>
                            </div>

                            {/* Itens com foto, cor e SKU */}
                            <div className="mt-3 pt-3 border-t border-gray-100">
                                <p className="text-xs text-gray-500 mb-2">Produtos:</p>
                                <div className="space-y-2">
                                    {order.items.map(item => (
                                        <div key={item.id} className="flex items-center gap-2">
                                            {item.product_image_url ? (
                                                <img
                                                    src={item.product_image_url}
                                                    alt={item.product_name}
                                                    className="w-10 h-10 rounded-lg object-cover border border-gray-100 flex-shrink-0"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                    <Package className="w-5 h-5 text-gray-400" />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium text-gray-800 truncate">
                                                    {item.quantity}× {item.product_name}
                                                </p>
                                                <div className="flex gap-2 flex-wrap">
                                                    {item.product_color && (
                                                        <span className="text-xs text-gray-500">🎨 {item.product_color}</span>
                                                    )}
                                                    {item.product_sku && (
                                                        <span className="text-xs text-gray-400 font-mono">{item.product_sku}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="ml-auto text-xs font-semibold text-gray-700 flex-shrink-0">
                                                {formatCurrency(item.subtotal)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Status dinâmico + Comprovante */}
                            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-gray-500 font-medium">Situação:</label>
                                    <select
                                        value={order.status}
                                        disabled={actionLoading?.startsWith(order.id)}
                                        onChange={e => handleStatusChange(order.id, e.target.value as OrderStatus)}
                                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
                                    >
                                        <option value="pending">⏳ Aguardando</option>
                                        <option value="awaiting_payment">💳 Ag. Pagamento</option>
                                        <option value="payment_failed">🚫 Pgto. Não Concluído</option>
                                        <option value="paid">✅ Aceito / Pago</option>
                                        <option value="confirmed">✅ Confirmado</option>
                                        <option value="preparing">📦 Em Separação</option>
                                        <option value="shipped">🚚 Enviado</option>
                                        <option value="delivered">🏠 Entregue</option>
                                        <option value="completed">🎉 Concluído</option>
                                        <option value="cancelled">❌ Cancelado</option>
                                    </select>
                                    {actionLoading?.startsWith(order.id) && (
                                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                    )}
                                </div>

                                {/* Botão imprimir comprovante */}
                                <button
                                    onClick={() => handlePrintReceipt(order)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <Printer className="w-3.5 h-3.5" />
                                    Comprovante
                                </button>

                                {order.status === 'cancelled'
                                    && order.payment_status === 'paid'
                                    && order.payment_gateway === 'mercado_pago'
                                    && order.gateway_payment_id && (
                                    <button
                                        onClick={() => handleRefund(order)}
                                        disabled={actionLoading?.startsWith(order.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                                    >
                                        {actionLoading === order.id + 'refund' ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <RotateCcw className="w-3.5 h-3.5" />
                                        )}
                                        Estornar pagamento
                                    </button>
                                )}

                                {order.payment_status === 'refunded' && (
                                    <>
                                        <button
                                            onClick={() => handleShareRefundReceipt(order)}
                                            disabled={actionLoading?.startsWith(order.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
                                            title="Compartilhar o PDF pelo WhatsApp"
                                        >
                                            {actionLoading === order.id + 'share-refund' ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <MessageCircle className="w-3.5 h-3.5" />
                                            )}
                                            Enviar PDF
                                        </button>
                                        <button
                                            onClick={() => handleDownloadRefundReceipt(order)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
                                            title="Baixar o comprovante de estorno em PDF"
                                        >
                                            <FileDown className="w-3.5 h-3.5" />
                                            Baixar PDF
                                        </button>
                                    </>
                                )}

                                {/* Botão garantia — só aparece quando pedido tem item de garantia */}
                                {getWarrantyItem(order) && (
                                    <button
                                        onClick={() => openWarrantyModal(order)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                                    >
                                        <Shield className="w-3.5 h-3.5" />
                                        Garantia
                                    </button>
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

            {/* WarrantyTermModal: abre ao clicar em 🛡️ Garantia */}
            {warrantyModalOrder && companySettings?.extended_warranty_template && (
                <WarrantyTermModal
                    isOpen={!!warrantyModalOrder}
                    onClose={() => setWarrantyModalOrder(null)}
                    warrantyContent={renderWarrantyBothCopies(companySettings.extended_warranty_template!, buildWarrantyTagData(warrantyModalOrder)).copy1}
                    warrantyTemplate={companySettings.extended_warranty_template}
                    warrantyTagData={buildWarrantyTagData(warrantyModalOrder)}
                    onGenerate={async () => {
                        await handleSaveWarrantyDoc(warrantyModalOrder.id);
                        setWarrantyModalOrder(null);
                    }}
                />
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
