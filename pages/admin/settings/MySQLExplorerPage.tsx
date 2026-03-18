import React, { useState, useEffect } from 'react';
import { Database, Table, ChevronDown, ChevronRight, RefreshCw, Search } from 'lucide-react';

const VPS_API = 'https://api.xiaomipetrolina.com.br';
const SYNC_KEY = import.meta.env.VITE_VPS_SYNC_KEY || '';

interface Column {
    field: string;
    type: string;
    null: string;
    key: string;
    default: string | null;
}

type Schema = Record<string, Column[]>;

export function MySQLExplorerPage() {
    const [schema, setSchema] = useState<Schema>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${VPS_API}/schema/tables`, {
                headers: { 'x-sync-key': SYNC_KEY },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setSchema(await res.json());
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

    const toggle = (t: string) => {
        const next = new Set(expanded);
        next.has(t) ? next.delete(t) : next.add(t);
        setExpanded(next);
    };

    const keyBadge = (key: string) => {
        if (key === 'PRI') return <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded font-mono">PK</span>;
        if (key === 'MUL') return <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded font-mono">FK</span>;
        if (key === 'UNI') return <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded font-mono">UQ</span>;
        return null;
    };

    return (
        <div className="animate-in fade-in duration-300 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Database size={22} className="text-indigo-500" />
                        MySQL Explorer
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Schema em tempo real do banco <span className="font-mono bg-slate-100 px-1 rounded">mercadodovale</span> · VPS Hostinger
                    </p>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Atualizar
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

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
                    Erro ao carregar schema: <span className="font-mono">{error}</span>
                </div>
            )}

            {/* Loading skeleton */}
            {loading && (
                <div className="space-y-2">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            )}

            {/* Tables */}
            {!loading && !error && (
                <div className="space-y-2">
                    {tables.map(table => {
                        const cols = schema[table];
                        const isOpen = expanded.has(table);
                        const matchedCols = search
                            ? cols.filter(c => c.field.toLowerCase().includes(search.toLowerCase()))
                            : cols;

                        return (
                            <div key={table} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                <button
                                    onClick={() => toggle(table)}
                                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <Table size={16} className="text-indigo-400 shrink-0" />
                                        <span className="font-mono font-semibold text-slate-800 text-sm">{table}</span>
                                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                            {cols.length} cols
                                        </span>
                                    </div>
                                    {isOpen ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                                </button>

                                {isOpen && (
                                    <div className="border-t border-slate-100 overflow-x-auto">
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
                                                {(search ? matchedCols : cols).map(col => (
                                                    <tr key={col.field} className={`hover:bg-slate-50 ${search && col.field.toLowerCase().includes(search.toLowerCase()) ? 'bg-yellow-50' : ''}`}>
                                                        <td className="px-4 py-2 font-mono text-slate-800 font-medium">{col.field}</td>
                                                        <td className="px-4 py-2 font-mono text-slate-500">{col.type}</td>
                                                        <td className="px-4 py-2 text-slate-400">{col.null}</td>
                                                        <td className="px-4 py-2">{keyBadge(col.key)}</td>
                                                        <td className="px-4 py-2 font-mono text-slate-400 text-[11px]">
                                                            {col.default ?? <span className="italic text-slate-300">null</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
