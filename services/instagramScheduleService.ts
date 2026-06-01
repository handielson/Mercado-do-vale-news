import { vpsClient } from './vpsClient';

export type ContentType = 'story' | 'reels' | 'carrossel' | 'post';

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
    story: '📸 Story',
    reels: '🎬 Reels',
    carrossel: '🎴 Carrossel',
    post: '📷 Post Feed',
};

export const DAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export interface InstagramSlot {
    id: string;
    day_of_week: number;          // 0=Dom … 6=Sáb
    scheduled_time: string;       // "HH:MM:SS"
    content_type: ContentType;
    hook: string | null;
    caption: string | null;
    cta: string | null;
    hashtags: string | null;
    visual_notes: string | null;
    send_telegram_reminder: boolean;
    active: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export type InstagramSlotInput = Omit<InstagramSlot, 'id' | 'created_at' | 'updated_at'>;

interface TableDataResponse {
    rows?: InstagramSlot[];
}

function sortSlots(slots: InstagramSlot[]): InstagramSlot[] {
    return [...slots].sort((a, b) => (
        a.day_of_week - b.day_of_week ||
        String(a.scheduled_time ?? '').localeCompare(String(b.scheduled_time ?? ''))
    ));
}

async function loadSlots(): Promise<InstagramSlot[]> {
    const allRows: InstagramSlot[] = [];
    const pageSize = 200;

    for (let offset = 0; ; offset += pageSize) {
        const data = await vpsClient.get<TableDataResponse>(
            `/table-data/instagram_schedule?limit=${pageSize}&offset=${offset}`
        );
        const rows = Array.isArray(data.rows) ? data.rows : [];
        allRows.push(...rows);
        if (rows.length < pageSize) break;
    }

    return sortSlots(allRows);
}

export const instagramScheduleService = {
    async list(): Promise<InstagramSlot[]> {
        return loadSlots();
    },

    async listByDay(dayOfWeek: number): Promise<InstagramSlot[]> {
        const slots = await loadSlots();
        return slots.filter((slot) => slot.day_of_week === dayOfWeek);
    },

    async listActiveByDay(dayOfWeek: number): Promise<InstagramSlot[]> {
        const slots = await loadSlots();
        return slots.filter((slot) => slot.day_of_week === dayOfWeek && slot.active);
    },

    async create(input: InstagramSlotInput): Promise<InstagramSlot> {
        return vpsClient.post<InstagramSlot>('/table-data/instagram_schedule', input);
    },

    async update(id: string, input: Partial<InstagramSlotInput>): Promise<InstagramSlot> {
        return vpsClient.patch<InstagramSlot>(
            `/table-data/instagram_schedule/${encodeURIComponent(id)}?pk=id`,
            input
        );
    },

    async delete(id: string): Promise<void> {
        await vpsClient.delete(`/table-data/instagram_schedule/${encodeURIComponent(id)}?pk=id`);
    },

    async toggleActive(id: string, active: boolean): Promise<void> {
        await vpsClient.patch(`/table-data/instagram_schedule/${encodeURIComponent(id)}?pk=id`, { active });
    },
};
