import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { catalogEntries, EntryItem } from '../../../services/catalogEntries';
import { ScanEntryTab } from '../../../components/entrada/ScanEntryTab';
import { SpreadsheetEntryTab } from '../../../components/entrada/SpreadsheetEntryTab';
import { ManualEntryTab } from '../../../components/entrada/ManualEntryTab';
import { PhotoEntryTab } from '../../../components/entrada/PhotoEntryTab';
import { FixedVariation, loadFixedVariation } from '../../../components/entrada/FixedVariationCard';
import { BarcodeProductLookup } from '../../../components/entrada/BarcodeProductLookup';
import { EntryListPanel, EntryLine, EntryResult, EntryState } from '../../../components/entrada/EntryListPanel';
import { EMPTY_COST_LOCATION, type CostLocation } from '../../../components/entrada/EntryLockFields';
import type { SmartphonePhotoIntake } from '../../../types/smartphone-photo-intake';
import { addLines, applyPreview, commitErrorKind, emptyState, errorText, identityDetails, loadDraft, newBatchId, refreshPhotoLines, removeLine, saveDraft, toItems } from '../../../components/entrada/entryList.js';

const AMBIGUOUS = 'A confirmação pode ter sido gravada. Confira novamente antes de reenviar.';
const clearError = (r: EntryResult): EntryResult => (r?.type === 'error' ? null : r);

export type EntryTab = 'manual' | 'bipar' | 'planilha' | 'foto';

/** Contrato de cada aba: entrega linhas prontas para a Lista de entrada. */
export interface EntryTabProps { onAddLines: (lines: EntryLine[]) => void; busy?: boolean }

const TABS: { id: EntryTab; label: string }[] = [
    { id: 'manual', label: 'Manual' },
    { id: 'bipar', label: 'Bipar' },
    { id: 'planilha', label: 'Planilha' },
    { id: 'foto', label: 'Foto' },
];

type FixedLoad = { id: string; status: 'loading' } | { id: string; status: 'ok'; variation: FixedVariation } | { id: string; status: 'error'; message: string };

const safeStorage = (): Storage | null => { try { return window.localStorage; } catch { return null; } };

