import React, { useEffect, useState } from 'react';
import type { Print3dSetup } from '../../services/print3dRegistration';
import { createPortal } from 'react-dom';
import { ProductForm } from './ProductForm';
import { Product, ProductInput } from '../../types/product';
import { addSmartphoneFamilyConfiguration, buildAttributeVariationDraft, FAMILY_VARIATION_ATTRIBUTES, setSmartphoneFamilyConfigurationPrice, smartphoneFamilyConfigurationKey } from './familyRegistration.js';
import { ColorSelect } from './selectors/ColorSelect';
import { CapacitySelect } from './selectors/CapacitySelect';
import { MaterialSelect } from './selectors/MaterialSelect';
import { EANInput } from '../ui/EANInput';
import { VariationMedia } from './VariationMedia';
import { VariationListing } from './VariationListing';
import { CurrencyInput } from '../ui/CurrencyInput';
import { smartphonePriceGroups, type SmartphonePriceReference, type SmartphonePriceGroup } from '../../services/smartphonePriceGroups';
import { nextVariationSku } from '@mdv/product-sku';

export type FamilyRow = { key: string; data: ProductInput & { id?: string }; inheritImages: boolean; videoFile?: File | null };
export type FamilyEditorDraft = {
    adding: boolean; attributes: Array<{ key: string; value: string }>; variationSku: string; variationEans: string[];
    media: { images: string[]; inheritImages: boolean; videoUrl: string; inheritVideo: boolean; listing: Partial<ProductInput>; videoFile: File | null };
    draftKey: string;
    configuration?: { colors: string[]; ram: string; storage: string };
};

