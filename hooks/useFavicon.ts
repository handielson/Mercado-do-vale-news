import { useEffect } from 'react';
import { getCompanyData } from '../services/companyService';

/**
 * Hook para aplicar o favicon da empresa dinamicamente
 */
export const useFavicon = () => {
    useEffect(() => {
        const loadAndApplyFavicon = async () => {
            try {
                const companyData = await getCompanyData();

                if (companyData.favicon) {
                    // Atualizar o favicon
                    const faviconLink = document.getElementById('dynamic-favicon') as HTMLLinkElement;
                    if (faviconLink) {
                        faviconLink.href = companyData.favicon;
                    } else {
                        // Criar elemento se não existir
                        const link = document.createElement('link');
                        link.id = 'dynamic-favicon';
                        link.rel = 'icon';
                        link.type = 'image/x-icon';
                        link.href = companyData.favicon;
                        document.head.appendChild(link);
                    }
                }

                // Atualizar o título da página com o nome da empresa
                if (companyData.name) {
                    document.title = `${companyData.name} - Sistema de Gestão`;
                }
            } catch (error) {
                console.error('Erro ao carregar favicon:', error);
                // Manter favicon padrão em caso de erro
            }
        };

        loadAndApplyFavicon();
    }, []);
};
