import { useCart } from '@/contexts/CartContext';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, MessageCircle } from 'lucide-react';
import { formatCurrency } from '@/utils/saleCalculations';

export default function CartPage() {
    const { items, removeItem, updateQuantity, subtotal, totalItems, clear } = useCart();
    const navigate = useNavigate();

    if (items.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
                <ShoppingBag className="w-20 h-20 text-gray-300 mb-6" />
                <h1 className="text-2xl font-bold text-gray-700 mb-2">Carrinho vazio</h1>
                <p className="text-gray-500 mb-8 text-center">
                    Adicione produtos ao carrinho para continuar.
                </p>
                <Link
                    to="/"
                    className="bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                >
                    Ver produtos
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <ShoppingBag className="w-6 h-6 text-blue-600" />
                        <h1 className="text-xl font-bold text-gray-900">
                            Carrinho <span className="text-blue-600">({totalItems})</span>
                        </h1>
                    </div>
                    <button
                        onClick={clear}
                        className="text-sm text-red-500 hover:text-red-700 transition-colors"
                    >
                        Limpar tudo
                    </button>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
                {/* Itens */}
                <div className="space-y-3">
                    {items.map(item => (
                        <div
                            key={item.id}
                            className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm"
                        >
                            {/* Imagem */}
                            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                                {item.product.images?.[0] ? (
                                    <img
                                        src={item.product.images[0]}
                                        alt={item.product.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <ShoppingBag className="w-8 h-8 text-gray-300" />
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 truncate">
                                    {item.product.name}
                                </p>
                                <p className="text-blue-600 font-bold mt-1">
                                    {formatCurrency(item.unit_price)}
                                </p>
                            </div>

                            {/* Quantidade */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                                >
                                    <Minus className="w-4 h-4" />
                                </button>
                                <span className="w-8 text-center font-semibold">{item.quantity}</span>
                                <button
                                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Subtotal + remover */}
                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                <p className="font-bold text-gray-900">
                                    {formatCurrency(item.unit_price * item.quantity)}
                                </p>
                                <button
                                    onClick={() => removeItem(item.id)}
                                    className="text-red-400 hover:text-red-600 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Resumo */}
                <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex justify-between text-gray-600">
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 text-sm">
                        <span>Frete</span>
                        <span>Calculado no próximo passo</span>
                    </div>
                    <div className="border-t pt-3 flex justify-between font-bold text-lg text-gray-900">
                        <span>Total estimado</span>
                        <span className="text-blue-600">{formatCurrency(subtotal)}</span>
                    </div>
                </div>

                {/* Ações */}
                <div className="space-y-3">
                    <button
                        onClick={() => navigate('/checkout')}
                        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-lg"
                    >
                        Finalizar compra
                        <ArrowRight className="w-5 h-5" />
                    </button>

                    <button
                        onClick={() => navigate('/')}
                        className="w-full bg-gray-100 text-gray-700 py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
                    >
                        <MessageCircle className="w-5 h-5 text-green-500" />
                        Cotar no WhatsApp
                    </button>

                    <Link
                        to="/"
                        className="block text-center text-blue-600 py-2 font-medium hover:underline"
                    >
                        ← Continuar comprando
                    </Link>
                </div>
            </div>
        </div>
    );
}
