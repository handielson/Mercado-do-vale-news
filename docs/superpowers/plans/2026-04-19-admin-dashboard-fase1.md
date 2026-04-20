# Admin Dashboard Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extrair a home admin para componentes próprios e substituir os cards estáticos por KPIs reais do dia e um bloco operacional da Shopee, preservando atalhos, navegação e resiliência do painel atual.

**Architecture:** A rota `/admin` continuará existindo, mas deixará de renderizar um dashboard inline dentro de `routes/index.tsx`. A nova home será composta por um componente de página enxuto e blocos isolados com carregamento independente: alerta de mensagens, atalhos, KPIs financeiros e painel Shopee. Os dados serão buscados por dois serviços dedicados, cada um com normalização defensiva e fallback para erro local, para que um bloco falhando não derrube os outros.

**Tech Stack:** React 18, TypeScript, React Router, Supabase client, serviços existentes do projeto, Tailwind utility classes, testes Node `.mjs` com `assert`.

---

## File Structure

### New files

- `mercado-do-vale/pages/admin/dashboard/AdminDashboardPage.tsx`
  - página principal do dashboard admin
- `mercado-do-vale/components/admin/dashboard/AdminUnreadFeedbackAlert.tsx`
  - alerta de mensagens não lidas
- `mercado-do-vale/components/admin/dashboard/AdminQuickAccessGrid.tsx`
  - atalhos atuais preservados
- `mercado-do-vale/components/admin/dashboard/DashboardKpiCards.tsx`
  - cards de faturamento e lucro do dia
- `mercado-do-vale/components/admin/dashboard/DashboardShopeePanel.tsx`
  - bloco Shopee com contadores e links
- `mercado-do-vale/services/dashboardMetricsService.ts`
  - leitura e cálculo de faturamento/lucro do dia
- `mercado-do-vale/services/dashboardShopeeService.ts`
  - leitura dos status operacionais da Shopee
- `mercado-do-vale/services/dashboardMetricsService.test.mjs`
  - teste de normalização e cálculo dos KPIs
- `mercado-do-vale/services/dashboardShopeeService.test.mjs`
  - teste de mapeamento dos status Shopee

### Modified files

- `mercado-do-vale/routes/index.tsx`
  - trocar o dashboard inline pela nova página `AdminDashboardPage`

## Task 1: Create failing tests for dashboard services

**Files:**
- Create: `mercado-do-vale/services/dashboardMetricsService.test.mjs`
- Create: `mercado-do-vale/services/dashboardShopeeService.test.mjs`
- Test: `mercado-do-vale/services/dashboardMetricsService.test.mjs`
- Test: `mercado-do-vale/services/dashboardShopeeService.test.mjs`

- [ ] **Step 1: Write the failing metrics service test**

```javascript
import assert from 'node:assert/strict';
import {
  buildDailyDashboardMetrics,
  isSameLocalDay,
} from './dashboardMetricsService.js';

assert.equal(isSameLocalDay('2026-04-19T10:00:00-03:00', new Date('2026-04-19T22:00:00-03:00')), true);
assert.equal(isSameLocalDay('2026-04-18T23:59:00-03:00', new Date('2026-04-19T08:00:00-03:00')), false);

const metrics = buildDailyDashboardMetrics({
  sales: [
    { created_at: '2026-04-19T09:00:00-03:00', total_amount: 10000, items: [{ quantity: 1, unit_price: 10000, cost_price: 7000 }] },
    { created_at: '2026-04-19T11:00:00-03:00', total_amount: 5000, items: [{ quantity: 2, unit_price: 2500, cost_price: 1500 }] },
    { created_at: '2026-04-18T11:00:00-03:00', total_amount: 9999, items: [{ quantity: 1, unit_price: 9999, cost_price: 1 }] },
  ],
  now: new Date('2026-04-19T18:00:00-03:00'),
});

assert.deepEqual(metrics, {
  revenueCents: 15000,
  profitCents: 5000,
  salesCount: 2,
});

console.log('dashboardMetricsService.test.mjs: ok');
```

