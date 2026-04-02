/**
 * SerializedUnitsPage — Gestão de Unidades Serializadas (IMEI/Serial)
 * Rota: /admin/serializados
 *
 * Funcionalidades:
 * - Listar todas as unidades por status (available, reserved, sold)
 * - Filtrar por produto, status, IMEI/Serial
 * - Trocar unidade reservada antes da entrega (com motivo)
 * - Confirmar entrega → libera documentos ao cliente
 * - Histórico de trocas por pedido
 */
import { useState, useEffect, useCallback } from 'react';
import { unitService } from '@/services/units';
import { supabase } from '@/services/supabase';
import type { Unit } from '@/types/unit';
import { UnitStatus } from '@/utils/field-standards';
import {
    Smartphone, Search, RefreshCw, Loader2, ArrowLeftRight,
    CheckCircle2, Clock, Package, ChevronDown, ChevronUp,
    X, AlertTriangle, History, Cpu
} from 'lucide-react';

// ─── Tipos locais ─────────────────────────────────────────────────────────────

interface UnitWithProduct extends Unit {
    product_name?: string;
    product_sku?: string;
}

interface SwapLog {
    id: string;
    order_id: string | null;
    sale_id: string | null;
    old_unit_id: string;
    new_unit_id: string;
    reason: string;
    swapped_by: string | null;
    created_at: string;
    old_unit?: { imei_1?: string; imei_2?: string; serial?: string };
    new_unit?: { imei_1?: string; imei_2?: string; serial?: string };
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
    available: 'Disponível',
    reserved: 'Reservada',
    sold: 'Entregue',
    scrapped: 'Descartada',
    rma: 'RMA',
};

const STATUS_COLOR: Record<string, string> = {
    available: 'bg-green-100 text-green-800',
    reserved: 'bg-amber-100 text-amber-800',
    sold: 'bg-blue-100 text-blue-800',
    scrapped: 'bg-red-100 text-red-800',
    rma: 'bg-orange-100 text-orange-800',
};

