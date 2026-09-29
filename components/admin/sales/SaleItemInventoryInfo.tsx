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
  imageUrl?: string | null;
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

export function SaleItemInventoryInfo({ productId, sku, name, imageUrl }: Props) {
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
          const normalizedSku = sku.trim().toLocaleLowerCase('pt-BR');
          const matches = await vpsApiService.getProducts({ sku: sku.trim(), status: 'all', limit: 10, noCache: true });
          resolved = ((matches || []) as Product[]).find((item) => item.sku?.trim().toLocaleLowerCase('pt-BR') === normalizedSku) || null;
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
  }, [productId, sku]);

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