- [ ] **Step 2: Write the failing Shopee service test**

```javascript
import assert from 'node:assert/strict';
import { buildShopeeDashboardLinks } from './dashboardShopeeService.js';

const links = buildShopeeDashboardLinks({
  pendingShipment: 4,
  shipped: 8,
  newOrders: 3,
  cancelled: 1,
  returnsOrComplaints: 2,
});

assert.deepEqual(links.map((entry) => ({
  key: entry.key,
  count: entry.count,
  href: entry.href,
})), [
  { key: 'new', count: 3, href: '/admin/settings/shopee?tab=orders&status=READY_TO_SHIP' },
  { key: 'pending', count: 4, href: '/admin/settings/shopee?tab=orders&status=READY_TO_SHIP' },
  { key: 'shipped', count: 8, href: '/admin/settings/shopee?tab=orders&status=PROCESSED' },
  { key: 'cancelled', count: 1, href: '/admin/settings/shopee?tab=orders&status=CANCELLED' },
  { key: 'returns', count: 2, href: '/admin/settings/shopee?tab=orders&status=TO_RETURN' },
]);

console.log('dashboardShopeeService.test.mjs: ok');
```

- [ ] **Step 3: Run metrics service test to verify it fails**

Run: `node mercado-do-vale/services/dashboardMetricsService.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `dashboardMetricsService.js`

- [ ] **Step 4: Run Shopee service test to verify it fails**

Run: `node mercado-do-vale/services/dashboardShopeeService.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `dashboardShopeeService.js`

- [ ] **Step 5: Commit**

```bash
git add mercado-do-vale/services/dashboardMetricsService.test.mjs mercado-do-vale/services/dashboardShopeeService.test.mjs
git commit -m "test: add dashboard phase 1 service tests"
```

## Task 2: Implement dashboard metrics service

**Files:**
- Create: `mercado-do-vale/services/dashboardMetricsService.ts`
- Test: `mercado-do-vale/services/dashboardMetricsService.test.mjs`

- [ ] **Step 1: Write the minimal metrics service implementation**

```typescript
type DashboardSaleItem = {
  quantity?: number;
  unit_price?: number;
  cost_price?: number;
};

type DashboardSale = {
  created_at?: string;
  total_amount?: number;
  items?: DashboardSaleItem[];
};

export function isSameLocalDay(value: string | undefined, now: Date): boolean {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getFullYear() === now.getFullYear()
    && parsed.getMonth() === now.getMonth()
    && parsed.getDate() === now.getDate();
}

export function buildDailyDashboardMetrics({
  sales,
  now = new Date(),
}: {
  sales: DashboardSale[];
  now?: Date;
}) {
  return sales.reduce((acc, sale) => {
    if (!isSameLocalDay(sale.created_at, now)) return acc;

    const saleRevenue = Number(sale.total_amount) || 0;
    const saleProfit = (sale.items || []).reduce((profitAcc, item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const costPrice = Number(item.cost_price) || 0;
      return profitAcc + ((unitPrice - costPrice) * quantity);
    }, 0);

    return {
      revenueCents: acc.revenueCents + saleRevenue,
      profitCents: acc.profitCents + saleProfit,
      salesCount: acc.salesCount + 1,
    };
  }, {
    revenueCents: 0,
    profitCents: 0,
    salesCount: 0,
  });
}
```

- [ ] **Step 2: Run metrics service test to verify it passes**

Run: `node mercado-do-vale/services/dashboardMetricsService.test.mjs`

Expected: PASS with `dashboardMetricsService.test.mjs: ok`

- [ ] **Step 3: Refine the service with async data-loading function**

```typescript
import { supabase } from './supabase';

export async function getDashboardDailyMetrics(now = new Date()) {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('sales')
    .select('created_at, total_amount, items:sale_items(quantity, unit_price, cost_price)')
    .gte('created_at', dayStart.toISOString())
    .lte('created_at', now.toISOString());

  if (error) {
    throw error;
  }

  return buildDailyDashboardMetrics({
    sales: Array.isArray(data) ? data : [],
    now,
  });
}
```

