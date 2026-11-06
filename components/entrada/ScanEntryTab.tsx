import React, { useEffect, useMemo, useRef, useState } from 'react';
import { modelService } from '../../services/models';
import { BarcodeScanButton } from '../ui/BarcodeScanButton';
import { CurrencyInput } from '../ui/CurrencyInput';
import { SearchableSelect } from '../ui/SearchableSelect';
import { createLine, createShortcutLine, hasIdentity, isValidImei } from './entryList.js';
import { loadModelProfile, useCostLocation, EntryLocationOptions, useEntryLocations, type ModelRef, type SharedCostLocation } from './EntryLockFields';
import { CONDITIONS, RAM_OPTIONS, STORAGE_OPTIONS } from './ManualEntryTab';
import { FixedVariationCard, type FixedVariation } from './FixedVariationCard';
import type { EntryLine, EntryState } from './EntryListPanel';

export interface ScanEntryTabProps {
    onAddLines: (lines: EntryLine[]) => void;
    /** Lista atual da tela, para detectar leituras repetidas. */
    existingState: EntryState;
    /** Variação fixa (atalho ?variacao=, carregada pela página): prende pelo product_id. */
    fixed?: FixedVariation | null;
    /** "Trocar" no card da variação fixa. */
    onClearFixed?: () => void;
    /** Enquanto uma confirmação roda, não aceita leituras. */
    busy?: boolean;
    /** Custo e local guardados pela página (não se perdem quando a aba é desmontada). */
    costLocation?: SharedCostLocation;
    /** Muda a cada "Confirmar entrada": zera o contador de aparelhos lidos. */
    confirmCount?: number;
}

interface Locked {
    model_id: string;
    category_id: string | null;
    name: string;
    ram: string;
    storage: string;
    version: string;
    condition: string;
    color: string;
}

type ReadStep = 'serial' | 'imei1' | 'imei2';
interface Device { serial: string; imei1: string; imei2: string }
const EMPTY_DEVICE: Device = { serial: '', imei1: '', imei2: '' };
const NEXT_STEP: Record<ReadStep, ReadStep> = { serial: 'imei1', imei1: 'imei2', imei2: 'serial' };
const READ_FIELDS: { step: ReadStep; label: string; scanKind: 'serial' | 'imei' }[] = [
    { step: 'serial', label: 'Serial', scanKind: 'serial' },
    { step: 'imei1', label: 'IMEI 1', scanKind: 'imei' },
    { step: 'imei2', label: 'IMEI 2', scanKind: 'imei' },
];

const fieldCls = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';
const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

