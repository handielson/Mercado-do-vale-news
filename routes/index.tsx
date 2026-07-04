

import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { CartProvider } from '../contexts/CartContext';
import { QuoteCartProvider } from '../contexts/QuoteCartContext';
import { MaintenanceGuard } from '../components/MaintenanceGuard.tsx';

// Wrapper de React.lazy que recarrega a página quando o chunk falha por causa
// de deploy novo ou cache antigo do navegador/CDN. Flag em
// sessionStorage evita loop infinito caso a falha seja persistente (offline).
const CHUNK_RELOAD_FLAG = '__chunk_reload_attempted';
const isStaleChunkError = (e: any) => {
    const msg = String(e?.message || e || '');
    return /Failed to fetch dynamically imported module|Loading chunk \d+ failed|error loading dynamically imported module|Importing a module script failed/i.test(msg);
};
const lazy = <T extends React.ComponentType<any>>(importer: () => Promise<{ default: T }>) =>
    React.lazy(async () => {
        try {
            return await importer();
        } catch (err) {
            if (isStaleChunkError(err)) {
                try {
                    if (sessionStorage.getItem(CHUNK_RELOAD_FLAG) !== '1') {
                        sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1');
                        window.location.reload();
                        return new Promise<{ default: T }>(() => { /* never resolves; reload em curso */ });
                    }
                } catch { /* sessionStorage indisponível */ }
            }
            throw err;
        }
    });

