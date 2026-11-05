import React, { useEffect, useMemo, useState } from 'react';
import { modelService } from '../../services/models';
import { IMEIInput } from '../ui/IMEIInput';
import { CurrencyInput } from '../ui/CurrencyInput';
import { SearchableSelect } from '../ui/SearchableSelect';
import { createLine } from './entryList.js';
import { loadModelProfile, useEntryLocations } from './EntryLockFields';
import type { EntryLine } from './EntryListPanel';

export const RAM_OPTIONS = ['2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB', '18GB', '24GB'];
export const STORAGE_OPTIONS = ['16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB', '2TB'];
export const CONDITIONS: { value: string; label: string }[] = [
    { value: 'new', label: 'Novo' },
    { value: 'seminovo', label: 'Seminovo' },
    { value: 'used', label: 'Usado' },
    { value: 'open_box', label: 'Caixa aberta' },
];

interface ModelRow { id: string; name: string; category_id?: string | null }

export interface ManualEntryTabProps {
    onAddLines: (lines: EntryLine[]) => void;
    prefill?: { model_id?: string };
    /** Enquanto uma confirmação roda, não aceita novas linhas. */
    busy?: boolean;
}

const fieldCls = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';
const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

export const ManualEntryTab: React.FC<ManualEntryTabProps> = ({ onAddLines, prefill, busy }) => {
    const [models, setModels] = useState<ModelRow[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [categoryError, setCategoryError] = useState(false);

    const [modelId, setModelId] = useState(prefill?.model_id || '');
    const [isPhone, setIsPhone] = useState<boolean | null>(null);
    const [colorOptions, setColorOptions] = useState<string[]>([]);

    const [ram, setRam] = useState('');
    const [storage, setStorage] = useState('');
    const [version, setVersion] = useState('Global');
    const [condition, setCondition] = useState('new');
    const [conditionNote, setConditionNote] = useState('');
    const [color, setColor] = useState('');
    const [imei1, setImei1] = useState('');
    const [imei2, setImei2] = useState('');
    const [serial, setSerial] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [cost, setCost] = useState(0);
    const [locationId, setLocationId] = useState('');
    const { locations, locationsError } = useEntryLocations(setLocationId);
    const [pricesOn, setPricesOn] = useState(false);
    const [retail, setRetail] = useState(0);
    const [reseller, setReseller] = useState(0);
    const [wholesale, setWholesale] = useState(0);

    useEffect(() => {
        let alive = true;
        modelService.list()
            .then(list => { if (alive) setModels((list as ModelRow[]).filter(m => (m as { active?: boolean }).active !== false)); })
            .catch(() => { if (alive) setLoadError('Não foi possível carregar os modelos.'); });
        return () => { alive = false; };
    }, []);

    const model = useMemo(() => models.find(m => m.id === modelId) || null, [models, modelId]);

    useEffect(() => {
        let alive = true;
        setIsPhone(null);
        setCategoryError(false);
        setColorOptions([]);
        setColor('');
        // Trocar de modelo zera o que era do modelo anterior (custo e local ficam).
        setPricesOn(false); setRetail(0); setReseller(0); setWholesale(0);
        setImei1(''); setImei2(''); setSerial(''); setQuantity('1'); setConditionNote('');
        if (!model) return;
        (async () => {
            const profile = await loadModelProfile(model);
            if (!alive) return;
            setIsPhone(profile.isPhone);
            setColorOptions(profile.colorOptions);
        })().catch(() => { if (alive) setCategoryError(true); });
        return () => { alive = false; };
    }, [model]);

    const modelOptions = useMemo(() => models.map(m => m.id), [models]);
    const modelLabel = (id: string) => models.find(m => m.id === id)?.name || '';

    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    const canAdd = Boolean(model) && isPhone !== null && Boolean(locationId) && !busy;

    const handleAdd = () => {
        if (!model || isPhone === null || !locationId || busy) return;
        const phone = isPhone;
        const item = {
            source: 'manual',
            model_id: model.id,
            category_id: model.category_id ?? null,
            name: model.name,
            configuration: {
                ram: phone ? ram : '',
                storage: phone ? storage : '',
                version: phone ? version : '',
                network: '',
                condition,
            },
            color,
            condition_note: condition === 'seminovo' && conditionNote.trim() ? conditionNote.trim() : null,
            identity: phone
                ? { imei1: imei1.trim() || null, imei2: imei2.trim() || null, serial: serial.trim() || null }
                : { imei1: null, imei2: null, serial: null },
            quantity: phone ? 1 : qty,
            cost_cents: cost,
            location_id: locationId,
            prices: pricesOn ? { price_retail: retail, price_reseller: reseller, price_wholesale: wholesale } : null,
        };
        onAddLines([createLine(item, { source: 'manual' }) as EntryLine]);
        setImei1(''); setImei2(''); setSerial(''); setQuantity('1');
        if (phone) setTimeout(() => document.getElementById('manual-imei1')?.focus(), 0);
    };

    return (
        <div className="space-y-4">
            {loadError && <p role="alert" className="text-sm text-red-600">{loadError}</p>}

            <div>
                <label htmlFor="manual-model" className={labelCls}>Modelo</label>
                <SearchableSelect id="manual-model" value={modelId} options={modelOptions} onChange={setModelId}
                    getOptionLabel={modelLabel} placeholder="Digite para buscar o modelo" />
            </div>

            {model && categoryError && (
                <p role="alert" className="text-sm text-red-600">Não foi possível identificar a categoria do modelo.</p>
            )}

            {model && isPhone !== null && (
                <div className="grid gap-3 sm:grid-cols-2">
                    {isPhone && (
                        <>
                            <div>
                                <label htmlFor="manual-ram" className={labelCls}>RAM</label>
                                <select id="manual-ram" className={fieldCls} value={ram} onChange={e => setRam(e.target.value)}>
                                    <option value="">Selecione</option>
                                    {RAM_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="manual-storage" className={labelCls}>Armazenamento</label>
                                <select id="manual-storage" className={fieldCls} value={storage} onChange={e => setStorage(e.target.value)}>
                                    <option value="">Selecione</option>
                                    {STORAGE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="manual-version" className={labelCls}>Versão</label>
                                <input id="manual-version" className={fieldCls} value={version} onChange={e => setVersion(e.target.value)} />
                            </div>
                        </>
                    )}
                    <div>
                        <label htmlFor="manual-condition" className={labelCls}>Condição</label>
                        <select id="manual-condition" className={fieldCls} value={condition} onChange={e => setCondition(e.target.value)}>
                            {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                    </div>
                    {condition === 'seminovo' && (
                        <div className="sm:col-span-2">
                            <label htmlFor="manual-note" className={labelCls}>Observação do seminovo</label>
                            <input id="manual-note" className={fieldCls} value={conditionNote} onChange={e => setConditionNote(e.target.value)} />
                        </div>
                    )}

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
                            <input aria-label="Cor" className={fieldCls} value={color} onChange={e => setColor(e.target.value)} placeholder="Cor (opcional)" />
                        )}
                    </div>

                    {isPhone ? (
                        <>
                            <IMEIInput id="manual-imei1" label="IMEI 1" value={imei1} onChange={setImei1} checkRegistered={false}
                                onScanPair={values => { setImei1(values[0] || ''); setImei2(values[1] || ''); }} />
                            <IMEIInput id="manual-imei2" label="IMEI 2" value={imei2} onChange={setImei2} checkRegistered={false} />
                            <div>
                                <label htmlFor="manual-serial" className={labelCls}>Serial</label>
                                <input id="manual-serial" className={fieldCls} value={serial} onChange={e => setSerial(e.target.value)} />
                            </div>
                        </>
                    ) : (
                        <div>
                            <label htmlFor="manual-qty" className={labelCls}>Quantidade</label>
                            <input id="manual-qty" type="number" min={1} step={1} className={fieldCls} value={quantity} onChange={e => setQuantity(e.target.value)} />
                        </div>
                    )}

                    <div>
                        <CurrencyInput value={cost} onChange={setCost} label="Custo" />
                        {cost === 0 && <p className="text-xs text-amber-700 mt-1">Custo zerado</p>}
                    </div>
                    <div>
                        <label htmlFor="manual-location" className={labelCls}>Local</label>
                        <select id="manual-location" className={fieldCls} value={locationId} onChange={e => setLocationId(e.target.value)}>
                            <option value="">Selecione o local</option>
                            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                        {locationsError && <p role="alert" className="text-xs text-red-600 mt-1">Não foi possível carregar os locais.</p>}
                        {!locationId && !locationsError && <p className="text-xs text-amber-700 mt-1">Escolha o local de estoque.</p>}
                    </div>

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
                </div>
            )}

            <button type="button" onClick={handleAdd} disabled={!canAdd}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Adicionar à lista
            </button>
        </div>
    );
};

export default ManualEntryTab;
