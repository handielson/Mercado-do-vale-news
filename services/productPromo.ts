// model-version-promo-v1: grava a promoção por tempo limitado nos cadastros (products.price_promo/promo_start/promo_end).
// É o mesmo campo do formulário do produto (seção "Promoção por Tempo Limitado") e o que a campanha do Marketing lê.
// Usa o PATCH parcial do produto: só esses três campos mudam; preços do grupo e custo ficam intactos.
import { vpsClient } from './vpsClient';
import { vpsApiService } from './vpsApiService';

export type PromoInput = { priceCents: number; start: string | null; end: string | null } | null;

export async function saveProductsPromo(productIds: string[], promo: PromoInput): Promise<{ saved: number; failed: Array<{ id: string; error: string }> }> {
  const body = promo
    ? { price_promo: promo.priceCents, promo_start: promo.start || null, promo_end: promo.end || null }
    : { price_promo: null, promo_start: null, promo_end: null };
  const failed: Array<{ id: string; error: string }> = [];
  let saved = 0;
  for (const id of productIds) {
    try {
      await vpsClient.patch(`/table-data/products/${encodeURIComponent(id)}`, body);
      saved += 1;
    } catch (error) {
      failed.push({ id, error: error instanceof Error ? error.message : 'erro ao salvar' });
    }
  }
  vpsApiService.invalidateProductCache();
  return { saved, failed };
}
