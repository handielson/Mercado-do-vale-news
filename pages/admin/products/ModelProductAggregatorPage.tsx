import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CopyPlus, ExternalLink, FileText, Loader2, MapPin, Pencil, RefreshCw } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { modelService } from '../../../services/models';
import { vpsApiService } from '../../../services/vpsApiService';
import { vpsClient } from '../../../services/vpsClient';
import { unitService } from '../../../services/units';
import { stockLocationService } from '../../../services/stockLocationService';
import { aggregateModelProducts } from '../../../services/modelProductAggregator.js';
import { getProductCloneState } from '../../../services/productClonePrefill.js';
import { isArchivedProductRecord } from '../../../utils/localProductVisibility';

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

function locationText(locations: any[]): string {
    const labels = new Map<string, number>();
    locations.forEach((location) => {
        const label = location.label || `${location.depositName || location.deposit_name || 'Deposito'} / ${location.locationName || location.location_name || 'Local'}`;
        labels.set(label, (labels.get(label) || 0) + Number(location.quantity || 0));
    });
    return [...labels.entries()]
        .map(([label, quantity]) => `${label}: ${quantity} un.`)
        .join(' | ') || '-';
}

function unitLocationText(unit: any): string {
    return unit.locationLabel || unit.locationId || unit.depositId || '-';
}

