import React from 'react';
import { UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { ProductInput } from '../../../types/product';
import { CategoryConfig } from '../../../types/category';
import { IMEIInput } from '../../ui/IMEIInput';
import { ColorSelect } from '../selectors/ColorSelect';
import { CapacitySelect } from '../selectors/CapacitySelect';
import { VersionSelect } from '../selectors/VersionSelect';
import { Package } from 'lucide-react';

interface ProductSpecificationsProps {
    categoryConfig: CategoryConfig | null;
    watch: UseFormWatch<ProductInput>;
    setValue: UseFormSetValue<ProductInput>;
    errors?: any;
}

export function ProductSpecifications({
    categoryConfig,
    watch,
    setValue,
    errors
}: ProductSpecificationsProps) {
    if (!categoryConfig) return null;

    // Helper para Labels com Asterisco
    const FieldLabel = ({ label, required }: { label: string, required: boolean }) => (
        <label className="block text-sm font-medium text-slate-700 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
    );

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Package size={18} className="text-blue-600" />
                Especificações Técnicas
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-auto min-h-fit">

                {/* IMEI 1 */}
                {categoryConfig.imei1 !== 'off' && (
                    <div>
                        <IMEIInput
                            label="IMEI 1"
                            value={watch('specs.imei1') || ''}
                            onChange={(val) => setValue('specs.imei1', val)}
                            required={categoryConfig.imei1 === 'required'}
                            placeholder="Digite 15 dígitos"
                        />
                        {categoryConfig.imei1 === 'required' && errors?.specs?.message && (
                            <span className="text-xs text-red-500">{errors.specs.message}</span>
                        )}
                    </div>
                )}

                {/* IMEI 2 */}
                {categoryConfig.imei2 !== 'off' && (
                    <div>
                        <IMEIInput
                            label="IMEI 2"
                            value={watch('specs.imei2') || ''}
                            onChange={(val) => setValue('specs.imei2', val)}
                            required={categoryConfig.imei2 === 'required'}
                            placeholder="Digite 15 dígitos"
                        />
                        {categoryConfig.imei2 === 'required' && errors?.specs?.message && (
                            <span className="text-xs text-red-500">{errors.specs.message}</span>
                        )}
                    </div>
                )}

                {/* SERIAL */}
                {categoryConfig.serial !== 'off' && (
                    <div>
                        <FieldLabel label="Serial" required={categoryConfig.serial === 'required'} />
                        <input
                            type="text"
                            value={watch('specs.serial') || ''}
                            onChange={(e) => setValue('specs.serial', e.target.value.toUpperCase().trim())}
                            className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                            placeholder="Ex: SN123456789"
                        />
                        {categoryConfig.serial === 'required' && errors?.specs?.message && (
                            <span className="text-xs text-red-500">{errors.specs.message}</span>
                        )}
                    </div>
                )}

                {/* COR */}
                {categoryConfig.color !== 'off' && (
                    <div>
                        <FieldLabel label="Cor Predominante" required={categoryConfig.color === 'required'} />
                        <ColorSelect
                            value={watch('specs.color')}
                            onChange={(val) => setValue('specs.color', val)}
                            error={categoryConfig.color === 'required' ? errors?.specs?.message : undefined}
                        />
                    </div>
                )}

                {/* ARMAZENAMENTO */}
                {categoryConfig.storage !== 'off' && (
                    <div>
                        <FieldLabel label="Armazenamento" required={categoryConfig.storage === 'required'} />
                        <CapacitySelect
                            type="storage"
                            value={watch('specs.storage')}
                            onChange={(val) => setValue('specs.storage', val)}
                            error={categoryConfig.storage === 'required' ? errors?.specs?.message : undefined}
                        />
                    </div>
                )}

                {/* RAM */}
                {categoryConfig.ram !== 'off' && (
                    <div>
                        <FieldLabel label="Memória RAM" required={categoryConfig.ram === 'required'} />
                        <CapacitySelect
                            type="ram"
                            value={watch('specs.ram')}
                            onChange={(val) => setValue('specs.ram', val)}
                            error={categoryConfig.ram === 'required' ? errors?.specs?.message : undefined}
                        />
                    </div>
                )}

                {/* VERSÃO */}
                {categoryConfig.version !== 'off' && (
                    <div>
                        <FieldLabel label="Versão" required={categoryConfig.version === 'required'} />
                        <VersionSelect
                            value={watch('specs.version')}
                            onChange={(val) => setValue('specs.version', val)}
                            error={categoryConfig.version === 'required' ? errors?.specs?.message : undefined}
                        />
                    </div>
                )}

                {/* SAÚDE DA BATERIA */}
                {categoryConfig.battery_health !== 'off' && (
                    <div>
                        <FieldLabel label="Saúde Bateria" required={categoryConfig.battery_health === 'required'} />
                        <select
                            value={watch('specs.battery_health') || ''}
                            onChange={(e) => setValue('specs.battery_health', e.target.value)}
                            className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
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
                        {categoryConfig.battery_health === 'required' && errors?.specs?.message && (
                            <span className="text-xs text-red-500">{errors.specs.message}</span>
                        )}
                    </div>
                )}

                {/* CUSTOM FIELDS - Dynamic rendering */}
                {categoryConfig.custom_fields?.map((customField) => {
                    if (customField.requirement === 'off') return null;

                    return (
                        <div key={customField.id}>
                            <FieldLabel
                                label={customField.name}
                                required={customField.requirement === 'required'}
                            />


                            {/* Text-based inputs - includes all text formats from dictionary */}
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

                            {customField.requirement === 'required' && errors?.specs?.message && (
                                <span className="text-xs text-red-500">{errors.specs.message}</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
