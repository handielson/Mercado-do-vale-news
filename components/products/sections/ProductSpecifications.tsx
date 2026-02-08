import React from 'react';
import { UseFormWatch, UseFormSetValue, FieldErrors } from 'react-hook-form';
import { ProductInput } from '../../../types/product';
import { CategoryConfig, FieldRequirement } from '../../../types/category';
import { IMEIInput } from '../../ui/IMEIInput';
import { ColorSelect } from '../selectors/ColorSelect';
import { CapacitySelect } from '../selectors/CapacitySelect';
import { VersionSelect } from '../selectors/VersionSelect';
import { Package, RefreshCw } from 'lucide-react';
import { useEnrichedCustomFields } from '../../../hooks/useEnrichedCustomFields';
import { FIELD_METADATA, isSpecialField, shouldRenderField } from './fieldMetadata';

interface ProductSpecificationsProps {
    categoryConfig: CategoryConfig | null;
    watch: UseFormWatch<ProductInput>;
    setValue: UseFormSetValue<ProductInput>;
    errors: FieldErrors<ProductInput>;
    onRefresh?: () => void;
}

export function ProductSpecifications({
    categoryConfig,
    watch,
    setValue,
    errors,
    onRefresh
}: ProductSpecificationsProps) {
    // ANTIGRAVITY PROTOCOL: Custom Fields Synchronization
    // Enrich custom fields with data from library (supports old & new formats)
    const { fields: customFields, loading: fieldsLoading } = useEnrichedCustomFields(
        categoryConfig?.custom_fields
    );
    if (!categoryConfig) return null;

    // Helper para Labels com Asterisco
    const FieldLabel = ({ label, required }: { label: string, required: boolean }) => (
        <label className="block text-sm font-medium text-slate-700 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
    );

    /**
     * Render a generic field based on metadata
     * Used for fields that don't require special components
     */
    const renderGenericField = (key: string, requirement: FieldRequirement) => {
        const metadata = FIELD_METADATA[key];
        if (!metadata) return null;

        const isRequired = requirement === 'required';
        const fieldKey = `specs.${key}` as any;

        // Text input
        if (metadata.type === 'text' || metadata.type === 'number') {
            return (
                <div key={key} className="space-y-1">
                    <FieldLabel label={metadata.label} required={isRequired} />
                    <input
                        id={`field-${key}`}
                        type={metadata.type}
                        value={watch(fieldKey) || ''}
                        onChange={(e) => setValue(fieldKey, e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                const form = e.currentTarget.form;
                                if (form) {
                                    const inputs = Array.from(form.querySelectorAll('input, select, textarea'));
                                    const currentIndex = inputs.indexOf(e.currentTarget);
                                    const nextInput = inputs[currentIndex + 1] as HTMLElement;
                                    if (nextInput) nextInput.focus();
                                }
                            }
                        }}
                        className={`w-full rounded-md border p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none ${errors?.specs?.[key] ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-300'
                            }`}
                        placeholder={metadata.placeholder}
                    />
                    {errors?.specs?.[key] && (
                        <p className="text-xs text-red-600 mt-1">{errors.specs[key].message}</p>
                    )}
                </div>
            );
        }

        // Select input
        if (metadata.type === 'select' && metadata.options) {
            return (
                <div key={key} className="space-y-1">
                    <FieldLabel label={metadata.label} required={isRequired} />
                    <select
                        value={watch(fieldKey) || ''}
                        onChange={(e) => setValue(fieldKey, e.target.value)}
                        className={`w-full rounded-md border p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white ${errors?.specs?.[key] ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-300'
                            }`}
                    >
                        <option value="">Selecione</option>
                        {metadata.options.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                    {errors?.specs?.[key] && (
                        <p className="text-xs text-red-600 mt-1">{errors.specs[key].message}</p>
                    )}
                </div>
            );
        }

        return null;
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Package size={18} className="text-blue-600" />
                    Especificações Técnicas
                </h3>
                {onRefresh && (
                    <button
                        type="button"
                        onClick={onRefresh}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Recarregar campos customizados"
                    >
                        <RefreshCw size={14} />
                        Atualizar Campos
                    </button>
                )}
            </div>

            {/* Grid responsivo com alinhamento consistente - Max 3 colunas para evitar sobreposição */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                {/* IMEI 1 */}
                {categoryConfig.imei1 !== 'off' && (
                    <div className="space-y-1">
                        <IMEIInput
                            label="IMEI 1"
                            value={watch('specs.imei1') || ''}
                            onChange={(val) => setValue('specs.imei1', val)}
                            required={categoryConfig.imei1 === 'required'}
                            placeholder="Digite 15 dígitos"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    // Focus next field (IMEI2 or Serial)
                                    const nextField = document.getElementById('field-imei2') || document.getElementById('field-serial');
                                    if (nextField) {
                                        (nextField as HTMLInputElement).focus();
                                    }
                                }
                            }}
                        />
                        {categoryConfig.imei1 === 'required' && errors?.specs?.imei1?.message && (
                            <p className="text-xs text-red-600 mt-1">{errors.specs.imei1.message}</p>
                        )}
                    </div>
                )}

                {/* IMEI 2 */}
                {categoryConfig.imei2 !== 'off' && (
                    <div className="space-y-1">
                        <IMEIInput
                            id="field-imei2"
                            label="IMEI 2"
                            value={watch('specs.imei2') || ''}
                            onChange={(val) => setValue('specs.imei2', val)}
                            required={categoryConfig.imei2 === 'required'}
                            placeholder="Digite 15 dígitos"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    // Focus Serial field
                                    const serialField = document.getElementById('field-serial');
                                    if (serialField) {
                                        (serialField as HTMLInputElement).focus();
                                    }
                                }
                            }}
                        />
                        {categoryConfig.imei2 === 'required' && errors?.specs?.imei2?.message && (
                            <p className="text-xs text-red-600 mt-1">{errors.specs.imei2.message}</p>
                        )}
                    </div>
                )}

                {/* SERIAL - Rendered here to ensure it's 3rd field */}
                {categoryConfig.serial !== 'off' && renderGenericField('serial', categoryConfig.serial)}

                {/* COR */}
                {categoryConfig.color !== 'off' && (
                    <div className="space-y-1">
                        <FieldLabel label="Cor Predominante" required={categoryConfig.color === 'required'} />
                        <ColorSelect
                            value={watch('specs.color') || ''}
                            onChange={(val) => setValue('specs.color', val)}
                        />
                        {categoryConfig.color === 'required' && errors?.specs?.color && (
                            <p className="text-xs text-red-600 mt-1">{errors.specs.color.message}</p>
                        )}
                    </div>
                )}

                {/* ARMAZENAMENTO */}
                {categoryConfig.storage !== 'off' && (
                    <div className="space-y-1">
                        <FieldLabel label="Armazenamento" required={categoryConfig.storage === 'required'} />
                        <CapacitySelect
                            value={watch('specs.storage') || ''}
                            onChange={(val) => setValue('specs.storage', val)}
                            label="Armazenamento"
                            placeholder="Selecione o armazenamento"
                        />
                        {categoryConfig.storage === 'required' && errors?.specs?.storage && (
                            <p className="text-xs text-red-600 mt-1">{errors.specs.storage.message}</p>
                        )}
                    </div>
                )}

                {/* RAM */}
                {categoryConfig.ram !== 'off' && (
                    <div className="space-y-1">
                        <FieldLabel label="Memória RAM" required={categoryConfig.ram === 'required'} />
                        <CapacitySelect
                            value={watch('specs.ram') || ''}
                            onChange={(val) => setValue('specs.ram', val)}
                            label="RAM"
                            placeholder="Selecione a RAM"
                        />
                        {categoryConfig.ram === 'required' && errors?.specs?.ram && (
                            <p className="text-xs text-red-600 mt-1">{errors.specs.ram.message}</p>
                        )}
                    </div>
                )}

                {/* VERSÃO */}
                {categoryConfig.version !== 'off' && (
                    <div className="space-y-1">
                        <FieldLabel label="Versão" required={categoryConfig.version === 'required'} />
                        <VersionSelect
                            value={watch('specs.version') || ''}
                            onChange={(val) => setValue('specs.version', val)}
                        />
                        {categoryConfig.version === 'required' && errors?.specs?.version && (
                            <p className="text-xs text-red-600 mt-1">{errors.specs.version.message}</p>
                        )}
                    </div>
                )}

                {/* SAÚDE DA BATERIA */}
                {categoryConfig.battery_health !== 'off' && (
                    <div className="space-y-1">
                        <FieldLabel label="Saúde Bateria" required={categoryConfig.battery_health === 'required'} />
                        <select
                            value={watch('specs.battery_health') || ''}
                            onChange={(e) => setValue('specs.battery_health', e.target.value)}
                            className={`w-full rounded-md border p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none ${errors?.specs?.battery_health ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-300'
                                }`}
                        >
                            <option value="">Selecione</option>
                            <option value="100">100% (Nova)</option>
                            <option value="95-99">95-99%</option>
                            <option value="90-94">90-94%</option>
                            <option value="85-89">85-89%</option>
                            <option value="80-84">80-84%</option>
                            <option value="75-79">75-79%</option>
                            <option value="70-74">70-74%</option>
                            <option value="<70">Abaixo de 70%</option>
                        </select>
                        {errors?.specs?.battery_health && (
                            <p className="text-xs text-red-600 mt-1">{errors.specs.battery_health.message}</p>
                        )}
                    </div>
                )}

                {/* DYNAMIC FIELDS - Render all other configured fields */}
                {Object.entries(categoryConfig)
                    .filter(([key, value]) => {
                        if (typeof value !== 'string') return false;

                        // Skip if field is off
                        if (value === 'off') return false;

                        // Skip special fields (already rendered above)
                        if (isSpecialField(key)) return false;

                        // Skip custom_fields array
                        if (key === 'custom_fields') return false;

                        // Skip config fields
                        if (key.includes('ean_autofill') || key.includes('auto_name')) return false;


                        return true;
                    })
                    .sort(([keyA], [keyB]) => {
                        // Serial comes first (after IMEI1/IMEI2)
                        if (keyA === 'serial') return -1;
                        if (keyB === 'serial') return 1;
                        // Rest alphabetically
                        return keyA.localeCompare(keyB);
                    })
                    .map(([key, value]) => renderGenericField(key, value as any))
                }

                {/* CUSTOM FIELDS - Dynamic rendering */}
                {fieldsLoading ? (
                    <div className="text-sm text-slate-500">Carregando campos...</div>
                ) : (
                    customFields?.map((customField) => {
                        if (customField.requirement === 'off') return null;

                        return (
                            <div key={customField.id} className="space-y-1">
                                <FieldLabel
                                    label={customField.name}
                                    required={customField.requirement === 'required'}
                                />

                                {/* Text-based inputs */}
                                {(customField.type === 'text' ||
                                    customField.type === 'capitalize' ||
                                    customField.type === 'uppercase' ||
                                    customField.type === 'lowercase' ||
                                    customField.type === 'titlecase' ||
                                    customField.type === 'sentence' ||
                                    customField.type === 'slug' ||
                                    customField.type === 'alphanumeric' ||
                                    customField.type === 'numeric' ||
                                    customField.type === 'phone' ||
                                    customField.type === 'cpf' ||
                                    customField.type === 'cnpj' ||
                                    customField.type === 'cep' ||
                                    customField.type === 'date_br' ||
                                    customField.type === 'date_br_short' ||
                                    customField.type === 'date_iso' ||
                                    customField.type === 'ncm' ||
                                    customField.type === 'ean13' ||
                                    customField.type === 'cest') && (
                                        <input
                                            type="text"
                                            value={watch(`specs.${customField.key}`) || ''}
                                            onChange={(e) => setValue(`specs.${customField.key}`, e.target.value)}
                                            placeholder={customField.placeholder}
                                            className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    )}

                                {/* Number Input */}
                                {customField.type === 'number' && (
                                    <input
                                        type="number"
                                        value={watch(`specs.${customField.key}`) || ''}
                                        onChange={(e) => setValue(`specs.${customField.key}`, e.target.value)}
                                        placeholder={customField.placeholder}
                                        className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                )}

                                {/* Currency Input (BRL) */}
                                {customField.type === 'brl' && (
                                    <input
                                        type="text"
                                        value={watch(`specs.${customField.key}`) || ''}
                                        onChange={(e) => setValue(`specs.${customField.key}`, e.target.value)}
                                        placeholder={customField.placeholder}
                                        className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                )}

                                {/* Dropdown */}
                                {customField.type === 'dropdown' && (
                                    <select
                                        value={watch(`specs.${customField.key}`) || ''}
                                        onChange={(e) => setValue(`specs.${customField.key}`, e.target.value)}
                                        className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="">Selecione</option>
                                        {customField.options?.map((option) => (
                                            <option key={option} value={option}>
                                                {option}
                                            </option>
                                        ))}
                                    </select>
                                )}

                                {/* Textarea */}
                                {customField.type === 'textarea' && (
                                    <textarea
                                        value={watch(`specs.${customField.key}`) || ''}
                                        onChange={(e) => setValue(`specs.${customField.key}`, e.target.value)}
                                        placeholder={customField.placeholder}
                                        rows={3}
                                        className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                    />
                                )}
                            </div>
                        );
                    }))}
            </div>
        </div>
    );
}
