import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { useSupabaseAuth as useAuth } from '../../hooks/useSupabaseAuth';

export const RedefinirSenhaPage: React.FC = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();
    const { updatePassword } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
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
            await updatePassword(password);
            setSuccess(true);
            toast.success('Senha redefinida com sucesso!');

            // Redirecionar após 2 segundos
            setTimeout(() => {
                navigate('/cliente/login');
            }, 2000);
        } catch (error: any) {
            toast.error(error.message || 'Erro ao redefinir senha');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Redefinir Senha"
            subtitle="Crie uma nova senha para sua conta"
        >
            <div className="space-y-6">
                {success ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                        <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                        <h3 className="font-semibold text-green-900 mb-2">
                            Senha redefinida!
                        </h3>
                        <p className="text-sm text-green-700">
                            Redirecionando para o login...
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* New Password */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">
                                Nova Senha
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
                                Confirmar Nova Senha
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

                        {/* Password Requirements */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                            <p className="text-xs font-semibold text-slate-700 mb-1">
                                Requisitos da senha:
                            </p>
                            <ul className="text-xs text-slate-600 space-y-1">
                                <li className={password.length >= 6 ? 'text-green-600' : ''}>
                                    • Mínimo de 6 caracteres
                                </li>
                                <li className={password === confirmPassword && password ? 'text-green-600' : ''}>
                                    • Senhas devem coincidir
                                </li>
                            </ul>
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
                                    <span>Redefinindo...</span>
                                </>
                            ) : (
                                'Redefinir Senha'
                            )}
                        </button>
                    </form>
                )}
            </div>
        </AuthLayout>
    );
};
