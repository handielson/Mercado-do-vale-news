import React, { useState } from 'react';
import { UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { ProductInput } from '../../../types/product';
import { CurrencyInput } from '../../ui/CurrencyInput';

interface ProductPricingProps {
    watch: UseFormWatch<ProductInput>;
    setValue: UseFormSetValue<ProductInput>;
}

export function ProductPricing({ watch, setValue }: ProductPricingProps) {
    // Estado para controlar qual aba da calculadora de margem está ativa
    const [activeMarginTab, setActiveMarginTab] = useState<'retail' | 'reseller' | 'wholesale'>('retail');

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-800 mb-4">Precificação</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Preço de Custo *</label>
                    <CurrencyInput value={watch('price_cost') || 0} onChange={(val) => setValue('price_cost', val)} />
                    <p className="text-xs text-slate-500 mt-1">💰 Preço de compra</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Preço Varejo *</label>
                    <CurrencyInput value={watch('price_retail')} onChange={(val) => setValue('price_retail', val)} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Preço Revenda *</label>
                    <CurrencyInput value={watch('price_reseller')} onChange={(val) => setValue('price_reseller', val)} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Preço Atacado *</label>
                    <CurrencyInput value={watch('price_wholesale')} onChange={(val) => setValue('price_wholesale', val)} />
                </div>
            </div>

            {/* Calculadora de Margem Unificada com Abas */}
            <div className="mt-4 p-4 bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-800">💹 Calculadora de Margem de Lucro</h4>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-4">
                    <button
                        type="button"
                        onClick={() => setActiveMarginTab('retail')}
                        className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeMarginTab === 'retail'
                            ? 'bg-green-600 text-white shadow-md'
                            : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                            }`}
                    >
                        🟢 Varejo
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveMarginTab('reseller')}
                        className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeMarginTab === 'reseller'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                            }`}
                    >
                        🔵 Revenda
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveMarginTab('wholesale')}
                        className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeMarginTab === 'wholesale'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                            }`}
                    >
                        🟣 Atacado
                    </button>
                </div>

                {/* Conteúdo da Tab Ativa */}
                {activeMarginTab === 'retail' && (
                    <div className="space-y-3">
                        {/* Métricas */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-white p-3 rounded-lg border border-green-200">
                                <label className="block text-xs font-medium text-slate-600 mb-1">Margem (R$)</label>
                                <div className="text-lg font-bold text-green-700">
                                    {(() => {
                                        const cost = watch('price_cost') || 0;
                                        const retail = watch('price_retail') || 0;
                                        const marginCents = retail - cost;
                                        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(marginCents / 100);
                                    })()}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Lucro por unidade</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-green-200">
                                <label className="block text-xs font-medium text-slate-600 mb-1">Margem (%)</label>
                                <div className="text-lg font-bold text-green-700">
                                    {(() => {
                                        const cost = watch('price_cost') || 0;
                                        const retail = watch('price_retail') || 0;
                                        if (cost === 0) return '0%';
                                        return `${(((retail - cost) / cost) * 100).toFixed(2)}%`;
                                    })()}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Percentual de lucro</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-green-200">
                                <label className="block text-xs font-medium text-slate-600 mb-1">Markup</label>
                                <div className="text-lg font-bold text-blue-700">
                                    {(() => {
                                        const cost = watch('price_cost') || 0;
                                        const retail = watch('price_retail') || 0;
                                        if (cost === 0) return '0x';
                                        return `${(retail / cost).toFixed(2)}x`;
                                    })()}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Multiplicador</p>
                            </div>
                        </div>
                        {/* Inputs */}
                        <div className="p-3 bg-white rounded-lg border border-green-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Margem em R$</label>
                                    <CurrencyInput value={0} onChange={(marginCents) => {
                                        const cost = watch('price_cost') || 0;
                                        if (marginCents > 0 && cost > 0) setValue('price_retail', cost + marginCents);
                                    }} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Margem em %</label>
                                    <input type="number" step="0.01" placeholder="Ex: 50" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" onChange={(e) => {
                                        const marginPercent = parseFloat(e.target.value) || 0;
                                        const cost = watch('price_cost') || 0;
                                        if (marginPercent > 0 && cost > 0) setValue('price_retail', Math.round(cost * (1 + marginPercent / 100)));
                                    }} />
                                </div>
                            </div>
                        </div>
                        {/* Botões Rápidos */}
                        <div className="flex flex-wrap gap-2">
                            <span className="text-xs font-medium text-slate-600">Margem rápida:</span>
                            {[10, 20, 30, 50, 100].map(percent => (
                                <button key={percent} type="button" onClick={() => {
                                    const cost = watch('price_cost') || 0;
                                    if (cost > 0) setValue('price_retail', Math.round(cost * (1 + percent / 100)));
                                }} className="px-2 py-1 text-xs font-medium bg-white border border-green-300 text-green-700 rounded hover:bg-green-100 transition-colors">
                                    +{percent}%
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {activeMarginTab === 'reseller' && (
                    <div className="space-y-3">
                        {/* Métricas */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-white p-3 rounded-lg border border-blue-200">
                                <label className="block text-xs font-medium text-slate-600 mb-1">Margem (R$)</label>
                                <div className="text-lg font-bold text-blue-700">
                                    {(() => {
                                        const cost = watch('price_cost') || 0;
                                        const reseller = watch('price_reseller') || 0;
                                        const marginCents = reseller - cost;
                                        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(marginCents / 100);
                                    })()}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Lucro por unidade</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-blue-200">
                                <label className="block text-xs font-medium text-slate-600 mb-1">Margem (%)</label>
                                <div className="text-lg font-bold text-blue-700">
                                    {(() => {
                                        const cost = watch('price_cost') || 0;
                                        const reseller = watch('price_reseller') || 0;
                                        if (cost === 0) return '0%';
                                        return `${(((reseller - cost) / cost) * 100).toFixed(2)}%`;
                                    })()}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Percentual de lucro</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-blue-200">
                                <label className="block text-xs font-medium text-slate-600 mb-1">Markup</label>
                                <div className="text-lg font-bold text-blue-700">
                                    {(() => {
                                        const cost = watch('price_cost') || 0;
                                        const reseller = watch('price_reseller') || 0;
                                        if (cost === 0) return '0x';
                                        return `${(reseller / cost).toFixed(2)}x`;
                                    })()}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Multiplicador</p>
                            </div>
                        </div>
                        {/* Inputs */}
                        <div className="p-3 bg-white rounded-lg border border-blue-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Margem em R$</label>
                                    <CurrencyInput value={0} onChange={(marginCents) => {
                                        const cost = watch('price_cost') || 0;
                                        if (marginCents > 0 && cost > 0) setValue('price_reseller', cost + marginCents);
                                    }} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Margem em %</label>
                                    <input type="number" step="0.01" placeholder="Ex: 40" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" onChange={(e) => {
                                        const marginPercent = parseFloat(e.target.value) || 0;
                                        const cost = watch('price_cost') || 0;
                                        if (marginPercent > 0 && cost > 0) setValue('price_reseller', Math.round(cost * (1 + marginPercent / 100)));
                                    }} />
                                </div>
                            </div>
                        </div>
                        {/* Botões Rápidos */}
                        <div className="flex flex-wrap gap-2">
                            <span className="text-xs font-medium text-slate-600">Margem rápida:</span>
                            {[10, 15, 20, 25, 30].map(percent => (
                                <button key={percent} type="button" onClick={() => {
                                    const cost = watch('price_cost') || 0;
                                    if (cost > 0) setValue('price_reseller', Math.round(cost * (1 + percent / 100)));
                                }} className="px-2 py-1 text-xs font-medium bg-white border border-blue-300 text-blue-700 rounded hover:bg-blue-100 transition-colors">
                                    +{percent}%
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {activeMarginTab === 'wholesale' && (
                    <div className="space-y-3">
                        {/* Métricas */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-white p-3 rounded-lg border border-purple-200">
                                <label className="block text-xs font-medium text-slate-600 mb-1">Margem (R$)</label>
                                <div className="text-lg font-bold text-purple-700">
                                    {(() => {
                                        const cost = watch('price_cost') || 0;
                                        const wholesale = watch('price_wholesale') || 0;
                                        const marginCents = wholesale - cost;
                                        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(marginCents / 100);
                                    })()}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Lucro por unidade</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-purple-200">
                                <label className="block text-xs font-medium text-slate-600 mb-1">Margem (%)</label>
                                <div className="text-lg font-bold text-purple-700">
                                    {(() => {
                                        const cost = watch('price_cost') || 0;
                                        const wholesale = watch('price_wholesale') || 0;
                                        if (cost === 0) return '0%';
                                        return `${(((wholesale - cost) / cost) * 100).toFixed(2)}%`;
                                    })()}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Percentual de lucro</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-purple-200">
                                <label className="block text-xs font-medium text-slate-600 mb-1">Markup</label>
                                <div className="text-lg font-bold text-purple-700">
                                    {(() => {
                                        const cost = watch('price_cost') || 0;
                                        const wholesale = watch('price_wholesale') || 0;
                                        if (cost === 0) return '0x';
                                        return `${(wholesale / cost).toFixed(2)}x`;
                                    })()}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Multiplicador</p>
                            </div>
                        </div>
                        {/* Inputs */}
                        <div className="p-3 bg-white rounded-lg border border-purple-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Margem em R$</label>
                                    <CurrencyInput value={0} onChange={(marginCents) => {
                                        const cost = watch('price_cost') || 0;
                                        if (marginCents > 0 && cost > 0) setValue('price_wholesale', cost + marginCents);
                                    }} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Margem em %</label>
                                    <input type="number" step="0.01" placeholder="Ex: 15" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" onChange={(e) => {
                                        const marginPercent = parseFloat(e.target.value) || 0;
                                        const cost = watch('price_cost') || 0;
                                        if (marginPercent > 0 && cost > 0) setValue('price_wholesale', Math.round(cost * (1 + marginPercent / 100)));
                                    }} />
                                </div>
                            </div>
                        </div>
                        {/* Botões Rápidos */}
                        <div className="flex flex-wrap gap-2">
                            <span className="text-xs font-medium text-slate-600">Margem rápida:</span>
                            {[5, 10, 15, 20, 25].map(percent => (
                                <button key={percent} type="button" onClick={() => {
                                    const cost = watch('price_cost') || 0;
                                    if (cost > 0) setValue('price_wholesale', Math.round(cost * (1 + percent / 100)));
                                }} className="px-2 py-1 text-xs font-medium bg-white border border-purple-300 text-purple-700 rounded hover:bg-purple-100 transition-colors">
                                    +{percent}%
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
