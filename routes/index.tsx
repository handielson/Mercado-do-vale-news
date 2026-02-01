
import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '../pages/auth/LoginPage';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { ClientTypes } from '../utils/field-standards';
import { ProductListPage } from '../pages/admin/products/ProductListPage';
import { ProductFormPage } from '../pages/admin/products/ProductFormPage';
import { ProductDetailPage } from '../pages/admin/products/ProductDetailPage';
import CategorySettingsPage from '../pages/admin/settings/categories/index';
import NewCategoryPage from '../pages/admin/settings/categories/new';
import EditCategoryPage from '../pages/admin/settings/categories/[id]/edit';
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

// Temporary components (will be moved to separate files in next phase)
const DashboardPage = () => (
  <div className="animate-in fade-in duration-500">
    <h2 className="text-3xl font-bold tracking-tight">Visão Geral</h2>
    <p className="text-slate-500">Gestão operacional do ecossistema.</p>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
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
);

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
  {
    path: "/login",
    element: <LoginPage />
  },
  {
    path: "/admin",
    element: (
      <ProtectedRoute requiredRole={[ClientTypes.ATACADO, ClientTypes.REVENDA]}>
        <AdminLayout><DashboardPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/products",
    element: (
      <ProtectedRoute requiredRole={[ClientTypes.ATACADO, ClientTypes.REVENDA]}>
        <AdminLayout><ProductListPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/products/new",
    element: (
      <ProtectedRoute requiredRole={[ClientTypes.ATACADO, ClientTypes.REVENDA]}>
        <AdminLayout><ProductFormPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/products/:id",
    element: (
      <ProtectedRoute requiredRole={[ClientTypes.ATACADO, ClientTypes.REVENDA]}>
        <AdminLayout><ProductDetailPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/categories",
    element: (
      <ProtectedRoute requiredRole={[ClientTypes.ATACADO, ClientTypes.REVENDA]}>
        <AdminLayout><CategorySettingsPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/categories/new",
    element: (
      <ProtectedRoute requiredRole={[ClientTypes.ATACADO, ClientTypes.REVENDA]}>
        <AdminLayout><NewCategoryPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/categories/:id/edit",
    element: (
      <ProtectedRoute requiredRole={[ClientTypes.ATACADO, ClientTypes.REVENDA]}>
        <AdminLayout><EditCategoryPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/brands",
    element: (
      <ProtectedRoute requiredRole={[ClientTypes.ATACADO, ClientTypes.REVENDA]}>
        <AdminLayout><BrandsPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/models",
    element: (
      <ProtectedRoute requiredRole={[ClientTypes.ATACADO, ClientTypes.REVENDA]}>
        <AdminLayout><ModelsPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/colors",
    element: (
      <ProtectedRoute requiredRole={[ClientTypes.ATACADO, ClientTypes.REVENDA]}>
        <AdminLayout><ColorsPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/storages",
    element: (
      <ProtectedRoute requiredRole={[ClientTypes.ATACADO, ClientTypes.REVENDA]}>
        <AdminLayout><StoragesPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/rams",
    element: (
      <ProtectedRoute requiredRole={[ClientTypes.ATACADO, ClientTypes.REVENDA]}>
        <AdminLayout><RamsPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/versions",
    element: (
      <ProtectedRoute requiredRole={[ClientTypes.ATACADO, ClientTypes.REVENDA]}>
        <AdminLayout><VersionsPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/battery-healths",
    element: (
      <ProtectedRoute requiredRole={[ClientTypes.ATACADO, ClientTypes.REVENDA]}>
        <AdminLayout><BatteryHealthsPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/settings/fields",
    element: (
      <ProtectedRoute requiredRole={[ClientTypes.ATACADO, ClientTypes.REVENDA]}>
        <AdminLayout><FieldConfigPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/governance",
    element: (
      <ProtectedRoute requiredRole={[ClientTypes.ATACADO, ClientTypes.REVENDA]}>
        <AdminLayout><GovernancePage /></AdminLayout>
      </ProtectedRoute>
    )
  },
  {
    path: "/admin/dev-diary",
    element: (
      <ProtectedRoute requiredRole={[ClientTypes.ATACADO, ClientTypes.REVENDA]}>
        <AdminLayout><DevDiaryPage /></AdminLayout>
      </ProtectedRoute>
    )
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
    loader: () => {
      // In dev mode, always go to admin. In production, this would check auth.
      return new Response(null, {
        status: 302,
        headers: { Location: "/admin" }
      });
    },
    element: <div>Redirecionando...</div>
  },
  {
    path: "*",
    element: <div className="p-20 text-center font-medium text-slate-500">404 - Página não encontrada</div>
  }
]);
