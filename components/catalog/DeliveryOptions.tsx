import { useState, useEffect } from 'react';
import { MapPin, Store, Loader2, Truck, Check, Map, ChevronDown } from 'lucide-react';
import type { Address } from '@/services/addressLookup';
import { lookupCEP, formatCEP } from '@/services/addressLookup';
import { shippingService } from '@/services/shippingService';
import { publicCompanySettingsService } from '@/services/publicCompanySettings';
import type { ShippingOption } from '@/types/shipping';
import { getStoreStatus, type StoreStatus } from '@/utils/storeStatus';

export interface DeliveryOption {
    type: 'pickup' | 'delivery';
    address?: Address;
    notes?: string;
    shippingOption?: ShippingOption;
}

interface DeliveryOptionsProps {
    selected: DeliveryOption;
    onSelect: (option: DeliveryOption) => void;
    storeStatus?: StoreStatus | null;
    subtotal?: number;
    cartVolume?: { weight: number; height: number; width: number; length: number };
    orderCost?: number;
}

export function DeliveryOptions({ selected, onSelect, storeStatus, subtotal, cartVolume, orderCost }: DeliveryOptionsProps) {
    const [cep, setCep] = useState(selected.address?.cep || '');
    const [isLoadingCEP, setIsLoadingCEP] = useState(false);
    const [cepError, setCepError] = useState('');
    const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
    const [isLoadingShipping, setIsLoadingShipping] = useState(false);
    const [storeAddress, setStoreAddress] = useState('');
    const [addressOpen, setAddressOpen] = useState(false);
    const [missingForFree, setMissingForFree] = useState<number | undefined>(undefined);

    useEffect(() => {
        publicCompanySettingsService.get().then(settings => {
            if (settings?.address) {
                setStoreAddress(settings.address);
            }
        }).catch(console.error);
    }, []);

    useEffect(() => {
        // Limpamos o log e relaxamos a exigência de igualdade estrita do CEP
        // Se o usuário já buscou um cep válido (selected.address.cep existe), 
        // sempre reculculamos o frete reagindo às mudanças de subtotal.
        if (selected.address?.cep && !cepError) {
            shippingService.calculate({ to_cep: selected.address.cep, order_value: subtotal, order_cost: orderCost, ...cartVolume })
                .then(res => {
                    setShippingOptions(res.options);
                    setMissingForFree(res.missingForFree);
                    // Atualiza a opção selecionada se a atual não bater ou sumir
                    if (selected.shippingOption && !res.options.find(o => o.id === selected.shippingOption!.id)) {
                         onSelect({ ...selected, shippingOption: res.options.length > 0 ? res.options[0] : undefined });
                    }
                })
                .catch(() => { });
        }
    }, [selected.address?.cep, subtotal, orderCost, cepError, cartVolume]);

    const handleTypeChange = (type: 'pickup' | 'delivery') => {
        onSelect({ ...selected, type, address: type === 'pickup' ? undefined : selected.address });
    };

    const handleCEPLookup = async () => {
        if (!cep) return;

        setIsLoadingCEP(true);
        setCepError('');
        setShippingOptions([]);
        
        try {
            const address = await lookupCEP(cep);
            const baseOption: DeliveryOption = {
                ...selected,
                address: { ...address, number: '', complement: '' },
                shippingOption: undefined,
            };
            onSelect(baseOption);

            setIsLoadingShipping(true);
            const res = await shippingService.calculate({ to_cep: cep, order_value: subtotal, order_cost: orderCost, ...cartVolume });
            setShippingOptions(res.options);
            setMissingForFree(res.missingForFree);
            
            if (res.options.length > 0) {
                onSelect({ ...baseOption, shippingOption: res.options[0] });
            }
        } catch (error) {
            setCepError(error instanceof Error ? error.message : 'Erro ao buscar CEP');
        } finally {
            setIsLoadingCEP(false);
            setIsLoadingShipping(false);
        }
    };

    const handleAddressChange = (field: keyof Address, value: string) => {
        if (!selected.address) return;
        onSelect({
            ...selected,
            address: { ...selected.address, [field]: value }
        });
    };

    return (
        <div className="space-y-4">
            <label className="block text-sm font-semibold text-slate-700 mb-3">
                Opção de Entrega
            </label>

            {/* Delivery Type Toggle */}
            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={() => handleTypeChange('pickup')}
                    className={`
                        p-4 rounded-lg border-2 transition-all duration-200
                        ${selected.type === 'pickup'
                            ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-md'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }
                    `}
                >
                    <Store className={`w-6 h-6 mx-auto mb-2 ${selected.type === 'pickup' ? 'text-blue-600' : 'text-slate-400'}`} />
                    <p className={`text-sm font-medium ${selected.type === 'pickup' ? 'text-blue-700' : 'text-slate-600'}`}>
                        Retirar na Loja
                    </p>
                </button>

                <button
                    onClick={() => handleTypeChange('delivery')}
                    className={`
                        p-4 rounded-lg border-2 transition-all duration-200
                        ${selected.type === 'delivery'
                            ? 'border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 shadow-md'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }
                    `}
                >
                    <MapPin className={`w-6 h-6 mx-auto mb-2 ${selected.type === 'delivery' ? 'text-green-600' : 'text-slate-400'}`} />
                    <p className={`text-sm font-medium ${selected.type === 'delivery' ? 'text-green-700' : 'text-slate-600'}`}>
                        Receber em Casa
                    </p>
                </button>
            </div>

            {/* Delivery Address Form */}
            {selected.type === 'delivery' && (
                <div className="space-y-3 pt-2">
                    {/* CEP Input */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                            CEP
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={cep}
                                onChange={(e) => setCep(formatCEP(e.target.value))}
                                onBlur={handleCEPLookup}
                                placeholder="00000-000"
                                maxLength={9}
                                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <button
                                onClick={handleCEPLookup}
                                disabled={isLoadingCEP || !cep}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoadingCEP ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    'Buscar'
                                )}
                            </button>
                        </div>
                        {cepError && (
                            <p className="text-xs text-red-600 mt-1">{cepError}</p>
                        )}
                    </div>

                    {/* Address Fields */}
                    {selected.address && (
                        <>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                    Logradouro
                                </label>
                                <input
                                    type="text"
                                    value={selected.address.street}
                                    onChange={(e) => handleAddressChange('street', e.target.value)}
                                    placeholder="Rua, avenida, etc."
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Número *
                                    </label>
                                    <input
                                        type="text"
                                        value={selected.address.number || ''}
                                        onChange={(e) => handleAddressChange('number', e.target.value)}
                                        placeholder="123"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Complemento
                                    </label>
                                    <input
                                        type="text"
                                        value={selected.address.complement || ''}
                                        onChange={(e) => handleAddressChange('complement', e.target.value)}
                                        placeholder="Apto 45"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                    Bairro
                                </label>
                                <input
                                    type="text"
                                    value={selected.address.neighborhood}
                                    onChange={(e) => handleAddressChange('neighborhood', e.target.value)}
                                    placeholder="Bairro"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Cidade
                                    </label>
                                    <input
                                        type="text"
                                        value={selected.address.city}
                                        readOnly
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Estado
                                    </label>
                                    <input
                                        type="text"
                                        value={selected.address.state}
                                        readOnly
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Shipping Options */}
                    {isLoadingShipping && (
                        <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Calculando frete...
                        </div>
                    )}
                    {!isLoadingShipping && shippingOptions.length > 0 && (
                        <div>
                            {/* Delivery Notes */}
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                    Observações (opcional)
                                </label>
                                <textarea
                                    value={selected.notes || ''}
                                    onChange={(e) => onSelect({ ...selected, notes: e.target.value })}
                                    placeholder="Ex: Portão azul, interfone 45"
                                    rows={2}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                />
                            </div>

                            {/* Progress Bar / Aviso de Frete Grátis */}
                            {missingForFree !== undefined && missingForFree > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-3 shadow-sm">
                                    <span className="text-xl">🚚</span>
                                    <div>
                                        <p className="text-sm font-semibold text-amber-800">
                                            Falta pouco para frete grátis!
                                        </p>
                                        <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                                            Adicione mais <strong>R$ {missingForFree.toFixed(2).replace('.', ',')}</strong> em produtos no seu carrinho e ganhe <strong>Entrega Grátis</strong> para a sua região.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <label className="block text-xs font-medium text-slate-600 mb-2">
                                🚚 Opções de Frete
                            </label>
                            <div className="space-y-2">
                                {shippingOptions.map((opt, i) => {
                                    const isSelected = selected.shippingOption?.id === opt.id;
                                    return (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => onSelect({ ...selected, shippingOption: opt })}
                                            style={{ animationDelay: `${i * 70}ms` }}
                                            className={`
                                                w-full flex items-center justify-between px-3 py-3 rounded-xl border-2 text-left
                                                transition-all duration-200 animate-slide-up
                                                ${isSelected
                                                    ? 'border-green-500 bg-green-50 shadow-[0_0_0_3px_rgba(34,197,94,0.12)]'
                                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5'
                                                }
                                            `}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${isSelected ? 'bg-green-100' : 'bg-slate-100'}`}>
                                                    <Truck className={`w-4 h-4 transition-colors duration-200 ${isSelected ? 'text-green-600' : 'text-slate-400'}`} />
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-semibold transition-colors duration-200 ${isSelected ? 'text-green-800' : 'text-slate-700'}`}>
                                                        {opt.name}
                                                    </p>
                                                    {storeStatus && storeStatus.status !== 'open' && opt.daysLabel === 'Hoje' ? null : (
                                                        <p className="text-xs text-slate-400 mt-0.5">{opt.daysLabel}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2.5">
                                                <div className="flex flex-col items-end">
                                                    {opt.subsidy && opt.originalPrice ? (
                                                        <>
                                                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100 mb-0.5 whitespace-nowrap">
                                                                🎁 Subsídio Loja
                                                            </span>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[11px] text-slate-400 line-through">
                                                                    R$ {opt.originalPrice.toFixed(2).replace('.', ',')}
                                                                </span>
                                                                <span className={`text-sm font-bold transition-colors duration-200 ${opt.isFree ? 'text-green-600' : isSelected ? 'text-green-700' : 'text-slate-800'}`}>
                                                                    {opt.isFree ? 'Grátis' : `R$ ${opt.price.toFixed(2).replace('.', ',')}`}
                                                                </span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <span className={`text-sm font-bold transition-colors duration-200 ${opt.isFree ? 'text-green-600' : isSelected ? 'text-green-700' : 'text-slate-800'}`}>
                                                            {opt.isFree ? 'Grátis' : `R$ ${opt.price.toFixed(2).replace('.', ',')}`}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 ${isSelected ? 'bg-green-500 scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
                                                    <Check className="w-3 h-3 text-white" />
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                        </div>
                    )}
                    {!isLoadingShipping && selected.address && shippingOptions.length === 0 && (
                        <p className="text-xs text-slate-500 italic">
                            Nenhuma opção de frete encontrada para este CEP.
                        </p>
                    )}

                </div>
            )}

            {/* Pickup Info — recolhível */}
            {selected.type === 'pickup' && storeAddress && (
                <div className="mt-3 rounded-xl border border-slate-200 overflow-hidden">
                    <button
                        onClick={() => setAddressOpen(o => !o)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                        <span className="flex items-center gap-2 text-sm font-medium text-blue-800">
                            <Store className="w-4 h-4 text-blue-600" />
                            Ver endereço da loja
                        </span>
                        <ChevronDown className={`w-4 h-4 text-blue-500 transition-transform duration-200 ${addressOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {addressOpen && (
                        <div className="px-4 py-3 bg-white space-y-3">
                            <p className="text-sm text-slate-700 leading-relaxed">{storeAddress}</p>
                            <a
                                href={`https://maps.google.com/?q=${encodeURIComponent(storeAddress)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors shadow-sm"
                            >
                                <Map className="w-4 h-4" />
                                Abrir no Google Maps
                            </a>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
