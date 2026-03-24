import React, { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Settings, Store, Users, ClipboardList, LogOut, Package, Tags, Shield, BadgeCheck, Smartphone, Palette, HardDrive, MemoryStick, GitBranch, BatteryCharging, FileText, BookOpen, CreditCard, ShoppingCart, Image, Database, Truck, MessageCircle, Ticket, Coins, Bot, Megaphone, Tag, MessageSquareDashed, Link2, Globe, Banknote, Search, Star, Rocket, Activity, Server } from 'lucide-react';

import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/cn';
import { usePageTitle } from '../hooks/usePageTitle';

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, customer, signOut } = useSupabaseAuth();
  const { settings } = useTheme();
  const location = useLocation();
  const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

  const [search, setSearch] = useState('');

  usePageTitle();

  const menuGroups = useMemo(() => [
    {
      title: 'Operacional',
      items: [
        { to: '/admin', icon: <LayoutDashboard size={18} />, label: 'Dashboard', keywords: 'inicio home painel' },
        { to: '/admin/pdv', icon: <ShoppingCart size={18} />, label: 'PDV', keywords: 'caixa venda rapida balcao' },
        { to: '/admin/sales', icon: <ShoppingBag size={18} />, label: 'Vendas', keywords: 'pedidos transacoes' },
        { to: '/admin/pedidos-online', icon: <Globe size={18} />, label: 'Pedidos Online', keywords: 'site web' },
        { to: '/admin/financeiro', icon: <Banknote size={18} />, label: 'Financeiro', keywords: 'dinheiro pagamentos taxas contas' },
        { to: '/admin/products', icon: <Package size={18} />, label: 'Produtos', keywords: 'catalogo itens mercadoria' },
        { to: '/admin/inventory', icon: <ClipboardList size={18} />, label: 'Estoque', keywords: 'quantidade inventario' },
        { to: '/admin/customers', icon: <Users size={18} />, label: 'Clientes', keywords: 'usuarios compradores' },
        { to: '/admin/team', icon: <Users size={18} />, label: 'Equipe', keywords: 'funcionarios vendedores' },
      ]
    },
    {
      title: 'Marketing & Loja',
      items: [
        { to: '/admin/settings/seo-analyzer', icon: <Search size={18} />, label: 'Análise de SEO', keywords: 'google analise indexacao' },
        { to: '/admin/settings/seo-blacklist', icon: <Globe size={18} />, label: 'Lista Negra SEO', keywords: 'bloquear google ocultar noindex' },
        { to: '/admin/promotions', icon: <Ticket size={18} />, label: 'Promoções', keywords: 'desconto oferta' },
        { to: '/admin/catalog-config', icon: <Settings size={18} />, label: 'Config. Catálogo', keywords: 'vitrine exibir' },
        { to: '/admin/settings/banners', icon: <Image size={18} />, label: 'Banners', keywords: 'imagens carrossel' },
        { to: '/admin/settings/marketing', icon: <Megaphone size={18} />, label: 'Criativos', keywords: 'anuncios divulgacao' },
        { to: '/admin/coupons', icon: <Ticket size={18} />, label: 'Cupons', keywords: 'codigo desconto' },
        { to: '/admin/cashback', icon: <Coins size={18} />, label: 'Moedas do Vale', keywords: 'cashback pontos fidelidade' },
        { to: '/admin/settings/whatsapp', icon: <MessageCircle size={18} />, label: 'WhatsApp', keywords: 'atendimento contato' },
        { to: '/admin/settings/telegram', icon: <Bot size={18} />, label: 'Automações Bot', keywords: 'robo respostas' },
        { to: '/admin/settings/messages', icon: <MessageCircle size={18} />, label: 'Mensagens Auto', keywords: 'automaticas template' },
        { to: '/admin/feedbacks', icon: <MessageSquareDashed size={18} />, label: 'Fale Conosco', keywords: 'SAC contato reclamacoes' },
        { to: '/admin/avaliacoes', icon: <Star size={18} />, label: 'Avaliações', keywords: 'estrelas reviews' },
      ]
    },
    {
      title: 'Estrutura de Catálogo',
      items: [
        { to: '/admin/settings/categories', icon: <Tags size={18} />, label: 'Categorias', keywords: 'departamentos sessoes' },
        { to: '/admin/settings/brands', icon: <BadgeCheck size={18} />, label: 'Marcas', keywords: 'fabricantes apple xiaomi' },
        { to: '/admin/settings/models', icon: <Smartphone size={18} />, label: 'Modelos', keywords: 'iphone s24' },
        { to: '/admin/settings/fields', icon: <FileText size={18} />, label: 'Campos Customizados', keywords: 'especificacoes atributos' },
        { to: '/admin/settings/system-tags', icon: <Tag size={18} />, label: 'Tags do Sistema', keywords: 'etiquetas lacrado vitrine' },
        { to: '/admin/settings/colors', icon: <Palette size={18} />, label: 'Cores', keywords: 'tinta azul preto' },
        { to: '/admin/settings/storages', icon: <HardDrive size={18} />, label: 'Armazenamento', keywords: 'capaciade gb tb' },
        { to: '/admin/settings/rams', icon: <MemoryStick size={18} />, label: 'Memória RAM', keywords: 'ram gb' },
        { to: '/admin/settings/versions', icon: <GitBranch size={18} />, label: 'Versões', keywords: 'global india china' },
        { to: '/admin/settings/battery-healths', icon: <BatteryCharging size={18} />, label: 'Saúde Bateria', keywords: 'porcentagem %' },
      ]
    },
    {
      title: 'Ajustes da Empresa',
      items: [
        { to: '/admin/settings/company', icon: <Settings size={18} />, label: 'Dados da Empresa', keywords: 'cnpj endereco horarios' },
        { to: '/admin/settings/bling', icon: <Link2 size={18} />, label: 'Bling', keywords: 'erp integracao' },
        { to: '/admin/settings/shopee', icon: <Store size={18} />, label: 'Shopee', keywords: 'shopee marketplace integracao loja api' },
        { to: '/admin/settings/shipping', icon: <Truck size={18} />, label: 'Frete', keywords: 'entrega correios transportadora' },
        { to: '/admin/settings/payment-fees', icon: <CreditCard size={18} />, label: 'Taxas', keywords: 'juros maquina cartao' },
        { to: '/admin/settings/integrations', icon: <Link2 size={18} />, label: 'Gateways Pagamento', keywords: 'mercado pago pagar.me stripe' },
        { to: '/admin/settings/documents', icon: <FileText size={18} />, label: 'Documentos', keywords: 'termos recibos' },
        { to: '/admin/settings/warranty-templates', icon: <Shield size={18} />, label: 'Garantias', keywords: 'padrao tempo meses' },
        { to: '/admin/settings/permissions', icon: <Shield size={18} />, label: 'Permissões', keywords: 'acesso regras', adminOnly: true },
      ]
    },
    {
      title: 'Sistema',
      items: [
        { to: '/admin/settings/vps-status', icon: <Activity size={18} />, label: 'Status VPS', keywords: 'servidor hostinger uptime' },
        { to: '/admin/settings/mysql', icon: <Database size={18} />, label: 'MySQL Explorer', keywords: 'banco dados query sql tables' },
        { to: '/admin/settings/synology-cdn', icon: <Server size={18} />, label: 'CDN Synology', keywords: 'arquivos imagens videos upload nas' },
        { to: '/admin/settings/roadmap', icon: <Rocket size={18} />, label: 'Roadmap & Docs', keywords: 'futuro documentacao novidades' },
        { to: '/admin/migration', icon: <Database size={18} />, label: 'Migração', keywords: 'supabase vps transferir' },
        { to: '/test-tabs', icon: <Tags size={18} />, label: '🧪 Teste de Abas', keywords: 'dev teste' },
      ]
    }
  ], []);

  // Filtra itens com base na busca
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return menuGroups;
    const term = search.toLowerCase();
    
    return menuGroups.map(group => {
      const filteredItems = group.items.filter(item => 
        item.label.toLowerCase().includes(term) || 
        item.keywords.includes(term)
      );
      return { ...group, items: filteredItems };
    }).filter(group => group.items.length > 0);
  }, [search, menuGroups]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {DEV_MODE && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black px-4 py-2 text-center text-sm font-bold z-[100] shadow-lg">
          🔧 MODO DESENVOLVIMENTO - Autenticação Mock Ativa
        </div>
      )}
      <aside className={cn(
        "w-full md:w-64 bg-slate-900 text-white p-6 space-y-4 md:sticky md:top-0 md:h-screen flex flex-col z-50 shadow-2xl overflow-y-auto",
        DEV_MODE ? "md:top-10 md:h-[calc(100vh-2.5rem)]" : ""
      )}>
        <div className="px-2 pb-2">
          <Link to="/" target="_blank" title="Ver Loja" className="block hover:opacity-80 transition-opacity">
            {settings.logo_dark || settings.logo_main ? (
              <img src={settings.logo_dark || settings.logo_main} alt={settings.company_name} className="h-10 object-contain" />
            ) : (
              <h1 className="text-xl font-bold tracking-tighter text-blue-400">
                {settings.company_name}
              </h1>
            )}
          </Link>
          <div className="flex items-center gap-1.5 mt-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              Painel: {customer?.customer_type || 'ADMIN'}
            </p>
          </div>
          
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Buscar no menu..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-xs rounded-lg py-2 pl-9 pr-3 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>
        </div>

        <nav className="space-y-1 flex-1 overflow-y-auto pr-2 -mr-2 pb-4">
          {filteredGroups.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              Nenhuma página encontrada.
            </div>
          ) : (
            filteredGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="mb-4">
                <div className="pt-2 pb-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-transparent">
                  {group.title}
                </div>
                {group.items.map((item, itemIndex) => {
                  if (item.adminOnly && customer?.customer_type !== 'ADMIN') return null;
                  
                  return (
                    <NavItem 
                      key={itemIndex}
                      to={item.to} 
                      icon={item.icon} 
                      label={item.label} 
                      active={location.pathname === item.to || (item.to !== '/admin' && location.pathname.startsWith(item.to))} 
                    />
                  );
                })}
              </div>
            ))
          )}
        </nav>

        {user && (
          <div className="pt-4 border-t border-slate-800">
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold shadow-lg">
                {customer?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-bold truncate leading-none text-white">{customer?.name || user?.email || 'Usuário'}</p>
                <p className="text-[10px] text-slate-500 truncate mt-1">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg text-sm transition-all"
            >
              <LogOut size={16} /> Sair com Segurança
            </button>
          </div>
        )}
      </aside>
      <main className="flex-1 p-4 md:p-10 overflow-y-auto w-full md:w-auto overflow-x-hidden">{children}</main>
    </div>
  );
};

const NavItem: React.FC<{ to: string; icon: React.ReactNode; label: string; active?: boolean }> = ({ to, icon, label, active }) => (
  <Link
    to={to}
    className={cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 group",
      active
        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
        : "hover:bg-slate-800 text-slate-400 hover:text-white"
    )}
  >
    <span className={cn("transition-transform group-hover:scale-110", active ? "text-white" : "text-slate-500 group-hover:text-blue-400")}>
      {icon}
    </span>
    <span className="font-semibold text-sm tracking-tight">{label}</span>
  </Link>
);
