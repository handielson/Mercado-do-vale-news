import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import '../../index.css';

const Store = lazy(() => import('../../pages/store/Print3dStorePage'));
const Account = lazy(() => import('../../pages/store/Print3dAccountPage'));
const Action = lazy(() => import('../../pages/store/Print3dAccountActionPage'));
const Google = lazy(() => import('../../pages/store/Print3dGoogleCallbackPage'));
const Checkout = lazy(() => import('../../pages/store/Print3dCheckoutPage'));
const Orders = lazy(() => import('../../pages/store/Print3dOrdersPage'));
const Production = lazy(() => import('../../pages/store/Print3dProductionPage'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><HelmetProvider><BrowserRouter><Suspense fallback={<p role="status">Carregando loja 3D…</p>}><Routes>
    <Route path="/" element={<Navigate to={'/loja-3d' + window.location.search} replace />} />
    <Route path="/loja-3d" element={<Store />} />
    <Route path="/loja-3d/conta" element={<Account />} />
    <Route path="/loja-3d/conta/google/callback" element={<Google />} />
    <Route path="/loja-3d/conta/producao" element={<Production />} />
    <Route path="/loja-3d/checkout" element={<Checkout />} />
    <Route path="/loja-3d/pedidos" element={<Orders />} />
    {['/conta/confirmar-email','/conta/redefinir-senha','/loja-3d/conta/confirmar-email','/loja-3d/conta/redefinir-senha'].map(path => <Route key={path} path={path} element={<Action />} />)}
    <Route path="*" element={<main><h1>Página não encontrada</h1><Link to="/loja-3d">Voltar à loja 3D</Link></main>} />
  </Routes></Suspense></BrowserRouter></HelmetProvider></React.StrictMode>,
);
