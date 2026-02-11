import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Database, FileText } from 'lucide-react';
import { customFieldsService, CustomFieldInput } from '../../../services/custom-fields';
import { CustomField } from '../../../services/custom-fields';
import FieldModal from '../../../components/fields/FieldModal';

/**
 * Global Fields Management Page
 * Allows admins to create, edit, and delete global custom fields
 */
export default function FieldsManagementPage() {
    const [fields, setFields] = useState<CustomField[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingField, setEditingField] = useState<CustomField | null>(null);

    useEffect(() => {
        loadFields();
    }, []);

    const loadFields = async () => {
        setLoading(true);
        try {
            const data = await customFieldsService.list();
            setFields(data);
        } catch (error) {
            console.error('Error loading fields:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingField(null);
        setShowModal(true);
    };

    const handleEdit = (field: CustomField) => {
        setEditingField(field);
        setShowModal(true);
    };

    const handleDelete = async (field: CustomField) => {
        if (!confirm(`Tem certeza que deseja deletar o campo "${field.label}"?`)) {
            return;
        }

        try {
            await customFieldsService.delete(field.id);
            await loadFields();
        } catch (error) {
            console.error('Error deleting field:', error);
            alert('Erro ao deletar campo. Verifique se ele não está sendo usado em categorias.');
        }
    };

    const handleSave = async (data: CustomFieldInput) => {
        if (editingField) {
            // Update existing field
            await customFieldsService.update(editingField.id, data);
        } else {
            // Create new field
            await customFieldsService.create(data);
        }

        await loadFields();
        setShowModal(false);
    };

    const getFieldTypeIcon = (field: CustomField) => {
        if (field.field_type === 'table_relation') {
            return <Database className="w-4 h-4 text-blue-600" />;
        }
        return <FileText className="w-4 h-4 text-slate-600" />;
    };

    const getFieldTypeLabel = (field: CustomField) => {
        if (field.field_type === 'table_relation' && field.table_config) {
            return `🗄️ Tabela (${field.table_config.table_name})`;
        }

        const typeLabels: Record<string, string> = {
            text: '📝 Texto',
            number: '🔢 Número',
            select: '📋 Dropdown',
            checkbox: '☑️ Checkbox',
            textarea: '📄 Área de Texto'
        };

        return typeLabels[field.field_type] || field.field_type;
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    // Filter fields based on search and category
    const filteredFields = fields
        .filter(field => {
            const matchesSearch = field.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                field.key.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = categoryFilter === 'all' || field.category === categoryFilter;
            return matchesSearch && matchesCategory;
        })
        .sort((a, b) => {
            const comparison = a.label.localeCompare(b.label, 'pt-BR');
            return sortOrder === 'asc' ? comparison : -comparison;
        });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-slate-600">Carregando campos...</div>
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Page Title */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                        <Database size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">
                            Biblioteca Global de Campos <span className="text-slate-500 font-mono text-2xl">(custom_fields)</span>
                        </h1>
                        <p className="text-sm text-slate-600 mt-1">
                            Crie e gerencie campos globais reutilizáveis em todas as categorias
                        </p>
                    </div>
                </div>
            </div>

            {/* Filters and Actions */}
            <div className="flex items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-3 flex-1">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <input
                            type="text"
                            placeholder="Buscar por nome ou chave..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-2 pl-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <FileText className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                    </div>

                    {/* Category Filter */}
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">Todas Categorias</option>
                        <option value="basic">Básico</option>
                        <option value="spec">Especificações</option>
                        <option value="price">Preços</option>
                        <option value="fiscal">Fiscal</option>
                        <option value="logistics">Logística</option>
                    </select>

                    {/* Sort Order */}
                    <button
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
                        title={sortOrder === 'asc' ? 'Ordenar Z-A' : 'Ordenar A-Z'}
                    >
                        <span className="text-sm font-medium">
                            {sortOrder === 'asc' ? 'A-Z ↓' : 'Z-A ↑'}
                        </span>
                    </button>
                </div>

                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Novo Campo
                </button>
            </div>

            {/* Fields Table */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                                Campo
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                                Tipo
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                                Chave
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                                Categoria
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">
                                Ações
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {filteredFields.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                    {searchTerm || categoryFilter !== 'all' ? (
                                        <>
                                            Nenhum campo encontrado com os filtros aplicados.
                                            <br />
                                            <button
                                                onClick={() => {
                                                    setSearchTerm('');
                                                    setCategoryFilter('all');
                                                }}
                                                className="mt-2 text-blue-600 hover:text-blue-700 font-medium"
                                            >
                                                Limpar filtros
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            Nenhum campo personalizado criado ainda.
                                            <br />
                                            <button
                                                onClick={handleCreate}
                                                className="mt-2 text-blue-600 hover:text-blue-700 font-medium"
                                            >
                                                Criar primeiro campo
                                            </button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ) : (
                            filteredFields.map((field) => (
                                <tr key={field.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {getFieldTypeIcon(field)}
                                            <span className="font-medium text-slate-900">{field.label}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {getFieldTypeLabel(field)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-700">
                                                {field.key}
                                            </code>
                                            {field.field_type === 'table_relation' && field.table_config?.table_name && (
                                                <code className="text-xs text-blue-600 font-mono">
                                                    table: {field.table_config.table_name}
                                                </code>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {field.category}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(field)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(field)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Deletar"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Field Editor Modal */}
            {showModal && (
                <FieldModal
                    field={editingField}
                    onSave={handleSave}
                    onClose={() => setShowModal(false)}
                />
            )}
        </div>
    );
}
