import { getAuthSessionToken } from './authSession';
import { buildVpsUrl } from './vpsProxyBase';
import { vpsClient } from './vpsClient';

export type Print3dFileKind = 'model' | 'project' | 'gcode' | 'print-json' | 'preview' | 'instructions';
export type Print3dRecipeFile = {
  id: string;
  asset_id: string;
  recipe_id: string;
  kind: Print3dFileKind;
  printer_profile?: string | null;
  original_name: string;
  byte_size: number;
  sha256: string;
  created_at: string;
  shared: boolean;
};

export const print3dRecipeFilesService = {
  status: () => vpsClient.get<{ enabled: boolean; maxBytes: number }>('/admin/print3d/files/status'),
  list: (recipeId: string) => vpsClient.get<{ files: Print3dRecipeFile[] }>(
    `/admin/print3d/recipes/${encodeURIComponent(recipeId)}/files`
  ),
  verifyIntegrity: (recipeId: string) => vpsClient.get<{
    recipe_id: string;
    verified: boolean;
    files: Array<Pick<Print3dRecipeFile, 'id' | 'kind' | 'original_name' | 'byte_size' | 'sha256'> & { valid: boolean }>;
  }>(`/admin/print3d/recipes/${encodeURIComponent(recipeId)}/files/integrity`),
  upload: (recipeId: string, kind: Print3dFileKind, file: File, printerProfile = '') => {
    const form = new FormData();
    form.append('file', file);
    return vpsClient.upload<{ file: Print3dRecipeFile; saved: boolean }>(
      `/admin/print3d/recipes/${encodeURIComponent(recipeId)}/files?kind=${encodeURIComponent(kind)}${kind === 'gcode' ? `&printerProfile=${encodeURIComponent(printerProfile)}` : ''}`, form
    );
  },
  async download(fileId: string): Promise<Blob> {
    const token = await getAuthSessionToken();
    if (!token) throw new Error('Sessão expirada.');
    const response = await fetch(buildVpsUrl(`/admin/print3d/files/${encodeURIComponent(fileId)}/download`, { method: 'GET' }), {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Arquivo indisponível (${response.status}).`);
    return response.blob();
  },
};
