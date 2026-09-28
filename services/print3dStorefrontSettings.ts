import { vpsClient } from './vpsClient';

export type Print3dStorefrontSettings = {
  storefront: 'loja_3d';
  maintenance_mode: boolean;
  maintenance_message: string;
  updated_at: string | null;
};

export const print3dStorefrontSettingsService = {
  public: () => vpsClient.get<Print3dStorefrontSettings>('/storefronts/loja_3d/settings'),
  admin: () => vpsClient.get<Print3dStorefrontSettings>('/admin/print3d/settings'),
  save: (input: Pick<Print3dStorefrontSettings, 'maintenance_mode' | 'maintenance_message'>) =>
    vpsClient.put<Print3dStorefrontSettings & { ok: boolean }>('/admin/print3d/settings', input),
};
