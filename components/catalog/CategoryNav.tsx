import React from 'react';
import { Grid, Smartphone, Tablet, Box, Package } from 'lucide-react';

interface Category {
    id: string | null;
    name: string;
    icon: React.ReactNode;
    count?: number;
}

interface CategoryNavProps {
    activeCategory: string | null;
    onCategoryChange: (categoryId: string | null) => void;
    categories: Array<{ name: string; count: number }>;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    'TODOS': <Grid className="w-8 h-8" />,
    'CELULARES': <Smartphone className="w-8 h-8" />,
    'TABLETS': <Tablet className="w-8 h-8" />,
    'RECEPTOR': <Box className="w-8 h-8" />,
    'OUTROS': <Package className="w-8 h-8" />,
};

export const CategoryNav: React.FC<CategoryNavProps> = ({
    activeCategory,
    onCategoryChange,
    categories
}) => {
    // Criar lista de categorias com "TODOS" no início
    const allCategories: Category[] = [
        {
            id: null,
            name: 'TODOS',
            icon: CATEGORY_ICONS['TODOS'],
            count: categories.reduce((sum, cat) => sum + cat.count, 0)
        },
        ...categories.map(cat => ({
            id: cat.name,
            name: cat.name.toUpperCase(),
            icon: CATEGORY_ICONS[cat.name.toUpperCase()] || CATEGORY_ICONS['OUTROS'],
            count: cat.count
        }))
    ];

    return (
        <div className="bg-white border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                {/* Scroll horizontal em mobile */}
                <div className="overflow-x-auto scrollbar-hide">
                    <div className="flex gap-3 min-w-max sm:min-w-0 sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {allCategories.map((category) => {
                            const isActive = activeCategory === category.id;

                            return (
                                <button
                                    key={category.id || 'all'}
                                    onClick={() => onCategoryChange(category.id)}
                                    className={`
                                        flex flex-col items-center justify-center
                                        p-4 rounded-xl border-2 transition-all duration-200
                                        min-w-[120px] sm:min-w-0
                                        ${isActive
                                            ? 'bg-red-600 border-red-600 text-white shadow-lg scale-105'
                                            : 'bg-white border-slate-200 text-slate-700 hover:border-red-400 hover:shadow-md'
                                        }
                                    `}
                                >
                                    {/* Ícone */}
                                    <div className={`mb-2 ${isActive ? 'text-white' : 'text-slate-600'}`}>
                                        {category.icon}
                                    </div>

                                    {/* Nome */}
                                    <span className={`text-xs font-bold uppercase tracking-wide ${isActive ? 'text-white' : 'text-slate-700'}`}>
                                        {category.name}
                                    </span>

                                    {/* Contador (opcional) */}
                                    {category.count !== undefined && (
                                        <span className={`text-[10px] mt-1 ${isActive ? 'text-red-100' : 'text-slate-500'}`}>
                                            {category.count} {category.count === 1 ? 'item' : 'itens'}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
