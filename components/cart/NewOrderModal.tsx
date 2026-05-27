import { useState, useEffect } from 'react';
import { X, Send, MapPin, Loader2, Search } from 'lucide-react';
import { vpsApiService } from '@/services/vpsApiService';
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
    grandTotal: number;
    whatsappNumber: string;
    onClose: () => void;
}

interface ItemVariantState {
    availableColors: string[];
    availableMemories: string[];
    selectedColor: string;
    selectedMemory: string;
    hasVariants: boolean;
}

interface AddressForm {
    cep: string;
    rua: string;
    bairro: string;
    cidade: string;
    uf: string;
    numero: string;
    complemento: string;
}

const emptyAddress: AddressForm = {
    cep: '', rua: '', bairro: '', cidade: '', uf: '', numero: '', complemento: ''
};

function hasAvailableStock(product: any): boolean {
    const stock = product?.stock_quantity ?? product?.stock ?? product?.available_stock;
    return Number(stock || 0) > 0;
}

export function NewOrderModal({ items, delivery, paymentLabel, grandTotal, whatsappNumber, onClose }: Props) {
    const [variantStates, setVariantStates] = useState<Record<string, ItemVariantState>>({});
    const [addr, setAddr] = useState<AddressForm>(emptyAddress);
    const [cepLoading, setCepLoading] = useState(false);
    const [cepError, setCepError] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

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
                    const data = await vpsApiService.getProducts({
                        model_id: modelId,
                        status: 'active',
                        limit: 100,
                        compact: true,
                        noCache: true,
                    });

                    const availableProducts = (data || []).filter(hasAvailableStock);

                    if (availableProducts.length === 0) {
                        states[item.id] = {
                            availableColors: [],
                            availableMemories: [],
                            selectedColor: product.specs?.color || '',
                            selectedMemory: '',
                            hasVariants: false,
                        };
                        continue;
                    }

                    const colors = [...new Set(
                        availableProducts.map((p: any) => p.specs?.color || p.specs?.Cor).filter(Boolean)
                    )] as string[];

                    const memories = [...new Set(
                        availableProducts.map((p: any) => {
                            const specs = p.specs || {};
                            const rk = Object.keys(specs).find(k => k.toLowerCase().includes('ram'));
                            const sk = Object.keys(specs).find(k => {
                                const l = k.toLowerCase();
                                return l.includes('armaz') || l.includes('storage');
                            });
                            return [rk ? specs[rk] : '', sk ? specs[sk] : ''].filter(Boolean).join(' / ');
                        }).filter(Boolean)
                    )] as string[];

                    const curSpecs = product.specs || {};
                    const curRk = Object.keys(curSpecs).find(k => k.toLowerCase().includes('ram'));
                    const curSk = Object.keys(curSpecs).find(k => {
                        const l = k.toLowerCase();
                        return l.includes('armaz') || l.includes('storage');
                    });
                    const curMemory = [curRk ? curSpecs[curRk] : '', curSk ? curSpecs[curSk] : ''].filter(Boolean).join(' / ');

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

    const handleCepSearch = async () => {
        const cep = addr.cep.replace(/\D/g, '');
        if (cep.length !== 8) { setCepError('CEP deve ter 8 dígitos'); return; }
        setCepLoading(true);
        setCepError('');
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            if (data.erro) { setCepError('CEP não encontrado'); return; }
            setAddr(prev => ({
                ...prev,
                rua: data.logradouro || '',
                bairro: data.bairro || '',
                cidade: data.localidade || '',
                uf: data.uf || '',
            }));
        } catch {
            setCepError('Erro ao buscar CEP');
        } finally {
            setCepLoading(false);
        }
    };

    const buildAddressString = () => {
        const parts: string[] = [];
        if (addr.rua) parts.push(addr.rua);
        if (addr.numero) parts.push(addr.numero);
        if (addr.complemento) parts.push(addr.complemento);
        if (addr.bairro) parts.push(addr.bairro);
        if (addr.cidade && addr.uf) parts.push(`${addr.cidade}-${addr.uf}`);
        else if (addr.cidade) parts.push(addr.cidade);
        if (addr.cep) parts.push(`CEP ${addr.cep}`);
        return parts.join(', ');
    };

    const handleSend = async () => {
        setSending(true);

        const orderItems: ClientOrderItem[] = items.map(item => ({
            product: item.product,
            unit_price: item.unit_price,
            quantity: item.quantity,
            selected_color: (item.comboSelections || [])
                .map(selection => `${selection.label}: ${selection.option?.name || selection.option?.sku}`)
                .join(' | ') || variantStates[item.id]?.selectedColor,
            selected_memory: variantStates[item.id]?.selectedMemory,
        }));

        const addressStr = buildAddressString();

        const text = generateClientOrderText(orderItems, {
            delivery,
            paymentLabel,
            grandTotal,
            address: addressStr || undefined,
        });

        const encoded = encodeURIComponent(text);
        const phone = whatsappNumber.replace(/\D/g, '');
        window.open(`https://wa.me/55${phone}?text=${encoded}`, '_blank');
        setSending(false);
        onClose();
    };

    const inputCls = "w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all";

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />

                <div className="flex items-center justify-between px-5 pt-3 pb-3 border-b flex-shrink-0">
                    <h2 className="font-bold text-gray-900 text-base">📲 Novo Pedido via WhatsApp</h2>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <X className="w-4 h-4 text-gray-600" />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4 pb-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-sm">Carregando variações...</span>
                        </div>
                    ) : (
                        <>
                            {/* Variações por item */}
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
                                                                : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'}`}
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
                                                                : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-400'}`}
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

                            {/* Endereço com CEP */}
                            <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    <MapPin className="w-3.5 h-3.5" />
                                    Endereço de entrega
                                    <span className="normal-case font-normal text-gray-400">(opcional)</span>
                                </label>

                                {/* CEP + buscar */}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={addr.cep}
                                        onChange={e => {
                                            setAddr(prev => ({ ...prev, cep: e.target.value.replace(/\D/g, '').slice(0, 8) }));
                                            setCepError('');
                                        }}
                                        onKeyDown={e => e.key === 'Enter' && handleCepSearch()}
                                        placeholder="CEP (8 dígitos)"
                                        style={{ fontSize: '16px' }}
                                        className={`${inputCls} flex-1`}
                                    />
                                    <button
                                        onClick={handleCepSearch}
                                        disabled={cepLoading}
                                        className="px-4 py-2.5 bg-green-600 text-white rounded-xl flex items-center gap-1.5 text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition-colors shrink-0"
                                    >
                                        {cepLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                        Buscar
                                    </button>
                                </div>
                                {cepError && <p className="text-xs text-red-500">{cepError}</p>}

                                {/* Rua */}
                                <input
                                    type="text"
                                    value={addr.rua}
                                    onChange={e => setAddr(prev => ({ ...prev, rua: e.target.value }))}
                                    placeholder="Rua / Logradouro"
                                    style={{ fontSize: '16px' }}
                                    className={inputCls}
                                />

                                {/* Número + Complemento */}
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        value={addr.numero}
                                        onChange={e => setAddr(prev => ({ ...prev, numero: e.target.value }))}
                                        placeholder="Nº da casa"
                                        style={{ fontSize: '16px' }}
                                        className={inputCls}
                                    />
                                    <input
                                        type="text"
                                        value={addr.complemento}
                                        onChange={e => setAddr(prev => ({ ...prev, complemento: e.target.value }))}
                                        placeholder="Complemento"
                                        style={{ fontSize: '16px' }}
                                        className={inputCls}
                                    />
                                </div>

                                {/* Bairro */}
                                <input
                                    type="text"
                                    value={addr.bairro}
                                    onChange={e => setAddr(prev => ({ ...prev, bairro: e.target.value }))}
                                    placeholder="Bairro"
                                    style={{ fontSize: '16px' }}
                                    className={inputCls}
                                />

                                {/* Cidade + UF */}
                                <div className="grid grid-cols-[1fr_80px] gap-2">
                                    <input
                                        type="text"
                                        value={addr.cidade}
                                        onChange={e => setAddr(prev => ({ ...prev, cidade: e.target.value }))}
                                        placeholder="Cidade"
                                        style={{ fontSize: '16px' }}
                                        className={inputCls}
                                    />
                                    <input
                                        type="text"
                                        value={addr.uf}
                                        onChange={e => setAddr(prev => ({ ...prev, uf: e.target.value.toUpperCase().slice(0, 2) }))}
                                        placeholder="UF"
                                        style={{ fontSize: '16px' }}
                                        className={`${inputCls} text-center`}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>

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
