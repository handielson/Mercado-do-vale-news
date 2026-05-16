import crypto from 'crypto';

const SHOPEE_API_LIVE_URL = 'https://partner.shopeemobile.com';
const SHOPEE_API_SANDBOX_URL = 'https://partner.test-stable.shopeemobile.com';

function getShopeeBaseUrl(partnerId) {
  if (String(partnerId) === '1229870' || process.env.SHOPEE_ENV === 'sandbox') {
    return SHOPEE_API_SANDBOX_URL;
  }
  return SHOPEE_API_LIVE_URL;
}

function generateSign(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId) {
  const baseString = `${partnerId}${apiPath}${timestamp}${accessToken}${shopId}`;
  return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

function generatePublicSign(partnerId, partnerKey, apiPath, timestamp) {
  const baseString = `${partnerId}${apiPath}${timestamp}`;
  return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

function positiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function safeStock(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

async function getShopeeCredentials(supabase) {
  const { data } = await supabase
    .from('company_settings')
    .select('id, shopee_partner_id, shopee_partner_key, shopee_access_token, shopee_shop_id, shopee_refresh_token')
    .limit(1)
    .maybeSingle();

  if (!data?.shopee_partner_id || !data?.shopee_partner_key || !data?.shopee_access_token || !data?.shopee_shop_id) {
    return null;
  }

  return {
    rowId: data.id,
    partnerId: String(data.shopee_partner_id),
    partnerKey: String(data.shopee_partner_key),
    accessToken: String(data.shopee_access_token),
    shopId: String(data.shopee_shop_id),
    refreshToken: data.shopee_refresh_token ? String(data.shopee_refresh_token) : null,
  };
}

async function refreshShopeeToken(supabase, creds) {
  if (!creds.refreshToken) throw new Error('Shopee refresh_token unavailable');

  const apiPath = '/api/v2/auth/access_token/get';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generatePublicSign(creds.partnerId, creds.partnerKey, apiPath, timestamp);
  const url = `${getShopeeBaseUrl(creds.partnerId)}${apiPath}?partner_id=${creds.partnerId}&timestamp=${timestamp}&sign=${sign}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partner_id: Number(creds.partnerId),
      shop_id: Number(creds.shopId),
      refresh_token: creds.refreshToken,
    }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json();
  if (data.error || !data.access_token) {
    throw new Error(`Shopee token refresh failed: ${data.message || data.error || response.status}`);
  }

  await supabase.from('company_settings').update({
    shopee_access_token: data.access_token,
    shopee_refresh_token: data.refresh_token || creds.refreshToken,
  }).eq('id', creds.rowId);

  creds.accessToken = String(data.access_token);
  creds.refreshToken = data.refresh_token ? String(data.refresh_token) : creds.refreshToken;
  return creds.accessToken;
}

function buildShopeeUrl(apiPath, creds) {
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSign(creds.partnerId, creds.partnerKey, apiPath, timestamp, creds.accessToken, creds.shopId);
  return `${getShopeeBaseUrl(creds.partnerId)}${apiPath}?partner_id=${creds.partnerId}&timestamp=${timestamp}&access_token=${creds.accessToken}&shop_id=${creds.shopId}&sign=${sign}`;
}

async function shopeePost(supabase, apiPath, creds, body) {
  const post = async () => {
    const response = await fetch(buildShopeeUrl(apiPath, creds), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    return response.json();
  };

  let data = await post();
  if ((data?.error === 'invalid_access_token' || data?.error === 'invalid_acceess_token' || data?.error === 'error_auth') && creds.refreshToken) {
    await refreshShopeeToken(supabase, creds);
    data = await post();
  }
  return data;
}

function groupRowsByItem(stockTargets, shopeeRows) {
  const stockByProductId = new Map(
    stockTargets.map(target => [String(target.id), safeStock(target.stock_quantity)])
  );
  const grouped = new Map();

  for (const row of shopeeRows || []) {
    const itemId = positiveNumber(row.shopee_item_id);
    if (!itemId) continue;
    const productId = String(row.product_id || '');
    if (!stockByProductId.has(productId)) continue;
    const stock = stockByProductId.get(productId);
    const modelId = positiveNumber(row.shopee_model_id) || 0;
    const current = grouped.get(itemId) || [];
    current.push({
      model_id: modelId,
      seller_stock: [{ stock }],
    });
    grouped.set(itemId, current);
  }

  return grouped;
}

export async function syncShopeeStockFromBlingTargets(supabase, stockTargets) {
  const targets = Array.isArray(stockTargets)
    ? stockTargets.filter(target => target?.id && target.stock_quantity !== undefined)
    : [];
  if (!targets.length) return { ok: true, skipped: 'no_targets', updated: 0, errors: [] };

  const productIds = [...new Set(targets.map(target => String(target.id)))];
  const { data: rows, error } = await supabase
    .from('shopee_products')
    .select('product_id, shopee_item_id, shopee_model_id')
    .in('product_id', productIds)
    .not('shopee_item_id', 'is', null);

  if (error) return { ok: false, skipped: 'link_lookup_failed', updated: 0, errors: [error.message] };
  if (!rows?.length) return { ok: true, skipped: 'no_shopee_links', updated: 0, errors: [] };

  const creds = await getShopeeCredentials(supabase);
  if (!creds) return { ok: true, skipped: 'shopee_not_configured', updated: 0, errors: [] };

  const grouped = groupRowsByItem(targets, rows);
  let updated = 0;
  const errors = [];

  for (const [itemId, stockList] of grouped.entries()) {
    const payload = { item_id: Number(itemId), stock_list: stockList };
    try {
      const response = await shopeePost(supabase, '/api/v2/product/update_stock', creds, payload);
      if (response?.error) {
        errors.push({ item_id: itemId, error: response.error, message: response.message || null });
      } else {
        updated += stockList.length;
      }
    } catch (err) {
      errors.push({ item_id: itemId, error: err?.message || String(err) });
    }
  }

  if (updated > 0) {
    await supabase
      .from('shopee_products')
      .update({ last_synced_at: new Date().toISOString(), status: 'active' })
      .in('product_id', productIds);
  }

  return { ok: errors.length === 0, updated, errors };
}

export const __test__ = {
  groupRowsByItem,
  safeStock,
};
