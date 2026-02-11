import React, { useState, useEffect } from 'react';
import { customFieldsService, CustomField } from '../../services/custom-fields';
import { categoryService } from '../../services/categories';

interface ModelCustomFieldsProps {
    categoryId?: string; // ID da categoria selecionada
    values: Record<string, any>;
    onChange: (key: string, value: any) => void;
}

export const ModelCustomFields: React.FC<ModelCustomFieldsProps> = ({
    categoryId,
    values,
    onChange
}) => {
    const [fields, setFields] = useState<CustomField[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (categoryId) {
            loadFields();
        } else {
            setFields([]);
            setLoading(false);
        }
    }, [categoryId]);

    const loadFields = async () => {
        try {
            setLoading(true);

            // 1. Buscar a categoria para pegar os custom_fields configurados
            const category = await categoryService.getById(categoryId!);

            if (!category || !category.config.custom_fields || category.config.custom_fields.length === 0) {
                setFields([]);
                return;
            }

            // 2. Filtrar apenas campos que NÃO estão ocultos (requirement !== 'off')
            const activeFields = category.config.custom_fields.filter(
                f => f.requirement !== 'off'
            );

            if (activeFields.length === 0) {
                setFields([]);
                return;
            }

            // Lista de campos fixos que já existem no ModelSpecifications
            const FIXED_FIELDS = [
                // Processador
                'processor', 'processador',
                // Chipset
                'chipset',
                // Bateria
                'battery_mah', 'batterymah', 'bateria', 'bateria_mah',
                // Display
                'display', 'tela', 'display_polegadas',
                // Câmera Principal
                'main_camera_mpx', 'maincamerampx', 'camera_principal', 'cam_principal',
                'cam_principal_mpx', 'camera_principal_mpx',
                // Câmera Selfie
                'selfie_camera_mpx', 'selfiecamerampx', 'camera_selfie', 'cam_selfie',
                'cam_selfie_mpx', 'camera_selfie_mpx', 'camera_frontal',
                // NFC
                'nfc',
                // Rede
                'network', 'rede', 'conectividade',
                // Resistência
                'resistencia', 'resistência', 'certificacao', 'certificação',
                // AnTuTu
                'antutu', 'benchmark'
            ];

            // 3. Filtrar campos fixos para evitar duplicação
            const customOnlyFields = activeFields.filter(
                f => !FIXED_FIELDS.includes(f.key.toLowerCase())
            );

            // 4. Usar DIRETAMENTE os campos da categoria
            const categoryFields = customOnlyFields.map(field => ({
                id: field.id || field.field_id || `field-${field.key}`,
                key: field.key,
                label: field.name,
                field_type: field.type || 'text',
                category: 'custom',
                is_required: field.requirement === 'required',
                is_system: false,
                options: field.options,
                placeholder: field.placeholder,
                help_text: field.help_text
            }));

            console.log('✅ [ModelCustomFields] Loaded fields:', categoryFields.length, categoryFields.map(f => f.label));
            setFields(categoryFields as CustomField[]);
        } catch (err) {
            console.error('Erro ao carregar campos customizados:', err);
        } finally {
            setLoading(false);
        }
    };

    const renderField = (field: CustomField) => {
        const value = values[field.key] || '';

        switch (field.field_type) {
            case 'text':
            case 'textarea':
                return (
                    <div key={field.id}>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                            {field.label}
                            {field.is_required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        {field.field_type === 'textarea' ? (
                            <textarea
                                value={value}
                                onChange={(e) => onChange(field.key, e.target.value)}
                                placeholder={field.placeholder || ''}
                                rows={3}
                                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                            />
                        ) : (
                            <input
                                type="text"
                                value={value}
                                onChange={(e) => onChange(field.key, e.target.value)}
                                placeholder={field.placeholder || ''}
                                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        )}
                        {field.help_text && (
                            <p className="text-xs text-slate-500 mt-1">{field.help_text}</p>
                        )}
                    </div>
                );

            case 'number':
                return (
                    <div key={field.id}>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                            {field.label}
                            {field.is_required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <input
                            type="number"
                            value={value}
                            onChange={(e) => onChange(field.key, e.target.value)}
                            placeholder={field.placeholder || ''}
                            min={field.validation?.min}
                            max={field.validation?.max}
                            className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        {field.help_text && (
                            <p className="text-xs text-slate-500 mt-1">{field.help_text}</p>
                        )}
                    </div>
                );

            case 'select':
                return (
                    <div key={field.id}>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                            {field.label}
                            {field.is_required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <select
                            value={value}
                            onChange={(e) => onChange(field.key, e.target.value)}
                            className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Selecione</option>
                            {field.options?.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                        {field.help_text && (
                            <p className="text-xs text-slate-500 mt-1">{field.help_text}</p>
                        )}
                    </div>
                );

            case 'checkbox':
                return (
                    <div key={field.id} className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={value === true || value === 'true'}
                            onChange={(e) => onChange(field.key, e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <label className="text-sm font-medium text-slate-700">
                            {field.label}
                            {field.is_required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        {field.help_text && (
                            <p className="text-xs text-slate-500 ml-6">{field.help_text}</p>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="text-center py-4 text-slate-500 text-sm">
                Carregando campos customizados...
            </div>
        );
    }

    if (fields.length === 0) {
        return null; // Não mostrar seção se não houver campos
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                    ⚙️ Campos Personalizados
                </h3>
                <a
                    href="/admin/settings/fields"
                    target="_blank"
                    className="text-xs text-blue-600 hover:text-blue-700"
                >
                    Gerenciar Campos →
                </a>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {fields.map((field) => renderField(field))}
            </div>
        </div>
    );
};
