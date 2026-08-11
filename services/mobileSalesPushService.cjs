const crypto = require('crypto');
const fs = require('fs');

const CHANNELS = new Set(['online', 'pdv', 'shopee', 'tiktok']);
const OPERATIONAL_CHANNELS = new Set([...CHANNELS, 'n8n']);
const INVALID_FCM_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);
const MAX_SALE_NOTIFICATION_AGE_MS = 30 * 60 * 1000;
const MAX_SALE_NOTIFICATION_FUTURE_SKEW_MS = 5 * 60 * 1000;

function boundedText(value, maxLength = 255) {
  return String(value || '').trim().slice(0, maxLength);
}

function parseJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function normalizeChannel(value) {
  const channel = boundedText(value, 20).toLowerCase();
  if (!CHANNELS.has(channel)) throw new Error('Canal de venda invalido.');
  return channel;
}

function normalizeOperationalChannel(value) {
  const channel = boundedText(value, 20).toLowerCase();
  if (!OPERATIONAL_CHANNELS.has(channel)) throw new Error('Canal operacional invalido.');
  return channel;
}

function normalizeCents(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
}

function normalizeSale(input) {
  const channel = normalizeChannel(input?.channel);
  const externalId = boundedText(input?.external_id || input?.id, 255);
  if (!externalId) throw new Error('Identificador da venda obrigatorio.');
  const occurredAt = input?.occurred_at ? new Date(input.occurred_at) : new Date();
  const safeOccurredAt = Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt;
  const details = input?.details && typeof input.details === 'object' ? input.details : {};

  return {
    channel,
    external_id: externalId,
    status: boundedText(input?.status || 'confirmed', 80) || 'confirmed',
    customer_name: boundedText(input?.customer_name || 'Cliente', 255) || 'Cliente',
    total_cents: normalizeCents(input?.total_cents),
    currency: boundedText(input?.currency || 'BRL', 12).toUpperCase() || 'BRL',
    occurred_at: safeOccurredAt,
    details,
  };
}

function isSaleFreshForNotification(sale, nowMs = Date.now()) {
  const occurredAtMs = sale?.occurred_at instanceof Date
    ? sale.occurred_at.getTime()
    : new Date(sale?.occurred_at || 0).getTime();
  if (!Number.isFinite(occurredAtMs)) return false;
  const ageMs = Number(nowMs) - occurredAtMs;
  return ageMs >= -MAX_SALE_NOTIFICATION_FUTURE_SKEW_MS
    && ageMs <= MAX_SALE_NOTIFICATION_AGE_MS;
}

function parseFirebaseServiceAccount() {
  const rawJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  const rawBase64 = String(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '').trim();
  const credentialPath = String(
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      || process.env.GOOGLE_APPLICATION_CREDENTIALS
      || '',
  ).trim();
  const raw = rawJson
    || (rawBase64 ? Buffer.from(rawBase64, 'base64').toString('utf8') : '')
    || (credentialPath ? fs.readFileSync(credentialPath, 'utf8') : '');
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (!parsed?.project_id || !parsed?.client_email || !parsed?.private_key) {
    throw new Error('Credencial Firebase incompleta.');
  }
  return parsed;
}

function getFirebaseMessaging() {
  const serviceAccount = parseFirebaseServiceAccount();
  if (!serviceAccount) return null;
  const { cert, getApps, initializeApp } = require('firebase-admin/app');
  const { getMessaging } = require('firebase-admin/messaging');
  const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount) });
  return getMessaging(app);
}

function channelLabel(channel) {
  return {
    online: 'Online',
    pdv: 'PDV',
    shopee: 'Shopee',
    tiktok: 'TikTok Shop',
  }[channel] || channel;
}

function formatMoney(cents, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  }).format(normalizeCents(cents) / 100);
}

