/**
 * Cart Context — Carrinho de Compras Online
 * Separado do QuoteCartContext (WhatsApp). Este é para finalizar compras no site.
 * Persiste em localStorage com chave diferente.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';
import type { CatalogProduct } from '@/types/catalog';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';
import { getEffectivePrice } from '../hooks/useEffectiveCustomerType';
import { vpsApiService } from '../services/vpsApiService';

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

    const { customer } = useSupabaseAuth();

    // Sincroniza o carrinho com o backend quando logado
    useEffect(() => {
        // Em ambiente de desenvolvimento local, evita ruído de 500 do endpoint /cart/sync
        if (import.meta.env.DEV) return;
        if (!isHydrated || !customer?.id) return;
        
        const timeoutId = setTimeout(() => {
            const payload = items.map(i => ({ product_id: i.product.id, quantity: i.quantity }));
            vpsApiService.syncCart(customer.id, payload).catch(() => {
                // Silencioso: endpoint /cart/sync pode não existir ainda na VPS
            });
        }, 1500); // 1.5s debounce

        return () => clearTimeout(timeoutId);
    }, [items, customer?.id, isHydrated]);

    const calculateUnitPrice = (product: CatalogProduct, quantity: number): number => {
        // 1. Verifica Kits / Preço por Volume
        if (product.kits && product.kits.length > 0) {
            // Ordena do maior kit para o menor
            const sortedKits = [...product.kits].sort((a, b) => b.quantity - a.quantity);
            const applicableKit = sortedKits.find(k => quantity >= k.quantity);
            if (applicableKit) {
                // Preço unitário = preço total do kit / quantidade do kit
                return Math.floor(applicableKit.price / applicableKit.quantity);
            }
        }

        // 2. Verifica Promoção de Data
        const now = new Date();
        const isPromoActive =
            product.price_promo &&
            product.price_promo > 0 &&
            (!product.promo_start || new Date(product.promo_start) <= now) &&
            (!product.promo_end || new Date(product.promo_end) >= now);

        if (isPromoActive) return product.price_promo as number;

        // 3. Preço Fixo (Baseado no tipo de cliente - retornado em centavos)
        const effectivePriceCents = getEffectivePrice(product, customer);

        // Se houver porcentagem de desconto (usado principalmente em combos)
        if (product.discount_percentage) {
             const discounted = effectivePriceCents * (1 - product.discount_percentage / 100);
             return Math.round(discounted);
        }

        return effectivePriceCents;
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
                const newUnitPrice = calculateUnitPrice(product, totalWanted);
                newItems = prev.map(i =>
                    i.product.id === product.id
                        ? { ...i, quantity: totalWanted, unit_price: newUnitPrice }
                        : i
                );
            } else {
                if (product.track_inventory && product.stock_quantity !== undefined && quantity > product.stock_quantity) {
                    toast.error(`Apenas ${product.stock_quantity} unidades disponíveis em estoque.`);
                    return prev;
                }

                const unit_price = calculateUnitPrice(product, quantity);

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
            const newItems = prev.map(i => {
                if (i.id === id) {
                    return { ...i, quantity, unit_price: calculateUnitPrice(i.product, quantity) };
                }
                return i;
            });
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
