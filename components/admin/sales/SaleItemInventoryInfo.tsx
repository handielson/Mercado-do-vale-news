import { useEffect, useState } from 'react';
import { ImageOff, MapPin, Package } from 'lucide-react';
import { vpsApiService } from '../../../services/vpsApiService';
import { stockLocationService } from '../../../services/stockLocationService';
import type { Product } from '../../../types/product';
import type { ProductStockLocation } from '../../../types/stock-location';

interface Props {
  productId?: string | null;
  sku?: string | null;
  name: string;
  variation?: string | null;
  imageUrl?: string | null;
}

function normalizeLookupText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function pickMarketplaceProduct(products: Product[], sku?: string | null, name?: string | null, variation?: string | null): Product | null {
  const expectedSku = normalizeLookupText(sku).replace(/\s+/g, '');
  const expectedName = normalizeLookupText(name);
  const expectedVariation = normalizeLookupText(variation);
  let best: { product: Product; score: number } | null = null;
  for (const product of products) {
    if (!product?.id || Number((product as any).is_parent) === 1) continue;
    const productSku = normalizeLookupText(product.sku).replace(/\s+/g, '');
    const productText = normalizeLookupText(`${product.name || ''} ${(product as any).model || ''} ${JSON.stringify(product.specs || {})}`);
    let score = 0;
    if (expectedSku && productSku === expectedSku) score += 1000;
    else if (expectedSku && productSku && (productSku.includes(expectedSku) || expectedSku.includes(productSku))) score += 400;
    if (expectedName && productText.includes(expectedName)) score += 180;
    const nameTokens = expectedName.split(' ').filter((token) => token.length >= 3);
    score += nameTokens.filter((token) => productText.includes(token)).length * 12;
    const variationTokens = expectedVariation.split(' ').filter((token) => token.length >= 2);
    score += variationTokens.filter((token) => productText.includes(token)).length * 18;
    if (!best || score > best.score) best = { product, score };
  }
  return best && best.score >= 36 ? best.product : null;
}

function firstProductImage(product: Product | null, fallback?: string | null): string {
  if (fallback?.trim()) return fallback.trim();
  const images = Array.isArray(product?.images) ? product.images : [];
  return String(images.find((image) => String(image || '').trim()) || (product as any)?.image_url || '').trim();
}

function locationLabel(row: ProductStockLocation): string {
  const deposit = row.deposit?.name || row.deposit?.code || 'Depósito não informado';
  const location = row.location?.name || row.location?.code || 'Local não informado';
  return `${deposit} · ${location}`;
}

export function SaleItemInventoryInfo({ productId, sku, name, variation, imageUrl }: Props) {
  const [product, setProduct] = useState<Product | null>(null);
  const [locations, setLocations] = useState<ProductStockLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        let resolved: Product | null = null;
        if (productId) {
          resolved = await vpsApiService.getProductById(productId, true) as Product | null;
        } else if (sku?.trim()) {
          const normalizedSku = normalizeLookupText(sku).replace(/\s+/g, '');
          const matches = await vpsApiService.getProducts({ sku: sku.trim(), status: 'all', limit: 10, noCache: true });
          resolved = ((matches || []) as Product[]).find((item) => normalizeLookupText(item.sku).replace(/\s+/g, '') === normalizedSku) || null;
        }
        if (!resolved && name.trim()) {
          const matches = await vpsApiService.getProducts({ search: name.trim(), status: 'all', limit: 100, compact: true });
          resolved = pickMarketplaceProduct((matches || []) as Product[], sku, name, variation);
        }
        if (!active) return;
        setProduct(resolved);
        if (!resolved?.id) {
          setLocations([]);
          return;
        }
        const distribution = await stockLocationService.getProductStockDistribution(resolved.id);
        if (active) setLocations(distribution.filter((row) => Number(row.quantity) > 0));
      } catch {
        if (active) {
          setProduct(null);
          setLocations([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [productId, sku, name, variation]);

  const image = firstProductImage(product, imageUrl);
  return (
    <div className="flex min-w-0 gap-3">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {image ? <img src={image} alt={`Foto de ${name}`} className="h-full w-full object-cover" /> : <ImageOff size={18} className="text-slate-400" />}
      </div>
      <div className="min-w-0 flex-1">
        {loading ? <p className="text-xs text-slate-400">Consultando estoque…</p>
          : !product ? <p className="text-xs text-slate-400">Produto não localizado no estoque interno.</p>
            : locations.length === 0 ? <p className="flex items-center gap-1 text-xs text-slate-500"><Package size={13} /> Sem saldo em local de estoque.</p>
              : <div className="space-y-1"><p className="flex items-center gap-1 text-xs font-medium text-slate-600"><MapPin size={13} /> Estoque atual</p>{locations.map((row) => {
                const available = Math.max(0, Number(row.quantity) - Number(row.reserved_quantity));
                return <p key={row.id} className="text-xs text-slate-500">{locationLabel(row)} · {available} disponível{available === 1 ? '' : 'is'}</p>;
              })}</div>}
      </div>
    </div>
  );
}
