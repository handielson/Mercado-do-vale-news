import { vpsClient } from './vpsClient';

export interface Storage {
    id: string;
    value: number;
    label: string;
    active: boolean;
    created_at?: string;
}

export interface StorageInput {
    value: number;
    label: string;
    active: boolean;
}

export const storageService = {
    async list(): Promise<Storage[]> {
        return vpsClient.get<Storage[]>('/storages/all');
    },

    async listActive(): Promise<Storage[]> {
        return vpsClient.get<Storage[]>('/storages');
    },

    async create(input: StorageInput): Promise<Storage> {
        const { id } = await vpsClient.post<{ ok: boolean; id: string }>('/storages', input);
        return { ...input, id };
    },

    async update(id: string, input: StorageInput): Promise<Storage> {
        await vpsClient.patch<{ ok: boolean }>(`/storages/${id}`, input);
        return { ...input, id };
    },

    async delete(id: string): Promise<void> {
        await vpsClient.delete(`/storages/${id}`);
    },
};
