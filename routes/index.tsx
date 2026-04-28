import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { CartProvider } from '../contexts/CartContext';
import { QuoteCartProvider } from '../contexts/QuoteCartContext';
import { MaintenanceGuard } from '../components/MaintenanceGuard.tsx';

const AdminLoginPage = React.lazy(() => import('../pages/auth/AdminLoginPage').then(module => ({ default: module.AdminLoginPage })));
const ClienteLoginPage = React.lazy(() => import('../pages/auth/ClienteLoginPage').then(module => ({ default: module.ClienteLoginPage })));
const ClienteRegisterPage = React.lazy(() => import('../pages/auth/ClienteRegisterPage').then(module => ({ default: module.ClienteRegisterPage })));
const AuthCallbackPage = React.lazy(() => import('../pages/auth/AuthCallbackPage').then(module => ({ default: module.AuthCallbackPage })));
const CompletarCadastroPage = React.lazy(() => import('../pages/auth/CompletarCadastroPage').then(module => ({ default: module.CompletarCadastroPage })));
const RecuperarSenhaPage = React.lazy(() => import('../pages/auth/RecuperarSenhaPage').then(module => ({ default: module.RecuperarSenhaPage })));
const RedefinirSenhaPage = React.lazy(() => import('../pages/auth/RedefinirSenhaPage').then(module => ({ default: module.RedefinirSenhaPage })));
const CustomerProfilePage = React.lazy(() => import('../pages/customer/CustomerProfilePage').then(module => ({ default: module.CustomerProfilePage })));
const CustomerFavoritesPage = React.lazy(() => import('../pages/customer/CustomerFavoritesPage').then(module => ({ default: module.CustomerFavoritesPage })));
const BulkRegistrationPage = React.lazy(() => import('../pages/admin/products/BulkRegistrationPage').then(module => ({ default: module.BulkRegistrationPage })));
const CategorySettingsPage = React.lazy(() => import('../pages/admin/settings/categories/index'));
const NewCategoryPage = React.lazy(() => import('../pages/admin/settings/categories/new'));
const FieldPresetsPage = React.lazy(() => import('../pages/admin/settings/categories/presets'));
const EditCategoryPage = React.lazy(() => import('../pages/admin/settings/categories/[id]/edit'));
const FieldsManagementPage = React.lazy(() => import('../pages/admin/settings/fields'));
const StoragesPage = React.lazy(() => import('../pages/admin/settings/StoragesPage').then(module => ({ default: module.StoragesPage })));
const RamsPage = React.lazy(() => import('../pages/admin/settings/RamsPage').then(module => ({ default: module.RamsPage })));
const VersionsPage = React.lazy(() => import('../pages/admin/settings/VersionsPage').then(module => ({ default: module.VersionsPage })));
const BatteryHealthsPage = React.lazy(() => import('../pages/admin/settings/BatteryHealthsPage').then(module => ({ default: module.BatteryHealthsPage })));
const FieldConfigPage = React.lazy(() => import('../pages/admin/settings/FieldConfigPage').then(module => ({ default: module.FieldConfigPage })));
const PaymentFeesPage = React.lazy(() => import('../pages/admin/settings/PaymentFeesPage').then(module => ({ default: module.PaymentFeesPage })));
const CustomFieldsLibraryPage = React.lazy(() => import('../pages/admin/settings/CustomFieldsLibraryPage').then(module => ({ default: module.CustomFieldsLibraryPage })));
const CustomerFormPage = React.lazy(() => import('../pages/customers/CustomerFormPage'));
const CustomerDetailsPage = React.lazy(() => import('../pages/customers/CustomerDetailsPage'));
const TeamFormPage = React.lazy(() => import('../pages/team/TeamFormPage'));
const TeamListPage = React.lazy(() => import('../pages/team/TeamListPage'));
const CompanyDataPage = React.lazy(() => import('../pages/admin/settings/CompanyDataPage').then(module => ({ default: module.CompanyDataPage })));
const DocumentSettingsPage = React.lazy(() => import('../pages/admin/settings/DocumentSettingsPage'));
const WarrantyTemplatesPage = React.lazy(() => import('../pages/admin/settings/WarrantyTemplatesPage'));
const MessagesPage = React.lazy(() => import('../pages/admin/settings/MessagesPage'));
const BannerManagementPage = React.lazy(() => import('../pages/admin/settings/BannerManagementPage'));
const CatalogSettingsPage = React.lazy(() => import('../pages/admin/settings/CatalogSettingsPage'));
const ShippingPage = React.lazy(() => import('../pages/admin/settings/ShippingPage'));
const FreightCalculatorPage = React.lazy(() => import('../pages/admin/FreightCalculatorPage'));
const PermissionsManagementPage = React.lazy(() => import('../pages/admin/settings/PermissionsManagementPage'));
const CouponsPage = React.lazy(() => import('../pages/admin/CouponsPage'));
const CashbackPage = React.lazy(() => import('../pages/admin/CashbackPage'));
const TelegramPage = React.lazy(() => import('../pages/admin/settings/TelegramPage'));
const SystemTagsPage = React.lazy(() => import('../pages/admin/settings/SystemTagsPage'));
const WhatsAppPage = React.lazy(() => import('../pages/admin/settings/WhatsAppPage'));
const PaymentIntegrationsPage = React.lazy(() => import('../pages/admin/settings/PaymentIntegrationsPage'));
const TabsTestPage = React.lazy(() => import('../pages/test/TabsTestPage').then(module => ({ default: module.TabsTestPage })));
const CatalogPage = React.lazy(() => import('../pages/catalog/index'));
const CoinsInfoPage = React.lazy(() => import('../pages/catalog/CoinsInfoPage'));
const LegacyMigrationPage = React.lazy(() => import('../pages/LegacyMigration'));
const FieldMappingPage = React.lazy(() => import('../pages/FieldMappingPage'));
const ExtendedWarrantyPage = React.lazy(() => import('../pages/customer/ExtendedWarrantyPage'));
const CustomerPromotionsPage = React.lazy(() => import('../pages/customer/PromotionsPage').then(module => ({ default: module.PromotionsPage })));
const FreeScreenProtectorRulesPage = React.lazy(() => import('../pages/customer/FreeScreenProtectorRulesPage').then(module => ({ default: module.FreeScreenProtectorRulesPage })));
const FeedbackListPage = React.lazy(() => import('../pages/admin/feedbacks/FeedbackListPage').then(module => ({ default: module.FeedbackListPage })));
const AdminPromotionsPage = React.lazy(() => import('../pages/admin/promotions/PromotionsPage').then(module => ({ default: module.PromotionsPage })));
const AboutUsPage = React.lazy(() => import('../pages/catalog/AboutUsPage').then(module => ({ default: module.AboutUsPage })));
const FAQPage = React.lazy(() => import('../pages/catalog/FAQPage').then(module => ({ default: module.FAQPage })));
const BlingCallbackPage = React.lazy(() => import('../pages/admin/settings/BlingCallbackPage'));
const CartPage = React.lazy(() => import('../pages/store/CartPage'));
const OrderConfirmationPage = React.lazy(() => import('../pages/store/OrderConfirmationPage'));
const OrderTrackingPage = React.lazy(() => import('../pages/store/OrderTrackingPage'));
const OnlineOrdersPage = React.lazy(() => import('../pages/admin/orders/OnlineOrdersPage'));
const SerializedUnitsPage = React.lazy(() => import('../pages/admin/inventory/SerializedUnitsPage'));
const SEODashboardPage = React.lazy(() => import('../pages/admin/settings/SEODashboardPage').then(module => ({ default: module.SEODashboardPage })));
const SEOBlacklistPage = React.lazy(() => import('../pages/admin/settings/SEOBlacklistPage').then(module => ({ default: module.SEOBlacklistPage })));
const ReviewsPage = React.lazy(() => import('../pages/admin/catalog/ReviewsPage').then(module => ({ default: module.ReviewsPage })));
const RoadmapPage = React.lazy(() => import('../pages/admin/settings/RoadmapPage'));
const VpsStatusPage = React.lazy(() => import('../pages/admin/settings/VpsStatusPage').then(module => ({ default: module.VpsStatusPage })));
const SynologyFilesPage = React.lazy(() => import('../pages/admin/settings/SynologyFilesPage').then(module => ({ default: module.SynologyFilesPage })));
const SynologyConfigPage = React.lazy(() => import('../pages/admin/settings/SynologyConfigPage'));
const FavoritesRankingReport = React.lazy(() => import('../pages/admin/reports/FavoritesRankingReport'));
const AdminDashboardPage = React.lazy(() => import('../pages/admin/dashboard/AdminDashboardPage').then(module => ({ default: module.AdminDashboardPage })));
const AdminLayout = React.lazy(() => import('../layouts/AdminLayout').then(module => ({ default: module.AdminLayout })));
const ProductListPage = React.lazy(() => import('../pages/admin/products/ProductListPage').then(module => ({ default: module.ProductListPage })));
const ProductFormPage = React.lazy(() => import('../pages/admin/products/ProductFormPage').then(module => ({ default: module.ProductFormPage })));
const ProductDetailPage = React.lazy(() => import('../pages/admin/products/ProductDetailPage').then(module => ({ default: module.ProductDetailPage })));
const ProductCombosPage = React.lazy(() => import('../pages/admin/products/ProductCombosPage').then(module => ({ default: module.ProductCombosPage })));
const ProductImageBankPage = React.lazy(() => import('../pages/admin/products/ProductImageBankPage').then(module => ({ default: module.ProductImageBankPage })));
const InventoryPage = React.lazy(() => import('../pages/admin/inventory/InventoryPage').then(module => ({ default: module.InventoryPage })));
const BrandsPage = React.lazy(() => import('../pages/admin/settings/BrandsPage').then(module => ({ default: module.BrandsPage })));
const ModelsPage = React.lazy(() => import('../pages/admin/settings/ModelsPage').then(module => ({ default: module.ModelsPage })));
const ColorsPage = React.lazy(() => import('../pages/admin/settings/ColorsPage').then(module => ({ default: module.ColorsPage })));
const CustomerListPage = React.lazy(() => import('../pages/customers/CustomerListPage'));
const PDVPage = React.lazy(() => import('../pages/pdv/PDVPage'));
const CatalogConfigPage = React.lazy(() => import('../pages/admin/CatalogConfigPage'));
const CatalogEditorPage = React.lazy(() => import('../pages/admin/catalog-editor'));
const MarketingPage = React.lazy(() => import('../pages/admin/settings/MarketingPage'));
const SalesPage = React.lazy(() => import('../pages/admin/sales/SalesPage'));
const BlingPage = React.lazy(() => import('../pages/admin/settings/BlingPage'));
const ShopeePage = React.lazy(() => import('../pages/admin/settings/ShopeePage'));
const CheckoutPage = React.lazy(() => import('../pages/store/CheckoutPage'));
const PublicProductPage = React.lazy(() => import('../pages/store/PublicProductPage').then(module => ({ default: module.PublicProductPage })));
const FinancialPage = React.lazy(() => import('../pages/admin/financial/FinancialPage'));
const AccountingPage = React.lazy(() => import('../pages/admin/accounting/AccountingPage'));
const DataImportExportPage = React.lazy(() => import('../pages/admin/import/DataImportExportPage').then(module => ({ default: module.DataImportExportPage })));
const MySQLExplorerPage = React.lazy(() => import('../pages/admin/settings/MySQLExplorerPage').then(module => ({ default: module.MySQLExplorerPage })));

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
  // Customer Favorites
  {
    path: "/favoritos",
    element: <CartProvider><CustomerFavoritesPage /></CartProvider>
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
        <AdminLayout><AdminDashboardPage /></AdminLayout>
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
    path: "/admin/import",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><DataImportExportPage /></AdminLayout>
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
    path: "/admin/products/:id/:slug?",
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
    path: "/admin/serializados",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><SerializedUnitsPage /></AdminLayout>
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
    path: "/admin/settings/categories/presets",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><FieldPresetsPage /></AdminLayout>
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
  {
    path: "/admin/settings/synology-config",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><SynologyConfigPage /></AdminLayout>
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
    path: "/produtos",
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
    path: "/admin/relatorios/favoritos",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><FavoritesRankingReport /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "*",
    element: <div className="p-20 text-center font-medium text-slate-500">404 - Página não encontrada</div>
  }
]);

