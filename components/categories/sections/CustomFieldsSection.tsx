import React from 'react';
import { CustomField } from '../../../types/category';
import { CustomFieldsEditor } from '../CustomFieldsEditor';

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
                ⚙️ Campos Personalizados
            </h3>

            <p className="text-sm text-slate-600 mb-4">
                Adicione campos específicos para esta categoria que não existem no formulário padrão
            </p>

            <CustomFieldsEditor
                fields={fields}
                onChange={onChange}
            />

            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-800">
                    <strong>💡 Dica:</strong> Campos personalizados são úteis para informações específicas da categoria.
                    Por exemplo: "Garantia Estendida" para eletrônicos, "Tamanho da Tela" para TVs, etc.
                </p>
            </div>
        </div>
    );
};
