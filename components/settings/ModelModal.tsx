
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Model, ModelInput } from '../../types/model';
import { Brand } from '../../types/brand';
import { modelService } from '../../services/models';
import { brandService } from '../../services/brands';

interface ModelModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    model?: Model | null;
}

/**
 * Model Modal Component
 * Add/Edit model with brand association
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Simple form (name + brand + active status)
 * - Auto-generate slug on save
 * - Follows BrandModal pattern
 */
export const ModelModal: React.FC<ModelModalProps> = ({ isOpen, onClose, onSave, model }) => {
    const [name, setName] = useState('');
    const [brandId, setBrandId] = useState('');
    const [active, setActive] = useState(true);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadBrands();
    }, []);

    useEffect(() => {
        if (model) {
            setName(model.name);
            setBrandId(model.brand_id);
            setActive(model.active);
        } else {
            setName('');
            setBrandId('');
            setActive(true);
        }
        setError('');
    }, [model, isOpen]);

    const loadBrands = async () => {
        try {
            setLoading(true);
            const data = await brandService.listActive();
            setBrands(data);
        } catch (error) {
            console.error('Error loading brands:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        // Validation
        if (!name.trim()) {
            setError('Nome do modelo é obrigatório');
            return;
        }

        if (!brandId) {
            setError('Marca é obrigatória');
            return;
        }

        if (name.trim().length < 2) {
            setError('Nome deve ter pelo menos 2 caracteres');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const input: ModelInput = {
                name: name.trim(),
                brand_id: brandId,
                active
            };

            if (model) {
                await modelService.update(model.id, input);
            } else {
                await modelService.create(input);
            }

            onSave();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar modelo');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800">
                        {model ? 'Editar Modelo' : 'Novo Modelo'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {/* Brand Select */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Marca <span className="text-red-500">*</span>
                        </label>
                        {loading ? (
                            <div className="text-sm text-slate-500">Carregando marcas...</div>
                        ) : (
                            <select
                                value={brandId}
                                onChange={(e) => setBrandId(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Selecione uma marca</option>
                                {brands.map((brand) => (
                                    <option key={brand.id} value={brand.id}>
                                        {brand.name}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Name Input */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Nome do Modelo <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex: iPhone 13, Galaxy S24, Redmi Note 12..."
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                        />
                    </div>

                    {/* Active Checkbox */}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="model-active"
                            checked={active}
                            onChange={(e) => setActive(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="model-active" className="text-sm text-slate-700 cursor-pointer">
                            Modelo Ativo (visível no cadastro de produtos)
                        </label>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
