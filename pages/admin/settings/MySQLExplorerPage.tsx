import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
    Database, Table, ChevronDown, ChevronRight, RefreshCw, Search,
    Rows, LayoutList, Plus, Trash2, Pencil, Upload, Download, X, Save, AlertTriangle
} from 'lucide-react';

const VPS_API = 'https://api.xiaomipetrolina.com.br';
const SYNC_KEY = import.meta.env.VITE_VPS_SYNC_KEY || '';
const PAGE_SIZE = 50;

// Tabelas somente-leitura (sistema interno — sem CRUD)
const READONLY_TABLES = new Set([
    'migrations', 'schema_migrations', 'sessions', 'knex_migrations', 'knex_migrations_lock'
]);

interface Column { field: string; type: string; null: string; key: string; default: string | null; }
interface TableData { total: number; limit: number; offset: number; rows: Record<string, any>[]; }
type Schema = Record<string, Column[]>;
type Tab = 'schema' | 'data';

// ─── API helpers ──────────────────────────────────────────────────────────────
async function apiFetch(path: string, options?: RequestInit) {
    const r = await fetch(`${VPS_API}${path}`, {
        ...options,
        headers: { 'x-sync-key': SYNC_KEY, 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    });
    if (!r.ok) {
        const err = await r.json().catch(() => ({ error: r.statusText }));
        throw new Error(err.error || `HTTP ${r.status}`);
    }
    return r.json();
}

function getPkCol(cols: Column[]): string {
    return cols.find(c => c.key === 'PRI')?.field || 'id';
}

// ─── Components ───────────────────────────────────────────────────────────────

function KeyBadge({ k }: { k: string }) {
    if (k === 'PRI') return <span title="Primary Key — identificador único" className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded font-mono font-bold">PK</span>;
    if (k === 'MUL') return <span title="Foreign Key / índice" className="px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded font-mono font-bold">FK</span>;
    if (k === 'UNI') return <span title="Unique — valor único" className="px-1.5 py-0.5 text-[10px] bg-green-100 text-green-700 rounded font-mono font-bold">UQ</span>;
    return null;
}

function SchemaView({ cols }: { cols: Column[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
                    <tr>
                        <th className="px-4 py-2 text-left">Campo</th>
                        <th className="px-4 py-2 text-left">Tipo</th>
                        <th className="px-4 py-2 text-left">Nulo</th>
                        <th className="px-4 py-2 text-left">Key</th>
                        <th className="px-4 py-2 text-left">Default</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {cols.map(col => (
                        <tr key={col.field} className="hover:bg-slate-50">
                            <td className="px-4 py-2 font-mono text-slate-800 font-medium">{col.field}</td>
                            <td className="px-4 py-2 font-mono text-indigo-600">{col.type}</td>
                            <td className="px-4 py-2 text-slate-400">{col.null}</td>
                            <td className="px-4 py-2"><KeyBadge k={col.key} /></td>
                            <td className="px-4 py-2 font-mono text-slate-400 text-[11px]">
                                {col.default ?? <span className="italic text-slate-300">null</span>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Row Form Modal (insert & edit) ──────────────────────────────────────────
function RowModal({ cols, initial, onSave, onClose, mode }: {
    cols: Column[];
    initial?: Record<string, any>;
    onSave: (data: Record<string, any>) => Promise<void>;
    onClose: () => void;
    mode: 'insert' | 'edit';
}) {
    const [form, setForm] = useState<Record<string, string>>(() => {
        const f: Record<string, string> = {};
        cols.forEach(c => { f[c.field] = initial ? String(initial[c.field] ?? '') : ''; });
        return f;
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pkCol = getPkCol(cols);

    const handleSave = async () => {
        setSaving(true); setError(null);
        try {
            const payload: Record<string, any> = {};
            cols.forEach(c => {
                if (mode === 'edit' && c.field === pkCol) return; // não mudar PK
                const v = form[c.field];
                payload[c.field] = v === '' ? null : v;
            });
            await onSave(payload);
            onClose();
        } catch (e: any) { setError(e.message); }
        finally { setSaving(false); }
    };

    // Ocultar PK em insert (auto-gerado) e edit (não editável)
    const editableCols = cols.filter(c => c.field !== pkCol);

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h3 className="font-bold text-slate-800">
                        {mode === 'insert' ? '+ Nova linha' : '✏️ Editar linha'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>
                <div className="overflow-y-auto px-6 py-4 space-y-3 flex-1">
                    {mode === 'edit' && initial?.[pkCol] !== undefined && (
                        <div className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
                            <span className="font-mono font-semibold">{pkCol}</span>: {initial[pkCol]}
                            <span className="ml-2 text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-semibold">PK — gerado automaticamente</span>
                        </div>
                    )}
                    {mode === 'insert' && (
                        <div className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
                            <span className="font-mono font-semibold">{pkCol}</span>: <span className="italic">gerado automaticamente pelo servidor</span>
                        </div>
                    )}
                    {editableCols.map(col => (
                        <div key={col.field}>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                                {col.field} <span className="font-normal text-slate-400 font-mono">({col.type})</span>
                                {col.null === 'NO' && <span className="text-red-400 ml-1">*</span>}
                            </label>
                            <input
                                value={form[col.field] ?? ''}
                                onChange={e => setForm(f => ({ ...f, [col.field]: e.target.value }))}
                                placeholder={col.default ? `default: ${col.default}` : col.null === 'YES' ? 'null' : ''}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                        </div>
                    ))}
                    {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                </div>
                <div className="flex justify-end gap-2 px-6 py-4 border-t">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Bulk Insert Modal (XLS) ──────────────────────────────────────────────────
function BulkModal({ tableName, cols, onClose, onSuccess }: {
    tableName: string; cols: Column[];
    onClose: () => void; onSuccess: () => void;
}) {
    const [rows, setRows] = useState<Record<string, any>[] | null>(null);
    const [fileName, setFileName] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const pkCol = getPkCol(cols);

    // Colunas do template = todas exceto PK (auto-gerado)
    const templateCols = cols.filter(c => c.field !== pkCol);

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        setError(null); setResult(null);
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const wb = XLSX.read(ev.target!.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: null });
                if (!data.length) throw new Error('Planilha vazia ou sem dados');
                setRows(data);
            } catch (err: any) { setError(err.message); }
        };
        reader.readAsArrayBuffer(file);
    };

    const downloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([templateCols.map(c => c.field)]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, tableName);
        XLSX.writeFile(wb, `template_${tableName}.xlsx`);
    };

    const handleImport = async () => {
        if (!rows) return;
        setSaving(true); setError(null); setResult(null);
        try {
            const res = await apiFetch(`/table-data/${tableName}/bulk`, {
                method: 'POST', body: JSON.stringify(rows),
            });
            setResult(`✅ ${res.inserted} registros inseridos com sucesso!`);
            onSuccess();
        } catch (e: any) { setError(e.message); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h3 className="font-bold text-slate-800">📥 Importar planilha — <span className="font-mono text-indigo-600">{tableName}</span></h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>
                <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
                    <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 space-y-1">
                        <p>• O arquivo deve ser <strong>.xlsx</strong> ou <strong>.xls</strong></p>
                        <p>• A primeira linha deve conter os nomes das colunas</p>
                        <p>• O campo <span className="font-mono text-amber-600">{pkCol}</span> (ID) não precisa constar — será gerado automaticamente</p>
                    </div>

                    <button onClick={downloadTemplate}
                        className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-indigo-300 text-indigo-600 rounded-xl text-sm hover:bg-indigo-50 transition-colors">
                        <Download size={14} /> Baixar template vazio (.xlsx)
                    </button>

                    <div>
                        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
                        <button onClick={() => fileRef.current?.click()}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm text-slate-700 transition-colors">
                            <Upload size={14} /> {fileName || 'Selecionar arquivo .xlsx'}
                        </button>
                    </div>

                    {rows && (
                        <div className="text-xs bg-green-50 text-green-700 rounded-lg px-3 py-2">
                            ✅ <strong>{rows.length}</strong> linhas lidas. Colunas: {Object.keys(rows[0]).join(', ')}
                        </div>
                    )}
                    {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                    {result && <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">{result}</p>}
                </div>
                <div className="flex justify-end gap-2 px-6 py-4 border-t">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Fechar</button>
                    <button
                        onClick={handleImport}
                        disabled={saving || !rows}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        {saving ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
                        {saving ? 'Importando...' : `Importar ${rows ? rows.length + ' linhas' : ''}`}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Delete Confirm ────────────────────────────────────────────────────────────
function DeleteConfirm({ onConfirm, onCancel, busy }: { onConfirm: () => void; onCancel: () => void; busy: boolean }) {
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
                <div className="flex items-center gap-3 text-red-600">
                    <AlertTriangle size={20} />
                    <h3 className="font-bold">Excluir linha?</h3>
                </div>
                <p className="text-sm text-slate-500">Esta ação é irreversível. O registro será removido permanentemente do banco.</p>
                <div className="flex justify-end gap-2">
                    <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                    <button
                        onClick={onConfirm}
                        disabled={busy}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                        {busy ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        {busy ? 'Excluindo...' : 'Excluir'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── DataView ─────────────────────────────────────────────────────────────────
function DataView({ tableName, cols }: { tableName: string; cols: Column[] }) {
    const [data, setData] = useState<TableData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [offset, setOffset] = useState(0);
    const [editRow, setEditRow] = useState<Record<string, any> | null>(null);
    const [deleteRow, setDeleteRow] = useState<Record<string, any> | null>(null);
    const [showInsert, setShowInsert] = useState(false);
    const [showBulk, setShowBulk] = useState(false);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    const readonly = READONLY_TABLES.has(tableName);
    const pkCol = getPkCol(cols);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    const load = useCallback(async (off: number) => {
        setLoading(true); setError(null);
        try {
            const result = await apiFetch(`/table-data/${tableName}?limit=${PAGE_SIZE}&offset=${off}`);
            setData(result);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    }, [tableName]);

    useEffect(() => { load(0); setOffset(0); }, [tableName]);
    useEffect(() => {
        const t = setInterval(() => load(offset), 30000);
        return () => clearInterval(t);
    }, [load, offset]);

    const goTo = (o: number) => { setOffset(o); load(o); };

    const handleInsert = async (payload: Record<string, any>) => {
        await apiFetch(`/table-data/${tableName}`, { method: 'POST', body: JSON.stringify(payload) });
        showToast('✅ Linha inserida com sucesso!');
        load(offset);
    };

    const handleEdit = async (payload: Record<string, any>) => {
        const pkVal = editRow![pkCol];
        await apiFetch(`/table-data/${tableName}/${pkVal}?pk=${pkCol}`, { method: 'PATCH', body: JSON.stringify(payload) });
        showToast('✅ Linha atualizada com sucesso!');
        load(offset);
    };

    const handleDelete = async () => {
        setDeleteBusy(true);
        try {
            await apiFetch(`/table-data/${tableName}/${deleteRow![pkCol]}?pk=${pkCol}`, { method: 'DELETE' });
            showToast('✅ Linha excluída!');
            setDeleteRow(null);
            load(offset);
        } catch (e: any) { showToast(`❌ ${e.message}`); }
        finally { setDeleteBusy(false); }
    };

    const handleExport = async () => {
        try {
            const exportedRows = await apiFetch(`/table-data/${tableName}/export`);
            const ws = XLSX.utils.json_to_sheet(exportedRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, tableName);
            XLSX.writeFile(wb, `${tableName}_backup.xlsx`);
            showToast(`✅ Exportado: ${tableName}_backup.xlsx (${exportedRows.length} linhas)`);
        } catch (e: any) { showToast(`❌ ${e.message}`); }
    };

    if (!data && loading) return (
        <div className="p-6 flex items-center justify-center gap-2 text-slate-400 text-sm">
            <RefreshCw size={14} className="animate-spin" /> Carregando dados...
        </div>
    );

    if (error) return <div className="p-4 text-sm text-red-600 bg-red-50">Erro: {error}</div>;
    if (!data) return null;

    const dataCols = data.rows.length > 0 ? Object.keys(data.rows[0]) : cols.map(c => c.field);
    const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
    const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

    return (
        <div className="relative">
            {/* Toast */}
            {toast && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-slate-800 text-white text-xs px-4 py-2 rounded-full shadow-lg animate-in fade-in">
                    {toast}
                </div>
            )}

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span><strong>{data.total.toLocaleString()}</strong> registros</span>
                    {loading && <RefreshCw size={10} className="animate-spin text-indigo-400" />}
                    {readonly && (
                        <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full text-[10px] font-semibold">só-leitura</span>
                    )}
                </div>

                <div className="flex items-center gap-1.5">
                    {/* Paginação */}
                    {(['«', '‹', null, '›', '»'] as const).map((btn, i) => (
                        btn === null ? (
                            <span key="page" className="text-xs px-2 text-slate-500">
                                {currentPage} / {pages}
                            </span>
                        ) : (
                            <button
                                key={btn}
                                onClick={() => {
                                    if (btn === '«') goTo(0);
                                    else if (btn === '‹') goTo(Math.max(0, offset - PAGE_SIZE));
                                    else if (btn === '›') goTo(offset + PAGE_SIZE);
                                    else goTo((pages - 1) * PAGE_SIZE);
                                }}
                                disabled={loading || (btn === '«' || btn === '‹' ? offset === 0 : offset + PAGE_SIZE >= data.total)}
                                className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-200 disabled:opacity-30 text-sm transition-colors"
                            >{btn}</button>
                        )
                    ))}

                    <div className="w-px h-5 bg-slate-200 mx-0.5" />

                    {/* Ações */}
                    <button onClick={() => load(offset)} disabled={loading} title="Atualizar"
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-200 text-slate-500 transition-colors">
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={handleExport} title="Exportar JSON (backup)"
                        className="flex items-center gap-1 px-2 h-7 text-xs rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                        <Download size={11} /> Backup
                    </button>
                    {!readonly && (
                        <>
                            <button onClick={() => setShowBulk(true)} title="Importar em massa"
                                className="flex items-center gap-1 px-2 h-7 text-xs rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                                <Upload size={11} /> Importar
                            </button>
                            <button onClick={() => setShowInsert(true)} title="Nova linha"
                                className="flex items-center gap-1 px-2 h-7 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                                <Plus size={11} /> Nova linha
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Table */}
            {data.rows.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm italic">Tabela vazia</div>
            ) : (
                <div className="overflow-x-auto max-h-[28rem]">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-800 text-slate-200 text-[10px] uppercase tracking-wider sticky top-0 z-10">
                            <tr>
                                {dataCols.map(c => (
                                    <th key={c} className="px-3 py-2 text-left whitespace-nowrap font-mono">{c}</th>
                                ))}
                                {!readonly && <th className="px-3 py-2 text-center w-16">Ações</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {data.rows.map((row, i) => (
                                <tr key={i} className="hover:bg-indigo-50/50 transition-colors group">
                                    {dataCols.map(c => {
                                        const val = row[c];
                                        const str = val === null ? null : typeof val === 'object' ? JSON.stringify(val) : String(val);
                                        return (
                                            <td key={c} className="px-3 py-1.5 text-slate-700 font-mono max-w-[200px] overflow-hidden whitespace-nowrap">
                                                {str === null
                                                    ? <span className="italic text-slate-300">null</span>
                                                    : str.length > 55
                                                        ? <span title={str}>{str.slice(0, 55)}…</span>
                                                        : str}
                                            </td>
                                        );
                                    })}
                                    {!readonly && (
                                        <td className="px-2 py-1.5 text-center">
                                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => setEditRow(row)}
                                                    title="Editar"
                                                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-indigo-100 text-indigo-500 transition-colors"
                                                ><Pencil size={11} /></button>
                                                <button
                                                    onClick={() => setDeleteRow(row)}
                                                    title="Excluir"
                                                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-100 text-red-500 transition-colors"
                                                ><Trash2 size={11} /></button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="px-4 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400">
                Auto-atualiza a cada 30s · {offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} de {data.total}
            </div>

            {/* Modais */}
            {showInsert && (
                <RowModal cols={cols} mode="insert" onSave={handleInsert} onClose={() => setShowInsert(false)} />
            )}
            {editRow && (
                <RowModal cols={cols} initial={editRow} mode="edit" onSave={handleEdit} onClose={() => setEditRow(null)} />
            )}
            {deleteRow && (
                <DeleteConfirm onConfirm={handleDelete} onCancel={() => setDeleteRow(null)} busy={deleteBusy} />
            )}
            {showBulk && (
                <BulkModal tableName={tableName} cols={cols} onClose={() => setShowBulk(false)} onSuccess={() => load(offset)} />
            )}
        </div>
    );
}

// ─── Table Card ───────────────────────────────────────────────────────────────
function TableCard({ table, cols }: { table: string; cols: Column[] }) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<Tab>('schema');
    const readonly = READONLY_TABLES.has(table);

    return (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
            >
                <div className="flex items-center gap-3">
                    <Table size={16} className="text-indigo-400 shrink-0" />
                    <span className="font-mono font-semibold text-slate-800 text-sm">{table}</span>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{cols.length} cols</span>
                    {readonly && <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-semibold">só-leitura</span>}
                </div>
                {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
            </button>

            {open && (
                <div className="border-t border-slate-100">
                    <div className="flex border-b border-slate-100 bg-slate-50">
                        {(['schema', 'data'] as Tab[]).map(t => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors border-b-2 ${tab === t ? 'border-indigo-500 text-indigo-600 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                            >
                                {t === 'schema' ? <><LayoutList size={12} /> Schema</> : <><Rows size={12} /> Dados</>}
                            </button>
                        ))}
                    </div>
                    {tab === 'schema' && <SchemaView cols={cols} />}
                    {tab === 'data' && <DataView tableName={table} cols={cols} />}
                </div>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function MySQLExplorerPage() {
    const [schema, setSchema] = useState<Schema>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const load = async () => {
        setLoading(true); setError(null);
        try { setSchema(await apiFetch('/schema/tables')); }
        catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const tables = Object.keys(schema).filter(t =>
        !search || t.toLowerCase().includes(search.toLowerCase()) ||
        schema[t].some(c => c.field.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="animate-in fade-in duration-300 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Database size={22} className="text-indigo-500" /> MySQL Explorer
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Schema + dados em tempo real · <span className="font-mono bg-slate-100 px-1 rounded">mercadodovale</span> · VPS Hostinger
                    </p>
                </div>
                <button onClick={load} disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar tabela ou coluna..."
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
            </div>

            {/* Stats */}
            {!loading && !error && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'Tabelas', value: Object.keys(schema).length, color: 'bg-indigo-50 text-indigo-700' },
                        { label: 'Colunas totais', value: Object.values(schema).reduce((s, c) => s + c.length, 0), color: 'bg-blue-50 text-blue-700' },
                        { label: 'Exibidas', value: tables.length, color: 'bg-emerald-50 text-emerald-700' },
                        { label: 'Só-leitura', value: [...Object.keys(schema)].filter(t => READONLY_TABLES.has(t)).length, color: 'bg-orange-50 text-orange-700' },
                    ].map(s => (
                        <div key={s.label} className={`${s.color} rounded-xl px-4 py-3`}>
                            <p className="text-xs font-medium opacity-70">{s.label}</p>
                            <p className="text-xl font-bold">{s.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Legenda */}
            {!loading && !error && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3">
                    <p className="font-semibold text-slate-700 text-sm">Legenda</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-2">Chaves</p>
                            <div className="space-y-1.5 text-slate-600">
                                {([['PK', 'amber', 'Primary Key — ID único da linha'],
                                   ['FK', 'blue', 'Foreign Key / campo indexado'],
                                   ['UQ', 'green', 'Unique — valor não pode repetir']] as const).map(([b, c, d]) => (
                                    <div key={b} className="flex items-center gap-2">
                                        <span className={`px-1.5 py-0.5 bg-${c}-100 text-${c}-700 rounded font-mono font-bold shrink-0`}>{b}</span>
                                        <span>{d}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-2">Tipos comuns</p>
                            <div className="space-y-1.5 text-slate-600">
                                {[['varchar(N)', 'Texto curto'], ['tinyint(1)', 'Booleano (0/1)'],
                                  ['decimal(M,D)', 'Preços'], ['char(36)', 'UUID'],
                                  ['timestamp', 'Data e hora'], ['json', 'Objeto JSON']].map(([t, d]) => (
                                    <div key={t} className="flex gap-2">
                                        <span className="font-mono text-indigo-600 shrink-0">{t}</span>
                                        <span className="text-slate-500">{d}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-2">Ações disponíveis</p>
                            <div className="space-y-1.5 text-slate-600">
                                {[
                                    [<Plus size={11} />, 'Nova linha — inserir registro'],
                                    [<Upload size={11} />, 'Importar — bulk insert via JSON'],
                                    [<Download size={11} />, 'Backup — exportar tabela como .json'],
                                    [<Pencil size={11} />, 'Editar linha (hover na linha)'],
                                    [<Trash2 size={11} />, 'Excluir linha (hover na linha)'],
                                ].map(([icon, desc], i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="text-indigo-500 shrink-0">{icon as React.ReactNode}</span>
                                        <span>{desc as string}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">Erro: <span className="font-mono">{error}</span></div>}
            {loading && <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}</div>}

            {!loading && !error && (
                <div className="space-y-2">
                    {tables.map(t => <TableCard key={t} table={t} cols={schema[t]} />)}
                </div>
            )}
        </div>
    );
}
