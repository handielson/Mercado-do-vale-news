import React, { useState, useCallback } from 'react';
import { UseFormWatch, UseFormSetValue, FieldErrors } from 'react-hook-form';
import { ProductInput } from '../../../types/product';
import { CategoryConfig, FieldRequirement } from '../../../types/category';
import { IMEIInput } from '../../ui/IMEIInput';
import { ColorSelect } from '../selectors/ColorSelect';
import { CapacitySelect } from '../selectors/CapacitySelect';
import { VersionSelect } from '../selectors/VersionSelect';
import { CheckCircle2, Package, RefreshCw, Loader2 } from 'lucide-react';
import { useEnrichedCustomFields } from '../../../hooks/useEnrichedCustomFields';
import { FIELD_METADATA, isSpecialField, shouldRenderField } from './fieldMetadata';
import { TableRelationField } from '../../fields/TableRelationField';
import { vpsApiService } from '../../../services/vpsApiService';
import { shouldAddSerializedFieldToBatchOnEnter } from '../serializedBatch.js';

interface ProductSpecificationsProps {
    categoryConfig: CategoryConfig | null;
    watch: UseFormWatch<ProductInput>;
    setValue: UseFormSetValue<ProductInput>;
    errors: FieldErrors<ProductInput>;
    onRefresh?: () => void;
    onAddToBatchList?: (overrides?: Record<string, string>) => void;
    templateValues?: Record<string, any>;
    currentProductId?: string; // ID do produto atual (modo edição)
}

// Fields that must be unique per product
const DB_UNIQUE_FIELDS = ['serial', 'imei1', 'imei2'];

