
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Settings, Users, ClipboardList, LogOut, Package, Tags, Shield, BadgeCheck, Smartphone, Palette, HardDrive, MemoryStick, GitBranch, BatteryCharging, FileText, BookOpen, CreditCard, ShoppingCart, Image, Database } from 'lucide-react';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/cn';
import { usePageTitle } from '../hooks/usePageTitle';

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, customer, signOut } = useSupabaseAuth();
  const { settings } = useTheme();
  const location = useLocation();
  const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

  // Atualizar título da página automaticamente baseado na rota
  usePageTitle();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {DEV_MODE && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black px-4 py-2 text-center text-sm font-bold z-[100] shadow-lg">
          🔧 MODO DESENVOLVIMENTO - Autenticação Mock Ativa
        </div>
      )}
      <aside className={cn(
        "w-full md:w-64 bg-slate-900 text-white p-6 space-y-8 md:sticky md:top-0 md:h-screen flex flex-col z-50 shadow-2xl overflow-y-auto",
        DEV_MODE ? "md:top-10 md:h-[calc(100vh-2.5rem)]" : ""
      )}>
        <div className="px-2">
          <h1 className="text-xl font-bold tracking-tighter text-blue-400">
            {settings.company_name}
          </h1>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              Painel: {customer?.customer_type || 'ADMIN'}
            </p>
          </div>
        </div>

        <nav className="space-y-1 flex-1 overflow-y-auto pr-2 -mr-2">
          <NavItem
            to="/admin"
            icon={<LayoutDashboard size={18} />}
            label="Dashboard"
            active={location.pathname === '/admin'}
          />
          <NavItem
            to="/admin/entrada"
            icon={<Package size={18} />}
            label="Entrada (Teste)"
            active={location.pathname === '/admin/entrada'}
          />
          <NavItem
            to="/admin/products"
            icon={<Package size={18} />}
            label="Produtos"
            active={location.pathname.startsWith('/admin/products')}
          />
          <NavItem
            to="/admin/sales"
            icon={<ShoppingBag size={18} />}
            label="Vendas"
            active={location.pathname.startsWith('/admin/sales')}
          />
          <NavItem
            to="/admin/inventory"
            icon={<ClipboardList size={18} />}
            label="Estoque"
            active={location.pathname.startsWith('/admin/inventory')}
          />
          <NavItem
            to="/admin/customers"
            icon={<Users size={18} />}
            label="Clientes"
            active={location.pathname.startsWith('/admin/customers')}
          />
          <NavItem
            to="/admin/team"
            icon={<Users size={18} />}
            label="Equipe"
            active={location.pathname.startsWith('/admin/team')}
          />
          <NavItem
            to="/admin/pdv"
            icon={<ShoppingCart size={18} />}
            label="PDV"
            active={location.pathname.startsWith('/admin/pdv')}
          />
          <NavItem
            to="/admin/migration"
            icon={<Database size={18} />}
            label="Migração"
            active={location.pathname.startsWith('/admin/migration')}
          />
          <NavItem
            to="/catalog"
            icon={<BookOpen size={18} />}
            label="Catálogo"
            active={location.pathname.startsWith('/catalog')}
          />
          <div className="pt-4 pb-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-transparent">Configuração</div>
          <NavItem
            to="/admin/settings/categories"
            icon={<Tags size={18} />}
            label="Categorias"
            active={location.pathname.startsWith('/admin/settings/categories')}
          />
          <NavItem
            to="/admin/settings/fields"
            icon={<FileText size={18} />}
            label="Campos"
            active={location.pathname.startsWith('/admin/settings/fields')}
          />
          <NavItem
            to="/admin/settings/brands"
            icon={<BadgeCheck size={18} />}
            label="Marcas"
            active={location.pathname.startsWith('/admin/settings/brands')}
          />
          <NavItem
            to="/admin/settings/models"
            icon={<Smartphone size={18} />}
            label="Modelos"
            active={location.pathname.startsWith('/admin/settings/models')}
          />
          <NavItem
            to="/admin/settings/colors"
            icon={<Palette size={18} />}
            label="Cores"
            active={location.pathname.startsWith('/admin/settings/colors')}
          />
          <NavItem
            to="/admin/settings/storages"
            icon={<HardDrive size={18} />}
            label="Armazenamento"
            active={location.pathname.startsWith('/admin/settings/storages')}
          />
          <NavItem
            to="/admin/settings/rams"
            icon={<MemoryStick size={18} />}
            label="Memória RAM"
            active={location.pathname.startsWith('/admin/settings/rams')}
          />
          <NavItem
            to="/admin/settings/versions"
            icon={<GitBranch size={18} />}
            label="Versões"
            active={location.pathname.startsWith('/admin/settings/versions')}
          />
          <NavItem
            to="/admin/settings/battery-healths"
            icon={<BatteryCharging size={18} />}
            label="Saúde Bateria"
            active={location.pathname.startsWith('/admin/settings/battery-healths')}
          />
          <NavItem
            to="/admin/settings/payment-fees"
            icon={<CreditCard size={18} />}
            label="Taxas"
            active={location.pathname.startsWith('/admin/settings/payment-fees')}
          />
          <NavItem
            to="/admin/settings/company"
            icon={<Settings size={18} />}
            label="Dados da Empresa"
            active={location.pathname.startsWith('/admin/settings/company')}
          />
          <NavItem
            to="/admin/settings/documents"
            icon={<FileText size={18} />}
            label="Documentos"
            active={location.pathname.startsWith('/admin/settings/documents')}
          />
          <NavItem
            to="/admin/settings/warranty-templates"
            icon={<Shield size={18} />}
            label="Garantias"
            active={location.pathname.startsWith('/admin/settings/warranty-templates')}
          />
          <NavItem
            to="/admin/settings/banners"
            icon={<Image size={18} />}
            label="Banners"
            active={location.pathname.startsWith('/admin/settings/banners')}
          />
          <NavItem
            to="/admin/catalog-config"
            icon={<Settings size={18} />}
            label="Config. Catálogo"
            active={location.pathname.startsWith('/admin/catalog-config')}
          />

          {customer?.customer_type === 'ADMIN' && (
            <NavItem
              to="/admin/settings/permissions"
              icon={<Shield size={18} />}
              label="Permissões"
              active={location.pathname.startsWith('/admin/settings/permissions')}
            />
          )}
          <NavItem
            to="/admin/governance"
            icon={<Shield size={18} />}
            label="Governança"
            active={location.pathname === '/admin/governance'}
          />
          <NavItem
            to="/admin/dev-diary"
            icon={<BookOpen size={18} />}
            label="Diário de Dev"
            active={location.pathname === '/admin/dev-diary'}
          />
          <NavItem
            to="/test-tabs"
            icon={<Tags size={18} />}
            label="🧪 Teste de Abas"
            active={location.pathname === '/test-tabs'}
          />
          <NavItem
            to="/admin/settings"
            icon={<Settings size={18} />}
            label="Ajustes Sistema"
            active={location.pathname === '/admin/settings'}
          />
        </nav>

        {user && (
          <div className="pt-4 border-t border-slate-800">
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold shadow-lg">
                {customer?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-bold truncate leading-none">{customer?.name || user?.email || 'Usuário'}</p>
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
      <main className="flex-1 p-4 md:p-10 overflow-y-auto">{children}</main>
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