const AdminLoginPage = lazy(() => import('../pages/auth/AdminLoginPage').then(module => ({ default: module.AdminLoginPage })));
const ClienteLoginPage = lazy(() => import('../pages/auth/ClienteLoginPage').then(module => ({ default: module.ClienteLoginPage })));
const ClienteRegisterPage = lazy(() => import('../pages/auth/ClienteRegisterPage').then(module => ({ default: module.ClienteRegisterPage })));
const AuthCallbackPage = lazy(() => import('../pages/auth/AuthCallbackPage').then(module => ({ default: module.AuthCallbackPage })));
const CompletarCadastroPage = lazy(() => import('../pages/auth/CompletarCadastroPage').then(module => ({ default: module.CompletarCadastroPage })));
const RecuperarSenhaPage = lazy(() => import('../pages/auth/RecuperarSenhaPage').then(module => ({ default: module.RecuperarSenhaPage })));
const RedefinirSenhaPage = lazy(() => import('../pages/auth/RedefinirSenhaPage').then(module => ({ default: module.RedefinirSenhaPage })));
const CustomerProfilePage = lazy(() => import('../pages/customer/CustomerProfilePage').then(module => ({ default: module.CustomerProfilePage })));
const CustomerFavoritesPage = lazy(() => import('../pages/customer/CustomerFavoritesPage').then(module => ({ default: module.CustomerFavoritesPage })));
const BulkRegistrationPage = lazy(() => import('../pages/admin/products/BulkRegistrationPage').then(module => ({ default: module.BulkRegistrationPage })));
const CategorySettingsPage = lazy(() => import('../pages/admin/settings/categories/index'));
const NewCategoryPage = lazy(() => import('../pages/admin/settings/categories/new'));
const FieldPresetsPage = lazy(() => import('../pages/admin/settings/categories/presets'));
const EditCategoryPage = lazy(() => import('../pages/admin/settings/categories/[id]/edit'));
const FieldsManagementPage = lazy(() => import('../pages/admin/settings/fields'));
const StoragesPage = lazy(() => import('../pages/admin/settings/StoragesPage').then(module => ({ default: module.StoragesPage })));
const RamsPage = lazy(() => import('../pages/admin/settings/RamsPage').then(module => ({ default: module.RamsPage })));
const VersionsPage = lazy(() => import('../pages/admin/settings/VersionsPage').then(module => ({ default: module.VersionsPage })));
const BatteryHealthsPage = lazy(() => import('../pages/admin/settings/BatteryHealthsPage').then(module => ({ default: module.BatteryHealthsPage })));
const FieldConfigPage = lazy(() => import('../pages/admin/settings/FieldConfigPage').then(module => ({ default: module.FieldConfigPage })));
const PaymentFeesPage = lazy(() => import('../pages/admin/settings/PaymentFeesPage').then(module => ({ default: module.PaymentFeesPage })));
const CustomFieldsLibraryPage = lazy(() => import('../pages/admin/settings/CustomFieldsLibraryPage').then(module => ({ default: module.CustomFieldsLibraryPage })));
const CustomerFormPage = lazy(() => import('../pages/customers/CustomerFormPage'));
const CustomerDetailsPage = lazy(() => import('../pages/customers/CustomerDetailsPage'));
const AdminCustomerProfilePreviewPage = lazy(() => import('../pages/customers/AdminCustomerProfilePreviewPage'));
const TeamFormPage = lazy(() => import('../pages/team/TeamFormPage'));
const TeamListPage = lazy(() => import('../pages/team/TeamListPage'));
const CompanyDataPage = lazy(() => import('../pages/admin/settings/CompanyDataPage').then(module => ({ default: module.CompanyDataPage })));
const DocumentSettingsPage = lazy(() => import('../pages/admin/settings/DocumentSettingsPage'));
const WarrantyTemplatesPage = lazy(() => import('../pages/admin/settings/WarrantyTemplatesPage'));
const EmailTemplatesPage = lazy(() => import('../pages/admin/settings/EmailTemplatesPage'));
const BannerManagementPage = lazy(() => import('../pages/admin/settings/BannerManagementPage'));
const CatalogSettingsPage = lazy(() => import('../pages/admin/settings/CatalogSettingsPage'));
const ShippingPage = lazy(() => import('../pages/admin/settings/ShippingPage'));
const FreightCalculatorPage = lazy(() => import('../pages/admin/FreightCalculatorPage'));
const PermissionsManagementPage = lazy(() => import('../pages/admin/settings/PermissionsManagementPage'));
const CouponsPage = lazy(() => import('../pages/admin/CouponsPage'));
const CashbackPage = lazy(() => import('../pages/admin/CashbackPage'));
const TelegramPage = lazy(() => import('../pages/admin/settings/TelegramPage'));
const SystemTagsPage = lazy(() => import('../pages/admin/settings/SystemTagsPage'));
const WhatsAppPage = lazy(() => import('../pages/admin/settings/WhatsAppPage'));
const WhatsAppMessagesPage = lazy(() => import('../pages/admin/whatsapp/MessagesPage'));
const WhatsAppAiMemoryPage = lazy(() => import('../pages/admin/whatsapp/AiMemoryPage'));
const NovoBotPage = lazy(() => import('../pages/admin/whatsapp/NovoBotPage'));
const PaymentIntegrationsPage = lazy(() => import('../pages/admin/settings/PaymentIntegrationsPage'));
const DisplaysPage = lazy(() => import('../pages/admin/settings/DisplaysPage'));
const DisplayPage = lazy(() => import('../pages/display/DisplayPage'));
const PixReceiptSharePage = lazy(() => import('../pages/store/PixReceiptSharePage').then(module => ({ default: module.PixReceiptSharePage })));
const TabsTestPage = lazy(() => import('../pages/test/TabsTestPage').then(module => ({ default: module.TabsTestPage })));
const CatalogPage = lazy(() => import('../pages/catalog/index'));
const CoinsInfoPage = lazy(() => import('../pages/catalog/CoinsInfoPage'));
const ExtendedWarrantyPage = lazy(() => import('../pages/customer/ExtendedWarrantyPage'));
const CustomerPromotionsPage = lazy(() => import('../pages/customer/PromotionsPage').then(module => ({ default: module.PromotionsPage })));
const FreeScreenProtectorRulesPage = lazy(() => import('../pages/customer/FreeScreenProtectorRulesPage').then(module => ({ default: module.FreeScreenProtectorRulesPage })));
const FeedbackListPage = lazy(() => import('../pages/admin/feedbacks/FeedbackListPage').then(module => ({ default: module.FeedbackListPage })));
const AdminPromotionsPage = lazy(() => import('../pages/admin/promotions/PromotionsPage').then(module => ({ default: module.PromotionsPage })));
const AboutUsPage = lazy(() => import('../pages/catalog/AboutUsPage').then(module => ({ default: module.AboutUsPage })));
const FAQPage = lazy(() => import('../pages/catalog/FAQPage').then(module => ({ default: module.FAQPage })));
const BlingCallbackPage = lazy(() => import('../pages/admin/settings/BlingCallbackPage'));
const CartPage = lazy(() => import('../pages/store/CartPage'));
const OrderConfirmationPage = lazy(() => import('../pages/store/OrderConfirmationPage'));
const OrderTrackingPage = lazy(() => import('../pages/store/OrderTrackingPage'));
const DeliveryOperationPage = lazy(() => import('../pages/delivery/DeliveryOperationPage'));
const OnlineOrdersPage = lazy(() => import('../pages/admin/orders/OnlineOrdersPage'));
const SerializedUnitsPage = lazy(() => import('../pages/admin/inventory/SerializedUnitsPage'));
const SEODashboardPage = lazy(() => import('../pages/admin/settings/SEODashboardPage').then(module => ({ default: module.SEODashboardPage })));
const SEOBlacklistPage = lazy(() => import('../pages/admin/settings/SEOBlacklistPage').then(module => ({ default: module.SEOBlacklistPage })));
const ReviewsPage = lazy(() => import('../pages/admin/catalog/ReviewsPage').then(module => ({ default: module.ReviewsPage })));
const VpsStatusPage = lazy(() => import('../pages/admin/settings/VpsStatusPage').then(module => ({ default: module.VpsStatusPage })));
const SystemBackupPage = lazy(() => import('../pages/admin/settings/SystemBackupPage').then(module => ({ default: module.SystemBackupPage })));
const SynologyFilesPage = lazy(() => import('../pages/admin/settings/SynologyFilesPage').then(module => ({ default: module.SynologyFilesPage })));
const SynologyConfigPage = lazy(() => import('../pages/admin/settings/SynologyConfigPage'));
const FavoritesRankingReport = lazy(() => import('../pages/admin/reports/FavoritesRankingReport'));
const AdminDashboardPage = lazy(() => import('../pages/admin/dashboard/AdminDashboardPage').then(module => ({ default: module.AdminDashboardPage })));
const AdminLayout = lazy(() => import('../layouts/AdminLayout').then(module => ({ default: module.AdminLayout })));

