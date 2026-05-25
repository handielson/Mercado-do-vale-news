import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, X } from 'lucide-react';
import { Model } from '../../../types/model';
import { Brand } from '../../../types/brand';
import { modelService } from '../../../services/models';
import { brandService } from '../../../services/brands';
import { filterModelsForSearch } from './modelSelectFilter.js';

interface ModelSelectProps {
    value: string;
    onChange: (model: string, selectedModel?: Model) => void;
    brandId?: string;
    error?: string;
}

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
    const [searchTerm, setSearchTerm] = useState(value || '');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    useEffect(() => {
        loadModels();
        loadBrands();
    }, [brandId]);

    useEffect(() => {
        setSearchTerm(value || '');
    }, [value]);

    const loadModels = async () => {
        try {
            setIsLoading(true);
            const data = brandId
                ? await modelService.listActiveByBrand(brandId)
                : await modelService.listActive();
            setModels(data);
        } catch (error) {
            console.error('Error loading models:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefreshModels = async () => {
        await loadModels();
        setIsDropdownOpen(true);
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
            onChange(newModel.name, newModel);
            setSearchTerm(newModel.name);
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

    const filteredModels = filterModelsForSearch(models, searchTerm, value);
    const shouldShowDropdown = isDropdownOpen && (filteredModels.length > 0 || searchTerm.trim().length > 0);

    const handleSelectModel = (model: Model) => {
        onChange(model.name, model);
        setSearchTerm(model.name);
        setIsDropdownOpen(false);
    };

    return (
        <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
                <div className="relative min-w-0 flex-1">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setIsDropdownOpen(true);
                            if (!e.target.value.trim()) {
                                onChange('');
                            }
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        onBlur={() => window.setTimeout(() => setIsDropdownOpen(false), 120)}
                        placeholder="Buscar modelo..."
                        disabled={isLoading}
                        className={`min-w-0 w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50 ${isLoading ? 'cursor-wait' : ''}`}
                    />

                    {shouldShowDropdown && (
                        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                            {filteredModels.length > 0 ? (
                                filteredModels.map((model) => (
                                    <button
                                        key={model.id}
                                        type="button"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => handleSelectModel(model)}
                                        className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${model.name === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                                    >
                                        {model.name}
                                    </button>
                                ))
                            ) : (
                                <div className="px-3 py-2 text-sm text-slate-500">
                                    Nenhum modelo encontrado
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <button
                    type="button"
                    onClick={handleRefreshModels}
                    disabled={isLoading}
                    className="p-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center justify-center disabled:opacity-50"
                    title="Atualizar lista de modelos"
                >
                    <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>

                <button
                    type="button"
                    onClick={() => setShowCreateDialog(true)}
                    className="p-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center justify-center"
                    title="Novo Modelo"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            {error && (
                <p className="text-xs text-red-600">{error}</p>
            )}

            {showCreateDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-900">Novo Modelo</h3>
                            <button
                                type="button"
                                onClick={() => setShowCreateDialog(false)}
                                className="p-1 hover:bg-slate-100 rounded transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateModel} className="space-y-4">
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
