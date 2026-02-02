import React, { useState, useEffect } from 'react';
import { Package } from 'lucide-react';
import { InventoryFilters as FiltersType, InventoryStats as StatsType, InventoryGroup } from '../../../types/inventory';
import { inventoryService } from '../../../services/inventory';
import { categoryService } from '../../../services/categories';
import { InventoryStats } from '../../../components/inventory/InventoryStats';
import { InventoryFilters } from '../../../components/inventory/InventoryFilters';
import { InventoryTable } from '../../../components/inventory/InventoryTable';
import { StockAdjustmentModal } from '../../../components/inventory/StockAdjustmentModal';
import { SerializedUnitsModal } from '../../../components/inventory/SerializedUnitsModal';

/**
 * InventoryPage
 * Main inventory management page with serialized product support
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Page < 300 lines
 * - Modular components
 * - Real-time updates
 * - Grouped serialized products
 */
export function InventoryPage() {
    const [groups, setGroups] = useState<InventoryGroup[]>([]);
    const [stats, setStats] = useState<StatsType>({
        total_products: 0,
        total_units: 0,
        serialized_groups: 0,
        non_serialized_groups: 0,
        available: 0,
        reserved: 0,
        sold: 0,
        in_maintenance: 0,
        defective: 0,
        in_stock: 0,
        low_stock: 0,
        out_of_stock: 0,
        not_tracked: 0,
        total_value: 0
    });
    const [filters, setFilters] = useState<FiltersType>({});
    const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
    const [brands, setBrands] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedGroup, setSelectedGroup] = useState<InventoryGroup | null>(null);
    const [showUnitsModal, setShowUnitsModal] = useState(false);
    const [showAdjustModal, setShowAdjustModal] = useState(false);

    // Load initial data
    useEffect(() => {
        loadData();
        loadCategories();
        loadBrands();
    }, []);

    // Reload products when filters change
    useEffect(() => {
        loadProducts();
    }, [filters]);

    const loadData = async () => {
        await Promise.all([
            loadProducts(),
            loadStats()
        ]);
    };

    const loadProducts = async () => {
        try {
            setLoading(true);
            const data = await inventoryService.getInventoryGrouped(filters);
            setGroups(data);
        } catch (error) {
            console.error('Error loading inventory groups:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const data = await inventoryService.getStats();
            setStats(data);
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    const loadCategories = async () => {
        try {
            const data = await categoryService.list();
            setCategories(data.map(cat => ({ id: cat.id, name: cat.name })));
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    const loadBrands = async () => {
        try {
            const data = await inventoryService.getBrands();
            setBrands(data);
        } catch (error) {
            console.error('Error loading brands:', error);
        }
    };

    const handleViewUnits = (group: InventoryGroup) => {
        setSelectedGroup(group);
        setShowUnitsModal(true);
    };

    const handleAdjustStock = (group: InventoryGroup) => {
        setSelectedGroup(group);
        setShowAdjustModal(true);
    };

    const handleConfirmAdjustment = async (adjustment: any) => {
        if (!selectedGroup) return;

        try {
            // For serialized products, we can't adjust stock directly
            // This would need to change unit status instead
            if (selectedGroup.is_serialized) {
                alert('⚠️ Para produtos serializados, use o modal de unidades para alterar status.');
                return;
            }

            // For non-serialized, adjust the single product
            // Note: This assumes non-serialized groups have only one product
            // In a real implementation, you'd need to track the product ID
            alert('⚠️ Ajuste de estoque para produtos não serializados em desenvolvimento.');

            // Reload data
            await loadData();
        } catch (error) {
            console.error('Error adjusting stock:', error);
            alert('❌ Erro ao ajustar estoque. Tente novamente.');
        }
    };

    const handleViewHistory = (group: InventoryGroup) => {
        // TODO: Implement history modal
        console.log('View history for:', group.name);
        alert('Histórico em desenvolvimento');
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                        <Package size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Gestão de Estoque</h1>
                        <p className="text-slate-500">Controle completo do inventário de produtos</p>
                    </div>
                </div>
            </div>

            {/* Info Alert */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <Package className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                        <h3 className="text-sm font-semibold text-blue-900">Sistema Dinâmico</h3>
                        <p className="text-sm text-blue-700 mt-1">
                            A tabela exibe automaticamente as colunas baseadas nos campos do produto (IMEI1, IMEI2, Cor, etc.).
                            <strong className="ml-1">Todos os dados são preservados sem exceção.</strong>
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <InventoryStats stats={stats} loading={loading} />

            {/* Filters */}
            <InventoryFilters
                filters={filters}
                onFiltersChange={setFilters}
                categories={categories}
                brands={brands}
            />

            {/* Table */}
            <InventoryTable
                groups={groups}
                onViewUnits={handleViewUnits}
                onAdjustStock={handleAdjustStock}
                onViewHistory={handleViewHistory}
                loading={loading}
            />

            {/* Serialized Units Modal */}
            <SerializedUnitsModal
                group={selectedGroup}
                isOpen={showUnitsModal}
                onClose={() => setShowUnitsModal(false)}
                onReload={loadData}
            />

            {/* Adjustment Modal */}
            <StockAdjustmentModal
                product={selectedGroup as any}
                isOpen={showAdjustModal}
                onClose={() => setShowAdjustModal(false)}
                onConfirm={handleConfirmAdjustment}
            />
        </div>
    );
}
