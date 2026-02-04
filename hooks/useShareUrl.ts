import {
    getWhatsAppShareUrl,
    getFacebookShareUrl,
    getTwitterShareUrl,
    getEmailShareUrl,
    getFullUrl
} from '../utils/urlHelpers';

type SharePlatform = 'whatsapp' | 'facebook' | 'twitter' | 'email' | 'copy';

interface ShareOptions {
    url?: string;
    text?: string;
    subject?: string;
    body?: string;
}

/**
 * Hook para gerenciar compartilhamento de URLs
 * 
 * @example
 * const { shareUrl, copyToClipboard } = useShareUrl();
 * shareUrl('whatsapp', { text: 'Confira!' });
 */
export const useShareUrl = () => {
    /**
     * Gera URL de compartilhamento para plataforma específica
     */
    const generateShareUrl = (
        platform: SharePlatform,
        options: ShareOptions = {}
    ): string => {
        const url = options.url || getFullUrl(window.location.pathname + window.location.search);

        switch (platform) {
            case 'whatsapp':
                return getWhatsAppShareUrl(url, options.text);

            case 'facebook':
                return getFacebookShareUrl(url);

            case 'twitter':
                return getTwitterShareUrl(url, options.text);

            case 'email':
                return getEmailShareUrl(url, options.subject, options.body);

            case 'copy':
                return url;

            default:
                return url;
        }
    };

    /**
     * Compartilha URL abrindo janela/app da plataforma
     */
    const shareUrl = (
        platform: SharePlatform,
        options: ShareOptions = {}
    ): void => {
        const shareLink = generateShareUrl(platform, options);

        if (platform === 'copy') {
            copyToClipboard(shareLink);
        } else {
            window.open(shareLink, '_blank', 'noopener,noreferrer');
        }
    };

    /**
     * Copia texto para área de transferência
     */
    const copyToClipboard = async (text: string): Promise<boolean> => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.error('Erro ao copiar para área de transferência:', error);
            return false;
        }
    };

    /**
     * Verifica se Web Share API está disponível
     */
    const canUseNativeShare = (): boolean => {
        return typeof navigator !== 'undefined' && 'share' in navigator;
    };

    /**
     * Usa Web Share API nativa (mobile)
     */
    const nativeShare = async (options: ShareOptions = {}): Promise<boolean> => {
        if (!canUseNativeShare()) {
            return false;
        }

        try {
            const url = options.url || getFullUrl(window.location.pathname + window.location.search);

            await navigator.share({
                title: options.subject || document.title,
                text: options.text,
                url: url
            });

            return true;
        } catch (error) {
            console.error('Erro ao compartilhar:', error);
            return false;
        }
    };

    return {
        generateShareUrl,
        shareUrl,
        copyToClipboard,
        canUseNativeShare,
        nativeShare
    };
};