export function ProductFamilyEditor({ parent, rows, onChange, disabled, smartphone = false, onBusyChange, onDraftChange, initialDraft, captureDraftRef, productionSetups, onProductionChange }: {
    parent: ProductInput; rows: FamilyRow[]; onChange: (rows: FamilyRow[]) => void; disabled: boolean; smartphone?: boolean;
    onBusyChange?: (busy: boolean) => void;
    onDraftChange?: () => void;
    initialDraft?: FamilyEditorDraft;
    captureDraftRef?: React.MutableRefObject<(() => FamilyEditorDraft) | undefined>;
    productionSetups?: Record<string,Print3dSetup | undefined>;
    onProductionChange?: (key:string, setup:Print3dSetup | undefined) => void;
}) {
    const [editing, setEditing] = useState<FamilyRow | null>(null);
    const [adding, setAdding] = useState(initialDraft?.adding || false);
    const [attributes, setAttributes] = useState(initialDraft?.attributes || [{ key: 'color', value: '' }]);
    const [attributeError, setAttributeError] = useState('');
    const [variationSku, setVariationSku] = useState(initialDraft?.variationSku || '');
    const [variationEans, setVariationEans] = useState<string[]>(initialDraft?.variationEans || []);
    const [media, setMedia] = useState(initialDraft?.media || { images: [] as string[], inheritImages: true, videoUrl: '', inheritVideo: false, listing: {} as Partial<ProductInput>, videoFile: null as File | null });
    const [draftKey, setDraftKey] = useState(initialDraft?.draftKey || '');
    const [configuration, setConfiguration] = useState(initialDraft?.configuration || { colors: [] as string[], ram: '', storage: '' });
    const [configurationMessage, setConfigurationMessage] = useState('');
    const [configurationError, setConfigurationError] = useState('');
    const [expandedRows, setExpandedRows] = useState<string[]>([]);
    if (captureDraftRef) captureDraftRef.current = () => ({ adding, attributes, variationSku, variationEans, media, draftKey, configuration });
    const mountedDraftRef = React.useRef(false);
    useEffect(() => {
        if (mountedDraftRef.current) onDraftChange?.();
        else mountedDraftRef.current = true;
    }, [adding, attributes, variationSku, variationEans, media, draftKey, configuration]);
    const [busyKeys, setBusyKeys] = useState<string[]>([]);
    const [priceReferences, setPriceReferences] = useState<Record<string, SmartphonePriceReference>>({});
    const [priceReferenceError, setPriceReferenceError] = useState('');
    const [inventoryGroups, setInventoryGroups] = useState<SmartphonePriceGroup[]>([]);
    const [inventoryLoading, setInventoryLoading] = useState(false);
    const [inventoryError, setInventoryError] = useState('');
    const [inventoryReload, setInventoryReload] = useState(0);
    const busy = busyKeys.length > 0;
    useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
    const mediaBusy = (key: string, active: boolean) => setBusyKeys(keys => active ? [...new Set([...keys, key])] : keys.filter(item => item !== key));
    const add = () => {
        setAttributes([{ key: 'color', value: '' }]);
        setAttributeError('');
        setVariationSku('');
        setVariationEans([]);
        setMedia({ images: [], inheritImages: true, videoUrl: '', inheritVideo: false, listing: {}, videoFile: null });
        setDraftKey(crypto.randomUUID());
        setAdding(true);
    };
    const confirmAttributes = () => {
        try {
            const data = buildAttributeVariationDraft({ ...parent, id: undefined }, attributes, rows, { sku: variationSku, eans: variationEans, ...media }) as ProductInput;
            onChange([...rows, { key: draftKey, data, inheritImages: media.inheritImages, videoFile: media.videoFile }]);
            setAdding(false);
            setAttributeError('');
        } catch (error) {
            setAttributeError(error instanceof Error ? error.message : 'Confira os atributos.');
        }
    };
    const knownColors = [...new Set(rows.map(row => String(row.data.specs?.color || '').trim()).filter(Boolean))];
    const updateConfiguration = (patch: Partial<typeof configuration>) => {
        setConfiguration(current => ({ ...current, ...patch }));
        setConfigurationError(''); setConfigurationMessage('');
    };
    const addConfiguration = () => {
        try {
            const result = addSmartphoneFamilyConfiguration(parent, rows, configuration, () => crypto.randomUUID());
            onChange(result.rows);
            setConfigurationError('');
            setConfigurationMessage(`${result.added} nova(s), ${result.completed} completada(s) e ${result.skipped} já existente(s). Salve a família para confirmar.`);
        } catch (error) { setConfigurationError(error instanceof Error ? error.message : 'Confira a configuração.'); }
    };
    const priceGroups = new Map<string, FamilyRow[]>();
    if (smartphone) for (const row of rows) {
        const key = smartphoneFamilyConfigurationKey(row.data);
        if (key) priceGroups.set(key, [...(priceGroups.get(key) || []), row]);
    }
    const priceGroupSignature = JSON.stringify([...priceGroups.keys()]);
    const inventorySignature = JSON.stringify(rows.map(row => row.data.id || '').filter(Boolean).sort());
    const hasPriceGroups = priceGroups.size > 0;
    useEffect(() => {
        setInventoryGroups([]); setInventoryError('');
        if (!smartphone || !parent.model_id || !hasPriceGroups) { setInventoryLoading(false); return; }
        let active = true;
        setInventoryLoading(true);
        smartphonePriceGroups.list(parent.model_id).then(result => {
            if (active) setInventoryGroups(result.groups);
        }).catch(error => {
            if (active) setInventoryError(error instanceof Error ? error.message : 'Não foi possível consultar o custo médio em estoque.');
        }).finally(() => { if (active) setInventoryLoading(false); });
        return () => { active = false; };
    }, [smartphone, parent.model_id, hasPriceGroups, inventorySignature, inventoryReload]);
    useEffect(() => {
        if (!smartphone || !parent.model_id || !priceGroups.size) return;
        let active = true;
        setPriceReferenceError('');
        const entries = [...priceGroups.entries()];
        Promise.all(entries.map(async ([key, groupRows]) => [key, await smartphonePriceGroups.reference(parent.model_id!, groupRows[0].data)] as const))
            .then(references => {
                if (!active) return;
                setPriceReferences(Object.fromEntries(references));
                let nextRows = rows;
                for (const [key, reference] of references) {
                    if (!reference.established || !reference.prices || !priceGroups.get(key)?.some(row => !row.data.id)) continue;
                    const source = priceGroups.get(key)?.[0];
                    if (!source) continue;
                    for (const field of ['price_retail', 'price_reseller', 'price_wholesale'] as const) {
                        nextRows = setSmartphoneFamilyConfigurationPrice(nextRows, source.key, field, reference.prices[field]);
                    }
                }
                if (nextRows !== rows) onChange(nextRows);
            })
            .catch(error => { if (active) setPriceReferenceError(error instanceof Error ? error.message : 'Não foi possível consultar os preços existentes.'); });
        return () => { active = false; };
    }, [smartphone, parent.model_id, priceGroupSignature]);
    return <section className="rounded-xl border border-blue-200 bg-white p-5 space-y-4" aria-label="Variações da família">
        <div className="flex justify-between gap-3"><h3 className="font-semibold">Variações ({rows.length})</h3>
            {!smartphone && <button type="button" disabled={disabled || busy || adding || !parent.name?.trim()} onClick={add} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">Adicionar variação</button>}</div>
        <p className="text-sm text-slate-600">{smartphone ? 'Selecione as cores e a configuração de memória. Ao salvar a família, as configurações com varejo, revenda e atacado preenchidos serão cadastradas. As configurações sem os três preços continuam no rascunho para preencher depois.' : 'Adicione os filhos aqui. Escolha dados próprios ou herdados do pai. Cada novo SKU complementa o código do pai; códigos já salvos não mudam. Cada variação pode ter vários EANs da mesma configuração. Os filhos são gravados ao salvar a família.'}</p>
        {smartphone && <fieldset disabled={disabled || busy} className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 space-y-4" aria-label="Adicionar configuração de memória">
            <legend className="font-semibold px-1">Adicionar configuração</legend>
            <div className="space-y-2">
                <p className="text-sm font-medium">Cores desta configuração</p>
                <div className="flex flex-wrap gap-2" aria-label="Selecionar cores">
                    {[...new Set([...knownColors, ...configuration.colors])].map(color => <button key={color} type="button" aria-pressed={configuration.colors.includes(color)}
                        onClick={() => updateConfiguration({ colors: configuration.colors.includes(color) ? configuration.colors.filter(item => item !== color) : [...configuration.colors, color] })}
                        className={`rounded-full border px-3 py-1.5 text-sm ${configuration.colors.includes(color) ? 'border-blue-600 bg-blue-100 text-blue-900' : 'border-slate-300 bg-white'}`}>{color}</button>)}
                    {knownColors.length > 0 && <button type="button" className="text-sm text-blue-700 underline" onClick={() => updateConfiguration({ colors: [...new Set([...configuration.colors, ...knownColors])] })}>Selecionar todas as cores</button>}
                </div>
                <ColorSelect modelId={parent.model_id || undefined} value="" onChange={color => { if (color) updateConfiguration({ colors: [...new Set([...configuration.colors, color])] }); }} />
                <p className="text-xs text-slate-600">Escolha uma ou mais cores. Clique em uma cor selecionada para desmarcar.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                <div><p className="text-sm font-medium mb-1">Memória RAM</p><CapacitySelect type="ram" label="Memória RAM" value={configuration.ram} placeholder="Selecione a memória RAM" onChange={ram => updateConfiguration({ ram })} /></div>
                <div><p className="text-sm font-medium mb-1">Armazenamento</p><CapacitySelect type="storage" label="Armazenamento" value={configuration.storage} placeholder="Selecione o armazenamento" onChange={storage => updateConfiguration({ storage })} /></div>
            </div>
            <p className="text-sm text-slate-700">{configuration.colors.length && configuration.ram && configuration.storage ? `${configuration.ram} / ${configuration.storage}: ${configuration.colors.join(', ')}.` : 'Exemplo: selecione Preto e Branco, RAM 12GB e armazenamento 512GB.'} Combinações existentes serão mantidas.</p>
            {configurationError && <p role="alert" className="text-sm text-red-700">{configurationError}</p>}
            {configurationMessage && <p role="status" className="text-sm text-emerald-800">{configurationMessage}</p>}
            <button type="button" disabled={!parent.name?.trim() || !configuration.colors.length || !configuration.ram || !configuration.storage}
                onClick={addConfiguration} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">Adicionar às cores selecionadas</button>
        </fieldset>}
        {adding && <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 space-y-3" aria-label="Atributos da nova variação">
            <h4 className="font-medium">Defina a variação</h4>
            <div className="grid gap-4 xl:grid-cols-2 items-start">
            <div className="space-y-3">
            {attributes.map((attribute, index) => <div key={index} className="grid gap-3 sm:grid-cols-[1fr_2fr] items-end">
                <label className="text-sm">Atributo
                    <select aria-label={`Atributo ${index + 1}`} disabled={disabled || busy} value={attribute.key}
                        onChange={e => { setAttributeError(''); setAttributes(attributes.map((item, i) => i === index ? { key: e.target.value, value: '' } : item)); }}
                        className="mt-1 w-full rounded-lg border p-2">
                        {FAMILY_VARIATION_ATTRIBUTES.filter(option => option.key === attribute.key || !attributes.some(item => item.key === option.key)).map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
                    </select>
                </label>
                <fieldset disabled={disabled || busy} className="min-w-0"><legend className="text-sm mb-1">{FAMILY_VARIATION_ATTRIBUTES.find(item => item.key === attribute.key)?.label}</legend>
                    {attribute.key === 'color' ? <ColorSelect modelId={parent.model_id || undefined} value={attribute.value} onChange={value => setAttributes(attributes.map((item, i) => i === index ? { ...item, value } : item))} />
                        : attribute.key === 'ram' || attribute.key === 'storage' ? <CapacitySelect
                            type={attribute.key} value={attribute.value}
                            label={attribute.key === 'ram' ? 'Memória RAM' : 'Armazenamento'}
                            placeholder={attribute.key === 'ram' ? 'Selecione a memória RAM' : 'Selecione o armazenamento'}
                            onChange={value => setAttributes(attributes.map((item, i) => i === index ? { ...item, value } : item))}
                        />
                        : attribute.key === 'material' ? <MaterialSelect label="Valor do material" value={attribute.value} onChange={value => setAttributes(attributes.map((item, i) => i === index ? { ...item, value } : item))} />
                        : <input aria-label={`Valor de ${FAMILY_VARIATION_ATTRIBUTES.find(item => item.key === attribute.key)?.label}`} value={attribute.value} maxLength={80}
                            onChange={e => setAttributes(attributes.map((item, i) => i === index ? { ...item, value: e.target.value } : item))}
                            className="w-full rounded-lg border p-2" placeholder="Informe o valor" />}
                </fieldset>
                <button type="button" disabled={disabled || busy || attributes.length === 1} onClick={() => setAttributes(attributes.filter((_, i) => i !== index))} className="p-2 text-red-700 disabled:opacity-40">Remover atributo</button>
            </div>)}
            {attributes.length < FAMILY_VARIATION_ATTRIBUTES.length && <button type="button" disabled={disabled || busy} className="text-blue-700 underline"
                onClick={() => { const next = FAMILY_VARIATION_ATTRIBUTES.find(option => !attributes.some(item => item.key === option.key)); if (next) setAttributes([...attributes, { key: next.key, value: '' }]); }}>Adicionar outro atributo</button>}
            <fieldset disabled={disabled || busy} className="grid gap-4">
                <label className="text-sm">SKU da variação
                    <input aria-label="SKU da nova variação" value={variationSku} onChange={e => setVariationSku(e.target.value)} placeholder={parent.sku ? nextVariationSku(parent.sku, rows.map(row => row.data.sku)) : 'SKU do pai + complemento (ex.: MINI0001-01)'} className="mt-1 w-full rounded-lg border p-2" />
                    <span className="mt-1 block text-xs text-slate-500">Deixe vazio para reservar o complemento numérico ao salvar. O pai será salvo primeiro. SKUs existentes nunca mudam.</span>
                </label>
                <EANInput label="EANs da variação" value={variationEans} onChange={setVariationEans} maxEANs={20} allowGenerate={false} />
            </fieldset>
            </div>
            <VariationMedia key={draftKey} productId={draftKey} sku={variationSku} name="nova variação" parentImages={parent.images || []} parentVideo={parent.video_url || ''} {...media} disabled={disabled || busy}
                onChange={next => setMedia(current => ({ ...current, ...next }))} onBusyChange={active => mediaBusy(draftKey, active)} />
            </div>
            <VariationListing fresh hidePrices={smartphone} parent={parent} data={media.listing || {}} disabled={disabled || busy} onChange={listing => setMedia(current => ({ ...current, listing }))} />
            {attributeError && <p role="alert" className="text-sm text-red-700">{attributeError}</p>}
            <div className="flex justify-end gap-3">
                <button type="button" disabled={disabled || busy} onClick={() => setAdding(false)}>Cancelar variação</button>
                <button type="button" disabled={disabled || busy} onClick={confirmAttributes} className="rounded-lg bg-blue-600 px-4 py-2 text-white">Incluir variação na família</button>
            </div>
        </div>}
        {smartphone && rows.length > 0 && <section aria-label="Preços das configurações" className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
            <h4 className="font-semibold text-emerald-950">Preços por configuração</h4>
            <p className="text-sm text-slate-700">Cores com a mesma memória usam os mesmos preços. O custo médio de compra consulta os aparelhos em estoque da configuração; ele não altera os preços de venda.</p>
            <button type="button" disabled={inventoryLoading} onClick={() => setInventoryReload(value => value + 1)} className="text-sm text-blue-700 underline disabled:opacity-50">Atualizar custo médio em estoque</button>
            {inventoryError && <p role="alert" className="text-sm text-red-700">Não foi possível consultar o custo médio em estoque. Tente atualizar novamente.</p>}
            {priceReferenceError && <p role="alert" className="text-sm text-red-700">Não foi possível conferir os grupos existentes: {priceReferenceError}</p>}
            {rows.some(row => !row.data.id && !smartphoneFamilyConfigurationKey(row.data)) && <p className="text-sm text-amber-800">Selecione as cores pendentes em “Adicionar configuração” e informe RAM e armazenamento para liberar os preços.</p>}
            {[...priceGroups.values()].map(groupRows => {
                const first = groupRows[0];
                const specs = first.data.specs || {};
                const reference = priceReferences[smartphoneFamilyConfigurationKey(first.data)];
                const inventoryGroup = inventoryGroups.find(group => group.id === reference?.group_id);
                const averageCost = inventoryGroup?.cost_average_in_stock;
                return <div key={first.key} className="rounded-lg border border-emerald-200 bg-white p-3 space-y-2">
                    <p className="font-medium">{specs.ram} / {specs.storage} {specs.version ? `· ${specs.version}` : ''} <span className="text-sm font-normal text-slate-600">· {groupRows.map(row => row.data.specs?.color).filter(Boolean).join(', ')}</span></p>
                    <p className="text-sm text-slate-700" aria-label={`Custo médio em estoque ${specs.ram} / ${specs.storage}`}><strong>Custo médio de compra em estoque: </strong>{inventoryLoading ? 'Consultando…' : inventoryError || priceReferenceError ? 'Consulta indisponível' : !reference ? 'Consultando…' : averageCost != null ? (averageCost / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Sem custo de compra em estoque'}<span className="block text-xs text-slate-500">Média das cores desta configuração, conforme o estoque cadastrado.</span></p>
                    {reference?.established && <p className="text-xs text-blue-800">{reference.prices ? 'Esta configuração já tem preços definidos. Os valores existentes foram carregados e serão mantidos.' : 'Esta configuração tem preços divergentes. Resolva a divergência em Gestão de Modelos antes de incluir outra cor.'}</p>}
                    <div className="grid gap-3 sm:grid-cols-3">{(['price_retail', 'price_reseller', 'price_wholesale'] as const).map((field, index) =>
                        <fieldset key={field} disabled={disabled || busy || !reference || !!reference.established || !!priceReferenceError || groupRows.every(row => !!row.data.id)}><CurrencyInput label={['Varejo', 'Revenda', 'Atacado'][index]} value={Number(first.data[field]) || 0}
                            onChange={value => onChange(setSmartphoneFamilyConfigurationPrice(rows, first.key, field, value))} /></fieldset>)}</div>
                </div>;
            })}
        </section>}
        {rows.map(row => <div key={row.key} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
            {(row.inheritImages ? parent.images : row.data.images)?.[0] && <img src={(row.inheritImages ? parent.images : row.data.images)?.[0]} alt="" className="h-12 w-12 object-contain" />}
            <div className="flex-1"><p className="font-medium">{row.data.name}</p>
                <p className="text-sm text-slate-600">{FAMILY_VARIATION_ATTRIBUTES.filter(attribute => row.data.specs?.[attribute.key]).map(attribute => `${attribute.label}: ${row.data.specs?.[attribute.key]}`).join(' · ')}</p>
                <p className="text-xs text-slate-500">{row.data.sku || 'SKU automático ao salvar'} · {row.data.specs?.condition === 'used' ? 'Usado' : 'Novo'} · Estoque: {row.data.stock_quantity ?? 0}</p></div>
            <button type="button" disabled={disabled || busy} aria-expanded={smartphone ? expandedRows.includes(row.key) : undefined}
                onClick={() => smartphone ? setExpandedRows(current => current.includes(row.key) ? current.filter(key => key !== row.key) : [...current, row.key]) : setEditing(row)} className="text-blue-700 underline">{smartphone && expandedRows.includes(row.key) ? 'Recolher detalhes' : 'Editar detalhes'}</button>
            {!row.data.id && <button type="button" disabled={disabled || busy} onClick={() => onChange(rows.filter(r => r.key !== row.key))} className="text-red-700">Remover rascunho</button>}
            <div hidden={smartphone && !expandedRows.includes(row.key)} className="w-full space-y-4">
            {smartphone && <button type="button" disabled={disabled || busy} onClick={() => setEditing(row)} className="text-blue-700 underline">Abrir cadastro completo da variação</button>}
            {smartphone && !row.data.id && <fieldset disabled={disabled || busy} className="grid w-full gap-3 sm:grid-cols-2" aria-label={`Memória da variação ${row.data.specs?.color || row.data.name}`}>
                {(['ram', 'storage'] as const).map(type => <CapacitySelect key={type} type={type} value={String(row.data.specs?.[type] || '')}
                    label={type === 'ram' ? 'Memória RAM' : 'Armazenamento'}
                    placeholder={type === 'ram' ? 'Selecione a memória RAM' : 'Selecione o armazenamento'}
                    onChange={value => onChange(rows.map(item => {
                        if (item.key !== row.key) return item;
                        const specs = { ...item.data.specs, [type]: value };
                        const name = `${parent.name} - ${[specs.color, specs.ram, specs.storage].filter(Boolean).join(' / ')}`;
                        return { ...item, data: { ...item.data, specs, name } };
                    }))} />)}
                {(!row.data.specs?.ram || !row.data.specs?.storage) && <p className="text-xs text-amber-800 sm:col-span-2">Complete RAM e armazenamento antes de salvar esta variação de celular.</p>}
            </fieldset>}
            <fieldset disabled={disabled || busy} className="grid w-full gap-4">
                <label className="text-sm">SKU da variação
                    <input aria-label={`SKU da variação ${row.data.name}`} readOnly={Boolean(row.data.id)} value={row.data.sku || ''}
                        onChange={e => onChange(rows.map(item => item.key === row.key ? { ...item, data: { ...item.data, sku: e.target.value } } : item))}
                        placeholder="Automático ao salvar" className="mt-1 w-full rounded-lg border p-2 read-only:bg-slate-100" />
                    {row.data.id && <span className="mt-1 block text-xs text-slate-500">SKU do sistema: não pode ser alterado.</span>}
                </label>
                <EANInput label={`EANs da variação ${row.data.name}`} value={row.data.eans || []} maxEANs={20} allowGenerate={false}
                    onChange={eans => onChange(rows.map(item => item.key === row.key ? { ...item, data: { ...item.data, eans } } : item))} />
            </fieldset>
            <VariationMedia productId={row.data.id || row.key} sku={row.data.sku} name={row.data.name} images={row.data.images || []} parentImages={parent.images || []}
                inheritImages={row.inheritImages} videoUrl={row.data.video_url || ''} videoFile={row.videoFile} parentVideo={parent.video_url || ''} inheritVideo={row.data.specs?._inherit_parent_video === true} disabled={disabled || busy}
                onBusyChange={active => mediaBusy(row.key, active)} onChange={next => onChange(rows.map(item => item.key === row.key ? {
                    ...item, inheritImages: next.inheritImages, videoFile: next.videoFile === undefined ? item.videoFile : next.videoFile, data: { ...item.data, images: next.images, video_url: next.videoUrl, specs: { ...item.data.specs, _inherit_parent_video: next.inheritVideo ?? item.data.specs?._inherit_parent_video } },
                } : item))} />
            <VariationListing hidePrices={smartphone} parent={parent} data={row.data} disabled={disabled || busy} onChange={next => onChange(rows.map(item => item.key === row.key ? { ...item, data: { ...item.data, ...next } } : item))} />
            </div>
        </div>)}
        {editing && createPortal(<div className="fixed inset-0 z-[100] bg-slate-950/60 p-4 overflow-y-auto" onKeyDown={e => { if (e.key === 'Escape') setEditing(null); }}>
            <div role="dialog" aria-modal="true" aria-label="Detalhes da variação" className="mx-auto max-w-6xl rounded-xl bg-slate-50 p-5">
                <div className="mb-4 flex justify-between"><h2 className="text-xl font-bold">Detalhes da variação</h2><button type="button" onClick={() => setEditing(null)} aria-label="Fechar detalhes">Fechar</button></div>
                <p className="mb-4 text-sm">Alterações ficam no rascunho até salvar a família. Edite SKU, fotos, características, preços, estoque e garantia nas abas abaixo.</p>
                <ProductForm key={editing.key} variationDraftMode initialData={{ ...editing.data, images: editing.inheritImages ? parent.images : editing.data.images } as Product}
                    initialProductionSetup={productionSetups?.[editing.key]} parentProductionSetup={productionSetups?.parent}
                    onProductionSetupChange={setup => onProductionChange?.(editing.key,setup)}
                    onCancel={() => setEditing(null)} onSubmit={async data => {
                        const imagesChanged = JSON.stringify(data.images || []) !== JSON.stringify(parent.images || []);
                        const next = { ...editing, inheritImages: editing.inheritImages && !imagesChanged, data: { ...data, id: editing.data.id } };
                        onChange(rows.some(r => r.key === next.key) ? rows.map(r => r.key === next.key ? next : r) : [...rows, next]);
                        setEditing(null);
                    }} />
            </div>
        </div>, document.body)}
    </section>;
}