async function loadTableRows(tableName: string): Promise<any[]> {
    const allRows: any[] = [];
    const pageSize = 200;

    for (let offset = 0; ; offset += pageSize) {
        const data = await vpsClient.get<{ rows?: any[] }>(
            `/table-data/${encodeURIComponent(tableName)}?limit=${pageSize}&offset=${offset}`
        );
        const rows = Array.isArray(data.rows) ? data.rows : [];
        allRows.push(...rows);
        if (rows.length < pageSize) break;
    }

    return allRows;
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
            const [model, products, sales, saleItems, customers] = await Promise.all([
                modelService.getById(modelId),
                vpsApiService.getProducts({ model_id: modelId, status: 'all', limit: 500, noCache: true }),
                loadTableRows('sales'),
                loadTableRows('sale_items'),
                loadTableRows('customers'),
            ]);

            if (!model) throw new Error('Modelo nao encontrado.');
            const safeProducts = (Array.isArray(products) ? products : [])
                .filter((product: any) => !isArchivedProductRecord(product));

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
                sales,
                saleItems,
                customers,
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
                    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                        <SummaryCard label="Estoque atual" value={`${data.totals.availableCount} un.`} />
                        <SummaryCard label="Vendidos" value={`${data.totals.soldCount} un.`} />
                        <SummaryCard label="Valor em estoque" value={money(data.totals.stockCostValue)} />
                        <SummaryCard label="Preco medio estoque" value={money(data.totals.averageStockCost)} />
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
                                    <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3 xl:grid-cols-6">
                                        <Metric label="Estoque" value={`${memoryGroup.availableCount} un.`} />
                                        <Metric label="Vendidos" value={`${memoryGroup.soldCount} un.`} />
                                        <Metric label="Em estoque" value={money(memoryGroup.stockCostValue)} />
                                        <Metric label="Preco medio" value={money(memoryGroup.averageStockCost)} />
                                        <Metric label="Investido" value={money(memoryGroup.investedValue)} />
                                        <Metric label="Retornado" value={money(memoryGroup.returnedValue)} />
                                    </div>
                                </div>

                                <div className="mt-4 overflow-x-auto">
                                    <table className="min-w-full text-left text-sm">
                                        <thead className="border-b border-slate-100 text-xs font-bold uppercase text-slate-400">
                                            <tr>
                                                <th className="px-3 py-3">Cor</th>
                                                <th className="px-3 py-3">Produtos</th>
                                                <th className="px-3 py-3 text-right">Estoque</th>
                                                <th className="px-3 py-3 text-right">Vendidos</th>
                                                <th className="px-3 py-3 text-right">Valor estoque</th>
                                                <th className="px-3 py-3 text-right">Preco medio</th>
                                                <th className="px-3 py-3">Locais</th>
                                                <th className="px-3 py-3 print:hidden">Atalhos por SKU</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {memoryGroup.colors.map((colorGroup: any) => (
                                                <React.Fragment key={colorGroup.key}>
                                                    <tr className="align-top">
                                                        <td className="px-3 py-4">
                                                            <div className="font-bold text-slate-900">{colorGroup.color}</div>
                                                            <div className="mt-1 text-xs text-slate-500">
                                                                {money(colorGroup.investedValue)} investido
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-4">
                                                            <div className="space-y-1">
                                                                {(colorGroup.skuGroups || colorGroup.products).map((product: any) => (
                                                                    <div key={product.key || product.id} className="font-mono text-xs text-slate-700">
                                                                        {product.sku || '-'}
                                                                        {product.duplicateCount > 1 && (
                                                                            <span className="font-sans text-amber-600"> ({product.duplicateCount} cadastros)</span>
                                                                        )}
                                                                        <span className="font-sans text-slate-400"> · {product.availableCount} un.</span>
                                                                        {product.hasStockDivergence && (
                                                                            <span className="block font-sans text-[11px] font-semibold text-amber-700">
                                                                                Divergencia: {product.registeredCount} IMEIs cadastrados, {product.locationCount} em locais
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-4 text-right font-bold text-slate-900">{colorGroup.availableCount} un.</td>
                                                        <td className="px-3 py-4 text-right">{colorGroup.soldCount} un.</td>
                                                        <td className="px-3 py-4 text-right font-semibold text-slate-900">{money(colorGroup.stockCostValue)}</td>
                                                        <td className="px-3 py-4 text-right font-semibold text-slate-900">{money(colorGroup.averageStockCost)}</td>
                                                        <td className="px-3 py-4 text-xs leading-5 text-slate-600">
                                                            <div>{locationText(colorGroup.locations)}</div>
                                                            {colorGroup.stockDivergences?.length > 0 && (
                                                                <div className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 font-semibold text-amber-800">
                                                                    Conferir locais: IMEIs cadastrados e locais nao batem.
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-4 print:hidden">
                                                            <div className="space-y-2">
                                                                {(colorGroup.skuGroups || colorGroup.products).map((product: any) => (
                                                                    <ProductActions
                                                                        key={product.key || product.id}
                                                                        product={product}
                                                                        onNavigate={navigate}
                                                                        onDuplicate={() => {
                                                                            const source = product.raw || product.products?.[0]?.raw || product.products?.[0] || product;
                                                                            navigate('/admin/products/new', { state: getProductCloneState(source) });
                                                                        }}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {(colorGroup.skuGroups || []).some((group: any) => group.identifiers?.length > 0) && (
                                                        <tr className="bg-slate-50/70">
                                                            <td colSpan={8} className="px-3 py-3">
                                                                <div>
                                                                    <div className="text-xs font-bold uppercase text-slate-500">
                                                                        IMEIs cadastrados nos produtos
                                                                    </div>
                                                                    <div className="mt-3 overflow-x-auto">
                                                                        <table className="min-w-full text-left text-xs">
                                                                            <thead className="text-slate-500">
                                                                                <tr>
                                                                                    <th className="px-2 py-2">SKU</th>
                                                                                    <th className="px-2 py-2">IMEI 1</th>
                                                                                    <th className="px-2 py-2">IMEI 2</th>
                                                                                    <th className="px-2 py-2">Serial</th>
                                                                                    <th className="px-2 py-2 print:hidden">Cadastro</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-slate-100 bg-white">
                                                                                {(colorGroup.skuGroups || []).flatMap((group: any) => group.identifiers || []).map((identifier: any) => (
                                                                                    <tr key={identifier.productId}>
                                                                                        <td className="px-2 py-2 font-semibold text-slate-700">{identifier.sku || '-'}</td>
                                                                                        <td className="px-2 py-2 font-mono">{identifier.imei1 || '-'}</td>
                                                                                        <td className="px-2 py-2 font-mono">{identifier.imei2 || '-'}</td>
                                                                                        <td className="px-2 py-2 font-mono">{identifier.serial || '-'}</td>
                                                                                        <td className="px-2 py-2 print:hidden">
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => navigate(identifier.editUrl)}
                                                                                                className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                                                                                            >
                                                                                                Abrir
                                                                                            </button>
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {colorGroup.units.filter((unit: any) => unit.status === 'sold').length > 0 && (
                                                        <tr className="bg-slate-50/70">
                                                            <td colSpan={9} className="px-3 py-3">
                                                                <div>
                                                                    <div className="text-xs font-bold uppercase text-slate-500">
                                                                        Unidades vendidas ({colorGroup.units.filter((unit: any) => unit.status === 'sold').length})
                                                                    </div>
                                                                    <div className="mt-3 overflow-x-auto">
                                                                        <table className="min-w-full text-left text-xs">
                                                                            <thead className="text-slate-500">
                                                                                <tr>
                                                                                    <th className="px-2 py-2">SKU</th>
                                                                                    <th className="px-2 py-2">IMEI 1</th>
                                                                                    <th className="px-2 py-2">IMEI 2</th>
                                                                                    <th className="px-2 py-2">Serial</th>
                                                                                    <th className="px-2 py-2">Pedido</th>
                                                                                    <th className="px-2 py-2">Cliente</th>
                                                                                    <th className="px-2 py-2">Venda</th>
                                                                                    <th className="px-2 py-2">Custo</th>
                                                                                    <th className="px-2 py-2">Lucro</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-slate-100 bg-white">
                                                                                {colorGroup.units.filter((unit: any) => unit.status === 'sold').map((unit: any) => {
                                                                                    const product = colorGroup.products.find((item: any) => item.id === unit.productId);
                                                                                    return (
                                                                                        <tr key={unit.id}>
                                                                                            <td className="px-2 py-2 font-semibold text-slate-700">{product?.sku || '-'}</td>
                                                                                            <td className="px-2 py-2 font-mono">{unit.imei1 || '-'}</td>
                                                                                            <td className="px-2 py-2 font-mono">{unit.imei2 || '-'}</td>
                                                                                            <td className="px-2 py-2 font-mono">{unit.serial || '-'}</td>
                                                                                            <td className="px-2 py-2">
                                                                                                {unit.orderUrl || unit.saleUrl ? (
                                                                                                    <a
                                                                                                        href={unit.saleUrl || unit.orderUrl}
                                                                                                        className="font-semibold text-blue-700 hover:text-blue-900"
                                                                                                    >
                                                                                                        {unit.orderNumber || 'Abrir venda'}
                                                                                                    </a>
                                                                                                ) : (
                                                                                                    unit.orderNumber || '-'
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="px-2 py-2">{unit.customerName || '-'}</td>
                                                                                            <td className="px-2 py-2">
                                                                                                {unit.returnedValue ? money(unit.returnedValue) : '-'}
                                                                                                {unit.returnedValueEstimated ? <span className="ml-1 text-amber-600">(estimado)</span> : null}
                                                                                            </td>
                                                                                            <td className="px-2 py-2">{money(unit.costValue)}</td>
                                                                                            <td className={`px-2 py-2 font-semibold ${unit.profitValue >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                                                                                {unit.returnedValue ? money(unit.profitValue) : '-'}
                                                                                            </td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
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

const ProductActions: React.FC<{ product: any; onNavigate: (path: string) => void; onDuplicate: () => void }> = ({ product, onNavigate, onDuplicate }) => (
    <div className="flex flex-wrap items-center gap-1.5">
        <span className="min-w-[86px] font-mono text-xs font-bold text-slate-700">{product.sku || 'Sem SKU'}</span>
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 bg-white">
            <a
                href={product.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                title={`Abre a pagina publica do SKU ${product.sku || 'produto'}`}
            >
                <ExternalLink className="h-3.5 w-3.5" />
                Site publico
            </a>
            <button
                type="button"
                onClick={() => onNavigate(product.editUrl)}
                className="inline-flex items-center gap-1 border-l border-slate-200 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                title={`Abre a edicao do SKU ${product.sku || 'produto'}`}
            >
                <Pencil className="h-3.5 w-3.5" />
                Editar produto
            </button>
            <button
                type="button"
                onClick={onDuplicate}
                className="inline-flex items-center gap-1 border-l border-slate-200 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                title={`Abre novo cadastro preenchido a partir do SKU ${product.sku || 'produto'}, limpando IMEI e serial`}
            >
                <CopyPlus className="h-3.5 w-3.5" />
                Adicionar igual
            </button>
            <button
                type="button"
                onClick={() => onNavigate(product.stockLocationUrl)}
                className="inline-flex items-center gap-1 border-l border-slate-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                title={`Abre os locais de estoque filtrados pelo SKU ${product.sku || 'produto'}`}
            >
                <MapPin className="h-3.5 w-3.5" />
                Estoque
            </button>
        </div>
    </div>
);
