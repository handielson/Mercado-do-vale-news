import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, Save, X } from 'lucide-react';
import { supabase } from '../../../services/supabase';

interface CustomField {
    id: string;
    company_id: string;
    key: string;
    label: string;
    category: 'basic' | 'spec' | 'price' | 'fiscal' | 'logistics';
    field_type: string;
    options?: string[];
    validation?: { min?: number; max?: number };
    placeholder?: string;
    help_text?: string;
    is_system: boolean;
    display_order: number;
}

export function CustomFieldsLibraryPage() {
    const [fields, setFields] = useState<CustomField[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<CustomField>>({});

    useEffect(() => {
        loadFields();
    }, []);

    const loadFields = async () => {
        try {
            const { data, error } = await supabase
                .from('custom_fields')
                .select('*')
                .order('display_order');

            if (error) throw error;
            setFields(data || []);
        } catch (error) {
            console.error('Error loading fields:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (field: CustomField) => {
        setEditingId(field.id);
        setEditForm(field);
    };

    const handleSave = async () => {
        if (!editingId) return;

        try {
            const { error } = await supabase
                .from('custom_fields')
                .update({
                    label: editForm.label,
                    field_type: editForm.field_type,
                    category: editForm.category,
                    options: editForm.options,
                    validation: editForm.validation,
                    placeholder: editForm.placeholder,
                    help_text: editForm.help_text
                })
                .eq('id', editingId);

            if (error) throw error;

            await loadFields();
            setEditingId(null);
            setEditForm({});
        } catch (error) {
            console.error('Error updating field:', error);
            alert('Erro ao atualizar campo');
        }
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditForm({});
    };

    const handleDelete = async (id: string, isSystem: boolean) => {
        if (isSystem) {
            alert('Campos do sistema não podem ser excluídos');
            return;
        }

        if (!confirm('Tem certeza que deseja excluir este campo?')) return;

        try {
            const { error } = await supabase
                .from('custom_fields')
                .delete()
                .eq('id', id);

            if (error) throw error;
            await loadFields();
        } catch (error) {
            console.error('Error deleting field:', error);
            alert('Erro ao excluir campo');
        }
    };

    if (loading) {
        return <div className="p-8">Carregando...</div>;
    }

    return (
        <div className="p-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Biblioteca de Campos Customizados</h1>
                <p className="text-slate-600 mt-1">Gerencie os campos customizados disponíveis para produtos</p>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Campo</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Tipo</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Categoria</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Opções</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {fields.map((field) => (
                            <tr key={field.id} className="hover:bg-slate-50">
                                {editingId === field.id ? (
                                    <>
                                        {/* Edit Mode */}
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                value={editForm.label || ''}
                                                onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                                                className="w-full px-2 py-1 border border-slate-300 rounded"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={editForm.field_type || 'text'}
                                                onChange={(e) => setEditForm({ ...editForm, field_type: e.target.value })}
                                                className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                                            >
                                                <option value="text">Texto</option>
                                                <option value="number">Número</option>
                                                <option value="select">Select</option>
                                                <option value="checkbox">Checkbox</option>
                                                <option value="textarea">Textarea</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={editForm.category || 'basic'}
                                                onChange={(e) => setEditForm({ ...editForm, category: e.target.value as any })}
                                                className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                                            >
                                                <option value="basic">Básico</option>
                                                <option value="spec">Especificações</option>
                                                <option value="price">Preços</option>
                                                <option value="fiscal">Fiscal</option>
                                                <option value="logistics">Logística</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-3">
                                            {editForm.field_type === 'select' && (
                                                <input
                                                    type="text"
                                                    value={editForm.options?.join(', ') || ''}
                                                    onChange={(e) => setEditForm({
                                                        ...editForm,
                                                        options: e.target.value.split(',').map(s => s.trim())
                                                    })}
                                                    placeholder="Opção 1, Opção 2"
                                                    className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                                                />
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={handleSave}
                                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                                    title="Salvar"
                                                >
                                                    <Save size={16} />
                                                </button>
                                                <button
                                                    onClick={handleCancel}
                                                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded"
                                                    title="Cancelar"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        {/* View Mode */}
                                        <td className="px-4 py-3">
                                            <div>
                                                <div className="font-medium text-slate-900">{field.label}</div>
                                                <div className="text-xs text-slate-500">{field.key}</div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-slate-700">{field.field_type}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                                                {field.category}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {field.options && field.options.length > 0 && (
                                                <span className="text-xs text-slate-600">
                                                    {field.options.join(', ')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(field)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                                    title="Editar"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(field.id, field.is_system)}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                                    title="Excluir"
                                                    disabled={field.is_system}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
