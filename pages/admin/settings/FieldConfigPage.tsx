import React, { useState, useEffect } from 'react';
import { FileText, RefreshCw, Plus, Trash2, Pencil, Tags } from 'lucide-react';
import { customFieldsService, CustomField, FORMAT_OPTIONS } from '../../../services/custom-fields';
import { crossSellTagsService, CrossSellTag } from '../../../services/cross-sell-tags';
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
    const [tags, setTags] = useState<CrossSellTag[]>([]);
    const [loading, setLoading] = useState(true);
    const [tagsLoading, setTagsLoading] = useState(true);
    const [showCustomFieldModal, setShowCustomFieldModal] = useState(false);
    const [editingField, setEditingField] = useState<CustomField | null>(null);

    const [activeTab, setActiveTab] = useState<'fields' | 'tags'>('fields');
    const [newTagName, setNewTagName] = useState('');

    useEffect(() => {
        if (activeTab === 'fields') {
            loadFields();
        } else {
            loadTags();
        }
    }, [activeTab]);

    const loadTags = async () => {
        setTagsLoading(true);
        try {
            const data = await crossSellTagsService.list();
            setTags(data);
        } catch (error) {
            console.error('Error loading tags:', error);
        } finally {
            setTagsLoading(false);
        }
    };

    const handleCreateTag = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTagName.trim()) return;
        try {
            await crossSellTagsService.create({ name: newTagName.trim() });
            setNewTagName('');
            await loadTags();
            alert('Tag criada com sucesso!');
        } catch (error: any) {
            console.error(error);
            alert(`Erro ao criar tag: ${error.message}`);
        }
    };

    const handleDeleteTag = async (id: string) => {
        if (!confirm('Deseja realmente deletar esta tag? Ela poderá deixar de aparecer nas sugestões.')) return;
        try {
            await crossSellTagsService.delete(id);
            await loadTags();
        } catch (error: any) {
            console.error(error);
            alert(`Erro ao deletar tag: ${error.message}`);
        }
    };

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
                field_type: formData.field_type || formData.format || 'text',
                options: formData.options || [],
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
                options: formData.options,
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
                    {activeTab === 'fields' && (
                        <>
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
                        </>
                    )}
                    {activeTab === 'tags' && (
                        <button
                            onClick={loadTags}
                            disabled={tagsLoading}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw size={18} className={tagsLoading ? 'animate-spin' : ''} />
                            Atualizar Tags
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex border-b border-slate-200 mb-6">
                <button
                    onClick={() => setActiveTab('fields')}
                    className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
                        activeTab === 'fields' 
                        ? 'border-blue-600 text-blue-600' 
                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                    }`}
                >
                    <FileText size={18} />
                    Campos Customizados (Ficha Técnica)
                </button>
                <button
                    onClick={() => setActiveTab('tags')}
                    className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
                        activeTab === 'tags' 
                        ? 'border-blue-600 text-blue-600' 
                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                    }`}
                >
                    <Tags size={18} />
                    Tags de Cross-Sell (Aproveite e Leve Junto)
                </button>
            </div>

            {/* Fields Content */}
            {activeTab === 'fields' && (
                <>
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
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
                                                <div className="flex flex-col gap-1">
                                                    <code className="px-2 py-1 bg-slate-100 rounded text-xs font-mono text-slate-800">
                                                        {field.key}
                                                    </code>
                                                    {field.field_type === 'table_relation' && field.table_config?.table_name && (
                                                        <span className="text-xs text-blue-600 font-medium">
                                                            → {field.table_config.table_name}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-900">
                                                {field.label} <span className="text-slate-400 font-mono text-xs">({field.key})</span>
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
                </>
            )}

            {/* Tags Content */}
            {activeTab === 'tags' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 space-y-4">
                        <div className="bg-white p-6 rounded-xl border border-slate-200">
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Nova Tag Oficial</h3>
                            <p className="text-sm text-slate-600 mb-4">
                                Cadastre tags oficiais de Cross-Sell. Elas aparecerão como sugestões obrigatórias no momento de cadastrar um Novo Modelo.
                            </p>
                            <form onSubmit={handleCreateTag} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Nome da Tag
                                    </label>
                                    <input
                                        type="text"
                                        value={newTagName}
                                        onChange={e => setNewTagName(e.target.value)}
                                        placeholder="Ex: Gamer, Ultra Rápido..."
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                                >
                                    <Plus size={18} />
                                    Cadastrar Tag Oficial
                                </button>
                            </form>
                        </div>
                        <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl">
                            <h4 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
                                <Tags size={16}/> O Que São Tags?
                            </h4>
                            <p className="text-sm text-indigo-800 mb-2">
                                Ao invés do lojista digitar qualquer coisa na hora de criar um Modelo (o que gera itens duplicados como "Gamer" e "gamer"), ele deverá escolher as tags cadastradas nesta central.
                            </p>
                            <p className="text-sm text-indigo-800">
                                Produtos de categorias diferentes mas com a mesma Tag, serão recomendados juntos na vitrine!
                            </p>
                        </div>
                    </div>
                    
                    <div className="md:col-span-2">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                                            Nome da Tag Oficial
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                                            Identificador (Slug)
                                        </th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                                            Ações
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {tagsLoading ? (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                                                Carregando tags de cross-sell oficiais...
                                            </td>
                                        </tr>
                                    ) : tags.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                                                Nenhuma tag oficial registrada. Puxaremos apenas sugestões da Ficha Técnica.
                                            </td>
                                        </tr>
                                    ) : (
                                        tags.map((tag) => (
                                            <tr key={tag.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex py-1 px-3 bg-indigo-100 text-indigo-800 text-sm font-semibold rounded-full border border-indigo-200">
                                                        {tag.name}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    <code className="text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                                        {tag.slug}
                                                    </code>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-center">
                                                    <button
                                                        onClick={() => handleDeleteTag(tag.id)}
                                                        className="text-red-500 hover:text-red-700 transition-colors p-2 rounded hover:bg-red-50"
                                                        title="Excluir tag"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Field Modal */}
            {showCustomFieldModal && (
                <CustomFieldModal
                    isOpen={showCustomFieldModal}
                    onClose={() => {
                        setShowCustomFieldModal(false);
                        setEditingField(null);
                    }}
                    onCreate={editingField ? handleUpdateField : handleCreateCustomField}
                    formatOptions={FORMAT_OPTIONS as any}
                    editingField={editingField}
                />
            )}
        </div>
    );
}