export function ProductSpecifications({
    categoryConfig,
    watch,
    setValue,
    errors,
    onRefresh,
    onAddToBatchList,
    templateValues,
    currentProductId
}: ProductSpecificationsProps) {
    // ANTIGRAVITY PROTOCOL: Custom Fields Synchronization
    const { fields: customFields, loading: fieldsLoading } = useEnrichedCustomFields(
        categoryConfig?.custom_fields
    );

    // Unique field validation state
    const [uniqueErrors, setUniqueErrors] = useState<Record<string, string>>({});
    const [checkingField, setCheckingField] = useState<string | null>(null);

    const checkUniqueInDb = useCallback(async (field: string, value: string) => {
        if (!value || !DB_UNIQUE_FIELDS.includes(field)) return;
        setCheckingField(field);
        try {
            const products = await vpsApiService.getProducts({ status: 'active', limit: 5000, noCache: true });
            const alreadyExists = (products || []).some((product: any) =>
                product.id !== currentProductId && String(product.specs?.[field] || '') === value
            );

            setUniqueErrors(prev => ({
                ...prev,
                [field]: alreadyExists ? 'Já cadastrado no sistema' : ''
            }));
        } catch {
            // silently ignore
        } finally {
            setCheckingField(null);
        }
    }, [currentProductId]);

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
            const isUnique = DB_UNIQUE_FIELDS.includes(key);
            const uniqueError = uniqueErrors[key];
            const isChecking = checkingField === key;
            return (
                <div key={key} className="space-y-1 min-w-0">
                    <FieldLabel label={metadata.label} required={isRequired} />
                    <div className="relative">
                        <input
                            id={`field-${key}`}
                            type={metadata.type}
                            value={watch(fieldKey) || ''}
                            onChange={(e) => {
                                setValue(fieldKey, e.target.value);
                                // Clear unique error when user starts typing again
                                if (isUnique && uniqueErrors[key]) {
                                    setUniqueErrors(prev => ({ ...prev, [key]: '' }));
                                }
                            }}
                            onBlur={(e) => {
                                if (isUnique && e.target.value) {
                                    checkUniqueInDb(key, e.target.value);
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const val = (e.currentTarget as HTMLInputElement).value;
                                    if (shouldAddSerializedFieldToBatchOnEnter({
                                        key,
                                        value: val,
                                        hasBatchHandler: Boolean(onAddToBatchList),
                                    })) {
                                        setValue(fieldKey, val, { shouldValidate: true });
                                        onAddToBatchList?.({ [key]: val });
                                        setUniqueErrors(prev => ({ ...prev, [key]: '' }));
                                        return;
                                    }
                                    const form = e.currentTarget.form;
                                    if (form) {
                                        const inputs = Array.from(form.querySelectorAll('input, select, textarea'));
                                        const currentIndex = inputs.indexOf(e.currentTarget);
                                        const nextInput = inputs[currentIndex + 1] as HTMLElement;
                                        if (nextInput) nextInput.focus();
                                    }
                                }
                            }}
                            className={`w-full rounded-md border p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none ${(errors?.specs?.[key] || uniqueError) ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-300'
                                } ${isChecking ? 'pr-8' : ''}`}
                            placeholder={metadata.placeholder}
                        />
                        {isChecking && (
                            <Loader2 size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                        )}
                    </div>
                    {errors?.specs?.[key] && (
                        <p className="text-xs text-red-600 mt-1">{(errors.specs[key] as any)?.message}</p>
                    )}
                    {uniqueError && !errors?.specs?.[key] && (
                        <p className="text-xs text-red-600 mt-1">⚠️ {uniqueError}</p>
                    )}
                </div>
            );
        }

        // Select input
        if (metadata.type === 'select' && metadata.options) {
            return (
                <div key={key} className="space-y-1 min-w-0">
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
                        <p className="text-xs text-red-600 mt-1">{(errors.specs[key] as any)?.message}</p>
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
                <div className="flex items-center gap-2">
                    {onAddToBatchList && (
                        <button
                            type="button"
                            onClick={() => onAddToBatchList()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                            <CheckCircle2 size={14} />
                            Adicionar a Lista
                        </button>
                    )}
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
            </div>

            {/* Grid responsivo com alinhamento consistente - Max 3 colunas para evitar sobreposição */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-5">

                {/* IMEI 1 */}
                {categoryConfig.imei1 && categoryConfig.imei1 !== 'off' && (
                    <div className="space-y-1 min-w-0">
                        <IMEIInput
                            label="IMEI 1"
                            technicalName="specs.imei1"
                            value={watch('specs.imei1') || ''}
                            onChange={(val) => setValue('specs.imei1', val)}
                            required={categoryConfig.imei1 === 'required'}
                            placeholder="Digite 15 dígitos"
                            onBlur={(e) => { if (e.target.value.length === 15) checkUniqueInDb('imei1', e.target.value); }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const nextField = document.getElementById('field-imei2') || document.getElementById('field-serial');
                                    if (nextField) (nextField as HTMLInputElement).focus();
                                }
                            }}
                        />
                        {categoryConfig.imei1 === 'required' && errors?.specs?.imei1?.message && (
                            <p className="text-xs text-red-600 mt-1">{errors.specs.imei1.message as string}</p>
                        )}
                        {uniqueErrors.imei1 && (
                            <p className="text-xs text-red-600 mt-1">⚠️ {uniqueErrors.imei1}</p>
                        )}
                    </div>
                )}

                {/* IMEI 2 */}
                {categoryConfig.imei2 && categoryConfig.imei2 !== 'off' && (
                    <div className="space-y-1 min-w-0">
                        <IMEIInput
                            id="field-imei2"
                            label="IMEI 2"
                            technicalName="specs.imei2"
                            value={watch('specs.imei2') || ''}
                            onChange={(val) => setValue('specs.imei2', val)}
                            required={categoryConfig.imei2 === 'required'}
                            placeholder="Digite 15 dígitos"
                            onBlur={(e) => { if (e.target.value.length === 15) checkUniqueInDb('imei2', e.target.value); }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const serialField = document.getElementById('field-serial');
                                    if (serialField) (serialField as HTMLInputElement).focus();
                                }
                            }}
                        />
                        {categoryConfig.imei2 === 'required' && errors?.specs?.imei2?.message && (
                            <p className="text-xs text-red-600 mt-1">{errors.specs.imei2.message as string}</p>
                        )}
                        {uniqueErrors.imei2 && (
                            <p className="text-xs text-red-600 mt-1">⚠️ {uniqueErrors.imei2}</p>
                        )}
                    </div>
                )}

                {/* SERIAL - Rendered here to ensure it's 3rd field */}
                {categoryConfig.serial && categoryConfig.serial !== 'off' && renderGenericField('serial', categoryConfig.serial)}

                {/*
                    UNIQUE FIELDS (color, storage, ram, version)
                    Always shown here for both CREATE and EDIT modes
                    BatchEntryGrid has been removed for simplicity
                */}

                {/* COR */}
                {categoryConfig.color && categoryConfig.color !== 'off' && (
                    <div className="space-y-1 min-w-0">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Cor Predominante {categoryConfig.color === 'required' && <span className="text-red-500">*</span>}
                            <span className="ml-2 text-xs text-slate-400 font-mono">specs.color</span>
                        </label>
                        <ColorSelect
                            value={watch('specs.color') || ''}
                            onChange={(val) => setValue('specs.color', val)}
                        />
                        {categoryConfig.color === 'required' && errors?.specs?.color && (
                            <p className="text-xs text-red-600 mt-1">{(errors.specs.color as any)?.message}</p>
                        )}
                    </div>
                )}

                {/* ARMAZENAMENTO */}
                {categoryConfig.storage && categoryConfig.storage !== 'off' && (
                    <div className="space-y-1 min-w-0">
                        <CapacitySelect
                            value={watch('specs.storage') || ''}
                            onChange={(val) => setValue('specs.storage', val)}
                            label="Armazenamento"
                            technicalName="specs.storage"
                            placeholder="Selecione o armazenamento"
                        />
                        {categoryConfig.storage === 'required' && errors?.specs?.storage && (
                            <p className="text-xs text-red-600 mt-1">{(errors.specs.storage as any)?.message}</p>
                        )}
                    </div>
                )}

                {/* RAM */}
                {categoryConfig.ram && categoryConfig.ram !== 'off' && (
                    <div className="space-y-1 min-w-0">
                        <CapacitySelect
                            value={watch('specs.ram') || ''}
                            onChange={(val) => setValue('specs.ram', val)}
                            label="Memória RAM"
                            technicalName="specs.ram"
                            placeholder="Selecione a RAM"
                            type="ram"
                        />
                        {categoryConfig.ram === 'required' && errors?.specs?.ram && (
                            <p className="text-xs text-red-600 mt-1">{(errors.specs.ram as any)?.message}</p>
                        )}
                    </div>
                )}

                {/* VERSÃO */}
                {categoryConfig.version && categoryConfig.version !== 'off' && !templateValues?.['version'] && (
                    <div className="space-y-1 min-w-0">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Versão {categoryConfig.version === 'required' && <span className="text-red-500">*</span>}
                            <span className="ml-2 text-xs text-slate-400 font-mono">specs.version</span>
                        </label>
                        <VersionSelect
                            value={watch('specs.version') || ''}
                            onChange={(val) => setValue('specs.version', val)}
                        />
                        {categoryConfig.version === 'required' && errors?.specs?.version && (
                            <p className="text-xs text-red-600 mt-1">{(errors.specs.version as any)?.message}</p>
                        )}
                    </div>
                )}

                {/* SAÚDE DA BATERIA */}
                {categoryConfig.battery_health && categoryConfig.battery_health !== 'off' && (
                    <div className="space-y-1 min-w-0">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Saúde Bateria {categoryConfig.battery_health === 'required' && <span className="text-red-500">*</span>}
                            <span className="ml-2 text-xs text-slate-400 font-mono">specs.battery_health</span>
                        </label>
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
                            <p className="text-xs text-red-600 mt-1">{(errors.specs.battery_health as any)?.message}</p>
                        )}
                    </div>
                )}

                {/* DYNAMIC FIELDS - Render all other configured fields */}
                {Object.entries(categoryConfig)
                    .filter(([key, value]) => {
                        if (typeof value !== 'string') return false;
                        if (value === 'off') return false;
                        if (isSpecialField(key)) return false;
                        if (key === 'custom_fields') return false;
                        if (key.includes('ean_autofill') || key.includes('auto_name')) return false;
                        // Hide fields already in template
                        if (templateValues && templateValues[key] !== undefined) return false;
                        return true;
                    })
                    .sort(([keyA], [keyB]) => {
                        if (keyA === 'serial') return -1;
                        if (keyB === 'serial') return 1;
                        return keyA.localeCompare(keyB);
                    })
                    .map(([key, value]) => renderGenericField(key, value as any))
                }

                {/* CUSTOM FIELDS - Dynamic rendering */}
                {fieldsLoading ? (
                    <div className="text-sm text-slate-500">Carregando campos...</div>
                ) : (
                    customFields
                        ?.filter((customField) => {
                            // Exclude UNIQUE_FIELDS that are already rendered above
                            // These fields appear in the batch entry grid
                            const uniqueFields = ['color', 'storage', 'ram', 'version', 'imei1', 'imei2', 'serial'];
                            return !uniqueFields.includes(customField.key);
                        })
                        .map((customField) => {
                            if (customField.requirement === 'off') return null;

                            return (
                                <div key={customField.id} className="space-y-1 min-w-0">
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

                                    {/* Table Relation */}
                                    {customField.type === 'table_relation' && customField.table_config && (
                                        <TableRelationField
                                            tableConfig={customField.table_config}
                                            value={watch(`specs.${customField.key}`) || null}
                                            onChange={(val) => setValue(`specs.${customField.key}`, val)}
                                            className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                        />
                                    )}
                                </div>
                            );
                        }))}
            </div>
        </div>
    );
}
