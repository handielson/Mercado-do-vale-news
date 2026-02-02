import React, { useState, useEffect } from 'react';
import { FileText, RefreshCw, Plus, Trash2, Pencil } from 'lucide-react';
import { customFieldsService, CustomField } from '../../../services/custom-fields';
import { CustomFieldModal } from '../../../components/settings/CustomFieldModal';

/**
 * Field Configuration Page
 * Manage custom fields from Supabase
 * 
 * ANTIGRAVITY PROTOCOL: Database-First Architecture
 * - Loads fields from Supabase custom_fields table
 * - All changes persist to database
 * - Real-time updates across the application
 */
export function FieldConfigPage() {
    const [fields, setFields] = useState<CustomField[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCustomFieldModal, setShowCustomFieldModal] = useState(false);
    const [editingField, setEditingField] = useState<CustomField | null>(null);

    useEffect(() => {
        loadFields();
    }, []);

    const loadFields = async () => {
        setLoading(true);
        try {
            // Clear cache to force fresh data from database
            customFieldsService.clearCache();

            const data = await customFieldsService.list();
            setFields(data);
            console.log('✅ Campos carregados:', data.length);
        } catch (error) {
            console.error('Error loading fields:', error);
            alert('Erro ao carregar campos. Verifique sua conexão.');
        } finally {
            setLoading(false);
        }
    };

    const formatOptions = [
        // Text formats
        { value: 'capitalize', label: 'Capitalize', color: 'bg-blue-100 text-blue-800' },
        { value: 'uppercase', label: 'UPPERCASE', color: 'bg-purple-100 text-purple-800' },
        { value: 'lowercase', label: 'lowercase', color: 'bg-green-100 text-green-800' },
        { value: 'titlecase', label: 'Title Case', color: 'bg-indigo-100 text-indigo-800' },
        { value: 'sentence', label: 'Sentence case', color: 'bg-cyan-100 text-cyan-800' },
        { value: 'slug', label: 'slug-case', color: 'bg-teal-100 text-teal-800' },
        // Number/Document formats
        { value: 'phone', label: '📱 Telefone', color: 'bg-orange-100 text-orange-800' },
        { value: 'cpf', label: '📋 CPF', color: 'bg-rose-100 text-rose-800' },
        { value: 'cnpj', label: '📋 CNPJ', color: 'bg-pink-100 text-pink-800' },
        { value: 'cep', label: '📮 CEP', color: 'bg-amber-100 text-amber-800' },
        { value: 'brl', label: '💰 R$ (Real)', color: 'bg-emerald-100 text-emerald-800' },
        { value: 'numeric', label: 'Numérico', color: 'bg-lime-100 text-lime-800' },
        { value: 'alphanumeric', label: 'Alfanumérico', color: 'bg-sky-100 text-sky-800' },
        // Date formats
        { value: 'date_br', label: '📅 DD/MM/YYYY', color: 'bg-blue-100 text-blue-800' },
        { value: 'date_br_short', label: '📅 DD/MM/YY', color: 'bg-indigo-100 text-indigo-800' },
        { value: 'date_iso', label: '📅 YYYY-MM-DD', color: 'bg-cyan-100 text-cyan-800' },
        // Fiscal formats
        { value: 'ncm', label: '📋 NCM (8 dígitos)', color: 'bg-slate-100 text-slate-800' },
        { value: 'ean13', label: '📋 EAN-13 (13 dígitos)', color: 'bg-gray-100 text-gray-800' },
        { value: 'cest', label: '📋 CEST (7 dígitos)', color: 'bg-zinc-100 text-zinc-800' },
        // Specialized components
        { value: 'currency', label: '💰 CurrencyInput', color: 'bg-yellow-100 text-yellow-800' },
        { value: 'imei', label: '📱 IMEIInput', color: 'bg-violet-100 text-violet-800' },
        { value: 'selector', label: '🎯 Selector', color: 'bg-fuchsia-100 text-fuchsia-800' },
        { value: 'none', label: 'None', color: 'bg-slate-100 text-slate-600' }
    ];

    const handleCreateCustomField = async (formData: any) => {
        if (!formData.key || !formData.label) {
            alert('❌ Preencha a chave e o label do campo!');
            return;
        }

        try {
            await customFieldsService.create({
                key: formData.key,
                label: formData.label,
                category: formData.category || 'spec',
                field_type: formData.field_type || 'text',
                placeholder: formData.placeholder,
                help_text: formData.help_text
            });

            await loadFields();
            setShowCustomFieldModal(false);
            alert('✅ Campo customizado criado com sucesso!');
        } catch (error: any) {
            console.error('Error creating field:', error);
            alert(`❌ Erro ao criar campo: ${error.message}`);
        }
    };

    const handleDeleteField = async (fieldId: string) => {
        if (!confirm('Tem certeza que deseja deletar este campo customizado?')) {
            return;
        }

        try {
            await customFieldsService.delete(fieldId);
            await loadFields();
            alert('✅ Campo deletado com sucesso!');
        } catch (error: any) {
            console.error('Error deleting field:', error);
            alert(`❌ Erro ao deletar campo: ${error.message}`);
        }
    };

    const handleEditField = (field: CustomField) => {
        setEditingField(field);
        setShowCustomFieldModal(true);
    };

    const handleUpdateField = async (formData: any) => {
        if (!editingField) return;

        try {
            await customFieldsService.update(editingField.id, {
                label: formData.label,
                field_type: formData.field_type || formData.format,
                category: formData.category,
                placeholder: formData.placeholder,
                help_text: formData.description
            });

            await loadFields();
            setShowCustomFieldModal(false);
            setEditingField(null);
            alert('✅ Campo atualizado com sucesso!');
        } catch (error: any) {
            console.error('Error updating field:', error);
            alert(`❌ Erro ao atualizar campo: ${error.message}`);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
                        <FileText size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Dicionário de Campos</h1>
                        <p className="text-sm text-slate-600">
                            Gerencie os campos customizados do sistema
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={loadFields}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        Atualizar
                    </button>
                    <button
                        onClick={() => setShowCustomFieldModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus size={18} />
                        Novo Campo
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="text-sm text-slate-600">Total de Campos</div>
                    <div className="text-2xl font-bold text-slate-800">{fields.length}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="text-sm text-slate-600">Campos do Sistema</div>
                    <div className="text-2xl font-bold text-blue-600">
                        {fields.filter(f => f.is_system).length}
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="text-sm text-slate-600">Campos Customizados</div>
                    <div className="text-2xl font-bold text-green-600">
                        {fields.filter(f => !f.is_system).length}
                    </div>
                </div>
            </div>

            {/* Fields Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                                Chave do Campo
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                                Label
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                                Categoria
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                                Tipo
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                                Placeholder
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                                Sistema
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                                Ações
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                    Carregando campos...
                                </td>
                            </tr>
                        ) : fields.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                    Nenhum campo encontrado
                                </td>
                            </tr>
                        ) : (
                            fields.map((field) => (
                                <tr key={field.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm">
                                        <code className="px-2 py-1 bg-slate-100 rounded text-xs font-mono text-slate-800">
                                            {field.key}
                                        </code>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                                        {field.label}
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${field.category === 'basic' ? 'bg-blue-100 text-blue-800' :
                                            field.category === 'spec' ? 'bg-purple-100 text-purple-800' :
                                                field.category === 'price' ? 'bg-green-100 text-green-800' :
                                                    'bg-slate-100 text-slate-800'
                                            }`}>
                                            {field.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {field.field_type}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 italic">
                                        {field.placeholder || '—'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-center">
                                        {field.is_system ? (
                                            <span className="text-blue-600 font-bold">✓</span>
                                        ) : (
                                            <span className="text-slate-300">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            {!field.is_system && (
                                                <>
                                                    <button
                                                        onClick={() => handleEditField(field)}
                                                        className="text-blue-600 hover:text-blue-800 transition-colors"
                                                        title="Editar campo"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteField(field.id)}
                                                        className="text-red-600 hover:text-red-800 transition-colors"
                                                        title="Deletar campo customizado"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            )}
                                            {field.is_system && (
                                                <span className="text-slate-300">—</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Custom Field Modal */}
            {showCustomFieldModal && (
                <CustomFieldModal
                    isOpen={showCustomFieldModal}
                    onClose={() => {
                        setShowCustomFieldModal(false);
                        setEditingField(null);
                    }}
                    onCreate={editingField ? handleUpdateField : handleCreateCustomField}
                    formatOptions={formatOptions}
                    editingField={editingField}
                />
            )}
        </div>
    );
}
