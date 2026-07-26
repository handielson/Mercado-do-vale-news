import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, PackageSearch, Search, Send } from 'lucide-react';
import { toast } from 'sonner';
import { productService } from '../../../../services/products';
import { categoryService } from '../../../../services/categories';
import {
  tiktokShopService,
  type TikTokShopCategoryReadiness,
  type TikTokShopCategorySummary,
  type TikTokShopSafeStatus,
  type TikTokShopWarehouseSummary,
} from '../../../../services/tiktokShopService';
import type { Product } from '../../../../types/product';

type Props = {
  status: TikTokShopSafeStatus | null;
  initialProductId?: string | null;
  onDraftCreated?: (tiktokProductId: string) => void;
};

function getProductIssues(product: Product | null): string[] {
  if (!product) return [];
  const issues: string[] = [];
  if (!String(product.sku || '').trim()) issues.push('SKU local ausente');
  if (!Number.isFinite(Number(product.price_retail)) || Number(product.price_retail) <= 0) {
    issues.push('Preco de varejo ausente');
  }
  if (!Array.isArray(product.images) || product.images.length === 0) {
    issues.push('Imagem principal ausente');
  }
  if (!Number(product.shipping_weight || product.weight_kg || 0)) {
    issues.push('Peso de envio ausente');
  }
  const dimensions = product.dimensions;
  const hasDimensions = Boolean(
    Number(product.shipping_height || dimensions?.height_cm || 0) &&
    Number(product.shipping_width || dimensions?.width_cm || 0) &&
    Number(product.shipping_length || dimensions?.depth_cm || 0),
  );
  if (!hasDimensions) issues.push('Medidas de envio ausentes');
  if (!String(product.description || '').trim()) issues.push('Descricao ausente');
  return issues;
}

function attributeLabel(attribute: Record<string, any>): string {
  return String(attribute?.name || attribute?.id || 'Atributo obrigatorio');
}