- [ ] **Step 4: Re-run metrics service test to verify it still passes**

Run: `node mercado-do-vale/services/dashboardMetricsService.test.mjs`

Expected: PASS with `dashboardMetricsService.test.mjs: ok`

- [ ] **Step 5: Commit**

```bash
git add mercado-do-vale/services/dashboardMetricsService.ts mercado-do-vale/services/dashboardMetricsService.test.mjs
git commit -m "feat: add dashboard daily metrics service"
```

## Task 3: Implement Shopee dashboard service

**Files:**
- Create: `mercado-do-vale/services/dashboardShopeeService.ts`
- Test: `mercado-do-vale/services/dashboardShopeeService.test.mjs`

- [ ] **Step 1: Write the minimal Shopee mapping implementation**

```typescript
export function buildShopeeDashboardLinks(counts: {
  pendingShipment?: number;
  shipped?: number;
  newOrders?: number;
  cancelled?: number;
  returnsOrComplaints?: number;
}) {
  return [
    { key: 'new', label: 'Novos', count: Number(counts.newOrders) || 0, href: '/admin/settings/shopee?tab=orders&status=READY_TO_SHIP' },
    { key: 'pending', label: 'Falta enviar', count: Number(counts.pendingShipment) || 0, href: '/admin/settings/shopee?tab=orders&status=READY_TO_SHIP' },
    { key: 'shipped', label: 'Enviados', count: Number(counts.shipped) || 0, href: '/admin/settings/shopee?tab=orders&status=PROCESSED' },
    { key: 'cancelled', label: 'Cancelados', count: Number(counts.cancelled) || 0, href: '/admin/settings/shopee?tab=orders&status=CANCELLED' },
    { key: 'returns', label: 'Reclamacoes/Devolucoes', count: Number(counts.returnsOrComplaints) || 0, href: '/admin/settings/shopee?tab=orders&status=TO_RETURN' },
  ];
}
```

- [ ] **Step 2: Run Shopee service test to verify it passes**

Run: `node mercado-do-vale/services/dashboardShopeeService.test.mjs`

Expected: PASS with `dashboardShopeeService.test.mjs: ok`

- [ ] **Step 3: Add async loader for Shopee counts**

```typescript
import { fetchJsonStrict } from '../pages/admin/settings/ShopeePage';

export async function getDashboardShopeeCounts() {
  const data = await fetch(`/api/shopee-actions?action=get_order_list&time_from=0&time_to=${Math.floor(Date.now() / 1000)}&page_size=100`);
  const payload = await data.json();
  const orders = payload?.response?.order_list || [];

  return {
    newOrders: orders.filter((order: any) => order.order_status === 'READY_TO_SHIP').length,
    pendingShipment: orders.filter((order: any) => order.order_status === 'READY_TO_SHIP').length,
    shipped: orders.filter((order: any) => order.order_status === 'PROCESSED').length,
    cancelled: orders.filter((order: any) => order.order_status === 'CANCELLED').length,
    returnsOrComplaints: orders.filter((order: any) => ['TO_RETURN', 'IN_CANCEL'].includes(order.order_status)).length,
  };
}
```

- [ ] **Step 4: Re-run Shopee service test to verify it still passes**

Run: `node mercado-do-vale/services/dashboardShopeeService.test.mjs`

Expected: PASS with `dashboardShopeeService.test.mjs: ok`

- [ ] **Step 5: Commit**

```bash
git add mercado-do-vale/services/dashboardShopeeService.ts mercado-do-vale/services/dashboardShopeeService.test.mjs
git commit -m "feat: add dashboard shopee service"
```

## Task 4: Extract the admin dashboard page shell

**Files:**
- Create: `mercado-do-vale/pages/admin/dashboard/AdminDashboardPage.tsx`
- Create: `mercado-do-vale/components/admin/dashboard/AdminUnreadFeedbackAlert.tsx`
- Create: `mercado-do-vale/components/admin/dashboard/AdminQuickAccessGrid.tsx`
- Modify: `mercado-do-vale/routes/index.tsx`

