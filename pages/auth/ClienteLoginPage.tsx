import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { GoogleButton } from '../../components/auth/GoogleButton';
import { useSupabaseAuth as useAuth } from '../../hooks/useSupabaseAuth';

export const ClienteLoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const navigate = useNavigate();
    const { signInWithEmail, signInWithGoogle } = useAuth();

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !password) {
            toast.error('Preencha todos os campos');
            return;
        }

        setLoading(true);
        try {
            await signInWithEmail(email, password);
            toast.success('Login realizado com sucesso!');
            navigate('/catalog');
        } catch (error: any) {
            toast.error(error.message || 'Erro ao fazer login');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setGoogleLoading(true);
        try {
            await signInWithGoogle();
            // Redirecionamento será feito pelo callback
        } catch (error: any) {
            toast.error(error.message || 'Erro ao fazer login com Google');
            setGoogleLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Bem-vindo de volta!"
            subtitle="Acesse sua conta para continuar"
        >
            <div className="space-y-6">
                {/* Google Login */}
                <GoogleButton
                    onClick={handleGoogleLogin}
                    loading={googleLoading}
                />

                {/* Divider */}
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-white text-slate-500">ou continue com email</span>
                    </div>
                </div>

                {/* Email/Password Form */}
                <form onSubmit={handleEmailLogin} className="space-y-4">
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
                                placeholder="Digite sua senha"
                                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                required
                            />
                        </div>
                    </div>

                    {/* Forgot Password */}
                    <div className="text-right">
                        <Link
                            to="/recuperar-senha"
                            className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
                        >
                            Esqueci minha senha
                        </Link>
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
                                <span>Entrando...</span>
                            </>
                        ) : (
                            'Entrar'
                        )}
                    </button>
                </form>

                {/* Sign Up Link */}
                <div className="text-center pt-4 border-t border-slate-200">
                    <p className="text-sm text-slate-600">
                        Não tem uma conta?{' '}
                        <Link
                            to="/cliente/cadastro"
                            className="text-blue-600 hover:text-blue-700 font-semibold"
                        >
                            Criar conta
                        </Link>
                    </p>
                </div>
            </div>
        </AuthLayout>
    );
};
