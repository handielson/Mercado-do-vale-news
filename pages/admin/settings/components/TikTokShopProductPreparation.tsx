import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, PackageSearch, Search } from 'lucide-react';
import { toast } from 'sonner';
import { productService } from '../../../../services/products';
import {
  tiktokShopService,
  type TikTokShopCategoryReadiness,
  type TikTokShopCategorySummary,
  type TikTokShopSafeStatus,
} from '../../../../services/tiktokShopService';
import type { Product } from '../../../../types/product';

type Props = {
  status: TikTokShopSafeStatus | null;
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

export default function TikTokShopProductPreparation({ status }: Props) {
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

  const productIssues = useMemo(() => getProductIssues(selectedProduct), [selectedProduct]);
  const canReadCatalog = Boolean(
    status?.connected &&
    status?.shop_cipher_configured &&
    status?.granted_scopes?.includes('seller.product.basic'),
  );

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
      setCategories(result.categories.filter((category) => category.is_leaf).slice(0, 40));
      if (result.categories.length === 0) toast.info('Nenhuma categoria TikTok encontrada.');
    } catch (error) {
      console.error('[TikTokShopProductPreparation] category search error:', error);
      toast.error('Nao foi possivel consultar as categorias do TikTok Shop.');
    } finally {
      setSearchingCategories(false);
    }
  }

  async function chooseCategory(category: TikTokShopCategorySummary) {
    setSelectedCategory(category);
    setReadiness(null);
    setLoadingReadiness(true);
    try {
      const result = await tiktokShopService.getCategoryReadiness(category.id);
      setReadiness(result);
    } catch (error) {
      console.error('[TikTokShopProductPreparation] category readiness error:', error);
      toast.error('Nao foi possivel consultar regras e atributos da categoria.');
    } finally {
      setLoadingReadiness(false);
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

      <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        Esta etapa e somente leitura. A criacao do rascunho sera liberada depois que os
        campos locais e os atributos obrigatorios da categoria estiverem completos.
      </div>
    </section>
  );
}
