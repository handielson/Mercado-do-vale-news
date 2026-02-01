import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createUnitSchema } from '../../schemas/unit';
import { UnitInput } from '../../types/unit';
import { CategoryConfig } from '../../types/category';
import { ProductCondition } from '../../utils/field-standards';
import { productService } from '../../services/products';
import { categoryService } from '../../services/categories';
import { CurrencyInput } from '../ui/CurrencyInput';
import { Loader2 } from 'lucide-react';

interface UnitFormProps {
    productId: string;
    initialData?: UnitInput;
    onSubmit: (data: UnitInput) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

export function UnitForm({ productId, initialData, onSubmit, onCancel, isLoading }: UnitFormProps) {
    const [config, setConfig] = useState<CategoryConfig | null>(null);
    const [loadingConfig, setLoadingConfig] = useState(true);

    // 1. Busca a Configuração da Categoria do Produto
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const product = await productService.getById(productId);
                if (product?.category_id) {
                    const category = await categoryService.getById(product.category_id);
                    setConfig(category.config);
                }
            } catch (error) {
                console.error("Erro ao carregar config:", error);
            } finally {
                setLoadingConfig(false);
            }
        };
        loadConfig();
    }, [productId]);

    // 2. Cria o Schema de Validação Dinâmico
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors }
    } = useForm<UnitInput>({
        resolver: async (data, context, options) => {
            // Truque para o Zod esperar a config carregar
            if (!config) return { values: {}, errors: {} };
            const schema = createUnitSchema({
                categoryConfig: config,
                condition: data.condition || ProductCondition.NEW
            });
            return zodResolver(schema)(data, context, options);
        },
        defaultValues: initialData || {
            condition: ProductCondition.NEW,
            status: 'available'
        }
    });

    const condition = watch('condition');

    if (loadingConfig) {
        return <div className="p-8 text-center text-slate-500"><Loader2 className="animate-spin mx-auto mb-2" /> Carregando regras...</div>;
    }

    // Se não achou config, assume padrão (tudo opcional) ou bloqueia
    if (!config) return <div className="text-red-500">Erro: Categoria não configurada.</div>;

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-200">

            {/* IDENTIFICADORES (IMEI / SERIAL) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* IMEI 1 */}
                {config.imei !== 'off' && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            IMEI Principal {config.imei === 'required' && <span className="text-red-500">*</span>}
                        </label>
                        <input
                            {...register('imei_1')}
                            maxLength={15}
                            placeholder="15 dígitos"
                            className={`w-full rounded-md border p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${errors.imei_1 ? 'border-red-500' : 'border-slate-300'}`}
                        />
                        {errors.imei_1 && <span className="text-xs text-red-500">{errors.imei_1.message}</span>}
                    </div>
                )}

                {/* IMEI 2 (Geralmente opcional se o 1 estiver ativado, mas segue a config) */}
                {config.imei !== 'off' && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            IMEI Secundário (Digital)
                        </label>
                        <input
                            {...register('imei_2')}
                            maxLength={15}
                            placeholder="Opcional"
                            className="w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                )}

                {/* SERIAL */}
                {config.serial !== 'off' && (
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Número de Série {config.serial === 'required' && <span className="text-red-500">*</span>}
                        </label>
                        <input
                            {...register('serial_number')}
                            placeholder="S/N do fabricante"
                            className={`w-full rounded-md border p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${errors.serial_number ? 'border-red-500' : 'border-slate-300'}`}
                        />
                        {errors.serial_number && <span className="text-xs text-red-500">{errors.serial_number.message}</span>}
                    </div>
                )}
            </div>

            {/* FINANCEIRO & ESTADO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200">

                {/* Custo */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Preço de Custo (Compra)</label>
                    <CurrencyInput
                        value={watch('cost_price')}
                        onValueChange={(val) => setValue('cost_price', val)}
                    />
                </div>

                {/* Condição */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Condição do Item *</label>
                    <select
                        {...register('condition')}
                        className="w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        <option value={ProductCondition.NEW}>Novo (Lacrado)</option>
                        <option value={ProductCondition.USED}>Usado</option>
                        <option value={ProductCondition.OPEN_BOX}>Open Box (Vitrine)</option>
                    </select>
                </div>

                {/* Bateria (Só aparece se USADO e Config permitir) */}
                {condition === ProductCondition.USED && config.battery_health !== 'off' && (
                    <div className="animate-in fade-in slide-in-from-top-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Saúde da Bateria (%) {config.battery_health === 'required' && <span className="text-red-500">*</span>}
                        </label>
                        <input
                            type="number"
                            {...register('battery_health', { valueAsNumber: true })}
                            min="0"
                            max="100"
                            placeholder="Ex: 85"
                            className={`w-full rounded-md border p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${errors.battery_health ? 'border-red-500' : 'border-slate-300'}`}
                        />
                        {errors.battery_health && <span className="text-xs text-red-500">{errors.battery_health.message}</span>}
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                    Cancelar
                </button>
                <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isLoading ? 'Salvando...' : 'Adicionar ao Estoque'}
                </button>
            </div>
        </form>
    );
}
