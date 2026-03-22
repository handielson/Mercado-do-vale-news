/**
 * Cart Context — Carrinho de Compras Online
 * Separado do QuoteCartContext (WhatsApp). Este é para finalizar compras no site.
 * Persiste em localStorage com chave diferente.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';
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
    isHydrated: boolean;         // true após carregar do localStorage
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

    // Helper to safely save to localStorage
    const saveToStorage = (newItems: CartItem[]) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
        } catch {
            // quota exceeded
        }
    };

    const addItem = (product: CatalogProduct, quantity = 1) => {
        setItems(prev => {
            const existing = prev.find(i => i.product.id === product.id);
            let newItems: CartItem[];
            if (existing) {
                const totalWanted = existing.quantity + quantity;
                if (product.track_inventory && product.stock_quantity !== undefined && totalWanted > product.stock_quantity) {
                    toast.error(`Apenas ${product.stock_quantity} unidades disponíveis em estoque do produto ${product.name}.`);
                    return prev;
                }
                newItems = prev.map(i =>
                    i.product.id === product.id
                        ? { ...i, quantity: totalWanted }
                        : i
                );
            } else {
                if (product.track_inventory && product.stock_quantity !== undefined && quantity > product.stock_quantity) {
                    toast.error(`Apenas ${product.stock_quantity} unidades disponíveis em estoque.`);
                    return prev;
                }

                const now = new Date();
                const isPromoActive =
                    product.price_promo &&
                    product.price_promo > 0 &&
                    (!product.promo_start || new Date(product.promo_start) <= now) &&
                    (!product.promo_end || new Date(product.promo_end) >= now);

                const unit_price = isPromoActive
                    ? (product.price_promo as number)
                    : product.price_retail;

                newItems = [
                    ...prev,
                    {
                        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                        product,
                        quantity,
                        unit_price,
                    }
                ];
            }
            saveToStorage(newItems);
            return newItems;
        });
    };

    const removeItem = (id: string) => {
        setItems(prev => {
            const newItems = prev.filter(i => i.id !== id);
            saveToStorage(newItems);
            return newItems;
        });
    };

    const updateQuantity = (id: string, quantity: number) => {
        if (quantity <= 0) {
            removeItem(id);
            return;
        }
        setItems(prev => {
            const item = prev.find(i => i.id === id);
            if (item && item.product.track_inventory && item.product.stock_quantity !== undefined) {
                if (quantity > item.product.stock_quantity) {
                    toast.error(`Estoque máximo atingido: ${item.product.stock_quantity} unidades.`);
                    return prev;
                }
            }
            const newItems = prev.map(i => i.id === id ? { ...i, quantity } : i);
            saveToStorage(newItems);
            return newItems;
        });
    };

    const clear = () => {
        setItems([]);
        saveToStorage([]);
    };

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
            isHydrated,
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
