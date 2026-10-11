import { calculatePrint3dCost } from '../utils/print3dCost.mjs';
import { buildPrint3dRecipeDraft } from '../utils/print3dRecipeDraft.mjs';
import { print3dRecipesService } from './print3dRecipes';
import { print3dRecipeFilesService, type Print3dFileKind } from './print3dRecipeFiles';
import type { Print3dCostSettings } from './print3dCostSettings';
import type { ProductInput } from '../types/product';

export type PlateFile = { kind: Print3dFileKind; file?: File; existing?: { id:string; kind:Print3dFileKind; sha256:string; byte_size:number; original_name:string } };
export type PlateSetup = { id:string; name:string; hours:number; minutes:number; notes:string; filaments:Array<{ id:string; grams:number }>; files:PlateFile[] };
export type Print3dSetup = {
  revision:string; sourceUrl:string; printer:string; profile:string; pieces:number; laborMinutes:number;
  includesWaste:boolean; notes:string; plates:PlateSetup[]; settings:Print3dCostSettings;
  supplies:Array<{ id:string; quantity:number }>;
};
export const newPrint3dPlate = (): PlateSetup => ({ id:crypto.randomUUID(), name:'', hours:0, minutes:0, notes:'', filaments:[{ id:'', grams:0 }], files:[] });
export const newPrint3dSetup = (settings:Print3dCostSettings): Print3dSetup => ({ revision:`r${Date.now()}`, sourceUrl:'', printer:'', profile:'', pieces:1, laborMinutes:0, includesWaste:true, notes:'', plates:[newPrint3dPlate()], settings, supplies:[] });
// Copies share immutable File bytes, but never share editable lists or settings.
export function copyPrint3dSetup(setup:Print3dSetup):Print3dSetup {
  return { ...setup, revision:`r${crypto.randomUUID()}`, settings:{ ...setup.settings, filaments:setup.settings.filaments.map(f => ({ ...f })), supplies:setup.settings.supplies.map(s => ({ ...s })) },
    supplies:setup.supplies.map(s => ({ ...s })), plates:setup.plates.map(plate => ({ ...plate, id:crypto.randomUUID(), filaments:plate.filaments.map(f => ({ ...f })), files:plate.files.map(entry => ({ ...entry, ...(entry.existing ? { existing:{ ...entry.existing } } : {}) })) })) };
}
export async function assertPrint3dRegistrationAvailable() {
  const status = await print3dRecipesService.status();
  if (!status.enabled || status.platePlans !== true) throw new Error('Fichas com placas ainda não estão disponíveis nesta API. Nenhum parâmetro foi gravado.');
  const files = await print3dRecipeFilesService.status();
  if (!files.enabled) throw new Error('Arquivos privados ainda não disponíveis nesta API.');
}
export function print3dFileKind(name:string):Print3dFileKind {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['stl','obj','step','stp'].includes(ext || '')) return 'model';
  if (['3mf','f3d'].includes(ext || '')) return 'project';
  if (['gcode','gco'].includes(ext || '')) return 'gcode';
  if (ext === 'json') return 'print-json';
  if (['png','jpg','jpeg','webp'].includes(ext || '')) return 'preview';
  if (['pdf','txt'].includes(ext || '')) return 'instructions';
  throw new Error('Formato não suportado. Use STL, 3MF, G-code, OBJ, STEP, F3D, JSON, imagem, PDF ou TXT.');
}
export function print3dSetupParameters(setup:Print3dSetup) {
  if (setup.plates.some(p => !Number.isSafeInteger(p.hours) || p.hours < 0 || !Number.isFinite(p.minutes) || p.minutes < 0 || p.minutes >= 60)) throw new Error('Informe horas inteiras e minutos de 0 a menos de 60 em cada placa.');
  const consumed = new Map<string, number>();
  for (const plate of setup.plates) for (const line of plate.filaments) consumed.set(line.id, (consumed.get(line.id) || 0) + line.grams);
  const filaments = [...consumed].map(([id, consumedGrams]) => {
    const filament = setup.settings.filaments.find(f => f.id === id);
    if (!filament) throw new Error('Selecione um filamento cadastrado para cada placa.');
    if (filament.active === false) throw new Error('Este filamento está inativo. Selecione outro para a nova impressão.');
    return { ...filament, consumedGrams };
  });
  const supplies = setup.supplies.map(line => {
    const supply = setup.settings.supplies.find(s => s.id === line.id);
    if (!supply) throw new Error('Selecione um insumo cadastrado.');
    return { ...supply, quantity:line.quantity };
  });
  if (setup.settings.packagingCentsPerPiece > 0) supplies.push({ id:'packaging-per-piece', name:'Embalagem por peça', unitLabel:'un', quantity:setup.pieces, unitCostCents:setup.settings.packagingCentsPerPiece });
  const printMinutes = setup.plates.reduce((sum, p) => sum + p.hours * 60 + p.minutes, 0);
  const cost = calculatePrint3dCost({ pieces:setup.pieces, printMinutes, laborMinutes:setup.laborMinutes, ...setup.settings, filaments, supplies });
  return { filaments, supplies, printMinutes, cost, materialGrams:filaments.reduce((sum, f) => sum + f.consumedGrams, 0) };
}
export function withPrint3dCost(data:ProductInput, setup:Print3dSetup):ProductInput {
  return { ...data, price_cost:print3dSetupParameters(setup).cost.unitCents,
    ...(!data.is_parent ? { custom_fields:{ ...data.custom_fields, inherit_parent_cost:false } } : {}) };
}
export async function preparePrint3dRegistration(setup:Print3dSetup, product:{ id:string; name:string; sku:string }) {
  if (!setup.profile.trim() || setup.profile.length > 120) throw new Error('Informe o perfil de impressão (até 120 caracteres).');
  const params = print3dSetupParameters(setup);
  const plates = await Promise.all(setup.plates.map(async (plate, index) => ({
    id:plate.id, name:plate.name || `Placa ${index + 1}`, notes:plate.notes, printMinutes:plate.hours * 60 + plate.minutes,
    filaments:plate.filaments.map(f => ({ id:f.id, consumedGrams:f.grams })),
    files:await Promise.all(plate.files.map(async entry => {
      if (!entry.file && entry.existing) return { kind:entry.kind, sha256:entry.existing.sha256, byte_size:entry.existing.byte_size, original_name:entry.existing.original_name };
      const file = entry.file!;
      if (!file || !file.size || file.size > 50 * 1024 * 1024) throw new Error('Cada arquivo privado deve ter até 50 MB e não pode estar vazio.');
      if (entry.kind !== print3dFileKind(file.name)) throw new Error('Tipo de arquivo inválido.');
      if (entry.kind === 'print-json') {
        const { parsePrint3dSummary } = await import('../utils/print3dImport.mjs');
        const summary = parsePrint3dSummary(await file.text());
        if (Math.abs(summary.materialGrams - plate.filaments.reduce((sum, f) => sum + f.grams, 0)) > 0.001 || Math.abs(summary.printMinutes - (plate.hours * 60 + plate.minutes)) > 0.001) throw new Error(`Placa ${index + 1}: o JSON diverge do material ou tempo informado.`);
      }
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      return { kind:entry.kind, sha256:Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,'0')).join(''), byte_size:file.size, original_name:file.name };
    })),
  })));
  return buildPrint3dRecipeDraft({ productId:product.id, productName:product.name, sku:product.sku, revision:setup.revision,
    sourceUrl:setup.sourceUrl, printerName:setup.printer, printerProfile:setup.profile,
    materialIncludesSupportsAndPurge:setup.includesWaste, productionNotes:setup.notes,
    pieces:setup.pieces, laborMinutes:setup.laborMinutes, rates:setup.settings, inputSource:'manual', ...params, plates });
}
// The same immutable revision/hash and content-addressed uploads make retries
// safe after a partial file failure. Never invent a SKU before product save.
export async function savePrint3dRegistration(setup:Print3dSetup, product:{ id:string; name:string; sku:string }) {
  await assertPrint3dRegistrationAvailable();
  const draft = await preparePrint3dRegistration(setup, product);
  const result = await print3dRecipesService.save(draft);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(draft)));
  const expected = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,'0')).join('');
  if (!result.id || result.sha256 !== expected) throw new Error('A API não confirmou integralmente os parâmetros. Os arquivos não foram enviados.');
  for (const plate of setup.plates) for (const entry of plate.files) {
    const file = entry.file || (entry.existing ? new File([await print3dRecipeFilesService.download(entry.existing.id)], entry.existing.original_name) : null);
    if (!file) throw new Error('Arquivo de impressão indisponível.');
    await print3dRecipeFilesService.upload(result.id, entry.kind, file, setup.profile, plate.id);
  }
  return result;
}
