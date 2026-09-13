import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { WhatsAppVerification } from '../../components/auth/WhatsAppVerification';
import { formatPhone, normalizeBrazilianPhone } from '../../utils/cpfCnpjValidation';
import { useVpsAuth as useAuth } from '../../hooks/useVpsAuth';

export const CompletarCadastroPage: React.FC = () => {
    const { user, customer, updateProfile, isLoading } = useAuth();
    const [name, setName] = useState(customer?.name || '');
    const [phoneProof, setPhoneProof] = useState('');
    const [cpf, setCpf] = useState(customer?.cpf_cnpj || '');
    const [phone, setPhone] = useState(customer?.phone || '');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    useEffect(() => {
        if (customer) {
            setName(customer.name || '');
            setCpf(customer.cpf_cnpj || '');
            setPhone(customer.phone || '');
        }
    }, [customer?.id]);


    const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');

        // Limit to 14 digits (CNPJ)
        if (value.length > 14) value = value.slice(0, 14);

        // Format based on length
        if (value.length <= 11) {
            // CPF: 000.000.000-00
            if (value.length > 9) {
                value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
            } else if (value.length > 6) {
                value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
            } else if (value.length > 3) {
                value = value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
            }
        } else {
            // CNPJ: 00.000.000/0000-00
            value = value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        }

        setCpf(value);
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPhoneProof('');
        setPhone(formatPhone(e.target.value));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const cleanCpf = cpf.replace(/\D/g, '');
        const cleanPhone = phone.replace(/\D/g, '');

        if (cleanCpf.length !== 11 && cleanCpf.length !== 14) {
            toast.error('CPF/CNPJ inválido. Digite 11 dígitos para CPF ou 14 para CNPJ.');
            return;
        }

        if (!normalizeBrazilianPhone(phone)) {
            toast.error('Telefone inválido');
            return;
        }

        if (!name.trim() || !phoneProof) {
            toast.error('Informe seu nome completo e confirme o WhatsApp');
            return;
        }

        setLoading(true);
        try {

            await updateProfile({
                cpf_cnpj: cleanCpf,
                phone: cleanPhone,
                name: name.replace(/\s+/g, ' ').trim(),
                phone_verification_token: phoneProof,
                email: user?.email || ''
            });

            toast.success('Bem-vindo ao Mercado do Vale! 🎉', {
                description: 'Cadastro completo. Comece a acumular Moedas do Vale agora!'
            });
            navigate('/');
        } catch (error: any) {
            console.error('[CompletarCadastro] Error:', error);
            toast.error(error.message || 'Erro ao completar cadastro');
        } finally {
            setLoading(false);
        }
    };

    if (isLoading) return <p>Carregando cadastro...</p>;
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

                {/* Propaganda Moedas do Vale */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm font-bold text-amber-800 mb-1">🪙 Bem-vindo ao programa Moedas do Vale!</p>
                    <p className="text-xs text-amber-700 leading-relaxed">
                        A cada compra e check-in diário você acumula <strong>Moedas do Vale</strong> que podem
                        ser trocadas por descontos reais. Quanto mais você compra, mais moedas acumula!
                    </p>
                    <a
                        href="/moedas-do-vale"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 text-xs font-semibold text-amber-700 underline hover:text-amber-900"
                    >
                        Ver regulamento completo →
                    </a>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="block space-y-2 text-sm font-semibold text-slate-700">
                        Nome completo *
                        <input type="text" autoComplete="name" value={name} required
                            onChange={event => setName(event.target.value)}
                            placeholder="Confira e informe seu nome completo"
                            className="w-full rounded-xl border border-slate-300 px-4 py-3" />
                    </label>
                    {/* CPF/CNPJ */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">
                            CPF/CNPJ
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 text-slate-400" size={18} />
                            <input
                                type="text"
                                value={cpf}
                                onChange={handleCpfChange}
                                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                required
                            />
                        </div>
                    </div>

                    {/* Phone */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">
                            WhatsApp *
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

                    <WhatsAppVerification phone={phone} purpose="profile" onVerified={setPhoneProof} />

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading || !phoneProof}
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
