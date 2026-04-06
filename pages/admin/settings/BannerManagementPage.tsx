import React, { useState, useEffect, useRef } from 'react';
import { Plus, AlertCircle, BarChart2, MousePointerClick, Eye } from 'lucide-react';
import { BannerCard } from '@/components/admin/BannerCard';
import { BannerForm } from '@/components/admin/BannerForm';
import { bannerService, type BannerStats } from '@/services/bannerService';
import type { CatalogBanner } from '@/types/catalog';

const BannerManagementPage: React.FC = () => {
    const [banners, setBanners] = useState<CatalogBanner[]>([]);
    const [stats, setStats] = useState<BannerStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingBanner, setEditingBanner] = useState<CatalogBanner | undefined>();

    // Bug fix: usar ref para draggedIndex — evita stale closure durante drag rápido
    const draggedIndexRef = useRef<number | null>(null);
    const [draggedId, setDraggedId] = useState<string | null>(null);

    // ── Data loading ────────────────────────────────────────────────────────

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => {
        try {
            setLoading(true);
            setError(null);
            const [data, statsData] = await Promise.all([
                bannerService.getAllBanners(),
                bannerService.getBannerStats(),
            ]);
            setBanners(data);
            setStats(statsData);
        } catch (err: any) {
            console.error('Erro ao carregar banners:', err);
            setError(err.message || 'Erro ao carregar banners');
        } finally {
            setLoading(false);
        }
    };

    // ── CRUD ─────────────────────────────────────────────────────────────────

    const handleCreate = () => { setEditingBanner(undefined); setShowForm(true); };
    const handleEdit = (banner: CatalogBanner) => { setEditingBanner(banner); setShowForm(true); };

    const handleSave = async (data: Partial<CatalogBanner>) => {
        if (editingBanner) {
            await bannerService.updateBanner(editingBanner.id, data);
        } else {
            await bannerService.createBanner(data as any);
        }
        await loadAll();
        setShowForm(false);
    };

    const handleDelete = async (id: string) => {
        try {
            await bannerService.deleteBanner(id);
            await loadAll();
        } catch (err: any) {
            alert('Erro ao deletar banner');
        }
    };

    const handleToggleActive = async (id: string, isActive: boolean) => {
        try {
            await bannerService.updateBanner(id, { is_active: isActive });
            await loadAll();
        } catch (err: any) {
            alert('Erro ao atualizar banner');
        }
    };

    const handleDuplicate = async (id: string) => {
        try {
            await bannerService.duplicateBanner(id);
            await loadAll();
        } catch (err: any) {
            alert('Erro ao duplicar banner');
        }
    };

    // ── Drag & Drop (bug fix: ref para index, evita stale closure) ───────────

    const handleDragStart = (index: number, id: string) => {
        draggedIndexRef.current = index;
        setDraggedId(id);
    };

    const handleDragOver = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        const draggedIndex = draggedIndexRef.current;
        if (draggedIndex === null || draggedIndex === targetIndex) return;

        const newBanners = [...banners];
        const [moved] = newBanners.splice(draggedIndex, 1);
        newBanners.splice(targetIndex, 0, moved);

        draggedIndexRef.current = targetIndex;
        setBanners(newBanners);
    };

    const handleDragEnd = async () => {
        draggedIndexRef.current = null;
        setDraggedId(null);

        try {
            const updates = banners.map((b, i) => ({ id: b.id, display_order: i }));
            await bannerService.reorderBanners(updates);
        } catch (err: any) {
            alert('Erro ao reordenar banners');
            await loadAll(); // reset para evitar estado corrompido
        }
    };

    // ── Derived state ────────────────────────────────────────────────────────

    const activeBanners = banners.filter(b => b.is_active);
    const inactiveBanners = banners.filter(b => !b.is_active);

    // ── Loading ──────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Carregando banners...</p>
                </div>
            </div>
        );
    }

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-6xl mx-auto">

                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                        <h1 className="text-3xl font-bold text-gray-900">Gerenciar Banners</h1>
                        <button
                            onClick={handleCreate}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Novo Banner
                        </button>
                    </div>
                    <p className="text-gray-600">
                        Gerencie os banners exibidos no carrossel do catálogo. Arraste para reordenar.
                    </p>
                </div>

                {/* Stats */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                            <p className="text-xs text-gray-500 mb-1">Total</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                            <p className="text-xs text-gray-500">{stats.active} ativos · {stats.inactive} inativos</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                <MousePointerClick className="w-3 h-3" /> Total de cliques
                            </p>
                            <p className="text-2xl font-bold text-blue-600">{stats.totalClicks.toLocaleString('pt-BR')}</p>
                            {stats.topByClicks && (
                                <p className="text-xs text-gray-500 truncate">Top: {stats.topByClicks.title}</p>
                            )}
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                <Eye className="w-3 h-3" /> Total de views
                            </p>
                            <p className="text-2xl font-bold text-green-600">{stats.totalViews.toLocaleString('pt-BR')}</p>
                            {stats.topByViews && (
                                <p className="text-xs text-gray-500 truncate">Top: {stats.topByViews.title}</p>
                            )}
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                <BarChart2 className="w-3 h-3" /> Expirados
                            </p>
                            <p className={`text-2xl font-bold ${stats.expired > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                {stats.expired}
                            </p>
                            <p className="text-xs text-gray-500">banners com data encerrada</p>
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-medium text-red-900">Erro ao carregar banners</h3>
                            <p className="text-sm text-red-700 mt-1">{error}</p>
                            <button onClick={loadAll} className="text-sm text-red-600 hover:text-red-700 underline mt-2">
                                Tentar novamente
                            </button>
                        </div>
                    </div>
                )}

                {/* Active banners (draggable) */}
                {activeBanners.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-base font-semibold text-gray-700 mb-3">
                            Banners Ativos ({activeBanners.length})
                        </h2>
                        <div className="space-y-3">
                            {activeBanners.map((banner) => {
                                const globalIndex = banners.indexOf(banner);
                                return (
                                    <div
                                        key={banner.id}
                                        draggable
                                        onDragStart={() => handleDragStart(globalIndex, banner.id)}
                                        onDragOver={(e) => handleDragOver(e, globalIndex)}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <BannerCard
                                            banner={banner}
                                            onEdit={handleEdit}
                                            onDelete={handleDelete}
                                            onToggleActive={handleToggleActive}
                                            onDuplicate={handleDuplicate}
                                            isDragging={draggedId === banner.id}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Inactive banners */}
                {inactiveBanners.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-base font-semibold text-gray-700 mb-3">
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
                                    onDuplicate={handleDuplicate}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {banners.length === 0 && !error && (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Plus className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum banner cadastrado</h3>
                        <p className="text-gray-600 mb-6">Comece criando seu primeiro banner para o catálogo</p>
                        <button
                            onClick={handleCreate}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Criar Primeiro Banner
                        </button>
                    </div>
                )}

                {/* Form modal */}
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
