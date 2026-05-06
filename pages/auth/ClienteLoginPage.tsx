import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, Loader2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { GoogleButton } from '../../components/auth/GoogleButton';
import { useSupabaseAuth as useAuth } from '../../hooks/useSupabaseAuth';

type LoginTab = 'email' | 'cpf';

export const ClienteLoginPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<LoginTab>('cpf');
    const [email, setEmail] = useState('');
    const [cpf, setCpf] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const nextPath = searchParams.get('next') || '/';
    const { signInWithEmail, signInWithCpf, signInWithGoogle } = useAuth();

    // Máscara dinâmica: CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00)
    const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 14);
        let formatted = digits;
        if (digits.length <= 11) {
            formatted = digits
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
                .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
        } else {
            formatted = digits
                .replace(/^(\d{2})(\d)/, '$1.$2')
                .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
                .replace(/\.(\d{3})(\d)/, '.$1/$2')
                .replace(/(\d{4})(\d)/, '$1-$2');
        }
        setCpf(formatted);
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) { toast.error('Preencha todos os campos'); return; }
        setLoading(true);
        try {
            await signInWithEmail(email, password);
            navigate(nextPath);
        } catch {
            // Toast já é mostrado pelo contexto em PT-BR
        } finally {
            setLoading(false);
        }
    };

    const handleCpfLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        const digits = cpf.replace(/\D/g, '');
        if (digits.length !== 11 && digits.length !== 14) { toast.error('CPF/CNPJ inválido'); return; }
        if (!password) { toast.error('Digite sua senha'); return; }
        setLoading(true);
        try {
            await signInWithCpf(cpf, password);
            navigate(nextPath);
        } catch {
            // Toast já é mostrado pelo contexto em PT-BR
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setGoogleLoading(true);
        try {
            if (nextPath !== '/') sessionStorage.setItem('auth_next', nextPath);
            await signInWithGoogle();
        } catch {
            // Toast já é mostrado pelo contexto em PT-BR
            setGoogleLoading(false);
        }
    };

    return (
        <AuthLayout title="Bem-vindo de volta!" subtitle="Acesse sua conta para continuar">
            <div className="space-y-6">
                {/* Google Login */}
                <GoogleButton onClick={handleGoogleLogin} loading={googleLoading} />

                {/* Divider */}
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-white text-slate-500">ou continue com</span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex rounded-xl overflow-hidden border border-slate-200">
                    <button
                        type="button"
                        onClick={() => setActiveTab('cpf')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${
                            activeTab === 'cpf'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <CreditCard size={16} />
                        CPF / CNPJ
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('email')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${
                            activeTab === 'email'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <Mail size={16} />
                        E-mail
                    </button>
                </div>

                {/* CPF Form */}
                {activeTab === 'cpf' && (
                    <form onSubmit={handleCpfLogin} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">CPF / CNPJ</label>
                            <div className="relative">
                                <CreditCard className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    value={cpf}
                                    onChange={handleCpfChange}
                                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                                    inputMode="numeric"
                                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Sua senha (padrão: 5 primeiros dígitos do CPF)"
                                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    required
                                />
                            </div>
                            <p className="text-xs text-slate-500">
                                💡 Senha inicial enviada por WhatsApp no momento do cadastro
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <><Loader2 className="animate-spin" size={20} /><span>Entrando...</span></>
                            ) : 'Entrar com CPF/CNPJ'}
                        </button>
                    </form>
                )}

                {/* Email Form */}
                {activeTab === 'email' && (
                    <form onSubmit={handleEmailLogin} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">E-mail</label>
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

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Digite sua senha"
                                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    required
                                />
                            </div>
                        </div>

                        <div className="text-right">
                            <Link to="/recuperar-senha" className="text-sm text-blue-600 hover:text-blue-700 font-semibold">
                                Esqueci minha senha
                            </Link>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <><Loader2 className="animate-spin" size={20} /><span>Entrando...</span></>
                            ) : 'Entrar'}
                        </button>
                    </form>
                )}

                {/* Sign Up Link */}
                <div className="text-center pt-4 border-t border-slate-200">
                    <p className="text-sm text-slate-600">
                        Não tem uma conta?{' '}
                        <Link
                            to={`/cliente/cadastro${nextPath !== '/' ? `?next=${nextPath}` : ''}`}
                            className="text-blue-600 hover:text-blue-700 font-semibold"
                        >
                            Criar conta
                        </Link>
                    </p>
                </div>

                {/* Public Catalog Button */}
                <div className="pt-4">
                    <Link
                        to="/"
                        className="w-full block text-center bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-xl font-bold hover:from-green-700 hover:to-green-800 transition-all shadow-lg"
                    >
                        🛍️ Ver Catálogo
                    </Link>
                    <p className="text-xs text-slate-500 text-center mt-2">
                        Navegue pelos produtos sem fazer login
                    </p>
                </div>
            </div>
        </AuthLayout>
    );
};
