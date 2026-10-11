import { vpsClient } from './vpsClient';
import { getAuthSessionToken } from './authSession';
import { buildVpsUrl } from './vpsProxyBase';
import type { ProductInput } from '../types/product';
import type { FamilyRow, FamilyEditorDraft } from '../components/products/ProductFamilyEditor';
import type { Print3dSetup } from './print3dRegistration';

export type ProductFormSnapshot = {
  schemaVersion: 1; data: ProductInput & { id?: string }; activeSection: string; activeSalesChannel: string;
  familyRows: FamilyRow[]; familyEditor?: FamilyEditorDraft;
  productionSetups: Record<string, Print3dSetup | undefined>; productionRowKey: string;
  serialList: any[]; useCustomImages: boolean; nameManuallyEdited: boolean;
  familyCheckpoint: any; singleSaveCheckpoint?: any;
  completion?: { savedProductId?: string };
};
export type ProductFormDraft = { id: string; revision: number; title: string; status: 'pending' | 'completed' | 'archived'; updated_at: string; created_at: string; snapshot: ProductFormSnapshot };
export type ProductFormDraftSummary = Omit<ProductFormDraft, 'snapshot'> & { is_print3d: boolean; is_parent: boolean };
const fileIds = new WeakMap<File, Map<string, string>>();

// Files are sent separately; JSON alone would silently turn a File into {}.
export async function encodeDraftFiles(value: any, upload: (id: string, file: File) => Promise<unknown>, namespace = 'default'): Promise<any> {
  if (value instanceof File) {
    let ids = fileIds.get(value); if (!ids) { ids = new Map(); fileIds.set(value, ids); }
    let id = ids.get(namespace);
    if (!id) { id = crypto.randomUUID(); await upload(id, value); ids.set(namespace, id); }
    return { __productDraftFile: id, name: value.name, type: value.type, size: value.size, lastModified: value.lastModified };
  }
  if (Array.isArray(value)) { const result = []; for (const entry of value) result.push(await encodeDraftFiles(entry, upload, namespace)); return result; }
  if (value && typeof value === 'object') { const result: Record<string, any> = {}; for (const [key, entry] of Object.entries(value)) result[key] = await encodeDraftFiles(entry, upload, namespace); return result; }
  return value;
}
export async function decodeDraftFiles(value: any, download: (id: string) => Promise<Blob>, namespace = 'default'): Promise<any> {
  if (value?.__productDraftFile) {
    const blob = await download(value.__productDraftFile);
    if (blob.size !== value.size) throw new Error(`Arquivo incompleto no rascunho: ${value.name}`);
    const file = new File([blob], value.name, { type: value.type, lastModified: value.lastModified });
    fileIds.set(file, new Map([[namespace, value.__productDraftFile]])); return file;
  }
  if (Array.isArray(value)) { const result = []; for (const entry of value) result.push(await decodeDraftFiles(entry, download, namespace)); return result; }
  if (value && typeof value === 'object') { const result: Record<string, any> = {}; for (const [key, entry] of Object.entries(value)) result[key] = await decodeDraftFiles(entry, download, namespace); return result; }
  return value;
}
async function hydrateDraftFiles(value: any, id: string) {
  return decodeDraftFiles(value, async fileId => {
    const token = await getAuthSessionToken();
    if (!token) throw new Error('Sessão expirada.');
    const response = await fetch(buildVpsUrl(`/admin/product-form-drafts/${id}/files/${fileId}`, { method: 'GET' }), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!response.ok) throw new Error('Não foi possível recuperar todos os arquivos do rascunho. Tente novamente.');
    return response.blob();
  }, id);
}
export const productFormDraftsService = {
  list: () => vpsClient.get<{ drafts: ProductFormDraftSummary[] }>('/admin/product-form-drafts'),
  async get(id: string): Promise<ProductFormDraft> {
    const result = await vpsClient.get<ProductFormDraft>(`/admin/product-form-drafts/${encodeURIComponent(id)}`);
    result.snapshot = await hydrateDraftFiles(result.snapshot, id);
    return result;
  },
  async getParentTemplate(productId: string): Promise<Print3dSetup | undefined> {
    const result = await vpsClient.get<{draftId:string | null; setup:Print3dSetup | null}>(`/admin/product-form-drafts/templates/${encodeURIComponent(productId)}`);
    return result.setup && result.draftId ? hydrateDraftFiles(result.setup, result.draftId) : undefined;
  },
  async save(id: string, revision: number, snapshot: ProductFormSnapshot): Promise<ProductFormDraft> {
    const encoded = await encodeDraftFiles(snapshot, async (fileId, file) => {
      const body = new FormData(); body.append('file', file);
      await vpsClient.upload(`/admin/product-form-drafts/${id}/files/${fileId}`, body);
    }, id);
    return vpsClient.put<ProductFormDraft>(`/admin/product-form-drafts/${id}`, { revision, snapshot: encoded });
  },
  setStatus: (id: string, revision: number, status: 'completed' | 'archived', savedProductId?: string) =>
    vpsClient.patch<ProductFormDraft>(`/admin/product-form-drafts/${id}`, { revision, status, savedProductId }),
};
