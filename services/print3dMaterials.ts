import { vpsClient } from './vpsClient';

export const print3dMaterialsService = {
    async list(): Promise<string[]> {
        const response = await vpsClient.get<{ materials: string[] }>('/admin/print3d/material-types');
        return response.materials;
    },
    async create(name: string): Promise<{ name: string; created: boolean; materials: string[] }> {
        return vpsClient.post('/admin/print3d/material-types', { name });
    },
};
