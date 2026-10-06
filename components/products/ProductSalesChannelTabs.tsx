import React from 'react';

// Register new platforms here so the product form shares one channel navigation.
export const PRODUCT_SALES_CHANNELS = [
    { id: 'mercado-livre', label: 'Mercado Livre' },
    { id: 'shopee', label: 'Shopee' },
    { id: 'tiktok', label: 'TikTok Shop' },
    { id: 'sites', label: 'Sites próprios' },
    { id: 'bling', label: 'Bling' },
] as const;

export type ProductSalesChannel = typeof PRODUCT_SALES_CHANNELS[number]['id'];

export function ProductSalesChannelTabs({ activeChannel, onSelect }: {
    activeChannel: ProductSalesChannel;
    onSelect: (channel: ProductSalesChannel) => void;
}) {
    return <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-slate-900">Plataformas de venda</h3>
        <p className="mt-1 text-sm text-slate-500">Escolha a plataforma para consultar seus dados e gerenciar a publicação.</p>
        <div role="tablist" aria-label="Plataformas de venda" className="mt-3 flex flex-wrap gap-2">
            {PRODUCT_SALES_CHANNELS.map((channel) => <button
                key={channel.id} type="button" role="tab"
                id={`product-channel-tab-${channel.id}`}
                aria-controls={`product-channel-panel-${channel.id}`}
                aria-selected={activeChannel === channel.id}
                onClick={() => onSelect(channel.id)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${activeChannel === channel.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >{channel.label}</button>)}
        </div>
    </section>;
}
