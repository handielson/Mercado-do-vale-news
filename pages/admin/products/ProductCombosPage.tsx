import React, { useState, useEffect, useMemo } from 'react';
import { Package, Plus, Search, Trash2, Edit2, ChevronLeft, Save, X, Calculator, Store, Clipboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { vpsApiService } from '../../../services/vpsApiService';
import { supabase } from '../../../services/supabase';
import { formatCurrency } from '../../../utils/saleCalculations';
import {
  buildDefaultOfferSku,
  calculateOfferStock,
  chooseShopeeOfferStrategy,
  hasMissingBlingLink,
} from '../../../services/productOfferEngine';
import type { ProductOfferShopeeStrategy, ProductOfferType, ProductOfferVisibility } from '../../../types/product-offer';
import type { VpsMutationResult } from '../../../services/vpsApiService';

interface ProductComboFormData {
  id?: string;
  name: string;
  sku: string;
  category_id?: string;
  brand?: string;
  combo_discount_type: 'percentage' | 'fixed' | null;
  combo_discount_value: number;
  price_retail: number;
  price_cost: number;
  price_reseller: number;
  price_wholesale: number;
  status: 'active' | 'inactive';
  track_inventory: boolean;
  offer_type?: ProductOfferType | null;
  offer_parent_product_id?: string | null;
  offer_visibility?: ProductOfferVisibility;
  shopee_strategy?: ProductOfferShopeeStrategy;
  shopee_offer_status?: string | null;
  shopee_offer_error?: string | null;
  combo_children: Array<{
    id: string;
    quantity: number;
    name?: string;
    sku?: string;
    price_retail?: number;
    price_cost?: number;
    price_reseller?: number;
    price_wholesale?: number;
    stock_quantity?: number;
    weight_kg?: number | null;
    dimensions?: any;
    bling_id?: number | null;
    parent_id?: string | null;
  }>;
  combo_choice_groups?: Array<{
    group_key: string;
    parent_product_id: string;
    label: string;
    quantity: number;
    options: Array<{
      id: string;
      name?: string;
      sku?: string;
      price_retail?: number;
      price_cost?: number;
      price_reseller?: number;
      price_wholesale?: number;
      stock_quantity?: number;
      weight_kg?: number | null;
      dimensions?: any;
      bling_id?: number | null;
      parent_id?: string | null;
    }>;
  }>;
  description?: string;
  technical_specifications?: string;
  tags?: string[];
  images?: string[];
  slug?: string;
  weight_kg?: number | null;
  dimensions?: any;
}

const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
};

type ProductCombosPageProps = {
  initialOfferMode?: boolean;
};

type PackageMode = 'auto' | 'manual';

type ProductPhysicalPackage = {
  weight_kg: number;
  width_cm: number;
  height_cm: number;
  depth_cm: number;
};

const DEFAULT_PACKAGE: ProductPhysicalPackage = {
  weight_kg: 0.3,
  width_cm: 15,
  height_cm: 10,
  depth_cm: 20,
};

const toPositiveNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeProductDimensions = (dimensions: any) => {
  if (!dimensions) return null;
  const parsed = typeof dimensions === 'string'
    ? (() => {
        try { return JSON.parse(dimensions); } catch { return null; }
      })()
    : dimensions;
  if (!parsed) return null;
  return {
    width_cm: toPositiveNumber(parsed.width_cm ?? parsed.largura ?? parsed.width),
    height_cm: toPositiveNumber(parsed.height_cm ?? parsed.altura ?? parsed.height),
    depth_cm: toPositiveNumber(parsed.depth_cm ?? parsed.comprimento ?? parsed.profundidade ?? parsed.length),
  };
};

const calculatePhysicalPackage = (items: Array<{ product: any; quantity: number }>): ProductPhysicalPackage => {
  if (!items.length) return DEFAULT_PACKAGE;

  let weight = 0;
  let width = 0;
  let height = 0;
  let depth = 0;

  for (const { product, quantity } of items) {
    const qty = Math.max(1, Math.trunc(Number(quantity) || 1));
    weight += toPositiveNumber(product?.weight_kg) * qty;

    const dimensions = normalizeProductDimensions(product?.dimensions);
    if (dimensions) {
      height += dimensions.height_cm * qty;
      width = Math.max(width, dimensions.width_cm);
      depth = Math.max(depth, dimensions.depth_cm);
    }
  }

  return {
    weight_kg: Number((weight || DEFAULT_PACKAGE.weight_kg).toFixed(3)),
    width_cm: Number((width || DEFAULT_PACKAGE.width_cm).toFixed(1)),
    height_cm: Number((height || DEFAULT_PACKAGE.height_cm).toFixed(1)),
    depth_cm: Number((depth || DEFAULT_PACKAGE.depth_cm).toFixed(1)),
  };
};

const normalizeChoiceGroupsFromComboRows = (rows: any[] | null | undefined): NonNullable<ProductComboFormData['combo_choice_groups']> => {
  const groups = new Map<string, NonNullable<ProductComboFormData['combo_choice_groups']>[number]>();
  (rows || [])
    .filter(row => row?.component_type === 'choice_group')
    .forEach(row => {
      const key = String(row.group_key || row.parent_product_id || row.parent_id || row.id);
      const current = groups.get(key) || {
        group_key: key,
        parent_product_id: String(row.parent_product_id || row.parent_id || row.id),
        label: row.group_label || row.label || row.parent_name || row.name || 'Escolha uma opcao',
        quantity: Math.max(1, Number(row.quantity) || 1),
        options: [],
      };
      current.options.push({
        id: row.id,
        name: row.name,
        sku: row.sku,
        price_retail: row.price_retail,
        price_cost: row.price_cost,
        price_reseller: row.price_reseller,
        price_wholesale: row.price_wholesale,
        stock_quantity: row.stock_quantity,
        weight_kg: row.weight_kg,
        dimensions: row.dimensions,
        bling_id: row.bling_id,
        parent_id: row.parent_id,
      });
      groups.set(key, current);
    });
  return Array.from(groups.values());
};

const normalizeComboFamilyText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

const getComboFamilyBaseName = (product: any) => {
  const name = String(product?.name || '').trim();
  if (!name) return '';
  return name.split(/\s+cor\s*:/i)[0].trim();
};

const getComboFamilyKey = (product: any) => {
  if (product?.parent_id) return `parent:${product.parent_id}`;
  const baseName = normalizeComboFamilyText(getComboFamilyBaseName(product));
  return baseName ? `name:${baseName}` : `product:${product?.id || ''}`;
};

const isSameComboFamily = (candidate: any, reference: any) => {
  if (!candidate || !reference) return false;
  if (reference.parent_id) {
    return String(candidate.parent_id || candidate.id) === String(reference.parent_id);
  }
  const referenceBase = normalizeComboFamilyText(getComboFamilyBaseName(reference));
  const candidateBase = normalizeComboFamilyText(getComboFamilyBaseName(candidate));
  return Boolean(referenceBase && candidateBase && referenceBase === candidateBase);
};