const STATUS_ICON: Record<string, JSX.Element> = {
    available: <CheckCircle2 className="w-3.5 h-3.5" />,
    reserved: <Clock className="w-3.5 h-3.5" />,
    sold: <Package className="w-3.5 h-3.5" />,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUnitIdentifier(unit: UnitWithProduct): string {
    return unit.imei_1 || unit.imei_2 || unit.serial || unit.id.slice(0, 8);
}

function formatDate(iso?: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

// ─── Modal: Trocar Unidade ────────────────────────────────────────────────────

function SwapUnitModal({
    currentUnit,
    orderId,
    availableUnits,
    onConfirm,
    onClose,
    loading,
}: {
    currentUnit: UnitWithProduct;
    orderId?: string;
    availableUnits: UnitWithProduct[];
    onConfirm: (newUnitId: string, reason: string) => void;
    onClose: () => void;
    loading: boolean;
}) {
    const [selectedUnitId, setSelectedUnitId] = useState('');
    const [reason, setReason] = useState('');

    const eligible = availableUnits.filter(
        u => u.product_id === currentUnit.product_id && u.id !== currentUnit.id
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b">
                    <div className="flex items-center gap-2 text-amber-700">
                        <ArrowLeftRight className="w-5 h-5" />
                        <span className="font-semibold">Trocar Aparelho</span>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Unidade atual */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <p className="text-xs text-amber-700 font-medium mb-1">Unidade atual (será liberada):</p>
                        <p className="text-sm font-mono font-semibold text-gray-800">{getUnitIdentifier(currentUnit)}</p>
                        {currentUnit.product_name && (
                            <p className="text-xs text-gray-500 mt-0.5">{currentUnit.product_name}</p>
                        )}
                    </div>

                    {/* Selecionar nova unidade */}
                    <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1.5">
                            Nova unidade (disponível)
                        </label>
                        {eligible.length === 0 ? (
                            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                Nenhuma outra unidade disponível para este produto.
                            </div>
                        ) : (
                            <select
                                value={selectedUnitId}
                                onChange={e => setSelectedUnitId(e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                            >
                                <option value="">Selecione...</option>
                                {eligible.map(u => (
                                    <option key={u.id} value={u.id}>
                                        {getUnitIdentifier(u)}
                                        {u.imei_2 ? ` / ${u.imei_2}` : ''}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Motivo */}
                    <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1.5">
                            Motivo da troca *
                        </label>
                        <textarea
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="Ex: defeito na câmera, tela ranhada, divergência de IMEI..."
                            rows={3}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                        />
                    </div>
                </div>

                <div className="flex gap-3 p-5 pt-0">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => onConfirm(selectedUnitId, reason)}
                        disabled={!selectedUnitId || !reason.trim() || loading || eligible.length === 0}
                        className="flex-1 px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
                        Confirmar Troca
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Componente: Linha de Unidade ─────────────────────────────────────────────

function UnitRow({
    unit,
    onSwap,
    onConfirmDelivery,
    actionLoading,
    showSwapBtn,
}: {
    unit: UnitWithProduct;
    onSwap: (unit: UnitWithProduct) => void;
    onConfirmDelivery: (unit: UnitWithProduct) => void;
    actionLoading: string | null;
    showSwapBtn: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const isLoading = actionLoading === unit.id;

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(e => !e)}
            >
                {/* Ícone status */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    unit.status === UnitStatus.AVAILABLE ? 'bg-green-100' :
                    unit.status === UnitStatus.RESERVED ? 'bg-amber-100' : 'bg-blue-100'
                }`}>
                    <Cpu className={`w-4 h-4 ${
                        unit.status === UnitStatus.AVAILABLE ? 'text-green-700' :
                        unit.status === UnitStatus.RESERVED ? 'text-amber-700' : 'text-blue-700'
                    }`} />
                </div>

                {/* Info principal */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-sm text-gray-800">
                            {getUnitIdentifier(unit)}
                        </span>
                        {unit.imei_2 && (
                            <span className="text-xs text-gray-400 font-mono">IMEI2: {unit.imei_2}</span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${STATUS_COLOR[unit.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {STATUS_ICON[unit.status]}
                            {STATUS_LABEL[unit.status] ?? unit.status}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {unit.product_name || unit.product_id}
                        {unit.product_sku && <span className="ml-1 font-mono text-gray-400">· {unit.product_sku}</span>}
                    </p>
                </div>

                {/* Ações rápidas */}
                <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    {/* Trocar — apenas unidades reservadas */}
                    {unit.status === UnitStatus.RESERVED && showSwapBtn && (
                        <button
                            onClick={() => onSwap(unit)}
                            disabled={isLoading}
                            title="Trocar aparelho"
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50"
                        >
                            <ArrowLeftRight className="w-4 h-4" />
                        </button>
                    )}

                    {/* Confirmar entrega — apenas reservadas */}
                    {unit.status === UnitStatus.RESERVED && (
                        <button
                            onClick={() => onConfirmDelivery(unit)}
                            disabled={isLoading}
                            title="Confirmar entrega e liberar documentos"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Entreguei
                        </button>
                    )}

                    {/* Expand */}
                    <button className="text-gray-300 hover:text-gray-500">
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Detalhes expandidos */}
            {expanded && (
                <div className="border-t border-gray-100 px-4 pb-4 pt-3 bg-gray-50">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        {unit.imei_1 && (
                            <div>
                                <p className="text-gray-500 font-medium">IMEI 1</p>
                                <p className="font-mono mt-0.5">{unit.imei_1}</p>
                            </div>
                        )}
                        {unit.imei_2 && (
                            <div>
                                <p className="text-gray-500 font-medium">IMEI 2</p>
                                <p className="font-mono mt-0.5">{unit.imei_2}</p>
                            </div>
                        )}
                        {unit.serial && (
                            <div>
                                <p className="text-gray-500 font-medium">Serial</p>
                                <p className="font-mono mt-0.5">{unit.serial}</p>
                            </div>
                        )}
                        {unit.condition && (
                            <div>
                                <p className="text-gray-500 font-medium">Condição</p>
                                <p className="mt-0.5 capitalize">{unit.condition}</p>
                            </div>
                        )}
                        {unit.order_id && (
                            <div>
                                <p className="text-gray-500 font-medium">Pedido</p>
                                <p className="font-mono mt-0.5">#{unit.order_id.slice(0, 8)}</p>
                            </div>
                        )}
                        {unit.reserved_at && (
                            <div>
                                <p className="text-gray-500 font-medium">Reservado em</p>
                                <p className="mt-0.5">{formatDate(unit.reserved_at)}</p>
                            </div>
                        )}
                        {unit.sold_at && (
                            <div>
                                <p className="text-gray-500 font-medium">Entregue em</p>
                                <p className="mt-0.5">{formatDate(unit.sold_at)}</p>
                            </div>
                        )}
                        <div>
                            <p className="text-gray-500 font-medium">Cadastrado</p>
                            <p className="mt-0.5">{formatDate(unit.createdAt)}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function SerializedUnitsPage() {
    const [units, setUnits] = useState<UnitWithProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Modal de troca
    const [swapTarget, setSwapTarget] = useState<UnitWithProduct | null>(null);

    // Histórico de trocas
    const [swapLogs, setSwapLogs] = useState<SwapLog[]>([]);
    const [showLogs, setShowLogs] = useState(false);
    const [logsLoading, setLogsLoading] = useState(false);

    // ─── Carregar unidades ──────────────────────────────────────────────────

    const loadUnits = useCallback(async () => {
        setLoading(true);
        try {
            const companyId = await getCompanyId();

            let query = supabase
                .from('units')
                .select('*, product:products(name, sku)')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false });

            if (filterStatus) {
                query = query.eq('status', filterStatus);
            }

            const { data, error } = await query;
            if (error) throw error;

            const mapped: UnitWithProduct[] = (data || []).map((row: any) => ({
                id: row.id,
                companyId: row.company_id,
                productId: row.product_id,
                product_id: row.product_id,
                imei_1: row.imei_1,
                imei_2: row.imei_2,
                serial: row.serial,
                status: row.status,
                condition: row.condition,
                cost_price: row.cost_price,
                order_id: row.order_id,
                sale_id: row.sale_id,
                reserved_at: row.reserved_at,
                sold_at: row.sold_at,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                product_name: row.product?.name,
                product_sku: row.product?.sku,
            }));

            setUnits(mapped);
        } catch (err: any) {
            console.error('[SerializedUnitsPage] Erro ao carregar:', err);
        } finally {
            setLoading(false);
        }
    }, [filterStatus]);

    useEffect(() => { loadUnits(); }, [loadUnits]);

    // ─── Carregar histórico de trocas ───────────────────────────────────────

    const loadSwapLogs = async () => {
        setLogsLoading(true);
        try {
            const { data, error } = await supabase
                .from('unit_swap_logs')
                .select(`
                    *,
                    old_unit:units!unit_swap_logs_old_unit_id_fkey(imei_1, imei_2, serial),
                    new_unit:units!unit_swap_logs_new_unit_id_fkey(imei_1, imei_2, serial)
                `)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setSwapLogs((data || []) as SwapLog[]);
        } catch (err) {
            console.error('[SerializedUnitsPage] Erro ao carregar logs:', err);
        } finally {
            setLogsLoading(false);
        }
    };

    const handleToggleLogs = () => {
        if (!showLogs && swapLogs.length === 0) loadSwapLogs();
        setShowLogs(s => !s);
    };

    // ─── Trocar unidade ─────────────────────────────────────────────────────

    const handleSwapConfirm = async (newUnitId: string, reason: string) => {
        if (!swapTarget) return;
        setActionLoading(swapTarget.id);
        try {
            await unitService.swapUnit({
                currentUnitId: swapTarget.id,
                newUnitId,
                orderId: swapTarget.order_id || undefined,
                saleId: swapTarget.sale_id || undefined,
                reason,
                swappedBy: 'admin',
            });
            setSwapTarget(null);
            await loadUnits();
            // Recarrega logs se estiver visível
            if (showLogs) loadSwapLogs();
        } catch (err: any) {
            alert(`Erro ao trocar unidade: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    // ─── Confirmar entrega ──────────────────────────────────────────────────

    const handleConfirmDelivery = async (unit: UnitWithProduct) => {
        const ok = window.confirm(
            `Confirmar entrega da unidade:\n${getUnitIdentifier(unit)}\n\nIsto marcará como VENDIDA e liberará os documentos ao cliente (IMEI, comprovante, garantia).`
        );
        if (!ok) return;

        setActionLoading(unit.id);
        try {
            await unitService.markAsSold(unit.id);

            // Se houver order_id, libera serialized_docs_released
            if (unit.order_id) {
                await supabase
                    .from('orders')
                    .update({ serialized_docs_released: true })
                    .eq('id', unit.order_id);
            }

            await loadUnits();
        } catch (err: any) {
            alert(`Erro ao confirmar entrega: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    // ─── Filtros ────────────────────────────────────────────────────────────

    const filtered = units.filter(u => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
            (u.imei_1 || '').includes(s) ||
            (u.imei_2 || '').includes(s) ||
            (u.serial || '').toLowerCase().includes(s) ||
            (u.product_name || '').toLowerCase().includes(s) ||
            (u.product_sku || '').toLowerCase().includes(s) ||
            (u.order_id || '').includes(s)
        );
    });

    // ─── Estatísticas ───────────────────────────────────────────────────────

    const stats = {
        available: units.filter(u => u.status === UnitStatus.AVAILABLE).length,
        reserved: units.filter(u => u.status === UnitStatus.RESERVED).length,
        sold: units.filter(u => u.status === UnitStatus.SOLD).length,
    };

    // ─── Render ─────────────────────────────────────────────────────────────

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Smartphone className="w-6 h-6 text-blue-600" />
                        Unidades Serializadas
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Gestão de IMEI e Serial — Celulares, Tablets e Receptores
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleToggleLogs}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-600"
                    >
                        <History className="w-4 h-4" />
                        Histórico de Trocas
                    </button>
                    <button
                        onClick={loadUnits}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Atualizar
                    </button>
                </div>
            </div>

            {/* Estatísticas */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Disponíveis', count: stats.available, color: 'border-l-green-500', textColor: 'text-green-700' },
                    { label: 'Reservadas', count: stats.reserved, color: 'border-l-amber-500', textColor: 'text-amber-700' },
                    { label: 'Entregues', count: stats.sold, color: 'border-l-blue-500', textColor: 'text-blue-700' },
                ].map(s => (
                    <div key={s.label} className={`bg-white rounded-xl border border-gray-100 border-l-4 ${s.color} shadow-sm p-4`}>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{s.label}</p>
                        <p className={`text-2xl font-bold mt-1 ${s.textColor}`}>{s.count}</p>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        placeholder="Buscar por IMEI, Serial, produto ou pedido..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                </div>
                <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                >
                    <option value="">Todos os status</option>
                    {Object.entries(STATUS_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                    ))}
                </select>
            </div>

            {/* Histórico de Trocas (colapsável) */}
            {showLogs && (
                <div className="mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3 border-b bg-gray-50">
                        <History className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-sm text-gray-700">Histórico de Trocas Recentes</span>
                        {logsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 ml-auto" />}
                    </div>
                    {swapLogs.length === 0 && !logsLoading ? (
                        <p className="text-sm text-gray-500 p-5 text-center">Nenhuma troca registrada.</p>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {swapLogs.map(log => {
                                const oldId = log.old_unit?.imei_1 || log.old_unit?.serial || log.old_unit_id.slice(0, 8);
                                const newId = log.new_unit?.imei_1 || log.new_unit?.serial || log.new_unit_id.slice(0, 8);
                                return (
                                    <div key={log.id} className="px-5 py-3 text-xs flex items-start gap-3">
                                        <ArrowLeftRight className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-gray-800">
                                                <span className="font-mono line-through text-red-500">{oldId}</span>
                                                {' → '}
                                                <span className="font-mono text-green-700 font-semibold">{newId}</span>
                                            </p>
                                            <p className="text-gray-500 mt-0.5 truncate">{log.reason}</p>
                                            {log.order_id && (
                                                <p className="text-gray-400">Pedido: #{log.order_id.slice(0, 8)}</p>
                                            )}
                                        </div>
                                        <span className="text-gray-400 whitespace-nowrap flex-shrink-0">
                                            {formatDate(log.created_at)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Lista de unidades */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-25" />
                    <p className="text-sm">Nenhuma unidade encontrada.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(unit => (
                        <UnitRow
                            key={unit.id}
                            unit={unit}
                            onSwap={u => setSwapTarget(u)}
                            onConfirmDelivery={handleConfirmDelivery}
                            actionLoading={actionLoading}
                            showSwapBtn={true}
                        />
                    ))}
                    <p className="text-xs text-gray-400 text-center pt-2">
                        {filtered.length} de {units.length} unidades
                    </p>
                </div>
            )}

            {/* Modal de troca */}
            {swapTarget && (
                <SwapUnitModal
                    currentUnit={swapTarget}
                    orderId={swapTarget.order_id || undefined}
                    availableUnits={units.filter(u => u.status === UnitStatus.AVAILABLE)}
                    onConfirm={handleSwapConfirm}
                    onClose={() => setSwapTarget(null)}
                    loading={actionLoading === swapTarget.id}
                />
            )}
        </div>
    );
}

// ─── Helper getCompanyId (local) ─────────────────────────────────────────────

async function getCompanyId(): Promise<string> {
    const { data, error } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', 'mercado-do-vale')
        .single();
    if (error || !data) throw new Error('Empresa não encontrada.');
    return data.id;
}