- [ ] **Step 1: Write the new admin dashboard page component**

```tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { feedbackService } from '../../../services/feedbackService';
import { AdminUnreadFeedbackAlert } from '../../../components/admin/dashboard/AdminUnreadFeedbackAlert';
import { AdminQuickAccessGrid } from '../../../components/admin/dashboard/AdminQuickAccessGrid';
import { DashboardKpiCards } from '../../../components/admin/dashboard/DashboardKpiCards';
import { DashboardShopeePanel } from '../../../components/admin/dashboard/DashboardShopeePanel';

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [unreadFeedbacks, setUnreadFeedbacks] = React.useState(0);

  React.useEffect(() => {
    feedbackService.getUnreadCount().then(setUnreadFeedbacks).catch(() => {});
  }, []);

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Visao Geral</h2>
          <p className="text-slate-500">Gestao operacional do ecossistema.</p>
        </div>
        <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-indigo-600 to-blue-700 text-white text-sm font-semibold rounded-xl shadow hover:shadow-md hover:-translate-y-0.5 transition-all whitespace-nowrap">
          <span>Loja</span>
        </a>
      </div>

      <AdminUnreadFeedbackAlert unreadFeedbacks={unreadFeedbacks} onClick={() => navigate('/admin/feedbacks')} />
      <AdminQuickAccessGrid onNavigate={navigate} />
      <DashboardKpiCards />
      <DashboardShopeePanel />
    </div>
  );
};
```

- [ ] **Step 2: Write the alert and quick access components**

```tsx
export const AdminUnreadFeedbackAlert = ({ unreadFeedbacks, onClick }) => {
  if (!unreadFeedbacks) return null;
  return (
    <div onClick={onClick} className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm cursor-pointer hover:bg-amber-100 transition-colors">
      <h3 className="text-amber-800 font-bold text-sm">Atencao: Novas Mensagens!</h3>
      <p className="text-amber-700 text-sm mt-0.5">Voce tem {unreadFeedbacks} mensagens aguardando leitura.</p>
    </div>
  );
};
```

```tsx
const productLinks = [
  { label: 'Produtos', href: '/admin/products', accent: 'green' },
  { label: 'Modelos', href: '/admin/settings/models', accent: 'blue' },
  { label: 'Estoque', href: '/admin/inventory', accent: 'yellow' },
  { label: 'Catalogo', href: '/admin/settings/catalog', accent: 'orange' },
  { label: 'Bling', href: '/admin/settings/bling', accent: 'orange' },
];
```

- [ ] **Step 3: Replace inline dashboard usage in the router**

```tsx
import { AdminDashboardPage } from '../pages/admin/dashboard/AdminDashboardPage';

{
  path: "/admin",
  element: (
    <ProtectedRoute requireAdmin={true}>
      <AdminLayout><AdminDashboardPage /></AdminLayout>
    </ProtectedRoute>
  )
}
```

- [ ] **Step 4: Run the app build to verify routing still works**

Run: `npm.cmd run build`

Expected: `✓ built` with no TypeScript error for `/admin`

- [ ] **Step 5: Commit**

```bash
git add mercado-do-vale/pages/admin/dashboard/AdminDashboardPage.tsx mercado-do-vale/components/admin/dashboard/AdminUnreadFeedbackAlert.tsx mercado-do-vale/components/admin/dashboard/AdminQuickAccessGrid.tsx mercado-do-vale/routes/index.tsx
git commit -m "refactor: extract admin dashboard page shell"
```

## Task 5: Implement KPI cards with isolated loading

**Files:**
- Create: `mercado-do-vale/components/admin/dashboard/DashboardKpiCards.tsx`
- Modify: `mercado-do-vale/services/dashboardMetricsService.ts`

- [ ] **Step 1: Write the KPI cards component with local loading and error state**

