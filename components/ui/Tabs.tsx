import React, { createContext, useContext, useState, useEffect, ReactElement } from 'react';
import { useSearchParams } from 'react-router-dom';

interface TabsContextType {
    activeTab: string;
    setActiveTab: (tabId: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

export const useTabsContext = () => {
    const context = useContext(TabsContext);
    if (!context) {
        throw new Error('useTabsContext must be used within a Tabs component');
    }
    return context;
};

interface TabsProps {
    defaultTab?: string;
    urlParam?: string;
    onChange?: (tabId: string) => void;
    children: React.ReactNode;
    className?: string;
}

/**
 * Componente de Abas Dinâmicas com suporte a URLs compartilháveis
 * 
 * @example
 * <Tabs urlParam="categoria" defaultTab="todos">
 *   <TabList>
 *     <Tab id="todos" label="Todos" />
 *     <Tab id="celulares" label="Celulares" />
 *   </TabList>
 *   <TabPanels>
 *     <TabPanel id="todos">Conteúdo todos</TabPanel>
 *     <TabPanel id="celulares">Conteúdo celulares</TabPanel>
 *   </TabPanels>
 * </Tabs>
 */
export const Tabs: React.FC<TabsProps> = ({
    defaultTab,
    urlParam = 'tab',
    onChange,
    children,
    className = ''
}) => {
    const [searchParams, setSearchParams] = useSearchParams();

    // Ler aba ativa da URL ou usar padrão
    const urlTab = searchParams.get(urlParam);
    const [activeTab, setActiveTabState] = useState<string>(
        urlTab || defaultTab || ''
    );

    // Atualizar aba ativa quando URL mudar (navegação com botões voltar/avançar)
    useEffect(() => {
        const newUrlTab = searchParams.get(urlParam);
        if (newUrlTab && newUrlTab !== activeTab) {
            setActiveTabState(newUrlTab);
            onChange?.(newUrlTab);
        }
    }, [searchParams, urlParam]);

    const setActiveTab = (tabId: string) => {
        setActiveTabState(tabId);

        // Atualizar URL sem recarregar a página
        const newParams = new URLSearchParams(searchParams);
        newParams.set(urlParam, tabId);
        setSearchParams(newParams, { replace: false });

        onChange?.(tabId);
    };

    return (
        <TabsContext.Provider value={{ activeTab, setActiveTab }}>
            <div className={`tabs-container ${className}`}>
                {children}
            </div>
        </TabsContext.Provider>
    );
};

/**
 * Container para os headers das abas
 */
export const TabList: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = ''
}) => {
    return (
        <div className={`flex border-b border-gray-200 ${className}`} role="tablist">
            {children}
        </div>
    );
};

/**
 * Container para os painéis de conteúdo das abas
 */
export const TabPanels: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = ''
}) => {
    return (
        <div className={`tab-panels ${className}`}>
            {children}
        </div>
    );
};