export const ScanEntryTab: React.FC<ScanEntryTabProps> = ({ onAddLines, existingState, fixed, onClearFixed, busy, costLocation, confirmCount = 0 }) => {
    const variationId = fixed?.id || '';

    const [models, setModels] = useState<ModelRef[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [modelId, setModelId] = useState('');
    const [isPhone, setIsPhone] = useState<boolean | null>(null);
    const [categoryError, setCategoryError] = useState(false);
    const [colorOptions, setColorOptions] = useState<string[]>([]);
    const [ram, setRam] = useState('');
    const [storage, setStorage] = useState('');
    const [version, setVersion] = useState('Global');
    const [condition, setCondition] = useState('new');
    const [color, setColor] = useState('');
    const { cost, setCost, locationId, setLocationId } = useCostLocation(costLocation);
    const { locationGroups, locationsError } = useEntryLocations(setLocationId);
    // Configuração sem preço: o operador informa aqui (vai em todas as leituras) em vez de cair no erro da prévia.
    const [pricesOn, setPricesOn] = useState(false);
    const [retail, setRetail] = useState(0);
    const [reseller, setReseller] = useState(0);
    const [wholesale, setWholesale] = useState(0);

    const [scanning, setScanning] = useState(false);
    // scan-sequence-v1: um aparelho por vez, Serial → IMEI 1 → IMEI 2; o cursor avança sozinho.
    const [device, setDeviceState] = useState<Device>(EMPTY_DEVICE);
    const [step, setStep] = useState<ReadStep>('serial');
    const [feedback, setFeedback] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
    const [count, setCount] = useState(0);
    const seen = useRef<Set<string>>(new Set());
    // O leitor digita mais rápido que o React re-renderiza: o ref guarda o aparelho em andamento.
    const deviceRef = useRef<Device>(EMPTY_DEVICE);
    // Depois de "Confirmar entrada" o contador recomeça (os aparelhos já foram cadastrados).
    const lastConfirm = useRef(confirmCount);
    useEffect(() => {
        if (confirmCount === lastConfirm.current) return;
        lastConfirm.current = confirmCount;
        setCount(0);
    }, [confirmCount]);
    const serialRef = useRef<HTMLInputElement>(null);
    const imei1Ref = useRef<HTMLInputElement>(null);
    const imei2Ref = useRef<HTMLInputElement>(null);
    const fieldRefs: Record<ReadStep, React.RefObject<HTMLInputElement>> = { serial: serialRef, imei1: imei1Ref, imei2: imei2Ref };

    // A lista da tela é a verdade: o ref só guarda leituras ainda não refletidas nela (corrida do leitor).
    useEffect(() => { seen.current = new Set(); }, [existingState.lines]);

    // Ao sair de "ocupado" na etapa de leitura, o campo da vez volta a receber o leitor.
    useEffect(() => { if (!busy && scanning) fieldRefs[step].current?.focus(); }, [busy, scanning]);

    // Trocar de variação fixa volta para a configuração (as leituras eram da anterior).
    useEffect(() => { setScanning(false); setFeedback(null); deviceRef.current = EMPTY_DEVICE; setDeviceState(EMPTY_DEVICE); setStep('serial'); }, [variationId]);

    useEffect(() => {
        if (variationId) return;
        let alive = true;
        modelService.list()
            .then(list => { if (alive) setModels((list as (ModelRef & { active?: boolean })[]).filter(m => m.active !== false)); })
            .catch(() => { if (alive) setLoadError('Não foi possível carregar os modelos.'); });
        return () => { alive = false; };
    }, [variationId]);

    const model = useMemo(() => models.find(m => m.id === modelId) || null, [models, modelId]);

    useEffect(() => {
        let alive = true;
        setIsPhone(null); setCategoryError(false); setColorOptions([]); setColor('');
        if (variationId || !model) return;
        loadModelProfile(model)
            .then(profile => { if (!alive) return; setIsPhone(profile.isPhone); setColorOptions(profile.colorOptions); })
            .catch(() => { if (alive) setCategoryError(true); });
        return () => { alive = false; };
    }, [model, variationId]);

    // Variação fixa: prende pelo product_id (não precisa de memória, cor nem modelo completos). Só celular.
    const fixedLocked = Boolean(fixed && fixed.isPhone);
    const locked: Locked | null = fixed ? null
        : (model && isPhone ? {
            model_id: model.id, category_id: model.category_id ?? null, name: model.name,
            ram, storage, version: version.trim(), condition, color,
        } : null);

    const pricesReady = !pricesOn || (retail > 0 && reseller > 0 && wholesale > 0);
    const ready = fixed
        ? Boolean(fixedLocked && cost > 0 && locationId)
        : Boolean(locked && locked.model_id && locked.ram && locked.storage && locked.color && cost > 0 && locationId && pricesReady);
    // scan-missing-hint-v1: diz o que falta para liberar a leitura (antes o botão só sumia).
    const missing: string[] = fixed
        ? [cost > 0 ? '' : 'custo', locationId ? '' : 'local'].filter(Boolean)
        : [
            model && isPhone ? '' : 'modelo (celular ou tablet)',
            ram ? '' : 'RAM',
            storage ? '' : 'armazenamento',
            color ? '' : 'cor',
            cost > 0 ? '' : 'custo',
            locationId ? '' : 'local',
            pricesReady ? '' : 'preços (varejo, revenda e atacado)',
        ].filter(Boolean);
    const modelLabel = (id: string) => models.find(m => m.id === id)?.name || '';
    const labelOf = (l: Locked) => [l.name, l.color, [l.ram, l.storage].filter(Boolean).join('/')].filter(Boolean).join(' · ');
    const lockLabel = fixed ? [fixed.name, fixed.sku].filter(Boolean).join(' · ') : locked ? labelOf(locked) : '';
    const canRead = fixedLocked || Boolean(locked);

    const focusStep = (next: ReadStep) => {
        setStep(next);
        setTimeout(() => { const el = fieldRefs[next].current; el?.focus(); el?.select(); }, 0);
    };
    const setDevice = (next: Device) => { deviceRef.current = next; setDeviceState(next); };
    const fail = (text: string, at: ReadStep, value = '') => {
        setFeedback({ kind: 'error', text });
        // Repetição da leitura que acabou de entrar (ainda não refletida na lista): só avisa, o cursor segue no próximo aparelho.
        if (!(value && seen.current.has(value.toLowerCase()))) focusStep(at);
        return false;
    };
    const taken = (value: string) => seen.current.has(value.toLowerCase()) || hasIdentity(existingState, value);

    /** Erro do campo (ou null): IMEI com 15 dígitos válidos, nada repetido na lista nem no próprio aparelho. */
    const fieldError = (at: ReadStep, value: string, current: Device): string | null => {
        if (!value) return null;
        if (at === 'serial') return taken(value) ? 'Serial já está na lista' : null;
        if (!isValidImei(value)) return 'IMEI inválido';
        if (taken(value)) return 'IMEI já está na lista';
        if (at === 'imei2' && value === current.imei1.trim()) return 'IMEI 2 igual ao IMEI 1';
        return null;
    };

    /** Fecha o aparelho em andamento: vira uma linha na lista e o cursor volta para o Serial do próximo. */
    const commitDevice = (current: Device) => {
        if (!canRead || busy) return false;
        const serial = current.serial.trim();
        const imei1 = current.imei1.trim();
        const imei2 = current.imei2.trim();
        // Repetido primeiro: o leitor que manda o mesmo código duas vezes antes do re-render cai aqui.
        for (const at of ['serial', 'imei1', 'imei2'] as ReadStep[]) {
            const value = { serial, imei1, imei2 }[at];
            const error = fieldError(at, value, current);
            if (error) return fail(error, at, value);
        }
        if (!imei1 && !serial) return fail('Informe o IMEI 1 ou o serial.', 'serial');
        if (imei2 && !imei1) return fail('Leia o IMEI 1 antes do IMEI 2.', 'imei1');
        [serial, imei1, imei2].filter(Boolean).forEach(v => seen.current.add(v.toLowerCase()));
        const identity = { imei1: imei1 || null, imei2: imei2 || null, serial: serial || null };
        setDevice(EMPTY_DEVICE);
        focusStep('serial');
        if (fixed) {
            // O servidor usa o produto do product_id (configuração, cor, condição e preços dele).
            onAddLines([createShortcutLine(fixed, {
                identity, quantity: 1, cost_cents: cost, location_id: locationId, prices: null,
            }) as EntryLine]);
            setCount(n => n + 1);
            setFeedback(null);
            return true;
        }
        if (!locked) return false;
        const item = {
            source: 'bipar',
            model_id: locked.model_id,
            category_id: locked.category_id,
            name: locked.name,
            configuration: { ram: locked.ram, storage: locked.storage, version: locked.version, network: '', condition: locked.condition },
            color: locked.color,
            condition_note: null,
            identity,
            quantity: 1,
            cost_cents: cost,
            location_id: locationId,
            prices: pricesOn ? { price_retail: retail, price_reseller: reseller, price_wholesale: wholesale } : null,
        };
        onAddLines([createLine(item, { source: 'bipar' }) as EntryLine]);
        setCount(n => n + 1);
        setFeedback(null);
        return true;
    };

    /** Valor lido num campo: confere e passa para o próximo; o IMEI 2 (lido ou vazio) fecha o aparelho. */
    const readField = (at: ReadStep, raw: string) => {
        if (!canRead || busy) return;
        const value = String(raw ?? '').trim();
        // Leitor repetindo o código que acabou de entrar: avisa sem sujar o próximo aparelho.
        if (value && seen.current.has(value.toLowerCase())) {
            setFeedback({ kind: 'error', text: at === 'serial' ? 'Serial já está na lista' : 'IMEI já está na lista' });
            return;
        }
        const current = { ...deviceRef.current, [at]: value };
        setDevice(current);
        if (at === 'imei2') { commitDevice(current); return; }
        const error = fieldError(at, value, current);
        if (error) { fail(error, at, value); return; }
        setFeedback(null);
        focusStep(NEXT_STEP[at]);
    };

    const onFieldKey = (at: ReadStep) => (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        readField(at, e.currentTarget.value);
    };

    /** Câmera: no IMEI 1 o par (IMEI 1 + IMEI 2) fecha o aparelho de uma vez. */
    const onCameraScan = (at: ReadStep, values: string[]) => {
        const [first, second] = values.map(v => String(v ?? '').trim()).filter(Boolean);
        if (!first) return;
        if (at === 'imei1' && second) {
            const current = { ...deviceRef.current, imei1: first, imei2: second };
            setDevice(current);
            commitDevice(current);
            return;
        }
        readField(at, first);
    };

    const counter = count === 1 ? '1 aparelho lido' : `${count} aparelhos lidos`;

    if (scanning && canRead && ready) {
        return (
            <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">{lockLabel}</p>
                    <button type="button" onClick={() => setScanning(false)} className="text-sm text-blue-600 underline">Alterar configuração</button>
                </div>
                <p className="text-xs text-slate-600">
                    Bipe o Serial, o IMEI 1 e o IMEI 2: o cursor avança sozinho e, depois do IMEI 2, o aparelho entra na lista.
                    Sem IMEI 2 (alguns tablets): toque em <strong>+</strong> ou aperte Enter no campo vazio.
                </p>
                <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    {READ_FIELDS.map(field => (
                        <div key={field.step}>
                            <label htmlFor={`scan-read-${field.step}`} className={labelCls}>{field.label}</label>
                            <div className="flex items-center gap-2">
                                <input
                                    id={`scan-read-${field.step}`} ref={fieldRefs[field.step]} autoFocus={field.step === step}
                                    type="text" inputMode={field.scanKind === 'imei' ? 'numeric' : 'text'} autoComplete="off" disabled={busy}
                                    value={device[field.step]} onFocus={() => setStep(field.step)}
                                    onChange={e => setDevice({ ...deviceRef.current, [field.step]: e.target.value })}
                                    onKeyDown={onFieldKey(field.step)}
                                    className={`flex h-11 w-full min-w-0 rounded-md border bg-white px-3 py-2 text-base tracking-wider ${step === field.step ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-300'}`}
                                />
                                <BarcodeScanButton kind={field.scanKind} allowPair={field.step === 'imei1'} disabled={busy}
                                    title={`Ler ${field.label} pela câmera`} onScan={values => onCameraScan(field.step, values)} />
                            </div>
                        </div>
                    ))}
                    <button type="button" disabled={busy} onClick={() => commitDevice(deviceRef.current)}
                        aria-label="Adicionar aparelho à lista" title="Adicionar aparelho à lista (sem IMEI 2)"
                        className="h-11 w-11 rounded-md bg-blue-600 text-xl font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                        +
                    </button>
                </div>
                {busy && <p role="status" className="text-sm font-medium text-amber-700">Aguarde…</p>}
                {feedback && <p role="alert" className="text-sm text-red-600">{feedback.text}</p>}
                <p aria-live="polite" className="text-sm font-medium text-slate-700">{counter}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {loadError && <p role="alert" className="text-sm text-red-600">{loadError}</p>}

            {fixed ? (
                <>
                    <FixedVariationCard variation={fixed} onChange={onClearFixed} />
                    {!fixed.isPhone && <p role="alert" className="text-sm text-red-600">Esta variação não é celular nem tablet. Use a aba Manual.</p>}
                </>
            ) : (
                <div>
                    <label htmlFor="scan-model" className={labelCls}>Modelo</label>
                    <SearchableSelect id="scan-model" value={modelId} options={models.map(m => m.id)} onChange={setModelId}
                        getOptionLabel={modelLabel} placeholder="Digite para buscar o modelo" />
                </div>
            )}

            {!variationId && model && categoryError && (
                <p role="alert" className="text-sm text-red-600">Não foi possível identificar a categoria do modelo.</p>
            )}
            {!variationId && model && isPhone === false && (
                <p role="alert" className="text-sm text-red-600">Bipar vale só para celulares e tablets (com IMEI). Use a aba Manual.</p>
            )}

            {!variationId && model && isPhone && (
                <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                        <label htmlFor="scan-ram" className={labelCls}>RAM</label>
                        <select id="scan-ram" className={fieldCls} value={ram} onChange={e => setRam(e.target.value)}>
                            <option value="">Selecione</option>
                            {RAM_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="scan-storage" className={labelCls}>Armazenamento</label>
                        <select id="scan-storage" className={fieldCls} value={storage} onChange={e => setStorage(e.target.value)}>
                            <option value="">Selecione</option>
                            {STORAGE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="scan-version" className={labelCls}>Versão</label>
                        <input id="scan-version" className={fieldCls} value={version} onChange={e => setVersion(e.target.value)} />
                    </div>
                    <div>
                        <label htmlFor="scan-condition" className={labelCls}>Condição</label>
                        <select id="scan-condition" className={fieldCls} value={condition} onChange={e => setCondition(e.target.value)}>
                            {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                    </div>
                    <div className="sm:col-span-2">
                        <span className={labelCls}>Cor</span>
                        {colorOptions.length > 0 ? (
                            <div className="flex flex-wrap gap-2" role="group" aria-label="Cor">
                                {colorOptions.map(name => (
                                    <button key={name} type="button" aria-pressed={color === name} onClick={() => setColor(name)}
                                        className={`px-3 py-1.5 rounded-full border text-sm ${color === name ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                                        {name}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <input aria-label="Cor" className={fieldCls} value={color} onChange={e => setColor(e.target.value)} placeholder="Cor" />
                        )}
                    </div>
                </div>
            )}

            {canRead && (
                <div className="grid gap-3 sm:grid-cols-2">
                    <CurrencyInput value={cost} onChange={setCost} label="Custo" />
                    <div>
                        <label htmlFor="scan-location" className={labelCls}>Local</label>
                        <select id="scan-location" className={fieldCls} value={locationId} onChange={e => setLocationId(e.target.value)}>
                            <EntryLocationOptions groups={locationGroups} />
                        </select>
                        {locationsError && <p role="alert" className="text-xs text-red-600 mt-1">Não foi possível carregar os locais.</p>}
                    </div>
                    {/* Variação fixa mantém os preços dela: o servidor ignora preço na linha com product_id. */}
                    {!fixed && (
                        <div className="sm:col-span-2 space-y-2">
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" checked={pricesOn} onChange={e => setPricesOn(e.target.checked)} />
                                Informar preços desta configuração
                            </label>
                            {pricesOn && (
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <CurrencyInput value={retail} onChange={setRetail} label="Varejo" />
                                    <CurrencyInput value={reseller} onChange={setReseller} label="Revenda" />
                                    <CurrencyInput value={wholesale} onChange={setWholesale} label="Atacado" />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {(ready || !fixed || fixedLocked) && (
                <div className="space-y-1">
                    <button type="button" disabled={busy || !ready} onClick={() => { setDevice(EMPTY_DEVICE); setStep('serial'); setScanning(true); setFeedback(null); }}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        Começar a bipar
                    </button>
                    <p className="text-xs text-slate-600">
                        {ready
                            ? 'Depois de começar, aparecem os campos Serial, IMEI 1 e IMEI 2.'
                            : `Para ler Serial, IMEI 1 e IMEI 2, falta: ${missing.join(', ')}.`}
                    </p>
                </div>
            )}
            {count > 0 && <p className="text-sm text-slate-600">{counter}</p>}
        </div>
    );
};

export default ScanEntryTab;
