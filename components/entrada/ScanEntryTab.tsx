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

const fieldCls = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';
const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

export const ScanEntryTab: React.FC<ScanEntryTabProps> = ({ onAddLines, existingState, fixed, onClearFixed, busy, costLocation }) => {
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
    const [reading, setReading] = useState('');
    const [feedback, setFeedback] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
    const [count, setCount] = useState(0);
    const seen = useRef<Set<string>>(new Set());
    const readerRef = useRef<HTMLInputElement>(null);

    // A lista da tela é a verdade: o ref só guarda leituras ainda não refletidas nela (corrida do leitor).
    useEffect(() => { seen.current = new Set(); }, [existingState.lines]);

    // Ao sair de "ocupado" na etapa de leitura, o campo volta a receber o leitor.
    useEffect(() => { if (!busy && scanning) readerRef.current?.focus(); }, [busy, scanning]);

    // Trocar de variação fixa volta para a configuração (as leituras eram da anterior).
    useEffect(() => { setScanning(false); setFeedback(null); }, [variationId]);

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
    const modelLabel = (id: string) => models.find(m => m.id === id)?.name || '';
    const labelOf = (l: Locked) => [l.name, l.color, [l.ram, l.storage].filter(Boolean).join('/')].filter(Boolean).join(' · ');
    const lockLabel = fixed ? [fixed.name, fixed.sku].filter(Boolean).join(' · ') : locked ? labelOf(locked) : '';
    const canRead = fixedLocked || Boolean(locked);

    const refocus = () => setTimeout(() => readerRef.current?.focus(), 0);

    const addRead = (values: string[]) => {
        if (!canRead || busy) return;
        const imeis = values.map(v => String(v ?? '').trim()).filter(Boolean);
        if (imeis.length === 0) return;
        if (imeis.some(v => !isValidImei(v)) || (imeis.length > 1 && imeis[0] === imeis[1])) {
            setFeedback({ kind: 'error', text: 'IMEI inválido' });
            return;
        }
        if (imeis.some(v => seen.current.has(v) || hasIdentity(existingState, v))) {
            setFeedback({ kind: 'error', text: 'IMEI já está na lista' });
            return;
        }
        imeis.forEach(v => seen.current.add(v));
        const identity = { imei1: imeis[0], imei2: imeis[1] || null, serial: null };
        if (fixed) {
            // O servidor usa o produto do product_id (configuração, cor, condição e preços dele).
            onAddLines([createShortcutLine(fixed, {
                identity, quantity: 1, cost_cents: cost, location_id: locationId, prices: null,
            }) as EntryLine]);
            setCount(n => n + 1);
            setFeedback(null);
            return;
        }
        if (!locked) return;
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
    };

    const onReaderKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const value = e.currentTarget.value.trim();
        setReading('');
        if (value) addRead([value]);
        refocus();
    };

    const counter = count === 1 ? '1 aparelho lido' : `${count} aparelhos lidos`;

    if (scanning && canRead && ready) {
        return (
            <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">{lockLabel}</p>
                    <button type="button" onClick={() => setScanning(false)} className="text-sm text-blue-600 underline">Alterar configuração</button>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        ref={readerRef} autoFocus type="text" inputMode="numeric" autoComplete="off" disabled={busy}
                        aria-label="Leitura de IMEI" placeholder="Bipe o IMEI e pressione Enter" value={reading}
                        onChange={e => setReading(e.target.value)} onKeyDown={onReaderKey}
                        className="flex h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-base tracking-wider"
                    />
                    <BarcodeScanButton kind="imei" allowPair disabled={busy} title="Usar câmera"
                        onScan={values => { addRead(values.slice(0, 2)); refocus(); }} />
                    <span className="text-sm text-slate-600 whitespace-nowrap">Usar câmera</span>
                    {busy && <span role="status" className="text-sm font-medium text-amber-700 whitespace-nowrap">Aguarde…</span>}
                </div>
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

            {ready && (
                <button type="button" disabled={busy} onClick={() => { setScanning(true); setFeedback(null); }}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    Começar a bipar
                </button>
            )}
            {count > 0 && <p className="text-sm text-slate-600">{counter}</p>}
        </div>
    );
};

export default ScanEntryTab;
