import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, FileText, Loader2, MapPin, Package, Pencil, RefreshCw } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { modelService } from '../../../services/models';
import { vpsApiService } from '../../../services/vpsApiService';
import { unitService } from '../../../services/units';
import { stockLocationService } from '../../../services/stockLocationService';
import { aggregateModelProducts } from '../../../services/modelProductAggregator.js';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function money(cents: number): string {
    return currency.format(Number(cents || 0) / 100);
}

function statusLabel(status: string): string {
    const labels: Record<string, string> = {
        available: 'Disponivel',
        reserved: 'Reservado',
        sold: 'Vendido',
        rma: 'RMA',
    };
    return labels[status] || status || '-';
}

export const ModelProductAggregatorPage: React.FC = () => {
    const { modelId } = useParams<{ modelId: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const load = useCallback(async () => {
        if (!modelId) return;
        setIsLoading(true);
        try {
            const [model, products] = await Promise.all([
                modelService.getById(modelId),
                vpsApiService.getProducts({ model_id: modelId, status: 'all', limit: 500, noCache: true }),
            ]);

            if (!model) throw new Error('Modelo nao encontrado.');
            const safeProducts = Array.isArray(products) ? products : [];

            const unitLists = await Promise.all(
                safeProducts.map((product: any) => unitService.listByProduct(product.id).catch(() => []))
            );
            const locationLists = await Promise.all(
                safeProducts.map((product: any) =>
                    stockLocationService.getProductStockDistribution(product.id).catch(() => [])
                )
            );

            const locationsByProductId = Object.fromEntries(
                safeProducts.map((product: any, index: number) => [product.id, locationLists[index] || []])
            );

            setData(aggregateModelProducts({
                model,
                products: safeProducts,
                units: unitLists.flat(),
                locationsByProductId,
            }));
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'Erro ao carregar painel do modelo.');
        } finally {
            setIsLoading(false);
        }
    }, [modelId]);

    useEffect(() => {
        load();
    }, [load]);

    const modelName = useMemo(() => String(data?.model?.name || 'Modelo'), [data]);

    return (
        <div className="space-y-6 print:bg-white">
            <div className="flex items-start justify-between gap-4 print:hidden">
                <div className="flex items-start gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/admin/products')}
                        className="mt-1 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        title="Voltar para produtos"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Painel do modelo</h1>
                        <p className="mt-1 text-sm text-slate-500">{modelName}</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={load}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </button>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                        <FileText className="h-4 w-4" />
                        Imprimir PDF
                    </button>
                </div>
            </div>

            {isLoading && !data && (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-6 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Carregando painel do modelo...
                </div>
            )}

            {data && (
                <>
                    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <SummaryCard label="Estoque atual" value={`${data.totals.availableCount} un.`} />
                        <SummaryCard label="Vendidos" value={`${data.totals.soldCount} un.`} />
                        <SummaryCard label="Valor em estoque" value={money(data.totals.stockCostValue)} />
                        <SummaryCard label="Valor investido" value={money(data.totals.investedValue)} />
                        <SummaryCard label="Valor ja retornado" value={money(data.totals.returnedValue)} />
                    </section>

                    <section className="space-y-4">
                        {data.memoryGroups.map((memoryGroup: any) => (
                            <article key={memoryGroup.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:border-slate-300 print:shadow-none">
                                <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900">
                                            {memoryGroup.ram} / {memoryGroup.storage}
                                        </h2>
                                        {memoryGroup.isIncomplete && (
                                            <p className="mt-1 text-sm font-semibold text-amber-700">
                                                Dados incompletos: {memoryGroup.missingFields.join(', ')}
                                            </p>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
                                        <Metric label="Estoque" value={`${memoryGroup.availableCount} un.`} />
                                        <Metric label="Vendidos" value={`${memoryGroup.soldCount} un.`} />
                                        <Metric label="Em estoque" value={money(memoryGroup.stockCostValue)} />
                                        <Metric label="Investido" value={money(memoryGroup.investedValue)} />
                                        <Metric label="Retornado" value={money(memoryGroup.returnedValue)} />
                                    </div>
                                </div>

                                <div className="mt-4 space-y-4">
                                    {memoryGroup.colors.map((colorGroup: any) => (
                                        <div key={colorGroup.key} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 print:bg-white">
                                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                <div>
                                                    <h3 className="font-bold text-slate-800">{colorGroup.color}</h3>
                                                    <p className="text-xs text-slate-500">
                                                        {colorGroup.availableCount} disponivel(is), {colorGroup.soldCount} vendido(s)
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap gap-2 print:hidden">
                                                    {colorGroup.products.map((product: any) => (
                                                        <React.Fragment key={product.id}>
                                                            <a href={product.publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                                                                <ExternalLink className="h-3.5 w-3.5" />
                                                                Ver no site
                                                            </a>
                                                            <button type="button" onClick={() => navigate(product.editUrl)} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                                                                <Pencil className="h-3.5 w-3.5" />
                                                                Editar produto
                                                            </button>
                                                            <button type="button" onClick={() => navigate(product.stockLocationUrl)} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                                                                <MapPin className="h-3.5 w-3.5" />
                                                                Locais
                                                            </button>
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                            </div>

                                            {colorGroup.locations.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {colorGroup.locations.map((location: any, index: number) => (
                                                        <span key={`${location.location_id || index}`} className="rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                                                            {location.deposit_name || 'Deposito'} / {location.location_name || location.location_id || 'Local'}: {Number(location.quantity || 0)} un.
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="mt-3 overflow-x-auto">
                                                <table className="min-w-full text-left text-xs">
                                                    <thead className="text-slate-500">
                                                        <tr>
                                                            <th className="px-2 py-2">SKU</th>
                                                            <th className="px-2 py-2">IMEI 1</th>
                                                            <th className="px-2 py-2">IMEI 2</th>
                                                            <th className="px-2 py-2">Serial</th>
                                                            <th className="px-2 py-2">Status</th>
                                                            <th className="px-2 py-2">Local</th>
                                                            <th className="px-2 py-2">Custo</th>
                                                            <th className="px-2 py-2">Retorno</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 bg-white">
                                                        {colorGroup.units.map((unit: any) => {
                                                            const product = colorGroup.products.find((item: any) => item.id === unit.productId);
                                                            return (
                                                                <tr key={unit.id}>
                                                                    <td className="px-2 py-2 font-semibold text-slate-700">{product?.sku || '-'}</td>
                                                                    <td className="px-2 py-2 font-mono">{unit.imei1 || '-'}</td>
                                                                    <td className="px-2 py-2 font-mono">{unit.imei2 || '-'}</td>
                                                                    <td className="px-2 py-2 font-mono">{unit.serial || '-'}</td>
                                                                    <td className="px-2 py-2">{statusLabel(unit.status)}</td>
                                                                    <td className="px-2 py-2">{unit.locationId || unit.depositId || '-'}</td>
                                                                    <td className="px-2 py-2">{money(unit.costValue)}</td>
                                                                    <td className="px-2 py-2">
                                                                        {unit.returnedValue ? money(unit.returnedValue) : '-'}
                                                                        {unit.returnedValueEstimated ? <span className="ml-1 text-amber-600">(estimado)</span> : null}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                        {colorGroup.units.length === 0 && (
                                                            <tr>
                                                                <td colSpan={8} className="px-2 py-4 text-center text-slate-400">Nenhuma unidade serializada vinculada.</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </article>
                        ))}
                    </section>
                </>
            )}
        </div>
    );
};

const SummaryCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:border-slate-300 print:shadow-none">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
);

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="rounded-lg bg-slate-50 px-3 py-2 print:bg-white">
        <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
        <p className="font-bold text-slate-800">{value}</p>
    </div>
);
