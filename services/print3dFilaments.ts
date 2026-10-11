import { vpsClient } from './vpsClient';
import type { Print3dFilament } from './print3dCostSettings';
export type FilamentCatalog = { filaments:Print3dFilament[]; version:string; references:{ brands:string[]; materials:string[]; colors:string[]; color_hex?:Record<string,string> }; preview?:boolean; pending?:boolean };
export type FilamentMovement = { id:string; filament_id:string; movement_key:string; quantity_delta_grams:number; reason:string; note?:string; created_at:string; preview?:boolean };
export type FilamentStock = { enabled:boolean; preview?:boolean; unknown_ids?:string[]; balances:Array<{ filament_id:string; quantity_grams:number }>; movements:FilamentMovement[] };
export type FilamentStockInput = { filament_id:string; quantity_grams:number; expected_grams:number; idempotency_key:string; reason:'receipt'|'adjustment'; note:string; action?:'used'|'deactivate'; entry_date?:string };
export const print3dFilamentsService = {
  list:() => vpsClient.get<FilamentCatalog>('/admin/print3d/filaments'),
  save:(filament:Print3dFilament, version:string, receipt?:FilamentStockInput) => vpsClient.post<FilamentCatalog>('/admin/print3d/filaments', { filament, version, receipt }),
  stock:() => vpsClient.get<FilamentStock>('/admin/print3d/filaments/stock'),
  move:(input:FilamentStockInput) => vpsClient.post('/admin/print3d/filaments/movements', input),
  approve:() => vpsClient.post('/admin/print3d/filaments/approve', {}),
};
