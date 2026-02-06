import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { useSupabaseAuth as useAuth } from '../../hooks/useSupabaseAuth';

export const CompletarCadastroPage: React.FC = () => {
    const [cpf, setCpf] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { user, updateProfile } = useAuth();

    const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);
        // Mask: 000.000.000-00
        if (value.length > 9) {
            value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        } else if (value.length > 6) {
            value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
        } else if (value.length > 3) {
            value = value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
        }
        setCpf(value);
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);
        // Mask: (00) 00000-0000
        if (value.length > 10) {
            value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        } else if (value.length > 6) {
            value = value.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
        } else if (value.length > 2) {
            value = value.replace(/(\d{2})(\d{0,5})/, '($1) $2');
        }
        setPhone(value);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const cleanCpf = cpf.replace(/\D/g, '');
        const cleanPhone = phone.replace(/\D/g, '');

        if (cleanCpf.length !== 11) {
            toast.error('CPF inválido');
            return;
        }

        if (cleanPhone.length < 10) {
            toast.error('Telefone inválido');
            return;
        }

        setLoading(true);
        try {
            console.log('[CompletarCadastro] Updating profile with:', { cpf: cleanCpf, phone: cleanPhone });

            await updateProfile({
                cpf_cnpj: cleanCpf,
                phone: cleanPhone,
                name: user?.user_metadata?.full_name || user?.email || 'Usuário',
                email: user?.email || ''
            });

            toast.success('Cadastro completado com sucesso!');
            navigate('/catalog');
        } catch (error: any) {
            console.error('[CompletarCadastro] Error:', error);
            toast.error(error.message || 'Erro ao completar cadastro');
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        navigate('/cliente/login');
        return null;
    }

    return (
        <AuthLayout
            title="Completar Cadastro"
            subtitle="Só mais alguns dados para começar"
        >
            <div className="space-y-6">
                {/* User Info from Google */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
                    {user.user_metadata?.avatar_url && (
                        <img
                            src={user.user_metadata.avatar_url}
                            alt="Avatar"
                            className="w-12 h-12 rounded-full"
                        />
                    )}
                    <div>
                        <p className="font-semibold text-blue-900">
                            {user.user_metadata?.full_name || user.email}
                        </p>
                        <p className="text-sm text-blue-700">{user.email}</p>
                    </div>
                </div>

                <p className="text-sm text-slate-600">
                    Para completar seu cadastro, precisamos de mais algumas informações:
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* CPF */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">
                            CPF
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 text-slate-400" size={18} />
                            <input
                                type="text"
                                value={cpf}
                                onChange={handleCpfChange}
                                placeholder="000.000.000-00"
                                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                required
                            />
                        </div>
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
                                value={phone}
                                onChange={handlePhoneChange}
                                placeholder="(00) 00000-0000"
                                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                required
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                <span>Salvando...</span>
                            </>
                        ) : (
                            'Completar Cadastro'
                        )}
                    </button>
                </form>
            </div>
        </AuthLayout>
    );
};
