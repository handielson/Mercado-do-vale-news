import React, { useState, useEffect } from 'react';
import { Plus, AlertCircle } from 'lucide-react';
import { BannerCard } from '@/components/admin/BannerCard';
import { BannerForm } from '@/components/admin/BannerForm';
import { bannerService } from '@/services/bannerService';
import type { CatalogBanner } from '@/types/catalog';

const BannerManagementPage: React.FC = () => {
    const [banners, setBanners] = useState<CatalogBanner[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingBanner, setEditingBanner] = useState<CatalogBanner | undefined>();
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    // Load banners
    useEffect(() => {
        loadBanners();
    }, []);

    const loadBanners = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await bannerService.getAllBanners();
            setBanners(data);
        } catch (err: any) {
            console.error('Erro ao carregar banners:', err);
            setError(err.message || 'Erro ao carregar banners');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingBanner(undefined);
        setShowForm(true);
    };

    const handleEdit = (banner: CatalogBanner) => {
        setEditingBanner(banner);
        setShowForm(true);
    };

    const handleSave = async (data: Partial<CatalogBanner>) => {
        try {
            if (editingBanner) {
                await bannerService.updateBanner(editingBanner.id, data);
            } else {
                await bannerService.createBanner(data);
            }
            await loadBanners();
            setShowForm(false);
        } catch (err: any) {
            console.error('Erro ao salvar banner:', err);
            throw err;
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await bannerService.deleteBanner(id);
            await loadBanners();
        } catch (err: any) {
            console.error('Erro ao deletar banner:', err);
            alert('Erro ao deletar banner');
        }
    };

    const handleToggleActive = async (id: string, isActive: boolean) => {
        try {
            await bannerService.updateBanner(id, { is_active: isActive });
            await loadBanners();
        } catch (err: any) {
            console.error('Erro ao atualizar banner:', err);
            alert('Erro ao atualizar banner');
        }
    };

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const newBanners = [...banners];
        const draggedBanner = newBanners[draggedIndex];
        newBanners.splice(draggedIndex, 1);
        newBanners.splice(index, 0, draggedBanner);

        setBanners(newBanners);
        setDraggedIndex(index);
    };

    const handleDragEnd = async () => {
        if (draggedIndex === null) return;

        try {
            // Update display_order for all banners
            const updates = banners.map((banner, index) => ({
                id: banner.id,
                display_order: index
            }));

            await bannerService.reorderBanners(updates);
            setDraggedIndex(null);
        } catch (err: any) {
            console.error('Erro ao reordenar banners:', err);
            alert('Erro ao reordenar banners');
            await loadBanners(); // Reload to reset order
        }
    };

    const activeBanners = banners.filter(b => b.is_active);
    const inactiveBanners = banners.filter(b => !b.is_active);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Carregando banners...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                        <h1 className="text-3xl font-bold text-gray-900">
                            Gerenciar Banners
                        </h1>
                        <button
                            onClick={handleCreate}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Novo Banner
                        </button>
                    </div>
                    <p className="text-gray-600">
                        Gerencie os banners exibidos no carrossel do catálogo
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-medium text-red-900">Erro ao carregar banners</h3>
                            <p className="text-sm text-red-700 mt-1">{error}</p>
                            <button
                                onClick={loadBanners}
                                className="text-sm text-red-600 hover:text-red-700 underline mt-2"
                            >
                                Tentar novamente
                            </button>
                        </div>
                    </div>
                )}

                {/* Active Banners */}
                {activeBanners.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                            Banners Ativos ({activeBanners.length})
                        </h2>
                        <div className="space-y-3">
                            {activeBanners.map((banner, index) => (
                                <div
                                    key={banner.id}
                                    draggable
                                    onDragStart={() => handleDragStart(banners.indexOf(banner))}
                                    onDragOver={(e) => handleDragOver(e, banners.indexOf(banner))}
                                    onDragEnd={handleDragEnd}
                                >
                                    <BannerCard
                                        banner={banner}
                                        onEdit={handleEdit}
                                        onDelete={handleDelete}
                                        onToggleActive={handleToggleActive}
                                        isDragging={draggedIndex === banners.indexOf(banner)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Inactive Banners */}
                {inactiveBanners.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                            Banners Inativos ({inactiveBanners.length})
                        </h2>
                        <div className="space-y-3">
                            {inactiveBanners.map((banner) => (
                                <BannerCard
                                    key={banner.id}
                                    banner={banner}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                    onToggleActive={handleToggleActive}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {banners.length === 0 && !error && (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Plus className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            Nenhum banner cadastrado
                        </h3>
                        <p className="text-gray-600 mb-6">
                            Comece criando seu primeiro banner para o catálogo
                        </p>
                        <button
                            onClick={handleCreate}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Criar Primeiro Banner
                        </button>
                    </div>
                )}

                {/* Form Modal */}
                {showForm && (
                    <BannerForm
                        banner={editingBanner}
                        onSave={handleSave}
                        onClose={() => setShowForm(false)}
                    />
                )}
            </div>
        </div>
    );
};

export default BannerManagementPage;
