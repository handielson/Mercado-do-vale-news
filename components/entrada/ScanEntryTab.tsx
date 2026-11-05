import React, { useEffect, useMemo, useRef, useState } from 'react';
import { modelService } from '../../services/models';
import { productService } from '../../services/products';
import { BarcodeScanButton } from '../ui/BarcodeScanButton';
import { CurrencyInput } from '../ui/CurrencyInput';
import { SearchableSelect } from '../ui/SearchableSelect';
import { createLine, hasIdentity, isValidImei } from './entryList.js';
import { loadModelProfile, useEntryLocations, type ModelRef } from './EntryLockFields';
import { CONDITIONS, RAM_OPTIONS, STORAGE_OPTIONS } from './ManualEntryTab';
import type { EntryLine, EntryState } from './EntryListPanel';

export interface ScanEntryTabProps {
    onAddLines: (lines: EntryLine[]) => void;
    /** Lista atual da tela, para detectar leituras repetidas. */
    existingState: EntryState;
    prefill?: { variation_id?: string };
    /** Enquanto uma confirmação roda, não aceita leituras. */
    busy?: boolean;
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

export const ScanEntryTab: React.FC<ScanEntryTabProps> = ({ onAddLines, existingState, prefill, busy }) => {
    const variationId = prefill?.variation_id || '';

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
    const [cost, setCost] = useState(0);
    const [locationId, setLocationId] = useState('');
    const { locations, locationsError } = useEntryLocations(setLocationId);

    const [variation, setVariation] = useState<Locked | null>(null);
    const [scanning, setScanning] = useState(false);
    const [reading, setReading] = useState('');
    const [feedback, setFeedback] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
    const [count, setCount] = useState(0);
    const seen = useRef<Set<string>>(new Set());
    const readerRef = useRef<HTMLInputElement>(null);

    // Atalho ?variacao=: trava tudo a partir do produto.
    useEffect(() => {
        if (!variationId) { setVariation(null); return; }
        let alive = true;
        setLoadError(null);
        productService.getById(variationId)
            .then(product => {
                if (!alive) return;
                if (!product) { setLoadError('Não foi possível carregar a variação.'); return; }
                const p = product as { name?: string; model_id?: string; category_id?: string | null; specs?: Record<string, string> };
                const specs = p.specs || {};
                setVariation({
                    model_id: p.model_id || '',
                    category_id: p.category_id ?? null,
                    name: p.name || '',
                    ram: specs.ram || '',
                    storage: specs.storage || '',
                    version: specs.version || 'Global',
                    condition: specs.condition || 'new',
                    color: specs.color || '',
                });
            })
            .catch(() => { if (alive) setLoadError('Não foi possível carregar a variação.'); });
        return () => { alive = false; };
    }, [variationId]);

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

    const locked: Locked | null = variationId
        ? variation
        : (model && isPhone ? {
            model_id: model.id, category_id: model.category_id ?? null, name: model.name,
            ram, storage, version: version.trim(), condition, color,
        } : null);

    const ready = Boolean(locked && locked.model_id && locked.ram && locked.storage && locked.color && cost > 0 && locationId);
    const modelLabel = (id: string) => models.find(m => m.id === id)?.name || '';
    const lockLabel = locked ? `${locked.name} · ${locked.color || 'sem cor'} · ${locked.ram}/${locked.storage}` : '';

    const refocus = () => setTimeout(() => readerRef.current?.focus(), 0);

    const addRead = (values: string[]) => {
        if (!locked || busy) return;
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
        const item = {
            source: 'bipar',
            model_id: locked.model_id,
            category_id: locked.category_id,
            name: locked.name,
            configuration: { ram: locked.ram, storage: locked.storage, version: locked.version, network: '', condition: locked.condition },
            color: locked.color,
            condition_note: null,
            identity: { imei1: imeis[0], imei2: imeis[1] || null, serial: null },
            quantity: 1,
            cost_cents: cost,
            location_id: locationId,
            prices: null,
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

    if (scanning && locked && ready) {
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
                </div>
                {feedback && <p role="alert" className="text-sm text-red-600">{feedback.text}</p>}
                <p aria-live="polite" className="text-sm font-medium text-slate-700">{counter}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {loadError && <p role="alert" className="text-sm text-red-600">{loadError}</p>}

            {variationId ? (
                variation && <p className="text-sm font-medium text-slate-800">{lockLabel}</p>
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
                <p role="alert" className="text-sm text-red-600">Bipar vale só para celulares (com IMEI). Use a aba Manual.</p>
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

            {locked && (
                <div className="grid gap-3 sm:grid-cols-2">
                    <CurrencyInput value={cost} onChange={setCost} label="Custo" />
                    <div>
                        <label htmlFor="scan-location" className={labelCls}>Local</label>
                        <select id="scan-location" className={fieldCls} value={locationId} onChange={e => setLocationId(e.target.value)}>
                            <option value="">Selecione o local</option>
                            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                        {locationsError && <p role="alert" className="text-xs text-red-600 mt-1">Não foi possível carregar os locais.</p>}
                    </div>
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
