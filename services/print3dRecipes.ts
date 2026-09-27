import { vpsClient } from './vpsClient';
import { buildPrint3dRecipeDraft } from '../utils/print3dRecipeDraft.mjs';

export type Print3dRecipeDraft = ReturnType<typeof buildPrint3dRecipeDraft>;
export type Print3dRecipeSaveResult = { id: string; revision: string; saved: boolean; sha256: string };
export type Print3dRecipeSummary = { id: string; revision: string; sku_snapshot: string; draft_sha256: string; created_at: string };
export type Print3dActiveRecipe = {
  product_id: string;
  recipe_id: string;
  primary_file_id: string;
  revision: string;
  sku_snapshot: string;
  primary_file_kind: string;
  primary_file_name: string;
  printer_profile: string | null;
  selected_by?: string;
  selected_at?: string;
};

export const print3dRecipesService = {
  status: () => vpsClient.get<{ enabled: boolean }>('/admin/print3d/status'),
  save: (draft: Print3dRecipeDraft) => vpsClient.post<Print3dRecipeSaveResult>(
    `/admin/print3d/products/${encodeURIComponent(draft.productId)}/recipes`, draft
  ),
  list: (productId: string) => vpsClient.get<{ recipes: Print3dRecipeSummary[] }>(
    `/admin/print3d/products/${encodeURIComponent(productId)}/recipes`
  ),
  get: (productId: string, revision: string) => vpsClient.get<{ id: string; draft: Print3dRecipeDraft }>(
    `/admin/print3d/products/${encodeURIComponent(productId)}/recipes/${encodeURIComponent(revision)}`
  ),
  active: (productId: string) => vpsClient.get<{ activeRecipe: Print3dActiveRecipe | null }>(
    `/admin/print3d/products/${encodeURIComponent(productId)}/active-recipe`
  ),
  selectActive: (productId: string, recipeId: string, primaryFileId: string) => vpsClient.post<{
    changed: boolean; activeRecipe: Print3dActiveRecipe;
  }>(`/admin/print3d/products/${encodeURIComponent(productId)}/active-recipe`, { recipeId, primaryFileId }),
};
