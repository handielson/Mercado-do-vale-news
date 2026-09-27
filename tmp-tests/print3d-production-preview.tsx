import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AdminProduction from '../pages/admin/products/Print3dProductionPage';
import CustomerProduction from '../pages/store/Print3dProductionPage';
import '../index.css';
const admin = new URLSearchParams(location.search).get('view') === 'admin';
createRoot(document.getElementById('root')!).render(<BrowserRouter>{admin ? <AdminProduction /> : <CustomerProduction />}</BrowserRouter>);
