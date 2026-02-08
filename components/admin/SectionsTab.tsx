import React, { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, Edit2, Eye, EyeOff, ArrowUp, ArrowDown } from 'lucide-react';
import { catalogSectionsService } from '@/services/catalogSectionsService';
import type { CatalogSection, SectionType, CreateSectionData } from '@/types/catalogSections';
import { SECTION_PRESETS, SECTION_TYPE_LABELS } from '@/types/catalogSections';

export function SectionsTab() {
    const [sections, setSections] = useState<CatalogSection[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingSection, setEditingSection] = useState<CatalogSection | null>(null);

    useEffect(() => {
        loadSections();
    }, []);

    const loadSections = async () => {
        try {
            setLoading(true);
            const data = await catalogSectionsService.getSections();
            setSections(data);
        } catch (error) {
            console.error('Erro ao carregar seções:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = (type: SectionType) => {
        const preset = SECTION_PRESETS[type];
        const newSection: Partial<CreateSectionData> = {
            section_type: type,
            title: preset.title || '',
            subtitle: preset.subtitle,
            is_enabled: true,
            display_order: sections.length,
            max_products: preset.max_products || 8,
            layout_style: preset.layout_style || 'grid',
            show_view_all: true,
            sort_by: preset.sort_by || 'created_at',
            sort_direction: preset.sort_direction || 'desc',
        };

        setEditingSection(newSection as CatalogSection);
        setShowForm(true);
    };

    const handleSave = async (sectionData: Partial<CreateSectionData>) => {
        try {
            if (editingSection?.id) {
                // Editar existente
                await catalogSectionsService.updateSection(editingSection.id, sectionData);
            } else {
                // Criar novo
                await catalogSectionsService.createSection(sectionData as CreateSectionData);
            }
            await loadSections();
            setShowForm(false);
            setEditingSection(null);
        } catch (error) {
            console.error('Erro ao salvar seção:', error);
            alert('Erro ao salvar seção: ' + (error as Error).message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja deletar esta seção?')) return;

        try {
            await catalogSectionsService.deleteSection(id);
            await loadSections();
        } catch (error) {
            console.error('Erro ao deletar seção:', error);
            alert('Erro ao deletar seção');
        }
    };

    const handleToggleEnabled = async (section: CatalogSection) => {
        try {
            await catalogSectionsService.updateSection(section.id, {
                is_enabled: !section.is_enabled
            });
            await loadSections();
        } catch (error) {
            console.error('Erro ao atualizar seção:', error);
        }
    };

    const handleMoveUp = async (index: number) => {
        if (index === 0) return;

        const newSections = [...sections];
        [newSections[index - 1], newSections[index]] = [newSections[index], newSections[index - 1]];

        // Atualizar display_order
        const updates = newSections.map((section, idx) => ({
            ...section,
            display_order: idx
        }));

        setSections(updates);

        try {
            await catalogSectionsService.reorderSections(updates.map(s => s.id));
        } catch (error) {
            console.error('Erro ao reordenar:', error);
            await loadSections(); // Reverter em caso de erro
        }
    };

    const handleMoveDown = async (index: number) => {
        if (index === sections.length - 1) return;

        const newSections = [...sections];
        [newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]];

        // Atualizar display_order
        const updates = newSections.map((section, idx) => ({
            ...section,
            display_order: idx
        }));

        setSections(updates);

        try {
            await catalogSectionsService.reorderSections(updates.map(s => s.id));
        } catch (error) {
            console.error('Erro ao reordenar:', error);
            await loadSections(); // Reverter em caso de erro
        }
    };

    if (loading) {
        return <div className="text-center py-8">Carregando...</div>;
    }

    if (showForm) {
        return (
            <SectionForm
                section={editingSection}
                onSave={handleSave}
                onCancel={() => {
                    setShowForm(false);
                    setEditingSection(null);
                }}
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Seções do Catálogo</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Controle o que aparece na homepage do catálogo
                    </p>
                </div>
            </div>

            {/* Lista de Seções */}
            {sections.length > 0 ? (
                <div className="space-y-3">
                    {sections.map((section, index) => (
                        <div
                            key={section.id}
                            className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
                        >
                            {/* Botões de Ordenação */}
                            <div className="flex flex-col gap-1">
                                <button
                                    onClick={() => handleMoveUp(index)}
                                    disabled={index === 0}
                                    className={`p-1 rounded transition-colors ${index === 0
                                        ? 'text-gray-300 cursor-not-allowed'
                                        : 'text-gray-600 hover:bg-gray-100'
                                        }`}
                                    title="Mover para cima"
                                >
                                    <ArrowUp className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleMoveDown(index)}
                                    disabled={index === sections.length - 1}
                                    className={`p-1 rounded transition-colors ${index === sections.length - 1
                                        ? 'text-gray-300 cursor-not-allowed'
                                        : 'text-gray-600 hover:bg-gray-100'
                                        }`}
                                    title="Mover para baixo"
                                >
                                    <ArrowDown className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-gray-400 w-6">#{index + 1}</span>
                                    <h4 className="font-medium text-gray-900">{section.title}</h4>
                                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                                        {SECTION_TYPE_LABELS[section.section_type]}
                                    </span>
                                    {!section.is_enabled && (
                                        <span className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded">
                                            Desativada
                                        </span>
                                    )}
                                </div>
                                {section.subtitle && (
                                    <p className="text-sm text-gray-500 mt-1">{section.subtitle}</p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                    Máx: {section.max_products} produtos • {section.layout_style}
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleToggleEnabled(section)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    title={section.is_enabled ? 'Desativar' : 'Ativar'}
                                >
                                    {section.is_enabled ? (
                                        <Eye className="w-5 h-5 text-green-600" />
                                    ) : (
                                        <EyeOff className="w-5 h-5 text-gray-400" />
                                    )}
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingSection(section);
                                        setShowForm(true);
                                    }}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <Edit2 className="w-5 h-5 text-blue-600" />
                                </button>
                                <button
                                    onClick={() => handleDelete(section.id)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-5 h-5 text-red-600" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <p className="text-gray-500">Nenhuma seção criada ainda</p>
                    <p className="text-sm text-gray-400 mt-1">Clique em um dos botões abaixo para começar</p>
                </div>
            )}

            {/* Botões para Criar Seções */}
            <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Adicionar Nova Seção:</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <button
                        onClick={() => handleCreate('recent')}
                        className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="font-medium">Mais Recentes</span>
                    </button>
                    <button
                        onClick={() => handleCreate('featured')}
                        className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="font-medium">Destaques</span>
                    </button>
                    <button
                        onClick={() => handleCreate('bestsellers')}
                        className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="font-medium">Mais Vendidos</span>
                    </button>
                    <button
                        onClick={() => handleCreate('promotions')}
                        className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="font-medium">Promoções</span>
                    </button>
                    <button
                        onClick={() => handleCreate('new')}
                        className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="font-medium">Novidades</span>
                    </button>
                    <button
                        onClick={() => handleCreate('custom')}
                        className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="font-medium">Personalizada</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

// Formulário Simples
interface SectionFormProps {
    section: Partial<CatalogSection> | null;
    onSave: (section: Partial<CreateSectionData>) => void;
    onCancel: () => void;
}

function SectionForm({ section, onSave, onCancel }: SectionFormProps) {
    const [formData, setFormData] = useState<Partial<CatalogSection>>(
        section || {}
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Remover campos que não devem ser enviados
        const { id, user_id, created_at, updated_at, ...dataToSave } = formData as any;

        onSave(dataToSave);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-900">
                    {section?.id ? 'Editar Seção' : 'Nova Seção'}
                </h3>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Título
                    </label>
                    <input
                        type="text"
                        value={formData.title || ''}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Subtítulo (opcional)
                    </label>
                    <input
                        type="text"
                        value={formData.subtitle || ''}
                        onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Máximo de Produtos
                    </label>
                    <input
                        type="number"
                        value={formData.max_products || 8}
                        onChange={(e) => setFormData({ ...formData, max_products: parseInt(e.target.value) })}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                        min={1}
                        max={50}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Estilo de Layout
                    </label>
                    <select
                        value={formData.layout_style || 'grid'}
                        onChange={(e) => setFormData({ ...formData, layout_style: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                    >
                        <option value="grid">Grade</option>
                        <option value="carousel">Carrossel</option>
                        <option value="list">Lista</option>
                    </select>
                </div>
            </div>

            <div className="flex gap-3">
                <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                    Salvar
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                    Cancelar
                </button>
            </div>
        </form>
    );
}
