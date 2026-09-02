/**
 * CartIcon — Atalho do carrinho com badge de quantidade
 * Exibido junto aos controles do catálogo público
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
            type="button"
            onClick={() => navigate('/carrinho')}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95 sm:h-auto sm:w-auto sm:gap-2 sm:px-4"
            aria-label={`Ver carrinho (${totalItems} itens)`}
        >
            <ShoppingCart className="h-5 w-5" />
            <span className="hidden text-sm font-medium sm:inline">Carrinho</span>
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {totalItems > 9 ? '9+' : totalItems}
            </span>
        </button>
    );
}
