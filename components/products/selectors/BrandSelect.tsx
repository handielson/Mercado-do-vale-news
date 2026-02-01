

import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { brandService } from '../../../services/brands';
import { Brand } from '../../../types/brand';

interface BrandSelectProps {
    value: string;
    onChange: (brand: string) => void;
    error?: string;
}

/**
 * BrandSelect Component
 * Select with inline brand creation (no page navigation)
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Uses dynamic brands from brandService
 * - Shows only active brands
 * - Inline creation capability
 */
export const BrandSelect: React.FC<BrandSelectProps> = ({
    value,
    onChange,
    error
}) => {
    const [brands, setBrands] = useState<Brand[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newBrandName, setNewBrandName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        loadBrands();
    }, []);

    const loadBrands = async () => {
        try {
            setIsLoading(true);
            const data = await brandService.listActive(); // Only active brands
            setBrands(data);
        } catch (error) {
            console.error('Error loading brands:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateBrand = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newBrandName.trim()) return;

        try {
            setIsCreating(true);
            const newBrand = await brandService.create({
                name: newBrandName.trim(),
                active: true
            });
            await loadBrands(); // Reload to get updated list
            onChange(newBrand.name); // Set the new brand as selected
            setNewBrandName('');
            setShowCreateDialog(false);
        } catch (error) {
            console.error('Error creating brand:', error);
            alert('Erro ao criar marca');
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
                    disabled={isLoading}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
                >
                    <option value="">Selecione uma marca</option>
                    {brands.map((brand) => (
                        <option key={brand.id} value={brand.name}>
                            {brand.name}
                        </option>
                    ))}
                </select>

                <button
                    type="button"
                    onClick={() => setShowCreateDialog(true)}
                    className="p-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    title="Nova Marca"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            {error && (
                <p className="text-xs text-red-600">{error}</p>
            )}

            {/* Inline Create Dialog */}
            {showCreateDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-900">Nova Marca</h3>
                            <button
                                onClick={() => setShowCreateDialog(false)}
                                className="p-1 hover:bg-slate-100 rounded transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateBrand} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Nome da Marca
                                </label>
                                <input
                                    type="text"
                                    value={newBrandName}
                                    onChange={(e) => setNewBrandName(e.target.value)}
                                    placeholder="Ex: Apple"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
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
                                    disabled={isCreating || !newBrandName.trim()}
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
