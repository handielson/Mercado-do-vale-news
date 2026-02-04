import React from 'react';
import { useTabsContext } from './Tabs';

interface TabProps {
    id: string;
    label: string;
    icon?: React.ReactNode;
    className?: string;
}

/**
 * Header de aba individual (botão)
 * Deve ser usado dentro do TabList
 */
export const Tab: React.FC<TabProps> = ({
    id,
    label,
    icon,
    className = ''
}) => {
    const { activeTab, setActiveTab } = useTabsContext();
    const isActive = activeTab === id;

    return (
        <button
            onClick={() => setActiveTab(id)}
            className={`
                px-6 py-3 font-medium transition-all duration-200
                flex items-center gap-2 relative
                ${isActive
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
                ${className}
            `}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${id}`}
            id={`tab-${id}`}
        >
            {icon && <span className="tab-icon">{icon}</span>}
            <span>{label}</span>
        </button>
    );
};

interface TabPanelProps {
    id: string;
    children: React.ReactNode;
    className?: string;
}

/**
 * Painel de conteúdo da aba
 * Deve ser usado dentro do TabPanels
 */
export const TabPanel: React.FC<TabPanelProps> = ({
    id,
    children,
    className = ''
}) => {
    const { activeTab } = useTabsContext();
    const isActive = activeTab === id;

    if (!isActive) return null;

    return (
        <div
            className={`tab-panel animate-in fade-in duration-300 ${className}`}
            role="tabpanel"
            aria-labelledby={`tab-${id}`}
            id={`tabpanel-${id}`}
        >
            {children}
        </div>
    );
};
