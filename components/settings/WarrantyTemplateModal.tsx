import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { WarrantyTemplateInput } from '../../types/warranty';

interface WarrantyTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (input: WarrantyTemplateInput) => Promise<void>;
    template?: {
        id: string;
        name: string;
        description?: string;
        duration_days: number;
        terms: string;
        active: boolean;
    };
}

/**
 * WarrantyTemplateModal Component
 * Modal for creating/editing warranty templates
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Modal-based editing
 * - Controlled form with validation
 * - Preview of warranty terms with variables
 */
export const WarrantyTemplateModal: React.FC<WarrantyTemplateModalProps> = ({
    isOpen,
    onClose,
    onSave,
    template
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [durationDays, setDurationDays] = useState(90);
    const [terms, setTerms] = useState('');
    const [active, setActive] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (template) {
            setName(template.name);
            setDescription(template.description || '');
            setDurationDays(template.duration_days);
            setTerms(template.terms);
            setActive(template.active);
        } else {
            setName('');
            setDescription('');
            setDurationDays(90);
            setTerms('');
            setActive(true);
        }
        setError('');
    }, [template, isOpen]);

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Nome é obrigatório');
            return;
        }
        if (durationDays < 0) {
            setError('Duração não pode ser negativa');
            return;
        }
        if (!terms.trim()) {
            setError('Termos de garantia são obrigatórios');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const input: WarrantyTemplateInput = {
                name: name.trim(),
                description: description.trim() || undefined,
                duration_days: durationDays,
                terms: terms.trim(),
                active
            };

            await onSave(input);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar template');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <h2 className="text-xl font-semibold text-slate-900">
                        {template ? 'Editar Template de Garantia' : 'Novo Template de Garantia'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Nome do Template *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex: Garantia Estendida 2 Anos"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Nome que aparecerá na seleção de templates
                        </p>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Descrição (opcional)
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Ex: Garantia estendida para produtos premium"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Duration */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Duração (dias) *
                        </label>
                        <input
                            type="number"
                            min="0"
                            value={durationDays}
                            onChange={(e) => setDurationDays(parseInt(e.target.value) || 0)}
                            placeholder="Ex: 365"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Período de garantia em dias (0 = sem garantia)
                        </p>
                    </div>

                    {/* Terms */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Termos de Garantia *
                        </label>
                        <textarea
                            value={terms}
                            onChange={(e) => setTerms(e.target.value)}
                            placeholder="Digite os termos de garantia..."
                            rows={8}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
                        />
                        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-xs font-semibold text-blue-900 mb-1">
                                💡 Variáveis Disponíveis:
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-xs text-blue-800">
                                <div><code className="bg-blue-100 px-1 rounded">{'{dias}'}</code> - Dias de garantia</div>
                                <div><code className="bg-blue-100 px-1 rounded">{'{produto}'}</code> - Nome do produto</div>
                                <div><code className="bg-blue-100 px-1 rounded">{'{marca}'}</code> - Marca do produto</div>
                                <div><code className="bg-blue-100 px-1 rounded">{'{data_compra}'}</code> - Data da compra</div>
                            </div>
                            <p className="text-xs text-blue-700 mt-2">
                                Essas variáveis serão substituídas automaticamente no recibo
                            </p>
                        </div>
                    </div>

                    {/* Preview */}
                    {terms && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                            <p className="text-xs font-semibold text-slate-600 mb-2">
                                📄 Preview (com variáveis de exemplo):
                            </p>
                            <div className="text-sm text-slate-700 whitespace-pre-wrap">
                                {terms
                                    .replace(/{dias}/g, String(durationDays))
                                    .replace(/{produto}/g, 'iPhone 15 Pro')
                                    .replace(/{marca}/g, 'Apple')
                                    .replace(/{data_compra}/g, new Date().toLocaleDateString('pt-BR'))
                                }
                            </div>
                        </div>
                    )}

                    {/* Active Status */}
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                        <input
                            type="checkbox"
                            checked={active}
                            onChange={(e) => setActive(e.target.checked)}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <div>
                            <label className="font-medium text-slate-700 cursor-pointer">
                                Template Ativo
                            </label>
                            <p className="text-xs text-slate-500">
                                Templates inativos não aparecem na seleção de produtos
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                        disabled={saving}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            'Salvar Template'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
