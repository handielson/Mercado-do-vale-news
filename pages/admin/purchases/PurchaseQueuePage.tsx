import React from 'react';
import { DashboardPurchaseQueue } from '../../../components/admin/dashboard/DashboardPurchaseQueue';

export const PurchaseQueuePage: React.FC = () => (
  <div className="animate-in fade-in duration-500 space-y-6">
    <div>
      <h2 className="text-3xl font-bold tracking-tight">Compras</h2>
      <p className="mt-1 text-slate-500">Organize a reposicao a partir das vendas consolidadas.</p>
    </div>

    <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900">
      <p className="font-semibold">Como a fila e alimentada</p>
      <p className="mt-1">
        Ao abrir esta tela — ou ao usar <strong>Atualizar fila</strong> — o sistema consolida as vendas do dia e adiciona ou atualiza os itens na fila de compras.
      </p>
    </div>

    <DashboardPurchaseQueue />
  </div>
);
