import React, { useState, useEffect } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useSupabaseAuth } from '../../../hooks/useSupabaseAuth';

interface AddressData {
    zipCode: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
}

/**
 * Address Tab Component
 * 
 * Allows customer to edit address with CEP auto-fill
 * Max 300 lines (ANTIGRAVITY protocol)
 */
export const AddressTab: React.FC = () => {
    const { customer, updateProfile } = useSupabaseAuth();
    const [formData, setFormData] = useState<AddressData>({
        zipCode: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: ''
    });
    const [loading, setLoading] = useState(false);
    const [cepLoading, setCepLoading] = useState(false);

    useEffect(() => {
        if (customer?.address) {
            setFormData({
                zipCode: customer.address.zipCode || '',
                street: customer.address.street || '',
                number: customer.address.number || '',
                complement: customer.address.complement || '',
                neighborhood: customer.address.neighborhood || '',
                city: customer.address.city || '',
                state: customer.address.state || ''
            });
        }
    }, [customer]);

    const updateAddress = (field: keyof AddressData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const searchCep = async (cep: string) => {
        const cleanCep = cep.replace(/\D/g, '');
        if (cleanCep.length !== 8) return;

        setCepLoading(true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            const data = await response.json();

            if (!data.erro) {
                setFormData(prev => ({
                    ...prev,
                    street: data.logradouro || '',
                    neighborhood: data.bairro || '',
                    city: data.localidade || '',
                    state: data.uf || ''
                }));
                toast.success('CEP encontrado!');
            } else {
                toast.error('CEP não encontrado');
            }
        } catch (error) {
            console.error('Error fetching CEP:', error);
            toast.error('Erro ao buscar CEP');
        } finally {
            setCepLoading(false);
        }
    };

    const formatCep = (value: string) => {
        const numbers = value.replace(/\D/g, '');
        if (numbers.length <= 5) return numbers;
        return numbers.replace(/(\d{5})(\d{1,3})/, '$1-$2');
    };

    const handleCepChange = (value: string) => {
        const formatted = formatCep(value);
        updateAddress('zipCode', formatted);
    };

    const validateForm = (): boolean => {
        const cepNumbers = formData.zipCode.replace(/\D/g, '');
        if (!cepNumbers || cepNumbers.length !== 8) {
            toast.error('CEP inválido');
            return false;
        }

        if (!formData.street || !formData.number || !formData.neighborhood || !formData.city || !formData.state) {
            toast.error('Preencha todos os campos obrigatórios do endereço');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        setLoading(true);
        try {
            await updateProfile({
                address: {
                    zipCode: formData.zipCode.replace(/\D/g, ''),
                    street: formData.street,
                    number: formData.number,
                    complement: formData.complement,
                    neighborhood: formData.neighborhood,
                    city: formData.city,
                    state: formData.state
                }
            });
            toast.success('Endereço atualizado com sucesso!');
        } catch (error: any) {
            toast.error(error.message || 'Erro ao atualizar endereço');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Endereço</h2>
            <p className="text-slate-600 mb-6">
                Mantenha seu endereço atualizado para entregas
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* CEP */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">
                            CEP *
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={formData.zipCode}
                                onChange={(e) => handleCepChange(e.target.value)}
                                onBlur={(e) => searchCep(e.target.value)}
                                placeholder="00000-000"
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                maxLength={9}
                                required
                            />
                            {cepLoading && (
                                <Loader2 className="absolute right-3 top-3 animate-spin text-blue-600" size={20} />
                            )}
                        </div>
                    </div>
                </div>

                {/* Street and Number */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-3 space-y-2">
                        <label className="text-sm font-semibold text-slate-700">
                            Rua *
                        </label>
                        <input
                            type="text"
                            value={formData.street}
                            onChange={(e) => updateAddress('street', e.target.value)}
                            placeholder="Nome da rua"
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">
                            Número *
                        </label>
                        <input
                            type="text"
                            value={formData.number}
                            onChange={(e) => updateAddress('number', e.target.value)}
                            placeholder="123"
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            required
                        />
                    </div>
                </div>

                {/* Complement */}
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">
                        Complemento
                    </label>
                    <input
                        type="text"
                        value={formData.complement}
                        onChange={(e) => updateAddress('complement', e.target.value)}
                        placeholder="Apto, Bloco, etc (opcional)"
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                </div>

                {/* Neighborhood and City */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">
                            Bairro *
                        </label>
                        <input
                            type="text"
                            value={formData.neighborhood}
                            onChange={(e) => updateAddress('neighborhood', e.target.value)}
                            placeholder="Nome do bairro"
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">
                            Cidade *
                        </label>
                        <input
                            type="text"
                            value={formData.city}
                            onChange={(e) => updateAddress('city', e.target.value)}
                            placeholder="Nome da cidade"
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            required
                        />
                    </div>
                </div>

                {/* State */}
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">
                        Estado *
                    </label>
                    <select
                        value={formData.state}
                        onChange={(e) => updateAddress('state', e.target.value)}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        required
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

                {/* Submit Button */}
                <div className="flex gap-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                <span>Salvando...</span>
                            </>
                        ) : (
                            'Salvar Endereço'
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};
