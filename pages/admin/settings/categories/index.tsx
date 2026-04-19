import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit2, Plus, GripVertical, BookMarked, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Check } from 'lucide-react';
import { Category } from '../../../../types/category';
import { categoryService } from '../../../../services/categories';
import { NextStepBanner } from '../../../../components/ui/NextStepBanner';
import { toast } from 'react-hot-toast';
import { CategoryProductsPanel } from '../../../../components/categories/CategoryProductsPanel';
import { vpsApiService } from '../../../../services/vpsApiService';

interface DraggedProduct {
    product: {
        id: string; name: string; sku: string; brand: string;
        category_id: string; status: string; price_retail: number;
        stock_quantity: number; thumbnail: string | null; is_primary_category: boolean;
    };
    sourceCategoryId: string;
}

type DropPosition = 'before' | 'after' | 'inside';

function getDropPositionFromPointer(rect: DOMRect, clientY: number): DropPosition {
    const offsetY = clientY - rect.top;
    const threshold = Math.max(14, Math.min(30, rect.height * 0.22));

    if (offsetY <= threshold) return 'before';
    if (offsetY >= rect.height - threshold) return 'after';
    return 'inside';
}

function getDropPositionLabel(position: DropPosition | null): string {
    if (position === 'before') return 'Soltar antes';
    if (position === 'after') return 'Soltar depois';
    if (position === 'inside') return 'Soltar dentro';
    return '';
}

