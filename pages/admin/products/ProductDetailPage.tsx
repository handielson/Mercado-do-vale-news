
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, MapPin, Package, Plus, ShieldCheck, Tags } from 'lucide-react';
import { Product, ProductInput } from '../../../types/product';
import { Unit, UnitInput } from '../../../types/unit';
import { productService } from '../../../services/products';
import { unitService } from '../../../services/units';
import { autoResponderService } from '../../../services/autoResponderService';
import { stockLocationService } from '../../../services/stockLocationService';
import type { AutoResponderTag } from '../../../types/autoResponder';
import type { ProductStockLocation } from '../../../types/stock-location';
import { ProductForm } from '../../../components/products/ProductForm';
import { UnitList } from '../../../components/units/UnitList';
import { UnitForm } from '../../../components/units/UnitForm';
import { NcmSearchWidget } from '../../../components/admin/NcmSearchWidget';
import { InmetroWidget } from '../../../components/admin/InmetroWidget';

type TabType = 'product' | 'inventory';

function parseProductTagIds(value: Product['tag_ids']): number[] {
    if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
    if (!value) return [];
    try {
        const parsed = JSON.parse(String(value));
        return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
    } catch {
        return [];
    }
}

function tagScopesIncludes(tag: AutoResponderTag, scope: string): boolean {
    if (Array.isArray(tag.scopes)) return tag.scopes.includes(scope);
    return String(tag.scopes || '').split(',').map((item) => item.trim()).includes(scope);
}

interface ProductTagPickerProps {
    tags: AutoResponderTag[];
    selectedTagIds: number[];
    isLoading: boolean;
    isSaving: boolean;
    onToggle: (tagId: number) => void;
    onSave: () => void;
}

