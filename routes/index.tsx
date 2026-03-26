

import React from 'react';
import { createBrowserRouter, Navigate, useNavigate } from 'react-router-dom';
import { MessageSquareDashed } from 'lucide-react';
import { AdminLoginPage } from '../pages/auth/AdminLoginPage';
import { ClienteLoginPage } from '../pages/auth/ClienteLoginPage';
import { ClienteRegisterPage } from '../pages/auth/ClienteRegisterPage';
import { CadastroPage } from '../pages/auth/CadastroPage';
import { AuthCallbackPage } from '../pages/auth/AuthCallbackPage';
import { CompletarCadastroPage } from '../pages/auth/CompletarCadastroPage';
import { RecuperarSenhaPage } from '../pages/auth/RecuperarSenhaPage';
import { RedefinirSenhaPage } from '../pages/auth/RedefinirSenhaPage';
import { CustomerCatalogPage } from '../pages/customer/CustomerCatalogPage';
import { CustomerProfilePage } from '../pages/customer/CustomerProfilePage';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { SupabaseProtectedRoute } from '../components/SupabaseProtectedRoute';
import { ClientTypes } from '../utils/field-standards';
import { ProductListPage } from '../pages/admin/products/ProductListPage';
import { ProductFormPage } from '../pages/admin/products/ProductFormPage';
import { ProductDetailPage } from '../pages/admin/products/ProductDetailPage';
import { BulkRegistrationPage } from '../pages/admin/products/BulkRegistrationPage';
import { ProductCombosPage } from '../pages/admin/products/ProductCombosPage';
import { InventoryPage } from '../pages/admin/inventory/InventoryPage';
import CategorySettingsPage from '../pages/admin/settings/categories/index';
import NewCategoryPage from '../pages/admin/settings/categories/new';
import EditCategoryPage from '../pages/admin/settings/categories/[id]/edit';
import FieldsManagementPage from '../pages/admin/settings/fields';
import { BrandsPage } from '../pages/admin/settings/BrandsPage';
import { ModelsPage } from '../pages/admin/settings/ModelsPage';
import { ColorsPage } from '../pages/admin/settings/ColorsPage';
import { StoragesPage } from '../pages/admin/settings/StoragesPage';
import { RamsPage } from '../pages/admin/settings/RamsPage';
import { VersionsPage } from '../pages/admin/settings/VersionsPage';
import { BatteryHealthsPage } from '../pages/admin/settings/BatteryHealthsPage';
import { FieldConfigPage } from '../pages/admin/settings/FieldConfigPage';
import { PaymentFeesPage } from '../pages/admin/settings/PaymentFeesPage';
import { CustomFieldsLibraryPage } from '../pages/admin/settings/CustomFieldsLibraryPage';
import CustomerListPage from '../pages/customers/CustomerListPage';
import CustomerFormPage from '../pages/customers/CustomerFormPage';
import CustomerDetailsPage from '../pages/customers/CustomerDetailsPage';
import TeamFormPage from '../pages/team/TeamFormPage';
import TeamListPage from '../pages/team/TeamListPage';
import PDVPage from '../pages/pdv/PDVPage';
import { CompanyDataPage } from '../pages/admin/settings/CompanyDataPage';
import DocumentSettingsPage from '../pages/admin/settings/DocumentSettingsPage';
import WarrantyTemplatesPage from '../pages/admin/settings/WarrantyTemplatesPage';
import MessagesPage from '../pages/admin/settings/MessagesPage';
import BannerManagementPage from '../pages/admin/settings/BannerManagementPage';
import CatalogSettingsPage from '../pages/admin/settings/CatalogSettingsPage';
import ShippingPage from '../pages/admin/settings/ShippingPage';
import FreightCalculatorPage from '../pages/admin/FreightCalculatorPage';
import CatalogConfigPage from '../pages/admin/CatalogConfigPage';
import PermissionsManagementPage from '../pages/admin/settings/PermissionsManagementPage';
import CatalogEditorPage from '../pages/admin/catalog-editor';
import CouponsPage from '../pages/admin/CouponsPage';
import CashbackPage from '../pages/admin/CashbackPage';
import TelegramPage from '../pages/admin/settings/TelegramPage';
import SystemTagsPage from '../pages/admin/settings/SystemTagsPage';
import MarketingPage from '../pages/admin/settings/MarketingPage';
import SalesPage from '../pages/admin/sales/SalesPage';
import WhatsAppPage from '../pages/admin/settings/WhatsAppPage';
import PaymentIntegrationsPage from '../pages/admin/settings/PaymentIntegrationsPage';
import { TabsTestPage } from '../pages/test/TabsTestPage';
import CatalogPage from '../pages/catalog/index';
import CoinsInfoPage from '../pages/catalog/CoinsInfoPage';
import LegacyMigrationPage from '../pages/LegacyMigration';
import FieldMappingPage from '../pages/FieldMappingPage';
import ExtendedWarrantyPage from '../pages/customer/ExtendedWarrantyPage';
import { PromotionsPage as CustomerPromotionsPage } from '../pages/customer/PromotionsPage';
import { FreeScreenProtectorRulesPage } from '../pages/customer/FreeScreenProtectorRulesPage';
import { FeedbackListPage } from '../pages/admin/feedbacks/FeedbackListPage';
import { PromotionsPage as AdminPromotionsPage } from '../pages/admin/promotions/PromotionsPage';
import { AboutUsPage } from '../pages/catalog/AboutUsPage';
import { FAQPage } from '../pages/catalog/FAQPage';
import BlingPage from '../pages/admin/settings/BlingPage';
import BlingCallbackPage from '../pages/admin/settings/BlingCallbackPage';
import ShopeePage from '../pages/admin/settings/ShopeePage';
import { ProductImageBankPage } from '../pages/admin/products/ProductImageBankPage';
import CartPage from '../pages/store/CartPage';
import CheckoutPage from '../pages/store/CheckoutPage';
import OrderConfirmationPage from '../pages/store/OrderConfirmationPage';
import OrderTrackingPage from '../pages/store/OrderTrackingPage';
import { PublicProductPage } from '../pages/store/PublicProductPage';
import OnlineOrdersPage from '../pages/admin/orders/OnlineOrdersPage';
import FinancialPage from '../pages/admin/financial/FinancialPage';
import { CartProvider } from '../contexts/CartContext';
import { QuoteCartProvider } from '../contexts/QuoteCartContext';
import { SEODashboardPage } from '../pages/admin/settings/SEODashboardPage';
import { SEOBlacklistPage } from '../pages/admin/settings/SEOBlacklistPage';
import { feedbackService } from '../services/feedbackService';
import { MaintenanceGuard } from '../components/MaintenanceGuard.tsx';
import { ReviewsPage } from '../pages/admin/catalog/ReviewsPage';
import { RoadmapPage } from '../pages/admin/settings/RoadmapPage';
import { VpsStatusPage } from '../pages/admin/settings/VpsStatusPage';
import { MySQLExplorerPage } from '../pages/admin/settings/MySQLExplorerPage';
import { SynologyFilesPage } from '../pages/admin/settings/SynologyFilesPage';
import AccountingPage from '../pages/admin/accounting/AccountingPage';

