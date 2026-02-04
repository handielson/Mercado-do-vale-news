import { useSearchParams } from 'react-router-dom';

/**
 * Hook para gerenciar URLs de abas
 * 
 * @param paramName - Nome do parâmetro na URL (padrão: 'tab')
 * @returns Objeto com aba ativa e função para alterar
 * 
 * @example
 * const { activeTab, setActiveTab } = useTabUrl('categoria');
 * // URL: /produtos?categoria=celulares
 */
export const useTabUrl = (paramName: string = 'tab') => {
    const [searchParams, setSearchParams] = useSearchParams();

    const activeTab = searchParams.get(paramName);

    const setActiveTab = (tabId: string) => {
        const newParams = new URLSearchParams(searchParams);
        newParams.set(paramName, tabId);
        setSearchParams(newParams, { replace: false });
    };

    const removeTabParam = () => {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete(paramName);
        setSearchParams(newParams, { replace: false });
    };

    return {
        activeTab,
        setActiveTab,
        removeTabParam
    };
};
