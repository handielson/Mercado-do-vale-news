import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Loader2, Mail, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { useVpsAuth as useAuth } from '../../hooks/useVpsAuth';
import type { PasswordResetChannel } from '../../types/auth';

const formatWhatsApp = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export const RecuperarSenhaPage: React.FC = () => {
    const [channel, setChannel] = useState<PasswordResetChannel>('email');
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const { resetPassword } = useAuth();

    const selectChannel = (nextChannel: PasswordResetChannel) => {
        setChannel(nextChannel);
        setIdentifier('');
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const digits = identifier.replace(/\D/g, '');
        if (!identifier.trim() || (channel === 'whatsapp' && digits.length < 10)) {
            toast.error(channel === 'email' ? 'Digite um e-mail válido' : 'Digite um WhatsApp válido com DDD');
            return;
        }

        setLoading(true);
        try {
            await resetPassword(channel === 'whatsapp' ? digits : identifier.trim(), channel);
            setSent(true);
            toast.success('Solicitação recebida');
        } catch (error: any) {
            toast.error(error.message || 'Não foi possível solicitar a recuperação');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout title="Recuperar senha" subtitle="Escolha onde deseja receber o link de redefinição">
            <div className="space-y-6">
                {sent ? (
                    <>
                        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                            <h3 className="font-semibold text-green-900 mb-2">Solicitação recebida</h3>
                            <p className="text-sm text-green-700">
                                Se esse {channel === 'email' ? 'e-mail' : 'WhatsApp'} estiver vinculado a uma conta,
                                enviaremos um link para redefinir a senha. No e-mail, verifique também a caixa de spam.
                            </p>
                        </div>
                        <div className="text-center">
                            <Link to="/cliente/login" className="text-blue-600 hover:text-blue-700 font-semibold text-sm">
                                Voltar para o login
                            </Link>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Canal de recuperação">
                            <button type="button" onClick={() => selectChannel('email')} aria-pressed={channel === 'email'} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${channel === 'email' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                                <Mail size={18} /> E-mail
                            </button>
                            <button type="button" onClick={() => selectChannel('whatsapp')} aria-pressed={channel === 'whatsapp'} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${channel === 'whatsapp' ? 'border-green-600 bg-green-50 text-green-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                                <MessageCircle size={18} /> WhatsApp
                            </button>
                        </div>

                        <p className="text-sm text-slate-600">
                            Informe o contato usado no seu cadastro. Por segurança, a confirmação será igual mesmo se o contato não estiver cadastrado.
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="recovery-contact" className="text-sm font-semibold text-slate-700">
                                    {channel === 'email' ? 'E-mail' : 'WhatsApp com DDD'}
                                </label>
                                <div className="relative">
                                    {channel === 'email' ? <Mail className="absolute left-3 top-3 text-slate-400" size={18} /> : <MessageCircle className="absolute left-3 top-3 text-slate-400" size={18} />}
                                    <input
                                        id="recovery-contact"
                                        type={channel === 'email' ? 'email' : 'tel'}
                                        inputMode={channel === 'email' ? 'email' : 'tel'}
                                        value={identifier}
                                        onChange={(event) => setIdentifier(channel === 'whatsapp' ? formatWhatsApp(event.target.value) : event.target.value)}
                                        placeholder={channel === 'email' ? 'seu@email.com' : '(00) 00000-0000'}
                                        autoComplete={channel === 'email' ? 'email' : 'tel'}
                                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        required
                                    />
                                </div>
                            </div>
                            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                                {loading ? <><Loader2 className="animate-spin" size={20} /><span>Solicitando...</span></> : `Enviar pelo ${channel === 'email' ? 'e-mail' : 'WhatsApp'}`}
                            </button>
                        </form>

                        <div className="text-center">
                            <Link to="/cliente/login" className="text-blue-600 hover:text-blue-700 font-semibold text-sm">Voltar para o login</Link>
                        </div>
                    </>
                )}
            </div>
        </AuthLayout>
    );
};
