
import React, { useState, useEffect } from 'react';
import { Plus, X, RefreshCw } from 'lucide-react';
import { Category, CategoryConfig, FieldRequirement } from '../../types/category';
import { categoryService } from '../../services/categories';

interface CategorySelectProps {
    value: string;
    onChange: (categoryId: string) => void;
    error?: string;
}

/**
 * CategorySelect Component
 * Select with inline category creation including field requirements configuration
 */
export const CategorySelect: React.FC<CategorySelectProps> = ({
    value,
    onChange,
    error
}) => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Default config: all fields optional
    const [config, setConfig] = useState<CategoryConfig>({
        imei: 'optional',
        serial: 'optional',
        color: 'optional',
        storage: 'optional',
        ram: 'optional',
        version: 'optional',
        battery_health: 'optional'
    });

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            setIsLoading(true);
            const data = await categoryService.list();
            setCategories(data);
        } catch (error) {
            console.error('Error loading categories:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateCategory = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newCategoryName.trim()) return;

        try {
            setIsCreating(true);
            const newCategory = await categoryService.create({
                name: newCategoryName.trim(),
                config
            });
            setCategories([...categories, newCategory]);
            onChange(newCategory.id);
            setNewCategoryName('');
            setShowCreateDialog(false);
            // Reset config to default
            setConfig({
                imei: 'optional',
                serial: 'optional',
                color: 'optional',
                storage: 'optional',
                ram: 'optional',
                version: 'optional',
                battery_health: 'optional'
            });
        } catch (error) {
            console.error('Error creating category:', error);
            alert('Erro ao criar categoria');
        } finally {
            setIsCreating(false);
        }
    };

    const updateFieldConfig = (field: keyof CategoryConfig, value: FieldRequirement) => {
        setConfig(prev => ({ ...prev, [field]: value }));
    };

    const fieldLabels: Record<keyof CategoryConfig, string> = {
        imei: 'IMEI',
        serial: 'Serial',
        color: 'Cor',
        storage: 'Armazenamento',
        ram: 'RAM',
        version: 'Versão',
        battery_health: 'Saúde Bateria'
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
                    <option value="">Selecione uma categoria</option>
                    {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                            {cat.name}
                        </option>
                    ))}
                </select>

                <button
                    type="button"
                    onClick={loadCategories}
                    disabled={isLoading}
                    className="p-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center justify-center disabled:opacity-50"
                    title="Atualizar lista de categorias"
                >
                    <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>

                <button
                    type="button"
                    onClick={() => setShowCreateDialog(true)}
                    className="p-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    title="Nova Categoria"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            {error && (
                <p className="text-xs text-red-600">{error}</p>
            )}

            {/* Inline Create Dialog with Config Table */}
            {showCreateDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-900">Nova Categoria</h3>
                            <button
                                onClick={() => setShowCreateDialog(false)}
                                className="p-1 hover:bg-slate-100 rounded transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateCategory} className="space-y-6">
                            {/* Category Name */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Nome da Categoria *
                                </label>
                                <input
                                    type="text"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    placeholder="Ex: Notebooks"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                />
                            </div>

                            {/* Field Requirements Configuration Table */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Configuração de Campos
                                </label>
                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left font-medium text-slate-700">Campo</th>
                                                <th className="px-4 py-2 text-center font-medium text-slate-700">🔴 Oculto</th>
                                                <th className="px-4 py-2 text-center font-medium text-slate-700">🟡 Opcional</th>
                                                <th className="px-4 py-2 text-center font-medium text-slate-700">🟢 Obrigatório</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {(Object.keys(fieldLabels) as Array<keyof CategoryConfig>).map((field) => (
                                                <tr key={field} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 font-medium text-slate-900">
                                                        {fieldLabels[field]}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <input
                                                            type="radio"
                                                            name={field}
                                                            checked={config[field] === 'off'}
                                                            onChange={() => updateFieldConfig(field, 'off')}
                                                            className="w-4 h-4 text-red-600 focus:ring-red-500"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <input
                                                            type="radio"
                                                            name={field}
                                                            checked={config[field] === 'optional'}
                                                            onChange={() => updateFieldConfig(field, 'optional')}
                                                            className="w-4 h-4 text-yellow-600 focus:ring-yellow-500"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <input
                                                            type="radio"
                                                            name={field}
                                                            checked={config[field] === 'required'}
                                                            onChange={() => updateFieldConfig(field, 'required')}
                                                            className="w-4 h-4 text-green-600 focus:ring-green-500"
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    Configure quais campos serão exibidos e obrigatórios para produtos desta categoria
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
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
                                    disabled={isCreating || !newCategoryName.trim()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isCreating ? 'Criando...' : 'Criar Categoria'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
