import React, { useState } from 'react';
import { CustomField, CustomFieldType, FieldRequirement } from '../../types/category';
import { FIELD_DICTIONARY } from '../../config/field-dictionary';

interface FieldDialogProps {
    isOpen: boolean;
    editingField: CustomField | null;
    allCustomFields: CustomField[];
    onClose: () => void;
    onSave: (field: Partial<CustomField>, isEditing: boolean) => void;
}

type CreationMode = 'dictionary' | 'custom';

/**
 * FieldDialog
 * Dialog for adding/editing custom fields with dictionary or custom mode
 */
export function FieldDialog({ isOpen, editingField, allCustomFields, onClose, onSave }: FieldDialogProps) {
    const [creationMode, setCreationMode] = useState<CreationMode>('dictionary');
    const [selectedDictionaryKey, setSelectedDictionaryKey] = useState<string>('');
    const [newField, setNewField] = useState<Partial<CustomField>>({
        name: editingField?.name || '',
        type: editingField?.type || 'text',
        requirement: editingField?.requirement || 'optional',
        options: editingField?.options || [],
        placeholder: editingField?.placeholder || ''
    });

    const handleSave = () => {
        onSave(newField, !!editingField);
        // Reset form
        setNewField({ name: '', type: 'text', requirement: 'optional', options: [] });
        setSelectedDictionaryKey('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">
                    {editingField ? 'Editar Campo Customizado' : 'Novo Campo Customizado'}
                </h3>

                {/* Mode Selector (only for new fields) */}
                {!editingField && (
                    <div className="flex gap-2 mb-4 p-1 bg-slate-100 rounded-lg">
                        <button
                            type="button"
                            onClick={() => {
                                setCreationMode('dictionary');
                                setSelectedDictionaryKey('');
                            }}
                            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${creationMode === 'dictionary'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            📚 Selecionar do Dicionário
                        </button>
                        <button
                            type="button"
                            onClick={() => setCreationMode('custom')}
                            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${creationMode === 'custom'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            ✏️ Criar Campo Personalizado
                        </button>
                    </div>
                )}

                <div className="space-y-4">
                    {/* Dictionary Mode */}
                    {creationMode === 'dictionary' && !editingField && (
                        <>
                            {/* Dictionary Field Selector */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Selecione um Campo *
                                </label>
                                <select
                                    value={selectedDictionaryKey}
                                    onChange={(e) => {
                                        const key = e.target.value;
                                        setSelectedDictionaryKey(key);

                                        // Check if it's a custom field
                                        if (key.startsWith('custom:')) {
                                            const customKey = key.replace('custom:', '');
                                            const customField = allCustomFields.find(f => f.key === customKey);
                                            if (customField) {
                                                setNewField({
                                                    name: customField.name,
                                                    type: customField.type,
                                                    requirement: 'optional',
                                                    placeholder: customField.placeholder,
                                                    options: customField.options || [],
                                                    table_config: customField.table_config,  // ✅ ADICIONADO
                                                    key: customField.key,                     // ✅ ADICIONADO
                                                    id: customField.id                        // ✅ ADICIONADO
                                                });
                                            }
                                        } else if (key && FIELD_DICTIONARY[key]) {
                                            // Field from dictionary
                                            const def = FIELD_DICTIONARY[key];
                                            setNewField({
                                                name: def.label,
                                                type: def.format as CustomFieldType,
                                                requirement: 'optional',
                                                placeholder: def.placeholder,
                                                options: []
                                            });
                                        }
                                    }}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Selecione um campo...</option>

                                    {/* Field Dictionary */}
                                    <optgroup label="📚 Campos do Dicionário">
                                        {Object.entries(FIELD_DICTIONARY)
                                            .sort(([, a], [, b]) => a.label.localeCompare(b.label))
                                            .map(([key, def]) => (
                                                <option key={key} value={key}>
                                                    {def.label} ({key})
                                                </option>
                                            ))}
                                    </optgroup>

                                    {/* Custom Fields from Other Categories */}
                                    {allCustomFields.length > 0 && (
                                        <optgroup label="✨ Campos Personalizados Existentes">
                                            {allCustomFields
                                                .filter(field => field.name) // Filter out fields without names
                                                .sort((a, b) => a.name.localeCompare(b.name))
                                                .map(field => (
                                                    <option key={`custom-${field.key}`} value={`custom:${field.key}`}>
                                                        {field.name} ({field.type})
                                                    </option>
                                                ))}
                                        </optgroup>
                                    )}
                                </select>
                            </div>

                            {/* Field Preview */}
                            {selectedDictionaryKey && FIELD_DICTIONARY[selectedDictionaryKey] && (
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <h4 className="text-sm font-semibold text-blue-900 mb-2">📋 Visualização do Campo</h4>
                                    <div className="space-y-1 text-sm">
                                        <p><strong className="text-blue-800">Tipo:</strong> <span className="text-slate-700">{FIELD_DICTIONARY[selectedDictionaryKey].format}</span></p>
                                        <p><strong className="text-blue-800">Placeholder:</strong> <span className="text-slate-700">{FIELD_DICTIONARY[selectedDictionaryKey].placeholder}</span></p>
                                        {FIELD_DICTIONARY[selectedDictionaryKey].description && (
                                            <p><strong className="text-blue-800">Descrição:</strong> <span className="text-slate-700">{FIELD_DICTIONARY[selectedDictionaryKey].description}</span></p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Requirement Selector */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Status Inicial
                                </label>
                                <select
                                    value={newField.requirement || 'optional'}
                                    onChange={(e) => setNewField({ ...newField, requirement: e.target.value as FieldRequirement })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="off">🔴 Oculto</option>
                                    <option value="optional">🟡 Opcional</option>
                                    <option value="required">🟢 Obrigatório</option>
                                </select>
                            </div>
                        </>
                    )}

                    {/* Custom Mode (existing UI) */}
                    {(creationMode === 'custom' || editingField) && (
                        <>
                            {/* Field Name */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Nome do Campo *
                                </label>
                                <input
                                    type="text"
                                    value={newField.name || ''}
                                    onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                                    placeholder="Ex: Garantia Estendida, Número de Série..."
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                />
                            </div>

                            {/* Field Type */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Tipo de Campo
                                </label>
                                <select
                                    value={newField.type || 'text'}
                                    onChange={(e) => setNewField({ ...newField, type: e.target.value as CustomFieldType })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {/* Text Formats */}
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

                                    {/* Numbers and Documents */}
                                    <optgroup label="🔢 Números e Documentos">
                                        <option value="number">Número</option>
                                        <option value="numeric">Apenas Números</option>
                                        <option value="alphanumeric">Alfanumérico (Letras e Números)</option>
                                        <option value="phone">Telefone (11) 98765-4321</option>
                                        <option value="cpf">CPF (123.456.789-01)</option>
                                        <option value="cnpj">CNPJ (12.345.678/0001-90)</option>
                                        <option value="cep">CEP (12345-678)</option>
                                    </optgroup>

                                    {/* Dates */}
                                    <optgroup label="📅 Datas">
                                        <option value="date_br">Data Brasileira (31/01/2026)</option>
                                        <option value="date_br_short">Data BR Curta (31/01/26)</option>
                                        <option value="date_iso">Data ISO (2026-01-31)</option>
                                    </optgroup>

                                    {/* Fiscal/Tax Codes */}
                                    <optgroup label="📋 Códigos Fiscais">
                                        <option value="ncm">NCM (8 dígitos)</option>
                                        <option value="ean13">EAN-13 Código de Barras (13 dígitos)</option>
                                        <option value="cest">CEST (7 dígitos)</option>
                                    </optgroup>

                                    {/* Specialized */}
                                    <optgroup label="⚙️ Especializados">
                                        <option value="brl">Moeda (R$ 1.234,56)</option>
                                        <option value="dropdown">Lista de Opções</option>
                                    </optgroup>
                                </select>
                            </div>


                            {/* Dropdown Options */}
                            {newField.type === 'dropdown' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Fonte de Dados
                                        </label>
                                        <select
                                            value={newField.table_config ? 'table' : 'manual'}
                                            onChange={(e) => {
                                                if (e.target.value === 'table') {
                                                    // Switch to table mode
                                                    setNewField({
                                                        ...newField,
                                                        type: 'table_relation',
                                                        table_config: {
                                                            table_name: '',
                                                            value_column: 'id',
                                                            label_column: 'name'
                                                        },
                                                        options: undefined
                                                    });
                                                } else {
                                                    // Switch to manual mode
                                                    setNewField({
                                                        ...newField,
                                                        type: 'dropdown',
                                                        table_config: undefined,
                                                        options: []
                                                    });
                                                }
                                            }}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="manual">📝 Lista Manual</option>
                                            <option value="table">🗄️ Tabela do Sistema</option>
                                        </select>
                                    </div>

                                    {!newField.table_config && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                Opções (separadas por vírgula)
                                            </label>
                                            <input
                                                type="text"
                                                value={newField.options?.join(', ') || ''}
                                                onChange={(e) => setNewField({
                                                    ...newField,
                                                    options: e.target.value.split(',').map(o => o.trim()).filter(Boolean)
                                                })}
                                                placeholder="Ex: Sim, Não"
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Table Relation Configuration */}
                            {newField.type === 'table_relation' && newField.table_config && (
                                <div className="space-y-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <h4 className="text-sm font-semibold text-blue-900">🗄️ Configuração de Tabela</h4>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Tabela *
                                        </label>
                                        <select
                                            value={newField.table_config.table_name}
                                            onChange={(e) => setNewField({
                                                ...newField,
                                                table_config: {
                                                    ...newField.table_config!,
                                                    table_name: e.target.value
                                                }
                                            })}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                                Coluna Valor
                                            </label>
                                            <input
                                                type="text"
                                                value={newField.table_config.value_column}
                                                onChange={(e) => setNewField({
                                                    ...newField,
                                                    table_config: {
                                                        ...newField.table_config!,
                                                        value_column: e.target.value
                                                    }
                                                })}
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
                                                value={newField.table_config.label_column}
                                                onChange={(e) => setNewField({
                                                    ...newField,
                                                    table_config: {
                                                        ...newField.table_config!,
                                                        label_column: e.target.value
                                                    }
                                                })}
                                                placeholder="name"
                                                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}


                            {/* Placeholder */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Texto de Ajuda (opcional)
                                </label>
                                <input
                                    type="text"
                                    value={newField.placeholder || ''}
                                    onChange={(e) => setNewField({ ...newField, placeholder: e.target.value })}
                                    placeholder="Ex: Digite o número da garantia..."
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Requirement */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Status Inicial
                                </label>
                                <select
                                    value={newField.requirement || 'optional'}
                                    onChange={(e) => setNewField({ ...newField, requirement: e.target.value as FieldRequirement })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="off">🔴 Oculto</option>
                                    <option value="optional">🟡 Opcional</option>
                                    <option value="required">🟢 Obrigatório</option>
                                </select>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={
                            editingField
                                ? !newField.name?.trim()
                                : creationMode === 'dictionary'
                                    ? !selectedDictionaryKey
                                    : !newField.name?.trim()
                        }
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {editingField ? 'Salvar Alterações' : 'Adicionar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
