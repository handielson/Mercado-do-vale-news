import { vpsClient } from './vpsClient';

export interface BatteryHealth {
    id: string;
    value: number;
    label: string;
    created_at?: string;
}

export interface BatteryHealthInput {
    value: number;
    label: string;
}

export const batteryHealthService = {
    async list(): Promise<BatteryHealth[]> {
        return vpsClient.get<BatteryHealth[]>('/battery-healths');
    },

    async create(input: BatteryHealthInput): Promise<BatteryHealth> {
        const { id } = await vpsClient.post<{ ok: boolean; id: string }>('/battery-healths', input);
        return { ...input, id };
    },

    async delete(id: string): Promise<void> {
        await vpsClient.delete(`/battery-healths/${id}`);
    },
};
