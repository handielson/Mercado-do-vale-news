import React from 'react';
import { ProductInput } from '../../types/product';
import { RichTextEditor } from '../ui/RichTextEditor';
import { CurrencyInput } from '../ui/CurrencyInput';
import { CategorySelect } from './CategorySelect';
import { SalesUnitSelect } from './selectors/SalesUnitSelect';
import { FAMILY_INHERITANCE_GROUPS as groups } from './familyRegistration.js';

export function VariationListing({ parent, data, onChange, disabled, fresh = false }: {
    parent: ProductInput; data: Partial<ProductInput>; onChange: (data: Partial<ProductInput>) => void; disabled: boolean; fresh?: boolean;
}) {
    const flags: string[] = data.specs?._inherit_parent_fields || (fresh ? Object.values(groups).flat() : []);
    const descriptionInherited = data.specs?._inherit_parent_description !== false;
    const set = (patch: Partial<ProductInput>) => onChange({ ...data, ...patch, specs: { ...data.specs, ...patch.specs, _inherit_parent_fields: flags } });
    const inherits = (fields: string[]) => fields.every(field => flags.includes(field));
    const toggle = (fields: string[], checked: boolean) => {
        const next = checked ? [...new Set([...flags, ...fields])] : flags.filter(field => !fields.includes(field));
        const copy: any = { ...data, specs: { ...data.specs, _inherit_parent_fields: next } };
        if (!checked) for (const field of fields) {
            if (['condition', 'unit'].includes(field)) copy.specs[field] ??= parent.specs?.[field];
            else copy[field] ??= parent[field as keyof ProductInput];
        }
        onChange(copy);
    };
    const inheritance = (label: string, fields: string[]) => <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={inherits(fields)} onChange={e => toggle(fields, e.target.checked)} />{label}</label>;
    const effective = (field: keyof ProductInput, fields: string[]) => inherits(fields) ? parent[field] : data[field];
    const dimensions = (effective('dimensions', groups.measurements) || {}) as any;
    return <fieldset disabled={disabled} className="w-full space-y-4 rounded-lg border bg-white p-4" aria-label="Dados do anúncio da variação">
        <legend className="px-1 font-semibold">Dados do anúncio desta variação</legend>
        <section className="space-y-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={descriptionInherited} onChange={e => set({ description: data.description ?? parent.description, specs: { ...data.specs, _inherit_parent_description: e.target.checked } })} />Herdar descrição do pai</label>
            {descriptionInherited ? <p className="text-xs text-slate-500">Usará a descrição atual do pai, incluindo títulos, listas e conteúdo da embalagem. Edite o pai em Fotos e descrição.</p>
                : <RichTextEditor disabled={disabled} value={data.description || ''} onChange={description => set({ description })} placeholder="Descrição, aplicações, características e conteúdo da embalagem" />}
        </section>
        <section className="space-y-3">
            {inheritance('Herdar preços do pai', groups.prices)}
            <fieldset disabled={inherits(groups.prices)} className="grid gap-3 md:grid-cols-3">
                {(['price_retail', 'price_reseller', 'price_wholesale'] as const).map((field, i) => <CurrencyInput key={field} label={['Preço de venda', 'Preço de revenda', 'Preço de atacado'][i]} value={Number(effective(field, groups.prices)) || 0} onChange={value => set({ [field]: value })} />)}
            </fieldset>
        </section>
        <section className="space-y-3">
            {inheritance('Herdar medidas e peso do pai', groups.measurements)}
            <fieldset disabled={inherits(groups.measurements)} className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                {(['height_cm', 'width_cm', 'depth_cm'] as const).map((field, i) => <label key={field} className="text-sm">{['Altura (mm)', 'Largura (mm)', 'Profundidade (mm)'][i]}<input type="number" min="0" step="any" value={dimensions[field] == null ? '' : dimensions[field] * 10} onChange={e => set({ dimensions: { ...dimensions, [field]: e.target.value === '' ? null : Number(e.target.value) / 10 } })} className="mt-1 w-full rounded border p-2" /></label>)}
                <label className="text-sm">Peso (kg)<input type="number" min="0" step="any" value={effective('weight_kg', groups.measurements) as number ?? ''} onChange={e => set({ weight_kg: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 w-full rounded border p-2" /></label>
            </fieldset>
        </section>
        <section className="space-y-3">
            {inheritance('Herdar categoria, marca, condição e unidade do pai', groups.details)}
            <fieldset disabled={inherits(groups.details)} className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">Categoria<CategorySelect value={String(effective('category_id', groups.details) || '')} onChange={category_id => set({ category_id })} /></label>
                <label className="text-sm">Marca<input value={String(effective('brand', groups.details) || '')} onChange={e => set({ brand: e.target.value })} className="mt-1 w-full rounded border p-2" /></label>
                <label className="text-sm">Condição<select value={(inherits(groups.details) ? parent.specs?.condition : data.specs?.condition) || 'new'} onChange={e => set({ specs: { ...data.specs, condition: e.target.value } })} className="mt-1 w-full rounded border p-2"><option value="new">Novo</option><option value="used">Usado</option><option value="open_box">Caixa aberta</option></select></label>
                <SalesUnitSelect value={(inherits(groups.details) ? parent.specs?.unit : data.specs?.unit) || ''} onChange={unit => set({ specs: { ...data.specs, unit } })} />
            </fieldset>
        </section>
        <section className="space-y-3">
            {inheritance('Herdar informações SEO do pai', groups.seo)}
            <fieldset disabled={inherits(groups.seo)} className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">Título SEO<input value={String(effective('meta_title', groups.seo) || '')} onChange={e => set({ meta_title: e.target.value })} className="mt-1 w-full rounded border p-2" /></label>
                <label className="text-sm">Descrição SEO<textarea value={String(effective('meta_description', groups.seo) || '')} onChange={e => set({ meta_description: e.target.value })} className="mt-1 w-full rounded border p-2" /></label>
                <label className="text-sm md:col-span-2">Palavras-chave (separadas por vírgula)<input value={((effective('keywords', groups.seo) as string[]) || []).join(', ')} onChange={e => set({ keywords: e.target.value.split(',').map(word => word.trim()).filter(Boolean) })} className="mt-1 w-full rounded border p-2" /></label>
            </fieldset>
        </section>
        <section className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Estoque desta variação<input type="number" min="0" step="1" value={data.stock_quantity ?? 0} onChange={e => set({ stock_quantity: Math.max(0, Math.floor(Number(e.target.value))) })} className="mt-1 w-full rounded border p-2" /></label>
            <p className="text-xs text-slate-500 sm:self-center">Estoque é sempre próprio do filho. Para produtos 3D: encomendas sem limite e prazo a combinar. Arquivos de impressão e dados fiscais continuam no cadastro detalhado.</p>
        </section>
        <p className="text-xs text-slate-500">Cor e demais atributos permanecem próprios do filho. Estoque, arquivos e detalhes adicionais continuam disponíveis em Editar detalhes após incluir a variação.</p>
    </fieldset>;
}
