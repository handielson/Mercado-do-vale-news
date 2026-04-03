import React, { useState, useEffect } from 'react';
import { X, FolderOpen, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { categoryService } from '../../services/categories';
import { toast } from 'sonner';
import { vpsApiService } from '../../services/vpsApiService';

interface BulkCategoryModalProps {
    isOpen: boolean;
    selectedCount: number;
    selectedIds: string[];
    onClose: () => void;
    onSuccess: () => void;
}

interface Category {
    id: string;
    name: string;
    config?: {
        fields?: Array<{
            key: string;
            label: string;
            type: string;
            required?: boolean;
            options?: string[];
        }>;
    };
}

type Step = 'category' | 'specs';

export const BulkCategoryModal: React.FC<BulkCategoryModalProps> = ({
    isOpen,
    selectedCount,
    selectedIds,
    onClose,
    onSuccess,
}) => {
    const [step, setStep] = useState<Step>('category');
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [specsValues, setSpecsValues] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setStep('category');
            setSelectedCategory(null);
            setSpecsValues({});
            return;
        }
        setIsLoading(true);
        categoryService.list()
            .then(cats => setCategories(cats || []))
            .catch(() => setCategories([]))
            .finally(() => setIsLoading(false));
    }, [isOpen]);


    const requiredFields = selectedCategory?.config?.fields?.filter(f => f.required) ?? [];
    const hasRequiredSpecs = requiredFields.length > 0;

    const handleSelectCategory = (cat: Category) => {
        setSelectedCategory(cat);
        setSpecsValues({});
    };

    const handleNextStep = () => {
        if (!selectedCategory) return;
        if (hasRequiredSpecs) {
            setStep('specs');
        } else {
            handleSave({});
        }
    };

    const handleSave = async (specs: Record<string, string>) => {
        if (!selectedCategory) return;
        setIsSaving(true);
        try {
            const result = await vpsApiService.bulkUpdateCategory(
                selectedIds,
                selectedCategory.id,
                Object.keys(specs).length > 0 ? specs : undefined
            );
            if (result.ok) {
                toast.success(`${result.updated} produto(s) movido(s) para "${selectedCategory.name}" ✓`);
                onSuccess();
                onClose();
            } else {
                toast.error('Erro ao atualizar categoria. Verifique a conexão com a VPS.');
            }
        } catch (err) {
            toast.error('Erro inesperado ao salvar.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSpecsSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSave(specsValues);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Alterar Categoria em Lote</h2>
                        <p className="text-sm text-slate-500">{selectedCount} produto(s) selecionado(s)</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={18} className="text-slate-500" />
                    </button>
                </div>

                {/* Step indicator */}
                <div className="flex items-center px-6 pt-4 gap-2 text-xs font-medium">
                    <span className={step === 'category' ? 'text-blue-600 font-bold' : 'text-slate-400'}>
                        1. Escolher Categoria
                    </span>
                    <ChevronRight size={14} className="text-slate-300" />
                    <span className={step === 'specs' ? 'text-blue-600 font-bold' : 'text-slate-400'}>
                        2. Preencher Especificações
                    </span>
                </div>

                {/* Step 1: Choose category */}
                {step === 'category' && (
                    <div className="p-6">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 size={32} className="animate-spin text-blue-500" />
                            </div>
                        ) : (
                            <>
                                <p className="text-sm text-slate-600 mb-3">Selecione a nova categoria para os produtos:</p>
                                <div className="max-h-64 overflow-y-auto space-y-1 border border-slate-200 rounded-xl p-2">
                                    {categories.map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={() => handleSelectCategory(cat)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors text-sm ${
                                                selectedCategory?.id === cat.id
                                                    ? 'bg-blue-50 border border-blue-200 text-blue-800 font-semibold'
                                                    : 'hover:bg-slate-50 text-slate-700'
                                            }`}
                                        >
                                            <FolderOpen size={16} className={selectedCategory?.id === cat.id ? 'text-blue-500' : 'text-slate-400'} />
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>

                                {selectedCategory && (
                                    <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-800 flex items-start gap-2">
                                        <AlertCircle size={16} className="mt-0.5 shrink-0 text-blue-500" />
                                        <span>
                                            Categoria selecionada: <strong>{selectedCategory.name}</strong>.
                                            {hasRequiredSpecs
                                                ? ` Esta categoria requer ${requiredFields.length} campo(s) obrigatório(s) que precisam ser preenchidos.`
                                                : ' Nenhum campo obrigatório adicional.'}
                                        </span>
                                    </div>
                                )}
                            </>
                        )}

                        <div className="flex gap-3 mt-6">
                            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                                Cancelar
                            </button>
                            <button
                                onClick={handleNextStep}
                                disabled={!selectedCategory || isSaving}
                                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-white transition-colors"
                            >
                                {hasRequiredSpecs ? 'Próximo →' : 'Confirmar Alteração'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: Fill required specs */}
                {step === 'specs' && selectedCategory && (
                    <form onSubmit={handleSpecsSubmit} className="p-6">
                        <p className="text-sm text-slate-600 mb-4">
                            Preencha os campos obrigatórios da categoria <strong>{selectedCategory.name}</strong>.
                            Esses valores serão aplicados a todos os <strong>{selectedCount} produto(s)</strong> selecionados.
                        </p>

                        <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                            {requiredFields.map(field => (
                                <div key={field.key}>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        {field.label}
                                        <span className="text-red-500 ml-1">*</span>
                                    </label>
                                    {field.type === 'select' && field.options ? (
                                        <select
                                            required
                                            value={specsValues[field.key] || ''}
                                            onChange={e => setSpecsValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        >
                                            <option value="">Selecione...</option>
                                            {field.options.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type={field.type === 'number' ? 'number' : 'text'}
                                            required
                                            value={specsValues[field.key] || ''}
                                            onChange={e => setSpecsValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                                            placeholder={`Digite ${field.label.toLowerCase()}...`}
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button type="button" onClick={() => setStep('category')} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                                ← Voltar
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2"
                            >
                                {isSaving ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : 'Confirmar Alteração'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
