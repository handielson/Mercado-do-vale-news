import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Package, Printer, X } from 'lucide-react';
import { renderInventoryCategoryReport } from '../../../utils/inventoryCategoryReport.mjs';
import { categorySubtreeIds } from '../../../utils/categorySelectTree';
import { InventoryFilters as FiltersType, InventoryStats as StatsType, InventoryGroup } from '../../../types/inventory';
import { inventoryService } from '../../../services/inventory';
import { categoryService } from '../../../services/categories';
import { InventoryStats } from '../../../components/inventory/InventoryStats';
import { InventoryFilters } from '../../../components/inventory/InventoryFilters';
import { InventoryTable } from '../../../components/inventory/InventoryTable';
import { StockAdjustmentModal } from '../../../components/inventory/StockAdjustmentModal';
import { SerializedUnitsModal } from '../../../components/inventory/SerializedUnitsModal';

/**
 * InventoryPage
 * Main inventory management page with serialized product support
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Page < 300 lines
 * - Modular components
 * - Real-time updates
 * - Grouped serialized products
 */
export function InventoryPage() {
    const [groups, setGroups] = useState<InventoryGroup[]>([]);
    const [stats, setStats] = useState<StatsType>({
        total_products: 0,
        total_units: 0,
        serialized_groups: 0,
        non_serialized_groups: 0,
        available: 0,
        reserved: 0,
        sold: 0,
        in_maintenance: 0,
        defective: 0,
        in_stock: 0,
        low_stock: 0,
        out_of_stock: 0,
        not_tracked: 0,
        total_value: 0
    });
    const [filters, setFilters] = useState<FiltersType>({});
    const [categories, setCategories] = useState<Array<{ id: string; name: string; parent_id?: string | null }>>([]);
    const [brands, setBrands] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [printing, setPrinting] = useState(false);
    const [printError, setPrintError] = useState('');
    const [report, setReport] = useState<{ rows: Awaited<ReturnType<typeof inventoryService.getCategoryStockReport>>; categoryName: string; generatedAt: Date } | null>(null);
    const [reportOptions, setReportOptions] = useState({ showPurchaseCost: false, showAverageCost: false, showSalePrice: false });
    const [reportReady, setReportReady] = useState(false);
    const reportFrameRef = useRef<HTMLIFrameElement>(null);
    const reportHtml = useMemo(() => report
        ? renderInventoryCategoryReport(report.rows, report.categoryName, report.generatedAt, reportOptions) : '',
    [report, reportOptions]);
    const [selectedGroup, setSelectedGroup] = useState<InventoryGroup | null>(null);
    const [showUnitsModal, setShowUnitsModal] = useState(false);
    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const productRequestIdRef = useRef(0);

    // Load initial data
    useEffect(() => {
        loadStats();
        loadCategories();
        loadBrands();
    }, []);

    // Reload products when filters change
    useEffect(() => {
        loadProducts();
    }, [filters]);

    const loadData = async () => {
        await Promise.all([
            loadProducts(),
            loadStats()
        ]);
    };

    const loadProducts = async () => {
        const requestId = productRequestIdRef.current + 1;
        productRequestIdRef.current = requestId;

        try {
            setLoading(true);
            const data = await inventoryService.getInventoryGrouped(filters);
            if (requestId === productRequestIdRef.current) {
                setGroups(data);
            }
        } catch (error) {
            if (requestId === productRequestIdRef.current) {
                console.error('Error loading inventory groups:', error);
            }
        } finally {
            if (requestId === productRequestIdRef.current) {
                setLoading(false);
            }
        }
    };

    const loadStats = async () => {
        try {
            const data = await inventoryService.getStats();
            setStats(data);
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    const loadCategories = async () => {
        try {
            const data = await categoryService.list();
            setCategories(data.map(cat => ({ id: cat.id, name: cat.name, parent_id: cat.parent_id })));
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    const loadBrands = async () => {
        try {
            const data = await inventoryService.getBrands();
            setBrands(data);
        } catch (error) {
            console.error('Error loading brands:', error);
        }
    };

    const handleViewUnits = (group: InventoryGroup) => {
        setSelectedGroup(group);
        setShowUnitsModal(true);
    };

    const handlePrintCategory = async () => {
        const category = categories.find(category => category.id === filters.category_id);
        if (!category || printing) return;
        setPrintError('');
        setPrinting(true);
        try {
            const rows = await inventoryService.getCategoryStockReport(category.id, categorySubtreeIds(categories, category.id));
            if (!rows.length) {
                setPrintError('Esta categoria não possui estoque disponível para imprimir.');
                return;
            }
            setReportReady(false);
            setReport({ rows, categoryName: category.name, generatedAt: new Date() });
        } catch {
            setPrintError('Não foi possível consultar o estoque completo. Tente novamente.');
        } finally {
            setPrinting(false);
        }
    };

    const handlePrintReport = () => {
        try {
            const frame = reportFrameRef.current?.contentWindow;
            if (!frame || !reportReady) return;
            frame.focus();
            frame.print();
        } catch {
            setPrintError('A impressão não está disponível neste navegador. Abra o sistema no Chrome para imprimir.');
        }
    };

    const handleAdjustStock = (group: InventoryGroup) => {
        setSelectedGroup(group);
        setShowAdjustModal(true);
    };

    const handleConfirmAdjustment = async (adjustment: any) => {
        if (!selectedGroup) return;

        try {
            // For serialized products, we can't adjust stock directly
            // This would need to change unit status instead
            if (selectedGroup.is_serialized) {
                alert('⚠️ Para produtos serializados, use o modal de unidades para alterar status.');
                return;
            }

            // For non-serialized, adjust the single product
            // Note: This assumes non-serialized groups have only one product
            // In a real implementation, you'd need to track the product ID
            alert('⚠️ Ajuste de estoque para produtos não serializados em desenvolvimento.');

            // Reload data
            await loadData();
        } catch (error) {
            console.error('Error adjusting stock:', error);
            alert('❌ Erro ao ajustar estoque. Tente novamente.');
        }
    };

    const handleViewHistory = (group: InventoryGroup) => {
        // TODO: Implement history modal
        console.log('View history for:', group.name);
        alert('Histórico em desenvolvimento');
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                        <Package size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Gestão de Estoque</h1>
                        <p className="text-sm text-slate-500">Consulte os produtos, confira as unidades e imprima o estoque por categoria.</p>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-700">Resumo geral do estoque</summary>
                <div className="border-t border-slate-100 p-5"><InventoryStats stats={stats} loading={loading} /></div>
            </details>

            {/* Filters */}
            <InventoryFilters
                filters={filters}
                onFiltersChange={setFilters}
                categories={categories}
                brands={brands}
            />

            <section aria-label="Impressão do estoque" className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Printer size={20} /></div>
                        <div><h2 className="text-sm font-semibold text-slate-900">Relatório para conferência</h2>
                            <p className="mt-1 text-xs text-slate-500">{categories.find(category => category.id === filters.category_id)?.name || 'Selecione uma categoria nos filtros acima'} · Estoque disponível, seriais e IMEIs</p>
                        </div>
                    </div>
                    <button type="button" onClick={handlePrintCategory}
                        disabled={!filters.category_id || printing}
                        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed">
                        <Printer size={16} />
                        {printing ? 'Consultando estoque...' : 'Imprimir estoque da categoria'}
                    </button>
                </div>
                <fieldset className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <legend className="sr-only">Valores na impressão</legend>
                    <span className="text-xs font-semibold text-slate-500">Valores na impressão</span>
                    <label className="inline-flex cursor-pointer items-center gap-2">
                        <input type="radio" name="report-values" checked={!Object.values(reportOptions).some(Boolean)} onChange={() => {
                            setReportReady(false);
                            setReportOptions({ showPurchaseCost: false, showAverageCost: false, showSalePrice: false });
                        }} className="accent-blue-600" />Sem valores
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-2">
                        <input type="radio" name="report-values" checked={Object.values(reportOptions).some(Boolean)} onChange={() => {
                            setReportReady(false);
                            setReportOptions({ showPurchaseCost: true, showAverageCost: true, showSalePrice: true });
                        }} className="accent-blue-600" />Com valores
                    </label>
                </fieldset>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm text-slate-700">
                    {([
                        ['showPurchaseCost', 'Mostrar valor de compra'],
                        ['showAverageCost', 'Mostrar preço médio de compra'],
                        ['showSalePrice', 'Mostrar venda atual à vista'],
                    ] as const).map(([key, label]) => <label key={key} className={`inline-flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${reportOptions[key] ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 hover:bg-slate-50'}`}>
                        <input type="checkbox" checked={reportOptions[key]} onChange={event => {
                            setReportReady(false);
                            setReportOptions(current => ({ ...current, [key]: event.target.checked }));
                        }} className="h-4 w-4 shrink-0 accent-blue-600" />{label}
                    </label>)}
                </div>
                <p className="text-xs text-slate-500">Inclui a categoria e suas subcategorias; os demais filtros da tabela não limitam o relatório.</p>
                {printError && <p role="alert" className="text-sm text-red-600">{printError}</p>}
            </section>

            {report && <div className="fixed inset-0 z-50 bg-black/50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="stock-report-title">
                <div className="flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-xl">
                    <div className="flex items-center justify-between gap-3 border-b p-4">
                        <h2 id="stock-report-title" className="font-semibold text-slate-900">Relatório de estoque — {report.categoryName}</h2>
                        <div className="flex gap-2">
                            <button type="button" disabled={!reportReady} onClick={handlePrintReport} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:bg-slate-300"><Printer size={16} />Imprimir relatório</button>
                            <button type="button" aria-label="Fechar relatório" onClick={() => setReport(null)} className="rounded-lg p-2 hover:bg-slate-100"><X size={20} /></button>
                        </div>
                    </div>
                    <iframe ref={reportFrameRef} title="Prévia do relatório de estoque" srcDoc={reportHtml} onLoad={() => setReportReady(true)} className="min-h-0 w-full flex-1 border-0 bg-white" />
                    {printError && <p role="alert" className="p-3 text-sm text-red-600">{printError}</p>}
                </div>
            </div>}

            {/* Table */}
            <InventoryTable
                groups={groups}
                onViewUnits={handleViewUnits}
                onAdjustStock={handleAdjustStock}
                onViewHistory={handleViewHistory}
                loading={loading}
            />

            {/* Serialized Units Modal */}
            <SerializedUnitsModal
                group={selectedGroup}
                isOpen={showUnitsModal}
                onClose={() => setShowUnitsModal(false)}
                onReload={loadData}
            />

            {/* Adjustment Modal */}
            <StockAdjustmentModal
                product={selectedGroup as any}
                isOpen={showAdjustModal}
                onClose={() => setShowAdjustModal(false)}
                onConfirm={handleConfirmAdjustment}
            />
        </div>
    );
}