const ProductListPage = lazy(() => import('../pages/admin/products/ProductListPage').then(module => ({ default: module.ProductListPage })));
const ProductLabelPrintPage = lazy(() => import('../pages/admin/products/ProductLabelPrintPage').then(module => ({ default: module.ProductLabelPrintPage })));
const ProductFormPage = lazy(() => import('../pages/admin/products/ProductFormPage').then(module => ({ default: module.ProductFormPage })));
const ProductDetailPage = lazy(() => import('../pages/admin/products/ProductDetailPage').then(module => ({ default: module.ProductDetailPage })));
const ModelProductAggregatorPage = lazy(() => import('../pages/admin/products/ModelProductAggregatorPage').then(module => ({ default: module.ModelProductAggregatorPage })));
const ProductCombosPage = lazy(() => import('../pages/admin/products/ProductCombosPage').then(module => ({ default: module.ProductCombosPage })));
const ProductImageBankPage = lazy(() => import('../pages/admin/products/ProductImageBankPage').then(module => ({ default: module.ProductImageBankPage })));
const InventoryPage = lazy(() => import('../pages/admin/inventory/InventoryPage').then(module => ({ default: module.InventoryPage })));
const StockLocationsPage = lazy(() => import('../pages/admin/inventory/StockLocationsPage').then(module => ({ default: module.StockLocationsPage })));
const InventoryPrintListPage = lazy(() => import('../pages/admin/inventory/InventoryPrintListPage').then(module => ({ default: module.InventoryPrintListPage })));
const BrandsPage = lazy(() => import('../pages/admin/settings/BrandsPage').then(module => ({ default: module.BrandsPage })));
const ModelsPage = lazy(() => import('../pages/admin/settings/ModelsPage').then(module => ({ default: module.ModelsPage })));
const ColorsPage = lazy(() => import('../pages/admin/settings/ColorsPage').then(module => ({ default: module.ColorsPage })));
const CustomerListPage = lazy(() => import('../pages/customers/CustomerListPage'));
const PDVPage = lazy(() => import('../pages/pdv/PDVPage'));
const CatalogConfigPage = lazy(() => import('../pages/admin/CatalogConfigPage'));
const MarketingPage = lazy(() => import('../pages/admin/settings/MarketingPage'));
const SalesPage = lazy(() => import('../pages/admin/sales/SalesPage'));
const BlingPage = lazy(() => import('../pages/admin/settings/BlingPage'));
const ShopeePage = lazy(() => import('../pages/admin/settings/ShopeePage'));
const ShopeeTemplatesPage = lazy(() => import('../pages/admin/settings/ShopeeTemplatesPage'));
const CheckoutPage = lazy(() => import('../pages/store/CheckoutPage'));
const PublicProductPage = lazy(() => import('../pages/store/PublicProductPage').then(module => ({ default: module.PublicProductPage })));
const FinancialPage = lazy(() => import('../pages/admin/financial/FinancialPage'));
const CustomerCreditLedgerPage = lazy(() => import('../pages/admin/financial/CustomerCreditLedgerPage'));
const StandalonePixPage = lazy(() => import('../pages/admin/financial/StandalonePixPage'));
const AccountingPage = lazy(() => import('../pages/admin/accounting/AccountingPage'));
const MySQLExplorerPage = lazy(() => import('../pages/admin/settings/MySQLExplorerPage').then(module => ({ default: module.MySQLExplorerPage })));
const PublicPixPage = lazy(() => import('../pages/store/PublicPixPage'));

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
  // Admin Authentication (VPS)
  {
    path: "/admin/login",
    element: <AdminLoginPage />
  },
  // Customer Authentication (VPS)
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
    path: "/display",
    element: <DisplayPage />
  },
  {
    path: "/pix/:token",
    element: <PublicPixPage />
  },
  {
    path: "/receipt-share/:token",
    element: <PixReceiptSharePage />
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
    path: "/admin/pix-avulso",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><StandalonePixPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/financeiro/crediario",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><CustomerCreditLedgerPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/financial/crediario",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><CustomerCreditLedgerPage /></AdminLayout>
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
    path: "/admin/products/labels",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><ProductLabelPrintPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/products/models/:modelId",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><ModelProductAggregatorPage /></AdminLayout>
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
    path: "/admin/products/offers",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><ProductCombosPage initialOfferMode /></AdminLayout>
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
    path: "/admin/inventory/locations",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><StockLocationsPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/inventory/print-list",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><InventoryPrintListPage /></AdminLayout>
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
    path: "/admin/settings/displays",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><DisplaysPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/email",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><EmailTemplatesPage /></AdminLayout>
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
    path: "/admin/settings/shopee/templates",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><ShopeeTemplatesPage /></AdminLayout>
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
    path: "/admin/whatsapp/mensagens",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><WhatsAppMessagesPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/whatsapp/memoria-ia",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><WhatsAppAiMemoryPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/whatsapp/novo-bot",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><NovoBotPage /></AdminLayout>
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
    path: "/admin/settings/system-backup",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><SystemBackupPage /></AdminLayout>
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
    path: "/admin/customers/:id/preview",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminCustomerProfilePreviewPage />
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
    path: "/produtos/destaques",
    element: (
      <MaintenanceGuard>
        <CartProvider>
          <CatalogPage />
        </CartProvider>
      </MaintenanceGuard>
    )
  },
  {
    path: "/produtos/mais-recentes",
    element: (
      <MaintenanceGuard>
        <CartProvider>
          <CatalogPage />
        </CartProvider>
      </MaintenanceGuard>
    )
  },
  {
    path: "/produtos/mais-vendidos",
    element: (
      <MaintenanceGuard>
        <CartProvider>
          <CatalogPage />
        </CartProvider>
      </MaintenanceGuard>
    )
  },
  // Pagina /produtos/mais-vendidos desabilitada — duplica conteudo de /produtos/destaques
  // ate termos ranking real de vendas. Para reativar: descomentar abaixo e trocar
  // `enabled: false` para `true` em pages/catalog/catalogCollections.js.
  // {
  //   path: "/produtos/mais-vendidos",
  //   element: (
  //     <MaintenanceGuard>
  //       <CartProvider>
  //         <CatalogPage />
  //       </CartProvider>
  //     </MaintenanceGuard>
  //   )
  // },
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
  {
    path: "/delivery/:token",
    element: <DeliveryOperationPage />
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
