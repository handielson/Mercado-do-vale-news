import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import type { Product, ProductInput } from '../../types/product';
import { ProductForm } from './ProductForm';
import { productService } from '../../services/products';
import { vpsClient } from '../../services/vpsClient';

const FIELDS = [
  ['price_cost', 'Preço de custo'],
  ['description', 'Descrição'],
  ['technical_specifications', 'Especificações técnicas'],
  ['category_id', 'Categoria'],
  ['brand', 'Marca'],
  ['warranty_type', 'Tipo de garantia'],
  ['warranty_template_id', 'Modelo de garantia'],
] as const;
type Field = typeof FIELDS[number][0];
const COPY_FIELDS = FIELDS.filter(([field]) => field !== 'price_cost');
type Plan = { fingerprint: string; changed_count: number; changes: Array<{ child_id: string; sku: string; changed: Record<string, { from: unknown; to: unknown }> }> };

function display(value: unknown, field?: string) {
  if (field === 'custom_fields') return (value as any)?.inherit_parent_cost === true ? 'Herdar custo do pai' : 'Custo próprio';
  if (field === 'price_cost' && typeof value === 'number') return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
  if (value == null || value === '') return 'vazio';
  const text = typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : JSON.stringify(value);
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

export const ProductFamilyInheritance: React.FC<{ parent: Product }> = ({ parent }) => {
  const [children, setChildren] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Record<string, Field[]>>({});
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [editorTab, setEditorTab] = useState<'settings' | 'product'>('settings');
  useEffect(() => {
    if (!editing) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [editing?.id]);

  useEffect(() => {
    let active = true;
    setSelected({});
    productService.listChildren(parent.id).then(rows => { if (active) {
      setChildren(rows);
      setSelected(Object.fromEntries(rows.map(child => [child.id, child.custom_fields?.inherit_parent_cost === true ? ['price_cost'] : []])));
    } })
      .catch(error => { if (active) toast.error(error instanceof Error ? error.message : 'Erro ao carregar variações.'); });
    return () => { active = false; };
  }, [parent.id]);

  const selections = editing ? [{ child_id: editing.id, fields: selected[editing.id] || [], inherit_cost: (selected[editing.id] || []).includes('price_cost') }] : [];
  const toggle = (id: string, field: Field) => {
    setSelected(current => ({ ...current, [id]: (current[id] || []).includes(field)
      ? current[id].filter(item => item !== field)
      : [...(current[id] || []), field] }));
  };
  const saveVariation = async (openProduct = false) => {
    if (!editing || !selections.length) return;
    try {
      setBusy(true);
      const checked = await vpsClient.post<Plan>(`/products/${parent.id}/family-inheritance`, { selections });
      if (checked.changed_count) await vpsClient.post(`/products/${parent.id}/family-inheritance`, { selections, apply: true, fingerprint: checked.fingerprint });
      const rows = await productService.listChildren(parent.id);
      setChildren(rows);
      setSelected(Object.fromEntries(rows.map(child => [child.id, child.custom_fields?.inherit_parent_cost === true ? ['price_cost'] : []])));
      if (openProduct) {
        const current = await productService.getById(editing.id);
        if (!current) throw new Error('Variação não encontrada após salvar.');
        setEditing(current);
        setEditorTab('product');
      } else setEditing(null);
      if (checked.changed_count) toast.success('Configuração da variação salva.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a variação.');
    } finally { setBusy(false); }
  };
  const openVariation = async (child: Product) => {
    try {
      setBusy(true);
      const current = await productService.getById(child.id);
      if (!current) throw new Error('Variação não encontrada.');
      setEditing(current);
      setEditorTab('product');
      setSelected({ [current.id]: current.custom_fields?.inherit_parent_cost === true ? ['price_cost'] : [] });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível abrir a variação.'); }
    finally { setBusy(false); }
  };
  const saveProduct = async (input: ProductInput) => {
    if (!editing) return;
    try {
      setBusy(true);
      await productService.update(editing.id, input);
      setChildren(await productService.listChildren(parent.id));
      setEditing(null);
      toast.success('Variação salva.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a variação.'); }
    finally { setBusy(false); }
  };

  return <section className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm" aria-label="Herança das variações">
    <h2 className="text-lg font-semibold text-slate-900">Variações cadastradas</h2>
    <p className="mt-1 text-sm text-slate-600">Abra uma variação para configurar seu custo e editar o cadastro.</p>
    {!children.length && <p className="mt-3 text-sm text-slate-500">Nenhuma variação vinculada a este pai.</p>}
    {children.length > 0 && <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-left text-sm">
      <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Variação / SKU</th><th className="p-3">Custo</th><th className="p-3">Origem do custo</th><th className="p-3"></th></tr></thead>
      <tbody>{children.map(child => <tr key={child.id} className="border-t border-slate-100">
        <td className="p-3"><div className="font-semibold text-slate-800">{child.specs?.color || child.name}</div><div className="text-slate-500">{child.sku}</div></td>
        <td className="p-3 whitespace-nowrap">{child.price_cost == null ? 'Não informado' : display(child.price_cost, 'price_cost')}</td>
        <td className="p-3 text-slate-600">{child.custom_fields?.inherit_parent_cost === true ? 'Produto pai' : 'Próprio'}</td>
        <td className="p-3 text-right"><button type="button" disabled={busy} onClick={() => openVariation(child)} className="rounded-lg border border-slate-200 px-3 py-2 font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50">Editar</button></td>
      </tr>)}</tbody>
    </table></div>}
    {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div role="dialog" aria-modal="true" aria-labelledby="variation-settings-title" className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white shadow-xl ${editorTab === 'product' ? 'max-w-6xl' : 'max-w-xl'}`}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-5"><div><h2 id="variation-settings-title" className="text-lg font-semibold">Detalhes da variação</h2><p className="text-sm text-slate-500">{editing.specs?.color || editing.name} · {editing.sku}</p></div><button type="button" aria-label="Fechar variação" disabled={busy} onClick={() => setEditing(null)}><X className="h-5 w-5" /></button></div>
      {editorTab === 'settings' ? <><div className="space-y-5 p-5"><div><h3 className="mb-2 font-semibold">Preço de custo</h3><label className="flex items-center gap-2"><input type="checkbox" checked={(selected[editing.id] || []).includes('price_cost')} onChange={() => toggle(editing.id, 'price_cost')} disabled={busy} />Utilizar custo do produto pai</label><p className="mt-2 text-sm text-slate-600">{(selected[editing.id] || []).includes('price_cost') ? `Custo: ${display(parent.price_cost, 'price_cost')}. Acompanha as próximas alterações do pai.` : `Custo próprio: ${editing.price_cost == null ? 'não informado' : display(editing.price_cost, 'price_cost')}.`}</p></div>
      <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Copiar outros dados do pai</summary><p className="mt-2 text-xs text-slate-500">Os campos marcados serão substituídos pelos dados atuais do pai, somente ao salvar esta configuração.</p>
      <label className="mt-3 flex items-center gap-2 border-b pb-3 text-sm font-semibold"><input type="checkbox" disabled={busy} checked={COPY_FIELDS.every(([field]) => (selected[editing.id] || []).includes(field))} onChange={event => {
        const checked = event.target.checked;
        setSelected(current => ({ ...current, [editing.id]: [...(current[editing.id] || []).filter(field => field === 'price_cost'), ...(checked ? COPY_FIELDS.map(([field]) => field) : [])] }));
      }} />Selecionar todos</label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{COPY_FIELDS.map(([field, label]) => <label key={field} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={(selected[editing.id] || []).includes(field)} onChange={() => toggle(editing.id, field)} disabled={busy} />{label}</label>)}</div></details>
      <button type="button" disabled={busy} onClick={() => saveVariation(true)} className="inline-block text-sm font-medium text-blue-700 hover:underline">Salvar configuração e editar cadastro nesta janela</button></div>
      <div className="flex justify-end gap-3 border-t p-5"><button type="button" disabled={busy} onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2">Cancelar</button><button type="button" disabled={busy} onClick={() => saveVariation()} className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50">{busy ? 'Salvando...' : 'Salvar configuração'}</button></div></> : <div className="p-5"><button type="button" disabled={busy} onClick={() => setEditorTab('settings')} className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">Configurar uso dos dados do pai</button><ProductForm key={editing.id} initialData={editing} onSubmit={saveProduct} onCancel={() => setEditing(null)} isLoading={busy} /></div>}
    </div></div>}
  </section>;
};
