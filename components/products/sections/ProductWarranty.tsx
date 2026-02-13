import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { WarrantyType } from '../../../types/product';
import { WarrantyTemplate } from '../../../types/warranty';
import { warrantyTemplateService } from '../../../services/warrantyTemplates';

interface ProductWarrantyProps {
    warrantyType: WarrantyType;
    warrantyTemplateId: string;
    brandWarrantyDays: number | null;
    categoryWarrantyDays: number | null;
    onWarrantyTypeChange: (type: WarrantyType) => void;
    onTemplateChange: (templateId: string) => void;
}

/**
 * ProductWarranty Component
 * Section for selecting warranty type and template
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Modular section component
 * - Controlled by parent via props
 * - Shows warranty days from brand/category
 * - Uses warranty templates for custom warranties
 */
export const ProductWarranty: React.FC<ProductWarrantyProps> = ({
    warrantyType,
    warrantyTemplateId,
    brandWarrantyDays,
    categoryWarrantyDays,
    onWarrantyTypeChange,
    onTemplateChange
}) => {
    const [templates, setTemplates] = useState<WarrantyTemplate[]>([]);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

    // Load warranty templates
    useEffect(() => {
        const loadTemplates = async () => {
            try {
                setIsLoadingTemplates(true);
                const data = await warrantyTemplateService.list();
                setTemplates(data.filter(t => t.active));
            } catch (error) {
                console.error('Error loading warranty templates:', error);
            } finally {
                setIsLoadingTemplates(false);
            }
        };
        loadTemplates();
    }, []);

    const selectedTemplate = templates.find(t => t.id === warrantyTemplateId);

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Shield size={18} className="text-blue-600" />
                Garantia
                <span className="ml-2 text-xs text-slate-400 font-mono font-normal">warranty_type | warranty_template_id</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Option 1: Brand Warranty */}
                <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-slate-50"
                    style={{
                        borderColor: warrantyType === 'brand' ? '#3b82f6' : '#e2e8f0',
                        backgroundColor: warrantyType === 'brand' ? '#eff6ff' : 'transparent'
                    }}>
                    <input
                        type="radio"
                        name="warranty_type"
                        value="brand"
                        checked={warrantyType === 'brand'}
                        onChange={() => onWarrantyTypeChange('brand')}
                        className="mt-1 w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                        <div className="font-medium text-slate-900">Garantia da Marca</div>
                        <div className="text-sm text-slate-600 mt-1">
                            {brandWarrantyDays !== null ? (
                                <>Período: <span className="font-semibold text-blue-600">{brandWarrantyDays} dias</span></>
                            ) : (
                                <span className="text-amber-600">⚠️ Selecione uma marca primeiro</span>
                            )}
                        </div>
                    </div>
                </label>

                {/* Option 2: Category Warranty */}
                <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-slate-50"
                    style={{
                        borderColor: warrantyType === 'category' ? '#3b82f6' : '#e2e8f0',
                        backgroundColor: warrantyType === 'category' ? '#eff6ff' : 'transparent'
                    }}>
                    <input
                        type="radio"
                        name="warranty_type"
                        value="category"
                        checked={warrantyType === 'category'}
                        onChange={() => onWarrantyTypeChange('category')}
                        className="mt-1 w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                        <div className="font-medium text-slate-900">Garantia da Categoria</div>
                        <div className="text-sm text-slate-600 mt-1">
                            {categoryWarrantyDays !== null ? (
                                <>Período: <span className="font-semibold text-blue-600">{categoryWarrantyDays} dias</span></>
                            ) : (
                                <span className="text-amber-600">⚠️ Selecione uma categoria primeiro</span>
                            )}
                        </div>
                    </div>
                </label>

                {/* Option 3: Custom Warranty (Template-based) */}
                <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-slate-50"
                    style={{
                        borderColor: warrantyType === 'custom' ? '#3b82f6' : '#e2e8f0',
                        backgroundColor: warrantyType === 'custom' ? '#eff6ff' : 'transparent'
                    }}>
                    <input
                        type="radio"
                        name="warranty_type"
                        value="custom"
                        checked={warrantyType === 'custom'}
                        onChange={() => onWarrantyTypeChange('custom')}
                        className="mt-1 w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                        <div className="font-medium text-slate-900">Garantia Diferenciada</div>
                        <div className="text-sm text-slate-600 mt-1">
                            Selecione um template de garantia personalizado
                        </div>
                    </div>
                </label>
            </div>

            {/* Template Selection */}
            {warrantyType === 'custom' && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Template de Garantia *
                            <span className="ml-2 text-xs text-slate-400 font-mono">warranty_template_id</span>
                        </label>
                        {isLoadingTemplates ? (
                            <div className="text-sm text-slate-500">Carregando templates...</div>
                        ) : (
                            <select
                                value={warrantyTemplateId}
                                onChange={(e) => onTemplateChange(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                                <option value="">Selecione um template...</option>
                                {templates.map(template => (
                                    <option key={template.id} value={template.id}>
                                        {template.name} ({template.duration_days} dias)
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Template Preview */}
                    {selectedTemplate && (
                        <div className="bg-white border border-slate-200 rounded-lg p-3">
                            <div className="text-xs font-semibold text-slate-600 mb-2">
                                📄 Preview do Termo:
                            </div>
                            <div className="text-sm text-slate-700 whitespace-pre-wrap">
                                {selectedTemplate.terms}
                            </div>
                            <div className="text-xs text-slate-500 mt-2">
                                💡 As variáveis {'{dias}'}, {'{produto}'}, {'{marca}'} e {'{data_compra}'} serão substituídas automaticamente
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Info Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                <p className="font-medium text-slate-700 mb-1">💡 Informação</p>
                <p className="text-slate-600 text-xs">
                    A garantia selecionada será exibida no recibo de venda. Você pode configurar os períodos padrão de garantia nas páginas de Marcas e Categorias, ou criar templates personalizados em Configurações.
                </p>
            </div>
        </div>
    );
};
