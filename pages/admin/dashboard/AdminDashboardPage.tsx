import React from 'react';
import { useNavigate } from 'react-router-dom';
import { feedbackService } from '../../../services/feedbackService';
import { AdminUnreadFeedbackAlert } from '../../../components/admin/dashboard/AdminUnreadFeedbackAlert';
import { AdminQuickAccessGrid } from '../../../components/admin/dashboard/AdminQuickAccessGrid';
import { DashboardKpiCards } from '../../../components/admin/dashboard/DashboardKpiCards';
import { DashboardShopeePanel } from '../../../components/admin/dashboard/DashboardShopeePanel';
import { DashboardSalesDigest } from '../../../components/admin/dashboard/DashboardSalesDigest';
import { DashboardPurchaseQueue } from '../../../components/admin/dashboard/DashboardPurchaseQueue';
import { DashboardSensitiveAccessProvider } from '../../../components/admin/dashboard/DashboardSensitiveAccess';

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [unreadFeedbacks, setUnreadFeedbacks] = React.useState(0);

  React.useEffect(() => {
    feedbackService.getUnreadCount().then(setUnreadFeedbacks).catch(() => {});
  }, []);

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      <DashboardSensitiveAccessProvider>
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

        <AdminUnreadFeedbackAlert unreadFeedbacks={unreadFeedbacks} onClick={() => navigate('/admin/feedbacks')} />
        <AdminQuickAccessGrid onNavigate={navigate} />
        <DashboardKpiCards />
        <DashboardShopeePanel />
        <DashboardSalesDigest />
        <DashboardPurchaseQueue />
      </DashboardSensitiveAccessProvider>
    </div>
  );
};
