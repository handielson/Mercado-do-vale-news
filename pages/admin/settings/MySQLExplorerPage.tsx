import React, { useState, useEffect, useCallback } from 'react';
import { Database, Table, ChevronDown, ChevronRight, RefreshCw, Search, Rows, LayoutList } from 'lucide-react';

const VPS_API = 'https://api.xiaomipetrolina.com.br';
const SYNC_KEY = import.meta.env.VITE_VPS_SYNC_KEY || '';
const PAGE_SIZE = 50;

interface Column { field: string; type: string; null: string; key: string; default: string | null; }
interface TableData { total: number; limit: number; offset: number; rows: Record<string, any>[]; }
type Schema = Record<string, Column[]>;
type Tab = 'schema' | 'data';

function apiFetch(path: string) {
    return fetch(`${VPS_API}${path}`, { headers: { 'x-sync-key': SYNC_KEY } }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
    });
}

function KeyBadge({ k }: { k: string }) {
    if (k === 'PRI') return <span className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded font-mono font-bold" title="Primary Key — identificador único">PK</span>;
    if (k === 'MUL') return <span className="px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded font-mono font-bold" title="Foreign Key / índice — referência ou campo indexado">FK</span>;
    if (k === 'UNI') return <span className="px-1.5 py-0.5 text-[10px] bg-green-100 text-green-700 rounded font-mono font-bold" title="Unique — valor não pode repetir">UQ</span>;
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

function DataView({ tableName }: { tableName: string }) {
    const [data, setData] = useState<TableData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [offset, setOffset] = useState(0);

    const load = useCallback(async (off = offset) => {
        setLoading(true);
        setError(null);
        try {
            const result = await apiFetch(`/table-data/${tableName}?limit=${PAGE_SIZE}&offset=${off}`);
            setData(result);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [tableName, offset]);

    useEffect(() => { load(0); setOffset(0); }, [tableName]);

    // Auto-refresh a cada 30s
    useEffect(() => {
        const timer = setInterval(() => load(offset), 30000);
        return () => clearInterval(timer);
    }, [load, offset]);

    const goTo = (newOffset: number) => {
        setOffset(newOffset);
        load(newOffset);
    };

    if (error) return (
        <div className="p-4 text-sm text-red-600 bg-red-50">Erro: {error}</div>
    );

    if (!data && loading) return (
        <div className="p-6 flex items-center justify-center gap-2 text-slate-400 text-sm">
            <RefreshCw size={14} className="animate-spin" /> Carregando dados...
        </div>
    );

    if (!data) return null;

    const cols = data.rows.length > 0 ? Object.keys(data.rows[0]) : [];
    const pages = Math.ceil(data.total / PAGE_SIZE);
    const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
    const totalPages = pages || 1;

    return (
        <div>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs text-slate-500">
                <span>
                    <strong>{data.total.toLocaleString()}</strong> registros
                    {loading && <RefreshCw size={10} className="inline ml-2 animate-spin text-indigo-400" />}
                </span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => goTo(0)}
                        disabled={offset === 0 || loading}
                        className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-30 transition-colors"
                    >«</button>
                    <button
                        onClick={() => goTo(Math.max(0, offset - PAGE_SIZE))}
                        disabled={offset === 0 || loading}
                        className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-30 transition-colors"
                    >‹</button>
                    <span className="px-2">
                        Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
                    </span>
                    <button
                        onClick={() => goTo(offset + PAGE_SIZE)}
                        disabled={offset + PAGE_SIZE >= data.total || loading}
                        className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-30 transition-colors"
                    >›</button>
                    <button
                        onClick={() => goTo((totalPages - 1) * PAGE_SIZE)}
                        disabled={offset + PAGE_SIZE >= data.total || loading}
                        className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-30 transition-colors"
                    >»</button>
                    <button
                        onClick={() => load(offset)}
                        disabled={loading}
                        className="ml-2 px-2 py-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-30 transition-colors flex items-center gap-1"
                    >
                        <RefreshCw size={10} />
                        Atualizar
                    </button>
                </div>
            </div>

            {/* Data table */}
            {data.rows.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm italic">Tabela vazia</div>
            ) : (
                <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-800 text-slate-200 text-[10px] uppercase tracking-wider sticky top-0">
                            <tr>
                                {cols.map(c => (
                                    <th key={c} className="px-3 py-2 text-left whitespace-nowrap font-mono">{c}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {data.rows.map((row, i) => (
                                <tr key={i} className="hover:bg-indigo-50 transition-colors">
                                    {cols.map(c => {
                                        const val = row[c];
                                        const display = val === null
                                            ? <span className="italic text-slate-300">null</span>
                                            : typeof val === 'object'
                                                ? <span className="text-slate-400 font-mono">{JSON.stringify(val).slice(0, 80)}</span>
                                                : String(val).length > 60
                                                    ? <span title={String(val)}>{String(val).slice(0, 60)}…</span>
                                                    : String(val);
                                        return (
                                            <td key={c} className="px-3 py-2 text-slate-700 font-mono max-w-xs overflow-hidden whitespace-nowrap">
                                                {display}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <div className="px-4 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400">
                Auto-atualiza a cada 30s · Exibindo {offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} de {data.total}
            </div>
        </div>
    );
}

function TableCard({ table, cols }: { table: string; cols: Column[] }) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<Tab>('schema');

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
                </div>
                {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
            </button>

            {open && (
                <div className="border-t border-slate-100">
                    {/* Tabs */}
                    <div className="flex border-b border-slate-100 bg-slate-50">
                        <button
                            onClick={() => setTab('schema')}
                            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors border-b-2 ${tab === 'schema' ? 'border-indigo-500 text-indigo-600 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            <LayoutList size={12} /> Schema
                        </button>
                        <button
                            onClick={() => setTab('data')}
                            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors border-b-2 ${tab === 'data' ? 'border-indigo-500 text-indigo-600 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            <Rows size={12} /> Dados
                        </button>
                    </div>

                    {tab === 'schema' && <SchemaView cols={cols} />}
                    {tab === 'data' && <DataView tableName={table} />}
                </div>
            )}
        </div>
    );
}

export function MySQLExplorerPage() {
    const [schema, setSchema] = useState<Schema>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            setSchema(await apiFetch('/schema/tables'));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
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
                        Schema + dados em tempo real · banco <span className="font-mono bg-slate-100 px-1 rounded">mercadodovale</span> · VPS Hostinger
                    </p>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar tabela ou coluna..."
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                />
            </div>

            {/* Stats */}
            {!loading && !error && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'Tabelas', value: Object.keys(schema).length, color: 'bg-indigo-50 text-indigo-700' },
                        { label: 'Colunas totais', value: Object.values(schema).reduce((s, c) => s + c.length, 0), color: 'bg-blue-50 text-blue-700' },
                        { label: 'Exibidas', value: tables.length, color: 'bg-emerald-50 text-emerald-700' },
                        { label: 'API', value: 'Online', color: 'bg-green-50 text-green-700' },
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
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-3">
                    <p className="font-semibold text-slate-700 text-sm">Legenda</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-2">Tipos de chave</p>
                            <div className="space-y-1.5">
                                {[
                                    ['PK', 'amber', 'Primary Key — identificador único da linha. Não pode repetir nem ser nulo.'],
                                    ['FK', 'blue', 'Foreign Key (índice) — referência a outra tabela ou campo indexado para buscas rápidas.'],
                                    ['UQ', 'green', 'Unique — valor não pode repetir, mas pode ser nulo.'],
                                ].map(([badge, color, desc]) => (
                                    <div key={badge} className="flex items-start gap-2">
                                        <span className={`px-1.5 py-0.5 bg-${color}-100 text-${color}-700 rounded font-mono shrink-0 font-bold`}>{badge}</span>
                                        <span><strong>{badge === 'PK' ? 'Primary Key' : badge === 'FK' ? 'Foreign Key' : 'Unique'}</strong> — {desc.split('—')[1]?.trim()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-2">Tipos de dados comuns</p>
                            <div className="space-y-1.5">
                                {[
                                    ['varchar(N)', 'Texto curto de até N caracteres'],
                                    ['text / longtext', 'Texto longo (descrições, HTML, JSON)'],
                                    ['int / tinyint(1)', 'Número inteiro. tinyint(1) = booleano (0/1)'],
                                    ['decimal(M,D)', 'Número com casas decimais (preços)'],
                                    ['char(36)', 'UUID — identificador único global'],
                                    ['timestamp', 'Data e hora (created_at, updated_at)'],
                                    ['json', 'Objeto JSON armazenado como coluna'],
                                ].map(([tipo, desc]) => (
                                    <div key={tipo} className="flex gap-2">
                                        <span className="font-mono text-indigo-600 shrink-0 whitespace-nowrap">{tipo}</span>
                                        <span className="text-slate-500">{desc}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
                    Erro ao carregar schema: <span className="font-mono">{error}</span>
                </div>
            )}

            {/* Skeleton */}
            {loading && (
                <div className="space-y-2">
                    {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
                </div>
            )}

            {/* Tables */}
            {!loading && !error && (
                <div className="space-y-2">
                    {tables.map(table => (
                        <TableCard key={table} table={table} cols={schema[table]} />
                    ))}
                </div>
            )}
        </div>
    );
}