// Temporary components (will be moved to separate files in next phase)
const DashboardPage = () => {
  const navigate = useNavigate();
  const [unreadFeedbacks, setUnreadFeedbacks] = React.useState(0);

  React.useEffect(() => {
    feedbackService.getUnreadCount().then(setUnreadFeedbacks).catch(() => { });
  }, []);

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Visão Geral</h2>
          <p className="text-slate-500">Gestão operacional do ecossistema.</p>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-indigo-600 to-blue-700 text-white text-sm font-semibold rounded-xl shadow hover:shadow-md hover:-translate-y-0.5 transition-all whitespace-nowrap"
        >
          <span>🛒</span> Ver Loja ↗
        </a>
      </div>

      {/* Alerta de Novas Mensagens */}
      {unreadFeedbacks > 0 && (
        <div
          onClick={() => navigate('/admin/feedbacks')}
          className="mt-6 bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm cursor-pointer hover:bg-amber-100 transition-colors flex items-start gap-3"
        >
          <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
            <MessageSquareDashed size={20} />
          </div>
          <div>
            <h3 className="text-amber-800 font-bold text-sm">Atenção: Novas Mensagens!</h3>
            <p className="text-amber-700 text-sm mt-0.5">
              Você tem <strong>{unreadFeedbacks}</strong> {unreadFeedbacks === 1 ? 'mensagem' : 'mensagens'} aguardando leitura na sua caixa de entrada. Clique aqui para ler.
            </p>
          </div>
        </div>
      )}

      {/* Quick Access Cards */}
      <div className="mt-8 space-y-8">

        {/* ── Grupo: Produtos & Catálogo ── */}
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span>📦</span> Produtos & Catálogo
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">

            <button onClick={() => navigate('/admin/products')}
              className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-green-400 hover:shadow-md transition-all cursor-pointer group text-left">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <span className="text-lg">📦</span>
                </div>
                <p className="font-semibold text-slate-800 text-sm">Produtos</p>
              </div>
              <p className="text-xs text-slate-500">Cadastrar e gerenciar</p>
            </button>

            <button onClick={() => navigate('/admin/settings/models')}
              className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group text-left">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <span className="text-lg">📱</span>
                </div>
                <p className="font-semibold text-slate-800 text-sm">Modelos</p>
              </div>
              <p className="text-xs text-slate-500">Modelos e fotos por cor</p>
            </button>

            <button onClick={() => navigate('/admin/inventory')}
              className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-yellow-400 hover:shadow-md transition-all cursor-pointer group text-left">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 bg-yellow-100 rounded-lg flex items-center justify-center group-hover:bg-yellow-200 transition-colors">
                  <span className="text-lg">📊</span>
                </div>
                <p className="font-semibold text-slate-800 text-sm">Estoque</p>
              </div>
              <p className="text-xs text-slate-500">Movimentações e saldos</p>
            </button>

            <button onClick={() => navigate('/admin/settings/catalog')}
              className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-orange-400 hover:shadow-md transition-all cursor-pointer group text-left">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                  <span className="text-lg">🛍️</span>
                </div>
                <p className="font-semibold text-slate-800 text-sm">Catálogo</p>
              </div>
              <p className="text-xs text-slate-500">Configurar catálogo</p>
            </button>

            <button onClick={() => navigate('/admin/settings/bling')}
              className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-orange-400 hover:shadow-md transition-all cursor-pointer group text-left">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                  <span className="text-lg">🔗</span>
                </div>
                <p className="font-semibold text-slate-800 text-sm">Bling</p>
              </div>
              <p className="text-xs text-slate-500">Sync ERP / Webhook</p>
            </button>

          </div>
        </div>

        {/* ── Grupo: Operações Diárias ── */}
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span>⚡</span> Operações Diárias
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">

            <button onClick={() => navigate('/admin/pdv')}
              className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer group text-left">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <span className="text-lg">💰</span>
                </div>
                <p className="font-semibold text-slate-800 text-sm">PDV</p>
              </div>
              <p className="text-xs text-slate-500">Ponto de venda</p>
            </button>

            <button onClick={() => navigate('/admin/sales')}
              className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-sky-400 hover:shadow-md transition-all cursor-pointer group text-left">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 bg-sky-100 rounded-lg flex items-center justify-center group-hover:bg-sky-200 transition-colors">
                  <span className="text-lg">📋</span>
                </div>
                <p className="font-semibold text-slate-800 text-sm">Vendas</p>
              </div>
              <p className="text-xs text-slate-500">Histórico de vendas</p>
            </button>

            <button onClick={() => navigate('/admin/orders')}
              className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-teal-400 hover:shadow-md transition-all cursor-pointer group text-left">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center group-hover:bg-teal-200 transition-colors">
                  <span className="text-lg">🛒</span>
                </div>
                <p className="font-semibold text-slate-800 text-sm">Pedidos</p>
              </div>
              <p className="text-xs text-slate-500">Pedidos online</p>
            </button>

            <button onClick={() => navigate('/admin/financeiro')}
              className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group text-left">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                  <span className="text-lg">💳</span>
                </div>
                <p className="font-semibold text-slate-800 text-sm">Financeiro</p>
              </div>
              <p className="text-xs text-slate-500">Contas e fluxo</p>
            </button>

            <button onClick={() => navigate('/admin/settings/shipping?tab=calcular')}
              className="bg-gradient-to-br from-cyan-500 to-blue-600 p-4 rounded-xl shadow-sm hover:shadow-md transition-all text-left text-white">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                  <span className="text-lg">🚚</span>
                </div>
                <p className="font-semibold text-sm">Calcular Frete</p>
              </div>
              <p className="text-xs text-blue-100">Cotação avulsa</p>
            </button>

          </div>
        </div>

      </div>

      {/* Stats Cards */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span>📊</span> Visão Geral
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-blue-500">
            <p className="text-xs font-semibold text-slate-500 uppercase">Total Operações</p>
            <p className="text-2xl font-bold mt-1">R$ 0,00</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-red-500">
            <p className="text-xs font-semibold text-slate-500 uppercase">Alertas de Estoque</p>
            <p className="text-2xl font-bold mt-1">0 itens</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-green-500">
            <p className="text-xs font-semibold text-slate-500 uppercase">Requisições Atacado</p>
            <p className="text-2xl font-bold mt-1">0</p>
          </div>
        </div>
      </div>

    </div>
  );
};

