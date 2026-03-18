import { vpsClient } from './vpsClient';

export interface Ram {
    id: string;
    value: number;
    label: string;
    active: boolean;
    created_at?: string;
}

export interface RamInput {
    value: number;
    label: string;
    active: boolean;
}

export const ramService = {
    async list(): Promise<Ram[]> {
        return vpsClient.get<Ram[]>('/rams/all');
    },

    async listActive(): Promise<Ram[]> {
        return vpsClient.get<Ram[]>('/rams');
    },

    async create(input: RamInput): Promise<Ram> {
        const { id } = await vpsClient.post<{ ok: boolean; id: string }>('/rams', input);
        return { ...input, id };
    },

    async update(id: string, input: RamInput): Promise<Ram> {
        await vpsClient.patch<{ ok: boolean }>(`/rams/${id}`, input);
        return { ...input, id };
    },

    async delete(id: string): Promise<void> {
        await vpsClient.delete(`/rams/${id}`);
    },
};
