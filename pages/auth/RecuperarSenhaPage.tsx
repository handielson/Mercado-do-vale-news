import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { useSupabaseAuth as useAuth } from '../../hooks/useSupabaseAuth';

export const RecuperarSenhaPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const { resetPassword } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email) {
            toast.error('Digite seu e-mail');
            return;
        }

        setLoading(true);
        try {
            await resetPassword(email);
            setSent(true);
            toast.success('E-mail de recuperação enviado!');
        } catch (error: any) {
            toast.error(error.message || 'Erro ao enviar e-mail');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Recuperar Senha"
            subtitle="Enviaremos um link para redefinir sua senha"
        >
            <div className="space-y-6">
                {sent ? (
                    <>
                        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                            <h3 className="font-semibold text-green-900 mb-2">
                                E-mail enviado!
                            </h3>
                            <p className="text-sm text-green-700">
                                Verifique sua caixa de entrada e clique no link para redefinir sua senha.
                            </p>
                        </div>

                        <div className="text-center">
                            <Link
                                to="/cliente/login"
                                className="text-blue-600 hover:text-blue-700 font-semibold text-sm"
                            >
                                Voltar para o login
                            </Link>
                        </div>
                    </>
                ) : (
                    <>
                        <p className="text-sm text-slate-600">
                            Digite seu e-mail cadastrado e enviaremos um link para você criar uma nova senha.
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-4">
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

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        <span>Enviando...</span>
                                    </>
                                ) : (
                                    'Enviar Link de Recuperação'
                                )}
                            </button>
                        </form>

                        <div className="text-center pt-4 border-t border-slate-200">
                            <p className="text-sm text-slate-600">
                                Lembrou sua senha?{' '}
                                <Link
                                    to="/cliente/login"
                                    className="text-blue-600 hover:text-blue-700 font-semibold"
                                >
                                    Fazer login
                                </Link>
                            </p>
                        </div>
                    </>
                )}
            </div>
        </AuthLayout>
    );
};