const StorePage = () => (
  <div className="p-8 animate-in slide-in-from-bottom-4 duration-500">
    <h1 className="text-3xl font-bold">Catálogo de Produtos</h1>
    <p className="text-slate-500 mt-2">Explore as melhores ofertas para o seu perfil.</p>
    <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="aspect-square bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 italic">
        Sem produtos cadastrados
      </div>
    </div>
  </div>
);

// Layout wrappers
import { AdminLayout } from '../layouts/AdminLayout';

export const router = createBrowserRouter([
  // Redirect old login to new admin login (backward compatibility)
  {
    path: "/login",
    loader: () => {
      return new Response(null, {
        status: 302,
        headers: { Location: "/admin/login" }
      });
    },
    element: <div>Redirecionando...</div>
  },
  // Admin Authentication (Supabase)
  {
    path: "/admin/login",
    element: <AdminLoginPage />
  },
  // Customer Authentication (Supabase)
  {
    path: "/cliente/login",
    element: <ClienteLoginPage />
  },
  {
    path: "/cliente/cadastro",
    element: <ClienteRegisterPage />
  },
  {
    path: "/auth/callback",
    element: <AuthCallbackPage />
  },
  {
    path: "/completar-cadastro",
    element: <CompletarCadastroPage />
  },
  {
    path: "/recuperar-senha",
    element: <RecuperarSenhaPage />
  },
  {
    path: "/redefinir-senha",
    element: <RedefinirSenhaPage />
  },
  // Customer Catalog - REMOVED: Now using homepage (/) instead
  // Customer Profile
  {
    path: "/perfil",
    element: <CustomerProfilePage />
  },
  // Regulamento Moedas do Vale (página pública)
  {
    path: "/moedas-do-vale",
    element: <CoinsInfoPage />
  },
  // Promoções e Vantagens (Central Pública)
  {
    path: "/promocoes",
    element: <CustomerPromotionsPage />
  },
  {
    path: "/promocoes/pelicula-gratis",
    element: <FreeScreenProtectorRulesPage />
  },
  // Garantia Estendida (página pública)
  {
    path: "/garantia-estendida",
    element: <ExtendedWarrantyPage />
  },
  {
    path: "/admin",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><DashboardPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/products",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><ProductListPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/sales",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><SalesPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/financeiro",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><FinancialPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/contabilidade",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><AccountingPage /></AdminLayout>
      </ProtectedRoute>
    )
  },

  {
    path: "/admin/products/new",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><ProductFormPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/products/:id",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><ProductDetailPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/products/combos",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><ProductCombosPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/products/bulk",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><BulkRegistrationPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/products/image-bank",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><ProductImageBankPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/inventory",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><InventoryPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/coupons",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><CouponsPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/cashback",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><CashbackPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/categories",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><CategorySettingsPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/categories/new",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><NewCategoryPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/categories/:id/edit",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><EditCategoryPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/fields",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><FieldsManagementPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/brands",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><BrandsPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/models",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><ModelsPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/colors",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><ColorsPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/storages",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><StoragesPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/rams",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><RamsPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/versions",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><VersionsPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/battery-healths",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><BatteryHealthsPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/fields",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><FieldConfigPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/payment-fees",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><PaymentFeesPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/shipping",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><ShippingPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/calcular-frete",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><FreightCalculatorPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/company",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><CompanyDataPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/documents",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><DocumentSettingsPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/warranty-templates",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><WarrantyTemplatesPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/integrations",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><PaymentIntegrationsPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/messages",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><MessagesPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/shopee",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><ShopeePage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/telegram",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><TelegramPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/marketing",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><MarketingPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/system-tags",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><SystemTagsPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/whatsapp",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><WhatsAppPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/roadmap",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><RoadmapPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/vps-status",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><VpsStatusPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/mysql",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><MySQLExplorerPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/synology-cdn",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><SynologyFilesPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  // Customer Routes
  {
    path: "/admin/customers",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><CustomerListPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/customers/new",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><CustomerFormPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/customers/:id",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><CustomerDetailsPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/customers/:id/edit",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><CustomerFormPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/custom-fields",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><CustomFieldsLibraryPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/team",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><TeamListPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/team/new",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><TeamFormPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/team/:id/edit",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><TeamFormPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/banners",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><BannerManagementPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/catalog",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><CatalogSettingsPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/catalog-editor",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <CatalogEditorPage />
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/catalog-config",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <CatalogConfigPage />
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/permissions",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><PermissionsManagementPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/seo-analyzer",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><SEODashboardPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/seo-analyzer",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><SEODashboardPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/seo-blacklist",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><SEOBlacklistPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/pdv",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <PDVPage />
      </ProtectedRoute>
    )
  },
  {
    path: "/test-tabs",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><TabsTestPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/migration",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><LegacyMigrationPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/field-mapping",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><FieldMappingPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/feedbacks",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><FeedbackListPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/promotions",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><AdminPromotionsPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/avaliacoes",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><ReviewsPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/bling",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><BlingPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/shopee",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><ShopeePage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/bling/callback",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <BlingCallbackPage />
      </ProtectedRoute>
    )
  },
  // REMOVED: Duplicate /catalog route - using homepage (/) instead
  {
    path: "/store",
    element: (
      <ProtectedRoute>
        <StorePage />
      </ProtectedRoute>
    )
  },
  {
    path: "/",
    element: (
      <MaintenanceGuard>
        <CartProvider>
          <CatalogPage />
        </CartProvider>
      </MaintenanceGuard>
    )
  },
  {
    path: "/quem-somos",
    element: (
      <MaintenanceGuard>
        <AboutUsPage />
      </MaintenanceGuard>
    )
  },
  {
    path: "/faq",
    element: (
      <MaintenanceGuard>
        <FAQPage />
      </MaintenanceGuard>
    )
  },
  {
    path: "/produto/:slug",
    element: (
      <MaintenanceGuard>
        <QuoteCartProvider>
          <CartProvider>
            <PublicProductPage />
          </CartProvider>
        </QuoteCartProvider>
      </MaintenanceGuard>
    )
  },
  // ─── Loja / Checkout ───────────────────────────────────────────────────────
  {
    path: "/carrinho",
    element: (
      <MaintenanceGuard>
        <CartProvider>
          <CartPage />
        </CartProvider>
      </MaintenanceGuard>
    )
  },
  {
    path: "/checkout",
    element: (
      <CartProvider>
        <CheckoutPage />
      </CartProvider>
    )
  },
  {
    path: "/pedido/:id",
    element: <OrderTrackingPage />
  },
  {
    path: "/pedido/:id/confirmacao",
    element: <OrderConfirmationPage />
  },
  // ─── Admin — Pedidos Online ────────────────────────────────────────────────
  {
    path: "/admin/pedidos-online",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><OnlineOrdersPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "*",
    element: <div className="p-20 text-center font-medium text-slate-500">404 - Página não encontrada</div>
  }
]);

