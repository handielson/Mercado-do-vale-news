import { useState } from 'react';
import { MapPin, Store, Loader2 } from 'lucide-react';
import type { Address } from '@/services/addressLookup';
import { lookupCEP, formatCEP } from '@/services/addressLookup';

export interface DeliveryOption {
    type: 'pickup' | 'delivery';
    address?: Address;
    notes?: string;
}

interface DeliveryOptionsProps {
    selected: DeliveryOption;
    onSelect: (option: DeliveryOption) => void;
}

export function DeliveryOptions({ selected, onSelect }: DeliveryOptionsProps) {
    const [cep, setCep] = useState('');
    const [isLoadingCEP, setIsLoadingCEP] = useState(false);
    const [cepError, setCepError] = useState('');

    // Handle delivery type toggle
    const handleTypeChange = (type: 'pickup' | 'delivery') => {
        onSelect({ ...selected, type, address: type === 'pickup' ? undefined : selected.address });
    };

    // Handle CEP lookup
    const handleCEPLookup = async () => {
        if (!cep) return;

        setIsLoadingCEP(true);
        setCepError('');

        try {
            const address = await lookupCEP(cep);
            onSelect({
                ...selected,
                address: { ...address, number: '', complement: '' }
            });
        } catch (error) {
            setCepError(error instanceof Error ? error.message : 'Erro ao buscar CEP');
        } finally {
            setIsLoadingCEP(false);
        }
    };

    // Handle address field changes
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
        </div>
    );
}
