import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Image as ImageIcon, PlayCircle, Tag } from 'lucide-react';
import type { Product } from '../../../../types/product';
import type {
  TikTokShopCategoryReadiness,
  TikTokShopCategorySummary,
} from '../../../../services/tiktokShopService';

type Props = {
  product: Product | null;
  category: TikTokShopCategorySummary | null;
  readiness: TikTokShopCategoryReadiness | null;
  warehouseName: string;
};

function plainText(value: unknown): string {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function attributeLabel(attribute: Record<string, any>): string {
  return String(attribute?.name || attribute?.id || 'Atributo obrigatorio');
}

export default function TikTokShopListingPreview({
  product,
  category,
  readiness,
  warehouseName,
}: Props) {
  const images = useMemo(
    () => Array.from(new Set((product?.images || []).filter(Boolean))).slice(0, 9),
    [product?.images],
  );
  const [selectedImage, setSelectedImage] = useState('');

  useEffect(() => {
    setSelectedImage(images[0] || '');
  }, [images]);

  const dimensions = product?.dimensions;
  const weightGrams = Number(product?.shipping_weight || 0) > 0
    ? Number(product?.shipping_weight)
    : Number(product?.weight_kg || 0) * 1000;
  const length = Number(product?.shipping_length || dimensions?.depth_cm || 0);
  const width = Number(product?.shipping_width || dimensions?.width_cm || 0);
  const height = Number(product?.shipping_height || dimensions?.height_cm || 0);
  const requiredAttributes = readiness?.required_attributes || [];

  return (
    <aside className="min-w-0 self-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-20">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-950 px-4 py-3 text-white">
        <div>
          <p className="text-sm font-bold">Previa do anuncio TikTok Shop</p>
          <p className="mt-0.5 text-[11px] text-slate-300">Exatamente o que sera preparado para o rascunho</p>
        </div>
        <span className="rounded-full bg-cyan-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-200">
          Rascunho
        </span>
      </div>

      <div className="p-4">
        <div className="aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {selectedImage ? (
            <img src={selectedImage} alt={product?.name || 'Produto'} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              <ImageIcon className="h-10 w-10" />
            </div>
          )}
        </div>

        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={`${index}-${image.slice(0, 40)}`}
              type="button"
              onClick={() => setSelectedImage(image)}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-white ${
                selectedImage === image ? 'border-cyan-500' : 'border-slate-200'
              }`}
              aria-label={`Ver foto ${index + 1}`}
            >
              <img src={image} alt="" className="h-full w-full object-contain" />
            </button>
          ))}
        </div>

        {product?.video_url ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-black">
            <video src={product.video_url} controls preload="metadata" className="aspect-video w-full" />
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
            <PlayCircle className="h-4 w-4" />
            Produto sem video cadastrado
          </div>
        )}

        <h3 className="mt-4 text-base font-bold leading-snug text-slate-950">
          {product?.name || 'Selecione um produto para montar a previa'}
        </h3>
        <div className="mt-3 flex items-end justify-between gap-3">
          <p className="text-2xl font-black text-rose-600">
            {(Number(product?.price_retail || 0) / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </p>
          <p className="text-xs font-semibold text-slate-600">
            Estoque: {Math.max(0, Math.floor(Number(product?.stock_quantity || 0)))}
          </p>
        </div>

        <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-xs">
          <div className="flex items-start justify-between gap-3">
            <span className="text-slate-500">Categoria</span>
            <span className="text-right font-semibold text-slate-800">{category?.name || 'A definir'}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-slate-500">SKU vendedor</span>
            <span className="text-right font-semibold text-slate-800">{product?.sku || 'Ausente'}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-slate-500">Armazem</span>
            <span className="text-right font-semibold text-slate-800">{warehouseName || 'A definir'}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-slate-500">Pacote</span>
            <span className="text-right font-semibold text-slate-800">
              {weightGrams > 0 ? `${Math.round(weightGrams)} g` : 'Peso ausente'}
              {' · '}
              {length && width && height ? `${length} × ${width} × ${height} cm` : 'medidas ausentes'}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-slate-500">EAN</span>
            <span className="text-right font-semibold text-slate-800">{product?.eans?.join(', ') || 'Nao informado'}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-slate-500">Marca</span>
            <span className="text-right font-semibold text-slate-800">{product?.brand || 'Nao informada'}</span>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Descricao</p>
          <p className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {plainText(product?.description) || 'Descricao ainda nao informada.'}
          </p>
        </div>

        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Tag className="h-4 w-4 text-cyan-700" />
            Campos TikTok do anuncio
          </p>
          <div className="mt-2 space-y-2 text-xs">
            {[
              ['Titulo, descricao e categoria', Boolean(product?.name && product?.description && category)],
              [`Galeria (${images.length}/9 fotos)`, images.length > 0],
              [product?.video_url ? 'Video do produto' : 'Video opcional', true],
              ['Preco, estoque e SKU', Boolean(product?.sku && Number(product?.price_retail) > 0)],
              ['Peso e dimensoes do pacote', Boolean(weightGrams && length && width && height)],
            ].map(([label, ready]) => (
              <div key={String(label)} className="flex items-center gap-2">
                {ready ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                )}
                <span className={ready ? 'text-slate-700' : 'font-medium text-amber-800'}>{label}</span>
              </div>
            ))}
          </div>

          {requiredAttributes.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-bold text-amber-900">Atributos obrigatorios da categoria</p>
              <ul className="mt-1 space-y-1 text-xs text-amber-800">
                {requiredAttributes.map((attribute) => (
                  <li key={String(attribute.id || attribute.name)}>
                    {attributeLabel(attribute)} — completar no Seller Center
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