const ProductTagPicker: React.FC<ProductTagPickerProps> = ({
    tags,
    selectedTagIds,
    isLoading,
    isSaving,
    onToggle,
    onSave,
}) => (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Tags size={18} className="text-blue-600" />
                Tags do AutoResponder
            </h3>
            <button
                type="button"
                onClick={onSave}
                disabled={isSaving || isLoading}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {isSaving ? 'Salvando...' : 'Salvar tags'}
            </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => {
                const selected = selectedTagIds.includes(Number(tag.id));
                return (
                    <button
                        key={tag.id}
                        type="button"
                        onClick={() => onToggle(Number(tag.id))}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                            selected
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
                        }`}
                    >
                        <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: tag.color || '#2563eb' }}
                        />
                        {tag.name}
                    </button>
                );
            })}
            {!isLoading && tags.length === 0 && (
                <span className="text-sm text-slate-500">Nenhuma tag de produto cadastrada.</span>
            )}
            {isLoading && <span className="text-sm text-slate-500">Carregando tags...</span>}
        </div>
    </div>
);

/**
 * ProductDetailPage
 * Unified page for product editing and inventory management
 */
export const ProductDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<TabType>('product');
    const [product, setProduct] = useState<Product | undefined>();
    const [units, setUnits] = useState<Unit[]>([]);
    const [stats, setStats] = useState({ total: 0, available: 0, reserved: 0, sold: 0, rma: 0 });
    const [productStockDistribution, setProductStockDistribution] = useState<ProductStockLocation[]>([]);
    const [isLoadingStockDistribution, setIsLoadingStockDistribution] = useState(false);
    const [stockDistributionError, setStockDistributionError] = useState<string | null>(null);

    const [isLoadingProduct, setIsLoadingProduct] = useState(false);
    const [isLoadingUnits, setIsLoadingUnits] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showUnitForm, setShowUnitForm] = useState(false);
    const [autoResponderTags, setAutoResponderTags] = useState<AutoResponderTag[]>([]);
    const [productTagIds, setProductTagIds] = useState<number[]>([]);
    const [isLoadingTags, setIsLoadingTags] = useState(false);
    const [isSavingTags, setIsSavingTags] = useState(false);

    // Fetch product data
    useEffect(() => {
        if (id) {
            fetchProduct();
            fetchUnits();
            loadProductTags();
        }
    }, [id]);

    useEffect(() => {
        setProductTagIds(parseProductTagIds(product?.tag_ids));
    }, [product?.id, product?.tag_ids]);

    const loadProductTags = async () => {
        try {
            setIsLoadingTags(true);
            const tags = await autoResponderService.listTags({ scope: 'product' });
            setAutoResponderTags(tags.filter((tag) => tagScopesIncludes(tag, 'product')));
        } catch (error) {
            console.error('Error loading product tags:', error);
            toast.error('Erro ao carregar tags de produto');
        } finally {
            setIsLoadingTags(false);
        }
    };

    const fetchProduct = async () => {
        if (!id) return;

        try {
            setIsLoadingProduct(true);
            const data = await productService.getById(id);
            setProduct(data);
            await fetchProductStockDistribution(data);
        } catch (error) {
            console.error('Error fetching product:', error);
            toast.error('Erro ao carregar produto');
            navigate('/admin/products');
        } finally {
            setIsLoadingProduct(false);
        }
    };

    const fetchUnits = async () => {
        if (!id) return;

        try {
            setIsLoadingUnits(true);
            const [unitsData, statsData] = await Promise.all([
                unitService.listByProduct(id),
                unitService.getStatsByProduct(id)
            ]);
            setUnits(unitsData);
            setStats(statsData);
        } catch (error) {
            console.error('Error fetching units:', error);
            toast.error('Erro ao carregar unidades');
        } finally {
            setIsLoadingUnits(false);
        }
    };

    const handleProductSubmit = async (data: ProductInput) => {
        if (!id) return;

        try {
            setIsSaving(true);
            await productService.update(id, data);
            toast.success('Produto atualizado com sucesso!');
            navigate('/admin/products');
        } catch (error) {
            console.error('Error updating product:', error);
            toast.error('Erro ao atualizar produto');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleProductTag = (tagId: number) => {
        setProductTagIds((current) =>
            current.includes(tagId)
                ? current.filter((id) => id !== tagId)
                : [...current, tagId]
        );
    };

    const saveProductTags = async () => {
        if (!product) return;
        try {
            setIsSavingTags(true);
            const result = await autoResponderService.updateProductTags(product.id, productTagIds);
            setProduct((current) => current ? { ...current, tag_ids: result.tag_ids } : current);
            toast.success('Tags do produto salvas');
        } catch (error) {
            console.error('Error saving product tags:', error);
            toast.error('Erro ao salvar tags do produto');
        } finally {
            setIsSavingTags(false);
        }
    };

    const fetchProductStockDistribution = async (product: Product) => {
        try {
            setIsLoadingStockDistribution(true);
            setStockDistributionError(null);
            const distribution = await stockLocationService.getProductStockDistribution(product.id);
            setProductStockDistribution(distribution);
        } catch (error) {
            console.error('Error fetching product stock distribution:', error);
            setProductStockDistribution([]);
            setStockDistributionError('Nao foi possivel carregar a distribuicao por local.');
        } finally {
            setIsLoadingStockDistribution(false);
        }
    };

    const handleUnitSubmit = async (data: UnitInput) => {
        try {
            setIsSaving(true);
            await unitService.create(data);
            toast.success('Unidade adicionada ao estoque!');
            setShowUnitForm(false);
            await fetchUnits();
        } catch (error) {
            console.error('Error creating unit:', error);
            toast.error('Erro ao adicionar unidade');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteUnit = async (unit: Unit) => {
        if (!confirm(`Deseja realmente excluir a unidade ${unit.imei_1}?`)) {
            return;
        }

        try {
            await unitService.delete(unit.id);
            toast.success('Unidade removida do estoque');
            await fetchUnits();
        } catch (error) {
            console.error('Error deleting unit:', error);
            toast.error('Erro ao remover unidade');
        }
    };

    const handleCancel = () => {
        navigate('/admin/products');
    };

    const locationSearchTerm = encodeURIComponent(product?.sku || product?.name || '');
    const stockLocationsHref = `/admin/inventory/locations?search=${locationSearchTerm}`;
    const distributionTotal = productStockDistribution.reduce((total, item) => total + item.quantity, 0);
    const distributionReserved = productStockDistribution.reduce((total, item) => total + item.reserved_quantity, 0);
    const distributionAvailable = distributionTotal - distributionReserved;

    const handleWarrantyShortcut = () => {
        setActiveTab('product');
        window.setTimeout(() => {
            document.getElementById('product-warranty-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
    };

    // Loading state
    if (isLoadingProduct) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Carregando produto...</p>
                </div>
            </div>
        );
    }

    if (!product) {
        return null;
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-start gap-4 mb-8">
                <button
                    onClick={handleCancel}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors mt-1"
                >
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{product.name}</h1>
                    <p className="text-sm text-slate-500 mt-1">SKU: {product.sku}</p>

                    {/* Stats */}
                    <div className="flex flex-wrap items-center gap-4 mt-4 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm w-max">
                        <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-600">
                                Total: <span className="font-semibold text-slate-900">{stats.total}</span>
                            </span>
                        </div>
                        <div className="w-px h-4 bg-slate-200 hidden sm:block"></div>
                        <div className="text-sm text-slate-600">
                            Disponível: <span className="font-semibold text-green-600">{stats.available}</span>
                        </div>
                        <div className="w-px h-4 bg-slate-200 hidden sm:block"></div>
                        <div className="text-sm text-slate-600">
                            Reservado: <span className="font-semibold text-yellow-600">{stats.reserved}</span>
                        </div>
                        <div className="w-px h-4 bg-slate-200 hidden sm:block"></div>
                        <div className="text-sm text-slate-600">
                            Vendido: <span className="font-semibold text-blue-600">{stats.sold}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Menu Lateral */}
                <div className="w-full md:w-64 flex-shrink-0 bg-white border border-slate-200 rounded-2xl p-3 shadow-sm sticky top-24">
                    <nav className="flex flex-col gap-1.5">
                        <button
                            onClick={() => setActiveTab('product')}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'product'
                                ? 'bg-blue-50 text-blue-800 shadow-sm border border-blue-200/60'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Package className={`w-5 h-5 ${activeTab === 'product' ? 'text-blue-600' : 'text-slate-400'}`} />
                                Editar Produto
                            </div>
                            {activeTab === 'product' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                        </button>

                        <button
                            onClick={() => setActiveTab('inventory')}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'inventory'
                                ? 'bg-blue-50 text-blue-800 shadow-sm border border-blue-200/60'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Package className={`w-5 h-5 ${activeTab === 'inventory' ? 'text-blue-600' : 'text-slate-400'}`} />
                                Gerenciar Estoque
                                {stats.total > 0 && (
                                    <span className="ml-1.5 bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                        {stats.total}
                                    </span>
                                )}
                            </div>
                            {activeTab === 'inventory' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                        </button>

                        <button
                            onClick={handleWarrantyShortcut}
                            className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-slate-600 hover:bg-blue-50 hover:text-blue-800 border border-transparent"
                        >
                            <div className="flex items-center gap-3">
                                <ShieldCheck className="w-5 h-5 text-slate-400" />
                                Garantias
                            </div>
                        </button>
                    </nav>
                </div>

                {/* Tab Content */}
                <div className="flex-1 min-w-0 space-y-6">
                    {activeTab === 'product' && (
                        <>
                            <ProductForm
                                initialData={product}
                                onSubmit={handleProductSubmit}
                                onCancel={handleCancel}
                                isLoading={isSaving}
                            />

                            <ProductTagPicker
                                tags={autoResponderTags}
                                selectedTagIds={productTagIds}
                                isLoading={isLoadingTags}
                                isSaving={isSavingTags}
                                onToggle={toggleProductTag}
                                onSave={saveProductTags}
                            />

                            {/* ─── Seção Fiscal (VPS-first) ─── */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="text-sm font-bold text-slate-700">Informações Fiscais</span>
                                    <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-semibold">VPS → Bling → Shopee</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <NcmSearchWidget
                                        productId={product.id}
                                        sku={product.sku}
                                        productName={product.name}
                                        currentNcm={product.ncm || ''}
                                        autoSave={true}
                                        onSaved={(ncm) => toast.success(`NCM ${ncm} salvo.`)}
                                    />
                                    <InmetroWidget
                                        productId={product.id}
                                        productName={product.name}
                                        currentCertificate={product.specs?.inmetro_certificate || ''}
                                        currentSpecs={product.specs || {}}
                                        autoSave={true}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'inventory' && (
                        <div className="space-y-4">
                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                            <MapPin size={18} className="text-blue-600" />
                                            Distribuicao por local
                                        </h3>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Leitura interna dos depositos e locais cadastrados para este produto.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => navigate(stockLocationsHref)}
                                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                                    >
                                        Ver locais de estoque
                                    </button>
                                </div>

                                {stockDistributionError && (
                                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                        {stockDistributionError}
                                    </div>
                                )}

                                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <div className="rounded-lg bg-slate-50 p-3">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fisico por locais</p>
                                        <p className="mt-1 text-xl font-bold text-slate-900">{distributionTotal}</p>
                                    </div>
                                    <div className="rounded-lg bg-slate-50 p-3">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reservado</p>
                                        <p className="mt-1 text-xl font-bold text-amber-700">{distributionReserved}</p>
                                    </div>
                                    <div className="rounded-lg bg-slate-50 p-3">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saldo disponivel</p>
                                        <p className="mt-1 text-xl font-bold text-emerald-700">{distributionAvailable}</p>
                                    </div>
                                </div>

                                <div className="mt-4 overflow-x-auto">
                                    {isLoadingStockDistribution ? (
                                        <div className="py-8 text-center text-sm text-slate-500">Carregando distribuicao por local...</div>
                                    ) : productStockDistribution.length === 0 ? (
                                        <div className="py-8 text-center text-sm text-slate-500">Nenhum saldo por local cadastrado para este produto.</div>
                                    ) : (
                                        <table className="w-full min-w-[620px] text-left text-sm">
                                            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                                <tr>
                                                    <th className="px-4 py-3">Loja / deposito</th>
                                                    <th className="px-4 py-3">Local</th>
                                                    <th className="px-4 py-3 text-right">Fisico</th>
                                                    <th className="px-4 py-3 text-right">Reservado</th>
                                                    <th className="px-4 py-3 text-right">Saldo disponivel</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {productStockDistribution.map((item) => {
                                                    const available = item.quantity - item.reserved_quantity;

                                                    return (
                                                        <tr key={item.id} className="hover:bg-slate-50">
                                                            <td className="px-4 py-3 font-semibold text-slate-900">{item.deposit?.name || '-'}</td>
                                                            <td className="px-4 py-3 text-slate-700">{item.location?.name || '-'}</td>
                                                            <td className="px-4 py-3 text-right">{item.quantity}</td>
                                                            <td className="px-4 py-3 text-right">{item.reserved_quantity}</td>
                                                            <td className="px-4 py-3 text-right font-bold text-emerald-700">{available}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>

                            {/* Add Unit Button */}
                            {!showUnitForm && (
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => setShowUnitForm(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Adicionar Unidade
                                    </button>
                                </div>
                            )}

                            {/* Unit Form */}
                            {showUnitForm && (
                                <UnitForm
                                    productId={product.id}
                                    onSubmit={handleUnitSubmit}
                                    onCancel={() => setShowUnitForm(false)}
                                    isLoading={isSaving}
                                />
                            )}

                            {/* Units List */}
                            <UnitList
                                units={units}
                                isLoading={isLoadingUnits}
                                onDelete={handleDeleteUnit}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
