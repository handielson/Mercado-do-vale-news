import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Package, Pencil } from 'lucide-react';
import type { Product } from '../../types/product';
import type { ProductFamilyGroup } from './ProductFamilyList';
import { getCompactRow } from './productCompactRows.js';
import { cn } from '../../utils/cn';

// Visualização "Lista": uma linha por produto/família, com foto pequena.
// Toque no produto abre a edição; na família, abre as variações (cada uma com toque para editar).
// Não monta o card completo, então não faz as consultas extras de cada card.

interface Props {
  groups: ProductFamilyGroup[];
  isLoading: boolean;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onEdit: (product: Product) => void;
  onToggleProduct: (product: Product) => void;
  onToggleFamily: (products: Product[], selected: boolean) => void;
}

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      {src && !failed
        ? <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-cover" />
        : <Package className="h-6 w-6 text-slate-300" aria-hidden="true" />}
    </div>
  );
}

export const ProductCompactList: React.FC<Props> = ({ groups, isLoading, selectionMode, selectedIds, onEdit, onToggleProduct, onToggleFamily }) => {
  const [openFamilies, setOpenFamilies] = useState<Set<string>>(new Set());

  if (isLoading) {
    return (
      <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-3 p-3">
            <div className="h-14 w-14 animate-pulse rounded-lg bg-slate-200" />
            <div className="flex-1 space-y-2"><div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" /><div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" /></div>
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Nenhum produto encontrado</p>;
  }

  const toggleOpen = (key: string) => setOpenFamilies(previous => {
    const next = new Set(previous);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white" data-product-compact-list>
      {groups.map(group => {
        const row = getCompactRow(group);
        const familyProducts = group.selectionProducts?.length ? group.selectionProducts : group.familyProducts;
        const selected = row.isFamily
          ? familyProducts.length > 0 && familyProducts.every(product => selectedIds.has(product.id))
          : selectedIds.has(row.product.id);
        const open = openFamilies.has(row.key);
        const onRowClick = () => {
          if (selectionMode) {
            if (row.isFamily) onToggleFamily(familyProducts, !selected);
            else onToggleProduct(row.product);
            return;
          }
          if (row.isFamily) toggleOpen(row.key);
          else onEdit(row.product);
        };
        return (
          <li key={row.key} data-compact-row={row.isFamily ? 'family' : 'product'}>
            <button
              type="button"
              onClick={onRowClick}
              aria-expanded={row.isFamily ? open : undefined}
              aria-label={selectionMode ? `${selected ? 'Desmarcar' : 'Selecionar'} ${row.title}` : row.isFamily ? `${open ? 'Fechar' : 'Ver'} variações de ${row.title}` : `Editar ${row.title}`}
              className={cn('flex w-full items-center gap-3 p-3 text-left transition active:bg-slate-100', selected && 'bg-blue-50')}
            >
              {selectionMode && (
                <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded border-2', selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white')} aria-hidden="true">
                  {selected && '✓'}
                </span>
              )}
              <Thumb src={row.image} alt="" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug text-slate-900 line-clamp-2">{row.title}</span>
                {(row.subtitle || row.sku) && (
                  <span className="mt-0.5 block truncate font-mono text-[11px] text-slate-500">{[row.subtitle, row.sku].filter(Boolean).join(' · ')}</span>
                )}
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {row.price && <span className="text-sm font-bold tabular-nums text-slate-900">{row.price}</span>}
                  {row.chips.map(chip => (
                    <span key={chip.key} className={cn('rounded-full border px-1.5 py-0.5 text-[11px] font-semibold leading-none', chip.color)}>{chip.label}</span>
                  ))}
                </span>
              </span>
              {!selectionMode && (row.isFamily
                ? <ChevronDown className={cn('h-5 w-5 shrink-0 text-slate-400 transition', open && 'rotate-180')} aria-hidden="true" />
                : <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />)}
            </button>
            {row.isFamily && open && !selectionMode && (
              <div className="border-t border-violet-100 bg-violet-50/40 pb-2" data-compact-variants>
                <button type="button" onClick={() => onEdit(row.product)}
                  className="flex min-h-[44px] w-full items-center gap-2 px-4 text-left text-sm font-semibold text-violet-800 active:bg-violet-100">
                  <Pencil className="h-4 w-4" /> Editar produto pai
                </button>
                {row.variants.map(variant => (
                  <button key={variant.product.id} type="button" onClick={() => onEdit(variant.product)}
                    aria-label={`Editar variação ${variant.label}`}
                    className={cn('flex min-h-[48px] w-full items-center gap-3 px-4 py-1.5 text-left active:bg-violet-100', variant.matched && 'bg-amber-50')}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{variant.label}</span>
                      <span className="block truncate font-mono text-[11px] text-slate-500">{variant.sku || 'Sem SKU'}</span>
                    </span>
                    {variant.price && <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">{variant.price}</span>}
                    <span className={cn('shrink-0 rounded-full border px-1.5 py-0.5 text-[11px] font-semibold', variant.stock > 0 ? 'border-green-200 bg-green-100 text-green-800' : 'border-slate-200 bg-slate-100 text-slate-500')}>
                      {variant.stock} un.
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};
