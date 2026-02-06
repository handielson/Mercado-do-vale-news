import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSupabaseAuth } from '../../../hooks/useSupabaseAuth';

/**
 * Password Change Tab Component
 * 
 * Allows customer to change their password
 * Max 250 lines (ANTIGRAVITY protocol)
 */
export const PasswordChangeTab: React.FC = () => {
    const [formData, setFormData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false
    });
    const [loading, setLoading] = useState(false);
    const { updatePassword } = useSupabaseAuth();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
        setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
    };

    const validateForm = (): boolean => {
        if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
            toast.error('Preencha todos os campos');
            return false;
        }

        if (formData.newPassword.length < 6) {
            toast.error('A nova senha deve ter no mínimo 6 caracteres');
            return false;
        }

        if (formData.newPassword !== formData.confirmPassword) {
            toast.error('As senhas não coincidem');
            return false;
        }

        if (formData.currentPassword === formData.newPassword) {
            toast.error('A nova senha deve ser diferente da atual');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        setLoading(true);
        try {
            await updatePassword(formData.newPassword);
            toast.success('Senha alterada com sucesso!');

            // Clear form
            setFormData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });
        } catch (error: any) {
            toast.error(error.message || 'Erro ao alterar senha');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Alterar Senha</h2>
            <p className="text-slate-600 mb-6">
                Mantenha sua conta segura alterando sua senha regularmente
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Current Password */}
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">
                        Senha Atual *
                    </label>
                    <div className="relative">
                        <input
                            type={showPasswords.current ? 'text' : 'password'}
                            name="currentPassword"
                            value={formData.currentPassword}
                            onChange={handleChange}
                            placeholder="Digite sua senha atual"
                            className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => togglePasswordVisibility('current')}
                            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                        >
                            {showPasswords.current ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                </div>

                {/* New Password */}
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">
                        Nova Senha *
                    </label>
                    <div className="relative">
                        <input
                            type={showPasswords.new ? 'text' : 'password'}
                            name="newPassword"
                            value={formData.newPassword}
                            onChange={handleChange}
                            placeholder="Digite sua nova senha (mínimo 6 caracteres)"
                            className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => togglePasswordVisibility('new')}
                            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                        >
                            {showPasswords.new ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                    {formData.newPassword && (
                        <div className="text-sm">
                            <p className={`${formData.newPassword.length >= 6 ? 'text-green-600' : 'text-red-600'}`}>
                                {formData.newPassword.length >= 6 ? '✓' : '✗'} Mínimo 6 caracteres
                            </p>
                        </div>
                    )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">
                        Confirmar Nova Senha *
                    </label>
                    <div className="relative">
                        <input
                            type={showPasswords.confirm ? 'text' : 'password'}
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder="Digite a nova senha novamente"
                            className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => togglePasswordVisibility('confirm')}
                            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                        >
                            {showPasswords.confirm ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                    {formData.confirmPassword && (
                        <div className="text-sm">
                            <p className={`${formData.newPassword === formData.confirmPassword ? 'text-green-600' : 'text-red-600'}`}>
                                {formData.newPassword === formData.confirmPassword ? '✓' : '✗'} Senhas coincidem
                            </p>
                        </div>
                    )}
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                        <strong>Dica de segurança:</strong> Use uma senha forte com letras, números e caracteres especiais.
                    </p>
                </div>

                {/* Submit Button */}
                <div className="flex gap-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                <span>Alterando...</span>
                            </>
                        ) : (
                            'Alterar Senha'
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};
