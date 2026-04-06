import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { supabase } from '../../services/supabase';

/**
 * Admin Login Page
 * 
 * ARCHITECTURE NOTE:
 * This page does NOT fetch customer data itself. Instead, it calls signInWithPassword
 * and then waits for the SupabaseAuthContext to load the customer profile via
 * onAuthStateChange. This avoids a race condition where two concurrent fetches to
 * 'customers' (one from here, one from the context) would cause an AbortError,
 * which previously triggered an accidental signOut() → infinite loop.
 */
export const AdminLoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [awaitingAuth, setAwaitingAuth] = useState(false);
    const navigate = useNavigate();
    const { user, customer, isLoading } = useSupabaseAuth();

    // Watch the context's customer state after login.
    // This fires when the context finishes loading the customer profile.
    useEffect(() => {
        if (!awaitingAuth) return;
        if (isLoading) return; // Still loading - wait

        if (user && customer) {
            if (customer.customer_type === 'ADMIN') {
                console.log('🔐 [Admin Login] Admin confirmed via context, redirecting...');
                toast.success('Login admin realizado com sucesso!');
                navigate('/admin');
            } else {
                console.warn('🔐 [Admin Login] Access denied - not admin:', customer.customer_type);
                supabase.auth.signOut();
                toast.error('Acesso negado. Esta área é restrita a administradores.');
                setLoading(false);
                setAwaitingAuth(false);
            }
        } else if (!user && !isLoading) {
            // Auth failed or signOut happened
            setLoading(false);
            setAwaitingAuth(false);
        }
    }, [user, customer, isLoading, awaitingAuth, navigate]);

    // Timeout de segurança: se o contexto carregou o user mas não o customer
    // em 10s (banco degradado), busca direto e redireciona se for admin.
    useEffect(() => {
        if (!awaitingAuth || !user) return;

        const timer = setTimeout(async () => {
            if (!customer) {
                console.warn('🔐 [Admin Login] Customer timeout – fetching directly...');
                try {
                    const { data } = await supabase
                        .from('customers')
                        .select('customer_type')
                        .eq('user_id', user.id)
                        .single();
                    if (data?.customer_type === 'ADMIN') {
                        toast.success('Login admin realizado com sucesso!');
                        navigate('/admin');
                    } else {
                        toast.error('Acesso negado ou conta sem permissão admin.');
                        supabase.auth.signOut();
                        setLoading(false);
                        setAwaitingAuth(false);
                    }
                } catch {
                    toast.error('Não foi possível verificar as permissões. Tente novamente.');
                    setLoading(false);
                    setAwaitingAuth(false);
                }
            }
        }, 10000);

        return () => clearTimeout(timer);
    }, [awaitingAuth, user, customer, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !password) {
            toast.error('Preencha todos os campos');
            return;
        }

        setLoading(true);

        try {
            console.log('🔐 [Admin Login] Starting login process...');

            const { error } = await supabase.auth.signInWithPassword({ email, password });

            if (error) {
                console.error('🔐 [Admin Login] Auth error:', error);
                throw error;
            }

            // Auth succeeded. Now we wait for SupabaseAuthContext to load the customer.
            // The useEffect above will handle the redirect or denial once it's ready.
            console.log('🔐 [Admin Login] Auth successful, waiting for context to load customer...');
            setAwaitingAuth(true);

        } catch (error: any) {
            console.error('🔐 [Admin Login] Error:', error);
            toast.error(error.message || 'Email ou senha incorretos');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
                        <Shield className="text-white" size={32} />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Área Administrativa
                    </h1>
                    <p className="text-slate-400">
                        Acesso restrito a administradores
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-2xl shadow-2xl p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Email */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">
                                E-mail Administrativo
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@mercadodovale.com"
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

                        {/* Info Box */}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                            <p className="text-xs text-blue-800">
                                <strong>Nota:</strong> Esta área é exclusiva para administradores do sistema.
                                Tentativas de acesso não autorizado serão registradas.
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
                                    <span>Verificando...</span>
                                </>
                            ) : (
                                <>
                                    <Shield size={20} />
                                    <span>Acessar Painel Admin</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-6 pt-6 border-t border-slate-200 text-center">
                        <p className="text-xs text-slate-500 uppercase tracking-widest">
                            Acesso Restrito & Auditado
                        </p>
                    </div>
                </div>

                {/* Customer Login Link */}
                <div className="text-center mt-6">
                    <p className="text-sm text-slate-400">
                        É cliente?{' '}
                        <a
                            href="/cliente/login"
                            className="text-blue-400 hover:text-blue-300 font-semibold"
                        >
                            Acesse aqui
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
};
