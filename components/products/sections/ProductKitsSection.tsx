import React from 'react';
import { useFieldArray, Control, UseFormRegister, FieldErrors, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { Plus, Trash2, Layers } from 'lucide-react';
import { ProductInput } from '../../../types/product';
import { CurrencyInput } from '../../ui/CurrencyInput';

interface ProductKitsSectionProps {
    control: Control<ProductInput>;
    register: UseFormRegister<ProductInput>;
    errors: FieldErrors<ProductInput>;
    watch: UseFormWatch<ProductInput>;
    setValue: UseFormSetValue<ProductInput>;
}

export function ProductKitsSection({ control, register, errors, watch, setValue }: ProductKitsSectionProps) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: 'kits'
    });

    return (
        <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Layers size={18} className="text-blue-600" />
                    Kits e Descontos por Volume
                </h3>
                <button
                    type="button"
                    onClick={() => append({ quantity: 2, price: 0, price_wholesale: 0, price_reseller: 0, name: '' })}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                >
                    <Plus size={16} />
                    Adicionar Kit
                </button>
            </div>
            
            <p className="text-sm text-slate-500 mb-4">
                Configure descontos progressivos por quantidade. Exemplo: Vender 5 unidades deste mesmo produto por um preço promocional fechado.
            </p>

            {fields.length === 0 ? (
                <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-lg text-slate-500">
                    Nenhum kit configurado. Clique em "Adicionar Kit" para disponibilizar pacotes no carrinho.
                </div>
            ) : (
                <div className="space-y-4">
                    {fields.map((field, index) => (
                        <div key={field.id} className="relative p-5 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-300 transition-colors">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                <div className="md:col-span-4">
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Nome do Kit</label>
                                    <input
                                        {...register(`kits.${index}.name`)}
                                        placeholder="Ex: Kit Revendedor 5x"
                                        className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Qtd *</label>
                                    <input
                                        type="number"
                                        min="2"
                                        {...register(`kits.${index}.quantity`, { valueAsNumber: true })}
                                        className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono"
                                    />
                                    {errors?.kits?.[index]?.quantity && (
                                        <p className="text-xs text-red-600 mt-1">{errors.kits[index]?.quantity?.message}</p>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Total Varejo *</label>
                                    <CurrencyInput
                                        value={watch(`kits.${index}.price`)}
                                        onChange={(val) => setValue(`kits.${index}.price`, val, { shouldValidate: true, shouldDirty: true })}
                                        className="w-full bg-white font-mono text-base"
                                    />
                                    {errors?.kits?.[index]?.price && (
                                        <p className="text-xs text-red-600 mt-1">{errors.kits[index]?.price?.message}</p>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Total Atacado</label>
                                    <CurrencyInput
                                        value={watch(`kits.${index}.price_wholesale`)}
                                        onChange={(val) => setValue(`kits.${index}.price_wholesale`, val, { shouldValidate: true, shouldDirty: true })}
                                        className="w-full bg-white font-mono text-base"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Total Revenda</label>
                                    <CurrencyInput
                                        value={watch(`kits.${index}.price_reseller`)}
                                        onChange={(val) => setValue(`kits.${index}.price_reseller`, val, { shouldValidate: true, shouldDirty: true })}
                                        className="w-full bg-white font-mono text-base"
                                    />
                                </div>
                            </div>
                            
                            <button
                                type="button"
                                onClick={() => remove(index)}
                                className="absolute -top-3 -right-3 text-red-500 hover:bg-red-100 p-2 rounded-full transition-colors bg-white border border-red-200 shadow-sm"
                                title="Remover Kit"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
