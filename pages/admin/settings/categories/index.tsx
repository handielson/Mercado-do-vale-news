import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit2, Plus, GripVertical } from 'lucide-react';
import { Category } from '../../../../types/category';
import { categoryService } from '../../../../services/categories';
import { NextStepBanner } from '../../../../components/ui/NextStepBanner';
import { toast } from 'react-hot-toast';

export default function CategorySettingsPage() {
    const navigate = useNavigate();
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // States for Drag & Drop
    const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
    const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(null);

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

    // ------------- DRAG & DROP LOGIC -------------
    const onDragStart = (e: React.DragEvent, id: string) => {
        setDraggedCategoryId(id);
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const onDragOver = (e: React.DragEvent, id: string | null) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';
        if (hoveredCategoryId !== id) {
            setHoveredCategoryId(id);
        }
    };

    const onDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setHoveredCategoryId(null);
    };

    const handleDrop = async (e: React.DragEvent, targetParentId: string | null) => {
        e.preventDefault();
        setHoveredCategoryId(null);

        if (!draggedCategoryId || draggedCategoryId === targetParentId) {
            setDraggedCategoryId(null);
            return;
        }

        try {
            setIsLoading(true);
            const draggedCategory = categories.find(c => c.id === draggedCategoryId);
            if (!draggedCategory) return;

            // Se o parent já for o que estamos enviando, ignora.
            if (draggedCategory.parent_id === targetParentId) {
                return;
            }

            toast.loading('Movendo categoria...', { id: 'move-cat' });

            // Prevention of Loop: Se target é filho de dragged
            if (targetParentId !== null) {
                let current = categories.find(c => c.id === targetParentId);
                while (current && current.parent_id) {
                    if (current.parent_id === draggedCategoryId) {
                        toast.error('Impossível: Não pode mover uma categoria pai para dentro da filha.', { id: 'move-cat' });
                        setDraggedCategoryId(null);
                        return;
                    }
                    current = categories.find(c => c.id === current?.parent_id);
                }
            }

            // Atualiza no banco
            const { id, created_at, updated_at, ...updateData } = draggedCategory as any;
            
            await categoryService.update(draggedCategory.id!, {
                ...updateData,
                parent_id: targetParentId // Alvo atualizado
            });

            toast.success(`Hierarquia atualizada!`, { id: 'move-cat' });
            
            // Reload a lista completa
            await loadCategories();
        } catch (error) {
            console.error(error);
            toast.error('Erro ao atualizar hierarquia', { id: 'move-cat' });
        } finally {
            setDraggedCategoryId(null);
            setIsLoading(false);
        }
    };
    // ---------------------------------------------

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Gerenciamento de Categorias</h1>
                    <p className="text-slate-600 mt-1">
                        Configure quais campos são obrigatórios, opcionais ou ocultos para cada categoria. 
                        <b> Arraste as linhas</b> para definir categorias pai e subcategorias.
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
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700 w-10"></th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Nome</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Slug</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Garantia</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Configuração</th>
                            <th className="px-6 py-3 text-right text-sm font-semibold text-slate-700">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {/* Dropzone para resetar/Root - SÓ MOSTRA SE ESTIVER ARRASTANDO */}
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
                                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                    Carregando categorias...
                                </td>
                            </tr>
                        ) : categories.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                    Nenhuma categoria cadastrada
                                </td>
                            </tr>
                        ) : (
                            categories.filter(c => !c.parent_id).map(rootCategory => {
                                const renderCategoryRow = (category: Category, level: number = 0) => {
                                    const children = categories.filter(c => c.parent_id === category.id);
                                    
                                    const isBeingDragged = draggedCategoryId === category.id;
                                    const isTargetHovered = hoveredCategoryId === category.id;
                                    const isGhost = isBeingDragged;

                                    return (
                                        <React.Fragment key={category.id}>
                                            <tr 
                                                draggable={true}
                                                onDragStart={(e) => onDragStart(e, category.id!)}
                                                onDragOver={(e) => onDragOver(e, category.id!)}
                                                onDragLeave={onDragLeave}
                                                onDrop={(e) => handleDrop(e, category.id!)}
                                                className={`transition-all ${
                                                    isGhost ? 'opacity-30 bg-slate-100' : 'hover:bg-slate-50'
                                                } ${
                                                    isTargetHovered 
                                                        ? 'ring-2 ring-inset ring-blue-500 bg-blue-50/50 outline outline-[2px] outline-blue-600 scale-[1.002] z-10 shadow-lg relative' 
                                                        : ''
                                                }`}
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
                                                        {category.name}
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
                </div>
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
