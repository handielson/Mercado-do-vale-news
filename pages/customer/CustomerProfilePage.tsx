import React, { useState } from 'react';
import { User, MapPin, Lock, ShoppingBag, TrendingUp } from 'lucide-react';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';

// Tab components (to be created separately)
import { PersonalInfoTab } from '../../components/customer/profile/PersonalInfoTab';
import { AddressTab } from '../../components/customer/profile/AddressTab';
import { PasswordChangeTab } from '../../components/customer/profile/PasswordChangeTab';
import { PurchaseHistoryTab } from '../../components/customer/profile/PurchaseHistoryTab';
import { TypeUpgradeTab } from '../../components/customer/profile/TypeUpgradeTab';

type TabType = 'personal' | 'address' | 'password' | 'history' | 'upgrade';

/**
 * Customer Profile Page
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Modular design with separate tab components
 * - Each tab component < 300 lines
 * - Main page < 200 lines
 */
export const CustomerProfilePage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('personal');
    const { customer, isLoading } = useSupabaseAuth();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-slate-600">Carregando...</p>
                </div>
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <p className="text-slate-600">Você precisa estar logado para acessar esta página.</p>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'personal' as TabType, label: 'Dados Pessoais', icon: User },
        { id: 'address' as TabType, label: 'Endereço', icon: MapPin },
        { id: 'password' as TabType, label: 'Alterar Senha', icon: Lock },
        { id: 'history' as TabType, label: 'Histórico de Compras', icon: ShoppingBag },
        { id: 'upgrade' as TabType, label: 'Tipo de Conta', icon: TrendingUp }
    ];

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-slate-900">Meu Perfil</h1>
                    <p className="text-slate-600 mt-1">Gerencie suas informações pessoais e preferências</p>
                </div>

                {/* Tab Navigation */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-6">
                    <div className="flex overflow-x-auto">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-6 py-4 font-medium whitespace-nowrap transition-colors border-b-2 ${activeTab === tab.id
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent text-slate-600 hover:text-slate-900'
                                        }`}
                                >
                                    <Icon size={18} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                    {activeTab === 'personal' && <PersonalInfoTab />}
                    {activeTab === 'address' && <AddressTab />}
                    {activeTab === 'password' && <PasswordChangeTab />}
                    {activeTab === 'history' && <PurchaseHistoryTab />}
                    {activeTab === 'upgrade' && <TypeUpgradeTab />}
                </div>
            </div>
        </div>
    );
};
