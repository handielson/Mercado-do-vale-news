import React from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import { CustomerAddress } from '../../types/customer';
import { formatCep } from '../../utils/cpfCnpjValidation';
import { getGoogleMapsUrl } from '../../utils/customerFormUtils';

interface CustomerAddressSectionProps {
    address: Partial<CustomerAddress>;
    onAddressUpdate: (field: string, value: string) => void;
    onCepSearch: (cep: string) => Promise<void>;
}

export default function CustomerAddressSection({
    address,
    onAddressUpdate,
    onCepSearch
}: CustomerAddressSectionProps) {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-slate-900">Endereço</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        CEP
                    </label>
                    <input
                        type="text"
                        value={address?.zipCode || ''}
                        onChange={(e) => onAddressUpdate('zipCode', e.target.value)}
                        onBlur={(e) => onCepSearch(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="00000-000"
                        maxLength={9}
                    />
                </div>

                <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Rua
                    </label>
                    <input
                        type="text"
                        value={address?.street || ''}
                        onChange={(e) => onAddressUpdate('street', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Nome da rua"
                    />
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Número
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={address?.number || ''}
                            onChange={(e) => onAddressUpdate('number', e.target.value)}
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="123"
                        />
                        {getGoogleMapsUrl(address) && (
                            <a
                                href={getGoogleMapsUrl(address)!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                title="Abrir no Google Maps"
                            >
                                <ExternalLink className="w-5 h-5" />
                            </a>
                        )}
                    </div>
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Complemento
                    </label>
                    <input
                        type="text"
                        value={address?.complement || ''}
                        onChange={(e) => onAddressUpdate('complement', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Apto, Bloco, etc"
                    />
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Bairro
                    </label>
                    <input
                        type="text"
                        value={address?.neighborhood || ''}
                        onChange={(e) => onAddressUpdate('neighborhood', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Nome do bairro"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Cidade
                    </label>
                    <input
                        type="text"
                        value={address?.city || ''}
                        onChange={(e) => onAddressUpdate('city', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Nome da cidade"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Estado
                    </label>
                    <select
                        value={address?.state || ''}
                        onChange={(e) => onAddressUpdate('state', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">Selecione...</option>
                        <option value="AC">Acre</option>
                        <option value="AL">Alagoas</option>
                        <option value="AP">Amapá</option>
                        <option value="AM">Amazonas</option>
                        <option value="BA">Bahia</option>
                        <option value="CE">Ceará</option>
                        <option value="DF">Distrito Federal</option>
                        <option value="ES">Espírito Santo</option>
                        <option value="GO">Goiás</option>
                        <option value="MA">Maranhão</option>
                        <option value="MT">Mato Grosso</option>
                        <option value="MS">Mato Grosso do Sul</option>
                        <option value="MG">Minas Gerais</option>
                        <option value="PA">Pará</option>
                        <option value="PB">Paraíba</option>
                        <option value="PR">Paraná</option>
                        <option value="PE">Pernambuco</option>
                        <option value="PI">Piauí</option>
                        <option value="RJ">Rio de Janeiro</option>
                        <option value="RN">Rio Grande do Norte</option>
                        <option value="RS">Rio Grande do Sul</option>
                        <option value="RO">Rondônia</option>
                        <option value="RR">Roraima</option>
                        <option value="SC">Santa Catarina</option>
                        <option value="SP">São Paulo</option>
                        <option value="SE">Sergipe</option>
                        <option value="TO">Tocantins</option>
                    </select>
                </div>
            </div>
        </div>
    );
}
