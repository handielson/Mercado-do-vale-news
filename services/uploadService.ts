import { vpsClient } from './vpsClient';

/**
 * Serviço para gerenciar uploads de arquivos via VPS/Synology.
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

type SynologyUploadResponse = {
    ok?: boolean;
    url: string;
    name?: string;
    filename?: string;
    storage?: 'synology' | 'local';
};

export const uploadService = {
    /**
     * Faz upload de uma imagem de banner para a VPS.
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

        const formData = new FormData();
        formData.append('file', file);
        const { url } = await vpsClient.upload<{ url: string }>('/banners/upload', formData);
        return url;
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
     * Faz upload da imagem de perfil (avatar) para o Synology via VPS.
     */
    uploadAvatar: async (file: File, customerId: string): Promise<string> => {
        if (!ALLOWED_TYPES.includes(file.type)) {
            throw new Error('Tipo de arquivo não permitido. Use PNG, JPG ou WEBP.');
        }

        try {
            // Comprime antes do upload (para o avatar ficar leve)
            const fileName = `${customerId}_avatar.jpg`;
            const compressedBlob = await uploadService.compressAvatarClientSide(file);
            const compressedFile = new File([compressedBlob], fileName, { type: 'image/jpeg' });
            const formData = new FormData();
            formData.append('file', compressedFile);

            const upload = await vpsClient.upload<SynologyUploadResponse>('/synology/upload?folder=imagens', formData);
            if (!upload.url) throw new Error('Erro ao obter URL pública da imagem');
            return `${upload.url}?t=${Date.now()}`;
        } catch (error: any) {
            console.error('Erro geral no uploadAvatar:', error);
            throw new Error(error.message || 'Erro ao processar e enviar foto.');
        }
    },

    /**
     * Remove uma imagem de banner da VPS.
     * @param imageUrl - URL da imagem a ser removida
     */
    deleteBannerImage: async (imageUrl: string): Promise<void> => {
        try {
            const fileName = imageUrl.split('/').pop();
            if (!fileName) throw new Error('URL de imagem inválida');

            await vpsClient.delete(`/banners/upload/${fileName}`);
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
     * Obtém a URL pública de um arquivo já publicado pela VPS.
     * @param fileName - Nome do arquivo
     * @returns URL pública
     */
    getPublicUrl: (fileName: string): string => {
        if (/^https?:\/\//i.test(fileName)) return fileName;
        return `/images/banners/${fileName.replace(/^\/+/, '')}`;
    }
};
