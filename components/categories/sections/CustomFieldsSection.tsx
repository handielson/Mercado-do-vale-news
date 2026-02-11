import React from 'react';
import { CustomField } from '../../../types/category';
import { CustomFieldsEditor } from '../CustomFieldsEditorNew';

interface CustomFieldsSectionProps {
    fields: CustomField[];
    onChange: (fields: CustomField[]) => void;
}

/**
 * CustomFieldsSection Component
 * Wrapper for CustomFieldsEditor with section styling
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Modular section component
 * - Wraps existing CustomFieldsEditor
 * - Adds consistent section styling
 */
export const CustomFieldsSection: React.FC<CustomFieldsSectionProps> = ({
    fields,
    onChange
}) => {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
                ⚙️ Campos Configuráveis
            </h3>

            <p className="text-sm text-slate-600 mb-4">
                Configure todos os campos da categoria. Você pode adicionar, editar ou remover campos conforme necessário.
            </p>

            <CustomFieldsEditor
                fields={fields}
                onChange={onChange}
            />

            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <p className="text-xs text-blue-800">
                            <strong>💡 Dica:</strong> Campos personalizados são úteis para informações específicas da categoria.
                            Por exemplo: "Garantia Estendida" para eletrônicos, "Tamanho da Tela" para TVs, etc.
                        </p>
                    </div>
                    <div className="ml-4">
                        <code className="text-xs px-2 py-1 bg-slate-200 text-slate-700 rounded border border-slate-300">
                            custom_fields
                        </code>
                    </div>
                </div>
            </div>
        </div>
    );
};
