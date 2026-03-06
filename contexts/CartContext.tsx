/**
 * Cart Context — Carrinho de Compras Online
 * Separado do QuoteCartContext (WhatsApp). Este é para finalizar compras no site.
 * Persiste em localStorage com chave diferente.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { CatalogProduct } from '@/types/catalog';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface CartItem {
    id: string;                  // UUID temporário gerado no frontend
    product: CatalogProduct;
    quantity: number;
    unit_price: number;          // em centavos (preço efetivo)
}

interface CartContextType {
    items: CartItem[];
    addItem: (product: CatalogProduct, quantity?: number) => void;
    removeItem: (id: string) => void;
    updateQuantity: (id: string, quantity: number) => void;
    clear: () => void;
    totalItems: number;
    subtotal: number;            // em centavos
}

// ─── Context ──────────────────────────────────────────────────────────────────

const CartContext = createContext<CartContextType | null>(null);

const STORAGE_KEY = 'mercado_do_vale_cart';

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);
    const [isHydrated, setIsHydrated] = useState(false);

    // Carrega do localStorage na montagem
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) setItems(JSON.parse(stored));
        } catch {
            // localStorage corrompido — ignora
        } finally {
            setIsHydrated(true);
        }
    }, []);

    // Salva no localStorage quando items mudam (após hidratação)
    useEffect(() => {
        if (!isHydrated) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        } catch {
            // quota exceeded — ignora
        }
    }, [items, isHydrated]);

    const addItem = (product: CatalogProduct, quantity = 1) => {
        setItems(prev => {
            // Se já existe o mesmo produto, incrementa quantidade
            const existing = prev.find(i => i.product.id === product.id);
            if (existing) {
                return prev.map(i =>
                    i.product.id === product.id
                        ? { ...i, quantity: i.quantity + quantity }
                        : i
                );
            }
            // Determina o preço efetivo (considera promo ativa)
            const now = new Date();
            const isPromoActive =
                product.price_promo &&
                product.price_promo > 0 &&
                (!product.promo_start || new Date(product.promo_start) <= now) &&
                (!product.promo_end || new Date(product.promo_end) >= now);

            const unit_price = isPromoActive
                ? (product.price_promo as number)
                : product.price_retail;

            return [
                ...prev,
                {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    product,
                    quantity,
                    unit_price,
                }
            ];
        });
    };

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const updateQuantity = (id: string, quantity: number) => {
        if (quantity <= 0) {
            removeItem(id);
            return;
        }
        setItems(prev => prev.map(i => i.id === id ? { ...i, quantity } : i));
    };

    const clear = () => setItems([]);

    const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

    return (
        <CartContext.Provider value={{
            items,
            addItem,
            removeItem,
            updateQuantity,
            clear,
            totalItems,
            subtotal,
        }}>
            {children}
        </CartContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCart() {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCart must be used within CartProvider');
    return context;
}
