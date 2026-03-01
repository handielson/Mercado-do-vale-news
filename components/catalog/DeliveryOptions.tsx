import { useState, useEffect } from 'react';
import { MapPin, Store, Loader2, Truck, Check, Map } from 'lucide-react';
import type { Address } from '@/services/addressLookup';
import { lookupCEP, formatCEP } from '@/services/addressLookup';
import { shippingService } from '@/services/shippingService';
import { companySettingsService } from '@/services/companySettingsService';
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
}

export function DeliveryOptions({ selected, onSelect, storeStatus }: DeliveryOptionsProps) {
    const [cep, setCep] = useState('');
    const [isLoadingCEP, setIsLoadingCEP] = useState(false);
    const [cepError, setCepError] = useState('');
    const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
    const [isLoadingShipping, setIsLoadingShipping] = useState(false);
    const [storeAddress, setStoreAddress] = useState('');

    useEffect(() => {
        companySettingsService.get().then(settings => {
            if (settings?.address) {
                setStoreAddress(settings.address);
            }
        }).catch(console.error);
    }, []);

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

            // Calculate shipping after address lookup
            setIsLoadingShipping(true);
            try {
                const options = await shippingService.calculate({ to_cep: cep });
                setShippingOptions(options);
                if (options.length > 0) {
                    onSelect({ ...baseOption, shippingOption: options[0] });
                }
            } catch {
                // Shipping calc is optional
            } finally {
                setIsLoadingShipping(false);
            }
        } catch (error) {
            setCepError(error instanceof Error ? error.message : 'Erro ao buscar CEP');
        } finally {
            setIsLoadingCEP(false);
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
                                    readOnly
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50"
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
                                    readOnly
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50"
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
                            <label className="block text-xs font-medium text-slate-600 mb-2">
                                🚚 Opções de Frete
                            </label>
                            <div className="space-y-2">
                                {shippingOptions.map((opt) => {
                                    const isSelected = selected.shippingOption?.id === opt.id;
                                    return (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => onSelect({ ...selected, shippingOption: opt })}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border-2 text-left transition-all ${isSelected
                                                ? 'border-green-500 bg-green-50'
                                                : 'border-slate-200 bg-white hover:border-slate-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Truck className={`w-4 h-4 ${isSelected ? 'text-green-600' : 'text-slate-400'}`} />
                                                <div>
                                                    <p className={`text-sm font-medium ${isSelected ? 'text-green-800' : 'text-slate-700'}`}>
                                                        {opt.name}
                                                    </p>
                                                    {storeStatus && storeStatus.status !== 'open' && opt.daysLabel === 'Hoje' ? null : (
                                                        <p className="text-xs text-slate-500">{opt.daysLabel}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-bold ${opt.isFree ? 'text-green-600' : 'text-slate-800'}`}>
                                                    {opt.isFree ? 'Grátis' : `R$ ${opt.price.toFixed(2).replace('.', ',')}`}
                                                </span>
                                                {isSelected && <Check className="w-4 h-4 text-green-600" />}
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

                    {/* Delivery Notes */}
                    <div>
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
                </div>
            )}

            {/* Pickup Info */}
            {selected.type === 'pickup' && storeAddress && (
                <div className="mt-4 p-4 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-3">
                    <Store className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-semibold text-blue-900 mb-1">Nosso Endereço</h4>
                        <p className="text-sm text-blue-800 mb-3 leading-relaxed">{storeAddress}</p>
                        <a
                            href={`https://maps.google.com/?q=${encodeURIComponent(storeAddress)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors shadow-sm active:scale-95"
                        >
                            <Map className="w-4 h-4" />
                            Abrir no Google Maps
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
