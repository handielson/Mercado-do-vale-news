/**
 * CompanyAddressSection Component
 * 
 * Handles company address data with CEP search integration
 * 
 * Route: Settings → Company Data → Address Section
 */

import React from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { Company } from '../../types/company';

interface CompanyAddressSectionProps {
    form: Company;
    onChange: (updates: Partial<Company>) => void;
    onCepSearch: () => Promise<void>;
    isLoadingCep: boolean;
    formatCep: (value: string) => string;
}

export const CompanyAddressSection: React.FC<CompanyAddressSectionProps> = ({
    form,
    onChange,
    onCepSearch,
    isLoadingCep,
    formatCep
}) => {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="flex items-center gap-2 font-bold text-slate-800 text-lg mb-6 pb-3 border-b">
                <MapPin size={22} className="text-blue-600" />
                Endereço
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                        CEP
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={form.address.zipCode}
                            onChange={(e) => onChange({
                                address: { ...form.address, zipCode: formatCep(e.target.value) }
                            })}
                            className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="00000-000"
                            maxLength={9}
                        />
                        <button
                            type="button"
                            onClick={onCepSearch}
                            disabled={isLoadingCep}
                            className="bg-blue-100 text-blue-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-200 disabled:opacity-50 transition-all"
                        >
                            {isLoadingCep ? <Loader2 className="animate-spin" size={18} /> : 'Buscar'}
                        </button>
                    </div>
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Cidade
                    </label>
                    <input
                        type="text"
                        value={form.address.city}
                        onChange={(e) => onChange({
                            address: { ...form.address, city: e.target.value }
                        })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="Ex: São Paulo"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Logradouro
                    </label>
                    <input
                        type="text"
                        value={form.address.street}
                        onChange={(e) => onChange({
                            address: { ...form.address, street: e.target.value }
                        })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="Rua, Avenida..."
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Número
                    </label>
                    <input
                        type="text"
                        value={form.address.number}
                        onChange={(e) => onChange({
                            address: { ...form.address, number: e.target.value }
                        })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="123"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Bairro
                    </label>
                    <input
                        type="text"
                        value={form.address.neighborhood}
                        onChange={(e) => onChange({
                            address: { ...form.address, neighborhood: e.target.value }
                        })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="Ex: Centro"
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Estado (UF)
                    </label>
                    <input
                        type="text"
                        value={form.address.state}
                        onChange={(e) => onChange({
                            address: { ...form.address, state: e.target.value.toUpperCase() }
                        })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="SP"
                        maxLength={2}
                    />
                </div>
            </div>

            <div className="mt-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Complemento
                </label>
                <input
                    type="text"
                    value={form.address.complement || ''}
                    onChange={(e) => onChange({
                        address: { ...form.address, complement: e.target.value }
                    })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Apto, Sala, Bloco..."
                />
            </div>
        </div>
    );
};