```tsx
import React from 'react';
import { getDashboardDailyMetrics } from '../../../services/dashboardMetricsService';

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100);
}

export const DashboardKpiCards: React.FC = () => {
  const [state, setState] = React.useState({ revenueCents: 0, profitCents: 0, salesCount: 0, loading: true, error: '' });

  React.useEffect(() => {
    let active = true;
    getDashboardDailyMetrics()
      .then((metrics) => {
        if (!active) return;
        setState({ ...metrics, loading: false, error: '' });
      })
      .catch(() => {
        if (!active) return;
        setState((prev) => ({ ...prev, loading: false, error: 'Nao foi possivel carregar os KPIs do dia.' }));
      });
    return () => { active = false; };
  }, []);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Visao Financeira</h3>
      {state.error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{state.error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-blue-500">
          <p className="text-xs font-semibold text-slate-500 uppercase">Faturamento do Dia</p>
          <p className="text-2xl font-bold mt-1">{state.loading ? '...' : formatCurrency(state.revenueCents)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-green-500">
          <p className="text-xs font-semibold text-slate-500 uppercase">Lucro do Dia</p>
          <p className="text-2xl font-bold mt-1">{state.loading ? '...' : formatCurrency(state.profitCents)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-violet-500">
          <p className="text-xs font-semibold text-slate-500 uppercase">Vendas do Dia</p>
          <p className="text-2xl font-bold mt-1">{state.loading ? '...' : state.salesCount}</p>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Add defensive fallback for missing sale item costs**

```typescript
const saleProfit = (sale.items || []).reduce((profitAcc, item) => {
  const quantity = Number(item.quantity) || 0;
  const unitPrice = Number(item.unit_price) || 0;
  const costPrice = Number(item.cost_price ?? item.unit_cost ?? 0) || 0;
  return profitAcc + ((unitPrice - costPrice) * quantity);
}, 0);
```

- [ ] **Step 3: Run metrics service test again**

Run: `node mercado-do-vale/services/dashboardMetricsService.test.mjs`

Expected: PASS with `dashboardMetricsService.test.mjs: ok`

- [ ] **Step 4: Run the app build to verify the KPI cards compile**

Run: `npm.cmd run build`

Expected: `✓ built`

- [ ] **Step 5: Commit**

```bash
git add mercado-do-vale/components/admin/dashboard/DashboardKpiCards.tsx mercado-do-vale/services/dashboardMetricsService.ts
git commit -m "feat: add dashboard financial kpis"
```

## Task 6: Implement Shopee operational panel

**Files:**
- Create: `mercado-do-vale/components/admin/dashboard/DashboardShopeePanel.tsx`
- Modify: `mercado-do-vale/services/dashboardShopeeService.ts`

- [ ] **Step 1: Write the Shopee panel component**

```tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { buildShopeeDashboardLinks, getDashboardShopeeCounts } from '../../../services/dashboardShopeeService';

