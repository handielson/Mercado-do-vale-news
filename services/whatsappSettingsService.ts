import { vpsClient } from './vpsClient';
import { WhatsAppSettings } from '../types/whatsapp';

interface TableDataResponse {
    rows?: WhatsAppSettings[];
}

const DEFAULT_WHATSAPP_SETTINGS: WhatsAppSettings = {
    id: '',
    api_url: '',
    api_key: '',
    instance_name: '',
    phone_number: '',
    is_active: false
};

export const getWhatsAppSettings = async (): Promise<WhatsAppSettings | null> => {
    try {
        const data = await vpsClient.get<TableDataResponse>('/table-data/whatsapp_settings?limit=1&offset=0');
        return data.rows?.[0] || DEFAULT_WHATSAPP_SETTINGS;
    } catch (error) {
        console.error('Erro ao buscar configuracoes do WhatsApp:', error);
        return null;
    }
};

export const updateWhatsAppSettings = async (settings: Partial<WhatsAppSettings>): Promise<WhatsAppSettings | null> => {
    const { id, created_at, updated_at, ...updateData } = settings;

    try {
        if (id) {
            return await vpsClient.patch<WhatsAppSettings>(
                `/table-data/whatsapp_settings/${encodeURIComponent(id)}?pk=id`,
                updateData
            );
        }

        return await vpsClient.post<WhatsAppSettings>('/table-data/whatsapp_settings', updateData);
    } catch (error) {
        console.error('Erro ao salvar configuracoes do WhatsApp:', error);
        throw error;
    }
};
