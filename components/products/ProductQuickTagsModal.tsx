import React, { useEffect, useMemo, useState } from 'react';
import { X, Tags as TagsIcon, Loader2, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { Product } from '../../types/product';
import { modelService } from '../../services/models';
import { crossSellTagsService, type CrossSellTag } from '../../services/cross-sell-tags';

interface ProductQuickTagsModalProps {
    product: Product;
    isOpen: boolean;
    onClose: () => void;
    onSaved?: (tags: string[]) => void;
}

/**
 * ProductQuickTagsModal
 *
 * Edita as tags de **cross-sell** do MODELO ao qual o produto pertence.
 * Essas tags ficam em models.template_values.tags_venda e alimentam a
 * seção "Aproveite e leve junto" da PDP — todos os produtos do mesmo
 * modelo compartilham essas tags.
 */
export const ProductQuickTagsModal: React.FC<ProductQuickTagsModalProps> = ({
    product,
    isOpen,
    onClose,
    onSaved,
}) => {
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [dictionary, setDictionary] = useState<CrossSellTag[]>([]);
    const [modelName, setModelName] = useState<string>('');
    const [modelData, setModelData] = useState<any | null>(null);
    const [newTagText, setNewTagText] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        setIsLoading(true);
        setNewTagText('');
        const load = async () => {
            try {
                const tasks: Promise<any>[] = [crossSellTagsService.list()];
                if (product.model_id) tasks.push(modelService.getById(product.model_id));
                const [dict, model] = await Promise.all(tasks);
                if (cancelled) return;
                setDictionary(dict || []);
                if (model) {
                    setModelData(model);
                    setModelName(model.name || '');
                    const current = model.template_values?.tags_venda;
                    setSelectedTags(Array.isArray(current) ? current.filter((t: any) => typeof t === 'string' && t.trim()) : []);
                } else {
                    setModelData(null);
                    setModelName('');
                    setSelectedTags([]);
                }
            } catch (err) {
                console.error('[ProductQuickTagsModal] load', err);
                if (!cancelled) toast.error('Erro ao carregar tags');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [isOpen, product.id, product.model_id]);

    const dictionaryAvailable = useMemo(
        () => dictionary.filter(d => !selectedTags.includes(d.name)),
        [dictionary, selectedTags]
    );

    if (!isOpen) return null;

    const addTagFromInput = () => {
        const value = newTagText.trim();
        if (!value) return;
        if (selectedTags.includes(value)) {
            toast.info('Essa tag já está adicionada');
            setNewTagText('');
            return;
        }
        setSelectedTags(prev => [...prev, value]);
        setNewTagText('');
    };

    const addDictionaryTag = (name: string) => {
        if (selectedTags.includes(name)) return;
        setSelectedTags(prev => [...prev, name]);
    };

    const removeTag = (tag: string) => {
        setSelectedTags(prev => prev.filter(t => t !== tag));
    };

    const handleSave = async () => {
        if (!modelData) {
            toast.error('Produto sem modelo associado — cadastre um modelo para usar tags de cross-sell.');
            return;
        }
        setIsSaving(true);
        try {
            const newTemplateValues = {
                ...(modelData.template_values || {}),
                tags_venda: selectedTags,
            };
            await modelService.update(modelData.id, {
                name: modelData.name,
                brand_id: modelData.brand_id,
                category_id: modelData.category_id,
                description: modelData.description,
                template_values: newTemplateValues,
                eans: modelData.eans,
            });
            toast.success('Tags salvas no modelo');
            onSaved?.(selectedTags);
            onClose();
        } catch (err) {
            console.error('[ProductQuickTagsModal] save', err);
            toast.error('Erro ao salvar tags');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        <TagsIcon className="w-5 h-5 text-purple-600" />
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Tags de Cross-Sell do Modelo</h2>
                            <p className="text-xs text-slate-500 truncate max-w-[400px]">
                                {modelName || product.name}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">
                        As tags são salvas no modelo. Qualquer alteração afeta <strong>todos os produtos</strong> com
                        o mesmo modelo. Elas alimentam a vitrine "Aproveite e leve junto" — não entram na busca normal do cliente.
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {!product.model_id ? (
                        <p className="text-sm text-slate-500 italic">
                            Este produto não tem modelo associado. Cadastre um modelo na aba de edição para gerenciar tags de cross-sell.
                        </p>
                    ) : isLoading ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                        </div>
                    ) : (
                        <>
                            <div>
                                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                                    Tags ativas no modelo ({selectedTags.length})
                                </div>
                                <div className="flex flex-wrap gap-2 min-h-[40px] p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    {selectedTags.length === 0 ? (
                                        <span className="text-sm text-slate-400 italic">Nenhuma tag aplicada.</span>
                                    ) : (
                                        selectedTags.map(tag => (
                                            <span
                                                key={tag}
                                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                                            >
                                                {tag}
                                                <button
                                                    type="button"
                                                    onClick={() => removeTag(tag)}
                                                    className="hover:text-blue-900"
                                                    title="Remover"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div>
                                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                                    Adicionar nova tag
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newTagText}
                                        onChange={(e) => setNewTagText(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTagFromInput(); } }}
                                        placeholder="Ex: Gamer, Type-C, Acessório Xiaomi (Enter para adicionar)"
                                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button
                                        onClick={addTagFromInput}
                                        disabled={!newTagText.trim()}
                                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        Adicionar
                                    </button>
                                </div>
                            </div>

                            {dictionaryAvailable.length > 0 && (
                                <div>
                                    <div className="text-xs font-medium text-indigo-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <TagsIcon className="w-3.5 h-3.5" /> Dicionário (clique para adicionar)
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {dictionaryAvailable.map(tag => (
                                            <button
                                                key={tag.id}
                                                type="button"
                                                onClick={() => addDictionaryTag(tag.name)}
                                                className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium border border-indigo-200 transition-colors"
                                            >
                                                <Check className="w-3 h-3" />
                                                {tag.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 bg-slate-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || isLoading || !product.model_id}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <TagsIcon className="w-4 h-4" />}
                        Salvar no Modelo
                    </button>
                </div>
            </div>
        </div>
    );
};
