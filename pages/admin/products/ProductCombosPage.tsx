import React, { useState, useEffect, useMemo } from 'react';
import { Package, Plus, Search, Trash2, Edit2, ChevronLeft, Save, X, Calculator } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { vpsApiService } from '../../../services/vpsApiService';
import { supabase } from '../../../services/supabase';
import { formatCurrency } from '../../../utils/saleCalculations';

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
  combo_children: Array<{
    id: string;
    quantity: number;
    name?: string;
    sku?: string;
    price_retail?: number;
    stock_quantity?: number;
  }>;
  description?: string;
  technical_specifications?: string;
  tags?: string[];
  images?: string[];
  slug?: string;
}

const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
};

export const ProductCombosPage: React.FC = () => {
  const navigate = useNavigate();
  const [combos, setCombos] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<ProductComboFormData | null>(null);
  const [saving, setSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [childSearchTerm, setChildSearchTerm] = useState('');
  const [imageStyle, setImageStyle] = useState<'auto' | 'mosaic' | 'manual'>('auto');

  const loadData = async () => {
    setLoading(true);
    try {
      const prods = await vpsApiService.getProducts({ noCache: true, limit: 9999 });
      if (prods) {
        setAllProducts(prods.filter(p => !p.is_combo));
        setCombos(prods.filter(p => p.is_combo));
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

  const openNewComboModal = () => {
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
      combo_children: [],
      tags: []
    });
    setImageStyle('auto');
    setIsModalOpen(true);
  };

  const openEditComboModal = async (combo: any) => {
    const toastId = toast.loading('Carregando itens do combo...');
    try {
      const [children, supaResult] = await Promise.all([
        vpsApiService.getComboChildren(combo.id),
        supabase.from('products').select('description, technical_specifications').eq('id', combo.id).maybeSingle()
      ]);

      // Prioriza description do Supabase (fonte primária), fallback para a VPS
      const savedDescription = supaResult.data?.description || combo.description || '';
      const savedTechSpecs = supaResult.data?.technical_specifications || combo.technical_specifications || '';

      setEditingCombo({
        ...combo,
        combo_discount_type: combo.combo_discount_type || 'percentage',
        combo_discount_value: combo.combo_discount_value || 0,
        combo_children: children?.map(c => ({
          id: c.id,
          name: c.name,
          sku: c.sku,
          quantity: c.quantity,
          price_retail: c.price_retail,
          stock_quantity: c.stock_quantity
        })) || [],
        tags: combo.tags || [],
        description: savedDescription,
        technical_specifications: savedTechSpecs,
      });
      setImageStyle(combo.tags?.includes('mosaic_combo') ? 'mosaic' : 'auto');
      setIsModalOpen(true);
      toast.dismiss(toastId);
    } catch (e) {
      toast.error('Erro ao carregar detalhes', { id: toastId });
    }
  };

  const handleSaveCombo = async () => {
    if (!editingCombo) return;
    if (!editingCombo.name) return toast.error('Nome do combo é obrigatório');
    if (!editingCombo.combo_children || editingCombo.combo_children.length === 0) {
      return toast.error('Adicione pelo menos um produto ao combo');
    }

    setSaving(true);
    const toastId = toast.loading('Salvando combo...');
    
    try {
      let total_weight_kg = 0;
      let total_width = 0;
      let total_height = 0;
      let total_depth = 0;
      let mergedDescription = '';
      let mergedSpecs = '';
      let autoImages: string[] = [];

      // Buscando dados enriquecidos diretamente da VPS (já pré-carregados no allProducts e vpsApiService)
      for (const c of editingCombo.combo_children) {
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
          total_weight_kg += (prodData.weight_kg || 0) * c.quantity;
          if (prodData.dimensions) {
            total_height += (prodData.dimensions.height_cm || 0) * c.quantity;
            total_width = Math.max(total_width, prodData.dimensions.width_cm || 0);
            total_depth = Math.max(total_depth, prodData.dimensions.depth_cm || 0);
          }
          
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

      const payload = {
        ...editingCombo,
        is_combo: true,
        slug: editingCombo.slug || generateSlug(editingCombo.name),
        description: finalDescription,
        technical_specifications: finalTechSpecs,
        images: finalImages,
        tags: currentTags,
        weight_kg: total_weight_kg || 0.3,
        dimensions: {
            width_cm: total_width || 15,
            height_cm: total_height || 10,
            depth_cm: total_depth || 20
        }
      };

      let res;
      if (editingCombo.id) {
        res = await vpsApiService.updateCombo(editingCombo.id, payload);
      } else {
        res = await vpsApiService.createCombo(payload);
      }

      if (res && res.ok) {
        toast.success('Combo salvo com sucesso!', { id: toastId });
        setIsModalOpen(false);
        loadData();
      } else {
        throw new Error('Retorno false da API');
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar combo', { id: toastId });
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

    let discount = 0;
    if (editingCombo.combo_discount_type === 'percentage') {
      discount = sumRetail * (editingCombo.combo_discount_value / 100);
    } else if (editingCombo.combo_discount_type === 'fixed') {
      discount = editingCombo.combo_discount_value * 100; // Assuming value is in Reais but we need centavos
    }

    setEditingCombo({
      ...editingCombo,
      price_cost: sumCost,
      price_retail: Math.max(0, sumRetail - discount),
      price_reseller: Math.max(0, sumReseller - discount),
      price_wholesale: Math.max(0, sumWholesale - discount),
    });
    
    toast.success('Preços recalculados com base nos itens!');
  };

  const addChildProduct = (prod: any) => {
    if (!editingCombo) return;
    const exists = editingCombo.combo_children.find(c => c.id === prod.id);
    if (exists) {
      toast.info('Produto já está no combo');
      return;
    }
    setEditingCombo({
      ...editingCombo,
      combo_children: [
        ...editingCombo.combo_children,
        { id: prod.id, name: prod.name, sku: prod.sku, quantity: 1, price_retail: prod.price_retail, stock_quantity: prod.stock_quantity }
      ]
    });
    setChildSearchTerm('');
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

  const filteredCombos = useMemo(() => {
    return combos.filter(c => c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.sku?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [combos, searchTerm]);

  const filteredProductsToSelect = useMemo(() => {
    if (!childSearchTerm) return [];
    const term = childSearchTerm.toLowerCase();
    return allProducts.filter(p => p.name?.toLowerCase().includes(term) || p.sku?.toLowerCase().includes(term)).slice(0, 20);
  }, [allProducts, childSearchTerm]);

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
              Kits & Combos
            </h1>
            <p className="text-sm text-slate-500 mt-1">Crie pacotes de produtos sincronizados com o estoque real</p>
          </div>
        </div>
        <button
          onClick={openNewComboModal}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
        >
          <Plus size={20} />
          <span className="font-medium">Novo Combo</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-100">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar combos..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Carregando...</div>
        ) : filteredCombos.length === 0 ? (
          <div className="p-8 text-center text-slate-400 flex flex-col items-center">
            <Package size={48} className="text-slate-200 mb-4" />
            <p className="text-lg font-medium text-slate-600">Nenhum combo encontrado</p>
            <p>Crie um pacote de produtos para oferecer descontos agregados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                  <th className="p-4 font-semibold uppercase tracking-wider">Nome</th>
                  <th className="p-4 font-semibold uppercase tracking-wider">SKU</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-right">Preço (Varejo)</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-right">Desconto Config</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-center">Estoque Estimado</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-center">Status</th>
                  <th className="p-4 font-semibold uppercase tracking-wider w-20">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCombos.map(combo => (
                  <tr key={combo.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-800">{combo.name}</td>
                    <td className="p-4 text-slate-500 text-sm whitespace-nowrap">{combo.sku || '-'}</td>
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
                <Package className="text-teal-600" />
                {editingCombo.id ? 'Editar Combo' : 'Novo Combo'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-8">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nome do Combo</label>
                  <input
                    type="text"
                    value={editingCombo.name}
                    onChange={e => setEditingCombo({ ...editingCombo, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Ex: Kit 2x iPhone"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">SKU do Combo</label>
                  <input
                    type="text"
                    value={editingCombo.sku}
                    onChange={e => setEditingCombo({ ...editingCombo, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
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
                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Itens do Combo</h3>
                
                {/* Search & Add Child */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Buscar produto para adicionar ao combo..."
                    value={childSearchTerm}
                    onChange={e => setChildSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                  {childSearchTerm && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                      {filteredProductsToSelect.length === 0 ? (
                        <div className="p-3 text-sm text-slate-500 text-center">Nenhum produto encontrado.</div>
                      ) : (
                        filteredProductsToSelect.map(p => (
                          <div
                            key={p.id}
                            onClick={() => addChildProduct(p)}
                            className="p-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer border-b last:border-0 border-slate-100"
                          >
                            <div>
                              <p className="font-semibold text-sm">{p.name}</p>
                              <p className="text-xs text-slate-500">{p.sku}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-teal-700">{formatCurrency(p.price_retail)}</p>
                              <p className="text-xs text-slate-400">Estoque: {p.stock_quantity}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Selected Children */}
                {editingCombo.combo_children.length > 0 ? (
                  <div className="space-y-2">
                    {editingCombo.combo_children.map(child => (
                      <div key={child.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-slate-800">{child.name}</p>
                          <p className="text-xs text-slate-500">{child.sku} • {formatCurrency(child.price_retail || 0)}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-slate-500">Qtd:</label>
                            <input
                              type="number"
                              min="1"
                              value={child.quantity}
                              onChange={e => updateChildQuantity(child.id, parseInt(e.target.value) || 1)}
                              className="w-16 px-2 py-1 border border-slate-300 rounded text-center text-sm"
                            />
                          </div>
                          <button onClick={() => removeChild(child.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg text-center text-slate-500 text-sm">
                    Nenhum produto adicionado ao combo ainda.
                  </div>
                )}
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
            
            <div className="sticky bottom-0 bg-white border-t border-slate-100 p-4 flex justify-end gap-3 rounded-b-2xl">
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
                {saving ? 'Gravando...' : 'Salvar Combo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
