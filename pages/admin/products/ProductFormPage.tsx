
import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, ExternalLink } from 'lucide-react';
import { ProductForm } from '../../../components/products/ProductForm';
import { ProductWorkspaceNav } from '../../../components/products/ProductWorkspaceNav';
import { Product, ProductInput } from '../../../types/product';
import { productService } from '../../../services/products';
import { buildProductClonePrefill } from '../../../services/productClonePrefill.js';
import { isLocalCatalogPreviewRuntime, localCatalogPreviewService, type LocalCatalogDraft } from '../../../services/localCatalogPreview';
import { productFormDraftsService, type ProductFormDraft, type ProductFormSnapshot } from '../../../services/productFormDrafts';

function LocalPreviewApproval({ productId, revision, onApproved }: { productId: string; revision: number; onApproved: () => void }) {
    const [draft, setDraft] = useState<LocalCatalogDraft | null>(null);
    const [loading, setLoading] = useState(true);
    const [approving, setApproving] = useState(false);

    useEffect(() => {
        let active = true;
        setLoading(true);
        localCatalogPreviewService.list(productId)
            .then((response) => { if (active) setDraft(response.drafts[0] || null); })
            .catch(() => { if (active) setDraft(null); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [productId, revision]);

    if (loading || !draft) return null;

    const approve = async () => {
        if (!window.confirm('Publicar este rascunho na API central? Esta ação atualiza a produção.')) return;
        try {
            setApproving(true);
            const result = await localCatalogPreviewService.approve(productId);
            toast.success(`${result.approved} alteração(ões) aprovada(s) e enviada(s) à produção.`);
            onApproved();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Não foi possível aprovar o rascunho.');
        } finally {
            setApproving(false);
        }
    };

    return (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="flex items-center gap-2 font-bold"><CheckCircle2 size={18} /> Rascunho local pendente</p>
                    <p className="mt-1 text-sm">A prévia 3DMV usa estas alterações somente no localhost. Produção permanece intacta até a aprovação.</p>
                    <p className="mt-2 text-xs">Campos alterados: {draft.fields.join(', ') || 'oferta da vitrine'}.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <a href="/loja-3d" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm font-semibold hover:bg-amber-100"><ExternalLink size={15} /> Ver prévia</a>
                    <button type="button" onClick={() => void approve()} disabled={approving} className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-60">{approving ? 'Aprovando...' : 'Aprovar para produção'}</button>
                </div>
            </div>
        </div>
    );
}

/**
 * ProductFormPage
 * Page for creating new products or editing existing ones
 */
export const ProductFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [product, setProduct] = useState<Product | undefined>();
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [draftRevision, setDraftRevision] = useState(0);
    const [savedDraft, setSavedDraft] = useState<ProductFormDraft | null>(null);
    const [loadedDraft, setLoadedDraft] = useState<ProductFormDraft | null>(null);
    const [draftError, setDraftError] = useState('');
    const draftMeta = useRef<{ id: string; revision: number } | null>(null);
    const resumeDraftId = new URLSearchParams(location.search).get('draft');

    const editingProductId = (id && id !== 'new' ? id : undefined) || loadedDraft?.snapshot.data.id;
    const isEditMode = Boolean(editingProductId);
    const print3dEntry = new URLSearchParams(location.search).get('print3d') === '1';

    // Get EAN from navigation state if provided
    const eanFromState = (location.state as any)?.ean;
    const cloneProductFromState = (location.state as any)?.cloneProduct;

    // Fetch product data if editing
    useEffect(() => {
        setLoadedDraft(null); setSavedDraft(null); draftMeta.current = null;
        if (resumeDraftId) {
            let active = true;
            setIsFetching(true); setDraftError(''); setLoadedDraft(null);
            productFormDraftsService.get(resumeDraftId).then(draft => {
                if (!active) return;
                if (draft.status !== 'pending') throw new Error('Este rascunho já foi concluído ou arquivado.');
                draftMeta.current = { id: draft.id, revision: draft.revision };
                setLoadedDraft(draft); setSavedDraft(draft); setProduct(draft.snapshot.data as Product);
            }).catch(error => { if (active) setDraftError(error instanceof Error ? error.message : 'Não foi possível abrir o rascunho.'); })
                .finally(() => { if (active) setIsFetching(false); });
            return () => { active = false; };
        } else if (id && id !== 'new') {
            fetchProduct();
        } else if (cloneProductFromState) {
            const prefill = buildProductClonePrefill(cloneProductFromState);
            setProduct({ ...prefill, ...(print3dEntry ? { is_print3d: true } : {}) } as unknown as Product);
        } else if (eanFromState) {
            // Pre-fill EAN for new product
            setProduct({ ean: eanFromState, ...(print3dEntry ? { is_print3d: true } : {}) } as unknown as Product);
        } else {
            setProduct(undefined);
        }
    }, [id, eanFromState, cloneProductFromState, print3dEntry, resumeDraftId]);

    // Update document title
    useEffect(() => {
        if (product?.name) {
            document.title = `${product.name} | Editar Produto`;
        } else if (isEditMode) {
            document.title = 'Editar Produto | Mercado do Vale';
        } else {
            document.title = print3dEntry ? 'Novo Produto 3D | Mercado do Vale' : 'Novo Produto | Mercado do Vale';
        }

        return () => {
            document.title = 'Mercado do Vale - Produtos';
        };
    }, [product?.name, isEditMode, print3dEntry]);

    const fetchProduct = async () => {
        if (!id) return;

        try {
            setIsFetching(true);
            const data = await productService.getById(id);
            setProduct(print3dEntry ? { ...data, is_print3d: true } : data);
        } catch (error) {
            console.error('Error fetching product:', error);
            toast.error('Erro ao carregar produto');
            navigate('/admin/products');
        } finally {
            setIsFetching(false);
        }
    };

    const handleSubmit = async (data: ProductInput): Promise<Product | void> => {
        try {
            setIsLoading(true);

            if (isEditMode && editingProductId) {
                // Update existing product
                const savedProduct = await productService.update(editingProductId, data);
                if (isLocalCatalogPreviewRuntime()) {
                    setProduct(savedProduct as Product);
                    setDraftRevision((current) => current + 1);
                    toast.success('Rascunho salvo na prévia local. Aprove-o quando estiver conferido.');
                    return savedProduct;
                }
                toast.success('Produto atualizado com sucesso!');
                return savedProduct;
            } else {
                // Create new product (pode ser chamado várias vezes no batch)
                // Navegação controlada pelo ProductForm via onBatchComplete
                return await productService.create(data);
            }
        } catch (error) {
            console.error('Error saving product:', error);
            // O formulário mantém os dados e apresenta a falha, sem anunciar sucesso.
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveDraft = async (snapshot: ProductFormSnapshot) => {
        draftMeta.current ||= { id: crypto.randomUUID(), revision: 0 };
        const draft = await productFormDraftsService.save(draftMeta.current.id, draftMeta.current.revision, snapshot);
        draftMeta.current = { id: draft.id, revision: draft.revision }; setSavedDraft(draft);
    };

    const handleBatchComplete = async (savedProduct?: Product, snapshot?: ProductFormSnapshot) => {
        // The parent's private template stays available for future variations,
        // using the same authenticated draft/file storage, outside the catalog.
        if (!draftMeta.current && savedProduct?.is_parent && savedProduct.is_print3d && snapshot) await handleSaveDraft(snapshot);
        if (draftMeta.current) {
            // Persist confirmed IDs before closing the draft, so an interrupted
            // final step can be retried without recreating confirmed products.
            if (snapshot) await handleSaveDraft(snapshot);
            await productFormDraftsService.setStatus(draftMeta.current.id, draftMeta.current.revision, 'completed', savedProduct?.id);
            draftMeta.current = null;
        }
        if (isLocalCatalogPreviewRuntime()) {
            setDraftRevision(current => current + 1);
            if (savedProduct?.id && !isEditMode) navigate(`/admin/products/${savedProduct.id}`);
            return;
        }
        if (savedProduct?.is_parent && savedProduct.id) {
            navigate(`/admin/products/${savedProduct.id}`);
            return;
        }
        if (savedProduct?.is_print3d && savedProduct.id) {
            navigate(`/admin/loja-3d/calculadora?product_id=${encodeURIComponent(savedProduct.id)}#ficha-producao-3d`);
            return;
        }
        navigate('/admin/products');
    };

    const handleCancel = () => {
        navigate('/admin/products');
    };

    // Loading state while fetching
    if (isFetching) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Carregando produto...</p>
                </div>
            </div>
        );
    }
    if (resumeDraftId && (!loadedDraft || draftError)) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6"><p>{draftError || 'Carregando rascunho...'}</p><Link className="mt-3 inline-block text-blue-700 underline" to="/admin/products/drafts">Voltar aos rascunhos</Link></div>;
    if (loadedDraft?.snapshot.completion) return <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-6"><h1 className="text-xl font-bold">Cadastro já concluído</h1><p>Os produtos deste rascunho já foram salvos. Falta apenas retirar o rascunho da lista de pendentes.</p><button disabled={isLoading} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50" onClick={async () => { setIsLoading(true); try { await productFormDraftsService.setStatus(loadedDraft.id, loadedDraft.revision, 'completed', loadedDraft.snapshot.completion?.savedProductId); navigate('/admin/products/drafts'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível finalizar o rascunho.'); } finally { setIsLoading(false); } }}>Finalizar rascunho</button><Link className="ml-3 text-blue-700 underline" to="/admin/products/drafts">Voltar à lista</Link></div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={handleCancel}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">
                        {print3dEntry ? (isEditMode ? 'Incluir produto na 3DMV' : 'Novo Produto 3D') : (isEditMode ? 'Editar Produto' : 'Novo Produto')}
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {isEditMode
                            ? 'Atualize as informações do produto abaixo'
                            : 'Preencha os dados para cadastrar um novo produto'}
                    </p>
                </div>
            </div>

            {print3dEntry && <p className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">A opção de impressão 3D já está marcada. Confira o cadastro e salve para continuar. Produtos vendáveis seguem para a ficha e os arquivos; produtos pai organizam as variações.</p>}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p>{savedDraft ? `Rascunho salvo em ${new Date(savedDraft.updated_at).toLocaleString('pt-BR')}. Salve novamente para guardar as próximas alterações.` : 'Cadastro incompleto? Salve como rascunho para continuar depois, sem disponibilizar o anúncio para venda.'}</p><Link to="/admin/products/drafts" className="font-semibold text-blue-700 underline">Rascunhos de anúncios</Link></div>

            {isEditMode && product?.id && product.sku && (
                <ProductWorkspaceNav productId={product.id} sku={product.sku} active="product" />
            )}

            {/* Form */}
            {isEditMode && id && isLocalCatalogPreviewRuntime() && (
                <LocalPreviewApproval productId={id} revision={draftRevision} onApproved={() => {
                    setDraftRevision((current) => current + 1);
                    void fetchProduct();
                }} />
            )}
            <ProductForm
                key={`${id || 'new'}-${print3dEntry}-${resumeDraftId || ''}`}
                initialData={product}
                initialDraft={loadedDraft?.snapshot}
                onSaveDraft={handleSaveDraft}
                defaultIsPrint3d={print3dEntry}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                onBatchComplete={handleBatchComplete}
                isLoading={isLoading}
            />
        </div>
    );
};
