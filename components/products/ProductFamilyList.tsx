import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Pencil, Plus, Share2, Store, Trash2 } from 'lucide-react';
import type { Product } from '../../types/product';
import type { TikTokShopProductLink } from '../../services/tiktokShopService';

export interface ProductFamilyGroup {
  key: string;
  familyId: string | null;
  parent: Product | null;
  products: Product[];
  familyProducts: Product[];
  matchedProducts: Product[];
  representative: Product;
  selectionProducts: Product[];
  isFamily: boolean;
  orphaned: boolean;
  totalVariationCount: number;
  totalStock: number;
  minPrice: number | null;
  maxPrice: number | null;
}

interface ProductFamilyListProps {
  groups: ProductFamilyGroup[];
  isLoading: boolean;
  searchActive?: boolean;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  tiktokProductLinks?: Record<string, TikTokShopProductLink>;
  mercadoLivreLinkedIds?: Set<string>;
  updatingPrint3dFamilyIds?: Set<string>;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onAddVariation: (parent: Product) => void;
  onExportFamily: (parent: Product) => void;
  onTogglePrint3dFamily: (parent: Product, products: Product[], enabled: boolean) => void;
  onManagePublication: (product: Product) => void;
  onToggleProduct: (product: Product) => void;
  onToggleFamily: (products: Product[], selected: boolean) => void;
}

function money(value: number | null) {
  if (value === null) return 'Sem preço';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
}

function priceRange(group: ProductFamilyGroup) {
  if (group.minPrice === null) return 'Sem preço';
  if (group.minPrice === group.maxPrice) return money(group.minPrice);
  return `${money(group.minPrice)} a ${money(group.maxPrice)}`;
}

function variantLabel(product: Product) {
  const specs = product.specs || {};
  return [specs.color || specs.cor, specs.storage || specs.armazenamento, specs.ram]
    .filter(Boolean)
    .join(' · ');
}

function SelectionCheckbox({ checked, indeterminate = false, label, onChange }: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} aria-label={label}
    onChange={(event) => onChange(event.target.checked)}
    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />;
}