const preferVariationOptions = (products: any[]) => {
  const unique = Array.from(new Map(products.filter(Boolean).map(product => [product.id, product])).values());
  const colored = unique.filter(product => /\s+cor\s*:/i.test(String(product?.name || '')));
  return colored.length > 0 ? colored : unique;
};

const sanitizeComboDebugValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    if (value.startsWith('data:')) return `[data-url:${value.length} chars]`;
    return value.length > 1200 ? `${value.slice(0, 1200)}... [truncated ${value.length} chars]` : value;
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeComboDebugValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sanitizeComboDebugValue(item),
      ]),
    );
  }

  return value;
};

const buildComboSaveDebug = (input: {
  action: string;
  payload?: unknown;
  result?: VpsMutationResult | null;
  error?: unknown;
  editingCombo?: ProductComboFormData | null;
  componentCount: number;
}) => JSON.stringify({
  capturedAt: new Date().toISOString(),
  page: 'ProductCombosPage',
  action: input.action,
  componentCount: input.componentCount,
  browserPath: typeof window !== 'undefined' ? window.location.pathname : null,
  apiResult: sanitizeComboDebugValue(input.result),
  error: input.error instanceof Error ? {
    name: input.error.name,
    message: input.error.message,
    stack: input.error.stack,
  } : sanitizeComboDebugValue(input.error),
  payload: sanitizeComboDebugValue(input.payload),
  editingSummary: sanitizeComboDebugValue({
    id: input.editingCombo?.id,
    name: input.editingCombo?.name,
    sku: input.editingCombo?.sku,
    offer_type: input.editingCombo?.offer_type,
    offer_parent_product_id: input.editingCombo?.offer_parent_product_id,
    combo_children: input.editingCombo?.combo_children?.map(child => ({
      id: child.id,
      sku: child.sku,
      name: child.name,
      quantity: child.quantity,
      bling_id: child.bling_id,
      parent_id: child.parent_id,
    })),
    combo_choice_groups: input.editingCombo?.combo_choice_groups?.map(group => ({
      group_key: group.group_key,
      parent_product_id: group.parent_product_id,
      label: group.label,
      quantity: group.quantity,
      optionCount: group.options.length,
      optionIds: group.options.map(option => option.id),
    })),
  }),
}, null, 2);