function saleNotificationBody(sale) {
  const items = Array.isArray(sale?.details?.items) ? sale.details.items : [];
  const firstItem = items[0];
  const itemLabel = firstItem?.name
    ? `${firstItem.name}${items.length > 1 ? ` +${items.length - 1}` : ''}`
    : sale.customer_name;
  return `${itemLabel} • ${formatMoney(sale.total_cents, sale.currency)}`.slice(0, 240);
}

function rowToSale(row) {
  return {
    id: row.id,
    channel: row.channel,
    external_id: row.external_id,
    status: row.status,
    customer_name: row.customer_name,
    total_cents: Number(row.total_cents || 0),
    currency: row.currency || 'BRL',
    occurred_at: row.occurred_at instanceof Date
      ? row.occurred_at.toISOString()
      : row.occurred_at,
    details: parseJson(row.details_json, {}),
    notified_at: row.notified_at instanceof Date
      ? row.notified_at.toISOString()
      : row.notified_at || null,
  };
}

function createMobileSalesPushService({ pool, logger = console }) {
  async function ensureTables() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mobile_push_devices (
        id CHAR(36) PRIMARY KEY,
        customer_id VARCHAR(255) NULL,
        token VARCHAR(512) NOT NULL,
        platform VARCHAR(20) NOT NULL DEFAULT 'android',
        app_version VARCHAR(40) NULL,
        device_name VARCHAR(160) NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_mobile_push_token (token),
        INDEX idx_mobile_push_active (active, last_seen_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mobile_sale_events (
        id CHAR(36) PRIMARY KEY,
        event_key VARCHAR(540) NOT NULL,
        channel VARCHAR(20) NOT NULL,
        external_id VARCHAR(255) NOT NULL,
        status VARCHAR(80) NOT NULL,
        customer_name VARCHAR(255) NULL,
        total_cents BIGINT NOT NULL DEFAULT 0,
        currency VARCHAR(12) NOT NULL DEFAULT 'BRL',
        occurred_at DATETIME(3) NOT NULL,
        details_json JSON NULL,
        notified_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_mobile_sale_event (event_key),
        INDEX idx_mobile_sale_channel_date (channel, occurred_at),
        INDEX idx_mobile_sale_external (channel, external_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mobile_operational_alerts (
        id CHAR(36) PRIMARY KEY,
        event_key VARCHAR(540) NOT NULL,
        channel VARCHAR(20) NOT NULL,
        external_id VARCHAR(255) NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'error',
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        notified_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_mobile_operational_alert (event_key),
        INDEX idx_mobile_operational_alert_date (channel, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  async function registerDevice({ customerId, token, platform, appVersion, deviceName }) {
    const normalizedToken = boundedText(token, 512);
    if (normalizedToken.length < 40) throw new Error('Token de notificacao invalido.');
    await ensureTables();
    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO mobile_push_devices
        (id, customer_id, token, platform, app_version, device_name, active, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
        customer_id = VALUES(customer_id),
        platform = VALUES(platform),
        app_version = VALUES(app_version),
        device_name = VALUES(device_name),
        active = 1,
        last_seen_at = CURRENT_TIMESTAMP`,
      [
        id,
        customerId || null,
        normalizedToken,
        boundedText(platform || 'android', 20) || 'android',
        boundedText(appVersion, 40) || null,
        boundedText(deviceName, 160) || null,
      ],
    );
    return { registered: true };
  }

  async function unregisterDevice(token) {
    const normalizedToken = boundedText(token, 512);
    if (!normalizedToken) return { unregistered: false };
    await ensureTables();
    const [result] = await pool.query(
      'UPDATE mobile_push_devices SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE token = ?',
      [normalizedToken],
    );
    return { unregistered: Number(result?.affectedRows || 0) > 0 };
  }

  async function deactivateTokens(tokens) {
    const unique = Array.from(new Set(tokens.map((value) => boundedText(value, 512)).filter(Boolean)));
    if (!unique.length) return;
    await pool.query(
      `UPDATE mobile_push_devices
          SET active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE token IN (${unique.map(() => '?').join(',')})`,
      unique,
    );
  }

  async function sendSalePush(sale) {
    const messaging = getFirebaseMessaging();
    if (!messaging) return { configured: false, sent: 0, failed: 0 };
    await ensureTables();
    const [deviceRows] = await pool.query(
      `SELECT token
         FROM mobile_push_devices
        WHERE active = 1
          AND platform = 'android'
        ORDER BY last_seen_at DESC
        LIMIT 500`,
    );
    const tokens = (deviceRows || []).map((row) => row.token).filter(Boolean);
    if (!tokens.length) return { configured: true, sent: 0, failed: 0 };

    const response = await messaging.sendEachForMulticast({
      tokens,
      data: {
        type: 'sale',
        channel: sale.channel,
        sale_id: sale.external_id,
        status: sale.status,
        total_cents: String(sale.total_cents),
        occurred_at: sale.occurred_at.toISOString(),
        notification_title: `Nova venda • ${channelLabel(sale.channel)}`,
        notification_body: saleNotificationBody(sale),
      },
      android: {
        priority: 'high',
        ttl: MAX_SALE_NOTIFICATION_AGE_MS,
      },
    });

    const invalidTokens = [];
    response.responses.forEach((result, index) => {
      if (!result.success && INVALID_FCM_TOKEN_CODES.has(result.error?.code)) {
        invalidTokens.push(tokens[index]);
      }
    });
    await deactivateTokens(invalidTokens);
    return {
      configured: true,
      sent: response.successCount,
      failed: response.failureCount,
    };
  }

  async function sendOperationalAlert(input) {
    const channel = normalizeOperationalChannel(input?.channel || 'shopee');
    const externalId = boundedText(input?.external_id || input?.sale_id, 255);
    const eventKey = boundedText(input?.event_key || `${channel}:${externalId}:operational-alert`, 540);
    const title = boundedText(input?.title || 'Atenção na automação', 255);
    const body = boundedText(input?.body || 'Confira o pedido no Gestão MDV.', 1000);
    const severity = boundedText(input?.severity || 'error', 20) || 'error';
    if (!externalId) throw new Error('Identificador do alerta obrigatorio.');

    await ensureTables();
    const [insertResult] = await pool.query(
      `INSERT IGNORE INTO mobile_operational_alerts
        (id, event_key, channel, external_id, severity, title, body)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), eventKey, channel, externalId, severity, title, body],
    );
    const inserted = Number(insertResult?.affectedRows || 0) > 0;
    if (!inserted) return { inserted: false, push: null };

    const messaging = getFirebaseMessaging();
    if (!messaging) return { inserted: true, push: { configured: false, sent: 0, failed: 0 } };
    const [deviceRows] = await pool.query(
      `SELECT token
         FROM mobile_push_devices
        WHERE active = 1
          AND platform = 'android'
        ORDER BY last_seen_at DESC
        LIMIT 500`,
    );
    const tokens = (deviceRows || []).map((row) => row.token).filter(Boolean);
    if (!tokens.length) return { inserted: true, push: { configured: true, sent: 0, failed: 0 } };

    try {
      const response = await messaging.sendEachForMulticast({
        tokens,
        data: {
          // type=sale keeps operational pushes visible on app versions already installed.
          type: 'sale',
          operational_alert: 'true',
          channel,
          sale_id: externalId,
          alert_id: externalId,
          status: `automation_${severity}`,
          total_cents: '0',
          occurred_at: new Date().toISOString(),
          notification_title: title,
          notification_body: body,
        },
        android: { priority: 'high' },
      });
      const invalidTokens = [];
      response.responses.forEach((result, index) => {
        if (!result.success && INVALID_FCM_TOKEN_CODES.has(result.error?.code)) {
          invalidTokens.push(tokens[index]);
        }
      });
      await deactivateTokens(invalidTokens);
      await pool.query(
        'UPDATE mobile_operational_alerts SET notified_at = CURRENT_TIMESTAMP WHERE event_key = ?',
        [eventKey],
      );
      return {
        inserted: true,
        push: {
          configured: true,
          sent: response.successCount,
          failed: response.failureCount,
        },
      };
    } catch (error) {
      logger.error('[mobile-operational-push] send failed:', error?.message || error);
      return {
        inserted: true,
        push: { configured: true, sent: 0, failed: 1, error: error?.message || String(error) },
      };
    }
  }

  async function listOperationalAlerts(channel, limit = 20) {
    const normalizedChannel = normalizeOperationalChannel(channel);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    await ensureTables();
    const [rows] = await pool.query(
      `SELECT id, event_key, channel, external_id, severity, title, body, notified_at, created_at
         FROM mobile_operational_alerts
        WHERE channel = ?
        ORDER BY created_at DESC
        LIMIT ?`,
      [normalizedChannel, safeLimit],
    );
    return rows || [];
  }

  async function recordSaleEvent(input, { notify = true } = {}) {
    const sale = normalizeSale(input);
    const shouldNotify = notify && isSaleFreshForNotification(sale);
    await ensureTables();
    const eventKey = boundedText(
      input?.event_key || `${sale.channel}:${sale.external_id}:sale`,
      540,
    );
    const id = crypto.randomUUID();
    const [result] = await pool.query(
      `INSERT IGNORE INTO mobile_sale_events
        (id, event_key, channel, external_id, status, customer_name, total_cents,
         currency, occurred_at, details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        eventKey,
        sale.channel,
        sale.external_id,
        sale.status,
        sale.customer_name,
        sale.total_cents,
        sale.currency,
        sale.occurred_at,
        JSON.stringify(sale.details),
      ],
    );
    const inserted = Number(result?.affectedRows || 0) > 0;
    if (!inserted || !shouldNotify) {
      return {
        inserted,
        sale,
        push: null,
        notification_skipped: inserted && notify ? 'stale_sale' : null,
      };
    }

    let push = null;
    try {
      push = await sendSalePush(sale);
      if (push.configured) {
        await pool.query(
          'UPDATE mobile_sale_events SET notified_at = CURRENT_TIMESTAMP WHERE event_key = ?',
          [eventKey],
        );
      }
    } catch (error) {
      logger.error('[mobile-sales-push] send failed:', error?.message || error);
      push = { configured: true, sent: 0, failed: 1, error: error?.message || String(error) };
    }
    return { inserted, sale, push };
  }

  async function listRecordedSales(channel, limit = 50) {
    const normalizedChannel = normalizeChannel(channel);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    await ensureTables();
    const [rows] = await pool.query(
      `SELECT *
         FROM mobile_sale_events
        WHERE channel = ?
        ORDER BY occurred_at DESC
        LIMIT ?`,
      [normalizedChannel, safeLimit],
    );
    return (rows || []).map(rowToSale);
  }

  async function getRecordedSale(channel, externalId) {
    const normalizedChannel = normalizeChannel(channel);
    const safeExternalId = boundedText(externalId, 255);
    await ensureTables();
    const [rows] = await pool.query(
      `SELECT *
         FROM mobile_sale_events
        WHERE channel = ? AND external_id = ?
        ORDER BY occurred_at DESC
        LIMIT 1`,
      [normalizedChannel, safeExternalId],
    );
    return rows?.[0] ? rowToSale(rows[0]) : null;
  }

  return {
    ensureTables,
    getRecordedSale,
    listOperationalAlerts,
    listRecordedSales,
    recordSaleEvent,
    registerDevice,
    sendOperationalAlert,
    sendSalePush,
    unregisterDevice,
  };
}

module.exports = {
  CHANNELS,
  MAX_SALE_NOTIFICATION_AGE_MS,
  createMobileSalesPushService,
  isSaleFreshForNotification,
  normalizeSale,
};
