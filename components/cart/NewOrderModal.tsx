/**
 * NewOrderModal.tsx
 * Mini-modal para cliente selecionar variação (cor + memória) e endereço opcional
 * antes de enviar pedido via WhatsApp.
 */

import { useState, useEffect } from 'react';
import { X, Send, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { generateClientOrderText, type ClientOrderItem } from '@/utils/cartShareUtils';
import type { DeliveryOption } from '@/components/catalog/DeliveryOptions';

interface CartItem {
    id: string;
    product: any;
    unit_price: number;
    quantity: number;
}

interface Props {
    items: CartItem[];
    delivery: DeliveryOption;
    paymentLabel: string;
    grandTotal: number;        // centavos
    whatsappNumber: string;    // número da empresa (sem formatação)
    onClose: () => void;
}

interface SiblingVariant {
    color: string;
    memory: string; // RAM+Storage key, e.g. "6GB / 128GB"
    productId: string;
}

interface ItemVariantState {
    availableColors: string[];
    availableMemories: string[];
    selectedColor: string;
    selectedMemory: string;
    hasVariants: boolean;
}

export function NewOrderModal({ items, delivery, paymentLabel, grandTotal, whatsappNumber, onClose }: Props) {
    const [variantStates, setVariantStates] = useState<Record<string, ItemVariantState>>({});
    const [address, setAddress] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    // Fetch siblings for each item
    useEffect(() => {
        async function loadVariants() {
            setLoading(true);
            const states: Record<string, ItemVariantState> = {};

            for (const item of items) {
                const { product } = item;
                const modelId = product.model_id;

                if (!modelId) {
                    const color = product.specs?.color || product.specs?.Cor || '';
                    const ramKey = Object.keys(product.specs || {}).find(k => k.toLowerCase().includes('ram'));
                    const storKey = Object.keys(product.specs || {}).find(k => {
                        const l = k.toLowerCase();
                        return l.includes('armaz') || l.includes('storage');
                    });
                    const ram = ramKey ? product.specs[ramKey] : '';
                    const stor = storKey ? product.specs[storKey] : '';
                    const memory = [ram, stor].filter(Boolean).join(' / ');

                    states[item.id] = {
                        availableColors: color ? [color] : [],
                        availableMemories: memory ? [memory] : [],
                        selectedColor: color,
                        selectedMemory: memory,
                        hasVariants: false,
                    };
                    continue;
                }

                try {
                    const { data } = await supabase
                        .from('products')
                        .select('id, specs')
                        .eq('model_id', modelId)
                        .gt('stock', 0);

                    if (!data || data.length === 0) {
                        states[item.id] = {
                            availableColors: [],
                            availableMemories: [],
                            selectedColor: product.specs?.color || '',
                            selectedMemory: '',
                            hasVariants: false,
                        };
                        continue;
                    }

                    const colors = [...new Set(data.map((p: any) => p.specs?.color || p.specs?.Cor).filter(Boolean))] as string[];

                    // Build distinct memory combinations (RAM + Storage)
                    const memories = [...new Set(data.map((p: any) => {
                        const specs = p.specs || {};
                        const ramKey = Object.keys(specs).find(k => k.toLowerCase().includes('ram'));
                        const storKey = Object.keys(specs).find(k => {
                            const l = k.toLowerCase();
                            return l.includes('armaz') || l.includes('storage');
                        });
                        const r = ramKey ? specs[ramKey] : '';
                        const s = storKey ? specs[storKey] : '';
                        return [r, s].filter(Boolean).join(' / ');
                    }).filter(Boolean))] as string[];

                    // Pre-select current product values
                    const curSpecs = product.specs || {};
                    const curRamKey = Object.keys(curSpecs).find(k => k.toLowerCase().includes('ram'));
                    const curStorKey = Object.keys(curSpecs).find(k => {
                        const l = k.toLowerCase();
                        return l.includes('armaz') || l.includes('storage');
                    });
                    const curRam = curRamKey ? curSpecs[curRamKey] : '';
                    const curStor = curStorKey ? curSpecs[curStorKey] : '';
                    const curMemory = [curRam, curStor].filter(Boolean).join(' / ');

                    states[item.id] = {
                        availableColors: colors,
                        availableMemories: memories,
                        selectedColor: curSpecs?.color || curSpecs?.Cor || colors[0] || '',
                        selectedMemory: curMemory || memories[0] || '',
                        hasVariants: colors.length > 1 || memories.length > 1,
                    };
                } catch {
                    states[item.id] = {
                        availableColors: [],
                        availableMemories: [],
                        selectedColor: '',
                        selectedMemory: '',
                        hasVariants: false,
                    };
                }
            }

            setVariantStates(states);
            setLoading(false);
        }

        loadVariants();
    }, [items]);

    const handleUpdate = (itemId: string, field: 'selectedColor' | 'selectedMemory', value: string) => {
        setVariantStates(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], [field]: value },
        }));
    };

    const handleSend = async () => {
        setSending(true);

        const orderItems: ClientOrderItem[] = items.map(item => ({
            product: item.product,
            unit_price: item.unit_price,
            quantity: item.quantity,
            selected_color: variantStates[item.id]?.selectedColor,
            selected_memory: variantStates[item.id]?.selectedMemory,
        }));

        const text = generateClientOrderText(orderItems, {
            delivery,
            paymentLabel,
            grandTotal,
            address: address.trim() || undefined,
        });

        const encoded = encodeURIComponent(text);
        const phone = whatsappNumber.replace(/\D/g, '');
        window.open(`https://wa.me/55${phone}?text=${encoded}`, '_blank');
        setSending(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh]">
                {/* Handle */}
                <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />

                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-3 pb-3 border-b flex-shrink-0">
                    <h2 className="font-bold text-gray-900 text-base">📲 Novo Pedido via WhatsApp</h2>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <X className="w-4 h-4 text-gray-600" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4 pb-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-sm">Carregando variações...</span>
                        </div>
                    ) : (
                        <>
                            {/* Per-item variant selection */}
                            {items.map(item => {
                                const state = variantStates[item.id];
                                if (!state) return null;

                                return (
                                    <div key={item.id} className="bg-gray-50 rounded-2xl p-4 space-y-3">
                                        <p className="font-semibold text-sm text-gray-900 leading-tight">{item.product.name}</p>

                                        {state.availableColors.length > 1 && (
                                            <div>
                                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">Cor</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {state.availableColors.map(color => (
                                                        <button
                                                            key={color}
                                                            onClick={() => handleUpdate(item.id, 'selectedColor', color)}
                                                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${state.selectedColor === color
                                                                ? 'bg-blue-600 text-white border-blue-600'
                                                                : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'
                                                                }`}
                                                        >
                                                            {color}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {state.availableMemories.length > 1 && (
                                            <div>
                                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">Memória</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {state.availableMemories.map(mem => (
                                                        <button
                                                            key={mem}
                                                            onClick={() => handleUpdate(item.id, 'selectedMemory', mem)}
                                                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${state.selectedMemory === mem
                                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                                : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-400'
                                                                }`}
                                                        >
                                                            {mem}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {!state.hasVariants && (
                                            <p className="text-xs text-gray-400">Sem variações adicionais.</p>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Optional address */}
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                                    <MapPin className="w-3.5 h-3.5" /> Endereço de entrega <span className="normal-case font-normal text-gray-400">(opcional)</span>
                                </label>
                                <textarea
                                    value={address}
                                    onChange={e => setAddress(e.target.value)}
                                    placeholder="Ex: Rua das Flores, 123 - Centro, Petrolina-PE"
                                    rows={2}
                                    style={{ fontSize: '16px' }}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none transition-all"
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* CTA */}
                <div className="px-4 pb-6 pt-2 flex-shrink-0 border-t">
                    <button
                        onClick={handleSend}
                        disabled={loading || sending}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg disabled:opacity-60"
                    >
                        <Send className="w-4 h-4" />
                        {sending ? 'Abrindo WhatsApp...' : 'Enviar Pedido pelo WhatsApp'}
                    </button>
                </div>
            </div>
        </div>
    );
}
