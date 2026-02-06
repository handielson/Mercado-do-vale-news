import { supabase } from './supabase';

/**
 * Serviço para gerenciar uploads de arquivos para Supabase Storage
 */

const BANNER_BUCKET = 'catalog-banners';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

export const uploadService = {
    /**
     * Faz upload de uma imagem de banner para o Supabase Storage
     * @param file - Arquivo de imagem a ser enviado
     * @returns URL pública da imagem
     */
    uploadBannerImage: async (file: File): Promise<string> => {
        // Validar tipo de arquivo
        if (!ALLOWED_TYPES.includes(file.type)) {
            throw new Error(
                'Tipo de arquivo não permitido. Use PNG, JPG ou WEBP.'
            );
        }

        // Validar tamanho do arquivo
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(
                `Arquivo muito grande. Tamanho máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`
            );
        }

        // Gerar nome único para o arquivo
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 10);
        const extension = file.name.split('.').pop() || 'png';
        const fileName = `${timestamp}_${randomString}.${extension}`;

        try {
            // Fazer upload para o Supabase Storage
            const { data, error } = await supabase.storage
                .from(BANNER_BUCKET)
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                console.error('Erro ao fazer upload:', error);
                throw new Error(`Erro ao fazer upload: ${error.message}`);
            }

            // Obter URL pública da imagem
            const { data: publicUrlData } = supabase.storage
                .from(BANNER_BUCKET)
                .getPublicUrl(fileName);

            if (!publicUrlData?.publicUrl) {
                throw new Error('Erro ao obter URL pública da imagem');
            }

            return publicUrlData.publicUrl;
        } catch (error: any) {
            console.error('Erro no upload:', error);
            throw new Error(error.message || 'Erro ao fazer upload da imagem');
        }
    },

    /**
     * Remove uma imagem de banner do Supabase Storage
     * @param imageUrl - URL da imagem a ser removida
     */
    deleteBannerImage: async (imageUrl: string): Promise<void> => {
        try {
            // Extrair o nome do arquivo da URL
            const fileName = imageUrl.split('/').pop();
            if (!fileName) {
                throw new Error('URL de imagem inválida');
            }

            // Deletar do Supabase Storage
            const { error } = await supabase.storage
                .from(BANNER_BUCKET)
                .remove([fileName]);

            if (error) {
                console.error('Erro ao deletar imagem:', error);
                throw new Error(`Erro ao deletar imagem: ${error.message}`);
            }
        } catch (error: any) {
            console.error('Erro ao deletar:', error);
            // Não lançar erro aqui para não bloquear a exclusão do banner
            // A imagem órfã será removida manualmente se necessário
        }
    },

    /**
     * Valida se um arquivo é uma imagem válida
     * @param file - Arquivo a ser validado
     * @returns true se válido, false caso contrário
     */
    validateImageFile: (file: File): { valid: boolean; error?: string } => {
        if (!ALLOWED_TYPES.includes(file.type)) {
            return {
                valid: false,
                error: 'Tipo de arquivo não permitido. Use PNG, JPG ou WEBP.'
            };
        }

        if (file.size > MAX_FILE_SIZE) {
            return {
                valid: false,
                error: `Arquivo muito grande. Tamanho máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`
            };
        }

        return { valid: true };
    },

    /**
     * Obtém a URL pública de um arquivo no bucket
     * @param fileName - Nome do arquivo
     * @returns URL pública
     */
    getPublicUrl: (fileName: string): string => {
        const { data } = supabase.storage
            .from(BANNER_BUCKET)
            .getPublicUrl(fileName);

        return data.publicUrl;
    }
};
