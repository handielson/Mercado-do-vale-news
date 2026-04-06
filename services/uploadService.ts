import { supabase } from './supabase';
import { vpsClient } from './vpsClient';
import { USE_VPS } from '@/config/migration';

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
        if (!ALLOWED_TYPES.includes(file.type)) {
            throw new Error('Tipo de arquivo não permitido. Use PNG, JPG ou WEBP.');
        }
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`Arquivo muito grande. Tamanho máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
        }

        // Upload para VPS
        if (USE_VPS.banners) {
            const formData = new FormData();
            formData.append('file', file);
            const { url } = await vpsClient.upload<{ url: string }>('/banners/upload', formData);
            return url;
        }

        // Upload para Supabase Storage (fallback)
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 10);
        const extension = file.name.split('.').pop() || 'png';
        const fileName = `${timestamp}_${randomString}.${extension}`;

        try {
            const { error } = await supabase.storage
                .from(BANNER_BUCKET)
                .upload(fileName, file, { cacheControl: '3600', upsert: false });

            if (error) throw new Error(`Erro ao fazer upload: ${error.message}`);

            const { data: publicUrlData } = supabase.storage
                .from(BANNER_BUCKET)
                .getPublicUrl(fileName);

            if (!publicUrlData?.publicUrl) throw new Error('Erro ao obter URL pública da imagem');
            return publicUrlData.publicUrl;
        } catch (error: any) {
            throw new Error(error.message || 'Erro ao fazer upload da imagem');
        }
    },

    /**
     * Comprime uma imagem no client-side usando Canvas
     * Redimensiona mantendo a proporção para caber em maxWidth/maxHeight
     * @returns Um Blob Otimizado (JPEG)
     */
    compressAvatarClientSide: async (file: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;
                    const MAX_SIZE = 500;

                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return reject(new Error('Canvas não suportado.'));

                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob(
                        (blob) => {
                            if (blob) resolve(blob);
                            else reject(new Error('Falha na compressão da imagem.'));
                        },
                        'image/jpeg',
                        0.8 // 80% qualidade
                    );
                };
                img.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
                if (e.target?.result) {
                    img.src = e.target.result as string;
                }
            };
            reader.readAsDataURL(file);
        });
    },

    /**
     * Faz upload da imagem de perfil (avatar) para o Storage (já comprimida via client-side)
     */
    uploadAvatar: async (file: File, customerId: string): Promise<string> => {
        if (!ALLOWED_TYPES.includes(file.type)) {
            throw new Error('Tipo de arquivo não permitido. Use PNG, JPG ou WEBP.');
        }

        try {
            // Comprime antes do upload (para o avatar ficar leve)
            const compressedBlob = await uploadService.compressAvatarClientSide(file);
            const compressedFile = new File([compressedBlob], `avatar_${customerId}.jpg`, { type: 'image/jpeg' });
            
            // O nome do arquivo será atrelado ao usuário.
            // Sobrescreve a imagem anterior, usando upsert: true
            const fileName = `${customerId}_avatar.jpg`;

            const { error, data } = await supabase.storage
                .from('customer-avatars')
                .upload(fileName, compressedFile, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) {
                console.error('Erro no upload de avatar:', error);
                throw new Error(`Erro ao fazer upload: ${error.message}`);
            }

            const { data: publicUrlData } = supabase.storage
                .from('customer-avatars')
                .getPublicUrl(fileName);

            // Append query param to bypass cache if image changes
            return `${publicUrlData.publicUrl}?t=${Date.now()}`;
        } catch (error: any) {
            console.error('Erro geral no uploadAvatar:', error);
            throw new Error(error.message || 'Erro ao processar e enviar foto.');
        }
    },

    /**
     * Remove uma imagem de banner do Supabase Storage
     * @param imageUrl - URL da imagem a ser removida
     */
    deleteBannerImage: async (imageUrl: string): Promise<void> => {
        try {
            const fileName = imageUrl.split('/').pop();
            if (!fileName) throw new Error('URL de imagem inválida');

            // Deletar da VPS
            if (USE_VPS.banners) {
                await vpsClient.delete(`/banners/upload/${fileName}`);
                return;
            }

            // Deletar do Supabase Storage (fallback)
            const { error } = await supabase.storage
                .from(BANNER_BUCKET)
                .remove([fileName]);

            if (error) throw new Error(`Erro ao deletar imagem: ${error.message}`);
        } catch (error: any) {
            console.error('Erro ao deletar:', error);
            // Não lançar erro para não bloquear a exclusão do banner
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
