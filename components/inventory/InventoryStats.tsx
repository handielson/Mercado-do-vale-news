import React from 'react';
import { Package, TrendingUp, AlertTriangle, XCircle, Smartphone, Box } from 'lucide-react';
import { InventoryStats as StatsType } from '../../types/inventory';

interface InventoryStatsProps {
    stats: StatsType;
    loading?: boolean;
}

/**
 * InventoryStats Component
 * Displays inventory statistics with serialized product support
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Component < 500 lines
 * - Clear visual hierarchy
 * - Responsive design
 * - Serialized vs Non-serialized metrics
 */
export function InventoryStats({ stats, loading }: InventoryStatsProps) {
    const formatCurrency = (cents: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(cents / 100);
    };

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 h-32" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Top Row - Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Products */}
                <StatCard
                    icon={<Package className="w-6 h-6" />}
                    label="Total de Produtos"
                    value={stats.total_products}
                    subtitle={`${stats.total_units} unidades`}
                    color="bg-blue-50 text-blue-600"
                    borderColor="border-blue-200"
                />

                {/* Serialized */}
                <StatCard
                    icon={<Smartphone className="w-6 h-6" />}
                    label="Serializados"
                    value={stats.serialized_groups}
                    subtitle="Com IMEI/Serial"
                    color="bg-purple-50 text-purple-600"
                    borderColor="border-purple-200"
                />

                {/* Non-Serialized */}
                <StatCard
                    icon={<Box className="w-6 h-6" />}
                    label="Não Serializados"
                    value={stats.non_serialized_groups}
                    subtitle="Estoque normal"
                    color="bg-indigo-50 text-indigo-600"
                    borderColor="border-indigo-200"
                />

                {/* Total Value */}
                <StatCard
                    icon={<TrendingUp className="w-6 h-6" />}
                    label="Valor Total"
                    value={formatCurrency(stats.total_value)}
                    subtitle="Preço de custo"
                    color="bg-emerald-50 text-emerald-600"
                    borderColor="border-emerald-200"
                    isValueString
                />
            </div>

            {/* Second Row - Status Details */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Available (Serialized) */}
                <StatCard
                    icon={<span className="text-2xl">🟢</span>}
                    label="Disponíveis"
                    value={stats.available}
                    subtitle="Serializados"
                    color="bg-green-50 text-green-600"
                    borderColor="border-green-200"
                />

                {/* Reserved */}
                <StatCard
                    icon={<span className="text-2xl">🟡</span>}
                    label="Reservados"
                    value={stats.reserved}
                    subtitle="Aguardando"
                    color="bg-yellow-50 text-yellow-600"
                    borderColor="border-yellow-200"
                />

                {/* Sold */}
                <StatCard
                    icon={<span className="text-2xl">🔴</span>}
                    label="Vendidos"
                    value={stats.sold}
                    subtitle="Histórico"
                    color="bg-red-50 text-red-600"
                    borderColor="border-red-200"
                />

                {/* In Maintenance */}
                <StatCard
                    icon={<span className="text-2xl">🔵</span>}
                    label="Manutenção"
                    value={stats.in_maintenance}
                    subtitle="Em reparo"
                    color="bg-blue-50 text-blue-600"
                    borderColor="border-blue-200"
                />

                {/* Defective */}
                <StatCard
                    icon={<span className="text-2xl">⚫</span>}
                    label="Defeituosos"
                    value={stats.defective}
                    subtitle="Com problema"
                    color="bg-gray-50 text-gray-600"
                    borderColor="border-gray-200"
                />
            </div>

            {/* Third Row - Non-Serialized Stock (if any) */}
            {stats.non_serialized_groups > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard
                        icon={<TrendingUp className="w-6 h-6" />}
                        label="Em Estoque"
                        value={stats.in_stock}
                        subtitle="Qtd > 10"
                        color="bg-green-50 text-green-600"
                        borderColor="border-green-200"
                    />

                    <StatCard
                        icon={<AlertTriangle className="w-6 h-6" />}
                        label="Estoque Baixo"
                        value={stats.low_stock}
                        subtitle="1-10 unidades"
                        color="bg-yellow-50 text-yellow-600"
                        borderColor="border-yellow-200"
                    />

                    <StatCard
                        icon={<XCircle className="w-6 h-6" />}
                        label="Sem Estoque"
                        value={stats.out_of_stock}
                        subtitle="Qtd = 0"
                        color="bg-red-50 text-red-600"
                        borderColor="border-red-200"
                    />
                </div>
            )}
        </div>
    );
}

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: number | string;
    subtitle?: string;
    color: string;
    borderColor: string;
    isValueString?: boolean;
}

function StatCard({ icon, label, value, subtitle, color, borderColor, isValueString }: StatCardProps) {
    return (
        <div className={`bg-white border ${borderColor} rounded-xl p-6 transition-all hover:shadow-md`}>
            <div className="flex items-center justify-between mb-3">
                <div className={`p-3 rounded-lg ${color}`}>
                    {icon}
                </div>
            </div>
            <p className="text-sm font-medium text-slate-600">{label}</p>
            <p className={`${isValueString ? 'text-2xl' : 'text-3xl'} font-bold text-slate-900 mt-1`}>
                {value}
            </p>
            {subtitle && (
                <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
            )}
        </div>
    );
}
