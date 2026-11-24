// bot-focus-product-v1: "celular em foco" do robô — um produto por vez (estrela no card do produto).
import { useEffect, useState } from 'react';
import { vpsClient } from './vpsClient';

type Focus = { product_id: string; name?: string; sku?: string } | null;

let current: Focus = null;
let loaded: Promise<void> | null = null;
const listeners = new Set<(focus: Focus) => void>();
const emit = () => { for (const fn of listeners) fn(current); };

function load() {
    if (!loaded) {
        loaded = vpsClient.get<{ focus: Focus }>('/admin/bot-focus-product')
            .then((r) => { current = r?.focus?.product_id ? r.focus : null; emit(); })
            .catch(() => { loaded = null; });
    }
    return loaded;
}

export const botFocusProductService = {
    // Escolher um produto troca o foco (só um por vez); tocar de novo no mesmo tira o foco.
    async toggle(productId: string): Promise<Focus> {
        const next = current?.product_id === productId ? null : productId;
        const r = await vpsClient.put<{ focus: Focus }>('/admin/bot-focus-product', { product_id: next });
        current = r?.focus?.product_id ? r.focus : null;
        emit();
        return current;
    },
};

export function useBotFocusProductId(): string | null {
    const [focus, setFocus] = useState<Focus>(current);
    useEffect(() => {
        listeners.add(setFocus);
        void load();
        return () => { listeners.delete(setFocus); };
    }, []);
    return focus?.product_id || null;
}
