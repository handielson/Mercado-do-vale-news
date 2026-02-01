import React from 'react';
import { UseFormWatch, UseFormSetValue, Control, FieldErrors } from 'react-hook-form';
import { ProductInput } from '../../../types/product';
import { Product } from '../../../types/product';
import { EANInput } from '../../ui/EANInput';
import { CategorySelect } from '../CategorySelect';
import { BrandSelect } from '../selectors/BrandSelect';
import { ModelSelect } from '../selectors/ModelSelect';
import { SmartInput } from '../../ui/SmartInput';
import { Package, Loader2 } from 'lucide-react';

interface ProductBasicInfoProps {
    watch: UseFormWatch<ProductInput>;
    setValue: UseFormSetValue<ProductInput>;
    control: Control<ProductInput>;
    errors: FieldErrors<ProductInput>;
    selectedCategoryId: string | null;
    selectedBrandId: string | null;
    eanSearchMessage: string;
    isDuplicateEAN: boolean;
    existingProduct: Product | null;
    isSearchingEAN: boolean;
    handleAddAlternativeEAN: () => void;
}

export function ProductBasicInfo({
    watch,
    setValue,
    control,
    errors,
    selectedCategoryId,
    selectedBrandId,
    eanSearchMessage,
    isDuplicateEAN,
    existingProduct,
    isSearchingEAN,
    handleAddAlternativeEAN
}: ProductBasicInfoProps) {
    return (
        <>
            {/* 0. SCANNER DE CÓDIGO DE BARRAS (PRIMEIRO CAMPO) */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                        <Package size={20} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-800">Scanner de Código de Barras</h3>
                        <p className="text-xs text-slate-600">Escaneie ou digite o EAN para buscar produto existente</p>
                    </div>
                </div>

                <EANInput
                    value={watch('eans') || []}
                    onChange={(value) => setValue('eans', value)}
                />

                {/* Status message */}
                {eanSearchMessage && !isDuplicateEAN && (
                    <div className={`p-3 rounded-lg text-sm font-medium ${eanSearchMessage.includes('✅') ? 'bg-green-100 text-green-800 border border-green-300' :
                        eanSearchMessage.includes('🔍') ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                            eanSearchMessage.includes('ℹ️') ? 'bg-slate-100 text-slate-800 border border-slate-300' :
                                'bg-orange-100 text-orange-800 border border-orange-300'
                        }`}>
                        {eanSearchMessage}
                    </div>
                )}

                {/* Duplicate EAN Warning Card */}
                {isDuplicateEAN && existingProduct && (
                    <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-5 space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Package size={20} className="text-white" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-semibold text-yellow-900 text-base mb-1">
                                    ⚠️ Código de Barras Já Cadastrado!
                                </h4>
                                <p className="text-sm text-yellow-800 mb-2">
                                    Este EAN já está vinculado ao seguinte produto:
                                </p>
                                <div className="bg-white rounded-lg p-3 border border-yellow-300">
                                    <p className="font-medium text-slate-900">{existingProduct.name}</p>
                                    <p className="text-xs text-slate-600 mt-1">
                                        Marca: <span className="font-medium">{existingProduct.brand}</span> |
                                        Modelo: <span className="font-medium">{existingProduct.model}</span>
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        EANs cadastrados: {existingProduct.eans.join(', ')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-yellow-300 pt-4">
                            <p className="text-sm font-medium text-yellow-900 mb-3">
                                Escolha uma ação:
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Opção 1: Adicionar Unidade */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        // TODO: Implementar navegação para tela de unidades
                                        alert('🚧 Tela de unidades em desenvolvimento.\\nPor enquanto, use a opção \"Adicionar EAN Alternativo\".');
                                    }}
                                    className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                                >
                                    <Package size={18} />
                                    <div className="text-left">
                                        <div>Adicionar Nova Unidade</div>
                                        <div className="text-xs opacity-90">Cadastrar dispositivo físico</div>
                                    </div>
                                </button>

                                {/* Opção 2: Adicionar EAN Alternativo */}
                                <button
                                    type="button"
                                    onClick={handleAddAlternativeEAN}
                                    className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
                                >
                                    <span className="text-xl">🏷️</span>
                                    <div className="text-left">
                                        <div>Adicionar EAN Alternativo</div>
                                        <div className="text-xs opacity-90">Código adicional do produto</div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isSearchingEAN && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                        <Loader2 size={16} className="animate-spin" />
                        <span>Buscando produto...</span>
                    </div>
                )}
            </div>

            {/* 1. INFORMAÇÕES BÁSICAS */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-semibold text-slate-800 mb-4">Informações Básicas</h3>

                <div className="grid grid-cols-1 gap-4">
                    <CategorySelect
                        value={selectedCategoryId || ''}
                        onChange={(id) => setValue('category_id', id)}
                        error={errors.category_id?.message}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Marca *</label>
                        <BrandSelect
                            value={watch('brand')}
                            onChange={(val) => setValue('brand', val)}
                            error={errors.brand?.message}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Modelo *</label>
                        <ModelSelect
                            value={watch('model')}
                            brandId={selectedBrandId}
                            onChange={(val) => setValue('model', val)}
                            error={errors.model?.message}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SmartInput control={control} name="name" />
                    <SmartInput control={control} name="sku" />
                </div>
            </div>
        </>
    );
}