export const DashboardShopeePanel: React.FC = () => {
  const [state, setState] = React.useState({ loading: true, error: '', entries: [] as ReturnType<typeof buildShopeeDashboardLinks> });

  React.useEffect(() => {
    let active = true;
    getDashboardShopeeCounts()
      .then((counts) => {
        if (!active) return;
        setState({ loading: false, error: '', entries: buildShopeeDashboardLinks(counts) });
      })
      .catch(() => {
        if (!active) return;
        setState({ loading: false, error: 'Nao foi possivel carregar a operacao da Shopee.', entries: [] });
      });
    return () => { active = false; };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Shopee</h3>
        <Link to="/admin/settings/shopee" className="text-sm font-medium text-orange-600 hover:text-orange-700">Abrir painel</Link>
      </div>
      {state.error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{state.error}</div>}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(state.loading ? new Array(5).fill(null) : state.entries).map((entry, index) => (
          entry ? (
            <Link key={entry.key} to={entry.href} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-orange-300 hover:shadow-md transition-all">
              <p className="text-xs font-semibold text-slate-500 uppercase">{entry.label}</p>
              <p className="text-2xl font-bold mt-2 text-slate-900">{entry.count}</p>
            </Link>
          ) : (
            <div key={index} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 animate-pulse">
              <div className="h-3 w-20 rounded bg-slate-200" />
              <div className="h-8 w-12 rounded bg-slate-200 mt-3" />
            </div>
          )
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Adjust the Shopee status mapping to keep labels and routes stable**

```typescript
export function buildShopeeDashboardLinks(counts: {
  pendingShipment?: number;
  shipped?: number;
  newOrders?: number;
  cancelled?: number;
  returnsOrComplaints?: number;
}) {
  return [
    { key: 'new', label: 'Novos', count: Number(counts.newOrders) || 0, href: '/admin/settings/shopee?tab=orders&status=READY_TO_SHIP' },
    { key: 'pending', label: 'Falta enviar', count: Number(counts.pendingShipment) || 0, href: '/admin/settings/shopee?tab=orders&status=READY_TO_SHIP' },
    { key: 'shipped', label: 'Enviados', count: Number(counts.shipped) || 0, href: '/admin/settings/shopee?tab=orders&status=PROCESSED' },
    { key: 'cancelled', label: 'Cancelados', count: Number(counts.cancelled) || 0, href: '/admin/settings/shopee?tab=orders&status=CANCELLED' },
    { key: 'returns', label: 'Reclamacoes/Devolucoes', count: Number(counts.returnsOrComplaints) || 0, href: '/admin/settings/shopee?tab=orders&status=TO_RETURN' },
  ];
}
```

- [ ] **Step 3: Run Shopee service test again**

Run: `node mercado-do-vale/services/dashboardShopeeService.test.mjs`

Expected: PASS with `dashboardShopeeService.test.mjs: ok`

- [ ] **Step 4: Run the app build to verify the Shopee panel compiles**

Run: `npm.cmd run build`

Expected: `✓ built`

- [ ] **Step 5: Commit**

```bash
git add mercado-do-vale/components/admin/dashboard/DashboardShopeePanel.tsx mercado-do-vale/services/dashboardShopeeService.ts
git commit -m "feat: add dashboard shopee operations panel"
```

## Task 7: Final verification for Phase 1

**Files:**
- Modify: `mercado-do-vale/docs/superpowers/plans/2026-04-19-admin-dashboard-fase1.md`

- [ ] **Step 1: Run both service tests**

Run: `node mercado-do-vale/services/dashboardMetricsService.test.mjs`

Expected: PASS with `dashboardMetricsService.test.mjs: ok`

Run: `node mercado-do-vale/services/dashboardShopeeService.test.mjs`

Expected: PASS with `dashboardShopeeService.test.mjs: ok`

- [ ] **Step 2: Run full build**

Run: `npm.cmd run build`

Expected: `✓ built`

- [ ] **Step 3: Manually verify the `/admin` page**

Check:

- quick access cards still navigate
- unread feedback alert still appears when applicable
- KPI section renders values or safe error box
- Shopee section renders counters or safe error box
- no block hides the rest of the dashboard on failure

- [ ] **Step 4: Update the plan checklist with completed items**

```markdown
- [x] Task 1 completed
- [x] Task 2 completed
- [x] Task 3 completed
- [x] Task 4 completed
- [x] Task 5 completed
- [x] Task 6 completed
- [x] Task 7 completed
```

- [ ] **Step 5: Commit**

```bash
git add mercado-do-vale/docs/superpowers/plans/2026-04-19-admin-dashboard-fase1.md
git commit -m "docs: mark dashboard phase 1 plan execution"
```

## Self-Review

Spec coverage:

- Fase 1 coberta por Tasks 2 a 6
- extração do dashboard inline coberta por Task 4
- KPIs reais cobertos por Tasks 1, 2 e 5
- bloco Shopee com links diretos coberto por Tasks 3 e 6
- tolerância a falhas coberta por Tasks 5 e 6

Placeholder scan:

- sem `TODO`
- sem referências vagas a “tratar depois”
- todos os passos com arquivos, comandos ou snippets concretos

Type consistency:

- `buildDailyDashboardMetrics`, `getDashboardDailyMetrics`, `buildShopeeDashboardLinks` e `getDashboardShopeeCounts` foram usados de forma consistente em testes e componentes

