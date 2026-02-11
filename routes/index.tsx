

import React from 'react';
import { createBrowserRouter, Navigate, useNavigate } from 'react-router-dom';
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
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { SupabaseProtectedRoute } from '../components/SupabaseProtectedRoute';
import { ClientTypes } from '../utils/field-standards';
import { ProductListPage } from '../pages/admin/products/ProductListPage';
import { ProductFormPage } from '../pages/admin/products/ProductFormPage';
import { ProductDetailPage } from '../pages/admin/products/ProductDetailPage';
import { BulkRegistrationPage } from '../pages/admin/products/BulkRegistrationPage';
import { InventoryPage } from '../pages/admin/inventory/InventoryPage';
import CategorySettingsPage from '../pages/admin/settings/categories/index';
import NewCategoryPage from '../pages/admin/settings/categories/new';
import EditCategoryPage from '../pages/admin/settings/categories/[id]/edit';
import FieldsManagementPage from '../pages/admin/settings/fields';
import { GovernancePage } from '../pages/admin/GovernancePage';
import { DevDiaryPage } from '../pages/admin/DevDiaryPage';
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
import BannerManagementPage from '../pages/admin/settings/BannerManagementPage';
import CatalogSettingsPage from '../pages/admin/settings/CatalogSettingsPage';
import CatalogConfigPage from '../pages/admin/CatalogConfigPage';
import PermissionsManagementPage from '../pages/admin/settings/PermissionsManagementPage';
import CatalogEditorPage from '../pages/admin/catalog-editor';
import { TabsTestPage } from '../pages/test/TabsTestPage';
import CatalogPage from '../pages/catalog/index';
import LegacyMigrationPage from '../pages/LegacyMigration';
import FieldMappingPage from '../pages/FieldMappingPage';
import { EntradaPage } from '../pages/admin/EntradaPage';


// Temporary components (will be moved to separate files in next phase)
const DashboardPage = () => {
  const navigate = useNavigate();

  return (
    <div className="animate-in fade-in duration-500">
      <h2 className="text-3xl font-bold tracking-tight">Visão Geral</h2>
      <p className="text-slate-500">Gestão operacional do ecossistema.</p>

      {/* Quick Access Cards */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">⚡ Acesso Rápido</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/admin/settings/models')}
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <span className="text-xl">📱</span>
              </div>
              <p className="font-semibold text-slate-800">Modelos</p>
            </div>
            <p className="text-xs text-slate-500">Gerenciar modelos e fotos por cor</p>
          </button>

          <button
            onClick={() => navigate('/admin/products')}
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-green-400 hover:shadow-md transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <span className="text-xl">📦</span>
              </div>
              <p className="font-semibold text-slate-800">Produtos</p>
            </div>
            <p className="text-xs text-slate-500">Cadastrar e gerenciar produtos</p>
          </button>

          <button
            onClick={() => navigate('/admin/pdv')}
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <span className="text-xl">💰</span>
              </div>
              <p className="font-semibold text-slate-800">PDV</p>
            </div>
            <p className="text-xs text-slate-500">Ponto de venda</p>
          </button>

          <button
            onClick={() => navigate('/admin/settings/catalog')}
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-orange-400 hover:shadow-md transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                <span className="text-xl">🛍️</span>
              </div>
              <p className="font-semibold text-slate-800">Catálogo</p>
            </div>
            <p className="text-xs text-slate-500">Configurar catálogo público</p>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">📊 Estatísticas</h3>
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
  // Customer Catalog
  {
    path: "/catalog",
    element: <CustomerCatalogPage />
  },
  // Customer Profile
  {
    path: "/perfil",
    element: <CustomerProfilePage />
  },
  // Admin Dashboard (Supabase Auth)
  {
    path: "/admin/dashboard",
    element: (
      <SupabaseProtectedRoute requireAdmin={true}>
        <AdminDashboardPage />
      </SupabaseProtectedRoute>
    )
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
    path: "/admin/entrada",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><EntradaPage /></AdminLayout>
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
    path: "/admin/products/bulk",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><BulkRegistrationPage /></AdminLayout>
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
    path: "/admin/governance",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><GovernancePage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/dev-diary",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><DevDiaryPage /></AdminLayout>
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
      <ProtectedRoute requiredRole={ClientTypes.ADMIN}>
        <AdminLayout><PermissionsManagementPage /></AdminLayout>
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
    path: "/catalog",
    element: <CatalogPage />
  },
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
    element: <CatalogPage />
  },
  {
    path: "*",
    element: <div className="p-20 text-center font-medium text-slate-500">404 - Página não encontrada</div>
  }
]);

