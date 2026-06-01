import { vpsApiService } from './vpsApiService';
import { vpsClient } from './vpsClient';
import {
  LocationContentItem,
  ProductStockLocation,
  StockDeposit,
  StockDepositInput,
  StockDepositUpdateInput,
  StockLocation,
  StockLocationAdjustmentInput,
  StockLocationDivergence,
  StockLocationEntryInput,
  StockLocationInput,
  StockLocationMovement,
  StockLocationMovementFilters,
  StockLocationMovementInput,
  StockLocationOrderReservationInput,
  StockLocationOrderReservationResult,
  StockLocationOrderRestoreInput,
  StockLocationOrderRestoreResult,
  StockLocationPriorityDecrementInput,
  StockLocationPriorityDecrementResult,
  StockLocationPriorityReservationInput,
  StockLocationPriorityReservationResult,
  StockLocationProductSearchResult,
  StockLocationSaleRestoreInput,
  StockLocationSaleRestoreResult,
  StockLocationTransferInput,
  StockLocationUpdateInput,
  StockPathDeactivationCheck,
} from '../types/stock-location';

function normalizeLocationCode(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
}

class StockLocationService {
  async listDeposits(): Promise<StockDeposit[]> {
    return vpsClient.get<StockDeposit[]>('/stock-locations/deposits');
  }

  async createDeposit(input: StockDepositInput): Promise<StockDeposit> {
    const name = input.name.trim();
    const code = normalizeLocationCode(input.code || input.name);

    if (!name) throw new Error('Informe o nome do deposito.');
    if (!code) throw new Error('Informe um codigo valido para o deposito.');

    return vpsClient.post<StockDeposit>('/stock-locations/deposits', {
      name,
      code,
      type: input.type || 'warehouse',
      cep: input.cep?.trim() || null,
      address: input.address?.trim() || null,
      is_default: Boolean(input.is_default),
    });
  }

  async updateDeposit(id: string, input: StockDepositUpdateInput): Promise<StockDeposit> {
    const name = input.name.trim();
    const code = normalizeLocationCode(input.code || input.name);

    if (!id) throw new Error('Deposito obrigatorio.');
    if (!name) throw new Error('Informe o nome do deposito.');
    if (!code) throw new Error('Informe um codigo valido para o deposito.');

    return vpsClient.patch<StockDeposit>(`/stock-locations/deposits/${encodeURIComponent(id)}`, {
      name,
      code,
      type: input.type || 'warehouse',
      cep: input.cep?.trim() || null,
      address: input.address?.trim() || null,
      is_default: Boolean(input.is_default),
    });
  }

  async listLocations(depositId?: string): Promise<StockLocation[]> {
    const query = depositId ? `?deposit_id=${encodeURIComponent(depositId)}` : '';
    return vpsClient.get<StockLocation[]>(`/stock-locations/locations${query}`);
  }

  async createLocation(input: StockLocationInput): Promise<StockLocation> {
    const name = input.name.trim();
    const code = normalizeLocationCode(input.code || input.name);

    if (!input.deposit_id) throw new Error('Selecione o deposito do local.');
    if (!name) throw new Error('Informe o nome do local.');
    if (!code) throw new Error('Informe um codigo valido para o local.');

    return vpsClient.post<StockLocation>('/stock-locations/locations', {
      deposit_id: input.deposit_id,
      name,
      code,
      description: input.description?.trim() || null,
      is_default: Boolean(input.is_default),
    });
  }

  async updateLocation(id: string, input: StockLocationUpdateInput): Promise<StockLocation> {
    const name = input.name.trim();
    const code = normalizeLocationCode(input.code || input.name);

    if (!id) throw new Error('Local obrigatorio.');
    if (!input.deposit_id) throw new Error('Selecione o deposito do local.');
    if (!name) throw new Error('Informe o nome do local.');
    if (!code) throw new Error('Informe um codigo valido para o local.');

    return vpsClient.patch<StockLocation>(`/stock-locations/locations/${encodeURIComponent(id)}`, {
      deposit_id: input.deposit_id,
      name,
      code,
      description: input.description?.trim() || null,
      is_default: Boolean(input.is_default),
    });
  }

