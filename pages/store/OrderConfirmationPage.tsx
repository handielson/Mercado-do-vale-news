/**
 * OrderConfirmationPage — Exibida após criação do pedido com sucesso
 */
import { useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { CheckCircle, Package, MapPin, MessageCircle, Copy, Clock, AlertCircle, CreditCard } from 'lucide-react';
import { getOrderById } from '@/services/orderService';
import type { OrderWithItems } from '@/types/order';

export default function OrderConfirmationPage() {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const [order, setOrder] = useState<OrderWithItems | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    // pix_data passado em memória via navigate state (evita race condition com o banco)
    const pixDataFromState = (location.state as any)?.pix_data;

    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        let intervalId: ReturnType<typeof setInterval> | undefined;

        const fetchOnce = async () => {
            const fetchedOrder = await getOrderById(id).catch(() => null);
            if (cancelled) return;
            if (fetchedOrder && pixDataFromState && !fetchedOrder.gateway_pix_data) {
                setOrder({ ...fetchedOrder, gateway_pix_data: pixDataFromState } as any);
            } else {
                setOrder(fetchedOrder);
            }
            // Para o polling assim que o pedido sair de awaiting_payment/pending
            const finalStatuses = ['paid', 'preparing', 'shipped', 'delivered', 'completed', 'cancelled', 'payment_failed'];
            if (fetchedOrder && finalStatuses.includes(fetchedOrder.status) && intervalId) {
                clearInterval(intervalId);
                intervalId = undefined;
            }
        };

        fetchOnce().finally(() => { if (!cancelled) setLoading(false); });
        // Polling: a cada 4s busca o status até confirmar pagamento
        intervalId = setInterval(fetchOnce, 4000);

        return () => {
            cancelled = true;
            if (intervalId) clearInterval(intervalId);
        };
    }, [id, pixDataFromState]);

    // Sem redirecionamento automático — o usuário clica no botão manualmente

    const handleCopyPix = () => {
        if (order?.gateway_pix_data?.qr_code) {
            navigator.clipboard.writeText(order.gateway_pix_data.qr_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const whatsappLink = `https://wa.me/55?text=${encodeURIComponent(
        `Olá! Acabei de fazer meu pedido #${id?.split('-')[0]} pelo site. 😊`
    )}`;

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const isAwaiting = order?.status === 'awaiting_payment' || order?.status === 'pending';
    const hasPix = !!order?.gateway_pix_data?.qr_code_base64 && isAwaiting;
    const hasProCheckoutUrl = order?.gateway_payment_url && order.status === 'awaiting_payment';
    const isPendingPayment = hasPix || hasProCheckoutUrl;

    return (
        <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col items-center justify-center px-4 py-12">
            <div className="max-w-md w-full text-center">
                {/* Ícone de sucesso (Muda se for Pagamento Pendente) */}
                <div className="flex justify-center mb-6">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center ${isPendingPayment ? 'bg-yellow-100' : 'bg-green-100'}`}>
                        {isPendingPayment ? (
                            <Clock className="w-14 h-14 text-yellow-500" />
                        ) : (
                            <CheckCircle className="w-14 h-14 text-green-500" />
                        )}
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {isPendingPayment ? 'Falta pouco!' : 'Pedido finalizado!'}
                </h1>
                <p className="text-gray-500 mb-8">
                    {isPendingPayment
                        ? 'Confirme e realize o seu pagamento abaixo.'
                        : 'Seu pedido foi recebido com sucesso.'
                    }
                </p>

                {/* Bloco PIX (Gerado) */}
                {hasPix && order.gateway_pix_data && (
                    <div className="bg-white border-2 border-yellow-200 rounded-2xl p-6 mb-6 shadow-sm flex flex-col items-center">
                        <img
                            src={`data:image/png;base64,${order.gateway_pix_data.qr_code_base64}`}
                            alt="QR Code PIX"
                            className="w-48 h-48 mb-4 border rounded-xl"
                        />
                        <button
                            onClick={handleCopyPix}
                            className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 px-4 rounded-xl transition"
                        >
                            <Copy className="w-5 h-5" />
                            {copied ? 'Código PIX Copiado!' : 'Copiar código PIX'}
                        </button>
                        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg w-full text-left">
                            <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            <p>Abra o app do seu banco e escolha <b>"Pix Copia e Cola"</b> para colar este código.</p>
                        </div>
                    </div>
                )}

                {/* Bloco PRO Checkout (Cartões) */}
                {hasProCheckoutUrl && (
                    <div className="bg-white border-2 border-yellow-200 rounded-2xl p-6 mb-6 shadow-sm flex flex-col items-center">
                        <div className="bg-blue-50 p-4 rounded-full mb-4 animate-pulse">
                            <CreditCard className="w-10 h-10 text-blue-600" />
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg mb-2">Redirecionando...</h3>
                        <p className="text-gray-500 text-sm mb-6 text-center">
                            Aguarde. Você está sendo levado para o Checkout Seguro do Mercado Pago.
                        </p>
                        <a
                            href={order.gateway_payment_url}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition shadow-lg"
                        >
                            Ir Agora Manualmente
                        </a>
                    </div>
                )}

                {/* Informações do Cliente e Número do pedido */}
                <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6 shadow-sm">
                    <p className="text-sm text-gray-500 mb-1 text-center">Cliente</p>
                    <h2 className="text-base font-bold text-gray-800 text-center mb-4 pb-4 border-b border-gray-100">{order?.customer_name || '...'}</h2>

                    <p className="text-sm text-gray-500 mb-1">Número do pedido</p>
                    <p className="font-mono font-bold text-gray-800 break-all text-sm">#{id?.split('-')[0]}</p>
                </div>

                {/* Próximos passos */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm text-left space-y-4">
                    <h2 className="font-semibold text-gray-800">O que acontece agora?</h2>
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Package className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                            <p className="font-medium text-sm text-gray-800">Separação do pedido</p>
                            <p className="text-xs text-gray-500">Vamos separar seus produtos assim que confirmarmos o pagamento.</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <MapPin className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                            <p className="font-medium text-sm text-gray-800">Acompanhe seu pedido</p>
                            <p className="text-xs text-gray-500">Use o link abaixo para ver o status a qualquer momento.</p>
                        </div>
                    </div>
                </div>

                {/* Ações */}
                <div className="space-y-3">
                    <Link
                        to={`/pedido/${id}`}
                        className="block w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-center hover:bg-blue-700 transition-colors shadow-lg"
                    >
                        Acompanhar pedido
                    </Link>

                    <a
                        href={whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full bg-green-500 text-white py-3 rounded-2xl font-semibold hover:bg-green-600 transition-colors"
                    >
                        <MessageCircle className="w-5 h-5" />
                        Falar no WhatsApp
                    </a>

                    <Link
                        to="/"
                        className="block text-center text-blue-600 py-2 font-medium hover:underline"
                    >
                        Voltar à loja
                    </Link>
                </div>
            </div>
        </div>
    );
}
