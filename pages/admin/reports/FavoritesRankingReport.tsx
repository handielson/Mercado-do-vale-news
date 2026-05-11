import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Heart, Flame, RefreshCcw, Search, BarChart3, BellRing, ShoppingCart } from 'lucide-react';
import { vpsApiService } from '../../../services/vpsApiService';
import { formatCurrency } from '../../../utils/saleCalculations';

interface RankingItem {
  product_id: string;
  count: number;
  total_quantity?: number; // Só preenchido na aba Carrinhos
  name: string;
  sku: string;
  images: any[];
  price_retail: number;
  stock_quantity: number;
}

type TabType = 'favorites' | 'carts';

export const FavoritesRankingReport: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('favorites');
  const [items, setItems] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchRanking = async () => {
    setLoading(true);
    try {
      if (activeTab === 'favorites') {
        const data = await vpsApiService.getFavoritesRanking(100);
        setItems(data.map((d: any) => ({ ...d, count: d.favorite_count })));
      } else {
        const data = await vpsApiService.getCartsRanking(100);
        setItems(data.map((d: any) => ({ ...d, count: d.cart_count, total_quantity: d.total_quantity })));
      }
    } catch (err) {
      console.error('Failed to load ranking:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRanking();
  }, [activeTab]);

  const getImageUrl = (imgObj: any) => {
    if (!imgObj) return null;
    let url = typeof imgObj === 'string' ? imgObj : (imgObj.url || imgObj.path || null);
    if (url && !url.startsWith('http') && !url.startsWith('data:')) {
      return `${vpsApiService['baseUrl']}/images/${url.replace(/^[\\/]+/, '')}`;
    }
    return url;
  };

  const filteredItems = items.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (i.sku && i.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Flame className="w-8 h-8 text-orange-500" />
            Intenção de Compra
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Descubra quais são os produtos mais desejados e adicionados aos carrinhos.
          </p>
        </div>
        
        <button
          onClick={fetchRanking}
          disabled={loading}
          className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-750 flex items-center justify-center gap-2 font-medium transition-colors"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar Ranking
        </button>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 ${
            activeTab === 'favorites'
              ? 'border-b-2 border-red-500 text-red-600 dark:text-red-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('favorites')}
        >
          <Heart className="w-4 h-4" />
          Ranking de Favoritos
        </button>
        <button
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 ${
            activeTab === 'carts'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('carts')}
        >
          <ShoppingCart className="w-4 h-4" />
          Carrinhos Abandonados / Ativos
        </button>
      </div>

      {/* Rápido Dashboard / Informacional */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-rose-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className={`p-4 rounded-xl shadow-lg ${activeTab === 'favorites' ? 'bg-gradient-to-br from-pink-500 to-rose-500 shadow-pink-500/20' : 'bg-gradient-to-br from-blue-500 to-cyan-500 shadow-blue-500/20'}`}>
            {activeTab === 'favorites' ? <Heart className="w-8 h-8 text-white" /> : <ShoppingCart className="w-8 h-8 text-white" />}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {activeTab === 'favorites' ? 'Total de Curtidas' : 'Clientes com Itens'}
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {items.reduce((acc, curr) => acc + curr.count, 0)}
            </p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className={`p-4 rounded-xl shadow-lg ${activeTab === 'favorites' ? 'bg-gradient-to-br from-orange-500 to-red-500 shadow-orange-500/20' : 'bg-gradient-to-br from-blue-400 to-indigo-500 shadow-indigo-500/20'}`}>
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Produtos Ranqueados</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{items.length}</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-sm border border-indigo-500 p-6 flex items-center gap-4 text-white relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
            <BellRing className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-indigo-100">Campanha / Lançamento (Em Breve)</p>
            <p className="text-sm text-indigo-50 mt-1 leading-snug">
              Os alertas para {activeTab === 'favorites' ? 'produtos favoritados' : 'carrinhos'} chegam no nosso futuro App!
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        {/* Header e Busca */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {activeTab === 'favorites' ? 'Termômetro de Favoritos (Top 100)' : 'Carrinhos Atuais (Top 100)'}
          </h2>
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por nome ou SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full rounded-lg border-gray-300 bg-gray-50 text-gray-900 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-900 dark:border-gray-600 dark:text-white shadow-sm"
            />
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 uppercase font-medium">
              <tr>
                <th className="px-6 py-4">Ranking</th>
                <th className="px-6 py-4">Produto</th>
                <th className="px-6 py-4">SKU</th>
                <th className="px-6 py-4 text-center">{activeTab === 'favorites' ? 'Curtidas' : 'Clientes com Item'}</th>
                {activeTab === 'carts' && <th className="px-6 py-4 text-center">Unidades Totais</th>}
                <th className="px-6 py-4 text-right">Preço Venda</th>
                <th className="px-6 py-4 text-center">Estoque Atual</th>
                <th className="px-6 py-4">Ação Rápida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={activeTab === 'carts' ? 8 : 7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCcw className="w-6 h-6 animate-spin text-blue-500" />
                      <span>Processando {activeTab === 'favorites' ? 'corações' : 'carrinhos'}...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'carts' ? 8 : 7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    {searchTerm ? 'Nenhum modelo encontrado para sua busca.' : 'Você ainda não possui nenhum produto na lista.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => {
                  const medalColors = ['text-yellow-400', 'text-gray-400', 'text-amber-600'];
                  const isPodium = index < 3;
                  const medalColor = isPodium ? medalColors[index] : 'text-gray-400';
                  const imgUrl = item.images && item.images.length > 0 ? getImageUrl(item.images[0]) : null;

                  return (
                    <tr key={item.product_id} className="hover:bg-gray-50 dark:hover:bg-gray-750/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {isPodium ? (
                            <div className={`flex items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 font-bold ${medalColor}`}>
                              {index + 1}º
                            </div>
                          ) : (
                            <div className="flex items-center justify-center w-8 h-8 rounded-full text-gray-500 font-medium">
                              {index + 1}º
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 flex-shrink-0 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center border border-gray-200 dark:border-gray-600 pointer-events-none">
                            {imgUrl ? (
                              <img src={imgUrl} alt={item.name} className="w-full h-full object-contain" />
                            ) : (
                              <LayoutDashboard className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <span className="font-medium text-gray-900 dark:text-white line-clamp-1 max-w-[200px] sm:max-w-xs">{item.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400 font-mono">
                        {item.sku || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {activeTab === 'favorites' ? (
                            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                          ) : (
                            <ShoppingCart className="w-4 h-4 text-blue-500" />
                          )}
                          <span className="font-bold text-gray-900 dark:text-white text-base">
                            {item.count}
                          </span>
                        </div>
                      </td>
                      {activeTab === 'carts' && (
                        <td className="px-6 py-4 text-center font-medium">
                          {item.total_quantity || 0}
                        </td>
                      )}
                      <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">
                        {formatCurrency(item.price_retail || 0)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.stock_quantity > 0 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                          {item.stock_quantity} un
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <a 
                          href={`/admin/products?search=${item.sku}`}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium transition-colors"
                        >
                          Ver no Catálogo →
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FavoritesRankingReport;
