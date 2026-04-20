export function buildShopeeDashboardLinks(counts) {
  return [
    { key: 'new', label: 'Novos', count: Number(counts?.newOrders) || 0, href: '/admin/settings/shopee?tab=orders&status=READY_TO_SHIP' },
    { key: 'pending', label: 'Falta enviar', count: Number(counts?.pendingShipment) || 0, href: '/admin/settings/shopee?tab=orders&status=READY_TO_SHIP' },
    { key: 'shipped', label: 'Enviados', count: Number(counts?.shipped) || 0, href: '/admin/settings/shopee?tab=orders&status=PROCESSED' },
    { key: 'cancelled', label: 'Cancelados', count: Number(counts?.cancelled) || 0, href: '/admin/settings/shopee?tab=orders&status=CANCELLED' },
    { key: 'returns', label: 'Reclamacoes/Devolucoes', count: Number(counts?.returnsOrComplaints) || 0, href: '/admin/settings/shopee?tab=orders&status=IN_CANCEL' },
  ];
}

const SHOPEE_AUTH_ERRORS = new Set(['invalid_access_token', 'error_auth']);

async function fetchShopeeOrderList({
  timeFrom,
  timeTo,
  orderStatus,
  retryOnAuth = true,
}) {
  const params = new URLSearchParams({
    action: 'get_order_list',
    time_from: String(timeFrom),
    time_to: String(timeTo),
    page_size: '100',
  });

  if (orderStatus) {
    params.set('order_status', orderStatus);
  }

  const response = await fetch(`/api/shopee-actions?${params.toString()}`);
  const payload = await response.json();
  const errorCode = String(payload?.error || '').trim();

  if (SHOPEE_AUTH_ERRORS.has(errorCode) && retryOnAuth) {
    const refreshResponse = await fetch('/api/shopee-actions?action=refresh_token');
    if (refreshResponse.ok) {
      return fetchShopeeOrderList({
        timeFrom,
        timeTo,
        orderStatus,
        retryOnAuth: false,
      });
    }
  }

  if (!response.ok || payload?.error) {
    throw new Error(payload?.message || payload?.error || 'Falha ao carregar Shopee');
  }

  return Array.isArray(payload?.response?.order_list) ? payload.response.order_list : [];
}

export async function getDashboardShopeeCounts() {
  const timeTo = Math.floor(Date.now() / 1000);
  const timeFrom = timeTo - (14 * 24 * 60 * 60);
  const statusesToLoad = [
    'READY_TO_SHIP',
    'PROCESSED',
    'SHIPPED',
    'COMPLETED',
    'CANCELLED',
    'IN_CANCEL',
  ];

  const loaded = await Promise.all(
    statusesToLoad.map(async (status) => {
      const list = await fetchShopeeOrderList({ timeFrom, timeTo, orderStatus: status });
      return [status, list.length];
    }),
  );

  const countsByStatus = Object.fromEntries(loaded);

  return {
    newOrders: Number(countsByStatus.READY_TO_SHIP) || 0,
    pendingShipment: Number(countsByStatus.READY_TO_SHIP) || 0,
    shipped:
      (Number(countsByStatus.PROCESSED) || 0) +
      (Number(countsByStatus.SHIPPED) || 0) +
      (Number(countsByStatus.COMPLETED) || 0),
    cancelled: Number(countsByStatus.CANCELLED) || 0,
    returnsOrComplaints: Number(countsByStatus.IN_CANCEL) || 0,
  };
}
