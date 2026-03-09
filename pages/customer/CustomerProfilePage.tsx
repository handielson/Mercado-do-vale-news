import React, { useState } from 'react';
import { User, MapPin, Lock, ShoppingBag, TrendingUp, ArrowLeft, Coins } from 'lucide-react';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { useNavigate, useLocation } from 'react-router-dom';

// Tab components (to be created separately)
import { PersonalInfoTab } from '../../components/customer/profile/PersonalInfoTab';
import { PurchaseHistoryTab } from '../../components/customer/profile/PurchaseHistoryTab';
import { TypeUpgradeTab } from '../../components/customer/profile/TypeUpgradeTab';
import { BenefitsTab } from '../../components/customer/profile/BenefitsTab';
import { CoinsTab } from '../../components/customer/profile/CoinsTab';
import { ShieldCheck } from 'lucide-react';

type TabType = 'personal' | 'history' | 'upgrade' | 'coins' | 'benefits';

/**
 * Customer Profile Page
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Modular design with separate tab components
 * - Each tab component < 300 lines
 * - Main page < 200 lines
 */
export const CustomerProfilePage: React.FC = () => {
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<TabType>(
        (location.state as any)?.tab || 'personal'
    );
    const { customer, isLoading } = useSupabaseAuth();
    const navigate = useNavigate();

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
        { id: 'personal' as TabType, label: 'Meus Dados', icon: User },
        { id: 'history' as TabType, label: 'Histórico de Compras', icon: ShoppingBag },
        { id: 'benefits' as TabType, label: 'Meus Benefícios', icon: ShieldCheck },
        { id: 'upgrade' as TabType, label: 'Tipo de Conta', icon: TrendingUp },
        { id: 'coins' as TabType, label: 'Moedas do Vale', icon: Coins },
    ];

    return (
        <div className="min-h-screen bg-slate-50/50 py-8 lg:py-12">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8 lg:mb-12">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 mb-6 transition-colors bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm w-fit inline-flex"
                    >
                        <ArrowLeft size={16} />
                        Voltar à loja
                    </button>
                    <div>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">Meu Perfil</h1>
                        <p className="text-slate-500 mt-2 text-base md:text-lg">Gerencie suas informações pessoais, pedidos e preferências.</p>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-8 items-start">
                    {/* Sidebar Navigation */}
                    <aside className="w-full lg:w-72 shrink-0">
                        <nav className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] -mx-4 px-4 lg:mx-0 lg:px-0">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all whitespace-nowrap lg:whitespace-normal shrink-0 group ${isActive
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-semibold'
                                            : 'bg-transparent text-slate-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 font-medium'
                                            }`}
                                    >
                                        <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                                            <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                                        </div>
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </nav>
                    </aside>

                    {/* Main Content Area */}
                    <main className="flex-1 w-full relative">
                        {/* Decorative background blur */}
                        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl pointer-events-none"></div>

                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-5 sm:p-8 relative z-10 transition-all">
                            {activeTab === 'personal' && <PersonalInfoTab />}
                            {activeTab === 'history' && <PurchaseHistoryTab />}
                            {activeTab === 'benefits' && <BenefitsTab />}
                            {activeTab === 'upgrade' && <TypeUpgradeTab />}
                            {activeTab === 'coins' && <CoinsTab />}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
};
