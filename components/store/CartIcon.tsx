/**
 * CartIcon — Ícone flutuante do carrinho com badge de quantidade
 * Exibido no catálogo público
 */
import { useCart } from '@/contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';

export function CartIcon() {
    const { totalItems } = useCart();
    const navigate = useNavigate();

    if (totalItems === 0) return null;

    return (
        <button
            onClick={() => navigate('/carrinho')}
            className="fixed bottom-6 right-6 z-50 bg-blue-600 text-white rounded-full p-4 shadow-2xl hover:bg-blue-700 transition-all hover:scale-110 active:scale-95"
            aria-label={`Ver carrinho (${totalItems} itens)`}
        >
            <ShoppingCart className="w-6 h-6" />
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {totalItems > 9 ? '9+' : totalItems}
            </span>
        </button>
    );
}
