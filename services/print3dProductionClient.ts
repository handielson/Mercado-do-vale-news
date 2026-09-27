import { vpsClient } from './vpsClient';
import { print3dAccountClient } from './print3dAccountClient';

export type ProductionStatus = 'awaiting_payment' | 'queued' | 'in_progress' | 'completed' | 'cancelled';
export type ProductionEvent = { id: string; approved_quantity: number; rejected_quantity?: number; material_consumed_grams?: number; note?: string; created_at: string };
export type ProductionFilament = { id: string; name: string; color: string; estimated_grams_per_batch: number };
export type ProductionSupply = { id:string;name:string;unit_label:string;estimated_quantity_per_batch:number };
export type PinnedProductionFile = {id:string;revision:string;kind:'model'|'project'|'gcode';original_name:string;printer_profile:string|null;sha256:string;byte_size:number};
export type Print3dMaterialBalance = { filament_id: string; name_snapshot: string; color_snapshot: string; quantity_grams: number; updated_at: string };
export type Print3dSupplyBalance = { supply_id:string;name_snapshot:string;unit_snapshot:string;quantity_units:number;updated_at:string };
export type ProductionJob = {
  id: string; order_id: string; order_number: string; order_item_id: string;
  product_name: string; sku: string; target_quantity: number; approved_quantity: number;
  variant_snapshot?: Record<string,string>;
  rejected_quantity?: number; material_consumed_grams?: number; reserved_for_order_quantity: number; dispatched_quantity?: number;
  status: ProductionStatus; history: ProductionEvent[]; filaments?: ProductionFilament[]; supplies?: ProductionSupply[];
  primary_file?: PinnedProductionFile | null; recipe_summary?: {pieces_per_batch:number;material_gramas:number;tempo_impressao_minutos:number}|null;
};
export type ProductionProgress = { idempotency_key: string; approved_quantity: number; rejected_quantity: number; material_consumed_grams: number; filaments: { filament_id: string; consumed_grams: number }[]; supplies: { supply_id:string;consumed_quantity:number }[]; note: string };
export const print3dProductionClient = {
  adminList: () => vpsClient.get<{ enabled?: boolean; jobs: ProductionJob[] }>('/admin/print3d/production'),
  customerList: () => print3dAccountClient.requestStore<{ jobs: ProductionJob[] }>('/print3d/production'),
  record: (id: string, progress: ProductionProgress) => vpsClient.post<{ job: ProductionJob; replayed: boolean }>(
    '/admin/print3d/production/' + encodeURIComponent(id) + '/progress', progress),
  materials: () => vpsClient.get<{ materials: Print3dMaterialBalance[] }>('/admin/print3d/materials'),
  receiveMaterial: (filament_id: string, quantity_grams: number, idempotency_key: string) =>
    vpsClient.post<{ filament_id: string; quantity_grams: number; replayed: boolean }>('/admin/print3d/materials/receipts', { filament_id,quantity_grams,idempotency_key }),
  supplies: () => vpsClient.get<{supplies:Print3dSupplyBalance[]}>('/admin/print3d/supplies'),
  receiveSupply: (supply_id:string,quantity_units:number,idempotency_key:string) =>
    vpsClient.post<{supply_id:string;quantity_units:number;replayed:boolean}>('/admin/print3d/supplies/receipts',{supply_id,quantity_units,idempotency_key}),
};
export const productionStatusLabel: Record<ProductionStatus, string> = {
  awaiting_payment: 'Aguardando entrada', queued: 'Na fila de produção',
  in_progress: 'Em produção', completed: 'Produção concluída', cancelled: 'Cancelada',
};
const DEMO_KEY = 'print3d_production_demo_v1';
export function initialProductionDemo(): ProductionJob {
  return { id: 'demo-production', order_id: 'demo-order', order_number: '3D-DEMO-100',
    order_item_id: 'demo-item', product_name: 'Chaveiro personalizado', sku: 'DEMO-CHAVEIRO',
    target_quantity: 100, approved_quantity: 20, reserved_for_order_quantity: 20, rejected_quantity: 0, status: 'in_progress',
    material_consumed_grams: 35, filaments: [{ id:'demo-pla',name:'PLA',color:'Areia',estimated_grams_per_batch:35 }], history: [{ id: 'demo-first', approved_quantity: 20, rejected_quantity: 0, material_consumed_grams: 35,
      note: 'Primeiro lote aprovado (simulação).', created_at: new Date().toISOString() }] };
}
export function readProductionDemo(): ProductionJob {
  try {
    const data = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null');
    if (data?.id === 'demo-production' && data.target_quantity === 100
      && Number.isInteger(data.approved_quantity) && data.approved_quantity >= 20
      && data.approved_quantity <= 100 && Array.isArray(data.history) && Array.isArray(data.filaments)) return data;
  } catch { /* A prévia permanece utilizável sem armazenamento local. */ }
  return initialProductionDemo();
}
export function saveProductionDemo(job: ProductionJob) {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(job)); } catch { /* Prévia em memória. */ }
}
