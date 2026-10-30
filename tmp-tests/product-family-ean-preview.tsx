import React, { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ProductFamilyEditor, type FamilyRow, type FamilyEditorDraft } from '../components/products/ProductFamilyEditor';
import { ramService } from '../services/rams';
import { storageService } from '../services/storages';
import { colorService } from '../services/colors';
import { smartphonePriceGroups } from '../services/smartphonePriceGroups';
import { modelColorImagesService } from '../services/model-color-images';
import '../index.css';

const smartphone = new URLSearchParams(location.search).has('smartphone');
const saved = new URLSearchParams(location.search).has('saved');
const savedPrices = { price_retail: 119900, price_reseller: 114900, price_wholesale: 109900 };
let currentPrices = { ...savedPrices };
if (smartphone) {
    ramService.listActive = async () => [8, 12].map(value => ({ id: String(value), value, label: `${value}GB`, active: true }));
    storageService.listActive = async () => [256, 512].map(value => ({ id: String(value), value, label: `${value}GB`, active: true }));
    colorService.list = async () => [];
    modelColorImagesService.getByModel = async () => [];
    smartphonePriceGroups.reference = async (_modelId, product: any) => ({ controlled: true, established: saved, group_id: product.specs.ram === '12GB' ? 'group-12' : 'group-8', prices: saved ? currentPrices : null });
    smartphonePriceGroups.list = async () => {
        if ((window as any).fixtureInventoryFailure) throw new Error('Falha de consulta simulada');
        return { enabled: true, unresolved: [], groups: [
            { id: 'group-8', model_id: 'fixture', revision: 'r1', prices: currentPrices, cost_average_in_stock: (window as any).fixtureInventoryCost === undefined ? 123450 : (window as any).fixtureInventoryCost, products: [{ id: 'Preto' }, { id: 'Branco' }] },
            { id: 'group-12', cost_average_in_stock: null },
            { id: 'other-version', cost_average_in_stock: 999900 },
        ] } as any;
    };
    smartphonePriceGroups.save = async (_group, prices) => {
        if ((window as any).fixturePriceSaveFailure) throw new Error('Falha simulada ao salvar preços');
        (window as any).fixturePriceWrites = ((window as any).fixturePriceWrites || 0) + 1;
        currentPrices = { ...prices };
        return { ok: true, updated: 2 };
    };
}

function Fixture() {
    const [rows, setRows] = useState<FamilyRow[]>([...['Preto', ...(smartphone ? ['Branco'] : [])].map(color => ({ key: color, data: { ...(saved ? { id: color, ...savedPrices, price_cost: 99900 } : {}), name: `${smartphone ? 'Poco X8 5G' : 'Teste'} - ${color}`, eans: [], images: [], specs: { color, ...(saved ? { ram: '8GB', storage: '256GB' } : {}) } } as FamilyRow['data'], inheritImages: false }))]);
    const [tick, setTick] = useState(0);
    const capture = useRef<(() => FamilyEditorDraft) | undefined>(undefined);
    const [restored, setRestored] = useState<FamilyEditorDraft>();
    const [generation, setGeneration] = useState(0);
    return <form className="max-w-5xl mx-auto p-4" onSubmit={e => e.preventDefault()} onChangeCapture={() => setTick(value => value + 1)}>
        <output data-testid="render-tick">{tick}</output>
        <ProductFamilyEditor key={generation} initialDraft={restored} captureDraftRef={capture} smartphone={smartphone} parent={{ name: smartphone ? 'Poco X8 5G' : 'Teste', images: [], ...(smartphone ? { model_id: 'fixture' } : {}) } as FamilyRow['data']} rows={rows} onChange={setRows} disabled={false} />
        <output data-testid="ean-state">{JSON.stringify(rows[0].data.eans)}</output>
        <output data-testid="rows-state" hidden>{JSON.stringify(rows)}</output>
        <button type="button" onClick={() => { setRestored(capture.current?.()); setGeneration(value => value + 1); }}>Restaurar rascunho de teste</button>
    </form>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);