  async getProductStockDistribution(productId: string): Promise<ProductStockLocation[]> {
    return vpsClient.get<ProductStockLocation[]>(
      `/stock-locations/products/${encodeURIComponent(productId)}/distribution`
    );
  }

  async getLocationContents(locationId: string): Promise<LocationContentItem[]> {
    return vpsClient.get<LocationContentItem[]>(
      `/stock-locations/locations/${encodeURIComponent(locationId)}/contents`
    );
  }

  async searchProducts(term: string): Promise<StockLocationProductSearchResult[]> {
    const cleanTerm = term.trim();
    if (cleanTerm.length < 2) return [];

    const searchTerm = cleanTerm.replace(/[,%]/g, '');
    const rows = await vpsApiService.getProducts({
      search: searchTerm,
      status: 'all',
      limit: 32,
    });
    if (!Array.isArray(rows)) return [];

    return rows
      .filter((p: any) => {
        const qty = Number(p?.stock_quantity || 0);
        if (qty <= 0) return false;
        const isParent = p?.is_parent;
        return !(isParent === true || isParent === 1);
      })
      .slice(0, 8)
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku || null,
        ean: p.ean || null,
        stock_quantity: Number(p.stock_quantity || 0),
        images: Array.isArray(p.images) ? p.images : null,
      })) as StockLocationProductSearchResult[];
  }

  async getStockDivergences(): Promise<StockLocationDivergence[]> {
    return vpsClient.get<StockLocationDivergence[]>('/stock-locations/divergences');
  }

  async listMovements(filters: StockLocationMovementFilters = {}): Promise<StockLocationMovement[]> {
    const safeLimit = Math.min(Math.max(filters.limit || 50, 1), 200);
    const qs = new URLSearchParams({ limit: String(safeLimit) });
    if (filters.productId) qs.set('productId', filters.productId);
    if (filters.locationId) qs.set('locationId', filters.locationId);
    if (filters.movementType) qs.set('movementType', filters.movementType);
    if (filters.referenceType) qs.set('referenceType', filters.referenceType);
    if (filters.referenceId) qs.set('referenceId', filters.referenceId);
    return vpsClient.get<StockLocationMovement[]>(`/stock-locations/movements?${qs.toString()}`);
  }

  async recordMovement(input: StockLocationMovementInput): Promise<StockLocationMovement> {
    const movement = await vpsClient.post<StockLocationMovement>('/stock-locations/movements', input);
    return movement;
  }

  async adjustStockLocation(input: StockLocationAdjustmentInput): Promise<ProductStockLocation> {
    const quantity = Number(input.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new Error('Informe uma quantidade valida para o ajuste.');
    }
    if (!input.reason.trim()) throw new Error('Informe o motivo do ajuste.');

    return vpsClient.post<ProductStockLocation>('/stock-locations/adjustments', {
      ...input,
      quantity,
      reason: input.reason.trim(),
      notes: input.notes?.trim() || null,
    });
  }

  async transferStockLocation(input: StockLocationTransferInput): Promise<ProductStockLocation[]> {
    const quantity = Number(input.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Informe uma quantidade valida para a transferencia.');
    }
    if (input.from_location_id === input.to_location_id) {
      throw new Error('A origem e destino precisam ser diferentes.');
    }

    return vpsClient.post<ProductStockLocation[]>('/stock-locations/transfers', {
      ...input,
      quantity,
      reason: input.reason.trim() || 'Transferencia interna',
      notes: input.notes?.trim() || null,
    });
  }

  async addStockLocation(input: StockLocationEntryInput): Promise<ProductStockLocation> {
    const quantity = Number(input.quantity);
    if (!input.product_id || !input.deposit_id || !input.location_id) {
      throw new Error('Produto, deposito e local sao obrigatorios.');
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Informe uma quantidade valida para a entrada.');
    }
    if (!input.reason.trim()) throw new Error('Informe o motivo da entrada.');

    return vpsClient.post<ProductStockLocation>('/stock-locations/entries', {
      ...input,
      quantity,
      reason: input.reason.trim(),
      notes: input.notes?.trim() || null,
    });
  }

  async getDepositDeactivationCheck(id: string): Promise<StockPathDeactivationCheck> {
    return vpsClient.get<StockPathDeactivationCheck>(
      `/stock-locations/deposits/${encodeURIComponent(id)}/deactivation-check`
    );
  }

  async getLocationDeactivationCheck(id: string): Promise<StockPathDeactivationCheck> {
    return vpsClient.get<StockPathDeactivationCheck>(
      `/stock-locations/locations/${encodeURIComponent(id)}/deactivation-check`
    );
  }

  async deactivateDeposit(id: string): Promise<void> {
    await vpsClient.post<{ ok: boolean }>(`/stock-locations/deposits/${encodeURIComponent(id)}/deactivate`, {});
  }

  async deactivateLocation(id: string): Promise<void> {
    await vpsClient.post<{ ok: boolean }>(`/stock-locations/locations/${encodeURIComponent(id)}/deactivate`, {});
  }

  async decrementStockByPriority(
    input: StockLocationPriorityDecrementInput
  ): Promise<StockLocationPriorityDecrementResult[]> {
    return vpsClient.post<StockLocationPriorityDecrementResult[]>('/stock-locations/priority-decrements', {
      ...input,
      quantity: Number(input.quantity),
      reason: input.reason.trim(),
      reference_type: input.reference_type || null,
      reference_id: input.reference_id || null,
      notes: input.notes?.trim() || null,
    });
  }

  async reserveStockByPriority(
    input: StockLocationPriorityReservationInput
  ): Promise<StockLocationPriorityReservationResult[]> {
    return vpsClient.post<StockLocationPriorityReservationResult[]>('/stock-locations/priority-reservations', {
      ...input,
      quantity: Number(input.quantity),
      reason: input.reason.trim(),
      reference_type: input.reference_type || null,
      reference_id: input.reference_id || null,
      notes: input.notes?.trim() || null,
    });
  }

  async consumeOrderStockReservations(
    input: StockLocationOrderReservationInput
  ): Promise<StockLocationOrderReservationResult[]> {
    return vpsClient.post<StockLocationOrderReservationResult[]>('/stock-locations/order-reservations/consume', {
      order_id: input.order_id,
      reason: input.reason.trim(),
      notes: input.notes?.trim() || null,
    });
  }

  async releaseOrderStockReservations(
    input: StockLocationOrderReservationInput
  ): Promise<StockLocationOrderReservationResult[]> {
    return vpsClient.post<StockLocationOrderReservationResult[]>('/stock-locations/order-reservations/release', {
      order_id: input.order_id,
      reason: input.reason.trim(),
      notes: input.notes?.trim() || null,
    });
  }

  async restoreSaleStockByLocation(
    input: StockLocationSaleRestoreInput
  ): Promise<StockLocationSaleRestoreResult[]> {
    return vpsClient.post<StockLocationSaleRestoreResult[]>('/stock-locations/sale-restores', {
      sale_id: input.sale_id,
      reason: input.reason.trim(),
      notes: input.notes?.trim() || null,
    });
  }

  async restoreOrderStockByLocation(
    input: StockLocationOrderRestoreInput
  ): Promise<StockLocationOrderRestoreResult[]> {
    return vpsClient.post<StockLocationOrderRestoreResult[]>('/stock-locations/order-restores', {
      order_id: input.order_id,
      reason: input.reason.trim(),
      notes: input.notes?.trim() || null,
    });
  }
}

export const stockLocationService = new StockLocationService();
export default stockLocationService;
