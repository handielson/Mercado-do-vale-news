import React from 'react';
import { Store, Link2Off, ExternalLink } from 'lucide-react';

interface ShopeeLinkSectionProps {
    productId: string | undefined; // ID interno, só disponível se estiver editando
    shopeeItemId?: number;
    onLink: (shopeeItemId: number) => void;
    onUnlink: () => void;
}

/**
 * ShopeeLinkSection — Seção do formulário para enviar/vincular um produto à Shopee.
 */
export function ShopeeLinkSection({ productId, shopeeItemId, onLink, onUnlink }: ShopeeLinkSectionProps) {
    void onLink; // Mantido por compatibilidade com o formulário; novos vínculos são geridos na central M/G.

    const openShopeeManager = () => {
        if (!productId) return;
        window.location.assign(`/admin/settings/shopee?tab=products&product_id=${encodeURIComponent(productId)}`);
    };

    // Produto já vinculado
    if (shopeeItemId) {
        return (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-4">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Store size={18} className="text-[#ee4d2d]" />
                    Integração Shopee
                </h3>
                <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-[#ee4d2d] shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-orange-900">Anúncio ativo na Shopee M — Mercado do Vale</p>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="font-mono text-xs text-orange-700">Item ID: {shopeeItemId}</span>
                            <a
                                href={`https://seller.shopee.com.br/portal/product/${shopeeItemId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-orange-700 hover:text-orange-900 transition-colors"
                            >
                                Ver na Shopee <ExternalLink size={10} />
                            </a>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onUnlink}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                    >
                        <Link2Off size={12} />
                        Desvincular
                    </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                    💡 Alterações de estoque e preço agora são refletidas automaticamente.
                </p>
            </div>
        );
    }

    // Produto sem vínculo 
    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-4">
            <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
                <Store size={18} className="text-slate-400" />
                Integração Shopee
                <span className="ml-2 text-xs font-normal text-slate-400">(opcional)</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
                Abra o gerenciador para escolher explicitamente a loja <strong>M (Mercado do Vale)</strong> ou <strong>G (Gláucia)</strong>.
            </p>

            <button
                type="button"
                onClick={openShopeeManager}
                disabled={!productId}
                className={`flex items-center justify-center w-full sm:w-auto gap-2 px-4 py-2 ${
                    !productId 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' 
                        : 'bg-[#ee4d2d] hover:bg-[#d74325] text-white shadow-md'
                } rounded-lg transition-all text-sm font-medium`}
            >
                <><Store size={16} /> Escolher loja M/G e publicar</>
            </button>
            {!productId && (
                <p className="text-xs text-red-500 mt-2">
                    * Salve o produto primeiro para habilitar o envio à Shopee.
                </p>
            )}
        </div>
    );
}
