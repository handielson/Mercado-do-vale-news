import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ExternalLink, Check } from 'lucide-react';
import { CustomField, FieldRequirement } from '../../types/category';
import { customFieldsService } from '../../services/custom-fields';
import { CustomField as GlobalCustomField } from '../../services/custom-fields';
import { useNavigate } from 'react-router-dom';

interface CustomFieldsEditorProps {
    fields: CustomField[];
    onChange: (fields: CustomField[]) => void;
}

/**
 * Custom Fields Editor Component (Global Fields Version)
 * Allows selecting global fields and setting their requirement status
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Load fields from global custom_fields table
 * - Category only defines: Hidden, Optional, or Required
 * - Fields are managed in /admin/settings/fields
 */
export const CustomFieldsEditor: React.FC<CustomFieldsEditorProps> = ({ fields, onChange }) => {
    const [globalFields, setGlobalFields] = useState<GlobalCustomField[]>([]);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const navigate = useNavigate();

    // Load global custom fields
    useEffect(() => {
        loadGlobalFields();
    }, []);

    const loadGlobalFields = async () => {
        try {
            const loadedFields = await customFieldsService.list();
            console.log('🔍 [CustomFieldsEditor] Loaded global fields:', loadedFields.length);
            setGlobalFields(loadedFields);
        } catch (error) {
            console.error('Error loading global fields:', error);
        }
    };

    const handleAddField = (globalField: GlobalCustomField) => {
        // Check if field is already added
        const exists = fields.some(f => f.field_id === globalField.id);
        if (exists) {
            alert('Este campo já foi adicionado a esta categoria.');
            return;
        }

        // Add field reference with default requirement
        const newField: CustomField = {
            id: `custom-${Date.now()}`,
            field_id: globalField.id,
            requirement: 'optional'
        };

        onChange([...fields, newField]);
        setShowAddDialog(false);
    };

    const handleRemoveField = (fieldId: string) => {
        onChange(fields.filter(f => f.id !== fieldId));
    };

    const handleRequirementChange = (fieldId: string, requirement: FieldRequirement) => {
        onChange(fields.map(f =>
            f.id === fieldId ? { ...f, requirement } : f
        ));
    };

    const handleAddAllFields = () => {
        const existingFieldIds = new Set(fields.map(f => f.field_id).filter(Boolean));
        const newFields = globalFields
            .filter(gf => !existingFieldIds.has(gf.id))
            .map(gf => ({
                id: `custom-${Date.now()}-${gf.id}`,
                field_id: gf.id,
                requirement: 'optional' as FieldRequirement
            }));

        if (newFields.length === 0) {
            alert('Todos os campos globais já foram adicionados a esta categoria.');
            return;
        }

        onChange([...fields, ...newFields]);
    };

    // Get global field data by field_id
    const getGlobalField = (fieldId?: string): GlobalCustomField | null => {
        if (!fieldId) return null;
        return globalFields.find(gf => gf.id === fieldId) || null;
    };

    const getFieldTypeLabel = (field: GlobalCustomField) => {
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

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-slate-900">Campos Personalizados</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Selecione campos globais e defina se são obrigatórios, opcionais ou ocultos
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('/admin/settings/fields')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Gerenciar Campos
                    </button>
                    <button
                        onClick={handleAddAllFields}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        <Check className="w-3.5 h-3.5" />
                        Adicionar Todos
                    </button>
                    <button
                        onClick={() => setShowAddDialog(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar Campo
                    </button>
                </div>
            </div>

            {/* Fields List */}
            {fields.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm border-2 border-dashed border-slate-200 rounded-lg">
                    Nenhum campo adicionado ainda.
                    <br />
                    <button
                        onClick={() => setShowAddDialog(true)}
                        className="mt-2 text-blue-600 hover:text-blue-700 font-medium"
                    >
                        Adicionar primeiro campo
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    {fields.map((field) => {
                        const globalField = getGlobalField(field.field_id);
                        if (!globalField) {
                            return (
                                <div key={field.id} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-sm text-red-700">
                                        ⚠️ Campo não encontrado (ID: {field.field_id})
                                    </p>
                                </div>
                            );
                        }

                        return (
                            <div
                                key={field.id}
                                className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                            >
                                {/* Field Info */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-slate-900">{globalField.label}</span>
                                        <span className="text-xs text-slate-500">{getFieldTypeLabel(globalField)}</span>
                                    </div>
                                    <code className="text-xs text-slate-500">{globalField.key}</code>
                                </div>

                                {/* Requirement Selector */}
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleRequirementChange(field.id, 'hidden')}
                                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${field.requirement === 'hidden'
                                                ? 'bg-slate-200 text-slate-900 font-medium'
                                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                            }`}
                                        title="Campo não aparece no formulário"
                                    >
                                        Oculto
                                    </button>
                                    <button
                                        onClick={() => handleRequirementChange(field.id, 'optional')}
                                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${field.requirement === 'optional'
                                                ? 'bg-yellow-100 text-yellow-900 font-medium'
                                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                            }`}
                                        title="Campo pode ser vazio"
                                    >
                                        Opcional
                                    </button>
                                    <button
                                        onClick={() => handleRequirementChange(field.id, 'required')}
                                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${field.requirement === 'required'
                                                ? 'bg-green-100 text-green-900 font-medium'
                                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                            }`}
                                        title="Campo deve ser preenchido"
                                    >
                                        Obrigatório
                                    </button>
                                </div>

                                {/* Remove Button */}
                                <button
                                    onClick={() => handleRemoveField(field.id)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Remover campo"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add Field Dialog */}
            {showAddDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-200">
                            <h3 className="text-lg font-bold text-slate-900">Adicionar Campo</h3>
                            <p className="text-sm text-slate-600 mt-1">
                                Selecione um campo global para adicionar a esta categoria
                            </p>
                        </div>

                        {/* Fields List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {globalFields.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    Nenhum campo global encontrado.
                                    <br />
                                    <button
                                        onClick={() => navigate('/admin/settings/fields')}
                                        className="mt-2 text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                        Criar primeiro campo global
                                    </button>
                                </div>
                            ) : (
                                globalFields.map((globalField) => {
                                    const isAdded = fields.some(f => f.field_id === globalField.id);

                                    return (
                                        <button
                                            key={globalField.id}
                                            onClick={() => !isAdded && handleAddField(globalField)}
                                            disabled={isAdded}
                                            className={`w-full text-left p-3 border rounded-lg transition-colors ${isAdded
                                                    ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-50'
                                                    : 'bg-white border-slate-200 hover:border-blue-500 hover:bg-blue-50'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-slate-900">{globalField.label}</span>
                                                        <span className="text-xs text-slate-500">{getFieldTypeLabel(globalField)}</span>
                                                    </div>
                                                    <code className="text-xs text-slate-500">{globalField.key}</code>
                                                </div>
                                                {isAdded && (
                                                    <span className="text-xs text-green-600 font-medium">✓ Adicionado</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-200 flex justify-end">
                            <button
                                onClick={() => setShowAddDialog(false)}
                                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
