import React, { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, Pencil } from 'lucide-react';
import { CustomField, CustomFieldType, FieldRequirement } from '../../types/category';
import { FIELD_DICTIONARY } from '../../config/field-dictionary';
import { categoryService } from '../../services/categories';

interface CustomFieldsEditorProps {
    fields: CustomField[];
    onChange: (fields: CustomField[]) => void;
}

type CreationMode = 'dictionary' | 'custom';

/**
 * Custom Fields Editor Component
 * Allows adding, editing, and removing custom fields for categories
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Dynamic field creation
 * - Traffic Light support for custom fields
 * - Field type selection (text, number, dropdown, textarea)
 * - Edit existing fields
 * - NEW: Select from field-dictionary OR create custom
 * - DYNAMIC: Shows all custom fields from all categories
 */
export const CustomFieldsEditor: React.FC<CustomFieldsEditorProps> = ({ fields, onChange }) => {
    const [showDialog, setShowDialog] = useState(false);
    const [creationMode, setCreationMode] = useState<CreationMode>('dictionary');
    const [selectedDictionaryKey, setSelectedDictionaryKey] = useState<string>('');
    const [editingField, setEditingField] = useState<CustomField | null>(null);
    const [allCustomFields, setAllCustomFields] = useState<CustomField[]>([]);
    const [newField, setNewField] = useState<Partial<CustomField>>({
        name: '',
        type: 'text',
        requirement: 'optional',
        options: []
    });

    // Load all custom fields from all categories
    useEffect(() => {
        const loadAllCustomFields = async () => {
            try {
                const categories = await categoryService.list();
                console.log('🔍 [CustomFieldsEditor] Loaded categories:', categories.length);
                const customFieldsMap = new Map<string, CustomField>();

                // Collect unique custom fields from all categories
                categories.forEach(category => {
                    console.log(`📦 [CustomFieldsEditor] Category "${category.name}" has ${category.config.custom_fields?.length || 0} custom fields`);
                    category.config.custom_fields?.forEach(field => {
                        console.log(`  ✅ Found custom field: ${field.name} (${field.key})`);
                        // Use field.key as unique identifier
                        if (!customFieldsMap.has(field.key)) {
                            customFieldsMap.set(field.key, field);
                        }
                    });
                });

                const allFields = Array.from(customFieldsMap.values());
                console.log('📋 [CustomFieldsEditor] Total unique custom fields:', allFields.length, allFields.map(f => f.name));
                setAllCustomFields(allFields);
            } catch (error) {
                console.error('Error loading custom fields:', error);
            }
        };

        loadAllCustomFields();
    }, [fields]); // Reload when fields change

    const generateKey = (name: string): string => {
        return name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    };

    const reloadCustomFields = async () => {
        try {
            console.log('🔄 [CustomFieldsEditor] Reloading custom fields...');
            const categories = await categoryService.list();
            console.log('🔍 [CustomFieldsEditor] Reloaded categories:', categories.length);
            const customFieldsMap = new Map<string, CustomField>();

            categories.forEach(category => {
                console.log(`📦 [CustomFieldsEditor] Category "${category.name}" has ${category.config.custom_fields?.length || 0} custom fields`);
                category.config.custom_fields?.forEach(field => {
                    console.log(`  ✅ Found custom field: ${field.name} (${field.key})`);
                    if (!customFieldsMap.has(field.key)) {
                        customFieldsMap.set(field.key, field);
                    }
                });
            });

            const allFields = Array.from(customFieldsMap.values());
            console.log('📋 [CustomFieldsEditor] Total unique custom fields after reload:', allFields.length, allFields.map(f => f.name));
            setAllCustomFields(allFields);
        } catch (error) {
            console.error('Error loading custom fields:', error);
        }
    };

    const handleOpenAdd = () => {
        setEditingField(null);
        setCreationMode('dictionary');
        setSelectedDictionaryKey('');
        setNewField({ name: '', type: 'text', requirement: 'optional', options: [] });
        setShowDialog(true);
        // Reload custom fields to get latest from all categories
        reloadCustomFields();
    };

    const handleOpenEdit = (field: CustomField) => {
        setEditingField(field);
        setNewField({
            name: field.name,
            type: field.type,
            requirement: field.requirement,
            options: field.options || [],
            placeholder: field.placeholder
        });
        setShowDialog(true);
    };

    const handleSaveField = () => {
        if (!newField.name?.trim()) return;

        if (editingField) {
            // Update existing field
            onChange(fields.map(f =>
                f.id === editingField.id
                    ? {
                        ...f,
                        name: newField.name!.trim(),
                        key: generateKey(newField.name!),
                        type: newField.type || 'text',
                        requirement: newField.requirement || 'optional',
                        options: newField.type === 'dropdown' ? newField.options : undefined,
                        placeholder: newField.placeholder
                    }
                    : f
            ));
        } else {
            // Add new field
            const field: CustomField = {
                id: `custom-${Date.now()}`,
                name: newField.name.trim(),
                key: generateKey(newField.name),
                type: newField.type || 'text',
                requirement: newField.requirement || 'optional',
                options: newField.type === 'dropdown' ? newField.options : undefined,
                placeholder: newField.placeholder
            };
            onChange([...fields, field]);
        }

        setNewField({ name: '', type: 'text', requirement: 'optional', options: [] });
        setEditingField(null);
        setShowDialog(false);
    };

    const handleRemoveField = (id: string) => {
        onChange(fields.filter(f => f.id !== id));
    };

    const handleUpdateRequirement = (id: string, requirement: FieldRequirement) => {
        onChange(fields.map(f => f.id === id ? { ...f, requirement } : f));
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-slate-700">Campos Customizados</h4>
                <button
                    type="button"
                    onClick={handleOpenAdd}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                >
                    <Plus size={16} />
                    Adicionar Campo
                </button>
            </div>

            {/* Custom Fields List */}
            {fields.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-slate-700">Campo</th>
                                <th className="px-4 py-3 text-center font-medium text-slate-700">🔴 Oculto</th>
                                <th className="px-4 py-3 text-center font-medium text-slate-700">🟡 Opcional</th>
                                <th className="px-4 py-3 text-center font-medium text-slate-700">🟢 Obrigatório</th>
                                <th className="px-4 py-3 text-right font-medium text-slate-700">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {fields.map((field) => (
                                <tr key={field.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <GripVertical size={16} className="text-slate-400" />
                                            <div>
                                                <div className="font-medium text-slate-900">{field.name}</div>
                                                <div className="text-xs text-slate-500">
                                                    {/* Text Formats */}
                                                    {field.type === 'text' && '📝 Texto Curto'}
                                                    {field.type === 'textarea' && '📄 Texto Longo'}
                                                    {field.type === 'capitalize' && '📝 Capitalizado'}
                                                    {field.type === 'uppercase' && '📝 MAIÚSCULAS'}
                                                    {field.type === 'lowercase' && '📝 minúsculas'}
                                                    {field.type === 'titlecase' && '📝 Título'}
                                                    {field.type === 'sentence' && '📝 Sentença'}
                                                    {field.type === 'slug' && '📝 Slug'}

                                                    {/* Numbers and Documents */}
                                                    {field.type === 'number' && '🔢 Número'}
                                                    {field.type === 'numeric' && '🔢 Apenas Números'}
                                                    {field.type === 'alphanumeric' && '🔢 Alfanumérico'}
                                                    {field.type === 'phone' && '📞 Telefone'}
                                                    {field.type === 'cpf' && '🆔 CPF'}
                                                    {field.type === 'cnpj' && '🆔 CNPJ'}
                                                    {field.type === 'cep' && '📮 CEP'}

                                                    {/* Dates */}
                                                    {field.type === 'date_br' && '📅 Data BR'}
                                                    {field.type === 'date_br_short' && '📅 Data BR Curta'}
                                                    {field.type === 'date_iso' && '📅 Data ISO'}

                                                    {/* Fiscal */}
                                                    {field.type === 'ncm' && '📋 NCM'}
                                                    {field.type === 'ean13' && '📋 EAN-13'}
                                                    {field.type === 'cest' && '📋 CEST'}

                                                    {/* Specialized */}
                                                    {field.type === 'brl' && '💰 Moeda'}
                                                    {field.type === 'dropdown' && '📋 Dropdown'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <input
                                            type="radio"
                                            name={`custom-${field.id}`}
                                            checked={field.requirement === 'off'}
                                            onChange={() => handleUpdateRequirement(field.id, 'off')}
                                            className="w-4 h-4 text-red-600 focus:ring-red-500"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <input
                                            type="radio"
                                            name={`custom-${field.id}`}
                                            checked={field.requirement === 'optional'}
                                            onChange={() => handleUpdateRequirement(field.id, 'optional')}
                                            className="w-4 h-4 text-yellow-600 focus:ring-yellow-500"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <input
                                            type="radio"
                                            name={`custom-${field.id}`}
                                            checked={field.requirement === 'required'}
                                            onChange={() => handleUpdateRequirement(field.id, 'required')}
                                            className="w-4 h-4 text-green-600 focus:ring-green-500"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenEdit(field)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                title="Editar campo"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveField(field.id)}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                title="Remover campo"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add/Edit Field Dialog */}
            {showDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md">
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
                                                            options: customField.options || []
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
                                onClick={() => setShowDialog(false)}
                                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveField}
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
            )}
        </div>
    );
};
