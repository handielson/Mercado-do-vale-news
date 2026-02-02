import React, { useState } from 'react';
import { X } from 'lucide-react';
import { FieldFormat, applyFieldFormat } from '../../config/field-dictionary';

interface CustomFieldFormData {
    key: string;
    label: string;
    placeholder: string;
    format: FieldFormat;
    required: boolean;
    description: string;
    minLength?: number;
    maxLength?: number;
}

interface CustomFieldModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (formData: CustomFieldFormData) => void;
    formatOptions: { value: FieldFormat; label: string; color: string }[];
}

/**
 * CustomFieldModal
 * Modal for creating custom fields with full configuration
 */
export function CustomFieldModal({ isOpen, onClose, onCreate, formatOptions }: CustomFieldModalProps) {
    const [formData, setFormData] = useState<CustomFieldFormData>({
        key: '',
        label: '',
        placeholder: '',
        format: 'none',
        required: false,
        description: '',
        minLength: undefined,
        maxLength: undefined
    });

    const handleSubmit = () => {
        onCreate(formData);
        // Reset form
        setFormData({
            key: '',
            label: '',
            placeholder: '',
            format: 'none',
            required: false,
            description: '',
            minLength: undefined,
            maxLength: undefined
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-800">Adicionar Campo Customizado</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Info Alert */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <p className="text-xs text-blue-700">
                            <strong>💡 Dica:</strong> Campos customizados são úteis para adicionar informações específicas do seu negócio
                            que não existem nos campos padrão do sistema. Eles funcionam com o componente SmartInput.
                        </p>
                    </div>

                    {/* Key */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Chave do Campo <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.key}
                            onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/[^a-z_]/g, '') })}
                            placeholder="Ex: numero_serie"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            📌 <strong>Identificador único</strong> do campo no código. Apenas letras minúsculas e underscores (_).
                            Exemplo: <code className="px-1 bg-slate-100 rounded">numero_serie</code>, <code className="px-1 bg-slate-100 rounded">data_garantia</code>
                        </p>
                    </div>

                    {/* Label */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Label <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.label}
                            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                            placeholder="Ex: Número de Série"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            🏷️ <strong>Texto que aparece</strong> acima do campo no formulário. Use um nome claro e descritivo para o usuário.
                        </p>
                    </div>

                    {/* Placeholder */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Placeholder
                        </label>
                        <input
                            type="text"
                            value={formData.placeholder}
                            onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                            placeholder="Ex: Digite o número de série..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            💬 <strong>Texto de ajuda</strong> que aparece dentro do campo quando está vazio. Dê um exemplo ou instrução.
                        </p>
                    </div>

                    {/* Format */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Formatação
                        </label>
                        <select
                            value={formData.format}
                            onChange={(e) => setFormData({ ...formData, format: e.target.value as FieldFormat })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                        >
                            {formatOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-500 mt-1">
                            ✨ <strong>Como o texto será formatado</strong> automaticamente ao digitar:
                        </p>
                        <ul className="text-xs text-slate-600 mt-1 ml-4 space-y-0.5">
                            <li>• <strong>Capitalize:</strong> Primeira letra maiúscula → "Iphone 14"</li>
                            <li>• <strong>UPPERCASE:</strong> Tudo maiúsculo → "ABC-123"</li>
                            <li>• <strong>lowercase:</strong> Tudo minúsculo → "email@exemplo.com"</li>
                            <li>• <strong>None:</strong> Sem formatação (mantém como digitado)</li>
                        </ul>

                        {/* Real-time Preview */}
                        <div className="mt-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                            <p className="text-xs font-semibold text-green-800 mb-2">🔍 Preview em Tempo Real:</p>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-600 w-20">Entrada:</span>
                                    <code className="flex-1 px-2 py-1 bg-white rounded border border-green-200 text-xs font-mono text-slate-700">
                                        {formData.format === 'phone' && '"11987654321"'}
                                        {formData.format === 'cpf' && '"12345678901"'}
                                        {formData.format === 'cnpj' && '"12345678000190"'}
                                        {formData.format === 'cep' && '"12345678"'}
                                        {formData.format === 'brl' && '"123456"'}
                                        {formData.format === 'numeric' && '"ABC-123-XYZ"'}
                                        {formData.format === 'alphanumeric' && '"ABC-123-XYZ!"'}
                                        {formData.format === 'slug' && '"iPhone 14 Pró Max"'}
                                        {formData.format === 'date_br' && '"31012026"'}
                                        {formData.format === 'date_br_short' && '"310126"'}
                                        {formData.format === 'date_iso' && '"20260131"'}
                                        {formData.format === 'ncm' && '"ABC12345678XYZ"'}
                                        {formData.format === 'ean13' && '"ABC7891234567890XYZ"'}
                                        {formData.format === 'cest' && '"ABC1234567XYZ"'}
                                        {!['phone', 'cpf', 'cnpj', 'cep', 'brl', 'numeric', 'alphanumeric', 'slug', 'date_br', 'date_br_short', 'date_iso', 'ncm', 'ean13', 'cest'].includes(formData.format) && '"iPhone 14 PRO max"'}
                                    </code>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-green-700 w-20 font-semibold">Saída:</span>
                                    <code className="flex-1 px-2 py-1 bg-white rounded border border-green-300 text-xs font-mono text-green-800 font-bold">
                                        {formData.format === 'capitalize' && '"Iphone 14 pro max"'}
                                        {formData.format === 'uppercase' && '"IPHONE 14 PRO MAX"'}
                                        {formData.format === 'lowercase' && '"iphone 14 pro max"'}
                                        {formData.format === 'titlecase' && '"Iphone 14 Pro Max"'}
                                        {formData.format === 'sentence' && '"Iphone 14 pro max"'}
                                        {formData.format === 'slug' && '"iphone-14-pro-max"'}
                                        {formData.format === 'phone' && '"(11) 98765-4321"'}
                                        {formData.format === 'cpf' && '"123.456.789-01"'}
                                        {formData.format === 'cnpj' && '"12.345.678/0001-90"'}
                                        {formData.format === 'cep' && '"12345-678"'}
                                        {formData.format === 'brl' && '"R$ 1.234,56"'}
                                        {formData.format === 'numeric' && '"123"'}
                                        {formData.format === 'alphanumeric' && '"ABC123XYZ"'}
                                        {formData.format === 'date_br' && '"31/01/2026"'}
                                        {formData.format === 'date_br_short' && '"31/01/26"'}
                                        {formData.format === 'date_iso' && '"2026-01-31"'}
                                        {formData.format === 'ncm' && '"12345678"'}
                                        {formData.format === 'ean13' && '"7891234567890"'}
                                        {formData.format === 'cest' && '"1234567"'}
                                        {formData.format === 'none' && '"iPhone 14 PRO max"'}
                                    </code>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Descrição
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Ex: Número de série do fabricante para rastreamento de garantia"
                            rows={3}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            📝 <strong>Descrição técnica</strong> do campo (opcional). Aparece como ajuda no formulário.
                        </p>
                    </div>

                    {/* Character Length Validation */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Min Length */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Mínimo de Caracteres
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={formData.minLength ?? ''}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    minLength: e.target.value ? parseInt(e.target.value) : undefined
                                })}
                                placeholder="Ex: 3"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                📏 <strong>Mínimo</strong> de caracteres permitidos (opcional)
                            </p>
                        </div>

                        {/* Max Length */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Máximo de Caracteres
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={formData.maxLength ?? ''}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    maxLength: e.target.value ? parseInt(e.target.value) : undefined
                                })}
                                placeholder="Ex: 50"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                📏 <strong>Máximo</strong> de caracteres permitidos (opcional)
                            </p>
                        </div>
                    </div>

                    {/* Validation Example */}
                    {(formData.minLength || formData.maxLength) && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-xs text-blue-800">
                                <strong>✓ Validação configurada:</strong>
                                {formData.minLength && formData.maxLength && (
                                    <> O campo deve ter entre <strong>{formData.minLength}</strong> e <strong>{formData.maxLength}</strong> caracteres.</>
                                )}
                                {formData.minLength && !formData.maxLength && (
                                    <> O campo deve ter no mínimo <strong>{formData.minLength}</strong> caracteres.</>
                                )}
                                {!formData.minLength && formData.maxLength && (
                                    <> O campo deve ter no máximo <strong>{formData.maxLength}</strong> caracteres.</>
                                )}
                            </p>
                        </div>
                    )}

                    {/* Required Checkbox */}
                    <div className="border-t border-slate-200 pt-4">
                        <div className="flex items-start gap-2">
                            <input
                                type="checkbox"
                                id="required"
                                checked={formData.required}
                                onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                                className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500 mt-0.5"
                            />
                            <div>
                                <label htmlFor="required" className="text-sm font-medium text-slate-700 cursor-pointer">
                                    Campo obrigatório
                                </label>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    ⚠️ Se marcado, o campo será obrigatório no formulário (aparece com asterisco vermelho *)
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                        Criar Campo
                    </button>
                </div>
            </div>
        </div>
    );
}
