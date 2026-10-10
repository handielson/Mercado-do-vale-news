import React, { useState, useEffect, useMemo } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Category } from '../../types/category';
import { categoryService } from '../../services/categories';
import { buildCategorySelectGroups } from '../../utils/categorySelectTree';

interface CategorySelectProps {
    value: string;
    onChange: (categoryId: string) => void;
    error?: string;
}

/** Uses the complete category editor in another tab, preserving the product form. */
export const CategorySelect: React.FC<CategorySelectProps> = ({ value, onChange, error }) => {
    const [categories, setCategories] = useState<Category[]>([]);
    const categoryGroups = useMemo(() => buildCategorySelectGroups(categories), [categories]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => { void loadCategories(); }, []);

    const loadCategories = async () => {
        try {
            setIsLoading(true);
            // Creation happens in another tab: bypass this tab's cached category list.
            setCategories(await categoryService.list(true));
        } catch (error) {
            console.error('Error loading categories:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
                <select
                    aria-label="Categoria do produto"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={isLoading}
                    className="min-w-0 w-full flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
                >
                    <option value="">Selecione uma categoria</option>
                    {categoryGroups.map((group) => (
                        <optgroup key={group.id} label={group.name}>
                            {group.options.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.depth ? `${'　'.repeat(option.depth)}↳ ${option.path}` : `${option.path} (categoria)`}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={loadCategories}
                    disabled={isLoading}
                    className="shrink-0 p-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center justify-center disabled:opacity-50"
                    title="Atualizar lista de categorias"
                >
                    <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <a
                    href="/admin/settings/categories/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Nova categoria (abre em nova aba)"
                    title="Nova categoria (abre em nova aba)"
                    className="shrink-0 p-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center justify-center"
                >
                    <Plus className="w-5 h-5" />
                </a>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
    );
};
