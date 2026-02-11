import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import type { ModelVariantWithDetails } from '../../types/model-architecture';
import { modelVariantsService } from '../../services/model-variants';
import { VariantImageGallery } from './VariantImageGallery';

interface VariantManagerProps {
    isOpen: boolean;
    onClose: () => void;
    modelId: string;
    modelName: string;
}

export const VariantManager: React.FC<VariantManagerProps> = ({
    isOpen,
    onClose,
    modelId,
    modelName
}) => {
    const [variants, setVariants] = useState<ModelVariantWithDetails[]>([]);
    const [versions, setVersions] = useState<any[]>([]);
    const [colors, setColors] = useState<any[]>([]);
    const [selectedVersionId, setSelectedVersionId] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Gallery state
    const [selectedVariant, setSelectedVariant] = useState<ModelVariantWithDetails | null>(null);
    const [showGallery, setShowGallery] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen, modelId]);

    const loadData = async () => {
        try {
            setLoading(true);

            // Carregar variantes, versões e cores
            const [variantsData, versionsData, colorsData] = await Promise.all([
                modelVariantsService.getByModelId(modelId),
                // TODO: Criar service para versions
                fetch('/api/versions').then(r => r.json()),
                // TODO: Criar service para colors
                fetch('/api/colors').then(r => r.json())
            ]);

            setVariants(variantsData);
            setVersions(versionsData);
            setColors(colorsData);

            // Selecionar primeira versão por padrão
            if (versionsData.length > 0 && !selectedVersionId) {
                setSelectedVersionId(versionsData[0].id);
            }
        } catch (err) {
            setError('Erro ao carregar dados');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddColor = async (colorId: string) => {
        if (!selectedVersionId) {
            setError('Selecione uma versão primeiro');
            return;
        }

        try {
            const variant = await modelVariantsService.getOrCreate({
                model_id: modelId,
                version_id: selectedVersionId,
                color_id: colorId
            });

            await loadData(); // Recarregar lista
        } catch (err) {
            setError('Erro ao adicionar cor');
        }
    };

    const handleRemoveVariant = async (variantId: string) => {
        if (!confirm('Remover esta variante? Todas as imagens associadas serão excluídas.')) {
            return;
        }

        try {
            await modelVariantsService.remove(variantId);
            await loadData();
        } catch (err) {
            setError('Erro ao remover variante');
        }
    };

    const handleOpenGallery = (variant: ModelVariantWithDetails) => {
        setSelectedVariant(variant);
        setShowGallery(true);
    };

    const handleCloseGallery = () => {
        setShowGallery(false);
        setSelectedVariant(null);
        loadData(); // Recarregar para atualizar contagem de imagens
    };

    // Filtrar variantes pela versão selecionada
    const filteredVariants = variants.filter(v => v.version_id === selectedVersionId);

    // Cores já adicionadas nesta versão
    const addedColorIds = filteredVariants.map(v => v.color_id);
    const availableColors = colors.filter(c => !addedColorIds.includes(c.id));

    if (!isOpen) return null;

    if (showGallery && selectedVariant) {
        return (
            <VariantImageGallery
                isOpen={showGallery}
                onClose={handleCloseGallery}
                variant={selectedVariant}
            />
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Gerenciar Variantes</h2>
                        <p className="text-sm text-slate-600">{modelName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {loading ? (
                        <div className="text-center py-8 text-slate-500">Carregando...</div>
                    ) : (
                        <>
                            {/* Seletor de Versão */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Versão do Modelo
                                </label>
                                <select
                                    value={selectedVersionId}
                                    onChange={(e) => setSelectedVersionId(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    {versions.map(v => (
                                        <option key={v.id} value={v.id}>{v.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Lista de Cores/Variantes */}
                            <div>
                                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                                    Cores Disponíveis
                                </h3>

                                {filteredVariants.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500">
                                        Nenhuma cor adicionada ainda
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {filteredVariants.map((variant) => (
                                            <div
                                                key={variant.id}
                                                className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100"
                                            >
                                                {/* Cor */}
                                                <div className="flex items-center gap-2 flex-1">
                                                    <div
                                                        className="w-6 h-6 rounded-full border-2 border-slate-300"
                                                        style={{ backgroundColor: variant.color?.hex_code || '#ccc' }}
                                                    />
                                                    <span className="font-medium text-slate-800">
                                                        {variant.color?.name}
                                                    </span>
                                                </div>

                                                {/* Contagem de Imagens */}
                                                <div className="text-sm text-slate-600">
                                                    {variant.image_count || 0} {variant.image_count === 1 ? 'foto' : 'fotos'}
                                                </div>

                                                {/* Botões */}
                                                <button
                                                    onClick={() => handleOpenGallery(variant)}
                                                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-1"
                                                >
                                                    <ImageIcon size={14} />
                                                    Imagens
                                                </button>

                                                <button
                                                    onClick={() => handleRemoveVariant(variant.id)}
                                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Adicionar Nova Cor */}
                            {availableColors.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-700 mb-3">
                                        Adicionar Cor
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        {availableColors.map((color) => (
                                            <button
                                                key={color.id}
                                                onClick={() => handleAddColor(color.id)}
                                                className="flex items-center gap-2 p-2 border rounded-lg hover:bg-slate-50"
                                            >
                                                <div
                                                    className="w-5 h-5 rounded-full border-2 border-slate-300"
                                                    style={{ backgroundColor: color.hex_code || '#ccc' }}
                                                />
                                                <span className="text-sm">{color.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Error */}
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                    {error}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t bg-slate-50 sticky bottom-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Concluído
                    </button>
                </div>
            </div>
        </div>
    );
};
