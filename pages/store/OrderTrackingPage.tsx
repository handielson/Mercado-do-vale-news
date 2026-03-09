/**
 * OrderTrackingPage — Rastreamento público de pedido por ID
 * Acessível sem login via /pedido/:id
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getOrderById } from '@/services/orderService';
import { supabase } from '@/services/supabase';
import type { OrderWithItems } from '@/types/order';
import { formatCurrency } from '@/utils/saleCalculations';
import {
    Package, CheckCircle, Truck, MapPin, Clock,
    XCircle, AlertCircle, Loader2, MessageCircle, Copy
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
        description: 'Seu pedido foi recebido e está sendo processado pela loja.',
    },
    awaiting_payment: {
        label: 'Aguardando pagamento',
        icon: AlertCircle,
        color: 'text-orange-600',
        bg: 'bg-orange-100',
        description: 'Finalize o pagamento para confirmarmos seu pedido.',
    },
    payment_failed: {
        label: 'Pagamento não concluído',
        icon: XCircle,
        color: 'text-red-600',
        bg: 'bg-red-100',
        description: 'Seu pagamento não foi processado. Entre em contato ou tente novamente.',
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
    const [copied, setCopied] = useState(false);

    const copyOrderId = () => {
        if (!order) return;
        navigator.clipboard.writeText(order.id).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    useEffect(() => {
        if (!id) return;
        getOrderById(id)
            .then(async data => {
                if (!data) { setNotFound(true); return; }

                // Enriquece todos os itens com imagem, cor, RAM e storage do produto
                const allProductIds = [...new Set(data.items
                    .filter(i => i.product_id)
                    .map(i => i.product_id))];

                if (allProductIds.length > 0) {
                    const { data: products } = await supabase
                        .from('products')
                        .select('id, images, specs')
                        .in('id', allProductIds);

                    if (products) {
                        const productMap = Object.fromEntries(products.map(p => [p.id, p]));
                        data = {
                            ...data,
                            items: data.items.map(item => {
                                const specs: Record<string, any> = productMap[item.product_id]?.specs ?? {};
                                const ramKey = Object.keys(specs).find(k => k.toLowerCase().includes('ram'));
                                const storKey = Object.keys(specs).find(k => {
                                    const l = k.toLowerCase();
                                    return l.includes('armaz') || l.includes('storage') || (l.includes('mem') && l.includes('int'));
                                });
                                return {
                                    ...item,
                                    product_image_url: item.product_image_url || productMap[item.product_id]?.images?.[0] || undefined,
                                    product_color: item.product_color || specs?.color || specs?.Cor || undefined,
                                    product_ram: ramKey ? specs[ramKey] : undefined,
                                    product_storage: storKey ? specs[storKey] : undefined,
                                };
                            })
                        };
                    }
                }

                setOrder(data);
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

                {/* Informações do Cliente e Número do pedido */}
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-1 text-center">Cliente</p>
                    <h2 className="text-base font-bold text-gray-800 text-center mb-4 pb-4 border-b border-gray-100">{order.customer_name}</h2>

                    <p className="text-xs text-gray-500 mb-1">Pedido</p>
                    <button
                        onClick={copyOrderId}
                        className="flex items-center gap-2 group w-full text-left"
                        title="Clique para copiar o número do pedido"
                    >
                        <p className="font-mono text-sm text-gray-700 break-all flex-1">#{order.id}</p>
                        <span className={`flex items-center gap-1 text-xs flex-shrink-0 transition-colors ${copied ? 'text-green-600 font-semibold' : 'text-gray-400 group-hover:text-blue-500'
                            }`}>
                            {copied ? '✅ Copiado!' : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                        </span>
                    </button>
                    <p className="text-xs text-gray-400 mt-1">
                        {new Date(order.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                    </p>
                </div>

                {/* Itens */}
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                    <h2 className="font-semibold text-gray-800 mb-4">Itens do pedido</h2>
                    <div className="space-y-4">
                        {order.items.map(item => (
                            <div key={item.id} className="flex gap-3 items-start">
                                {/* Foto do produto */}
                                {item.product_image_url ? (
                                    <img
                                        src={item.product_image_url}
                                        alt={item.product_name}
                                        className="w-14 h-14 rounded-xl object-cover border border-gray-100 flex-shrink-0"
                                    />
                                ) : (
                                    <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                                        <Package className="w-6 h-6 text-gray-400" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-gray-800 leading-tight">{item.product_name}</p>
                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                        {item.product_name?.startsWith('Garantia Estendida') ? (
                                            // Item de garantia: mostrar produto coberto (novo formato: "Garantia +12m — Produto")
                                            (() => {
                                                const covered = item.product_name.split(' \u2014 ')[1] || '';
                                                return covered ? (
                                                    <p className="text-xs text-blue-600 font-medium">🛡️ Cobre: {covered}</p>
                                                ) : null;
                                            })()
                                        ) : (
                                            <>
                                                {item.product_color && (
                                                    <p className="text-xs text-gray-500">🎨 {item.product_color}</p>
                                                )}
                                                {(item as any).product_ram && (
                                                    <p className="text-xs text-blue-600 font-medium">💾 {(item as any).product_ram} RAM</p>
                                                )}
                                                {(item as any).product_storage && (
                                                    <p className="text-xs text-blue-600 font-medium">📦 {(item as any).product_storage} GB</p>
                                                )}
                                                {item.product_sku && (
                                                    <p className="text-xs text-gray-400 font-mono">SKU: {item.product_sku}</p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">{item.quantity}x {formatCurrency(item.unit_price)}</p>
                                </div>
                                <p className="font-semibold text-gray-900 text-sm flex-shrink-0">
                                    {formatCurrency(item.subtotal)}
                                </p>
                            </div>
                        ))}
                    </div>
                    <div className="border-t mt-4 pt-3 space-y-1">
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>Subtotal</span>
                            <span>{formatCurrency(order.subtotal)}</span>
                        </div>
                        {order.discount > 0 && (
                            <div className="flex justify-between text-sm text-green-600">
                                <span>Desconto</span>
                                <span>-{formatCurrency(order.discount)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>Frete</span>
                            <span>{order.shipping_cost === 0 ? 'Grátis' : formatCurrency(order.shipping_cost)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-gray-900 pt-1">
                            <span>Total</span>
                            <span className="text-blue-600">{formatCurrency(order.total)}</span>
                        </div>
                    </div>
                </div>

                {/* Dados do pedido */}
                <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
                    <h2 className="font-semibold text-gray-800">Detalhes do pedido</h2>

                    {/* Card de Pagamento */}
                    {(() => {
                        const isPix = order.payment_method === 'pix';
                        const isCard = order.payment_method === 'credit_card' || order.payment_method === 'debit_card';
                        const isDelivery = order.payment_method === 'on_delivery';
                        const gateway = order.payment_gateway === 'mercado_pago' ? 'Mercado Pago' : order.payment_gateway ?? '';
                        const quando = order.delivery_type === 'pickup' ? 'na retirada na loja' : 'na entrega em casa';

                        // Tenta extrair pagamento combinado das notes
                        let notes: any = null;
                        try { notes = order.notes ? JSON.parse(order.notes) : null; } catch { notes = null; }
                        const mp = notes?.mixed_payment;
                        const hasMixedPayment = mp && (mp.cashCents > 0 || mp.cardCents > 0);

                        return (
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
                                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">💳 Pagamento</p>

                                {hasMixedPayment ? (
                                    /* ── Pagamento Combinado ── */
                                    <div className="space-y-2">
                                        {mp.cashCents > 0 && (
                                            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs font-bold text-green-700 uppercase tracking-wide">🟢 PIX / Dinheiro</p>
                                                    <p className="text-xs text-green-600 mt-0.5">Pagamento à vista</p>
                                                </div>
                                                <p className="text-xl font-bold text-green-800">{formatCurrency(mp.cashCents)}</p>
                                            </div>
                                        )}
                                        {mp.cardCents > 0 && mp.cardOption && (
                                            <div className="bg-blue-100 border border-blue-200 rounded-xl px-4 py-3">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">💳 Cartão</p>
                                                        <p className="text-xs text-blue-600 mt-0.5">
                                                            {mp.selectedInstallment}x de {formatCurrency(mp.cardOption.monthlyValue)}
                                                        </p>

                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xl font-bold text-blue-800">{formatCurrency(mp.cardCents)}</p>
                                                        <p className="text-xs text-blue-500">subtotal cartão</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center pt-3 mt-1 border-t border-blue-200">
                                            <span className="text-sm font-semibold text-gray-600">Total do pedido</span>
                                            <span className="text-lg font-bold text-gray-900">{formatCurrency(order.total)}</span>
                                        </div>
                                    </div>
                                ) : (
                                    /* ── Pagamento Simples ── */
                                    <div className="space-y-1.5 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Forma</span>
                                            <span className="font-semibold text-gray-800">
                                                {PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method}
                                            </span>
                                        </div>

                                        {isPix && (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Modalidade</span>
                                                    <span className="font-semibold text-green-700">À vista — {formatCurrency(order.total)}</span>
                                                </div>
                                                {gateway && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Processado por</span>
                                                        <span className="font-semibold text-gray-800">{gateway}</span>
                                                    </div>
                                                )}
                                                <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-xs text-green-800">
                                                    ✅ Escaneie o QR Code ou copie a chave PIX para finalizar o pagamento.
                                                </div>
                                            </>
                                        )}

                                        {isCard && (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Modalidade</span>
                                                    <span className="font-semibold text-gray-800">
                                                        {order.payment_method === 'debit_card' ? 'Débito' : 'Crédito'}
                                                    </span>
                                                </div>
                                                {gateway && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Processado por</span>
                                                        <span className="font-semibold text-gray-800">{gateway}</span>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {isDelivery && (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Quando</span>
                                                    <span className="font-semibold text-gray-800 text-right">
                                                        {order.delivery_type === 'pickup' ? 'Na retirada na loja' : 'Na entrega em casa'}
                                                    </span>
                                                </div>
                                                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800">
                                                    💵 O pagamento de <strong>{formatCurrency(order.total)}</strong> será cobrado {quando}. Tenha o valor em mãos.
                                                </div>
                                            </>
                                        )}

                                        {order.coupon_code && (
                                            <div className="flex justify-between text-green-700 pt-1 border-t border-blue-100">
                                                <span>Cupom</span>
                                                <span className="font-semibold">{order.coupon_code} (-{formatCurrency(order.discount ?? 0)})</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })()}


                    {/* Card de Entrega */}
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                            {order.delivery_type === 'pickup' ? '🏪 Retirada' : '🚚 Entrega'}
                        </p>
                        {order.delivery_type === 'delivery' && order.shipping_address ? (
                            <div className="text-sm space-y-1">
                                <p className="font-medium text-gray-800">
                                    {order.shipping_address.street}
                                    {order.shipping_address.number ? `, ${order.shipping_address.number}` : ''}
                                    {order.shipping_address.complement ? ` — ${order.shipping_address.complement}` : ''}
                                </p>
                                <p className="text-gray-600">
                                    {order.shipping_address.neighborhood && `${order.shipping_address.neighborhood}, `}
                                    {order.shipping_address.city && order.shipping_address.city}
                                    {order.shipping_address.state && `/${order.shipping_address.state}`}
                                    {(order.shipping_address as any).cep && ` — CEP ${(order.shipping_address as any).cep}`}
                                </p>
                                {order.shipping_cost > 0 && (
                                    <p className="text-gray-500 text-xs">Frete: {formatCurrency(order.shipping_cost)}</p>
                                )}
                                {order.notes && (() => {
                                    try {
                                        const parsed = JSON.parse(order.notes);
                                        return parsed.delivery_notes ? (
                                            <div className="mt-2 text-xs bg-yellow-50 text-yellow-800 p-2 rounded border border-yellow-200">
                                                <span className="font-semibold block mb-0.5">Observações:</span>
                                                {parsed.delivery_notes}
                                            </div>
                                        ) : null;
                                    } catch (e) { return null; }
                                })()}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-sm text-gray-700">Retirada presencial na loja. Aguarde confirmação por WhatsApp.</p>
                                {order.notes && (() => {
                                    try {
                                        const parsed = JSON.parse(order.notes);
                                        return parsed.delivery_notes ? (
                                            <div className="mt-2 text-xs bg-yellow-50 text-yellow-800 p-2 rounded border border-yellow-200">
                                                <span className="font-semibold block mb-0.5">Observações da Retirada:</span>
                                                {parsed.delivery_notes}
                                            </div>
                                        ) : null;
                                    } catch (e) { return null; }
                                })()}
                            </div>
                        )}
                    </div>

                    {/* Card de Garantia Estendida — aparece quando pedido inclui garantia */}
                    {(() => {
                        const warrantyItem = order.items.find(i => i.product_name?.startsWith('Garantia Estendida'));
                        if (!warrantyItem) return null;
                        const parts = warrantyItem.product_name.split(' — ');
                        let produtoCoberto = parts[1] || '';
                        const prazoMatch = warrantyItem.product_name.match(/\+(\d+)m/);
                        const meses = prazoMatch ? parseInt(prazoMatch[1]) : 0;
                        const dataCompra = new Date(order.created_at);

                        // A garantia estendida inicia APÓS a garantia da loja
                        // A garantia da loja para ESSE modelo foi extraída no Checkout (Ref: XXd)
                        let diasGarantiaLoja = 90;
                        const refMatch = produtoCoberto.match(/\(Ref:\s*(\d+)d\)/);
                        if (refMatch) {
                            diasGarantiaLoja = parseInt(refMatch[1], 10);
                            produtoCoberto = produtoCoberto.replace(refMatch[0], '').trim();
                        }

                        const dataFimLoja = new Date(dataCompra);
                        dataFimLoja.setDate(dataFimLoja.getDate() + diasGarantiaLoja);

                        const dataInicio = new Date(dataFimLoja);
                        dataInicio.setDate(dataInicio.getDate() + 1);

                        const dataFim = new Date(dataInicio);
                        dataFim.setMonth(dataFim.getMonth() + meses);
                        const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
                        return (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">🛡️ Garantia Estendida</p>
                                {produtoCoberto && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Produto coberto</span>
                                        <span className="font-medium text-gray-800 text-right max-w-[60%]">{produtoCoberto}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm items-center">
                                    <span className="text-gray-500">Garantia da Loja</span>
                                    <div className="text-right">
                                        <span className="font-semibold text-gray-800 block">{diasGarantiaLoja} dias</span>
                                        <span className="text-xs text-gray-500">até {fmtDate(dataFimLoja)}</span>
                                    </div>
                                </div>
                                {meses > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Cobertura Estendida</span>
                                        <span className="font-semibold text-blue-700">+{meses} meses adicionais</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Início da Estendida</span>
                                    <span className="font-medium text-gray-800">{fmtDate(dataInicio)}</span>
                                </div>
                                {meses > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Válida até</span>
                                        <span className="font-semibold text-blue-800">{fmtDate(dataFim)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm pt-1 border-t border-blue-200">
                                    <span className="text-gray-500">Valor pago</span>
                                    <span className="font-semibold text-blue-700">{formatCurrency(warrantyItem.subtotal)}</span>
                                </div>
                            </div>
                        );
                    })()}


                    {/* Cupom de desconto */}
                    {order.coupon_code && (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-1.5">
                            <p className="text-xs font-bold text-green-700 uppercase tracking-wide">🎟️ Cupom de desconto</p>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Código</span>
                                <span className="font-mono font-bold text-green-800">{order.coupon_code}</span>
                            </div>
                            {(order.coupon_discount ?? 0) > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Desconto aplicado</span>
                                    <span className="font-semibold text-green-700">- {formatCurrency(order.coupon_discount ?? 0)}</span>
                                </div>
                            )}
                            <p className="text-xs text-green-600 mt-1">✅ Cupom validado e aplicado ao pedido</p>
                        </div>
                    )}

                    {/* Indicação */}
                    {(() => {
                        let notes: any = null;
                        try { notes = order.notes ? JSON.parse(order.notes) : null; } catch { notes = null; }
                        if (!notes?.referral_name) return null;
                        return (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1.5">
                                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">🤝 Indicação</p>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Indicado por</span>
                                    <span className="font-semibold text-emerald-800">{notes.referral_name}</span>
                                </div>
                                {notes.referral_code && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Código</span>
                                        <span className="font-mono text-emerald-700">{notes.referral_code}</span>
                                    </div>
                                )}
                                <p className="text-xs text-emerald-600 mt-1">🎉 O seu amigo será recompensado com Moedas do Vale!</p>
                            </div>
                        );
                    })()}
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
