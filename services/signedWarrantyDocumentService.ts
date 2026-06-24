import { getAuthSessionToken } from './authSession';
import { buildVpsUrl } from './vpsProxyBase';
import { vpsClient } from './vpsClient';
import type { SignedWarrantySnapshot } from '../types/signedWarrantyDocument';

export interface SignedWarrantySyncResult {
  started: boolean;
  in_progress?: boolean;
  scanned?: number;
  ignored?: number;
  processed?: number;
  deleted?: number;
  failed?: number;
  duration_ms?: number;
  truncated?: boolean;
  items?: Array<{
    file_name: string;
    status: 'processed' | 'error';
    document_id?: string;
    error_code?: string;
  }>;
}

export async function getSignedWarrantySnapshot(saleId: string): Promise<SignedWarrantySnapshot> {
  return vpsClient.get<SignedWarrantySnapshot>(`/sales/${encodeURIComponent(saleId)}/signed-warranty`);
}

export async function uploadSignedWarranty(saleId: string, file: File): Promise<SignedWarrantySnapshot> {
  const form = new FormData();
  form.append('file', file);
  await vpsClient.upload(`/admin/sales/${encodeURIComponent(saleId)}/signed-warranty`, form);
  return getSignedWarrantySnapshot(saleId);
}

export async function syncSignedWarrantyFolder(): Promise<SignedWarrantySyncResult> {
  return vpsClient.post<SignedWarrantySyncResult>('/admin/signed-warranty/sync', {});
}

async function authenticatedBlob(path: string): Promise<Blob> {
  const token = await getAuthSessionToken();
  if (!token) throw new Error('Sessão expirada');

  const response = await fetch(buildVpsUrl(path, { method: 'GET' }), {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Documento indisponível (${response.status})`);
  }
  return response.blob();
}

export function downloadSignedWarrantyPdf(id: string): Promise<Blob> {
  return authenticatedBlob(`/signed-warranty/${encodeURIComponent(id)}/pdf`);
}

export function downloadSignedWarrantyOriginal(id: string): Promise<Blob> {
  return authenticatedBlob(`/admin/signed-warranty/${encodeURIComponent(id)}/original`);
}
