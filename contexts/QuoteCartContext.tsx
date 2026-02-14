import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { CatalogProduct } from '@/types/catalog';
import type { InstallmentPlan } from '@/services/installmentCalculator';

/**
 * Quote Cart Item
 */
export interface QuoteCartItem {
    id: string;
    product: CatalogProduct;
    variant: {
        ram: string;
        storage: string;
    };
    availableColors: string[];
    price: number; // effective price in cents
    installmentPlan: InstallmentPlan;
    paymentOptions: {
        showCash: boolean;      // Show cash price in quote
        showInstallment: boolean; // Show installment price in quote
    };
}

/**
 * Quote Cart Context
 */
interface QuoteCartContextType {
    items: QuoteCartItem[];
    addItem: (item: Omit<QuoteCartItem, 'id'>) => void;
    removeItem: (id: string) => void;
    updateItem: (id: string, updates: Partial<Omit<QuoteCartItem, 'id'>>) => void;
    clear: () => void;
}

const QuoteCartContext = createContext<QuoteCartContextType | null>(null);

const STORAGE_KEY = 'mercado_do_vale_quote_cart';

/**
 * Quote Cart Provider
 */
export function QuoteCartProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<QuoteCartItem[]>([]);
    const [isHydrated, setIsHydrated] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                setItems(parsed);
            }
        } catch (error) {
            console.error('Error loading quote cart from localStorage:', error);
        } finally {
            setIsHydrated(true);
        }
    }, []);

    // Save to localStorage whenever items change (after hydration)
    useEffect(() => {
        if (!isHydrated) return;

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        } catch (error) {
            console.error('Error saving quote cart to localStorage:', error);
        }
    }, [items, isHydrated]);

    const addItem = (item: Omit<QuoteCartItem, 'id'>) => {
        const newItem: QuoteCartItem = {
            ...item,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
        setItems(prev => [...prev, newItem]);
    };

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const updateItem = (id: string, updates: Partial<Omit<QuoteCartItem, 'id'>>) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, ...updates } : item
        ));
    };

    const clear = () => {
        setItems([]);
    };

    return (
        <QuoteCartContext.Provider value={{ items, addItem, removeItem, updateItem, clear }}>
            {children}
        </QuoteCartContext.Provider>
    );
}

/**
 * Hook to use Quote Cart
 */
export function useQuoteCart() {
    const context = useContext(QuoteCartContext);
    if (!context) {
        throw new Error('useQuoteCart must be used within QuoteCartProvider');
    }
    return context;
}
