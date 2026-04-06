import { supabase } from './supabase';
import { WhatsAppSettings } from '../types/whatsapp';

export const getWhatsAppSettings = async (): Promise<WhatsAppSettings | null> => {
    const { data, error } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar configurações do WhatsApp:', error);
        return null;
    }

    return data || {
        api_url: '',
        api_key: '',
        instance_name: '',
        phone_number: '',
        is_active: false
    } as WhatsAppSettings;
};

export const updateWhatsAppSettings = async (settings: Partial<WhatsAppSettings>): Promise<WhatsAppSettings | null> => {
    const { id, created_at, updated_at, ...updateData } = settings;

    let query;
    if (id) {
        query = supabase.from('whatsapp_settings').update(updateData).eq('id', id);
    } else {
        query = supabase.from('whatsapp_settings').insert([updateData]);
    }

    const { data, error } = await query.select('*').single();

    if (error) {
        console.error('Erro ao salvar configurações do WhatsApp:', error);
        throw error;
    }

    return data;
};