function Print3dFamilyToggle({ checked, indeterminate, disabled, onChange }: {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <label className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-medium ${disabled ? 'cursor-wait opacity-60' : 'cursor-pointer'} ${checked ? 'border-violet-300 bg-violet-100 text-violet-900' : indeterminate ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-300 bg-white text-slate-600'}`}>
    <input ref={ref} type="checkbox" checked={checked} disabled={disabled}
      aria-label="Marcar pai e variações como produtos 3D"
      onChange={event => onChange(event.target.checked)}
      className="h-3.5 w-3.5 rounded border-slate-300 text-violet-700 focus:ring-violet-500" />
    {disabled ? 'Atualizando 3D...' : indeterminate ? '3D parcial' : 'Produto 3D'}
  </label>;
}

function ChannelBadges({ products, tiktokProductLinks, mercadoLivreLinkedIds }: {
  products: Product[];
  tiktokProductLinks: Record<string, TikTokShopProductLink>;
  mercadoLivreLinkedIds: Set<string>;
}) {
  const has = {
    mdv: products.some(product => !product.hide_from_catalog && product.status === 'active'),
    print3d: products.some(product => Boolean(product.is_print3d)),
    shopee: products.some(product => Number(product.shopee_item_id) > 0),
    tiktok: products.some(product => Boolean(tiktokProductLinks[product.id]?.tiktok_product_id)),
    ml: products.some(product => mercadoLivreLinkedIds.has(product.id)),
  };
  const badge = (label: string, active: boolean, activeClass: string) => (
    <span title={`${label}: ${active ? 'com vínculo ou disponível' : 'sem indicação no cadastro'}`}
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${active ? activeClass : 'bg-slate-100 text-slate-400'}`}>{label}</span>
  );
  return <div className="flex flex-wrap gap-1">
    {badge('MDV', has.mdv, 'bg-blue-100 text-blue-800')}
    {badge('3D', has.print3d, 'bg-violet-100 text-violet-800')}
    {badge('Shopee', has.shopee, 'bg-orange-100 text-orange-800')}
    {badge('TikTok', has.tiktok, 'bg-slate-800 text-white')}
    {badge('ML', has.ml, 'bg-yellow-100 text-yellow-900')}
  </div>;
}

function ProductImage({ product, small = false }: { product: Product; small?: boolean }) {
  const src = product.images?.[0];
  const size = small ? 'h-10 w-10' : 'h-12 w-12';
  return src
    ? <img src={src} alt="" className={`${size} shrink-0 rounded-lg border border-slate-200 bg-white object-contain`} />
    : <div className={`${size} shrink-0 rounded-lg border border-dashed border-slate-300 bg-slate-50`} />;
}

export function ProductFamilyList({
  groups,
  isLoading,
  searchActive = false,
  selectionMode = false,
  selectedIds = new Set(),
  tiktokProductLinks = {},
  mercadoLivreLinkedIds = new Set(),
  updatingPrint3dFamilyIds = new Set(),
  onEdit,
  onDelete,
  onAddVariation,
  onExportFamily,
  onTogglePrint3dFamily,
  onManagePublication,
  onToggleProduct,
  onToggleFamily,
}: ProductFamilyListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const groupKeys = useMemo(() => groups.map(group => group.key).join('|'), [groups]);

  useEffect(() => {
    if (!searchActive) return;
    setExpanded(new Set(groups.filter(group => group.isFamily).map(group => group.key)));
  }, [searchActive, groupKeys]);

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3].map(item => <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-200" />)}</div>;
  }
  if (groups.length === 0) {
    return <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center text-slate-500">Nenhum produto encontrado.</div>;
  }

  const toggleExpanded = (key: string) => setExpanded(current => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="overflow-x-auto">
      <table className="min-w-[1050px] w-full border-collapse text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-12 px-4 py-3">{selectionMode ? 'Sel.' : ''}</th>
            <th className="px-3 py-3">Produto</th>
            <th className="w-40 px-3 py-3">SKU</th>
            <th className="w-44 px-3 py-3">Preço</th>
            <th className="w-24 px-3 py-3 text-right">Estoque</th>
            <th className="w-72 px-3 py-3">Canais</th>
            <th className="w-64 px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">{groups.map(group => {
          const isExpanded = expanded.has(group.key);
          const rowProducts = group.selectionProducts;
          const selectedCount = rowProducts.filter(product => selectedIds.has(product.id)).length;
          const allSelected = rowProducts.length > 0 && selectedCount === rowProducts.length;
          const partiallySelected = selectedCount > 0 && !allSelected;
          const channelProducts = group.familyProducts.length ? group.familyProducts : [group.representative];
          const canAddVariation = Boolean(group.parent && Number(group.parent.is_parent) === 1);
          const canExpand = group.isFamily && group.products.length > 0;
          const print3dProducts = group.selectionProducts;
          const print3dCount = print3dProducts.filter(product => Boolean(product.is_print3d)).length;
          const allPrint3d = print3dProducts.length > 0 && print3dCount === print3dProducts.length;
          const somePrint3d = print3dCount > 0 && !allPrint3d;
          const updatingPrint3d = Boolean(group.parent && updatingPrint3dFamilyIds.has(group.parent.id));
          return <FragmentRows key={group.key}>
            <tr className={`${group.isFamily ? 'bg-slate-50/70' : 'bg-white'} hover:bg-blue-50/40`}>
              <td className="px-4 py-3 align-middle">
                {selectionMode && <SelectionCheckbox checked={allSelected} indeterminate={partiallySelected}
                  label={`Selecionar ${group.representative.name}`}
                  onChange={(checked) => onToggleFamily(rowProducts, checked)} />}
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-3">
                  <button type="button" disabled={!canExpand}
                    aria-label={isExpanded ? 'Recolher variações' : 'Expandir variações'}
                    onClick={() => canExpand && toggleExpanded(group.key)}
                    className={`rounded p-1 ${canExpand ? 'text-slate-600 hover:bg-slate-200' : 'invisible'}`}>
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                  <ProductImage product={group.representative} />
                  <div className="min-w-0">
                    <button type="button" onClick={() => onEdit(group.representative)} className="block max-w-xl text-left font-semibold text-slate-900 hover:text-blue-700 hover:underline">
                      {group.representative.name}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {group.isFamily
                        ? <span className="rounded-full bg-violet-100 px-2 py-0.5 font-medium text-violet-800">{group.totalVariationCount > 0 ? `${group.totalVariationCount} ${group.totalVariationCount === 1 ? 'variação' : 'variações'}` : 'Família sem variações'}</span>
                        : <span>Produto simples</span>}
                      {canAddVariation && <Print3dFamilyToggle checked={allPrint3d} indeterminate={somePrint3d} disabled={updatingPrint3d}
                        onChange={enabled => onTogglePrint3dFamily(group.parent!, print3dProducts, enabled)} />}
                      {group.orphaned && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">Pai não encontrado</span>}
                      {searchActive && group.matchedProducts.length < group.selectionProducts.length && <span>{group.matchedProducts.length} correspondência</span>}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 font-mono text-xs text-slate-600">{group.parent?.sku || group.representative.sku || '—'}</td>
              <td className="px-3 py-3 font-semibold text-slate-800">{priceRange(group)}</td>
              <td className="px-3 py-3 text-right font-semibold text-slate-800">{group.totalStock}</td>
              <td className="px-3 py-3"><ChannelBadges products={channelProducts} tiktokProductLinks={tiktokProductLinks} mercadoLivreLinkedIds={mercadoLivreLinkedIds} /></td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  {canAddVariation && <button type="button" onClick={() => onAddVariation(group.parent!)} title="Adicionar variação" className="rounded-lg p-2 text-violet-700 hover:bg-violet-100"><Plus size={17} /></button>}
                  {canAddVariation && <button type="button" onClick={() => onExportFamily(group.parent!)} title="Selecionar o pai e exportar a família" className="inline-flex items-center gap-1 rounded-lg bg-violet-700 px-2.5 py-2 text-xs font-semibold text-white hover:bg-violet-800"><Share2 size={16} /><span>Exportar família</span></button>}
                  <button type="button" onClick={() => window.open(`/produto/${group.representative.id}`, '_blank')} title="Abrir no site" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ExternalLink size={17} /></button>
                  <button type="button" onClick={() => onManagePublication(group.representative)} title="Publicação nos sites" className="rounded-lg p-2 text-violet-700 hover:bg-violet-100"><Store size={17} /></button>
                  <button type="button" onClick={() => onEdit(group.representative)} title="Editar" className="rounded-lg p-2 text-blue-700 hover:bg-blue-100"><Pencil size={17} /></button>
                </div>
              </td>
            </tr>
            {group.isFamily && isExpanded && group.products.map(product => <tr key={product.id} className="border-l-4 border-l-violet-400 bg-white hover:bg-violet-50/40">
              <td className="px-4 py-3">{selectionMode && <SelectionCheckbox checked={selectedIds.has(product.id)} label={`Selecionar ${product.name}`} onChange={() => onToggleProduct(product)} />}</td>
              <td className="px-3 py-3 pl-12"><div className="flex items-center gap-3"><ProductImage product={product} small /><div className="min-w-0"><button type="button" onClick={() => onEdit(product)} className="block max-w-xl text-left font-medium text-slate-800 hover:text-blue-700 hover:underline">{product.name}</button><p className="mt-0.5 text-xs text-slate-500">{variantLabel(product) || 'Variação vendável'}</p></div></div></td>
              <td className="px-3 py-3 font-mono text-xs text-slate-600">{product.sku || '—'}</td>
              <td className="px-3 py-3 font-medium text-slate-800">{money(Number(product.price_retail) > 0 ? Number(product.price_retail) : null)}</td>
              <td className="px-3 py-3 text-right font-medium text-slate-800">{Number(product.stock_quantity || 0)}</td>
              <td className="px-3 py-3"><ChannelBadges products={[product]} tiktokProductLinks={tiktokProductLinks} mercadoLivreLinkedIds={mercadoLivreLinkedIds} /></td>
              <td className="px-4 py-3"><div className="flex justify-end gap-1"><button type="button" onClick={() => onManagePublication(product)} title="Publicação nos sites" className="rounded-lg p-2 text-violet-700 hover:bg-violet-100"><Store size={16} /></button><button type="button" onClick={() => onEdit(product)} title="Editar variação" className="rounded-lg p-2 text-blue-700 hover:bg-blue-100"><Pencil size={16} /></button><button type="button" onClick={() => onDelete(product)} title="Excluir variação" className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button></div></td>
            </tr>)}
          </FragmentRows>;
        })}</tbody>
      </table>
    </div>
  </div>;
}

function FragmentRows({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
