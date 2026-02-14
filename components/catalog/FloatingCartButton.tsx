import { ShoppingCart } from 'lucide-react';
import { useQuoteCart } from '@/contexts/QuoteCartContext';

interface FloatingCartButtonProps {
    onClick: () => void;
}

export function FloatingCartButton({ onClick }: FloatingCartButtonProps) {
    const { items } = useQuoteCart();

    if (items.length === 0) return null;

    return (
        <button
            onClick={onClick}
            className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all"
        >
            <ShoppingCart className="w-5 h-5" />
            <span>Orçamento ({items.length})</span>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold animate-pulse">
                {items.length}
            </div>
        </button>
    );
}
