import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CopyPlus, ExternalLink, FileText, Loader2, MapPin, Pencil, RefreshCw } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { modelService } from '../../../services/models';
import { categoryService } from '../../../services/categories';
import { vpsApiService } from '../../../services/vpsApiService';
import { vpsClient } from '../../../services/vpsClient';
import { unitService } from '../../../services/units';
import { isLocalCatalogPreviewRuntime } from '../../../services/localCatalogPreview';
import { stockLocationService } from '../../../services/stockLocationService';
import { aggregateModelProducts, getModelIdentifierSections } from '../../../services/modelProductAggregator.js';
import { getProductCloneState } from '../../../services/productClonePrefill.js';
import { isArchivedProductRecord } from '../../../utils/localProductVisibility';
import { PAYJOY_SALE_NOTE } from '../../../utils/saleInformation.js';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function money(cents: number): string {
    return currency.format(Number(cents || 0) / 100);
}

function statusLabel(status: string): string {
    const labels: Record<string, string> = {
        available: 'Disponível',
        reserved: 'Reservado',
        sold: 'Vendido',
        rma: 'RMA',
        hidden: 'Oculto / não localizado',
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
    const [showFinancials, setShowFinancials] = useState(false);
    const [showHidden, setShowHidden] = useState(false);
    const [visibilityUnit, setVisibilityUnit] = useState<any | null>(null);
    const [visibilityReason, setVisibilityReason] = useState('');
    const [savingVisibility, setSavingVisibility] = useState(false);
    const requestVisibility = (unit: any) => {
        setVisibilityUnit(unit);
        setVisibilityReason(unit.status === 'hidden' ? 'Aparelho localizado e conferido.' : 'Aparelho não localizado no estoque.');
    };
    const saveVisibility = async () => {
        if (!visibilityUnit || savingVisibility) return;
        setSavingVisibility(true);
        try {
            await unitService.setVisibility(visibilityUnit.id, visibilityUnit.status !== 'hidden', visibilityReason);
            toast.success(isLocalCatalogPreviewRuntime() ? 'Teste salvo somente nesta prévia local. O estoque real não foi alterado.' : visibilityUnit.status === 'hidden' ? 'Aparelho reativado.' : 'Aparelho ocultado e retirado da disponibilidade.');
            setVisibilityUnit(null);
            await load();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Não foi possível alterar a visibilidade.');
        } finally { setSavingVisibility(false); }
    };

    const load = useCallback(async () => {
        if (!modelId) return;
        setIsLoading(true);
        try {
            const [model, products, sales, saleItems, customers, categories] = await Promise.all([
                modelService.getById(modelId),
                vpsApiService.getProducts({ model_id: modelId, status: 'all', limit: 500, noCache: true }),
                loadTableRows('sales'),
                loadTableRows('sale_items'),
                loadTableRows('customers'),
                categoryService.list(),
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
                categoriesById: Object.fromEntries(categories.map((category) => [category.id, category])),
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
    const memoryGroups = useMemo(() => [...(data?.memoryGroups || [])].sort((a, b) =>
        Number(a.isIncomplete) - Number(b.isIncomplete)
        || `${a.ram} ${a.storage}`.localeCompare(`${b.ram} ${b.storage}`, 'pt-BR', { numeric: true })), [data]);
    const copySku = async (sku: string) => {
        try {
            await navigator.clipboard.writeText(sku);
            toast.success(`SKU ${sku} copiado`);
        } catch {
            toast.error('Não foi possível copiar o SKU.');
        }
    };

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
                    {data.parentProducts?.length > 0 && (
                        <details className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                            <summary className="cursor-pointer font-semibold">Cadastros de família vinculados ao modelo ({data.parentProducts.length})</summary>
                            <p className="mt-2 text-xs text-blue-700">O estoque pertence às variações abaixo. Cada SKU de pai abre seu próprio cadastro.</p>
                            <div className="mt-3 space-y-2">
                            {data.parentProducts.map((parent: any) => (
                                <div key={parent.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-100 bg-white p-3">
                                    <span className="font-semibold">{parent.name}</span>
                                    <div className="flex items-center gap-3">
                                    <button type="button" onClick={() => copySku(parent.sku)} className="font-mono underline" title="Copiar SKU do pai">{parent.sku}</button>
                                    <button type="button" onClick={() => navigate(parent.editUrl)} className="font-semibold text-blue-700 hover:underline">Editar produto pai</button>
                                    </div>
                                </div>
                            ))}
                            </div>
                        </details>
                    )}
                    <section className="grid gap-3 sm:grid-cols-3">
                        <SummaryCard label="Estoque atual" value={`${data.totals.availableCount} un.`} />
                        <SummaryCard label="Vendidos" value={`${data.totals.soldCount} un.`} />
                        <button type="button" aria-pressed={showHidden} onClick={() => setShowHidden(!showHidden)} className={`rounded-xl border p-4 text-left print:hidden ${showHidden ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                            <span className="block text-sm font-semibold text-slate-600">Ocultos / não localizados</span>
                            <span className="mt-1 block text-xl font-bold text-slate-900">{memoryGroups.reduce((sum, group) => sum + group.colors.reduce((count: number, color: any) => count + getModelIdentifierSections(color).hidden.length, 0), 0)} un.</span>
                            <span className="mt-2 block text-sm font-semibold text-blue-700">{showHidden ? 'Fechar lista de ocultos' : 'Mostrar aparelhos ocultos'}</span>
                        </button>
                    </section>
                    {showHidden && <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 print:hidden">Os aparelhos ocultos aparecem abaixo, em suas respectivas memórias e cores. Use Reativar quando o aparelho for localizado. Se o total for zero, não há aparelhos ocultos neste modelo.</p>}
                    <details className="rounded-xl border border-slate-200 bg-white p-4 print:hidden">
                        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Resumo financeiro do modelo</summary>
                        <p className="mt-2 text-xs text-slate-500">Valores calculados a partir dos custos e das vendas registrados no sistema.</p>
                        <section className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <SummaryCard label="Valor em estoque" value={money(data.totals.stockCostValue)} />
                        <SummaryCard label="Custo médio em estoque" value={money(data.totals.averageStockCost)} />
                        <SummaryCard label="Valor investido" value={money(data.totals.investedValue)} />
                        <SummaryCard label="Valor já retornado" value={money(data.totals.returnedValue)} />
                        </section>
                    </details>

                    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                        <nav aria-label="Memórias do modelo" className="flex flex-wrap gap-2">
                            {memoryGroups.map((group: any, index: number) => <a key={group.key}
                                href={`#model-memory-${index}`} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100">
                                {group.label} <span className="ml-1 text-xs font-normal">· {group.availableCount} un.</span>
                            </a>)}
                        </nav>
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                            <input type="checkbox" checked={showFinancials} onChange={event => setShowFinancials(event.target.checked)} />
                            Mostrar custos nas variações
                        </label>
                    </div>

                    <section className="space-y-4">
                        {memoryGroups.map((memoryGroup: any, index: number) => (
                            <article id={`model-memory-${index}`} key={memoryGroup.key} className="scroll-mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:border-slate-300 print:shadow-none">
                                <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900">
                                            {memoryGroup.label}
                                        </h2>
                                        {memoryGroup.isIncomplete && (
                                            <p className="mt-1 text-sm font-semibold text-amber-700">
                                                Campos obrigatórios não preenchidos: {memoryGroup.missingFields.map((field: string) => ({ ram: 'RAM', storage: 'armazenamento', color: 'cor' }[field] || field)).join(', ')}
                                            </p>
                                        )}
                                    </div>
                                    {data.memoryGroups.length > 1 && <div className="grid grid-cols-2 gap-2 text-sm">
                                        <Metric label="Estoque" value={`${memoryGroup.availableCount} un.`} />
                                        <Metric label="Vendidos" value={`${memoryGroup.soldCount} un.`} />
                                    </div>}
                                </div>

                                <div className="mt-4 overflow-x-auto">
                                    <table className="min-w-full text-left text-sm">
                                        <thead className="border-b border-slate-100 text-xs font-bold uppercase text-slate-400">
                                            <tr>
                                                <th className="px-3 py-3">Cor</th>
                                                <th className="px-3 py-3">SKU</th>
                                                <th className="px-3 py-3 text-right">Estoque</th>
                                                <th className="px-3 py-3 text-right">Vendidos</th>
                                                {showFinancials && <th className="px-3 py-3 text-right">Valor estoque</th>}
                                                {showFinancials && <th className="px-3 py-3 text-right">Custo médio</th>}
                                                <th className="px-3 py-3 print:hidden">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {memoryGroup.colors.map((colorGroup: any) => (
                                                <React.Fragment key={colorGroup.key}>
                                                    <tr className="align-top">
                                                        <td className="px-3 py-4">
                                                            <div className="font-bold text-slate-900">{colorGroup.color}</div>
                                                        </td>
                                                        <td className="px-3 py-4">
                                                            <div className="space-y-1">
                                                                {(colorGroup.skuGroups || colorGroup.products).map((product: any) => (
                                                                    <div key={product.key || product.id} className="font-mono text-xs text-slate-700">
                                                                        {product.sku ? <button type="button" onClick={() => copySku(product.sku)} className="text-blue-700 hover:underline" title="Copiar SKU">{product.sku}</button> : '-'}
                                                                        {product.duplicateCount > 1 && (
                                                                            <span className="font-sans text-amber-600"> ({product.duplicateCount} cadastros)</span>
                                                                        )}
                                                                        {product.hasStockDivergence && (
                                                                            <span className="block font-sans text-[11px] font-semibold text-amber-700">
                                                                                Divergencia: {product.registeredCount} IMEIs cadastrados, {product.locationCount} em locais
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-4 text-right">
                                                            <p className="font-bold text-slate-900">{colorGroup.availableCount} un.</p>
                                                            <details className="mt-2 max-w-56 text-left text-xs text-slate-600">
                                                                <summary className="cursor-pointer text-emerald-700">Locais de estoque</summary>
                                                                <p className="mt-1 leading-5">{locationText(colorGroup.locations)}</p>
                                                            </details>
                                                            {colorGroup.stockDivergences?.length > 0 && <p className="mt-2 max-w-56 text-left text-xs font-semibold text-amber-700">Conferir locais: quantidades e IMEIs divergem.</p>}
                                                        </td>
                                                        <td className="px-3 py-4 text-right">{colorGroup.soldCount} un.</td>
                                                        {showFinancials && <td className="px-3 py-4 text-right font-semibold text-slate-900">{money(colorGroup.stockCostValue)}</td>}
                                                        {showFinancials && <td className="px-3 py-4 text-right font-semibold text-slate-900">{money(colorGroup.averageStockCost)}</td>}
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
                                                    <tr className="bg-emerald-50/40">
                                                        <td colSpan={showFinancials ? 7 : 5} className="px-3 py-3">
                                                            <IdentifierTable title="Disponíveis em estoque" records={getModelIdentifierSections(colorGroup).available} colorGroup={colorGroup} onNavigate={navigate} onVisibility={requestVisibility} tone="stock" />
                                                            {showHidden && getModelIdentifierSections(colorGroup).hidden.length > 0 && <IdentifierTable title="Ocultos / não localizados" records={getModelIdentifierSections(colorGroup).hidden} colorGroup={colorGroup} onNavigate={navigate} onVisibility={requestVisibility} tone="hidden" />}
                                                            {getModelIdentifierSections(colorGroup).other.length > 0 && <IdentifierTable title="Reservados / assistência / outras situações" records={getModelIdentifierSections(colorGroup).other} colorGroup={colorGroup} onNavigate={navigate} tone="other" />}
                                                            {getModelIdentifierSections(colorGroup).unconfirmed.length > 0 && <IdentifierTable title="IMEIs do cadastro sem situação confirmada" records={getModelIdentifierSections(colorGroup).unconfirmed} colorGroup={colorGroup} onNavigate={navigate} tone="unknown" />}
                                                        </td>
                                                    </tr>
                                                    {colorGroup.units.filter((unit: any) => unit.status === 'sold').length > 0 && (
                                                        <tr className="bg-slate-50/70">
                                                            <td colSpan={showFinancials ? 7 : 5} className="px-3 py-3">
                                                                <details>
                                                                    <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                                                                        Vendidos — fora do estoque ({colorGroup.units.filter((unit: any) => unit.status === 'sold').length})
                                                                    </summary>
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
                                                                                                {unit.payJoy && <span className="mt-1 block w-fit rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">{PAYJOY_SALE_NOTE}</span>}
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
                                                                </details>
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
            {visibilityUnit && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="unit-visibility-title">
                <div className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl">
                    <h2 id="unit-visibility-title" className="text-lg font-bold">{visibilityUnit.status === 'hidden' ? 'Reativar aparelho' : 'Ocultar aparelho não localizado'}</h2>
                    {isLocalCatalogPreviewRuntime() && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Prévia local: esta ação será salva apenas para teste neste computador. O site publicado, o PDV e o estoque real não serão alterados.</p>}
                    <p className="font-mono text-sm">IMEI: {visibilityUnit.imei1 || visibilityUnit.imei2 || visibilityUnit.serial || visibilityUnit.id}</p>
                    <p className="text-sm text-slate-600">{visibilityUnit.status === 'hidden' ? 'O aparelho voltará à disponibilidade para venda. Confirme que ele foi localizado.' : 'Este aparelho sairá da disponibilidade do site, do PDV e da lista principal. O registro será preservado na lista de ocultos, sem registrar uma venda.'}</p>
                    <label className="block text-sm font-semibold">Motivo<textarea value={visibilityReason} onChange={event => setVisibilityReason(event.target.value)} maxLength={500} className="mt-2 w-full rounded-lg border border-slate-300 p-3" /></label>
                    <div className="flex justify-end gap-3">
                        <button type="button" disabled={savingVisibility} onClick={() => setVisibilityUnit(null)} className="rounded-lg border px-4 py-2">Cancelar</button>
                        <button type="button" disabled={savingVisibility || visibilityReason.trim().length < 3} onClick={saveVisibility} className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{savingVisibility ? 'Salvando...' : visibilityUnit.status === 'hidden' ? 'Reativar aparelho' : 'Ocultar aparelho'}</button>
                    </div>
                </div>
            </div>}
        </div>
    );
};

const SummaryCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:border-slate-300 print:shadow-none">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
);

const IdentifierTable: React.FC<{ title: string; records: any[]; colorGroup: any; onNavigate: (path: string) => void; onVisibility?: (unit: any) => void; tone: 'stock' | 'other' | 'unknown' | 'hidden' }> = ({ title, records, colorGroup, onNavigate, onVisibility, tone }) => (
    <details open={tone === 'stock' || tone === 'hidden'} className={`mt-2 rounded-lg border p-3 ${tone === 'stock' ? 'border-emerald-200 bg-white' : 'border-amber-200 bg-amber-50'}`}>
        <summary className={`cursor-pointer text-sm font-semibold ${tone === 'stock' ? 'text-emerald-800' : 'text-amber-800'}`}>{title} · {colorGroup.color} ({records.length})</summary>
        {tone === 'unknown' && <p className="mt-2 text-xs text-amber-800">O IMEI está salvo na ficha, mas não há uma unidade correspondente com status confirmado. Ele não é apresentado como disponível nem vendido.</p>}
        {records.length === 0 ? <p className="mt-2 text-xs text-slate-500">Nenhum aparelho com IMEI/serial identificado como disponível.{colorGroup.availableCount > 0 && ' Há saldo de estoque sem identificação individual nesta lista.'}</p> :
            <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                    <thead className="text-slate-500"><tr>{['SKU', 'IMEI 1', 'IMEI 2', 'Serial', 'Situação', 'Local'].map(label => <th key={label} className="px-2 py-2">{label}</th>)}<th className="px-2 py-2 print:hidden">Cadastro</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">{records.map(record => {
                        const product = colorGroup.products.find((item: any) => item.id === record.productId);
                        return <tr key={record.id || record.productId}>
                            <td className="px-2 py-2 font-semibold">{record.sku || product?.sku || '-'}</td>
                            <td className="px-2 py-2 font-mono">{record.imei1 || '-'}</td>
                            <td className="px-2 py-2 font-mono">{record.imei2 || '-'}</td>
                            <td className="px-2 py-2 font-mono">{record.serial || '-'}</td>
                            <td className="px-2 py-2 font-semibold">{tone === 'unknown' ? 'A conferir' : statusLabel(record.status)}</td>
                            <td className="px-2 py-2">{tone === 'unknown' ? '-' : unitLocationText(record)}</td>
                            <td className="px-2 py-2 print:hidden"><div className="flex flex-wrap gap-3">{(record.editUrl || product?.editUrl) && <button type="button" onClick={() => onNavigate(record.editUrl || product.editUrl)} className="font-semibold text-blue-700 hover:underline">Abrir cadastro</button>}
                                {onVisibility && !record.isProductSpecsUnit && ['available', 'hidden'].includes(record.status) && <button type="button" onClick={() => onVisibility(record)} className="font-semibold text-amber-800 hover:underline">{record.status === 'hidden' ? 'Reativar' : 'Ocultar'}</button>}
                            </div></td>
                        </tr>;
                    })}</tbody>
                </table>
            </div>}
    </details>
);

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="rounded-lg bg-slate-50 px-3 py-2 print:bg-white">
        <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
        <p className="font-bold text-slate-800">{value}</p>
    </div>
);

const ProductActions: React.FC<{ product: any; onNavigate: (path: string) => void; onDuplicate: () => void }> = ({ product, onNavigate, onDuplicate }) => (
    <div className="flex flex-wrap items-center gap-1.5">
        {product.duplicateCount > 1 && <span className="font-mono text-xs font-bold text-slate-700">{product.sku || 'Sem SKU'}</span>}
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 bg-white">
            <a
                href={product.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                title={`Abre a pagina publica do SKU ${product.sku || 'produto'}`}
            >
                <ExternalLink className="h-3.5 w-3.5" />
                Site
            </a>
            <button
                type="button"
                onClick={() => onNavigate(product.editUrl)}
                className="inline-flex items-center gap-1 border-l border-slate-200 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                title={`Abre a edicao do SKU ${product.sku || 'produto'}`}
            >
                <Pencil className="h-3.5 w-3.5" />
                Editar
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
