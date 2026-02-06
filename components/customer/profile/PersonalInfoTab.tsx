import React, { useState } from 'react';
import { Loader2, User, Mail, CreditCard, Phone, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useSupabaseAuth } from '../../../hooks/useSupabaseAuth';

/**
 * Personal Info Tab Component
 * 
 * Allows customer to edit personal information
 * Max 300 lines (ANTIGRAVITY protocol)
 */
export const PersonalInfoTab: React.FC = () => {
    const { customer, updateProfile } = useSupabaseAuth();
    const [formData, setFormData] = useState({
        name: customer?.name || '',
        email: customer?.email || '',
        cpf_cnpj: customer?.cpf_cnpj || '',
        phone: customer?.phone || '',
        birth_date: customer?.birth_date || ''
    });
    const [loading, setLoading] = useState(false);

    const formatPhone = (value: string) => {
        const numbers = value.replace(/\D/g, '');
        if (numbers.length <= 10) {
            return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        }
        return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    };

    const formatCPF = (value: string) => {
        const numbers = value.replace(/\D/g, '');
        if (numbers.length <= 11) {
            return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        }
        return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        if (name === 'phone') {
            setFormData(prev => ({ ...prev, [name]: formatPhone(value) }));
        } else if (name === 'cpf_cnpj') {
            setFormData(prev => ({ ...prev, [name]: formatCPF(value) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const validateForm = (): boolean => {
        if (!formData.name || !formData.email) {
            toast.error('Nome e email são obrigatórios');
            return false;
        }

        if (formData.phone) {
            const phoneNumbers = formData.phone.replace(/\D/g, '');
            if (phoneNumbers.length < 10) {
                toast.error('Telefone inválido');
                return false;
            }
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        setLoading(true);
        try {
            await updateProfile({
                name: formData.name,
                phone: formData.phone ? formData.phone.replace(/\D/g, '') : null,
                birth_date: formData.birth_date || null
            });
            toast.success('Dados atualizados com sucesso!');
        } catch (error: any) {
            toast.error(error.message || 'Erro ao atualizar dados');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Dados Pessoais</h2>
            <p className="text-slate-600 mb-6">
                Mantenha suas informações pessoais atualizadas
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name */}
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">
                        Nome Completo *
                    </label>
                    <div className="relative">
                        <User className="absolute left-3 top-3 text-slate-400" size={18} />
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Seu nome completo"
                            className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            required
                        />
                    </div>
                </div>

                {/* Email (Read-only) */}
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">
                        E-mail
                    </label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                        <input
                            type="email"
                            value={formData.email}
                            className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                            disabled
                        />
                    </div>
                    <p className="text-xs text-slate-500">
                        O email não pode ser alterado. Entre em contato com o suporte se necessário.
                    </p>
                </div>

                {/* CPF/CNPJ (Read-only) */}
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">
                        CPF/CNPJ
                    </label>
                    <div className="relative">
                        <CreditCard className="absolute left-3 top-3 text-slate-400" size={18} />
                        <input
                            type="text"
                            value={formData.cpf_cnpj}
                            className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                            disabled
                        />
                    </div>
                    <p className="text-xs text-slate-500">
                        O CPF/CNPJ não pode ser alterado.
                    </p>
                </div>

                {/* Phone */}
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">
                        Telefone
                    </label>
                    <div className="relative">
                        <Phone className="absolute left-3 top-3 text-slate-400" size={18} />
                        <input
                            type="text"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="(00) 00000-0000"
                            className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        />
                    </div>
                </div>

                {/* Birth Date */}
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">
                        Data de Nascimento
                    </label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-3 text-slate-400" size={18} />
                        <input
                            type="date"
                            name="birth_date"
                            value={formData.birth_date}
                            onChange={handleChange}
                            className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        />
                    </div>
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
                            'Salvar Alterações'
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};
