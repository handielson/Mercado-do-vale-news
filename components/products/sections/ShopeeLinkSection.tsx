import React, { useState } from 'react';
import { Store, Link2Off, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

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
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSync = async () => {
        if (!productId) {
            toast.error('Você precisa salvar o produto primeiro antes de enviar para a Shopee.');
            return;
        }

        setIsSyncing(true);
        toast.loading('Enviando para a Shopee...', { id: 'shopee-sync' });

        try {
            // Requisição para o backend Vercel, que buscará o produto completo do DB
            // assinará a request HMAC, fará upload das imagens e mandará pra Shopee.
            const res = await fetch('/api/shopee-actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'add_item',
                    product_id: productId
                })
            });

            const data = await res.json();

            if (res.ok && data.item_id) {
                toast.success('Produto enviado com sucesso para a Shopee!', { id: 'shopee-sync' });
                onLink(data.item_id);
            } else {
                toast.error(data.error || 'Erro ao sincronizar com a Shopee.', { id: 'shopee-sync' });
                console.error("Shopee Sync Error:", data);
            }
        } catch (error) {
            toast.error('Erro de conexão ao tentar enviar para a Shopee.', { id: 'shopee-sync' });
            console.error(error);
        } finally {
            setIsSyncing(false);
        }
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
                        <p className="text-sm font-medium text-orange-900">Anúncio ativo na Shopee</p>
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
                Envie este produto como um anúncio para a Shopee. Requer que o produto esteja <strong>salvo</strong> com SKU e Imagens.
            </p>

            <button
                type="button"
                onClick={handleSync}
                disabled={isSyncing || !productId}
                className={`flex items-center justify-center w-full sm:w-auto gap-2 px-4 py-2 ${
                    !productId 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' 
                        : 'bg-[#ee4d2d] hover:bg-[#d74325] text-white shadow-md'
                } rounded-lg transition-all text-sm font-medium`}
            >
                {isSyncing ? (
                    <><Loader2 size={16} className="animate-spin" /> Sincronizando...</>
                ) : (
                    <><Store size={16} /> Enviar Adicionando Estoque</>
                )}
            </button>
            {!productId && (
                <p className="text-xs text-red-500 mt-2">
                    * Salve o produto primeiro para habilitar o envio à Shopee.
                </p>
            )}
        </div>
    );
}
