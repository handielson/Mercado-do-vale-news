import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Product } from '../../types/product';
import { vpsApiService } from '../../services/vpsApiService';
import { getCatalogTitle } from '../../services/catalogTitle.js';

export function CatalogTitleEditor({ product }: { product: Product }) {
    const [saved, setSaved] = useState(product.catalog_title_complement || '');
    const [draft, setDraft] = useState(saved);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        const value = product.catalog_title_complement || '';
        setSaved(value);
        setDraft(value);
        setEditing(false);
    }, [product.id, product.catalog_title_complement]);
    if (!product.is_parent || product.parent_id) return null;

    const save = async () => {
        setSaving(true);
        try {
            const value = draft.trim();
            if (!await vpsApiService.updateProductCatalogTitle(product.id, value)) {
                toast.error('Não foi possível salvar o complemento. Tente novamente.');
                return;
            }
            setSaved(value);
            setDraft(value);
            setEditing(false);
            toast.success('Complemento do título salvo.');
        } finally { setSaving(false); }
    };

    return <div className="my-2 text-xs" onClick={event => event.stopPropagation()}>
        {!editing ? <button type="button" onClick={() => { setDraft(saved); setEditing(true); }}
            className="text-left text-blue-700 hover:underline">
            {saved ? `Complemento no site: ${saved} · Editar` : '+ Complemento do título no site'}
        </button> : <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <label className="block font-semibold" htmlFor={`catalog-title-${product.id}`}>Complemento do título no site</label>
            <input id={`catalog-title-${product.id}`} value={draft} maxLength={120} disabled={saving}
                onChange={event => setDraft(event.target.value)} placeholder="Ex.: Oferta por tempo limitado"
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm" />
            <p className="break-words text-slate-700">Prévia: {getCatalogTitle(product.name, { catalog_title_complement: draft })}</p>
            <p className="text-slate-500">Apenas no site, para toda a família. Deixe vazio para remover. O nome nos comprovantes e na garantia permanece igual.</p>
            <div className="flex gap-2">
                <button type="button" disabled={saving} onClick={save} className="rounded bg-blue-600 px-3 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar'}</button>
                <button type="button" disabled={saving} onClick={() => setEditing(false)} className="rounded border px-3 py-2">Cancelar</button>
            </div>
        </div>}
    </div>;
}
