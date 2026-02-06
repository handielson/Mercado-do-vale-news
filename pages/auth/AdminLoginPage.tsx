import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { supabase } from '../../services/supabase';

/**
 * Admin Login Page
 * 
 * Dedicated login page for administrators
 * Validates that user has ADMIN customer_type after login
 * Separate from customer login for security
 */
export const AdminLoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !password) {
            toast.error('Preencha todos os campos');
            return;
        }

        setLoading(true);

        try {
            console.log('🔐 [Admin Login] Starting login process...');

            // Sign in with Supabase
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                console.error('🔐 [Admin Login] Auth error:', error);
                throw error;
            }

            console.log('🔐 [Admin Login] Auth successful, checking admin status...');

            // Fetch customer data to verify admin status
            const { data: customerData, error: customerError } = await supabase
                .from('customers')
                .select('customer_type, name')
                .eq('user_id', data.user.id)
                .single();

            if (customerError) {
                console.error('🔐 [Admin Login] Customer fetch error:', customerError);
                await supabase.auth.signOut();
                throw new Error('Erro ao verificar permissões');
            }

            console.log('🔐 [Admin Login] Customer data:', customerData);

            // Verify admin status
            if (customerData?.customer_type !== 'ADMIN') {
                console.warn('🔐 [Admin Login] Access denied - not admin:', customerData?.customer_type);
                await supabase.auth.signOut();
                toast.error('Acesso negado. Esta área é restrita a administradores.');
                setLoading(false);
                return;
            }

            console.log('🔐 [Admin Login] Admin verified, redirecting...');
            toast.success('Login admin realizado com sucesso!');

            // Small delay to show success message
            setTimeout(() => {
                navigate('/admin/dashboard');
            }, 500);

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