export const ProductCombosPage: React.FC<ProductCombosPageProps> = ({ initialOfferMode = false }) => {
  const navigate = useNavigate();
  const [combos, setCombos] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'all' | 'combos' | 'offers'>(initialOfferMode ? 'offers' : 'all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<ProductComboFormData | null>(null);
  const [saving, setSaving] = useState(false);
  const [captureSaveDebug, setCaptureSaveDebug] = useState(true);
  const [lastSaveDebug, setLastSaveDebug] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [childSearchTerm, setChildSearchTerm] = useState('');
  const [childSearchResults, setChildSearchResults] = useState<any[]>([]);
  const [childSearchLoading, setChildSearchLoading] = useState(false);
  const [selectedChildProductIds, setSelectedChildProductIds] = useState<string[]>([]);
  const [imageStyle, setImageStyle] = useState<'auto' | 'mosaic' | 'manual'>('auto');
  const [packageMode, setPackageMode] = useState<PackageMode>('auto');
  const [packageDraft, setPackageDraft] = useState<ProductPhysicalPackage | null>(null);

  const editingOfferItems = useMemo(() => {
    if (!editingCombo?.offer_type) return [];
    const fixedItems = editingCombo.combo_children.map(child => ({
      product: allProducts.find(p => p.id === child.id) || child,
      quantity: child.quantity,
    }));
    const choiceItems = (editingCombo.combo_choice_groups || []).map(group => {
      const firstOption = group.options[0];
      return {
        product: allProducts.find(p => p.id === firstOption?.id) || firstOption || group,
        quantity: group.quantity,
      };
    });
    return [...fixedItems, ...choiceItems];
  }, [allProducts, editingCombo]);

  const editingOfferStock = useMemo(() => calculateOfferStock(editingOfferItems), [editingOfferItems]);
  const editingOfferHasMissingBling = useMemo(() => hasMissingBlingLink(editingOfferItems), [editingOfferItems]);
  const calculatedPackage = useMemo(() => calculatePhysicalPackage(editingOfferItems), [editingOfferItems]);
  const packageValues = packageMode === 'manual' && packageDraft ? packageDraft : calculatedPackage;

  const handlePackageFieldChange = (field: keyof ProductPhysicalPackage, value: string) => {
    const nextValue = toPositiveNumber(value, DEFAULT_PACKAGE[field]);
    setPackageMode('manual');
    setPackageDraft({
      ...packageValues,
      [field]: nextValue,
    });
  };

  const handleRecalculatePackageFromItems = () => {
    setPackageMode('auto');
    setPackageDraft(calculatedPackage);
  };

  const copyLastSaveDebug = async () => {
    if (!lastSaveDebug) return;
    try {
      await navigator.clipboard.writeText(lastSaveDebug);
      toast.success('Debug copiado');
    } catch {
      toast.error('Nao foi possivel copiar o debug');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const prods = await vpsApiService.getProducts({ noCache: true, limit: 9999 });
      if (prods) {
        setAllProducts(prods.filter(p => !p.is_combo && !p.offer_type));
        setCombos(prods.filter(p => p.is_combo || p.offer_type));
      }
    } catch (e) {
      toast.error('Erro ao carregar combos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const query = childSearchTerm.trim();
    if (!isModalOpen || query.length < 2) {
      setChildSearchResults([]);
      setChildSearchLoading(false);
      setSelectedChildProductIds([]);
      return;
    }

    let cancelled = false;
    setChildSearchLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const rows = await vpsApiService.getProducts({ search: childSearchTerm.trim(), status: 'all', limit: 80, noCache: true });
        if (cancelled) return;
        const products = (rows || []).filter(p => !p.is_combo && !p.offer_type);
        setChildSearchResults(products);
        setAllProducts(prev => {
          const merged = new Map(prev.map(product => [product.id, product]));
          products.forEach(product => merged.set(product.id, { ...(merged.get(product.id) || {}), ...product }));
          return Array.from(merged.values());
        });
      } catch {
        if (!cancelled) setChildSearchResults([]);
      } finally {
        if (!cancelled) setChildSearchLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [childSearchTerm, isModalOpen]);

  const openNewComboModal = () => {
    setLastSaveDebug(null);
    setEditingCombo({
      name: '',
      sku: '',
      combo_discount_type: 'percentage',
      combo_discount_value: 0,
      price_cost: 0,
      price_retail: 0,
      price_reseller: 0,
      price_wholesale: 0,
      status: 'active',
      track_inventory: true,
      offer_type: null,
      offer_visibility: 'visible',
      shopee_strategy: 'variation',
      combo_children: [],
      combo_choice_groups: [],
      tags: []
    });
    setImageStyle('auto');
    setPackageMode('auto');
    setPackageDraft(null);
    setChildSearchResults([]);
    setChildSearchTerm('');
    setSelectedChildProductIds([]);
    setIsModalOpen(true);
  };

  const openNewOfferModal = () => {
    setLastSaveDebug(null);
    setEditingCombo({
      name: '',
      sku: '',
      combo_discount_type: 'percentage',
      combo_discount_value: 0,
      price_cost: 0,
      price_retail: 0,
      price_reseller: 0,
      price_wholesale: 0,
      status: 'active',
      track_inventory: true,
      offer_type: 'quantity_kit',
      offer_parent_product_id: null,
      offer_visibility: 'visible',
      shopee_strategy: 'variation',
      shopee_offer_status: null,
      shopee_offer_error: null,
      combo_children: [],
      combo_choice_groups: [],
      tags: []
    });
    setImageStyle('auto');
    setPackageMode('auto');
    setPackageDraft(null);
    setChildSearchResults([]);
    setChildSearchTerm('');
    setSelectedChildProductIds([]);
    setIsModalOpen(true);
  };

  const openEditComboModal = async (combo: any) => {
    setLastSaveDebug(null);
    const toastId = toast.loading('Carregando itens do combo...');
    try {
      const [children, supaResult] = await Promise.all([
        vpsApiService.getComboChildren(combo.id),
        supabase.from('products').select('description, technical_specifications').eq('id', combo.id).maybeSingle()
      ]);

      // Prioriza description do Supabase (fonte primária), fallback para a VPS
      const savedDescription = supaResult.data?.description || combo.description || '';
      const savedTechSpecs = supaResult.data?.technical_specifications || combo.technical_specifications || '';

      const fixedChildren = (children || []).filter(c => c?.component_type !== 'choice_group');
      setEditingCombo({
        ...combo,
        combo_discount_type: combo.combo_discount_type || 'percentage',
        combo_discount_value: combo.combo_discount_value || 0,
        offer_type: combo.offer_type || null,
        offer_parent_product_id: combo.offer_parent_product_id || null,
        offer_visibility: combo.offer_visibility || 'visible',
        shopee_strategy: combo.shopee_strategy || 'variation',
        shopee_offer_status: combo.shopee_offer_status || null,
        shopee_offer_error: combo.shopee_offer_error || null,
        combo_children: fixedChildren?.map(c => ({
          id: c.id,
          name: c.name,
          sku: c.sku,
          quantity: c.quantity,
          price_retail: c.price_retail,
          price_cost: c.price_cost,
          price_reseller: c.price_reseller,
          price_wholesale: c.price_wholesale,
          stock_quantity: c.stock_quantity,
          weight_kg: c.weight_kg,
          dimensions: c.dimensions,
          bling_id: c.bling_id,
          parent_id: c.parent_id
        })) || [],
        combo_choice_groups: normalizeChoiceGroupsFromComboRows(children),
        tags: combo.tags || [],
        description: savedDescription,
        technical_specifications: savedTechSpecs,
      });
      setImageStyle(combo.tags?.includes('mosaic_combo') ? 'mosaic' : 'auto');
      setPackageMode('manual');
      setPackageDraft({
        weight_kg: toPositiveNumber(combo.weight_kg, DEFAULT_PACKAGE.weight_kg),
        width_cm: toPositiveNumber(normalizeProductDimensions(combo.dimensions)?.width_cm, DEFAULT_PACKAGE.width_cm),
        height_cm: toPositiveNumber(normalizeProductDimensions(combo.dimensions)?.height_cm, DEFAULT_PACKAGE.height_cm),
        depth_cm: toPositiveNumber(normalizeProductDimensions(combo.dimensions)?.depth_cm, DEFAULT_PACKAGE.depth_cm),
      });
      setChildSearchResults([]);
      setChildSearchTerm('');
      setSelectedChildProductIds([]);
      setIsModalOpen(true);
      toast.dismiss(toastId);
    } catch (e) {
      toast.error('Erro ao carregar detalhes', { id: toastId });
    }
  };

  const handleSaveCombo = async () => {
    if (!editingCombo) return;
    const componentCount = (editingCombo.combo_children?.length || 0) + (editingCombo.combo_choice_groups?.length || 0);
    if (componentCount === 0) {
      return toast.error('Adicione pelo menos um produto ao combo');
    }

    const isOffer = Boolean(editingCombo.offer_type);
    if (!isOffer && !editingCombo.name) return toast.error('Nome do combo é obrigatório');
    if (editingCombo.offer_type === 'quantity_kit' && editingCombo.combo_children.length !== 1) {
      return toast.error('Kit de quantidade deve ter exatamente um produto base');
    }
    if (editingCombo.offer_type === 'product_combo' && componentCount < 2) {
      return toast.error('Combo de oferta deve ter pelo menos dois produtos');
    }

    setSaving(true);
    setLastSaveDebug(null);
    const toastId = toast.loading('Salvando combo...');
    let saveAction = 'unknown';
    let savePayload: unknown;
    let saveResult: VpsMutationResult | null = null;
    let capturedDebug: string | null = null;
    
    try {
      let mergedDescription = '';
      let mergedSpecs = '';
      let autoImages: string[] = [];

      // Buscando dados enriquecidos diretamente da VPS (já pré-carregados no allProducts e vpsApiService)
      const descriptionItems = [
        ...editingCombo.combo_children,
        ...(editingCombo.combo_choice_groups || []).map(group => ({
          ...group.options[0],
          name: group.label,
          quantity: group.quantity,
        })).filter(item => item?.id),
      ];

      for (const c of descriptionItems) {
        let prodData = allProducts.find(p => p.id === c.id);

        let effectiveDesc = prodData?.description || '';
        let effectiveSpecs = prodData?.technical_specifications || prodData?.specs?.technical_specifications || '';

        // Se o cache allProducts da tela de Combo não tiver descrição rica, faz um fetch leve por id na VPS
        if (!effectiveDesc && !effectiveSpecs) {
            try {
                const vpsRich = await vpsApiService.getProductById(c.id);
                if (vpsRich && !vpsRich.error) {
                    prodData = { ...(prodData || {}), ...vpsRich, name: vpsRich.name || c.name };
                    if (!effectiveDesc) effectiveDesc = vpsRich.description || '';
                    if (!effectiveSpecs) effectiveSpecs = vpsRich.technical_specifications || '';
                }
            } catch(e) {
                console.warn('Falha ao buscar dados ricos da VPS para', c.id);
            }
        }

        if (prodData) {
          if (effectiveDesc) {
            mergedDescription += (mergedDescription ? '<hr class="my-6 border-slate-200">' : '') + `<h4 class="text-lg font-bold text-slate-800 mb-3">${c.quantity}x ${prodData.name}</h4><div>${effectiveDesc}</div>`;
          }
          if (effectiveSpecs) {
            mergedSpecs += (mergedSpecs ? '<hr class="my-6 border-slate-200">' : '') + `<h4 class="text-lg font-bold text-slate-800 mb-3">Especificações: ${prodData.name}</h4><div>${effectiveSpecs}</div>`;
          }
          
          // Imagens diretamente da VPS
          let parsedImages = prodData.images;
          if (typeof parsedImages === 'string') {
              try { parsedImages = JSON.parse(parsedImages); } catch { parsedImages = []; }
          }
          if (!Array.isArray(parsedImages)) parsedImages = [];

          const urlImages = parsedImages.filter((img: string) => typeof img === 'string' && !img.startsWith('data:'));
          const firstImage = urlImages.length > 0 ? urlImages[0] : parsedImages[0];
          
          if (firstImage) {
            autoImages.push(firstImage);
          }
        }
      }

      // Mantém imagens existentes do combo se auto-galeria não encontrar nenhuma
      let finalImages = editingCombo.images || [];
      if (!editingCombo.id || imageStyle === 'auto' || imageStyle === 'mosaic') {
        if (imageStyle === 'manual') {
          finalImages = [];
        } else if (autoImages.length > 0) {
          finalImages = autoImages; 
        }
      }

      let currentTags = editingCombo.tags || [];
      if (imageStyle === 'mosaic' && !currentTags.includes('mosaic_combo')) {
        currentTags.push('mosaic_combo');
      } else if (imageStyle !== 'mosaic') {
        currentTags = currentTags.filter(t => t !== 'mosaic_combo');
      }

      // Usa descrição manual se preenchida; senão usa a auto-gerada dos filhos
      const finalDescription = editingCombo.description?.trim() || mergedDescription;
      const finalTechSpecs = editingCombo.technical_specifications?.trim() || mergedSpecs;

      const offerItems = [
        ...editingCombo.combo_children.map(child => ({
        product: allProducts.find(p => p.id === child.id) || child,
        quantity: child.quantity,
        })),
        ...(editingCombo.combo_choice_groups || []).map(group => {
          const firstOption = group.options[0];
          return {
            product: allProducts.find(p => p.id === firstOption?.id) || firstOption || group,
            quantity: group.quantity,
          };
        }),
      ];
      const primaryItem = offerItems[0];
      const primaryProduct = primaryItem?.product as any;
      const offerType = editingCombo.offer_type || null;
      const autoOfferName = offerType === 'quantity_kit'
        ? `${primaryItem?.quantity || 1}x ${primaryProduct?.name || 'Produto'}`
        : `Kit ${[
            ...editingCombo.combo_children.map(c => c.name),
            ...(editingCombo.combo_choice_groups || []).map(group => group.label),
          ].filter(Boolean).join(' + ')}`;
      const autoOfferSku = offerType
        ? buildDefaultOfferSku(
            primaryProduct?.sku || editingCombo.sku,
            offerType,
            primaryItem?.quantity || 1,
            [
              ...editingCombo.combo_children.map(c => c.sku || c.name),
              ...(editingCombo.combo_choice_groups || []).map(group => group.label),
            ].filter(Boolean).join('-'),
          )
        : editingCombo.sku;
      const offerStrategy = isOffer
        ? (editingCombo.shopee_strategy || chooseShopeeOfferStrategy({
            existingDimensionCount: offerType === 'quantity_kit' ? 1 : 0,
            requestedOfferDimensionCount: 1,
          }))
        : null;
      const finalName = editingCombo.name?.trim() || autoOfferName;

      const payload = {
        ...editingCombo,
        is_combo: true,
        name: finalName,
        sku: editingCombo.sku?.trim() || autoOfferSku,
        slug: editingCombo.slug || generateSlug(finalName),
        description: finalDescription,
        technical_specifications: finalTechSpecs,
        images: finalImages,
        tags: currentTags,
        track_inventory: true,
        offer_type: offerType,
        offer_parent_product_id: isOffer ? primaryProduct?.id || null : null,
        offer_visibility: isOffer ? (editingCombo.offer_visibility || 'visible') : null,
        shopee_strategy: offerStrategy,
        weight_kg: packageValues.weight_kg,
        dimensions: {
            width_cm: packageValues.width_cm,
            height_cm: packageValues.height_cm,
            depth_cm: packageValues.depth_cm
        }
      };
      savePayload = payload;

      if (editingCombo.id) {
        saveAction = isOffer ? 'updateOffer' : 'updateCombo';
        saveResult = isOffer
          ? await vpsApiService.updateOffer(editingCombo.id, payload)
          : await vpsApiService.updateCombo(editingCombo.id, payload);
      } else {
        saveAction = isOffer ? 'createOffer' : 'createCombo';
        saveResult = isOffer
          ? await vpsApiService.createOffer(payload)
          : await vpsApiService.createCombo(payload);
      }

      if (saveResult && saveResult.ok) {
        toast.success(isOffer ? 'Oferta salva com sucesso!' : 'Combo salvo com sucesso!', { id: toastId });
        setIsModalOpen(false);
        setLastSaveDebug(null);
        loadData();
      } else {
        capturedDebug = buildComboSaveDebug({
          action: saveAction,
          payload,
          result: saveResult,
          editingCombo,
          componentCount,
        });
        if (captureSaveDebug) setLastSaveDebug(capturedDebug);
        const apiMessage = saveResult?.error || saveResult?.responseText || 'Retorno false da API';
        throw new Error(apiMessage);
      }
    } catch (e) {
      console.error(e);
      if (captureSaveDebug && !capturedDebug) {
        setLastSaveDebug(buildComboSaveDebug({
          action: saveAction,
          payload: savePayload,
          result: saveResult,
          error: e,
          editingCombo,
          componentCount,
        }));
      }
      const detail = e instanceof Error && e.message ? `: ${e.message.slice(0, 160)}` : '';
      toast.error(`Erro ao salvar combo${detail}`, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleCalculatePrices = () => {
    if (!editingCombo) return;
    let sumCost = 0;
    let sumRetail = 0;
    let sumReseller = 0;
    let sumWholesale = 0;

    editingCombo.combo_children.forEach(c => {
      const originalInfo = allProducts.find(p => p.id === c.id);
      if (originalInfo) {
        sumCost += (originalInfo.price_cost || 0) * c.quantity;
        sumRetail += (originalInfo.price_retail || 0) * c.quantity;
        sumReseller += (originalInfo.price_reseller || 0) * c.quantity;
        sumWholesale += (originalInfo.price_wholesale || 0) * c.quantity;
      }
    });
    (editingCombo.combo_choice_groups || []).forEach(group => {
      const optionPrices = group.options
        .map(option => allProducts.find(p => p.id === option.id) || option)
        .filter(Boolean);
      const reference = optionPrices.sort((a, b) => (a.price_retail || 0) - (b.price_retail || 0))[0];
      if (reference) {
        sumCost += (reference.price_cost || 0) * group.quantity;
        sumRetail += (reference.price_retail || 0) * group.quantity;
        sumReseller += (reference.price_reseller || 0) * group.quantity;
        sumWholesale += (reference.price_wholesale || 0) * group.quantity;
      }
    });

    let discount = 0;
    if (editingCombo.combo_discount_type === 'percentage') {
      discount = sumRetail * (editingCombo.combo_discount_value / 100);
    } else if (editingCombo.combo_discount_type === 'fixed') {
      discount = editingCombo.combo_discount_value * 100; // Assuming value is in Reais but we need centavos
    }

    const firstChild = editingCombo.combo_children[0];
    const firstProduct = firstChild ? (allProducts.find(p => p.id === firstChild.id) || firstChild) : null;
    const autoOfferName = editingCombo.offer_type === 'quantity_kit' && firstProduct
      ? `${firstChild.quantity}x ${firstProduct.name || 'Produto'}`
      : editingCombo.offer_type === 'product_combo'
        ? `Kit ${[
            ...editingCombo.combo_children.map(c => c.name),
            ...(editingCombo.combo_choice_groups || []).map(group => group.label),
          ].filter(Boolean).join(' + ')}`
        : editingCombo.name;
    const autoOfferSku = editingCombo.offer_type && firstProduct
      ? buildDefaultOfferSku(
          firstProduct.sku || editingCombo.sku,
          editingCombo.offer_type,
          firstChild.quantity,
          [
            ...editingCombo.combo_children.map(c => c.sku || c.name),
            ...(editingCombo.combo_choice_groups || []).map(group => group.label),
          ].filter(Boolean).join('-'),
        )
      : editingCombo.sku;

    setEditingCombo({
      ...editingCombo,
      name: editingCombo.name || autoOfferName,
      sku: editingCombo.sku || autoOfferSku,
      price_cost: sumCost,
      price_retail: Math.max(0, sumRetail - discount),
      price_reseller: Math.max(0, sumReseller - discount),
      price_wholesale: Math.max(0, sumWholesale - discount),
    });
    
    toast.success('Preços recalculados com base nos itens!');
  };

  const toComboChild = (prod: any, quantity = 1) => ({
    id: prod.id,
    name: prod.name,
    sku: prod.sku,
    quantity,
    price_retail: prod.price_retail,
    price_cost: prod.price_cost,
    price_reseller: prod.price_reseller,
    price_wholesale: prod.price_wholesale,
    stock_quantity: prod.stock_quantity,
    weight_kg: prod.weight_kg,
    dimensions: prod.dimensions,
    bling_id: prod.bling_id,
    parent_id: prod.parent_id,
  });

  const addProductsToCombo = (products: any[]) => {
    if (!editingCombo) return;
    const validProducts = products.filter(Boolean);
    if (!validProducts.length) return;

    if (editingCombo.offer_type === 'quantity_kit') {
      const prod = validProducts[0];
      setEditingCombo({
        ...editingCombo,
        offer_parent_product_id: prod.parent_id || prod.id,
        combo_children: [toComboChild(prod, editingCombo.combo_children[0]?.quantity || 2)]
      });
      setChildSearchTerm('');
      setSelectedChildProductIds([]);
      return;
    }

    const existingIds = new Set(editingCombo.combo_children.map(c => c.id));
    const nextProducts = validProducts.filter(product => product.id && !existingIds.has(product.id));
    if (!nextProducts.length) {
      toast.info('Produtos selecionados ja estao no combo');
      return;
    }

    setEditingCombo({
      ...editingCombo,
      combo_children: [
        ...editingCombo.combo_children,
        ...nextProducts.map(product => toComboChild(product))
      ]
    });
    setSelectedChildProductIds([]);
  };

  const addChoiceGroupToCombo = (parentProduct: any, options: any[]) => {
    if (!editingCombo) return;
    const validOptions = options.filter(option => option?.id);
    if (!validOptions.length) return;
    const parentId = String(validOptions[0]?.parent_id || parentProduct?.parent_id || parentProduct?.id || validOptions[0].id);
    const groupKey = validOptions[0]?.parent_id || parentProduct?.parent_id
      ? `parent:${parentId}`
      : getComboFamilyKey(parentProduct || validOptions[0]);
    const existingGroups = editingCombo.combo_choice_groups || [];
    if (existingGroups.some(group => group.group_key === groupKey || group.parent_product_id === parentId)) {
      toast.info('Esta familia ja esta como grupo de escolha do combo');
      return;
    }

    setEditingCombo({
      ...editingCombo,
      combo_children: editingCombo.combo_children.filter(child => !isSameComboFamily(child, parentProduct || validOptions[0])),
      combo_choice_groups: [
        ...existingGroups,
        {
          group_key: groupKey,
          parent_product_id: parentId,
          label: getComboFamilyBaseName(parentProduct) || parentProduct?.name || validOptions[0].name || 'Escolha uma opcao',
          quantity: 1,
          options: validOptions.map(option => toComboChild(option)),
        },
      ],
    });
  };

  const clearComboSearch = () => {
    setChildSearchTerm('');
    setChildSearchResults([]);
    setSelectedChildProductIds([]);
  };

  const addChildProduct = (prod: any) => {
    if (!editingCombo) return;
    addProductsToCombo([prod]);
    clearComboSearch();
  };

  const handleToggleSearchProductSelection = (product: any) => {
    if (!editingCombo) return;
    const isAlreadyInCombo = editingCombo.combo_children.some(child => child.id === product.id);
    if (isAlreadyInCombo) {
      removeChild(product.id);
      return;
    }
    addProductsToCombo([product]);
  };

  const handleAddSelectedProducts = () => {
    const selectedProducts = filteredProductsToSelect.filter(product => selectedChildProductIds.includes(product.id));
    addProductsToCombo(selectedProducts);
    clearComboSearch();
  };

  const handleAddProductFamily = async (product: any) => {
    const parentId = product.parent_id || product.id;
    const toastId = toast.loading('Carregando familia do produto...');
    try {
      const rows = await vpsApiService.getProductsByParentId(parentId);
      let family = (rows || []).filter(item => !item.is_combo && !item.offer_type);

      if (family.length <= 1) {
        const baseName = getComboFamilyBaseName(product);
        const fallbackRows = baseName
          ? await vpsApiService.getProducts({ search: baseName, status: 'all', limit: 120, noCache: true })
          : [];
        family = (fallbackRows || [])
          .filter(item => !item.is_combo && !item.offer_type && isSameComboFamily(item, product));
      }

      const productsToAdd = preferVariationOptions(family.length > 0 ? family : [product]);

      setAllProducts(prev => {
        const merged = new Map(prev.map(item => [item.id, item]));
        productsToAdd.forEach(item => merged.set(item.id, { ...(merged.get(item.id) || {}), ...item }));
        return Array.from(merged.values());
      });

      addChoiceGroupToCombo(product, productsToAdd);
      clearComboSearch();
      toast.success(productsToAdd.length > 0 ? `Grupo de escolha criado com ${productsToAdd.length} opcao(oes)` : 'Grupo de escolha criado', { id: toastId });
    } catch {
      toast.error('Nao foi possivel carregar as variacoes do produto', { id: toastId });
    }
  };

  const updateChildQuantity = (id: string, qty: number) => {
    if (!editingCombo || qty < 1) return;
    setEditingCombo({
      ...editingCombo,
      combo_children: editingCombo.combo_children.map(c => c.id === id ? { ...c, quantity: qty } : c)
    });
  };

  const removeChild = (id: string) => {
    if (!editingCombo) return;
    setEditingCombo({
      ...editingCombo,
      combo_children: editingCombo.combo_children.filter(c => c.id !== id)
    });
  };

  const updateChoiceGroupQuantity = (groupKey: string, qty: number) => {
    if (!editingCombo || qty < 1) return;
    setEditingCombo({
      ...editingCombo,
      combo_choice_groups: (editingCombo.combo_choice_groups || []).map(group =>
        group.group_key === groupKey ? { ...group, quantity: qty } : group
      ),
    });
  };

  const removeChoiceGroup = (groupKey: string) => {
    if (!editingCombo) return;
    setEditingCombo({
      ...editingCombo,
      combo_choice_groups: (editingCombo.combo_choice_groups || []).filter(group => group.group_key !== groupKey),
    });
  };

  const filteredCombos = useMemo(() => {
    return combos.filter(c => {
      if (viewMode === 'offers' && !c.offer_type) return false;
      if (viewMode === 'combos' && c.offer_type) return false;
      return c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [combos, searchTerm, viewMode]);

  const filteredProductsToSelect = useMemo(() => {
    if (!childSearchTerm) return [];
    const term = childSearchTerm.toLowerCase();
    const merged = new Map<string, any>();
    [...childSearchResults, ...allProducts].forEach(product => {
      if (!product?.id || product.is_combo || product.offer_type) return;
      const matches = product.name?.toLowerCase().includes(term) || product.sku?.toLowerCase().includes(term);
      if (matches) merged.set(product.id, product);
    });
    return Array.from(merged.values());
  }, [allProducts, childSearchResults, childSearchTerm]);

  const filteredProductFamiliesToSelect = useMemo(() => {
    const productById = new Map<string, any>();
    [...allProducts, ...childSearchResults].forEach(product => {
      if (product?.id) productById.set(String(product.id), product);
    });

    const groups = new Map<string, { parentId: string; parent: any; matches: any[] }>();
    filteredProductsToSelect.forEach(product => {
      const familyKey = getComboFamilyKey(product);
      const current = groups.get(familyKey) || {
        parentId: familyKey,
        parent: product.parent_id ? (productById.get(String(product.parent_id)) || product) : product,
        matches: [],
      };
      current.matches.push(product);
      if (product.is_parent || !/\s+cor\s*:/i.test(String(product.name || ''))) current.parent = product;
      groups.set(familyKey, current);
    });

    return Array.from(groups.values())
      .filter(group => group.matches.length > 1 || Boolean(group.parent?.parent_id) || group.parent?.is_parent)
      .sort((a, b) => (a.parent?.name || '').localeCompare(b.parent?.name || ''));
  }, [allProducts, childSearchResults, filteredProductsToSelect]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/products')}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Package className="text-teal-600" />
              Kits, Ofertas & Combos
            </h1>
            <p className="text-sm text-slate-500 mt-1">Crie pacotes para o site e ofertas que podem refletir na Shopee</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openNewOfferModal}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors shadow-sm"
          >
            <Store size={20} />
            <span className="font-medium">Nova Oferta</span>
          </button>
          <button
            onClick={openNewComboModal}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
          >
            <Plus size={20} />
            <span className="font-medium">Novo Combo</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar kits, ofertas ou combos..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'offers', label: 'Ofertas' },
              { id: 'combos', label: 'Combos' },
            ].map(option => (
              <button
                key={option.id}
                onClick={() => setViewMode(option.id as typeof viewMode)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === option.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Carregando...</div>
        ) : filteredCombos.length === 0 ? (
          <div className="p-8 text-center text-slate-400 flex flex-col items-center">
            <Package size={48} className="text-slate-200 mb-4" />
            <p className="text-lg font-medium text-slate-600">Nenhum registro encontrado</p>
            <p>Crie uma oferta para site/Shopee ou um combo interno.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                  <th className="p-4 font-semibold uppercase tracking-wider">Nome</th>
                  <th className="p-4 font-semibold uppercase tracking-wider">SKU</th>
                  <th className="p-4 font-semibold uppercase tracking-wider">Tipo</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-right">Preço (Varejo)</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-right">Desconto Config</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-center">Estoque Estimado</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-center">Shopee</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-center">Status</th>
                  <th className="p-4 font-semibold uppercase tracking-wider w-20">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCombos.map(combo => (
                  <tr key={combo.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-800">
                      <a
                        href={`/produto/${combo.slug || combo.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline hover:text-blue-600 transition-colors"
                        title="Ver página do combo na loja"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {combo.name}
                      </a>
                    </td>
                    <td className="p-4 text-slate-500 text-sm whitespace-nowrap">{combo.sku || '-'}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                        combo.offer_type ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700'
                      }`}>
                        {combo.offer_type === 'quantity_kit' ? 'Kit qtd.' : combo.offer_type === 'product_combo' ? 'Oferta combo' : 'Combo'}
                      </span>
                    </td>
                    <td className="p-4 text-right font-medium text-teal-700">
                      {formatCurrency(combo.price_retail)}
                    </td>
                    <td className="p-4 text-right text-sm text-slate-500">
                      {combo.combo_discount_value ? (combo.combo_discount_type === 'percentage' ? `${combo.combo_discount_value}%` : formatCurrency(combo.combo_discount_value)) : '-'}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${combo.stock_quantity > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {combo.stock_quantity} un
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {combo.offer_type ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                          combo.shopee_strategy === 'variation' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <Store size={12} />
                          {combo.shopee_strategy === 'variation' ? 'Variação' : 'Item separado'}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${combo.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {combo.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => openEditComboModal(combo)}
                        className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && editingCombo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold flex items-center gap-2">
                {editingCombo.offer_type ? <Store className="text-orange-600" /> : <Package className="text-teal-600" />}
                {editingCombo.id ? (editingCombo.offer_type ? 'Editar Oferta' : 'Editar Combo') : (editingCombo.offer_type ? 'Nova Oferta' : 'Novo Combo')}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-8">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">{editingCombo.offer_type ? 'Nome da Oferta' : 'Nome do Combo'}</label>
                  <input
                    type="text"
                    value={editingCombo.name}
                    onChange={e => setEditingCombo({ ...editingCombo, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Ex: Kit 2x iPhone"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">{editingCombo.offer_type ? 'SKU da Oferta' : 'SKU do Combo'}</label>
                  <input
                    type="text"
                    value={editingCombo.sku}
                    onChange={e => setEditingCombo({ ...editingCombo, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Offer Mode */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Tipo de registro</h3>
                    <p className="text-xs text-slate-500 mt-1">Oferta aparece no site e fica preparada para sincronizar com a Shopee.</p>
                  </div>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                    {[
                      { id: null, label: 'Combo interno' },
                      { id: 'quantity_kit', label: 'Kit de quantidade' },
                      { id: 'product_combo', label: 'Oferta combo' },
                    ].map(option => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => setEditingCombo({
                          ...editingCombo,
                          offer_type: option.id as ProductOfferType | null,
                          offer_visibility: option.id ? (editingCombo.offer_visibility || 'visible') : undefined,
                          shopee_strategy: option.id ? (editingCombo.shopee_strategy || 'variation') : undefined,
                        })}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          editingCombo.offer_type === option.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {editingCombo.offer_type && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Estoque oferta</p>
                      <p className={`mt-1 text-xl font-bold ${editingOfferStock > 0 ? 'text-green-700' : 'text-red-600'}`}>{editingOfferStock} un</p>
                    </div>
                    <label className="rounded-lg border border-slate-200 bg-white p-3">
                      <span className="text-xs font-semibold uppercase text-slate-500">Vitrine site</span>
                      <select
                        value={editingCombo.offer_visibility || 'visible'}
                        onChange={e => setEditingCombo({ ...editingCombo, offer_visibility: e.target.value as ProductOfferVisibility })}
                        className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                      >
                        <option value="visible">Visível</option>
                        <option value="hidden">Oculto</option>
                      </select>
                    </label>
                    <label className="rounded-lg border border-slate-200 bg-white p-3">
                      <span className="text-xs font-semibold uppercase text-slate-500">Shopee</span>
                      <select
                        value={editingCombo.shopee_strategy || 'variation'}
                        onChange={e => setEditingCombo({ ...editingCombo, shopee_strategy: e.target.value as ProductOfferShopeeStrategy })}
                        className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                      >
                        <option value="variation">Variação no anúncio</option>
                        <option value="separate_item">Anúncio separado</option>
                      </select>
                    </label>
                    <div className={`rounded-lg border p-3 ${editingOfferHasMissingBling ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
                      <p className="text-xs font-semibold uppercase">Bling</p>
                      <p className="mt-2 text-sm font-medium">{editingOfferHasMissingBling ? 'Há item sem vínculo' : 'Itens vinculados'}</p>
                    </div>
                  </div>
                  )}
              </div>

              {/* Package */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Embalagem do kit</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Valores usados para frete, Shopee e peso/dimensao do produto gerado.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      packageMode === 'manual' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {packageMode === 'manual' ? 'Editado manualmente' : 'Calculado pelos itens'}
                    </span>
                    <button
                      type="button"
                      onClick={handleRecalculatePackageFromItems}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Recalcular pelos itens
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <label>
                    <span className="block text-xs font-semibold uppercase text-slate-500 mb-1">Peso (kg)</span>
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={packageValues.weight_kg}
                      onChange={e => handlePackageFieldChange('weight_kg', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </label>
                  <label>
                    <span className="block text-xs font-semibold uppercase text-slate-500 mb-1">Comprimento (cm)</span>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      value={packageValues.depth_cm}
                      onChange={e => handlePackageFieldChange('depth_cm', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </label>
                  <label>
                    <span className="block text-xs font-semibold uppercase text-slate-500 mb-1">Largura (cm)</span>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      value={packageValues.width_cm}
                      onChange={e => handlePackageFieldChange('width_cm', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </label>
                  <label>
                    <span className="block text-xs font-semibold uppercase text-slate-500 mb-1">Altura (cm)</span>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      value={packageValues.height_cm}
                      onChange={e => handlePackageFieldChange('height_cm', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </label>
                </div>
              </div>

              {/* Combo Image Style */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Estilo Visual das Imagens (Vitrine)</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div 
                    onClick={() => setImageStyle('auto')}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${imageStyle === 'auto' ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-teal-300'}`}
                  >
                    <p className="font-semibold text-sm text-slate-800">Auto-Galeria</p>
                    <p className="text-xs text-slate-500 mt-1">Soma as fotos principais de cada item e mostra num carrossel tradicional.</p>
                  </div>
                  <div 
                    onClick={() => setImageStyle('mosaic')}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${imageStyle === 'mosaic' ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-teal-300'}`}
                  >
                    <p className="font-semibold text-sm text-slate-800">Mosaico CSS</p>
                    <p className="text-xs text-slate-500 mt-1">A capa do produto será formada dinamicamente juntando até 4 fotos lado a lado.</p>
                  </div>
                  <div 
                    onClick={() => setImageStyle('manual')}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${imageStyle === 'manual' ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-teal-300'}`}
                  >
                    <p className="font-semibold text-sm text-slate-800">Personalizado / Manual</p>
                    <p className="text-xs text-slate-500 mt-1">Sem imagens automáticas. Você subirá uma arte pronta depois pelo banco de imagens.</p>
                  </div>
                </div>
              </div>

              {/* Descrição Manual */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700">Descrição do Produto (Vitrine)</label>
                  <span className="text-xs text-slate-400">Deixe em branco para gerar automaticamente dos itens ao salvar</span>
                </div>
                <textarea
                  rows={5}
                  value={editingCombo.description || ''}
                  onChange={e => setEditingCombo({ ...editingCombo, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-mono resize-y"
                  placeholder="Descreva o combo... ou deixe em branco para gerar automaticamente."
                />
              </div>

              {/* Composition */}
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">
                  {editingCombo.offer_type === 'quantity_kit' ? 'Produto base do kit' : 'Itens do Combo'}
                </h3>

                <div className="mb-4 rounded-xl border border-teal-100 bg-teal-50/70 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {editingCombo.combo_children.length} item(ns) fixo(s) e {(editingCombo.combo_choice_groups || []).length} grupo(s) de escolha
                      </p>
                      <p className="text-xs text-slate-500">
                        Item fixo entra sempre no combo. Familia vira escolha para o cliente selecionar uma variacao.
                      </p>
                    </div>
                    {editingCombo.combo_children.length > 0 && (
                      <button
                        type="button"
                        onClick={handleCalculatePrices}
                        className="rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                      >
                        Atualizar valores
                      </button>
                    )}
                  </div>
                  {editingCombo.combo_children.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Itens fixos</p>
                      {editingCombo.combo_children.map(child => (
                        <div key={child.id} className="flex items-center justify-between gap-3 rounded-lg border border-teal-100 bg-white p-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800">{child.name}</p>
                            <p className="text-xs text-slate-500">{child.sku} • {formatCurrency(child.price_retail || 0)}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                              Qtd:
                              <input
                                type="number"
                                min="1"
                                value={child.quantity}
                                onChange={e => updateChildQuantity(child.id, parseInt(e.target.value) || 1)}
                                className="w-16 rounded border border-slate-300 px-2 py-1 text-center text-sm"
                              />
                            </label>
                            <button type="button" onClick={() => removeChild(child.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-teal-200 bg-white/70 p-3 text-center text-sm text-slate-500">
                      {editingCombo.offer_type === 'quantity_kit' ? 'Escolha o produto base do kit.' : 'Nenhum produto incluído ainda.'}
                    </div>
                  )}
                  {(editingCombo.combo_choice_groups || []).length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Grupos de escolha</p>
                      {(editingCombo.combo_choice_groups || []).map(group => (
                        <div key={group.group_key} className="rounded-lg border border-orange-100 bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-800">{group.label}</p>
                              <p className="text-xs text-slate-500">
                                Cliente escolhe {group.quantity} de {group.options.length} opcao(oes). Estoque considerado pela soma das variacoes.
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                                Qtd:
                                <input
                                  type="number"
                                  min="1"
                                  value={group.quantity}
                                  onChange={e => updateChoiceGroupQuantity(group.group_key, parseInt(e.target.value) || 1)}
                                  className="w-16 rounded border border-slate-300 px-2 py-1 text-center text-sm"
                                />
                              </label>
                              <button type="button" onClick={() => removeChoiceGroup(group.group_key)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {group.options.slice(0, 10).map(option => (
                              <span key={option.id} className="rounded-full border border-orange-100 bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-800">
                                {option.sku || option.name}
                              </span>
                            ))}
                            {group.options.length > 10 && (
                              <span className="rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                +{group.options.length - 10}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Search & Add Child */}
                <div className="mb-4 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder={editingCombo.offer_type === 'quantity_kit' ? 'Buscar produto base para o kit...' : 'Buscar produto para adicionar ao combo...'}
                      value={childSearchTerm}
                      onChange={e => setChildSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  {childSearchTerm && (
                    <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
                      {childSearchLoading ? (
                        <div className="p-3 text-sm text-slate-500 text-center">Buscando produtos...</div>
                      ) : filteredProductsToSelect.length === 0 ? (
                        <div className="p-3 text-sm text-slate-500 text-center">Nenhum produto encontrado.</div>
                      ) : (
                        <>
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-3 py-2 border-b border-slate-100">
                            <span className="text-xs font-semibold text-slate-500">
                              {filteredProductsToSelect.length} resultado(s) encontrados
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                addProductsToCombo(filteredProductsToSelect);
                                clearComboSearch();
                              }}
                              disabled={filteredProductsToSelect.length === 0}
                              className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              Incluir todos visíveis
                            </button>
                          </div>
                          {filteredProductFamiliesToSelect.length > 0 && (
                            <div className="border-b border-orange-100 bg-orange-50/60">
                              <div className="px-3 pt-3 pb-2 text-xs font-bold uppercase tracking-wide text-orange-700">
                                Famílias encontradas
                              </div>
                              <div className="space-y-2 px-3 pb-3">
                                {filteredProductFamiliesToSelect.map(group => (
                                  <div
                                    key={group.parentId}
                                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-lg border border-orange-100 bg-white p-3"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-slate-900">{group.parent?.name || group.matches[0]?.name}</p>
                                      <p className="text-xs text-slate-500">
                                        PAI: {group.parent?.sku || group.matches[0]?.sku || group.parentId} • {group.matches.length} item(ns) encontrado(s) na busca
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleAddProductFamily(group.parent || group.matches[0])}
                                      className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
                                    >
                                      Selecionar PAI como escolha
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="divide-y divide-slate-100">
                            {filteredProductsToSelect.map(p => (
                              <div
                                key={p.id}
                                className="p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-slate-50"
                              >
                                <label className="flex min-w-0 flex-1 items-start gap-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editingCombo.combo_children.some(child => child.id === p.id)}
                                    onChange={() => handleToggleSearchProductSelection(p)}
                                    className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                  />
                                  <span className="min-w-0">
                                    <span className="block font-semibold text-sm text-slate-900">{p.name}</span>
                                    <span className="block text-xs text-slate-500">{p.sku}</span>
                                  </span>
                                </label>
                                <div className="flex items-center justify-between md:justify-end gap-3">
                                  <div className="text-right">
                                    <p className="text-sm font-semibold text-teal-700">{formatCurrency(p.price_retail)}</p>
                                    <p className="text-xs text-slate-400">Estoque: {p.stock_quantity}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => addChildProduct(p)}
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"
                                  >
                                    Adicionar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddProductFamily(p)}
                                    className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100"
                                  >
                                    Familia como escolha
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

              </div>

              {/* Pricing Config */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-800">Preços & Descontos</h3>
                  <button
                    onClick={handleCalculatePrices}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm text-slate-700"
                  >
                    <Calculator size={16} />
                    Auto-Calcular
                  </button>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Tipo Desconto</label>
                    <select
                      value={editingCombo.combo_discount_type || 'percentage'}
                      onChange={e => setEditingCombo({ ...editingCombo, combo_discount_type: e.target.value as any })}
                      className="w-full p-2 border border-slate-300 rounded text-sm"
                    >
                      <option value="percentage">Porcentagem (%)</option>
                      <option value="fixed">Reais (R$)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Valor do Desconto</label>
                    <input
                      type="number"
                      step={editingCombo.combo_discount_type === 'percentage' ? '1' : '0.01'}
                      value={editingCombo.combo_discount_value}
                      onChange={e => setEditingCombo({ ...editingCombo, combo_discount_value: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2 border border-slate-300 rounded text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Custo (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={(editingCombo.price_cost / 100).toFixed(2)}
                      onChange={e => setEditingCombo({ ...editingCombo, price_cost: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                      className="w-full p-2 border border-slate-300 rounded text-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-teal-600 uppercase mb-1">Varejo (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={(editingCombo.price_retail / 100).toFixed(2)}
                      onChange={e => setEditingCombo({ ...editingCombo, price_retail: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                      className="w-full p-2 border border-green-300 bg-green-50 rounded text-sm font-bold text-green-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Revenda (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={(editingCombo.price_reseller / 100).toFixed(2)}
                      onChange={e => setEditingCombo({ ...editingCombo, price_reseller: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                      className="w-full p-2 border border-slate-300 rounded text-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Atacado (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={(editingCombo.price_wholesale / 100).toFixed(2)}
                      onChange={e => setEditingCombo({ ...editingCombo, price_wholesale: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                      className="w-full p-2 border border-slate-300 rounded text-sm font-medium"
                    />
                  </div>
                </div>
              </div>

            </div>
            
            <div className="sticky bottom-0 bg-white border-t border-slate-100 p-4 flex flex-col gap-3 rounded-b-2xl md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={captureSaveDebug}
                    onChange={event => setCaptureSaveDebug(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  Capturar debug
                </label>
                {lastSaveDebug && (
                  <button
                    type="button"
                    onClick={copyLastSaveDebug}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                  >
                    <Clipboard size={16} />
                    Copiar debug
                  </button>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveCombo}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  <Save size={20} />
                  {saving ? 'Gravando...' : (editingCombo.offer_type ? 'Salvar Oferta' : 'Salvar Combo')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
