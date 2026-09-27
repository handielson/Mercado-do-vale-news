import { vpsClient } from './vpsClient';
import { print3dAccountClient } from './print3dAccountClient';

export type ProductionStatus = 'awaiting_payment' | 'queued' | 'in_progress' | 'completed' | 'cancelled';
export type ProductionEvent = { id: string; approved_quantity: number; rejected_quantity?: number; note?: string; created_at: string };
export type ProductionJob = {
  id: string; order_id: string; order_number: string; order_item_id: string;
  product_name: string; sku: string; target_quantity: number; approved_quantity: number;
  rejected_quantity?: number; status: ProductionStatus; history: ProductionEvent[];
};
export type ProductionProgress = { idempotency_key: string; approved_quantity: number; rejected_quantity: number; note: string };
export const print3dProductionClient = {
  adminList: () => vpsClient.get<{ enabled?: boolean; jobs: ProductionJob[] }>('/admin/print3d/production'),
  customerList: () => print3dAccountClient.requestStore<{ jobs: ProductionJob[] }>('/print3d/production'),
  record: (id: string, progress: ProductionProgress) => vpsClient.post<{ job: ProductionJob; replayed: boolean }>(
    '/admin/print3d/production/' + encodeURIComponent(id) + '/progress', progress),
};
export const productionStatusLabel: Record<ProductionStatus, string> = {
  awaiting_payment: 'Aguardando entrada', queued: 'Na fila de produção',
  in_progress: 'Em produção', completed: 'Produção concluída', cancelled: 'Cancelada',
};
const DEMO_KEY = 'print3d_production_demo_v1';
export function initialProductionDemo(): ProductionJob {
  return { id: 'demo-production', order_id: 'demo-order', order_number: '3D-DEMO-100',
    order_item_id: 'demo-item', product_name: 'Chaveiro personalizado', sku: 'DEMO-CHAVEIRO',
    target_quantity: 100, approved_quantity: 20, rejected_quantity: 0, status: 'in_progress',
    history: [{ id: 'demo-first', approved_quantity: 20, rejected_quantity: 0,
      note: 'Primeiro lote aprovado (simulação).', created_at: new Date().toISOString() }] };
}
export function readProductionDemo(): ProductionJob {
  try {
    const data = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null');
    if (data?.id === 'demo-production' && data.target_quantity === 100
      && Number.isInteger(data.approved_quantity) && data.approved_quantity >= 20
      && data.approved_quantity <= 100 && Array.isArray(data.history)) return data;
  } catch { /* A prévia permanece utilizável sem armazenamento local. */ }
  return initialProductionDemo();
}
export function saveProductionDemo(job: ProductionJob) {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(job)); } catch { /* Prévia em memória. */ }
}
