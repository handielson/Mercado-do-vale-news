
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Package, Plus } from 'lucide-react';
import { Product, ProductInput } from '../../../types/product';
import { Unit, UnitInput } from '../../../types/unit';
import { productService } from '../../../services/products';
import { unitService } from '../../../services/units';
import { ProductForm } from '../../../components/products/ProductForm';
import { UnitList } from '../../../components/units/UnitList';
import { UnitForm } from '../../../components/units/UnitForm';

type TabType = 'product' | 'inventory';

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

    const [isLoadingProduct, setIsLoadingProduct] = useState(false);
    const [isLoadingUnits, setIsLoadingUnits] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showUnitForm, setShowUnitForm] = useState(false);

    // Fetch product data
    useEffect(() => {
        if (id) {
            fetchProduct();
            fetchUnits();
        }
    }, [id]);

    const fetchProduct = async () => {
        if (!id) return;

        try {
            setIsLoadingProduct(true);
            const data = await productService.getById(id);
            setProduct(data);
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
            await fetchProduct();
        } catch (error) {
            console.error('Error updating product:', error);
            toast.error('Erro ao atualizar produto');
        } finally {
            setIsSaving(false);
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4">
                <button
                    onClick={handleCancel}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors mt-1"
                >
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold text-slate-900">{product.name}</h1>
                    <p className="text-sm text-slate-500 mt-1">SKU: {product.sku}</p>

                    {/* Stats */}
                    <div className="flex items-center gap-4 mt-4">
                        <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-600">
                                Total: <span className="font-semibold text-slate-900">{stats.total}</span>
                            </span>
                        </div>
                        <div className="text-sm text-slate-600">
                            Disponível: <span className="font-semibold text-green-600">{stats.available}</span>
                        </div>
                        <div className="text-sm text-slate-600">
                            Reservado: <span className="font-semibold text-yellow-600">{stats.reserved}</span>
                        </div>
                        <div className="text-sm text-slate-600">
                            Vendido: <span className="font-semibold text-blue-600">{stats.sold}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200">
                <nav className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('product')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'product'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        Editar Produto
                    </button>
                    <button
                        onClick={() => setActiveTab('inventory')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'inventory'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        Gerenciar Estoque ({stats.total})
                    </button>
                </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'product' && (
                <ProductForm
                    initialData={product}
                    onSubmit={handleProductSubmit}
                    onCancel={handleCancel}
                    isLoading={isSaving}
                />
            )}

            {activeTab === 'inventory' && (
                <div className="space-y-4">
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
    );
};
