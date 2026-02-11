import React, { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, Pencil } from 'lucide-react';
import { CustomField, FieldRequirement } from '../../types/category';
import { categoryService } from '../../services/categories';
import { FieldDialog } from './FieldDialog';

interface CustomFieldsEditorProps {
    fields: CustomField[];
    onChange: (fields: CustomField[]) => void;
}

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
    const [editingField, setEditingField] = useState<CustomField | null>(null);
    const [allCustomFields, setAllCustomFields] = useState<CustomField[]>([]);

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
        setShowDialog(true);
        // Reload custom fields to get latest from all categories
        reloadCustomFields();
    };

    const handleOpenEdit = (field: CustomField) => {
        setEditingField(field);
        setShowDialog(true);
    };

    const handleSaveField = (newField: Partial<CustomField>, isEditing: boolean) => {
        if (!newField.name?.trim()) return;

        if (isEditing && editingField) {
            // EDITING: Keep existing structure (don't change to reference)
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
            // ADDING NEW FIELD
            // Check if field comes from library (has Supabase UUID)
            const isLibraryField = newField.id && newField.id.length > 20; // UUID format

            let field: any;

            if (isLibraryField) {
                // NEW FORMAT: Save ONLY reference to library field
                // The actual field data (name, type, table_config, etc.) will be loaded from custom_fields table
                field = {
                    id: `custom-${Date.now()}`,
                    field_id: newField.id, // Reference to library
                    requirement: newField.requirement || 'optional'
                };
                console.log('➕ [CustomFieldsEditor] Adding library field reference:', field);
            } else {
                // OLD FORMAT: Custom field created inline (backward compatibility)
                field = {
                    id: `custom-${Date.now()}`,
                    name: newField.name!.trim(),
                    key: generateKey(newField.name!),
                    type: newField.type || 'text',
                    requirement: newField.requirement || 'optional',
                    options: newField.type === 'dropdown' ? newField.options : undefined,
                    placeholder: newField.placeholder
                };
                console.log('➕ [CustomFieldsEditor] Adding custom inline field:', field);
            }

            console.log('📋 [CustomFieldsEditor] Current fields count:', fields.length);
            console.log('🔄 [CustomFieldsEditor] Calling onChange with new field...');
            onChange([...fields, field]);
            console.log('✅ [CustomFieldsEditor] onChange called successfully');
        }

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
                                                    {field.type === 'table_relation' && `🗄️ Tabela (${field.table_config?.table_name || 'não configurada'})`}
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
            <FieldDialog
                isOpen={showDialog}
                editingField={editingField}
                allCustomFields={allCustomFields}
                onClose={() => setShowDialog(false)}
                onSave={handleSaveField}
            />
        </div>
    );
};
