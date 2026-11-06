import React from 'react';
import { Link } from 'react-router-dom';
import { canConfirm, identityDetails, lineStatus } from './entryList.js';

/** `identities`: só na linha de foto (IMEI/serial do pré-cadastro, para "já está na lista"); não vai ao servidor. */
export interface EntryLine { key: string; source: string; item: Record<string, unknown>; label: string; identities?: { imei1: string | null; imei2: string | null; serial: string | null } }
export interface EntryState { lines: EntryLine[]; plan: unknown[] | null; hash: string | null; previewedSignature: string | null; previewOk?: boolean; clientBatchId: string }

export type EntryResult =
    | { type: 'success'; rows: { key: string; label: string; productId: string | null; identity?: { label: string; value: string }[] }[] }
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

/** Serial, IMEI 1 e IMEI 2 completos (entry-full-identity-v1). */
const IdentityRow: React.FC<{ fields?: { label: string; value: string }[] }> = ({ fields }) => (
    fields && fields.length > 0 ? (
        <p className="text-xs text-gray-700 flex flex-wrap gap-x-3 gap-y-0.5">
            {fields.map(f => (
                <span key={f.label}><span className="text-gray-500">{f.label}:</span> <span className="font-mono select-all">{f.value}</span></span>
            ))}
        </p>
    ) : null
);

const SOURCE_LABEL: Record<string, string> = { manual: 'Manual', bipar: 'Bipar', planilha: 'Planilha', foto: 'Foto' };

const successSummary = (n: number) => n === 1 ? '1 item entrou no estoque.' : `${n} itens entraram no estoque.`;

export const EntryListPanel: React.FC<Props> = ({ state, onRemove, onEdit, onPreview, onConfirm, busy, result }) => {
    const empty = state.lines.length === 0;
    const successRef = React.useRef<HTMLDivElement>(null);
    // Leva a mensagem para a vista (no celular a lista fica abaixo da dobra).
    React.useEffect(() => {
        if (result?.type !== 'success') return;
        successRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        successRef.current?.focus?.({ preventScroll: true });
    }, [result]);
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
                // entry-success-message-v1: mensagem clara de que o cadastro deu certo.
                <div ref={successRef} tabIndex={-1} role="status" aria-live="polite"
                    className="rounded-lg bg-green-50 border-2 border-green-500 text-green-800 text-sm px-4 py-3 space-y-2 outline-none">
                    <div className="flex items-start gap-2">
                        <span aria-hidden="true" className="text-xl leading-none">✅</span>
                        <div>
                            <p className="text-base font-bold">Cadastrado com sucesso!</p>
                            <p>{successSummary(result.rows.length)} Toque num item para abrir o produto.</p>
                        </div>
                    </div>
                    <ul className="space-y-0.5 pl-7">
                        {result.rows.map(row => (
                            <li key={row.key}>
                                {row.productId
                                    ? <Link to={`/admin/products/${row.productId}`} className="underline">{row.label}</Link>
                                    : row.label}
                                <IdentityRow fields={row.identity} />
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
                                        <span className="sr-only">{st.state === 'ok' ? 'OK' : st.state === 'error' ? 'Com problema' : 'Pendente'}</span>
                                        <span className="text-sm text-gray-800">{line.label}</span>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{SOURCE_LABEL[line.source] || line.source}</span>
                                        {st.badges.map(b => (
                                            <span key={b} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{b}</span>
                                        ))}
                                    </div>
                                    <IdentityRow fields={identityDetails(line)} />
                                    {st.errors.map(err => (
                                        <p key={err} className="text-xs text-red-600">{err}</p>
                                    ))}
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    {onEdit && (
                                        <button type="button" onClick={() => onEdit(line.key)} disabled={busy} className="text-xs text-blue-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed">Editar</button>
                                    )}
                                    <button type="button" onClick={() => onRemove(line.key)} disabled={busy} className="text-xs text-red-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed">Remover</button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};
