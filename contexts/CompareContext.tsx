import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { CatalogProduct } from '../types/catalog';

const MAX_COMPARE = 3;

interface CompareContextValue {
    selected: CatalogProduct[];
    add: (product: CatalogProduct) => string | null; // returns error message or null
    remove: (id: string) => void;
    clear: () => void;
    isSelected: (id: string) => boolean;
}

const noopCompare: CompareContextValue = {
    selected: [],
    add: () => null,
    remove: () => { },
    clear: () => { },
    isSelected: () => false,
};

const CompareContext = createContext<CompareContextValue>(noopCompare);

export function CompareProvider({ children }: { children: ReactNode }) {
    const [selected, setSelected] = useState<CatalogProduct[]>([]);

    const add = useCallback((product: CatalogProduct): string | null => {
        if (selected.find(p => p.id === product.id)) return null;

        if (selected.length >= MAX_COMPARE) {
            return `Limite de ${MAX_COMPARE} produtos atingido`;
        }

        // Block same model (different variants of same product)
        if (product.model_id && selected.some(p => p.model_id === product.model_id)) {
            return 'Este modelo já está na comparação';
        }

        // Enforce same category
        if (selected.length > 0) {
            const firstCategory = selected[0].category_id;
            if (product.category_id && firstCategory && product.category_id !== firstCategory) {
                return 'Compare apenas produtos da mesma categoria';
            }
        }

        setSelected(prev => [...prev, product]);
        return null;
    }, [selected]);

    const remove = useCallback((id: string) => {
        setSelected(prev => prev.filter(p => p.id !== id));
    }, []);

    const clear = useCallback(() => setSelected([]), []);

    const isSelected = useCallback((id: string) => selected.some(p => p.id === id), [selected]);

    return (
        <CompareContext.Provider value={{ selected, add, remove, clear, isSelected }}>
            {children}
        </CompareContext.Provider>
    );
}

export function useCompare() {
    return useContext(CompareContext);
}
