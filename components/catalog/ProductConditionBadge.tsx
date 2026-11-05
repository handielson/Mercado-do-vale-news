// product-condition-v1: selo de condição (Seminovo / Usado / Caixa aberta) — produto novo não mostra selo.
import { productCondition, productConditionLabel, productConditionNote } from '../../utils/productCondition.js';

const STYLES: Record<string, string> = {
  seminovo: 'border-amber-300 bg-amber-50 text-amber-800',
  used: 'border-orange-300 bg-orange-50 text-orange-800',
  open_box: 'border-sky-300 bg-sky-50 text-sky-800',
};

export function ProductConditionBadge({ product, className = '' }: { product: any; className?: string }) {
  const condition = productCondition(product);
  if (condition === 'new') return null;
  return (
    <span data-product-condition={condition} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide sm:text-xs ${STYLES[condition] || STYLES.used} ${className}`}>
      {productConditionLabel(condition)}
    </span>
  );
}

export function ProductConditionNote({ product, className = '' }: { product: any; className?: string }) {
  const note = productConditionNote(product);
  if (!note) return null;
  return (
    <div data-product-condition-note className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 ${className}`}>
      <strong className="font-semibold">{productConditionLabel(productCondition(product))}:</strong> {note}
    </div>
  );
}
