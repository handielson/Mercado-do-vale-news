import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { GoogleButton } from '../../components/auth/GoogleButton';
import { useSupabaseAuth as useAuth } from '../../hooks/useSupabaseAuth';

export const ClienteRegisterPage: React.FC = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        cpf_cnpj: ''
    });
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const navigate = useNavigate();
    const { createAccount, signInWithGoogle } = useAuth();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const formatCPF = (value: string) => {
        const numbers = value.replace(/\D/g, '');

        // Limit to 14 digits (CNPJ)
        if (numbers.length > 14) return formData.cpf_cnpj;

        // Format based on length
        if (numbers.length <= 11) {
            // CPF: 000.000.000-00
            if (numbers.length > 9) {
                return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
            } else if (numbers.length > 6) {
                return numbers.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
            } else if (numbers.length > 3) {
                return numbers.replace(/(\d{3})(\d{1,3})/, '$1.$2');
            }
        } else {
            // CNPJ: 00.000.000/0000-00
            return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        }

        return numbers;
    };

    const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatCPF(e.target.value);
        setFormData(prev => ({ ...prev, cpf_cnpj: formatted }));
    };

    const validateForm = () => {
        if (!formData.name || !formData.email || !formData.password || !formData.cpf_cnpj) {
            toast.error('Preencha todos os campos obrigatórios');
            return false;
        }

        if (formData.password !== formData.confirmPassword) {
            toast.error('As senhas não coincidem');
            return false;
        }

        if (formData.password.length < 6) {
            toast.error('A senha deve ter no mínimo 6 caracteres');
            return false;
        }

        const cpfNumbers = formData.cpf_cnpj.replace(/\D/g, '');
        if (cpfNumbers.length !== 11 && cpfNumbers.length !== 14) {
            toast.error('CPF/CNPJ inválido');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        setLoading(true);
        try {
            await createAccount({
                name: formData.name,
                email: formData.email,
                password: formData.password,
                cpf_cnpj: formData.cpf_cnpj.replace(/\D/g, ''),
                customer_type: 'retail' // Always retail on self-registration
            });
            toast.success('Conta criada com sucesso! Faça login para continuar.');
            navigate('/cliente/login');
        } catch (error: any) {
            toast.error(error.message || 'Erro ao criar conta');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignup = async () => {
        setGoogleLoading(true);
        try {
            await signInWithGoogle();
            // Redirecionamento será feito pelo callback
        } catch (error: any) {
            toast.error(error.message || 'Erro ao cadastrar com Google');
            setGoogleLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Crie sua conta"
            subtitle="Comece a navegar pelo nosso catálogo"
        >
            <div className="space-y-6">
                {/* Google Signup */}
                <GoogleButton
                    onClick={handleGoogleSignup}
                    loading={googleLoading}
                    text="Cadastrar com Google"
                />

                {/* Divider */}
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-white text-slate-500">ou cadastre-se com email</span>
                    </div>
                </div>

                {/* Registration Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">
                            Nome completo *
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 text-slate-400" size={18} />
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="Seu nome completo"
                                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                required
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">
                            E-mail *
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="seu@email.com"
                                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                required
                            />
                        </div>
                    </div>

                    {/* CPF/CNPJ */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">
                            CPF/CNPJ *
                        </label>
                        <div className="relative">
                            <CreditCard className="absolute left-3 top-3 text-slate-400" size={18} />
                            <input
                                type="text"
                                name="cpf_cnpj"
                                value={formData.cpf_cnpj}
                                onChange={handleCPFChange}
                                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                required
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">
                            Senha *
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Mínimo 6 caracteres"
                                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                required
                            />
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">
                            Confirmar senha *
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="Digite a senha novamente"
                                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                required
                            />
                        </div>
                    </div>

                    {/* Info Message */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800">
                            💡 Você poderá completar seus dados (telefone, endereço, etc.) após o login.
                        </p>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                <span>Criando conta...</span>
                            </>
                        ) : (
                            'Criar conta'
                        )}
                    </button>
                </form>

                {/* Login Link */}
                <div className="text-center pt-4 border-t border-slate-200">
                    <p className="text-sm text-slate-600">
                        Já tem uma conta?{' '}
                        <Link
                            to="/cliente/login"
                            className="text-blue-600 hover:text-blue-700 font-semibold"
                        >
                            Fazer login
                        </Link>
                    </p>
                </div>
            </div>
        </AuthLayout>
    );
};
