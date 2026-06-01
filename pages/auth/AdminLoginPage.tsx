import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useVpsAuth } from '../../hooks/useVpsAuth';
import { customerService } from '../../services/customers';

export const AdminLoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [awaitingAuth, setAwaitingAuth] = useState(false);
    const navigate = useNavigate();
    const { user, customer, isLoading, signInWithEmail, signOut } = useVpsAuth();

    useEffect(() => {
        if (!awaitingAuth || isLoading) return;
        let cancelled = false;

        if (user && customer?.customer_type === 'ADMIN') {
            toast.success('Login admin realizado com sucesso!');
            navigate('/admin');
            return () => { cancelled = true; };
        }

        if (user && customer && customer.customer_type !== 'ADMIN') {
            signOut();
            toast.error('Acesso negado. Esta area e restrita a administradores.');
            setLoading(false);
            setAwaitingAuth(false);
            return () => { cancelled = true; };
        }

        if (user && !customer) {
            customerService.getByUserId(user.id)
                .then((profile) => {
                    if (cancelled) return;
                    if (profile?.customer_type === 'ADMIN') {
                        toast.success('Login admin realizado com sucesso!');
                        navigate('/admin');
                        return;
                    }
                    signOut();
                    toast.error('Acesso negado. Esta area e restrita a administradores.');
                    setLoading(false);
                    setAwaitingAuth(false);
                })
                .catch(() => {
                    if (cancelled) return;
                    setLoading(false);
                    setAwaitingAuth(false);
                });
            return () => { cancelled = true; };
        }

        if (!user && !isLoading) {
            setLoading(false);
            setAwaitingAuth(false);
        }

        return () => { cancelled = true; };
    }, [user, customer, isLoading, awaitingAuth, navigate, signOut]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            toast.error('Preencha todos os campos');
            return;
        }

        setLoading(true);
        try {
            await signInWithEmail(email, password);
            setAwaitingAuth(true);
        } catch (error: any) {
            toast.error(error.message || 'Email ou senha incorretos');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
                        <Shield className="text-white" size={32} />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Area Administrativa
                    </h1>
                    <p className="text-slate-400">
                        Acesso restrito a administradores
                    </p>
                </div>

                <div className="bg-white rounded-2xl shadow-2xl p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
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

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                            <p className="text-xs text-blue-800">
                                <strong>Nota:</strong> Esta area e exclusiva para administradores do sistema.
                                Tentativas de acesso nao autorizado serao registradas.
                            </p>
                        </div>

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

                    <div className="mt-6 pt-6 border-t border-slate-200 text-center">
                        <p className="text-xs text-slate-500 uppercase tracking-widest">
                            Acesso Restrito & Auditado
                        </p>
                    </div>
                </div>

                <div className="text-center mt-6">
                    <p className="text-sm text-slate-400">
                        E cliente?{' '}
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
