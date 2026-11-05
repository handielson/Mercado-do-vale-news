import React from 'react';
import { Link } from 'react-router-dom';
import { canConfirm, lineStatus } from './entryList.js';

export interface EntryLine { key: string; source: string; item: Record<string, unknown>; label: string }
export interface EntryState { lines: EntryLine[]; plan: unknown[] | null; hash: string | null; previewedSignature: string | null; previewOk?: boolean }

export type EntryResult =
    | { type: 'success'; rows: { key: string; label: string; productId: string | null }[] }
    | { type: 'error'; message: string }
    | null;

interface Props {
    state: EntryState;
    onRemove: (key: string) => void;
    onEdit?: (key: string) => void;
    onPreview: () => void;
    onConfirm: () => void;
    busy?: boolean;
    result?: EntryResult;
}

const SOURCE_LABEL: Record<string, string> = { manual: 'Manual', bipar: 'Bipar', planilha: 'Planilha', foto: 'Foto' };

export const EntryListPanel: React.FC<Props> = ({ state, onRemove, onEdit, onPreview, onConfirm, busy, result }) => {
    const empty = state.lines.length === 0;
    const confirmEnabled = !busy && canConfirm(state);

    return (
        <section aria-label="Lista de entrada" className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-gray-800">Lista de entrada ({state.lines.length})</h2>
                <div className="flex gap-2">
                    <button type="button" onClick={onPreview} disabled={busy || empty}
                        className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                        Conferir
                    </button>
                    <button type="button" onClick={onConfirm} disabled={!confirmEnabled}
                        className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        Confirmar entrada
                    </button>
                </div>
            </div>

            {result?.type === 'error' && (
                <div role="alert" className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2">{result.message}</div>
            )}

            {result?.type === 'success' && (
                <div role="status" className="rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm px-3 py-2 space-y-1">
                    <p className="font-semibold">Entrada confirmada</p>
                    <ul className="space-y-0.5">
                        {result.rows.map(row => (
                            <li key={row.key}>
                                {row.productId
                                    ? <Link to={`/admin/products/${row.productId}`} className="underline">{row.label}</Link>
                                    : row.label}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {empty ? (
                <p className="text-sm text-gray-500 py-6 text-center">Nenhum item na lista</p>
            ) : (
                <ul className="divide-y divide-gray-100">
                    {state.lines.map(line => {
                        const st = lineStatus(state, line.key) as { state: 'pending' | 'ok' | 'error'; badges: string[]; errors: string[] };
                        return (
                            <li key={line.key} className="py-2 flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span aria-hidden="true">{st.state === 'ok' ? '✅' : st.state === 'error' ? '⚠️' : '•'}</span>
                                        <span className="text-sm text-gray-800">{line.label}</span>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{SOURCE_LABEL[line.source] || line.source}</span>
                                        {st.badges.map(b => (
                                            <span key={b} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{b}</span>
                                        ))}
                                    </div>
                                    {st.errors.map(err => (
                                        <p key={err} className="text-xs text-red-600">{err}</p>
                                    ))}
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    {onEdit && (
                                        <button type="button" onClick={() => onEdit(line.key)} className="text-xs text-blue-600 hover:underline">Editar</button>
                                    )}
                                    <button type="button" onClick={() => onRemove(line.key)} className="text-xs text-red-600 hover:underline">Remover</button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};
