import React from 'react';
import { Link } from 'react-router-dom';
import { Truck, Package, ShoppingCart, ShoppingBag, Users, Calculator } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const shortcuts = [
    { to: '/admin/settings/shipping?tab=calcular', icon: Calculator, label: 'Calcular Frete', desc: 'Cotação avulsa com produtos', color: 'from-blue-500 to-blue-700', bg: 'bg-blue-50', text: 'text-blue-700' },
    { to: '/admin/pdv', icon: ShoppingCart, label: 'PDV', desc: 'Ponto de venda', color: 'from-emerald-500 to-emerald-700', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    { to: '/admin/products', icon: Package, label: 'Produtos', desc: 'Gestão de produtos', color: 'from-violet-500 to-violet-700', bg: 'bg-violet-50', text: 'text-violet-700' },
    { to: '/admin/sales', icon: ShoppingBag, label: 'Vendas', desc: 'Histórico de vendas', color: 'from-orange-500 to-orange-700', bg: 'bg-orange-50', text: 'text-orange-700' },
    { to: '/admin/customers', icon: Users, label: 'Clientes', desc: 'Base de clientes', color: 'from-pink-500 to-pink-700', bg: 'bg-pink-50', text: 'text-pink-700' },
    { to: '/admin/settings/shipping', icon: Truck, label: 'Configurar Frete', desc: 'Zonas, transportadoras', color: 'from-slate-500 to-slate-700', bg: 'bg-slate-50', text: 'text-slate-700' },
];

export const AdminDashboardPage: React.FC = () => {
    const { settings } = useTheme();

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">
                    Olá, bem-vindo ao painel! 👋
                </h1>
                <p className="text-sm text-slate-500 mt-1">{settings.company_name}</p>
            </div>

            <div>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Acesso Rápido</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    {shortcuts.map(s => (
                        <Link
                            key={s.to}
                            to={s.to}
                            className={`${s.bg} rounded-2xl p-4 flex flex-col gap-3 hover:shadow-md transition-all hover:-translate-y-0.5 border border-white`}
                        >
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-sm`}>
                                <s.icon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className={`text-sm font-bold ${s.text}`}>{s.label}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
};
