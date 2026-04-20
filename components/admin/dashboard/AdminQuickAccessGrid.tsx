import React from 'react';

interface AdminQuickAccessGridProps {
  onNavigate: (path: string) => void;
}

type QuickAccessItem = {
  label: string;
  description: string;
  path: string;
  icon: string;
  cardClassName: string;
  iconClassName: string;
  featured?: boolean;
};

const productItems: QuickAccessItem[] = [
  {
    label: 'Produtos',
    description: 'Cadastrar e gerenciar',
    path: '/admin/products',
    icon: '📦',
    cardClassName: 'bg-white border-slate-200 hover:border-green-400',
    iconClassName: 'bg-green-100 group-hover:bg-green-200',
  },
  {
    label: 'Modelos',
    description: 'Modelos e fotos por cor',
    path: '/admin/settings/models',
    icon: '📱',
    cardClassName: 'bg-white border-slate-200 hover:border-blue-400',
    iconClassName: 'bg-blue-100 group-hover:bg-blue-200',
  },
  {
    label: 'Estoque',
    description: 'Movimentações e saldos',
    path: '/admin/inventory',
    icon: '📊',
    cardClassName: 'bg-white border-slate-200 hover:border-yellow-400',
    iconClassName: 'bg-yellow-100 group-hover:bg-yellow-200',
  },
  {
    label: 'Catálogo',
    description: 'Configurar catálogo',
    path: '/admin/settings/catalog',
    icon: '🛍️',
    cardClassName: 'bg-white border-slate-200 hover:border-orange-400',
    iconClassName: 'bg-orange-100 group-hover:bg-orange-200',
  },
  {
    label: 'Bling',
    description: 'Sync ERP / Webhook',
    path: '/admin/settings/bling',
    icon: '🔗',
    cardClassName: 'bg-white border-slate-200 hover:border-orange-400',
    iconClassName: 'bg-orange-50 group-hover:bg-orange-100',
  },
];

const dailyItems: QuickAccessItem[] = [
  {
    label: 'PDV',
    description: 'Ponto de venda',
    path: '/admin/pdv',
    icon: '💰',
    cardClassName: 'bg-white border-slate-200 hover:border-purple-400',
    iconClassName: 'bg-purple-100 group-hover:bg-purple-200',
  },
  {
    label: 'Vendas',
    description: 'Histórico de vendas',
    path: '/admin/sales',
    icon: '📋',
    cardClassName: 'bg-white border-slate-200 hover:border-sky-400',
    iconClassName: 'bg-sky-100 group-hover:bg-sky-200',
  },
  {
    label: 'Pedidos',
    description: 'Pedidos online',
    path: '/admin/orders',
    icon: '🛒',
    cardClassName: 'bg-white border-slate-200 hover:border-teal-400',
    iconClassName: 'bg-teal-100 group-hover:bg-teal-200',
  },
  {
    label: 'Financeiro',
    description: 'Contas e fluxo',
    path: '/admin/financeiro',
    icon: '💳',
    cardClassName: 'bg-white border-slate-200 hover:border-emerald-400',
    iconClassName: 'bg-emerald-100 group-hover:bg-emerald-200',
  },
  {
    label: 'Calcular Frete',
    description: 'Cotação avulsa',
    path: '/admin/settings/shipping?tab=calcular',
    icon: '🚚',
    cardClassName: 'bg-gradient-to-br from-cyan-500 to-blue-600 border-transparent text-white hover:shadow-md',
    iconClassName: 'bg-white/20',
    featured: true,
  },
];

function QuickAccessCard({ item, onNavigate }: { item: QuickAccessItem; onNavigate: (path: string) => void }) {
  return (
    <button
      onClick={() => onNavigate(item.path)}
      className={`${item.cardClassName} p-4 rounded-xl shadow-sm border hover:shadow-md transition-all cursor-pointer group text-left`}
    >
      <div className="flex items-center gap-3 mb-1">
        <div className={`w-9 h-9 ${item.iconClassName} rounded-lg flex items-center justify-center transition-colors`}>
          <span className="text-lg">{item.icon}</span>
        </div>
        <p className={`font-semibold text-sm ${item.featured ? 'text-white' : 'text-slate-800'}`}>{item.label}</p>
      </div>
      <p className={`text-xs ${item.featured ? 'text-blue-100' : 'text-slate-500'}`}>{item.description}</p>
    </button>
  );
}

export const AdminQuickAccessGrid: React.FC<AdminQuickAccessGridProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span>📦</span> Produtos & Catálogo
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {productItems.map((item) => (
            <QuickAccessCard key={item.label} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span>⚡</span> Operações Diárias
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {dailyItems.map((item) => (
            <QuickAccessCard key={item.label} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      </div>
    </div>
  );
};
