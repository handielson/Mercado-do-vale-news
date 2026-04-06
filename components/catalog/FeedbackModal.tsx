import React, { useState } from 'react';
import { MessageSquare, X, Send, User, AtSign, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { feedbackService } from '../../services/feedbackService';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAnonymous, setIsAnonymous] = useState(true);
    const [type, setType] = useState<'Dúvida' | 'Reclamação' | 'Sugestão' | 'Outro'>('Dúvida');
    const [message, setMessage] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerContact, setCustomerContact] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!message.trim()) {
            toast.error('Por favor, escreva uma mensagem.');
            return;
        }

        if (!isAnonymous && !customerContact.trim() && !customerName.trim()) {
            toast.error('Por favor, preencha nome ou contato para podermos retornar.');
            return;
        }

        try {
            setIsSubmitting(true);
            await feedbackService.submitFeedback({
                type,
                message,
                customer_name: isAnonymous ? undefined : customerName,
                customer_contact: isAnonymous ? undefined : customerContact,
            });

            toast.success('Mensagem enviada com sucesso! Agradecemos o contato.');

            // Limpa o formulário e fecha
            setMessage('');
            setCustomerName('');
            setCustomerContact('');
            setIsAnonymous(true);
            setType('Dúvida');
            onClose();

        } catch (error: any) {
            toast.error(error.message || 'Erro ao enviar mensagem.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="bg-blue-600 p-5 text-white flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 opacity-90" />
                            Fale Conosco
                        </h2>
                        <p className="text-blue-100 text-sm mt-1">
                            Envie dúvidas, sugestões ou reclamações.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">

                    {/* Tipo */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Sobre o que deseja falar?
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {['Dúvida', 'Reclamação', 'Sugestão', 'Outro'].map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setType(t as any)}
                                    className={`px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${type === t
                                            ? 'bg-blue-50 border-blue-500 text-blue-700'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mensagem */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Sua Mensagem
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Escreva aqui os detalhes..."
                            rows={4}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                            required
                        />
                    </div>

                    {/* Identificação Toggle */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h4 className="text-sm font-semibold text-slate-800">Identificação (Opcional)</h4>
                                <p className="text-xs text-slate-500">Deseja que a loja entre em contato?</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={!isAnonymous}
                                    onChange={(e) => setIsAnonymous(!e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        {!isAnonymous && (
                            <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                                <div>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <User className="h-4 w-4 text-slate-400" />
                                        </div>
                                        <input
                                            type="text"
                                            value={customerName}
                                            onChange={(e) => setCustomerName(e.target.value)}
                                            placeholder="Seu Nome"
                                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <AtSign className="h-4 w-4 text-slate-400" />
                                        </div>
                                        <input
                                            type="text"
                                            value={customerContact}
                                            onChange={(e) => setCustomerContact(e.target.value)}
                                            placeholder="WhatsApp ou E-mail"
                                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        />
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 text-center">
                                    Esses dados serão enviados apenas aos administradores para retornarem o contato.
                                </p>
                            </div>
                        )}
                        {isAnonymous && (
                            <div className="bg-amber-50 rounded-lg p-2 border border-amber-200 flex items-start gap-2 animate-in fade-in">
                                <span className="text-amber-600 mt-0.5">🕵️</span>
                                <p className="text-xs text-amber-800">
                                    Sua mensagem será enviada de forma 100% anônima. Não teremos como lhe dar um retorno direto.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isSubmitting || !message.trim()}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                Enviando...
                            </>
                        ) : (
                            <>
                                <Send className="-ml-1 mr-2 h-4 w-4" />
                                Enviar Mensagem
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};
