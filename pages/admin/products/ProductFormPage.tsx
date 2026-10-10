
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, ExternalLink } from 'lucide-react';
import { ProductForm } from '../../../components/products/ProductForm';
import { ProductWorkspaceNav } from '../../../components/products/ProductWorkspaceNav';
import { Product, ProductInput } from '../../../types/product';
import { productService } from '../../../services/products';
import { buildProductClonePrefill } from '../../../services/productClonePrefill.js';
import { isLocalCatalogPreviewRuntime, localCatalogPreviewService, type LocalCatalogDraft } from '../../../services/localCatalogPreview';

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

    const isEditMode = id && id !== 'new';
    const print3dEntry = new URLSearchParams(location.search).get('print3d') === '1';

    // Get EAN from navigation state if provided
    const eanFromState = (location.state as any)?.ean;
    const cloneProductFromState = (location.state as any)?.cloneProduct;

    // Fetch product data if editing
    useEffect(() => {
        if (isEditMode) {
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
    }, [id, eanFromState, cloneProductFromState, print3dEntry]);

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

            if (isEditMode && id) {
                // Update existing product
                const savedProduct = await productService.update(id, data);
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
            const errorMessage = error instanceof Error ? error.message : 'Erro ao salvar produto';
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBatchComplete = (savedProduct?: Product) => {
        if (isLocalCatalogPreviewRuntime()) {
            if (savedProduct?.id && !isEditMode) navigate(`/admin/products/${savedProduct.id}`);
            return;
        }
        if (savedProduct?.is_print3d && savedProduct.id) {
            if (savedProduct.is_parent) {
                navigate(`/admin/products/${savedProduct.id}`);
                return;
            }
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
                key={`${id || 'new'}-${print3dEntry}`}
                initialData={product}
                defaultIsPrint3d={print3dEntry}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                onBatchComplete={handleBatchComplete}
                isLoading={isLoading}
            />
        </div>
    );
};
