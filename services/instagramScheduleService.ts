import { supabase } from './supabase';

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

export const instagramScheduleService = {
    async list(): Promise<InstagramSlot[]> {
        const { data, error } = await supabase
            .from('instagram_schedule')
            .select('*')
            .order('day_of_week')
            .order('scheduled_time');
        if (error) throw error;
        return data || [];
    },

    async listByDay(dayOfWeek: number): Promise<InstagramSlot[]> {
        const { data, error } = await supabase
            .from('instagram_schedule')
            .select('*')
            .eq('day_of_week', dayOfWeek)
            .order('scheduled_time');
        if (error) throw error;
        return data || [];
    },

    async listActiveByDay(dayOfWeek: number): Promise<InstagramSlot[]> {
        const { data, error } = await supabase
            .from('instagram_schedule')
            .select('*')
            .eq('day_of_week', dayOfWeek)
            .eq('active', true)
            .order('scheduled_time');
        if (error) throw error;
        return data || [];
    },

    async create(input: InstagramSlotInput): Promise<InstagramSlot> {
        const { data, error } = await supabase
            .from('instagram_schedule')
            .insert(input)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async update(id: string, input: Partial<InstagramSlotInput>): Promise<InstagramSlot> {
        const { data, error } = await supabase
            .from('instagram_schedule')
            .update(input)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase.from('instagram_schedule').delete().eq('id', id);
        if (error) throw error;
    },

    async toggleActive(id: string, active: boolean): Promise<void> {
        const { error } = await supabase
            .from('instagram_schedule')
            .update({ active })
            .eq('id', id);
        if (error) throw error;
    },
};
