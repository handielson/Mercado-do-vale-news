import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { catalogEntries, EntryItem } from '../../../services/catalogEntries';
import { ScanEntryTab } from '../../../components/entrada/ScanEntryTab';
import { ManualEntryTab } from '../../../components/entrada/ManualEntryTab';
import { EntryListPanel, EntryLine, EntryResult, EntryState } from '../../../components/entrada/EntryListPanel';
import { addLines, applyPreview, emptyState, loadDraft, removeLine, saveDraft, toItems } from '../../../components/entrada/entryList.js';

export type EntryTab = 'manual' | 'bipar' | 'planilha' | 'foto';

/** Contrato de cada aba: entrega linhas prontas para a Lista de entrada. */
export interface EntryTabProps { onAddLines: (lines: EntryLine[]) => void; busy?: boolean }

const TABS: { id: EntryTab; label: string }[] = [
    { id: 'manual', label: 'Manual' },
    { id: 'bipar', label: 'Bipar' },
    { id: 'planilha', label: 'Planilha' },
    { id: 'foto', label: 'Foto' },
];

const safeStorage = (): Storage | null => { try { return window.localStorage; } catch { return null; } };

const ComingSoon: React.FC<{ to: string; label: string }> = ({ to, label }) => (
    <div className="text-sm text-gray-600 space-y-2">
        <p>Em breve nesta tela (use as telas atuais por enquanto)</p>
        <Link to={to} className="text-blue-600 underline">{label}</Link>
    </div>
);

export const CatalogEntryPage: React.FC = () => {
    const [params, setParams] = useSearchParams();
    const requested = params.get('aba') as EntryTab | null;
    const tab: EntryTab = TABS.some(t => t.id === requested) ? (requested as EntryTab) : 'manual';

    const modeloParam = params.get('modelo');
    const variacaoParam = params.get('variacao');

    const [state, setState] = useState<EntryState>(() => {
        const storage = safeStorage();
        return (storage ? loadDraft(storage) : emptyState()) as EntryState;
    });
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<EntryResult>(null);
    const stateRef = useRef(state);
    stateRef.current = state;

    useEffect(() => {
        const storage = safeStorage();
        if (storage) saveDraft(state, storage);
    }, [state]);

    const onAddLines = useCallback((lines: EntryLine[]) => {
        setResult(null);
        setState(s => addLines(s, lines) as EntryState);
    }, []);

    const onRemove = useCallback((key: string) => {
        setState(s => removeLine(s, key) as EntryState);
    }, []);

    const runPreview = useCallback(async (): Promise<boolean> => {
        const items = toItems(stateRef.current) as EntryItem[];
        if (items.length === 0) return false;
        const sent = JSON.stringify(items);
        setBusy(true);
        try {
            const res = await catalogEntries.preview(items);
            // Só aplica se a lista não mudou enquanto a prévia rodava.
            setState(s => (JSON.stringify(toItems(s)) === sent ? (applyPreview(s, res) as EntryState) : s));
            return true;
        } catch (err) {
            setResult({ type: 'error', message: `Não foi possível conferir: ${err instanceof Error ? err.message : 'erro desconhecido'}` });
            return false;
        } finally {
            setBusy(false);
        }
    }, []);

    const onPreview = useCallback(async () => {
        setResult(null);
        await runPreview();
    }, [runPreview]);

    const onConfirm = useCallback(async () => {
        const current = stateRef.current;
        if (!current.hash) return;
        const items = toItems(current) as EntryItem[];
        const lines = current.lines;
        setResult(null);
        setBusy(true);
        try {
            const res = await catalogEntries.commit(items, current.hash);
            const rows = lines.map((line, i) => ({
                key: line.key,
                label: line.label,
                productId: res.plan?.[i]?.product_id ?? null,
            }));
            // Remove só as linhas confirmadas; o que entrou nesse meio tempo continua na lista.
            const committed = new Set(lines.map(l => l.key));
            setState(s => {
                const remaining = s.lines.filter(l => !committed.has(l.key));
                return (remaining.length === 0 ? emptyState() : { ...s, lines: remaining, plan: null, hash: null, previewedSignature: null }) as EntryState;
            });
            setResult({ type: 'success', rows });
        } catch (err) {
            const m = /\[VPS\] (409|422)\b/.exec(err instanceof Error ? err.message : '');
            if (m) {
                const message = m[1] === '409'
                    ? 'O lote mudou desde a conferência. Confira novamente.'
                    : 'Há linhas com problema. Confira a lista.';
                setBusy(false);
                await runPreview();
                setResult({ type: 'error', message });
            } else {
                setResult({ type: 'error', message: `Não foi possível confirmar: ${err instanceof Error ? err.message : 'erro desconhecido'}` });
            }
        } finally {
            setBusy(false);
        }
    }, [runPreview]);

    const selectTab = (id: EntryTab) => {
        const next = new URLSearchParams(params);
        next.set('aba', id);
        setParams(next, { replace: true });
    };

    return (
        <div className="space-y-4 max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800">Entrada</h1>

            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
                <div role="tablist" aria-label="Forma de entrada" className="flex gap-1 border-b border-gray-200">
                    {TABS.map(t => (
                        <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => selectTab(t.id)}
                            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>
                <div role="tabpanel">
                    {tab === 'manual' && <ManualEntryTab onAddLines={onAddLines} busy={busy} prefill={modeloParam ? { model_id: modeloParam } : undefined} />}
                    {tab === 'bipar' && <ScanEntryTab onAddLines={onAddLines} busy={busy} existingState={state} prefill={variacaoParam ? { variation_id: variacaoParam } : undefined} />}
                    {tab === 'planilha' && <ComingSoon to="/admin/products/bulk" label="Cadastro em massa (tela atual)" />}
                    {tab === 'foto' && <ComingSoon to="/admin/products/photo-intake" label="Cadastro por foto (tela atual)" />}
                </div>
            </div>

            <EntryListPanel state={state} onRemove={onRemove} onPreview={onPreview} onConfirm={onConfirm} busy={busy} result={result} />
        </div>
    );
};

export default CatalogEntryPage;
