import React, { useState, useEffect } from 'react';
import { Edit2, Plus } from 'lucide-react';
import { Category, CategoryInput } from '../../types/category';
import { categoryService } from '../../services/categories';
import { CategoryEditModal } from '../../components/categories/CategoryEditModal';

/**
 * CategorySettings Page
 * Admin interface for managing category configurations
 */
export const CategorySettings: React.FC = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

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

    const handleEdit = (category: Category) => {
        setEditingCategory(category);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingCategory(null);
        setIsModalOpen(true);
    };

    const handleSave = async (id: string | null, data: CategoryInput) => {
        if (id) {
            // Update existing category
            await categoryService.update(id, data);
        } else {
            // Create new category
            await categoryService.create(data);
        }
        await loadCategories();
        setIsModalOpen(false);
        setEditingCategory(null);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCategory(null);
    };

    const getConfigSummary = (category: Category): string => {
        const config = category.config;
        const required = Object.values(config).filter(v => v === 'required').length;
        const optional = Object.values(config).filter(v => v === 'optional').length;
        const off = Object.values(config).filter(v => v === 'off').length;

        const parts = [];
        if (required > 0) parts.push(`${required} obrigatório${required > 1 ? 's' : ''}`);
        if (optional > 0) parts.push(`${optional} opcional${optional > 1 ? 'is' : ''}`);
        if (off > 0) parts.push(`${off} oculto${off > 1 ? 's' : ''}`);

        return parts.join(', ') || 'Nenhuma configuração';
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Gerenciamento de Categorias</h1>
                    <p className="text-slate-600 mt-1">
                        Configure quais campos são obrigatórios, opcionais ou ocultos para cada categoria
                    </p>
                </div>
                <button
                    onClick={handleCreate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Nova Categoria
                </button>
            </div>

            {/* Categories Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Nome</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Slug</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Configuração</th>
                            <th className="px-6 py-3 text-right text-sm font-semibold text-slate-700">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {isLoading ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                    Carregando categorias...
                                </td>
                            </tr>
                        ) : categories.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                    Nenhuma categoria cadastrada
                                </td>
                            </tr>
                        ) : (
                            categories.map((category) => (
                                <tr key={category.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900">{category.name}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <code className="text-sm text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                            {category.slug}
                                        </code>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-slate-600">
                                            {getConfigSummary(category)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleEdit(category)}
                                            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Editar categoria"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                            Editar
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Legenda:</h3>
                <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-green-500"></span>
                        <span>Obrigatório - Campo deve ser preenchido</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                        <span>Opcional - Campo pode ser deixado vazio</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-500"></span>
                        <span>Oculto - Campo não aparece no formulário</span>
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            <CategoryEditModal
                category={editingCategory}
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSave}
            />
        </div>
    );
};
