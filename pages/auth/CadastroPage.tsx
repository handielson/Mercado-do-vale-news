import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Lock, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { GoogleButton } from '../../components/auth/GoogleButton';
import { useSupabaseAuth as useAuth } from '../../hooks/useSupabaseAuth';

type Step = 'cpf' | 'activate' | 'create';

export const CadastroPage: React.FC = () => {
    const [step, setStep] = useState<Step>('cpf');
    const [cpf, setCpf] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    const navigate = useNavigate();
    const { checkCPF, activateAccount, createAccount, signInWithGoogle } = useAuth();

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

    const handleCheckCPF = async (e: React.FormEvent) => {
        e.preventDefault();

        const cleanCpf = cpf.replace(/\D/g, '');
        if (cleanCpf.length !== 11) {
            toast.error('CPF inválido');
            return;
        }

        setLoading(true);
        try {
            const customer = await checkCPF(cleanCpf);

            if (customer) {
                // Cliente existe - ativar conta
                setCustomerName(customer.name);
                setStep('activate');
                toast.success(`Olá ${customer.name}! Complete seu cadastro.`);
            } else {
                // Cliente não existe - criar novo
                setStep('create');
                toast.info('CPF não encontrado. Vamos criar sua conta!');
            }
        } catch (error: any) {
            toast.error(error.message || 'Erro ao verificar CPF');
        } finally {
            setLoading(false);
        }
    };

    const handleActivate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('As senhas não coincidem');
            return;
        }

        if (password.length < 6) {
            toast.error('A senha deve ter no mínimo 6 caracteres');
            return;
        }

        setLoading(true);
        try {
            await activateAccount({
                cpf_cnpj: cpf.replace(/\D/g, ''),
                email,
                phone: phone.replace(/\D/g, ''),
                password
            });

            toast.success('Conta ativada com sucesso!');
            navigate('/catalog');
        } catch (error: any) {
            toast.error(error.message || 'Erro ao ativar conta');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('As senhas não coincidem');
            return;
        }

        if (password.length < 6) {
            toast.error('A senha deve ter no mínimo 6 caracteres');
            return;
        }

        setLoading(true);
        try {
            await createAccount({
                cpf_cnpj: cpf.replace(/\D/g, ''),
                name,
                email,
                phone: phone.replace(/\D/g, ''),
                password
            });

            toast.success('Conta criada com sucesso!');
            navigate('/catalog');
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
            toast.error(error.message || 'Erro ao fazer cadastro com Google');
            setGoogleLoading(false);
        }
    };

    return (
        <AuthLayout
            title={step === 'cpf' ? 'Criar Conta' : step === 'activate' ? 'Ativar Conta' : 'Completar Cadastro'}
            subtitle={step === 'cpf' ? 'Comece verificando seu CPF' : undefined}
        >
            <div className="space-y-6">
                {/* Step 1: CPF Check */}
                {step === 'cpf' && (
                    <>
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
                                <span className="px-4 bg-white text-slate-500">ou use seu CPF</span>
                            </div>
                        </div>

                        {/* CPF Form */}
                        <form onSubmit={handleCheckCPF} className="space-y-4">
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
                                <p className="text-xs text-slate-500">
                                    Verificaremos se você já é nosso cliente
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        <span>Verificando...</span>
                                    </>
                                ) : (
                                    'Verificar CPF'
                                )}
                            </button>
                        </form>
                    </>
                )}

                {/* Step 2A: Activate Existing Account */}
                {step === 'activate' && (
                    <>
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                            <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                            <div>
                                <p className="font-semibold text-green-900">Cliente encontrado!</p>
                                <p className="text-sm text-green-700">
                                    Olá <strong>{customerName}</strong>, complete os dados abaixo para ativar sua conta online.
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleActivate} className="space-y-4">
                            {/* Email */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">
                                    E-mail
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="seu@email.com"
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

                            {/* Password */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">
                                    Senha
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Mínimo 6 caracteres"
                                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Confirm Password */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">
                                    Confirmar Senha
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Digite a senha novamente"
                                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setStep('cpf')}
                                    className="px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all"
                                >
                                    Voltar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="animate-spin" size={20} />
                                            <span>Ativando...</span>
                                        </>
                                    ) : (
                                        'Ativar Minha Conta'
                                    )}
                                </button>
                            </div>
                        </form>
                    </>
                )}

                {/* Step 2B: Create New Account */}
                {step === 'create' && (
                    <>
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <p className="text-sm text-blue-900">
                                CPF não encontrado em nossa base. Vamos criar sua conta!
                            </p>
                        </div>

                        <form onSubmit={handleCreate} className="space-y-4">
                            {/* Name */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">
                                    Nome Completo
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Seu nome completo"
                                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">
                                    E-mail
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="seu@email.com"
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

                            {/* Password */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">
                                    Senha
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Mínimo 6 caracteres"
                                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Confirm Password */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">
                                    Confirmar Senha
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Digite a senha novamente"
                                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setStep('cpf')}
                                    className="px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all"
                                >
                                    Voltar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="animate-spin" size={20} />
                                            <span>Criando...</span>
                                        </>
                                    ) : (
                                        'Criar Conta'
                                    )}
                                </button>
                            </div>
                        </form>
                    </>
                )}

                {/* Login Link */}
                {step === 'cpf' && (
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
                )}
            </div>
        </AuthLayout>
    );
};
