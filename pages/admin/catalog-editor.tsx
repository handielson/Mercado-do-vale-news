import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Eye, Trash2, Upload, X } from 'lucide-react';
import { catalogEditorService, type CatalogEditorState } from '@/services/catalogEditorService';
import { BannerCarousel } from '@/components/catalog/BannerCarousel';
import { BannerEditor } from '@/components/admin/BannerEditor';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import type { CatalogBanner } from '@/types/catalog';

/**
 * Editor de Catálogo com Preview em Tempo Real
 * Permite editar banners e configurações com visualização ao vivo
 * ACESSO: Apenas usuários ADMIN
 */
export default function CatalogEditorPage() {
    const navigate = useNavigate();
    const { customer, isLoading: authLoading } = useSupabaseAuth();
    const [editorState, setEditorState] = useState<CatalogEditorState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const hasRedirected = useRef(false);

    // Verificar permissão de ADMIN
    useEffect(() => {
        if (!authLoading && !hasRedirected.current) {
            if (!customer || customer.client_type !== 'ADMIN') {
                hasRedirected.current = true;
                alert('Acesso negado. Apenas administradores podem acessar o editor de catálogo.');
                navigate('/admin');
            }
        }
    }, [customer, authLoading]);

    // Carregar estado inicial
    useEffect(() => {
        if (customer?.client_type === 'ADMIN') {
            loadEditor();
        }
    }, [customer]);

    const loadEditor = async () => {
        try {
            setIsLoading(true);

            // Tentar carregar draft existente
            let state = await catalogEditorService.loadCatalogState('draft');

            // Se não houver draft, copiar da versão publicada
            if (!state.banners || state.banners.length === 0) {
                await catalogEditorService.copyPublishedToDraft();
                state = await catalogEditorService.loadCatalogState('draft');
            }

            setEditorState(state);
        } catch (error) {
            console.error('Erro ao carregar editor:', error);
            alert('Erro ao carregar editor de catálogo');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveDraft = async () => {
        if (!editorState) return;

        try {
            setIsSaving(true);
            await catalogEditorService.saveDraft(editorState);
            setHasUnsavedChanges(false);
            alert('Rascunho salvo com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar rascunho:', error);
            alert('Erro ao salvar rascunho');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!confirm('Publicar mudanças no catálogo? Isso irá substituir a versão atual do site.')) {
            return;
        }

        try {
            setIsPublishing(true);
            await catalogEditorService.publish();
            setHasUnsavedChanges(false);
            alert('Catálogo publicado com sucesso!');
            navigate('/admin');
        } catch (error) {
            console.error('Erro ao publicar catálogo:', error);
            alert('Erro ao publicar catálogo');
        } finally {
            setIsPublishing(false);
        }
    };

    const handleDiscard = async () => {
        if (!confirm('Descartar todas as mudanças não publicadas?')) {
            return;
        }

        try {
            await catalogEditorService.discardDraft();
            setHasUnsavedChanges(false);
            navigate('/admin');
        } catch (error) {
            console.error('Erro ao descartar rascunho:', error);
            alert('Erro ao descartar rascunho');
        }
    };

    const handleBannerChange = (updatedBanners: CatalogBanner[]) => {
        setEditorState(prev => prev ? {
            ...prev,
            banners: updatedBanners
        } : null);
        setHasUnsavedChanges(true);
    };

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">
                        {authLoading ? 'Verificando permissões...' : 'Carregando editor...'}
                    </p>
                </div>
            </div>
        );
    }

    // Se não for ADMIN, não renderizar nada (será redirecionado)
    if (!customer || customer.client_type !== 'ADMIN') {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <h1 className="text-2xl font-bold text-gray-900">
                                Editor de Catálogo
                            </h1>
                            {hasUnsavedChanges && (
                                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full">
                                    Mudanças não salvas
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleSaveDraft}
                                disabled={isSaving || !hasUnsavedChanges}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Save className="w-4 h-4" />
                                {isSaving ? 'Salvando...' : 'Salvar Rascunho'}
                            </button>

                            <button
                                onClick={handlePublish}
                                disabled={isPublishing}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Upload className="w-4 h-4" />
                                {isPublishing ? 'Publicando...' : 'Publicar'}
                            </button>

                            <button
                                onClick={handleDiscard}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Descartar
                            </button>

                            <button
                                onClick={() => navigate('/admin')}
                                className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Split Screen Layout */}
            <div className="flex h-[calc(100vh-73px)]">
                {/* Editor Panel - Left */}
                <div className="w-1/2 border-r border-gray-200 bg-white overflow-y-auto">
                    <div className="p-6">
                        <div className="mb-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <span className="text-2xl">📝</span>
                                Editor
                            </h2>
                            <p className="text-sm text-gray-600">
                                Edite os banners e veja as mudanças em tempo real no preview
                            </p>
                        </div>

                        {/* Banner Editor */}
                        <div className="space-y-4">
                            <h3 className="font-medium text-gray-900">Banners do Catálogo</h3>
                            <BannerEditor
                                banners={editorState?.banners || []}
                                onChange={handleBannerChange}
                            />
                        </div>
                    </div>
                </div>

                {/* Preview Panel - Right */}
                <div className="w-1/2 bg-gray-100 overflow-y-auto">
                    <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Eye className="w-5 h-5" />
                            Preview ao Vivo
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Visualização em tempo real do catálogo
                        </p>
                    </div>

                    <div className="p-6">
                        {/* Preview do Carousel */}
                        {editorState?.banners && editorState.banners.length > 0 ? (
                            <div className="bg-white rounded-lg shadow-sm p-4">
                                <BannerCarousel banners={editorState.banners} />
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                                <p className="text-gray-500">
                                    Nenhum banner para visualizar
                                </p>
                                <p className="text-sm text-gray-400 mt-2">
                                    Adicione banners no editor para ver o preview
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