export const CatalogEntryPage: React.FC = () => {
    const [params, setParams] = useSearchParams();
    const requested = params.get('aba') as EntryTab | null;
    const explicitTab = TABS.some(t => t.id === requested) ? (requested as EntryTab) : null;

    const modeloParam = params.get('modelo');
    const variacaoParam = params.get('variacao') || '';

    // Atalho ?variacao=: a página carrega o produto uma vez e entrega a variação fixa às abas.
    const [fixedLoad, setFixedLoad] = useState<FixedLoad | null>(null);
    useEffect(() => {
        if (!variacaoParam) { setFixedLoad(null); return; }
        let alive = true;
        setFixedLoad({ id: variacaoParam, status: 'loading' });
        loadFixedVariation(variacaoParam)
            .then(variation => { if (alive) setFixedLoad({ id: variacaoParam, status: 'ok', variation }); })
            .catch(err => { if (alive) setFixedLoad({ id: variacaoParam, status: 'error', message: err instanceof Error ? err.message : 'Não foi possível carregar a variação.' }); });
        return () => { alive = false; };
    }, [variacaoParam]);
    // Antes do efeito rodar para um id novo, o estado ainda é do anterior: conta como carregando.
    const fixedCurrent: FixedLoad | null = variacaoParam
        ? (fixedLoad && fixedLoad.id === variacaoParam ? fixedLoad : { id: variacaoParam, status: 'loading' })
        : null;
    const fixed = fixedCurrent?.status === 'ok' ? fixedCurrent.variation : null;
    const fixedLoading = fixedCurrent?.status === 'loading';
    const fixedError = fixedCurrent?.status === 'error' ? fixedCurrent.message : null;

    // ?aba= explícita vence; com variação fixa, celular vai para Bipar e o resto para Manual.
    const tab: EntryTab = explicitTab ?? (fixed?.isPhone ? 'bipar' : 'manual');

    const [state, setState] = useState<EntryState>(() => {
        const storage = safeStorage();
        return (storage ? loadDraft(storage) : emptyState()) as EntryState;
    });
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<EntryResult>(null);
    // Conta as tentativas de confirmação: a aba Foto recarrega a fila (o pré-cadastro pode ter sido concluído).
    const [confirmCount, setConfirmCount] = useState(0);
    // Só confirmações gravadas: zera o contador do Bipar.
    const [successCount, setSuccessCount] = useState(0);
    const stateRef = useRef(state);
    stateRef.current = state;

    // Linhas que vieram do rascunho ao abrir a página (entrada anterior). As que entram depois não contam.
    const restoredKeys = useRef<Set<string> | null>(null);
    if (restoredKeys.current === null) restoredKeys.current = new Set(state.lines.map(l => l.key));
    const restoredCount = state.lines.filter(l => restoredKeys.current!.has(l.key)).length;
    // Atalho ?variacao= com linhas antigas na lista: avisa uma vez por variação.
    const [oldDraftFor, setOldDraftFor] = useState<string | null>(null);
    const noticedVariations = useRef<Set<string>>(new Set());
    useEffect(() => {
        if (!variacaoParam || noticedVariations.current.has(variacaoParam)) return;
        noticedVariations.current.add(variacaoParam);
        const restored = restoredKeys.current!;
        if (stateRef.current.lines.some(l => restored.has(l.key))) setOldDraftFor(variacaoParam);
    }, [variacaoParam]);
    const showOldDraft = Boolean(variacaoParam) && oldDraftFor === variacaoParam && restoredCount > 0;
    // "Limpar a lista": como depois de uma confirmação, lista, rascunho e client_batch_id começam do zero.
    const clearOldDraft = () => {
        setResult(null);
        setState(emptyState() as EntryState);
        setOldDraftFor(null);
    };

    // Custo e local de Manual e Bipar ficam na página: trocar de variação desmonta a aba enquanto carrega.
    const [manualCostLocation, setManualCostLocation] = useState<CostLocation>(EMPTY_COST_LOCATION);
    const [scanCostLocation, setScanCostLocation] = useState<CostLocation>(EMPTY_COST_LOCATION);

    // A fila de foto carregou ou mudou: rótulo e identidades das linhas de foto acompanham o pré-cadastro.
    const onPhotoQueueLoaded = useCallback((items: SmartphonePhotoIntake[]) => {
        setState(s => refreshPhotoLines(s, items) as EntryState);
    }, []);

    useEffect(() => {
        const storage = safeStorage();
        if (storage) saveDraft(state, storage);
    }, [state]);

    const onAddLines = useCallback((lines: EntryLine[]) => {
        setResult(null);
        setState(s => addLines(s, lines) as EntryState);
    }, []);

    const onRemove = useCallback((key: string) => {
        setResult(clearError);
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
            setResult({ type: 'error', message: `Não foi possível conferir: ${errorText(err)}` });
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
            const res = await catalogEntries.commit(items, current.hash, current.clientBatchId);
            // Produto criado no lote não tem id no plano: o lote gravado tem (o plano fica de reserva).
            const saved = new Map<number, string>();
            try {
                const batch = await catalogEntries.get(res.batch_id);
                for (const l of batch?.lines || []) if (l?.product_id) saved.set(Number(l.line), String(l.product_id));
            } catch { /* links do plano */ }
            const rows = lines.map((line, i) => ({
                key: line.key,
                label: line.label,
                identity: identityDetails(line),
                productId: saved.get(res.plan?.[i]?.line ?? i + 1) ?? res.plan?.[i]?.product_id ?? null,
            }));
            // Remove só as linhas confirmadas; o que entrou nesse meio tempo continua na lista (com chave nova).
            const committed = new Set(lines.map(l => l.key));
            setState(s => {
                const remaining = s.lines.filter(l => !committed.has(l.key));
                return (remaining.length === 0 ? emptyState()
                    : { ...s, lines: remaining, plan: null, hash: null, previewedSignature: null, clientBatchId: newBatchId() }) as EntryState;
            });
            setResult({ type: 'success', rows });
            setSuccessCount(c => c + 1);
        } catch (err) {
            const kind = commitErrorKind(err);
            if (kind === 'rejected') {
                setResult({ type: 'error', message: `Não foi possível confirmar: ${errorText(err)}` });
            } else {
                const message = kind === 'conflict' ? 'O lote mudou desde a conferência. Confira novamente.'
                    : kind === 'invalid' ? 'Há linhas com problema. Confira a lista.'
                    : kind === 'client-batch-conflict' ? errorText(err)
                    : AMBIGUOUS;
                // Ambíguo: a gravação pode ter acontecido; nada de reenviar com o hash velho. A chave
                // continua a mesma, então um reenvio da mesma lista não grava duas vezes.
                // Chave já usada com outra lista: o operador foi avisado; a próxima confirmação é outro envio.
                setState(s => ({ ...s, hash: null, ...(kind === 'client-batch-conflict' ? { clientBatchId: newBatchId() } : {}) }) as EntryState);
                setBusy(false);
                await runPreview();
                setResult({ type: 'error', message });
            }
        } finally {
            setBusy(false);
            setConfirmCount(c => c + 1);
        }
    }, [runPreview]);

    const selectTab = (id: EntryTab) => {
        const next = new URLSearchParams(params);
        next.set('aba', id);
        setParams(next, { replace: true });
    };

    // "Trocar": solta a variação fixa e fica na aba em que estava.
    const clearFixed = () => {
        const next = new URLSearchParams(params);
        next.delete('variacao');
        next.set('aba', tab);
        setParams(next, { replace: true });
    };
    const usesFixed = tab === 'manual' || tab === 'bipar';

    return (
        <div className="space-y-4 max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800">Entrada</h1>

            {showOldDraft && (
                <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <span className="flex-1 min-w-0">Há {restoredCount} linha(s) de uma entrada anterior na lista.</span>
                    <button type="button" onClick={clearOldDraft} disabled={busy}
                        className="px-3 py-1.5 rounded-md border border-amber-300 bg-white text-amber-900 hover:bg-amber-100 disabled:opacity-50">
                        Limpar a lista
                    </button>
                    <button type="button" onClick={() => setOldDraftFor(null)}
                        className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">
                        Manter
                    </button>
                </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
                <div role="tablist" aria-label="Forma de entrada" className="flex gap-1 border-b border-gray-200">
                    {TABS.map(t => (
                        <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => selectTab(t.id)}
                            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>
                <div role="tabpanel" className="space-y-4">
                    {/* Sem variação fixa: achar o produto pelo código prende a variação (?variacao=). */}
                    {usesFixed && (!variacaoParam || fixedError) && <BarcodeProductLookup disabled={busy} />}
                    {usesFixed && fixedError && <p role="alert" className="text-sm text-red-600">{fixedError}</p>}
                    {usesFixed && fixedLoading ? (
                        <p role="status" className="text-sm text-slate-600">Carregando variação…</p>
                    ) : (
                        <>
                            {tab === 'manual' && <ManualEntryTab onAddLines={onAddLines} busy={busy} prefill={modeloParam ? { model_id: modeloParam } : undefined}
                                fixed={fixed} onClearFixed={clearFixed} costLocation={{ value: manualCostLocation, onChange: setManualCostLocation }} />}
                            {tab === 'bipar' && <ScanEntryTab onAddLines={onAddLines} busy={busy} existingState={state} fixed={fixed} onClearFixed={clearFixed}
                                costLocation={{ value: scanCostLocation, onChange: setScanCostLocation }} confirmCount={successCount} />}
                        </>
                    )}
                    {tab === 'planilha' && <SpreadsheetEntryTab onAddLines={onAddLines} busy={busy} existingState={state} />}
                    {tab === 'foto' && <PhotoEntryTab onAddLines={onAddLines} busy={busy} existingState={state} confirmCount={confirmCount} onQueueLoaded={onPhotoQueueLoaded} />}
                </div>
            </div>

            <EntryListPanel state={state} onRemove={onRemove} onPreview={onPreview} onConfirm={onConfirm} busy={busy} result={result} />
        </div>
    );
};

export default CatalogEntryPage;
