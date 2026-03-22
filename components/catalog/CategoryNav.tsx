import React, { useState } from 'react';
import { Grid, Smartphone, Tablet, Box, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Category {
    id: string | null;
    name: string;
    icon: React.ReactNode;
    count?: number;
}

interface CategoryNavProps {
    activeCategory: string | null;
    onCategoryChange: (categoryId: string | null) => void;
    categories: Array<{ id?: string; name: string; count: number }>;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    'TODOS': <Grid className="w-6 h-6" />,
    'CELULARES': <Smartphone className="w-6 h-6" />,
    'TABLETS': <Tablet className="w-6 h-6" />,
    'RECEPTOR': <Box className="w-6 h-6" />,
    'OUTROS': <Package className="w-6 h-6" />,
};

// ============================================================
// CATEGORY NAV - PREMIUM EXPANDABLE GRID
// ============================================================
export const CategoryNav: React.FC<CategoryNavProps> = ({
    activeCategory,
    onCategoryChange,
    categories
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const safeCategories = Array.isArray(categories) ? categories : [];
    const allCategories: Category[] = [
        {
            id: null,
            name: 'TODOS',
            icon: CATEGORY_ICONS['TODOS'],
            count: safeCategories.reduce((sum, cat) => sum + cat.count, 0)
        },
        ...safeCategories.map(cat => ({
            id: cat.id || cat.name,
            name: cat.name.toUpperCase(),
            icon: CATEGORY_ICONS[cat.name.toUpperCase()] || CATEGORY_ICONS['OUTROS'],
            count: cat.count
        }))
    ];

    // Responsive setup: quantia inicial a exibir baseada na tela de celular ou tablet
    const INITIAL_VISIBLE_COUNT = 6;
    const hasMore = allCategories.length > INITIAL_VISIBLE_COUNT;

    const visibleCategories = allCategories.slice(0, INITIAL_VISIBLE_COUNT);
    const hiddenCategories = allCategories.slice(INITIAL_VISIBLE_COUNT);

    const CategoryCard = ({ category }: { category: Category }) => {
        const isActive = activeCategory === category.id;
        
        return (
            <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onCategoryChange(category.id)}
                className={`
                    relative flex flex-col items-center justify-center p-3 sm:p-4 
                    rounded-2xl border transition-all duration-300 w-full min-h-[90px]
                    ${isActive
                        ? 'bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-900/20 z-10'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:shadow-lg hover:bg-slate-50'
                    }
                `}
            >
                {/* Badge de quantidade sutil */}
                {!isActive && category.count !== undefined && category.count > 0 && (
                    <span className="absolute top-2 right-2 text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 rounded-full">
                        {category.count}
                    </span>
                )}
                
                <div className={`mb-2 transition-colors duration-300 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-800'}`}>
                    {category.icon}
                </div>
                
                <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wide text-center leading-tight
                    ${isActive ? 'text-white' : 'text-slate-700'}
                `}>
                    {category.name}
                </span>
            </motion.button>
        );
    };

    return (
        <div className="bg-white border-b border-slate-200 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
                
                {/* Visible Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {visibleCategories.map((category) => (
                        <CategoryCard key={category.id || 'all'} category={category} />
                    ))}
                </div>

                {/* Animated Hidden Categories */}
                <AnimatePresence initial={false}>
                    {isExpanded && hasMore && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
                        >
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 mt-3">
                                {hiddenCategories.map((category) => (
                                    <CategoryCard key={category.id || 'id'} category={category} />
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Toggle Button */}
                {hasMore && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className="flex justify-center mt-5"
                    >
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="flex items-center gap-2 px-5 py-2 rounded-full bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 hover:text-slate-900 transition-colors"
                        >
                            {isExpanded ? (
                                <>Ver menos <ChevronUp className="w-4 h-4" /></>
                            ) : (
                                <>Ver mais categorias ({hiddenCategories.length}) <ChevronDown className="w-4 h-4" /></>
                            )}
                        </button>
                    </motion.div>
                )}
                
            </div>
        </div>
    );
};
