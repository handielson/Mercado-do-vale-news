import React, { useState, useEffect } from 'react';
import { Grid, Smartphone, Tablet, Box, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Category {
    id: string | null;
    name: string;
    icon: React.ReactNode;
    count?: number;
    parent_id?: string | null;
}

interface CategoryNavProps {
    activeCategory: string | null;
    onCategoryChange: (categoryId: string | string[] | null) => void;
    categories: Array<{ id?: string; name: string; count: number; parent_id?: string | null }>;
    activeCategoryIds?: string[];
    forceExpanded?: boolean;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    'TODOS': <Grid className="w-6 h-6" />,
    'CELULARES': <Smartphone className="w-6 h-6" />,
    'TABLETS': <Tablet className="w-6 h-6" />,
    'RECEPTOR': <Box className="w-6 h-6" />,
    'OUTROS': <Package className="w-6 h-6" />,
};

// ============================================================
// CATEGORY NAV - PREMIUM EXPANDABLE GRID WITH SUBCATEGORIES
// ============================================================
export const CategoryNav: React.FC<CategoryNavProps> = ({
    activeCategory,
    onCategoryChange,
    categories,
    activeCategoryIds = [],
    forceExpanded,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Sync with external forceExpanded (from mobile ··· button)
    useEffect(() => {
        if (forceExpanded !== undefined) setIsExpanded(forceExpanded);
    }, [forceExpanded]);

    const safeCategories = Array.isArray(categories) ? categories : [];
    
    // Separação Raízes vs Filhos
    const rootCategoriesData = safeCategories.filter(c => !c.parent_id);
    const childCategories = safeCategories.filter(c => c.parent_id);

    // Identificar qual raiz está ativa (seja ela mesma ou um filho seu)
    const activeCatObj = safeCategories.find(c => c.id === activeCategory);
    const activeRootId = activeCatObj ? (activeCatObj.parent_id || activeCatObj.id) : null;

    const allCategories: Category[] = [
        {
            id: null,
            name: 'TODOS',
            icon: CATEGORY_ICONS['TODOS'],
            // Soma todos os produtos no "Todos"
            count: safeCategories.reduce((sum, cat) => sum + cat.count, 0)
        },
        ...rootCategoriesData.map(cat => {
            // Conta os produtos da categoria pai + produtos das subcategorias diretas
            const childrenForThisRoot = childCategories.filter(c => c.parent_id === cat.id);
            const childrenCount = childrenForThisRoot.reduce((s, c) => s + c.count, 0);
            
            return {
                id: cat.id || cat.name,
                name: cat.name.toUpperCase(),
                icon: CATEGORY_ICONS[cat.name.toUpperCase()] || CATEGORY_ICONS['OUTROS'],
                count: cat.count + childrenCount,
                parent_id: cat.parent_id
            };
        })
    ];

    // Responsive setup
    const INITIAL_VISIBLE_COUNT = 6;
    const hasMore = allCategories.length > INITIAL_VISIBLE_COUNT;

    const visibleCategories = allCategories.slice(0, INITIAL_VISIBLE_COUNT);
    const hiddenCategories = allCategories.slice(INITIAL_VISIBLE_COUNT);

    const activeRootChildren = activeRootId 
        ? childCategories.filter(c => c.parent_id === activeRootId)
        : [];

    const CategoryCard = ({ category }: { category: Category }) => {
        // O card raiz fica ativo se "todos", se ele próprio ou se uma subcategoria dele estiver ativa
        const isActive = activeRootId === category.id;
        const handleCategoryClick = () => {
            if (category.id === null) {
                onCategoryChange(null);
                return;
            }
            const children = childCategories.filter(c => c.parent_id === category.id);
            if (children.length > 0) {
                const ids = [category.id, ...children.map(c => c.id!)];
                onCategoryChange(ids);
            } else {
                onCategoryChange(category.id);
            }
        };

        return (
            <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleCategoryClick}
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

                {/* Subcategories Row (Cascata/Pills) */}
                <AnimatePresence>
                    {activeRootChildren.length > 0 && (
                        <motion.div 
                            initial={{ opacity: 0, height: 0, marginTop: 0 }}
                            animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                            exit={{ opacity: 0, height: 0, marginTop: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-2 justify-center">
                                {/* Todos — passa o pai + todos os filhos */}
                                <button 
                                    onClick={() => onCategoryChange([activeRootId!, ...activeRootChildren.map(c => c.id!)])}
                                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                                        activeCategoryIds.length > 1
                                            ? 'bg-blue-600 text-white shadow-md' 
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    Todos ({allCategories.find(c => c.id === activeRootId)?.count || 0})
                                </button>
                                {activeRootChildren.map(child => (
                                    <button 
                                        key={child.id!}
                                        onClick={() => onCategoryChange(child.id!)}
                                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                                            activeCategoryIds.length === 1 && activeCategoryIds[0] === child.id 
                                                ? 'bg-blue-600 text-white shadow-md' 
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {child.name} {child.count > 0 && `(${child.count})`}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                
            </div>
        </div>
    );
};
