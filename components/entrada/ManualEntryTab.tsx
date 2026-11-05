import React, { useEffect, useMemo, useState } from 'react';
import { modelService } from '../../services/models';
import { categoryService } from '../../services/categories';
import { colorService } from '../../services/colors';
import { modelColorImagesService } from '../../services/model-color-images';
import { stockLocationService } from '../../services/stockLocationService';
import { isSmartphoneModel } from '../../services/smartphoneModelSpecs.mjs';
import { IMEIInput } from '../ui/IMEIInput';
import { CurrencyInput } from '../ui/CurrencyInput';
import { SearchableSelect } from '../ui/SearchableSelect';
import { createLine } from './entryList.js';
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
interface LocationRow { id: string; name: string; is_default?: boolean; is_active?: boolean }

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
    const [locations, setLocations] = useState<LocationRow[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);

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
    const [pricesOn, setPricesOn] = useState(false);
    const [retail, setRetail] = useState(0);
    const [reseller, setReseller] = useState(0);
    const [wholesale, setWholesale] = useState(0);

    useEffect(() => {
        let alive = true;
        modelService.list()
            .then(list => { if (alive) setModels((list as ModelRow[]).filter(m => (m as { active?: boolean }).active !== false)); })
            .catch(() => { if (alive) setLoadError('Não foi possível carregar os modelos.'); });
        stockLocationService.listLocations()
            .then(list => {
                if (!alive) return;
                const active = (list as LocationRow[]).filter(l => l.is_active !== false);
                setLocations(active);
                setLocationId(current => current || active.find(l => l.is_default)?.id || '');
            })
            .catch(() => { /* local é opcional */ });
        return () => { alive = false; };
    }, []);

    const model = useMemo(() => models.find(m => m.id === modelId) || null, [models, modelId]);

    useEffect(() => {
        let alive = true;
        setIsPhone(null);
        setColorOptions([]);
        setColor('');
        if (!model) return;
        (async () => {
            const [category, rows, colors] = await Promise.all([
                model.category_id ? categoryService.getById(model.category_id).catch(() => null) : Promise.resolve(null),
                modelColorImagesService.getByModel(model.id).catch(() => []),
                colorService.list().catch(() => []),
            ]);
            if (!alive) return;
            setIsPhone(isSmartphoneModel({ category_name: category?.name }));
            const names = new Map((colors as { id: string; name: string }[]).map(c => [c.id, c.name]));
            const withPhoto = (rows as { color_id: string; images?: string[]; image_url?: string | null }[])
                .filter(r => (r.images && r.images.length > 0) || r.image_url)
                .map(r => names.get(r.color_id))
                .filter((n): n is string => Boolean(n));
            setColorOptions(Array.from(new Set(withPhoto)));
        })();
        return () => { alive = false; };
    }, [model]);

    const modelOptions = useMemo(() => models.map(m => m.id), [models]);
    const modelLabel = (id: string) => models.find(m => m.id === id)?.name || '';

    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    const canAdd = Boolean(model) && isPhone !== null && !busy;

    const handleAdd = () => {
        if (!model || isPhone === null || busy) return;
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
            location_id: locationId || null,
            prices: pricesOn ? { price_retail: retail, price_reseller: reseller, price_wholesale: wholesale } : null,
        };
        onAddLines([createLine(item, { source: 'manual' }) as EntryLine]);
        setImei1(''); setImei2(''); setSerial(''); setQuantity('1');
    };

    return (
        <div className="space-y-4">
            {loadError && <p role="alert" className="text-sm text-red-600">{loadError}</p>}

            <div>
                <label htmlFor="manual-model" className={labelCls}>Modelo</label>
                <SearchableSelect id="manual-model" value={modelId} options={modelOptions} onChange={setModelId}
                    getOptionLabel={modelLabel} placeholder="Digite para buscar o modelo" />
            </div>

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

                    <CurrencyInput value={cost} onChange={setCost} label="Custo" />
                    <div>
                        <label htmlFor="manual-location" className={labelCls}>Local</label>
                        <select id="manual-location" className={fieldCls} value={locationId} onChange={e => setLocationId(e.target.value)}>
                            <option value="">Sem local</option>
                            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
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