export default function CategorySettingsPage() {
    const navigate = useNavigate();
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [draggedProduct, setDraggedProduct] = useState<DraggedProduct | null>(null);
    const [productsRefreshKey, setProductsRefreshKey] = useState(0);

    // States for Category Drag & Drop
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
    const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
    const [draggingCategoryIds, setDraggingCategoryIds] = useState<Set<string>>(new Set());
    const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(null);
    const [dropPosition, setDropPosition] = useState<DropPosition | null>(null);
    const [isPointerDraggingCategory, setIsPointerDraggingCategory] = useState(false);
    const [dragMousePos, setDragMousePos] = useState<{ x: number; y: number } | null>(null);
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
            const data = await categoryService.list(true);
            data.sort((a, b) => {
                const orderA = a.sort_order ?? 9999;
                const orderB = b.sort_order ?? 9999;
                if (orderA !== orderB) return orderA - orderB;
                return a.name.localeCompare(b.name);
            });
            setCategories(data);
            setSelectedCategoryIds(prev => new Set([...prev].filter(id => data.some(cat => cat.id === id))));
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

    const handleProductDropOnCategory = useCallback(async (targetCategoryId: string, targetCategoryName: string) => {
        if (!draggedProduct || draggedProduct.sourceCategoryId === targetCategoryId) {
            setDraggedProduct(null);
            return;
        }
        const { product } = draggedProduct;
        setDraggedProduct(null);
        const toastId = toast.loading(`Movendo "${product.name}" para ${targetCategoryName}...`);
        try {
            const ok = await vpsApiService.moveProductCategory(product.id, targetCategoryId);
            if (!ok) throw new Error('Falha ao mover produto na VPS');
            vpsApiService.clearCache();
            setProductsRefreshKey(prev => prev + 1);
            toast.success(`"${product.name}" movido para ${targetCategoryName}!`, { id: toastId });
        } catch (error) {
            console.error('[categories:product-drop-on-row] erro:', error);
            toast.error('Erro ao mover produto', { id: toastId });
        }
    }, [draggedProduct]);

    const toggleCategorySelection = (categoryId: string) => {
        setSelectedCategoryIds(prev => {
            const next = new Set(prev);
            if (next.has(categoryId)) next.delete(categoryId);
            else next.add(categoryId);
            return next;
        });
    };

    const toggleSelectAllCategories = () => {
        if (selectedCategoryIds.size === categories.length) {
            setSelectedCategoryIds(new Set());
            return;
        }
        setSelectedCategoryIds(new Set(categories.map(category => category.id!)));
    };

    const resetCategoryDragState = useCallback(() => {
        setDraggedCategoryId(null);
        setDraggingCategoryIds(new Set());
        setHoveredCategoryId(null);
        setDropPosition(null);
        setIsPointerDraggingCategory(false);
    }, []);

    const getMovingCategoryIds = useCallback((categoryId: string) => {
        return selectedCategoryIds.has(categoryId) && selectedCategoryIds.size > 0
            ? new Set(selectedCategoryIds)
            : new Set([categoryId]);
    }, [selectedCategoryIds]);

    const updateCategoryDropTarget = useCallback((categoryId: string | null, clientY: number, element?: HTMLElement | null) => {
        lastDragClientYRef.current = clientY;

        if (categoryId === null) {
            if (hoveredCategoryId !== null) setHoveredCategoryId(null);
            if (dropPosition !== 'inside') setDropPosition('inside');
            return;
        }

        if (!element) return;

        const rect = element.getBoundingClientRect();
        const newPosition = getDropPositionFromPointer(rect, clientY);

        if (hoveredCategoryId !== categoryId || dropPosition !== newPosition) {
            console.debug('[categories:pointer:target]', {
                targetId: categoryId,
                newPosition,
                draggedCategoryId,
                draggingCategoryIds: [...draggingCategoryIds],
                clientY,
            });
            setHoveredCategoryId(categoryId);
            setDropPosition(newPosition);
        }
    }, [draggedCategoryId, draggingCategoryIds, dropPosition, hoveredCategoryId]);

    const updateCategoryDropTargetFromPoint = useCallback((clientX: number, clientY: number) => {
        const pointedElement = document.elementFromPoint(clientX, clientY) as HTMLElement | null;

        if (!pointedElement) return;

        const rootDropzone = pointedElement.closest('[data-root-dropzone="true"]') as HTMLElement | null;
        if (rootDropzone) {
            updateCategoryDropTarget(null, clientY);
            return;
        }

        const categoryRow = pointedElement.closest('[data-category-row-id]') as HTMLElement | null;
        if (!categoryRow) return;

        const categoryId = categoryRow.getAttribute('data-category-row-id');
        if (!categoryId) return;

        updateCategoryDropTarget(categoryId, clientY, categoryRow);
    }, [updateCategoryDropTarget]);

    const moveCategories = useCallback(async (
        currentDraggedId: string | null,
        movingIds: string[],
        currentTargetId: string | null,
        currentPosition: DropPosition | null,
    ) => {
        resetCategoryDragState();

        if (!currentDraggedId || movingIds.length === 0 || (currentTargetId && movingIds.includes(currentTargetId))) {
            console.warn('[categories:drop:aborted]', {
                currentDraggedId,
                movingIds,
                currentTargetId,
            });
            return;
        }

        try {
            setIsLoading(true);
            const draggedCategory = categories.find(c => c.id === currentDraggedId);
            const targetCategory = currentTargetId ? categories.find(c => c.id === currentTargetId) : null;
            if (!draggedCategory) return;
            const movedCategories = categories.filter(c => movingIds.includes(c.id!));
            const oldParentIds = Array.from(new Set(movedCategories.map(category => category.parent_id || null)));

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
                    if (movingIds.includes(current.id!)) {
                        toast.error('Impossível: Não pode mover uma categoria para dentro de sua própria filha.', { id: 'move-cat' });
                        setIsLoading(false);
                        return;
                    }
                    current = current.parent_id ? categories.find(c => c.id === current?.parent_id) : undefined;
                }
            }

            toast.loading('Organizando categorias...', { id: 'move-cat' });

            const sortForUi = (a: Category, b: Category) => {
                const orderA = a.sort_order ?? 9999;
                const orderB = b.sort_order ?? 9999;
                if (orderA !== orderB) return orderA - orderB;
                return a.name.localeCompare(b.name);
            };

            const normalizedParentId = (value?: string | null) => value || null;
            const movedCategoriesByCurrentOrder = categories
                .filter(category => movingIds.includes(category.id!))
                .map(category => ({ ...category, parent_id: newParentId }));

            const getOrderedGroup = (parentId: string | null) => {
                const group = categories
                    .filter(c => normalizedParentId(c.parent_id) === parentId && !movingIds.includes(c.id!))
                    .sort(sortForUi);

                if (parentId !== normalizedParentId(newParentId)) {
                    return group;
                }

                if (currentTargetId === null || currentPosition === 'inside') {
                    group.push(...movedCategoriesByCurrentOrder);
                    return group;
                }

                const targetSiblingIndex = group.findIndex(c => c.id === currentTargetId);
                if (targetSiblingIndex === -1) {
                    group.push(...movedCategoriesByCurrentOrder);
                    return group;
                }

                const insertAt = currentPosition === 'before' ? targetSiblingIndex : targetSiblingIndex + 1;
                group.splice(insertAt, 0, ...movedCategoriesByCurrentOrder);
                return group;
            };

            const affectedParents = Array.from(new Set([
                ...oldParentIds.map(normalizedParentId),
                normalizedParentId(newParentId),
            ]));

            const updates = affectedParents.flatMap(parentId => {
                const ordered = getOrderedGroup(parentId);
                return ordered.map((cat, index) => ({
                    id: cat.id!,
                    sort_order: (index + 1) * 10,
                    parent_id: normalizedParentId(cat.parent_id),
                }));
            });

            console.debug('[categories:drop:computed]', {
                currentDraggedId,
                movingIds,
                currentTargetId,
                currentPosition,
                newParentId,
                affectedParents,
                updates,
            });

            if (updates.length > 0) await categoryService.updateSortOrder(updates);

            toast.success('Hierarquia atualizada!', { id: 'move-cat' });
            setSelectedCategoryIds(new Set());
            await loadCategories();
        } catch (error) {
            console.error(error);
            toast.error('Erro ao atualizar hierarquia', { id: 'move-cat' });
            setIsLoading(false);
        }
    }, [categories, loadCategories, resetCategoryDragState]);

    const startPointerCategoryDrag = useCallback((categoryId: string, clientX: number, clientY: number) => {
        const movingIds = getMovingCategoryIds(categoryId);

        console.debug('[categories:pointer:start]', {
            id: categoryId,
            movingIds: [...movingIds],
            selectedCategoryIds: [...selectedCategoryIds],
            draggedProduct: !!draggedProduct,
        });

        setDraggedCategoryId(categoryId);
        setDraggingCategoryIds(movingIds);
        setIsPointerDraggingCategory(true);
        setDragMousePos({ x: clientX, y: clientY });
        lastDragClientYRef.current = clientY;
    }, [draggedProduct, getMovingCategoryIds, selectedCategoryIds]);

    const finishPointerCategoryDrag = useCallback(() => {
        if (!isPointerDraggingCategory) return;

        console.debug('[categories:pointer:end]', {
            draggedCategoryId,
            draggingCategoryIds: [...draggingCategoryIds],
            hoveredCategoryId,
            dropPosition,
        });

        void moveCategories(
            draggedCategoryId,
            [...draggingCategoryIds],
            hoveredCategoryId,
            dropPosition,
        );
    }, [draggedCategoryId, draggingCategoryIds, dropPosition, hoveredCategoryId, isPointerDraggingCategory, moveCategories]);

    useEffect(() => {
        if (!isPointerDraggingCategory) {
            setDragMousePos(null);
            return;
        }

        const previousUserSelect = document.body.style.userSelect;
        const previousCursor = document.body.style.cursor;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';

        const handleWindowMouseMove = (event: MouseEvent) => {
            lastDragClientYRef.current = event.clientY;
            setDragMousePos({ x: event.clientX, y: event.clientY });
            updateCategoryDropTargetFromPoint(event.clientX, event.clientY);
        };

        const handleWindowMouseUp = () => {
            finishPointerCategoryDrag();
        };

        const handleWindowKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            console.debug('[categories:pointer:cancel]', {
                draggedCategoryId,
                draggingCategoryIds: [...draggingCategoryIds],
            });
            resetCategoryDragState();
        };

        window.addEventListener('mousemove', handleWindowMouseMove);
        window.addEventListener('mouseup', handleWindowMouseUp);
        window.addEventListener('keydown', handleWindowKeyDown);

        return () => {
            document.body.style.userSelect = previousUserSelect;
            document.body.style.cursor = previousCursor;
            setDragMousePos(null);
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
            window.removeEventListener('keydown', handleWindowKeyDown);
        };
    }, [draggedCategoryId, draggingCategoryIds, finishPointerCategoryDrag, isPointerDraggingCategory, resetCategoryDragState, updateCategoryDropTargetFromPoint]);

    // ------------- CATEGORY DRAG & DROP LOGIC -------------
    const onDragStart = (e: React.DragEvent, id: string) => {
        const movingIds = getMovingCategoryIds(id);

        console.debug('[categories:dragstart]', {
            id,
            movingIds: [...movingIds],
            selectedCategoryIds: [...selectedCategoryIds],
            targetTag: (e.target as HTMLElement | null)?.tagName,
            currentTargetTag: (e.currentTarget as HTMLElement | null)?.tagName,
            draggedProduct: !!draggedProduct,
        });

        setDraggedCategoryId(id);
        setDraggingCategoryIds(movingIds);
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.setData('application/x-category-ids', JSON.stringify([...movingIds]));
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/category-count', String(movingIds.size));

        console.debug('[categories:dragstart:dataTransfer]', {
            textPlain: e.dataTransfer.getData('text/plain'),
            count: e.dataTransfer.getData('text/category-count'),
            categoryIds: e.dataTransfer.getData('application/x-category-ids'),
            effectAllowed: e.dataTransfer.effectAllowed,
        });
    };

    const onCategoryDragEnd = () => {
        console.debug('[categories:dragend]', {
            draggedCategoryId,
            draggingCategoryIds: [...draggingCategoryIds],
        });
        resetCategoryDragState();
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
        const newPosition = getDropPositionFromPointer(rect, e.clientY);

        if (hoveredCategoryId !== id || dropPosition !== newPosition) {
            console.debug('[categories:dragover]', {
                targetId: id,
                newPosition,
                draggedCategoryId,
                draggingCategoryIds: [...draggingCategoryIds],
                clientY: e.clientY,
            });
            setHoveredCategoryId(id);
            setDropPosition(newPosition);
        }
    };

    const onDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const stillInside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
        if (stillInside) return;
        console.debug('[categories:dragleave]', {
            hoveredCategoryId,
            dropPosition,
            clientX: e.clientX,
            clientY: e.clientY,
        });
        setHoveredCategoryId(null);
        setDropPosition(null);
    };

    const handleDrop = async (e: React.DragEvent, targetId: string | null) => {
        e.preventDefault();

        console.debug('[categories:drop:raw]', {
            targetId,
            textPlain: e.dataTransfer.getData('text/plain'),
            count: e.dataTransfer.getData('text/category-count'),
            categoryIds: e.dataTransfer.getData('application/x-category-ids'),
            types: Array.from(e.dataTransfer.types || []),
            draggedCategoryId,
            draggingCategoryIds: [...draggingCategoryIds],
            dropPosition,
        });

        const currentDraggedId = draggedCategoryId;
        const currentTargetId = targetId;
        const currentPosition = dropPosition;
        const movingIds = draggingCategoryIds.size > 0 ? [...draggingCategoryIds] : (currentDraggedId ? [currentDraggedId] : []);

        await moveCategories(currentDraggedId, movingIds, currentTargetId, currentPosition);
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

            {draggingCategoryIds.size > 0 && !draggedProduct && (
                <>
                    <div className="mb-4 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-center gap-2">
                        <span className="font-semibold">Modo reorganizar categorias</span>
                        <span>Use a alca lateral para arrastar.</span>
                        <span>Topo da linha = antes, meio = dentro, base = depois.</span>
                        <span className="ml-auto text-xs bg-amber-100 px-2 py-0.5 rounded font-semibold">{draggingCategoryIds.size} selecionada(s)</span>
                    </div>
                    {isPointerDraggingCategory && dragMousePos && (
                        <>
                            {/* Ghost image - Elemento visual sendo arrastado */}
                            <div
                                className="fixed pointer-events-none px-4 py-3 bg-white text-slate-900 rounded-lg shadow-2xl z-[9999] font-semibold border-2 border-blue-500 flex items-center gap-3"
                                style={{
                                    left: `${dragMousePos.x - 100}px`,
                                    top: `${dragMousePos.y - 30}px`,
                                    width: '200px',
                                    opacity: 0.95,
                                }}
                            >
                                <span className="text-2xl">✋</span>
                                <div className="flex flex-col gap-1">
                                    <div className="font-bold text-blue-600">Arrastando</div>
                                    <div className="text-xs text-slate-600">{draggingCategoryIds.size} categoria{draggingCategoryIds.size > 1 ? 's' : ''}</div>
                                </div>
                            </div>

                            {/* Seta apontando para onde vai cair */}
                            {hoveredCategoryId !== null && (
                                <div
                                    className="fixed pointer-events-none px-3 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white text-sm rounded-lg shadow-xl z-[9999] font-bold"
                                    style={{
                                        left: `${dragMousePos.x + 130}px`,
                                        top: `${dragMousePos.y - 20}px`,
                                    }}
                                >
                                    {dropPosition === 'before' ? '📍 ⬆ ANTES' : dropPosition === 'after' ? '📍 ⬇ DEPOIS' : '📍 → DENTRO'}
                                </div>
                            )}
                            {hoveredCategoryId === null && (
                                <div
                                    className="fixed pointer-events-none px-3 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm rounded-lg shadow-xl z-[9999] font-bold"
                                    style={{
                                        left: `${dragMousePos.x + 130}px`,
                                        top: `${dragMousePos.y - 20}px`,
                                    }}
                                >
                                    📌 RAIZ
                                </div>
                            )}
                        </>
                    )}
                </>
            )}

            {/* Categories Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                    <p className="text-xs text-slate-600">
                        Selecao em lote: marque as categorias e arraste pela alca.
                    </p>
                    <span className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md px-2 py-1">
                        Selecionadas: {selectedCategoryIds.size}
                    </span>
                </div>
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 w-24">
                                <button
                                    type="button"
                                    onClick={toggleSelectAllCategories}
                                    className="inline-flex items-center gap-2 cursor-pointer select-none"
                                    title="Selecionar todas as categorias"
                                >
                                    <span className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${categories.length > 0 && selectedCategoryIds.size === categories.length ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-500 text-transparent'}`}>
                                        <Check className="w-3.5 h-3.5" />
                                    </span>
                                    <span className="text-xs text-slate-600">Sel.</span>
                                </button>
                            </th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Nome</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Slug</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Garantia</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Configuração</th>
                            <th className="px-6 py-3 text-right text-sm font-semibold text-slate-700">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {/* Dropzone para resetar/Root */}
                        {draggingCategoryIds.size > 0 && (
                            <tr
                                data-root-dropzone="true"
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
                                    const isBeingDragged = draggingCategoryIds.has(category.id!);
                                    const isTargetHovered = hoveredCategoryId === category.id;

                                    let dropClass = '';
                                    if (isTargetHovered) {
                                        if (dropPosition === 'inside') dropClass = 'ring-2 ring-inset ring-blue-500 bg-blue-50/60 outline outline-[2px] outline-blue-600 z-10 shadow-lg relative';
                                        if (dropPosition === 'before') dropClass = 'border-t-4 border-t-blue-500 bg-blue-50/30 relative z-10';
                                        if (dropPosition === 'after') dropClass = 'border-b-4 border-b-blue-500 bg-blue-50/30 relative z-10';
                                    }

                                    // Drop highlight for product drag
                                    const isProductDropTarget = draggedProduct &&
                                        draggedProduct.sourceCategoryId !== category.id &&
                                        isExpanded;

                                    const isProductDraggingToThisRow = draggedProduct && draggedProduct.sourceCategoryId !== category.id;

                                    return (
                                        <React.Fragment key={category.id}>
                                            <tr
                                                data-category-row-id={category.id}
                                                onDragEnter={(e) => {
                                                    if (isProductDraggingToThisRow) {
                                                        e.preventDefault();
                                                        e.dataTransfer.dropEffect = 'move';
                                                    }
                                                }}
                                                onDragOver={(e) => {
                                                    if (isProductDraggingToThisRow) {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        e.dataTransfer.dropEffect = 'move';
                                                    } else if (!draggedProduct) {
                                                        onDragOver(e, category.id!);
                                                    }
                                                }}
                                                onDragLeave={(e) => !draggedProduct && onDragLeave(e)}
                                                onDrop={(e) => {
                                                    if (isProductDraggingToThisRow) {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleProductDropOnCategory(category.id!, category.name);
                                                    } else if (!draggedProduct) {
                                                        handleDrop(e, category.id!);
                                                    }
                                                }}
                                                className={`transition-all ${
                                                    isBeingDragged ? 'bg-blue-100 opacity-85 ring-2 ring-blue-500 shadow-[inset_0_0_0_2px_rgba(59,130,246,0.45)]' : 'hover:bg-slate-50'
                                                } ${isProductDraggingToThisRow ? 'bg-blue-50 ring-2 ring-blue-400 ring-inset' : ''} ${dropClass}`}
                                            >
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="hidden"
                                                            value={selectedCategoryIds.has(category.id!) ? '1' : '0'}
                                                            readOnly
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleCategorySelection(category.id!)}
                                                            title="Selecionar categoria"
                                                            data-no-drag="true"
                                                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selectedCategoryIds.has(category.id!) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-500 text-transparent'}`}
                                                        >
                                                            <Check className="w-3.5 h-3.5" />
                                                        </button>
                                                        <div
                                                            data-drag-handle="true"
                                                            draggable={false}
                                                            onDragStart={(e) => e.preventDefault()}
                                                            onMouseDown={(e) => {
                                                                if (draggedProduct) return;
                                                                console.debug('[categories:handle:mousedown]', {
                                                                    id: category.id,
                                                                    name: category.name,
                                                                    selected: selectedCategoryIds.has(category.id!),
                                                                    selectedCategoryIds: [...selectedCategoryIds],
                                                                });
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                startPointerCategoryDrag(category.id!, e.clientX, e.clientY);
                                                            }}
                                                            className="inline-flex items-center justify-center rounded-md p-1 text-slate-300 hover:text-slate-500 bg-slate-50 border border-slate-200 cursor-grab active:cursor-grabbing select-none"
                                                            title="Arrastar categoria(s) selecionada(s)"
                                                            aria-label="Arrastar categoria"
                                                        >
                                                            <GripVertical draggable={false} className="w-5 h-5 mx-auto" />
                                                        </div>
                                                    </div>
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
                                                            data-no-drag="true"
                                                            className="flex items-center gap-1.5 hover:text-blue-600 transition-colors"
                                                            title={isExpanded ? 'Recolher produtos' : 'Expandir produtos'}
                                                        >
                                                            {isExpanded
                                                                ? <ChevronDown className="w-4 h-4 text-blue-500" />
                                                                : <ChevronRight className="w-4 h-4 text-slate-400" />
                                                            }
                                                            {category.name}
                                                        </button>
                                                        {isTargetHovered && dropPosition && draggedCategoryId && draggedCategoryId !== category.id && (
                                                            <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                                                {getDropPositionLabel(dropPosition)}
                                                            </span>
                                                        )}
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
                                                        data-no-drag="true"
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
                                                            allCategories={categories}
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
