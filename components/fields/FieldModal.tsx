import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { CustomField, CustomFieldInput, TableConfig } from '../../services/custom-fields';

interface FieldModalProps {
    field: CustomField | null;
    onSave: (data: CustomFieldInput) => Promise<void>;
    onClose: () => void;
}

/**
 * Modal for creating/editing global custom fields
 */
export default function FieldModal({ field, onSave, onClose }: FieldModalProps) {
    const [formData, setFormData] = useState<CustomFieldInput>({
        key: '',
        label: '',
        category: 'spec',
        field_type: 'text',
        placeholder: '',
        help_text: '',
        display_order: 999
    });

    const [tableConfig, setTableConfig] = useState<TableConfig>({
        table_name: '',
        value_column: 'id',
        label_column: 'name'
    });

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (field) {
            setFormData({
                key: field.key,
                label: field.label,
                category: field.category,
                field_type: field.field_type,
                options: field.options,
                placeholder: field.placeholder || '',
                help_text: field.help_text || '',
                display_order: field.display_order
            });

            if (field.table_config) {
                setTableConfig(field.table_config);
            }
        }
    }, [field]);

    const generateKey = (label: string) => {
        return label
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    };

    const handleLabelChange = (label: string) => {
        setFormData(prev => ({
            ...prev,
            label,
            key: field ? prev.key : generateKey(label) // Only auto-generate for new fields
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            // Validação: se é select, precisa ter pelo menos uma opção
            if (formData.field_type === 'select' && (!formData.options || formData.options.length === 0)) {
                alert('Por favor, adicione pelo menos uma opção para o campo Dropdown.');
                setSaving(false);
                return;
            }

            // Filtrar opções vazias
            const cleanOptions = formData.field_type === 'select'
                ? (formData.options || []).filter(opt => opt.trim() !== '')
                : undefined;

            const data: CustomFieldInput = {
                ...formData,
                options: cleanOptions,
                table_config: formData.field_type === 'table_relation' ? tableConfig : undefined
            };

            console.log('💾 Salvando campo:', data);
            await onSave(data);
            onClose();
        } catch (error) {
            console.error('Error saving field:', error);
            alert(`Erro ao salvar campo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-slate-900">
                            {field ? 'Editar Campo' : 'Novo Campo'}
                        </h2>
                        {field?.is_system && (
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                                🔒 Campo de Sistema
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Label */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Nome do Campo *
                        </label>
                        <input
                            type="text"
                            value={formData.label}
                            onChange={(e) => handleLabelChange(e.target.value)}
                            placeholder="Ex: Versão, Garantia Estendida, Número de Série..."
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                        {field?.is_system && (
                            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                ⚠️ Campos de sistema permitem editar apenas: nome, placeholder, texto de ajuda e opções
                            </p>
                        )}
                    </div>

                    {/* Key */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Chave (Key)
                        </label>
                        <input
                            type="text"
                            value={formData.key}
                            onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value }))}
                            placeholder="versao, garantia_estendida, numero_serie"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            required
                            disabled={!!field} // Can't change key for existing fields
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            {field ? 'A chave não pode ser alterada após criação' : 'Gerada automaticamente a partir do nome'}
                        </p>
                    </div>

                    {/* Field Type */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Tipo de Campo *
                        </label>
                        <select
                            value={formData.field_type}
                            onChange={(e) => setFormData(prev => ({ ...prev, field_type: e.target.value as any }))}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            disabled={field?.is_system}
                            title={field?.is_system ? 'Tipo de campo não pode ser alterado em campos de sistema' : ''}
                        >
                            <optgroup label="📝 Formatos de Texto">
                                <option value="text">Texto Curto</option>
                                <option value="textarea">Texto Longo</option>
                                <option value="capitalize">Capitalizado (Primeira Letra Maiúscula)</option>
                                <option value="uppercase">MAIÚSCULAS</option>
                                <option value="lowercase">minúsculas</option>
                                <option value="titlecase">Título (Cada Palavra Maiúscula)</option>
                                <option value="sentence">Sentença (Primeira letra de frases)</option>
                                <option value="slug">URL Amigável (slug-texto)</option>
                            </optgroup>

                            <optgroup label="🔢 Números e Documentos">
                                <option value="number">Número</option>
                                <option value="numeric">Apenas Números</option>
                                <option value="alphanumeric">Alfanumérico (Letras e Números)</option>
                                <option value="phone">Telefone (11) 98765-4321</option>
                                <option value="cpf">CPF (123.456.789-01)</option>
                                <option value="cnpj">CNPJ (12.345.678/0001-90)</option>
                                <option value="cep">CEP (12345-678)</option>
                            </optgroup>

                            <optgroup label="📅 Datas">
                                <option value="date_br">Data Brasileira (31/01/2026)</option>
                                <option value="date_br_short">Data BR Curta (31/01/26)</option>
                                <option value="date_iso">Data ISO (2026-01-31)</option>
                            </optgroup>

                            <optgroup label="📋 Códigos Fiscais">
                                <option value="ncm">NCM (8 dígitos)</option>
                                <option value="ean13">EAN-13 Código de Barras (13 dígitos)</option>
                                <option value="cest">CEST (7 dígitos)</option>
                            </optgroup>

                            <optgroup label="⚙️ Especializados">
                                <option value="brl">Moeda (R$ 1.234,56)</option>
                                <option value="select">📋 Dropdown (Lista Manual)</option>
                                <option value="checkbox">☑️ Checkbox</option>
                                <option value="table_relation">🗄️ Tabela do Sistema</option>
                            </optgroup>
                        </select>
                    </div>

                    {/* Table Configuration (only for table_relation) */}
                    {formData.field_type === 'table_relation' && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                            <h3 className="text-sm font-semibold text-blue-900">🗄️ Configuração de Tabela</h3>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Tabela *
                                </label>
                                <select
                                    value={tableConfig.table_name}
                                    onChange={(e) => setTableConfig(prev => ({ ...prev, table_name: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                >
                                    <option value="">Selecione uma tabela...</option>
                                    <option value="versions">📱 Versões (versions)</option>
                                    <option value="rams">💾 Memória RAM (rams)</option>
                                    <option value="storages">💿 Armazenamento (storages)</option>
                                    <option value="colors">🎨 Cores (colors)</option>
                                    <option value="battery_healths">🔋 Saúde da Bateria (battery_healths)</option>
                                    <option value="brands">🏢 Marcas (brands)</option>
                                    <option value="models">📦 Modelos (models)</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Coluna Valor
                                    </label>
                                    <input
                                        type="text"
                                        value={tableConfig.value_column}
                                        onChange={(e) => setTableConfig(prev => ({ ...prev, value_column: e.target.value }))}
                                        placeholder="id"
                                        className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Coluna Label
                                    </label>
                                    <input
                                        type="text"
                                        value={tableConfig.label_column}
                                        onChange={(e) => setTableConfig(prev => ({ ...prev, label_column: e.target.value }))}
                                        placeholder="name"
                                        className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                    Ordenação (opcional)
                                </label>
                                <input
                                    type="text"
                                    value={tableConfig.order_by || ''}
                                    onChange={(e) => setTableConfig(prev => ({ ...prev, order_by: e.target.value || undefined }))}
                                    placeholder="name ASC"
                                    className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    )}

                    {/* Options Configuration (only for select/dropdown) */}
                    {formData.field_type === 'select' && (
                        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
                            <h3 className="text-sm font-semibold text-purple-900">📋 Opções do Dropdown</h3>

                            {/* Options List */}
                            <div className="space-y-2">
                                {(formData.options || []).map((option, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={option}
                                            onChange={(e) => {
                                                const newOptions = [...(formData.options || [])];
                                                newOptions[index] = e.target.value;
                                                setFormData(prev => ({ ...prev, options: newOptions }));
                                            }}
                                            placeholder={`Opção ${index + 1}`}
                                            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newOptions = formData.options?.filter((_, i) => i !== index) || [];
                                                setFormData(prev => ({ ...prev, options: newOptions }));
                                            }}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Remover opção"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Add Option Button */}
                            <button
                                type="button"
                                onClick={() => {
                                    const newOptions = [...(formData.options || []), ''];
                                    setFormData(prev => ({ ...prev, options: newOptions }));
                                }}
                                className="w-full px-3 py-2 text-sm bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Adicionar Opção
                            </button>

                            {formData.options && formData.options.length === 0 && (
                                <p className="text-xs text-purple-600 text-center">
                                    Clique em "Adicionar Opção" para criar a lista
                                </p>
                            )}
                        </div>
                    )}

                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Categoria
                        </label>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as any }))}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            disabled={field?.is_system}
                            title={field?.is_system ? 'Categoria não pode ser alterada em campos de sistema' : ''}
                        >
                            <option value="basic">Básico</option>
                            <option value="spec">Especificação</option>
                            <option value="price">Preço</option>
                            <option value="fiscal">Fiscal</option>
                            <option value="logistics">Logística</option>
                        </select>
                    </div>

                    {/* Placeholder */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Placeholder (opcional)
                        </label>
                        <input
                            type="text"
                            value={formData.placeholder}
                            onChange={(e) => setFormData(prev => ({ ...prev, placeholder: e.target.value }))}
                            placeholder="Ex: Digite o número da garantia..."
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Help Text */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Texto de Ajuda (opcional)
                        </label>
                        <textarea
                            value={formData.help_text}
                            onChange={(e) => setFormData(prev => ({ ...prev, help_text: e.target.value }))}
                            placeholder="Informação adicional para ajudar no preenchimento..."
                            rows={2}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? 'Salvando...' : (field ? 'Salvar Alterações' : 'Criar Campo')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
