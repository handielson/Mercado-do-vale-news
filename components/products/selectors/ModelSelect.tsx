
import React, { useState, useEffect } from 'react';
import { Plus, X, RefreshCw } from 'lucide-react';
import { Model } from '../../../types/model';
import { Brand } from '../../../types/brand';
import { modelService } from '../../../services/models';
import { brandService } from '../../../services/brands';

interface ModelSelectProps {
    value: string;
    onChange: (model: string) => void;
    brandId?: string;  // Filter models by brand
    error?: string;
}

/**
 * ModelSelect Component
 * Select with inline model creation (no page navigation)
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Filters models by selected brand
 * - Inline creation with brand association
 * - Follows BrandSelect pattern
 */
export const ModelSelect: React.FC<ModelSelectProps> = ({
    value,
    onChange,
    brandId,
    error
}) => {
    const [models, setModels] = useState<Model[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newModelName, setNewModelName] = useState('');
    const [selectedBrandId, setSelectedBrandId] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        loadModels();
        loadBrands();
    }, [brandId]);

    const loadModels = async () => {
        try {
            setIsLoading(true);
            let data: Model[];
            if (brandId) {
                data = await modelService.listActiveByBrand(brandId);
            } else {
                data = await modelService.listActive();
            }
            setModels(data);
        } catch (error) {
            console.error('Error loading models:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadBrands = async () => {
        try {
            const data = await brandService.listActive();
            setBrands(data);
        } catch (error) {
            console.error('Error loading brands:', error);
        }
    };

    const handleCreateModel = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newModelName.trim()) return;

        const targetBrandId = brandId || selectedBrandId;
        if (!targetBrandId) {
            alert('Selecione uma marca primeiro');
            return;
        }

        try {
            setIsCreating(true);
            const newModel = await modelService.create({
                name: newModelName.trim(),
                brand_id: targetBrandId,
                active: true
            });
            await loadModels();
            onChange(newModel.name);
            setNewModelName('');
            setSelectedBrandId('');
            setShowCreateDialog(false);
        } catch (error) {
            console.error('Error creating model:', error);
            alert('Erro ao criar modelo');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={isLoading || !brandId}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
                >
                    <option value="">
                        {!brandId ? 'Selecione uma marca primeiro' : 'Selecione um modelo'}
                    </option>
                    {models.map((model) => (
                        <option key={model.id} value={model.name}>
                            {model.name}
                        </option>
                    ))}
                </select>

                <button
                    type="button"
                    onClick={loadModels}
                    disabled={isLoading}
                    className="p-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center justify-center disabled:opacity-50"
                    title="Atualizar lista de modelos"
                >
                    <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>

                <a
                    href="/admin/settings/models"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center justify-center"
                    title="Gerenciar Modelos (abre em nova aba)"
                >
                    <Plus className="w-5 h-5" />
                </a>
            </div>

            {error && (
                <p className="text-xs text-red-600">{error}</p>
            )}

            {/* Inline Create Dialog */}
            {showCreateDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-900">Novo Modelo</h3>
                            <button
                                onClick={() => setShowCreateDialog(false)}
                                className="p-1 hover:bg-slate-100 rounded transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateModel} className="space-y-4">
                            {/* Brand Select (only if brandId not provided) */}
                            {!brandId && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Marca *
                                    </label>
                                    <select
                                        value={selectedBrandId}
                                        onChange={(e) => setSelectedBrandId(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    >
                                        <option value="">Selecione uma marca</option>
                                        {brands.map((brand) => (
                                            <option key={brand.id} value={brand.id}>
                                                {brand.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Nome do Modelo *
                                </label>
                                <input
                                    type="text"
                                    value={newModelName}
                                    onChange={(e) => setNewModelName(e.target.value)}
                                    placeholder="Ex: iPhone 13, Galaxy S24..."
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateDialog(false)}
                                    disabled={isCreating}
                                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreating || !newModelName.trim()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isCreating ? 'Criando...' : 'Criar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
