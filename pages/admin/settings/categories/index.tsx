import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit2, Plus, GripVertical, BookMarked, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { Category } from '../../../../types/category';
import { categoryService } from '../../../../services/categories';
import { NextStepBanner } from '../../../../components/ui/NextStepBanner';
import { toast } from 'react-hot-toast';
import { CategoryProductsPanel } from '../../../../components/categories/CategoryProductsPanel';

interface DraggedProduct {
    product: {
        id: string; name: string; sku: string; brand: string;
        category_id: string; status: string; price_retail: number;
        stock_quantity: number; thumbnail: string | null; is_primary_category: boolean;
    };
    sourceCategoryId: string;
}

export default function CategorySettingsPage() {
    const navigate = useNavigate();
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [draggedProduct, setDraggedProduct] = useState<DraggedProduct | null>(null);
    const [productsRefreshKey, setProductsRefreshKey] = useState(0);

    // States for Category Drag & Drop
    const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
    const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(null);
    const [dropPosition, setDropPosition] = useState<'before' | 'after' | 'inside' | null>(null);
    const lastDragClientYRef = useRef<number | null>(null);
    const dragScrollFrameRef = useRef<number | null>(null);

    useEffect(() => {
        loadCategories();
    }, []);

    useEffect(() => {
        const isDragging = Boolean(draggedProduct || draggedCategoryId);

        if (!isDragging) {
            lastDragClientYRef.current = null;
            if (dragScrollFrameRef.current !== null) {
                cancelAnimationFrame(dragScrollFrameRef.current);
                dragScrollFrameRef.current = null;
            }
            return;
        }

        const edgeThreshold = 140;
        const maxScrollStep = 24;

        const handleWindowDragOver = (event: DragEvent) => {
            lastDragClientYRef.current = event.clientY;
        };

        const tick = () => {
            const clientY = lastDragClientYRef.current;
            if (clientY != null) {
                const viewportHeight = window.innerHeight;
                let delta = 0;

                if (clientY < edgeThreshold) {
                    const intensity = (edgeThreshold - clientY) / edgeThreshold;
                    delta = -Math.ceil(intensity * maxScrollStep);
                } else if (clientY > viewportHeight - edgeThreshold) {
                    const intensity = (clientY - (viewportHeight - edgeThreshold)) / edgeThreshold;
                    delta = Math.ceil(intensity * maxScrollStep);
                }

                if (delta !== 0) {
                    window.scrollBy({ top: delta, behavior: 'auto' });
                }
            }

            dragScrollFrameRef.current = window.requestAnimationFrame(tick);
        };

        window.addEventListener('dragover', handleWindowDragOver);
        dragScrollFrameRef.current = window.requestAnimationFrame(tick);

        return () => {
            window.removeEventListener('dragover', handleWindowDragOver);
            if (dragScrollFrameRef.current !== null) {
                cancelAnimationFrame(dragScrollFrameRef.current);
                dragScrollFrameRef.current = null;
            }
        };
    }, [draggedProduct, draggedCategoryId]);

    const loadCategories = async () => {
        try {
            setIsLoading(true);
            const data = await categoryService.list();
            data.sort((a, b) => {
                const orderA = a.sort_order ?? 9999;
                const orderB = b.sort_order ?? 9999;
                if (orderA !== orderB) return orderA - orderB;
                return a.name.localeCompare(b.name);
            });
            setCategories(data);
        } catch (error) {
            console.error('Error loading categories:', error);
            toast.error('Erro ao carregar categorias');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = (category: Category) => {
        navigate(`/admin/settings/categories/${category.id}/edit`);
    };

    const handleCreate = () => {
        navigate('/admin/settings/categories/new');
    };

    const getConfigSummary = (category: Category): string => {
        const config = category.config || {};
        const required = Object.values(config).filter(v => v === 'required').length;
        const optional = Object.values(config).filter(v => v === 'optional').length;
        const off = Object.values(config).filter(v => v === 'off').length;
        const parts = [];
        if (required > 0) parts.push(`${required} obrigatório${required > 1 ? 's' : ''}`);
        if (optional > 0) parts.push(`${optional} opcional${optional > 1 ? 'is' : ''}`);
        if (off > 0) parts.push(`${off} oculto${off > 1 ? 's' : ''}`);
        return parts.join(', ') || 'Nenhuma configuração';
    };

    // --- Expand / collapse ---
    const toggleExpand = (id: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const expandAll = () => {
        setExpandedCategories(new Set(categories.map(c => c.id!)));
    };

    const collapseAll = () => {
        setExpandedCategories(new Set());
    };

    const allExpanded = categories.length > 0 && expandedCategories.size === categories.length;

    // --- Product drag callbacks ---
    const handleProductDragStart = useCallback((product: DraggedProduct['product'], sourceCategoryId: string) => {
        setDraggedProduct({ product, sourceCategoryId });
    }, []);

    const handleProductDragEnd = useCallback(() => {
        setDraggedProduct(null);
    }, []);

    const handleProductsChanged = useCallback(() => {
        setProductsRefreshKey(prev => prev + 1);
    }, []);

    // ------------- CATEGORY DRAG & DROP LOGIC -------------
    const onDragStart = (e: React.DragEvent, id: string) => {
        setDraggedCategoryId(id);
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const onDragOver = (e: React.DragEvent, id: string | null) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        lastDragClientYRef.current = e.clientY;

        if (id === null) {
            if (hoveredCategoryId !== null) setHoveredCategoryId(null);
            if (dropPosition !== 'inside') setDropPosition('inside');
            return;
        }

        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const threshold = rect.height * 0.25;

        let newPosition: 'before' | 'after' | 'inside' = 'inside';
        if (y < threshold) newPosition = 'before';
        else if (y > rect.height - threshold) newPosition = 'after';

        if (hoveredCategoryId !== id || dropPosition !== newPosition) {
            setHoveredCategoryId(id);
            setDropPosition(newPosition);
        }
    };

    const onDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setHoveredCategoryId(null);
        setDropPosition(null);
    };

    const handleDrop = async (e: React.DragEvent, targetId: string | null) => {
        e.preventDefault();

        const currentDraggedId = draggedCategoryId;
        const currentTargetId = targetId;
        const currentPosition = dropPosition;

        setHoveredCategoryId(null);
        setDropPosition(null);
        setDraggedCategoryId(null);

        if (!currentDraggedId || currentDraggedId === currentTargetId) return;

        try {
            setIsLoading(true);
            const draggedCategory = categories.find(c => c.id === currentDraggedId);
            const targetCategory = currentTargetId ? categories.find(c => c.id === currentTargetId) : null;
            if (!draggedCategory) return;

            let newParentId: string | null = null;
            if (currentTargetId === null) {
                newParentId = null;
            } else if (targetCategory) {
                if (currentPosition === 'inside') newParentId = targetCategory.id;
                else newParentId = targetCategory.parent_id || null;
            }

            if (newParentId !== null) {
                let current = categories.find(c => c.id === newParentId);
                while (current) {
                    if (current.id === currentDraggedId) {
                        toast.error('Impossível: Não pode mover uma categoria para dentro de sua própria filha.', { id: 'move-cat' });
                        setIsLoading(false);
                        return;
                    }
                    current = current.parent_id ? categories.find(c => c.id === current?.parent_id) : undefined;
                }
            }

            toast.loading('Organizando categorias...', { id: 'move-cat' });

            let newCategories = [...categories];

            if (draggedCategory.parent_id !== newParentId) {
                const { id, created_at, updated_at, ...updateData } = draggedCategory as any;
                await categoryService.update(draggedCategory.id!, { ...updateData, parent_id: newParentId });
                const idx = newCategories.findIndex(c => c.id === currentDraggedId);
                if (idx !== -1) newCategories[idx] = { ...newCategories[idx], parent_id: newParentId };
            }

            let siblings = newCategories.filter(c => c.parent_id === newParentId);
            siblings = siblings.filter(c => c.id !== currentDraggedId);

            if (currentTargetId === null || currentPosition === 'inside') {
                siblings.push(newCategories.find(c => c.id === currentDraggedId)!);
            } else {
                const targetSiblingIndex = siblings.findIndex(c => c.id === currentTargetId);
                if (targetSiblingIndex !== -1) {
                    const insertAt = currentPosition === 'before' ? targetSiblingIndex : targetSiblingIndex + 1;
                    siblings.splice(insertAt, 0, newCategories.find(c => c.id === currentDraggedId)!);
                } else {
                    siblings.push(newCategories.find(c => c.id === currentDraggedId)!);
                }
            }

            const updates = siblings.map((cat, index) => ({ id: cat.id!, sort_order: (index + 1) * 10 }));
            if (updates.length > 0) await categoryService.updateSortOrder(updates);

            toast.success('Hierarquia atualizada!', { id: 'move-cat' });
            await loadCategories();
        } catch (error) {
            console.error(error);
            toast.error('Erro ao atualizar hierarquia', { id: 'move-cat' });
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Gerenciamento de Categorias</h1>
                    <p className="text-slate-600 mt-1">
                        Configure quais campos são obrigatórios, opcionais ou ocultos para cada categoria.
                        <b> Arraste as linhas</b> para definir hierarquia.
                        <b> Expanda</b> para ver e reorganizar produtos.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={allExpanded ? collapseAll : expandAll}
                        className="px-3 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm"
                        title={allExpanded ? 'Recolher todos os produtos' : 'Expandir todos os produtos'}
                    >
                        {allExpanded
                            ? <><ChevronsDownUp className="w-4 h-4" /> Recolher Tudo</>
                            : <><ChevronsUpDown className="w-4 h-4" /> Expandir Tudo</>
                        }
                    </button>
                    <button
                        onClick={() => navigate('/admin/settings/categories/presets')}
                        className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm"
                    >
                        <BookMarked className="w-4 h-4 text-blue-500" />
                        Presets
                    </button>
                    <button
                        onClick={handleCreate}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Nova Categoria
                    </button>
                </div>
            </div>

            {/* Drag-and-drop hint for products */}
            {draggedProduct && (
                <div className="mb-4 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-center gap-2">
                    <span className="font-semibold">"{draggedProduct.product.name}"</span>
                    <span>sendo arrastado • Solte em outra categoria para mover</span>
                    <span className="ml-auto text-xs bg-blue-100 px-2 py-0.5 rounded">Aproxime do topo ou rodapé para rolar</span>
                </div>
            )}

            {/* Categories Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700 w-10"></th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Nome</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Slug</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Garantia</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Configuração</th>
                            <th className="px-6 py-3 text-right text-sm font-semibold text-slate-700">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {/* Dropzone para resetar/Root */}
                        {draggedCategoryId && (
                            <tr
                                onDragOver={(e) => onDragOver(e, null)}
                                onDragLeave={onDragLeave}
                                onDrop={(e) => handleDrop(e, null)}
                                className={`transition-colors border-b-2 border-dashed ${
                                    hoveredCategoryId === null ? 'bg-blue-50/80 border-blue-400' : 'bg-slate-50 border-slate-300'
                                }`}
                            >
                                <td colSpan={6} className="px-6 py-4 text-center">
                                    <div className={`text-sm font-semibold flex items-center justify-center gap-2 ${
                                        hoveredCategoryId === null ? 'text-blue-700' : 'text-slate-500'
                                    }`}>
                                        <Plus className={`w-4 h-4 ${hoveredCategoryId === null && 'animate-bounce'}`} />
                                        SOLTE AQUI PARA DESVINCULAR (Tornar Categoria Principal)
                                    </div>
                                </td>
                            </tr>
                        )}

                        {isLoading ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">Carregando categorias...</td>
                            </tr>
                        ) : categories.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">Nenhuma categoria cadastrada</td>
                            </tr>
                        ) : (
                            categories.filter(c => !c.parent_id).map(rootCategory => {
                                const renderCategoryRow = (category: Category, level: number = 0): React.ReactNode => {
                                    const children = categories.filter(c => c.parent_id === category.id);
                                    const isExpanded = expandedCategories.has(category.id!);
                                    const isBeingDragged = draggedCategoryId === category.id;
                                    const isTargetHovered = hoveredCategoryId === category.id;

                                    let dropClass = '';
                                    if (isTargetHovered) {
                                        if (dropPosition === 'inside') dropClass = 'ring-2 ring-inset ring-blue-500 bg-blue-50/50 outline outline-[2px] outline-blue-600 scale-[1.002] z-10 shadow-lg relative';
                                        if (dropPosition === 'before') dropClass = 'border-t-4 border-t-blue-500 drop-shadow-md relative z-10';
                                        if (dropPosition === 'after') dropClass = 'border-b-4 border-b-blue-500 drop-shadow-md relative z-10';
                                    }

                                    // Drop highlight for product drag
                                    const isProductDropTarget = draggedProduct &&
                                        draggedProduct.sourceCategoryId !== category.id &&
                                        isExpanded;

                                    return (
                                        <React.Fragment key={category.id}>
                                            <tr
                                                draggable={!draggedProduct}
                                                onDragStart={(e) => !draggedProduct && onDragStart(e, category.id!)}
                                                onDragOver={(e) => !draggedProduct && onDragOver(e, category.id!)}
                                                onDragLeave={(e) => !draggedProduct && onDragLeave(e)}
                                                onDrop={(e) => !draggedProduct && handleDrop(e, category.id!)}
                                                className={`transition-all ${
                                                    isBeingDragged ? 'opacity-30 bg-slate-100' : 'hover:bg-slate-50'
                                                } ${dropClass}`}
                                            >
                                                <td className="px-4 py-4 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500">
                                                    <GripVertical className="w-5 h-5 mx-auto" />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div
                                                        className={`font-medium text-slate-900 flex items-center gap-2 ${isTargetHovered && 'text-blue-700'}`}
                                                        style={{ paddingLeft: `${level * 24}px` }}
                                                    >
                                                        {level > 0 && <span className="text-slate-400">↳</span>}
                                                        {/* Expand toggle button */}
                                                        <button
                                                            onClick={() => toggleExpand(category.id!)}
                                                            className="flex items-center gap-1.5 hover:text-blue-600 transition-colors"
                                                            title={isExpanded ? 'Recolher produtos' : 'Expandir produtos'}
                                                        >
                                                            {isExpanded
                                                                ? <ChevronDown className="w-4 h-4 text-blue-500" />
                                                                : <ChevronRight className="w-4 h-4 text-slate-400" />
                                                            }
                                                            {category.name}
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <code className="text-sm text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                                        {category.slug}
                                                    </code>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        {category.warranty_days || 90} dias
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-slate-600">{getConfigSummary(category)}</div>
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

                                            {/* Products panel (expanded) */}
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={6} className="px-6 pb-3 pt-0">
                                                        <CategoryProductsPanel
                                                            categoryId={category.id!}
                                                            categoryName={category.name}
                                                            onDragStart={handleProductDragStart}
                                                            draggedProduct={draggedProduct}
                                                            onDragEnd={handleProductDragEnd}
                                                            refreshKey={productsRefreshKey}
                                                            onProductsChanged={handleProductsChanged}
                                                        />
                                                    </td>
                                                </tr>
                                            )}

                                            {children.map(child => renderCategoryRow(child, level + 1))}
                                        </React.Fragment>
                                    );
                                };

                                return renderCategoryRow(rootCategory, 0);
                            })
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
                    <div className="flex items-center gap-2 ml-auto">
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">Categoria Extra</span>
                        <span>Produto aparece em múltiplas categorias</span>
                    </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                    💡 <b>Dica:</b> Arraste um produto para outra categoria para <b>movê-lo</b>.
                    Durante o arrasto, aproxime o cursor do topo ou do rodapé para a tela rolar sozinha.
                </p>
            </div>

            <NextStepBanner
                steps={[
                    { label: 'Categoria', path: '/admin/settings/categories' },
                    { label: 'Marca', path: '/admin/settings/brands' },
                    { label: 'Modelo', path: '/admin/settings/models' },
                    { label: 'Produto', path: '/admin/products/new' },
                ]}
                currentStep={0}
                message="Categorias configuradas?"
            />
        </div>
    );
}