function normalizeCategoryName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export default function TikTokShopProductPreparation({
  status,
  initialProductId,
  onDraftCreated,
}: Props) {
  const [productQuery, setProductQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [categories, setCategories] = useState<TikTokShopCategorySummary[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<TikTokShopCategorySummary | null>(null);
  const [readiness, setReadiness] = useState<TikTokShopCategoryReadiness | null>(null);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [searchingCategories, setSearchingCategories] = useState(false);
  const [loadingReadiness, setLoadingReadiness] = useState(false);
  const [loadingInitialProduct, setLoadingInitialProduct] = useState(Boolean(initialProductId));
  const [autoMappingCategory, setAutoMappingCategory] = useState(false);
  const [categoryMappingMessage, setCategoryMappingMessage] = useState('');
  const [warehouses, setWarehouses] = useState<TikTokShopWarehouseSummary[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [createdTikTokProductId, setCreatedTikTokProductId] = useState('');

  React.useEffect(() => {
    let cancelled = false;
    if (!initialProductId) {
      setLoadingInitialProduct(false);
      return;
    }

    setLoadingInitialProduct(true);
    productService.getById(initialProductId)
      .then((product) => {
        if (cancelled) return;
        if (!product) {
          toast.error('O produto selecionado nao foi encontrado.');
          return;
        }
        setProductQuery(product.sku || product.name);
        setProducts([product]);
        setSelectedProduct(product);
      })
      .catch((error) => {
        console.error('[TikTokShopProductPreparation] initial product error:', error);
        if (!cancelled) toast.error('Nao foi possivel carregar o produto selecionado.');
      })
      .finally(() => {
        if (!cancelled) setLoadingInitialProduct(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialProductId]);

  const productIssues = useMemo(() => getProductIssues(selectedProduct), [selectedProduct]);
  const canReadCatalog = Boolean(
    status?.connected &&
    status?.shop_cipher_configured &&
    status?.granted_scopes?.includes('seller.product.basic'),
  );
  const canWriteProducts = Boolean(status?.granted_scopes?.includes('seller.product.write'));
  const canReadWarehouses = Boolean(status?.granted_scopes?.includes('seller.logistics'));

  React.useEffect(() => {
    let cancelled = false;
    if (!status?.connected || !canReadWarehouses) {
      setWarehouses([]);
      setSelectedWarehouseId('');
      return;
    }
    setLoadingWarehouses(true);
    tiktokShopService.getWarehouses()
      .then((result) => {
        if (cancelled) return;
        const available = (Array.isArray(result?.warehouses) ? result.warehouses : [])
          .filter((warehouse) => warehouse.effect_status === 'ENABLED')
          .filter((warehouse) => !warehouse.type || warehouse.type === 'SALES_WAREHOUSE');
        setWarehouses(available);
        const preferred = available.find((warehouse) => warehouse.is_default) || available[0];
        setSelectedWarehouseId(preferred?.id || '');
      })
      .catch((error) => {
        console.error('[TikTokShopProductPreparation] warehouse loading error:', error);
        if (!cancelled) toast.error('Nao foi possivel consultar os armazens do TikTok Shop.');
      })
      .finally(() => {
        if (!cancelled) setLoadingWarehouses(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canReadWarehouses, status?.connected]);

  React.useEffect(() => {
    let cancelled = false;
    const localCategoryId = String(selectedProduct?.category_id || '').trim();
    if (!localCategoryId || !canReadCatalog) {
      setCategoryMappingMessage('');
      return;
    }

    async function autoMapCategory() {
      setAutoMappingCategory(true);
      setCategoryMappingMessage('Buscando o mapeamento automatico da categoria...');
      try {
        const saved = await tiktokShopService.getCategoryMapping(localCategoryId);
        if (cancelled) return;
        if (saved.mapping) {
          const mappedCategory: TikTokShopCategorySummary = {
            id: saved.mapping.tiktok_category_id,
            parent_id: null,
            name: saved.mapping.tiktok_category_name,
            is_leaf: true,
            permission_statuses: ['AVAILABLE'],
          };
          setCategoryQuery(mappedCategory.name);
          setCategories([mappedCategory]);
          setCategoryMappingMessage(`Mapeamento salvo: ${mappedCategory.name}`);
          await chooseCategory(mappedCategory, false);
          return;
        }

        const localCategory = await categoryService.getById(localCategoryId);
        if (cancelled || !localCategory?.name) {
          setCategoryMappingMessage('Categoria local sem nome para mapear automaticamente.');
          return;
        }

        setCategoryQuery(localCategory.name);
        const result = await tiktokShopService.getCategories(localCategory.name);
        if (cancelled) return;
        const categoryResults = Array.isArray(result?.categories) ? result.categories : [];
        const candidates = categoryResults
          .filter((category) => category.is_leaf)
          .filter((category) => (
            category.permission_statuses.length === 0 ||
            category.permission_statuses.includes('AVAILABLE')
          ))
          .slice(0, 40);
        setCategories(candidates);

        const normalizedLocalName = normalizeCategoryName(localCategory.name);
        const exactMatch = candidates.find(
          (category) => normalizeCategoryName(category.name) === normalizedLocalName,
        );
        if (exactMatch) {
          setCategoryMappingMessage(`Categoria reconhecida automaticamente: ${exactMatch.name}`);
          await chooseCategory(exactMatch, true);
        } else if (candidates.length > 0) {
          setCategoryMappingMessage(
            `Encontramos sugestoes para "${localCategory.name}". Confirme uma vez; os proximos produtos serao automaticos.`,
          );
        } else {
          setCategoryMappingMessage(
            `Nenhuma categoria TikTok exata para "${localCategory.name}". Busque e confirme uma vez.`,
          );
        }
      } catch (error) {
        console.error('[TikTokShopProductPreparation] automatic category mapping error:', error);
        if (!cancelled) {
          setCategoryMappingMessage('Nao foi possivel mapear automaticamente. Use a busca manual.');
        }
      } finally {
        if (!cancelled) setAutoMappingCategory(false);
      }
    }

    void autoMapCategory();
    return () => {
      cancelled = true;
    };
  }, [canReadCatalog, selectedProduct?.category_id]);

  async function searchProducts() {
    const query = productQuery.trim();
    if (query.length < 2) {
      toast.info('Digite ao menos 2 caracteres para buscar o produto.');
      return;
    }
    setSearchingProducts(true);
    try {
      const result = await productService.search(query);
      setProducts(result.slice(0, 12));
      if (result.length === 0) toast.info('Nenhum produto local encontrado.');
    } catch (error) {
      console.error('[TikTokShopProductPreparation] product search error:', error);
      toast.error('Nao foi possivel buscar os produtos locais.');
    } finally {
      setSearchingProducts(false);
    }
  }

  async function searchCategories() {
    const query = categoryQuery.trim();
    if (query.length < 2) {
      toast.info('Digite ao menos 2 caracteres para buscar a categoria TikTok.');
      return;
    }
    setSearchingCategories(true);
    try {
      const result = await tiktokShopService.getCategories(query);
      const categoryResults = Array.isArray(result?.categories) ? result.categories : [];
      setCategories(categoryResults.filter((category) => category.is_leaf).slice(0, 40));
      if (categoryResults.length === 0) toast.info('Nenhuma categoria TikTok encontrada.');
    } catch (error) {
      console.error('[TikTokShopProductPreparation] category search error:', error);
      toast.error('Nao foi possivel consultar as categorias do TikTok Shop.');
    } finally {
      setSearchingCategories(false);
    }
  }

  async function chooseCategory(category: TikTokShopCategorySummary, persistMapping = true) {
    setSelectedCategory(category);
    setReadiness(null);
    setLoadingReadiness(true);
    try {
      const result = await tiktokShopService.getCategoryReadiness(category.id);
      setReadiness(result);
      const localCategoryId = String(selectedProduct?.category_id || '').trim();
      if (persistMapping && localCategoryId) {
        await tiktokShopService.saveCategoryMapping({
          local_category_id: localCategoryId,
          tiktok_category_id: category.id,
          tiktok_category_name: category.name,
        });
        setCategoryMappingMessage(`Mapeamento salvo: ${category.name}`);
      }
    } catch (error) {
      console.error('[TikTokShopProductPreparation] category readiness error:', error);
      toast.error('Nao foi possivel consultar regras e atributos da categoria.');
    } finally {
      setLoadingReadiness(false);
    }
  }

  async function createTikTokDraft() {
    if (!selectedProduct || !selectedCategory || !selectedWarehouseId) {
      toast.info('Selecione produto, categoria e armazem antes de criar o rascunho.');
      return;
    }
    if (productIssues.length > 0) {
      toast.warning('Complete os dados locais obrigatorios antes de enviar.');
      return;
    }
    if (!window.confirm(
      `Criar "${selectedProduct.name}" como rascunho no TikTok Shop? O produto ainda nao ficara visivel para clientes.`,
    )) return;

    setCreatingDraft(true);
    try {
      const result = await tiktokShopService.createDraft({
        product_id: selectedProduct.id,
        category_id: selectedCategory.id,
        category_name: selectedCategory.name,
        warehouse_id: selectedWarehouseId,
      });
      setCreatedTikTokProductId(result.tiktok_product_id);
      toast.success(
        result.already_exists
          ? 'Este produto ja possui rascunho no TikTok Shop.'
          : 'Rascunho criado no TikTok Shop.',
      );
      onDraftCreated?.(result.tiktok_product_id);
    } catch (error: any) {
      console.error('[TikTokShopProductPreparation] draft creation error:', error);
      toast.error(error?.message || 'Nao foi possivel criar o rascunho no TikTok Shop.');
    } finally {
      setCreatingDraft(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <PackageSearch className="mt-0.5 h-5 w-5 text-teal-700" />
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Preparar produto para o TikTok</h2>
          <p className="mt-1 text-sm text-slate-600">
            Selecione um produto local e uma categoria folha. O sistema confere dados,
            regras e atributos obrigatorios antes de liberar a criacao do rascunho.
          </p>
        </div>
      </div>

      {!canReadCatalog && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          A conexao precisa incluir o escopo seller.product.basic para consultar o catalogo.
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <label className="text-sm font-semibold text-slate-800">1. Produto do sistema</label>
          {loadingInitialProduct && (
            <p className="mt-2 inline-flex items-center gap-2 text-xs text-teal-700">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Carregando produto selecionado...
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <input
              value={productQuery}
              onChange={(event) => setProductQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void searchProducts();
              }}
              placeholder="Nome, SKU ou EAN"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={searchProducts}
              disabled={searchingProducts}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {searchingProducts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </button>
          </div>
          <div className="mt-2 max-h-56 space-y-2 overflow-auto">
            {products.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => setSelectedProduct(product)}
                className={`w-full rounded-lg border p-3 text-left text-sm ${
                  selectedProduct?.id === product.id
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="font-semibold text-slate-900">{product.name}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  SKU {product.sku || 'sem SKU'} · R$ {(Number(product.price_retail || 0) / 100).toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-800">2. Categoria TikTok Shop</label>
          {categoryMappingMessage && (
            <p className="mt-2 inline-flex items-center gap-2 rounded-md bg-cyan-50 px-2.5 py-1.5 text-xs text-cyan-900">
              {autoMappingCategory && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {categoryMappingMessage}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <input
              value={categoryQuery}
              onChange={(event) => setCategoryQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void searchCategories();
              }}
              placeholder="Ex.: celular, pelicula, carregador"
              disabled={!canReadCatalog}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            />
            <button
              type="button"
              onClick={searchCategories}
              disabled={!canReadCatalog || searchingCategories}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {searchingCategories ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </button>
          </div>
          <div className="mt-2 max-h-56 space-y-2 overflow-auto">
            {categories.map((category) => {
              const available = category.permission_statuses.length === 0 ||
                category.permission_statuses.includes('AVAILABLE');
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => void chooseCategory(category)}
                  disabled={!available}
                  className={`w-full rounded-lg border p-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                    selectedCategory?.id === category.id
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-semibold text-slate-900">{category.name}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    ID {category.id} · {available ? 'Disponivel' : category.permission_statuses.join(', ')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {(selectedProduct || selectedCategory) && (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className={`rounded-lg border p-4 ${productIssues.length ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              {productIssues.length ? <AlertTriangle className="h-4 w-4 text-amber-700" /> : <CheckCircle2 className="h-4 w-4 text-green-700" />}
              Dados locais
            </div>
            {selectedProduct ? (
              productIssues.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                  {productIssues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-green-900">Produto com os dados basicos para preparar o rascunho.</p>
              )
            ) : (
              <p className="mt-2 text-sm text-slate-600">Selecione um produto local.</p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              {loadingReadiness && <Loader2 className="h-4 w-4 animate-spin" />}
              Regras da categoria
            </div>
            {readiness ? (
              readiness.required_attributes.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {readiness.required_attributes.map((attribute) => (
                    <li key={String(attribute.id || attribute.name)}>
                      {attributeLabel(attribute)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-green-800">Nenhum atributo obrigatorio retornado para esta categoria.</p>
              )
            ) : (
              <p className="mt-2 text-sm text-slate-600">Selecione uma categoria disponivel.</p>
            )}
          </div>
        </div>
      )}

      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <label className="text-sm font-semibold text-slate-800">3. Armazem e envio</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <select
            value={selectedWarehouseId}
            onChange={(event) => setSelectedWarehouseId(event.target.value)}
            disabled={!canReadWarehouses || loadingWarehouses || creatingDraft}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
          >
            <option value="">
              {loadingWarehouses ? 'Consultando armazens...' : 'Selecione o armazem TikTok'}
            </option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}{warehouse.is_default ? ' (padrao)' : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void createTikTokDraft()}
            disabled={
              creatingDraft ||
              !canWriteProducts ||
              !canReadWarehouses ||
              !selectedProduct ||
              !selectedCategory ||
              !selectedWarehouseId ||
              productIssues.length > 0
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creatingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {creatingDraft ? 'Enviando imagens e produto...' : 'Criar rascunho no TikTok'}
          </button>
        </div>
        {!canWriteProducts && (
          <p className="mt-2 text-xs text-amber-800">
            Ative o escopo seller.product.write e reconecte a loja para liberar o envio.
          </p>
        )}
        {!canReadWarehouses && (
          <p className="mt-2 text-xs text-amber-800">
            Ative o escopo seller.logistics e reconecte a loja para consultar o armazem.
          </p>
        )}
        {createdTikTokProductId && (
          <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            Rascunho TikTok {createdTikTokProductId} criado e vinculado.
          </p>
        )}
        <p className="mt-2 text-xs text-slate-600">
          O envio usa AS_DRAFT: nada fica visivel para clientes ate a publicacao posterior no Seller Center.
        </p>
      </div>
    </section>
  );
}
