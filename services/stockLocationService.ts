import { supabase } from './supabase';
import { getCompanyId } from './companyContext';
import {
  ProductStockLocation,
  StockDeposit,
  StockDepositInput,
  StockLocation,
  StockLocationAdjustmentInput,
  StockLocationDivergence,
  StockLocationEntryInput,
  StockLocationMovement,
  StockLocationMovementFilters,
  StockLocationMovementInput,
  StockLocationPriorityDecrementInput,
  StockLocationPriorityDecrementResult,
  StockLocationPriorityReservationInput,
  StockLocationPriorityReservationResult,
  StockLocationOrderReservationInput,
  StockLocationOrderReservationResult,
  StockLocationProductSearchResult,
  StockLocationTransferInput,
  StockLocationOrderRestoreInput,
  StockLocationOrderRestoreResult,
  StockLocationSaleRestoreInput,
  StockLocationSaleRestoreResult,
  StockLocationInput,
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
    const { data, error } = await supabase
      .from('stock_deposits')
      .select('*')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as StockDeposit[];
  }

  async createDeposit(input: StockDepositInput): Promise<StockDeposit> {
    const companyId = await getCompanyId();
    const name = input.name.trim();
    const code = normalizeLocationCode(input.code || input.name);

    if (!name) {
      throw new Error('Informe o nome do deposito.');
    }

    if (!code) {
      throw new Error('Informe um codigo valido para o deposito.');
    }

    const payload = {
      company_id: companyId,
      name,
      code,
      type: input.type || 'warehouse',
      cep: input.cep?.trim() || null,
      address: input.address?.trim() || null,
      is_default: Boolean(input.is_default),
      is_active: true,
    };

    const { data, error } = await supabase
      .from('stock_deposits')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as StockDeposit;
  }

  async listLocations(depositId?: string): Promise<StockLocation[]> {
    let query = supabase
      .from('stock_locations')
      .select('*')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (depositId) {
      query = query.eq('deposit_id', depositId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data || []) as StockLocation[];
  }

  async createLocation(input: StockLocationInput): Promise<StockLocation> {
    const companyId = await getCompanyId();
    const name = input.name.trim();
    const code = normalizeLocationCode(input.code || input.name);

    if (!input.deposit_id) {
      throw new Error('Selecione o deposito do local.');
    }

    if (!name) {
      throw new Error('Informe o nome do local.');
    }

    if (!code) {
      throw new Error('Informe um codigo valido para o local.');
    }

    const payload = {
      company_id: companyId,
      deposit_id: input.deposit_id,
      name,
      code,
      description: input.description?.trim() || null,
      is_default: Boolean(input.is_default),
      is_active: true,
    };

    const { data, error } = await supabase
      .from('stock_locations')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as StockLocation;
  }

  async getProductStockDistribution(productId: string): Promise<ProductStockLocation[]> {
    const { data, error } = await supabase
      .from('product_stock_locations')
      .select(`
        *,
        deposit:stock_deposits(*),
        location:stock_locations(*)
      `)
      .eq('product_id', productId)
      .order('quantity', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []) as ProductStockLocation[];
  }

  async searchProducts(term: string): Promise<StockLocationProductSearchResult[]> {
    const cleanTerm = term.trim();

    if (cleanTerm.length < 2) {
      return [];
    }

    const searchTerm = cleanTerm.replace(/[,%]/g, '');

    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku, ean, stock_quantity, images')
      .or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,ean.ilike.%${searchTerm}%`)
      .order('name', { ascending: true })
      .limit(8);

    if (error) {
      throw error;
    }

    return (data || []).map((product: any) => ({
      ...product,
      stock_quantity: Number(product.stock_quantity || 0),
    })) as StockLocationProductSearchResult[];
  }

  async getStockDivergences(): Promise<StockLocationDivergence[]> {
    const { data, error } = await supabase
      .from('stock_location_divergences')
      .select('*')
      .neq('difference', 0)
      .order('product_name', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as StockLocationDivergence[];
  }

  async listMovements(filters: StockLocationMovementFilters = {}): Promise<StockLocationMovement[]> {
    const safeLimit = Math.min(Math.max(filters.limit || 50, 1), 200);

    let query = supabase
      .from('stock_location_movements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (filters.productId) {
      query = query.eq('product_id', filters.productId);
    }

    if (filters.locationId) {
      query = query.or(`from_location_id.eq.${filters.locationId},to_location_id.eq.${filters.locationId}`);
    }

    if (filters.movementType) {
      query = query.eq('movement_type', filters.movementType);
    }

    if (filters.referenceType) {
      query = query.eq('reference_type', filters.referenceType);
    }

    if (filters.referenceId) {
      query = query.eq('reference_id', filters.referenceId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data || []) as StockLocationMovement[];
  }

  async recordMovement(input: StockLocationMovementInput): Promise<StockLocationMovement> {
    const companyId = await getCompanyId();
    const user = await supabase.auth.getUser();

    const payload = {
      ...input,
      company_id: companyId,
      created_by: user.data.user?.id || null,
    };

    const { data, error } = await supabase
      .from('stock_location_movements')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as StockLocationMovement;
  }

  async adjustStockLocation(input: StockLocationAdjustmentInput): Promise<ProductStockLocation> {
    const quantity = Number(input.quantity);

    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new Error('Informe uma quantidade valida para o ajuste.');
    }

    if (!input.reason.trim()) {
      throw new Error('Informe o motivo do ajuste.');
    }

    const user = await supabase.auth.getUser();

    const { data, error } = await supabase
      .rpc('adjust_product_stock_location', {
        target_product_id: input.product_id,
        target_deposit_id: input.deposit_id,
        target_location_id: input.location_id,
        target_quantity: input.quantity,
        adjustment_reason: input.reason.trim(),
        adjustment_notes: input.notes?.trim() || null,
        actor_id: user.data.user?.id || null,
      });

    if (error) {
      throw error;
    }

    return data as ProductStockLocation;
  }

  async transferStockLocation(input: StockLocationTransferInput): Promise<ProductStockLocation[]> {
    const quantity = Number(input.quantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Informe uma quantidade válida para a transferência.');
    }

    if (input.from_location_id === input.to_location_id) {
      throw new Error('A origem e destino precisam ser diferentes.');
    }

    const user = await supabase.auth.getUser();

    const { data, error } = await supabase
      .rpc('transfer_product_stock_location', {
        target_product_id: input.product_id,
        from_deposit_id: input.from_deposit_id,
        from_location_id: input.from_location_id,
        to_deposit_id: input.to_deposit_id,
        to_location_id: input.to_location_id,
        transfer_quantity: quantity,
        transfer_reason: input.reason.trim() || 'Transferência interna',
        transfer_notes: input.notes?.trim() || null,
        actor_id: user.data.user?.id || null,
      });

    if (error) {
      throw error;
    }

    return (data || []) as ProductStockLocation[];
  }

  async addStockLocation(input: StockLocationEntryInput): Promise<ProductStockLocation> {
    const quantity = Number(input.quantity);

    if (!input.product_id || !input.deposit_id || !input.location_id) {
      throw new Error('Produto, deposito e local sao obrigatorios.');
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Informe uma quantidade valida para a entrada.');
    }

    if (!input.reason.trim()) {
      throw new Error('Informe o motivo da entrada.');
    }

    const user = await supabase.auth.getUser();

    const { data, error } = await supabase
      .rpc('add_product_stock_location', {
        target_product_id: input.product_id,
        target_deposit_id: input.deposit_id,
        target_location_id: input.location_id,
        entry_quantity: quantity,
        entry_reason: input.reason.trim(),
        entry_notes: input.notes?.trim() || null,
        actor_id: user.data.user?.id || null,
      });

    if (error) {
      throw error;
    }

    return data as ProductStockLocation;
  }

  async decrementStockByPriority(
    input: StockLocationPriorityDecrementInput
  ): Promise<StockLocationPriorityDecrementResult[]> {
    const quantity = Number(input.quantity);

    if (!input.product_id) {
      throw new Error('Produto obrigatorio.');
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Informe uma quantidade valida.');
    }

    if (!input.reason.trim()) {
      throw new Error('Informe o motivo da baixa.');
    }

    const { data, error } = await supabase
      .rpc('decrement_product_stock_by_priority', {
        p_product_id: input.product_id,
        p_quantity: quantity,
        p_reason: input.reason.trim(),
        p_reference_type: input.reference_type || null,
        p_reference_id: input.reference_id || null,
        p_notes: input.notes?.trim() || null,
      });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as StockLocationPriorityDecrementResult[];
  }

  async reserveStockByPriority(
    input: StockLocationPriorityReservationInput
  ): Promise<StockLocationPriorityReservationResult[]> {
    const quantity = Number(input.quantity);

    if (!input.product_id) {
      throw new Error('Produto obrigatorio.');
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Informe uma quantidade valida.');
    }

    if (!input.reason.trim()) {
      throw new Error('Informe o motivo da reserva.');
    }

    const { data, error } = await supabase
      .rpc('reserve_product_stock_by_priority', {
        p_product_id: input.product_id,
        p_quantity: quantity,
        p_reason: input.reason.trim(),
        p_reference_type: input.reference_type || null,
        p_reference_id: input.reference_id || null,
        p_notes: input.notes?.trim() || null,
      });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as StockLocationPriorityReservationResult[];
  }

  async consumeOrderStockReservations(
    input: StockLocationOrderReservationInput
  ): Promise<StockLocationOrderReservationResult[]> {
    if (!input.order_id) {
      throw new Error('Pedido obrigatorio.');
    }

    if (!input.reason.trim()) {
      throw new Error('Informe o motivo da baixa.');
    }

    const { data, error } = await supabase
      .rpc('consume_order_stock_reservations', {
        p_order_id: input.order_id,
        p_reason: input.reason.trim(),
        p_notes: input.notes?.trim() || null,
      });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as StockLocationOrderReservationResult[];
  }

  async releaseOrderStockReservations(
    input: StockLocationOrderReservationInput
  ): Promise<StockLocationOrderReservationResult[]> {
    if (!input.order_id) {
      throw new Error('Pedido obrigatorio.');
    }

    if (!input.reason.trim()) {
      throw new Error('Informe o motivo da liberacao.');
    }

    const { data, error } = await supabase
      .rpc('release_order_stock_reservations', {
        p_order_id: input.order_id,
        p_reason: input.reason.trim(),
        p_notes: input.notes?.trim() || null,
      });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as StockLocationOrderReservationResult[];
  }

  async restoreSaleStockByLocation(
    input: StockLocationSaleRestoreInput
  ): Promise<StockLocationSaleRestoreResult[]> {
    if (!input.sale_id) {
      throw new Error('Venda obrigatoria.');
    }

    if (!input.reason.trim()) {
      throw new Error('Informe o motivo da devolucao.');
    }

    const { data, error } = await supabase
      .rpc('restore_product_stock_from_sale_movements', {
        p_sale_id: input.sale_id,
        p_reason: input.reason.trim(),
        p_notes: input.notes?.trim() || null,
      });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as StockLocationSaleRestoreResult[];
  }

  async restoreOrderStockByLocation(
    input: StockLocationOrderRestoreInput
  ): Promise<StockLocationOrderRestoreResult[]> {
    if (!input.order_id) {
      throw new Error('Pedido obrigatorio.');
    }

    if (!input.reason.trim()) {
      throw new Error('Informe o motivo da devolucao.');
    }

    const { data, error } = await supabase
      .rpc('restore_product_stock_from_order_movements', {
        p_order_id: input.order_id,
        p_reason: input.reason.trim(),
        p_notes: input.notes?.trim() || null,
      });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as StockLocationOrderRestoreResult[];
  }
}

export const stockLocationService = new StockLocationService();
export default stockLocationService;
