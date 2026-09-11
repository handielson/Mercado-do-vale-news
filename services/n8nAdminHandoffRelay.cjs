const crypto = require('crypto');

const CODE_PATTERN = '[A-Z0-9]{4,8}';

function normalizeRelayCommand(value) {
  const text = String(value || '').trim();
  let match = text.match(new RegExp(`^([12])[.)]?\\s+(${CODE_PATTERN})(?:\\s+([\\s\\S]+))?$`, 'i'));
  if (match) {
    const release = match[1] === '1';
    const message = String(match[3] || '').trim();
    return {
      action: message ? (release ? 'responder_liberar' : 'responder_encerrar') : (release ? 'liberar' : 'encerrar'),
      code: match[2].toUpperCase(),
      message,
    };
  }
  match = text.match(new RegExp(`^RESPONDER\\s+(${CODE_PATTERN})\\s+([\\s\\S]+)$`, 'i'));
  if (match) return { action: 'responder', code: match[1].toUpperCase(), message: match[2].trim() };
  match = text.match(new RegExp(`^(LIBERAR|ENCERRAR)\\s+(${CODE_PATTERN})$`, 'i'));
  if (match) return { action: match[1].toLowerCase(), code: match[2].toUpperCase(), message: '' };
  return null;
}

function buildAdminLegend(code) {
  return [
    `1. ${code} sua resposta — responde e devolve o atendimento para a IA.`,
    `2. ${code} sua resposta — responde e encerra o atendimento humano.`,
    '',
    `✍️ RESPONDER ${code} sua mensagem — responde e mantém o atendimento pausado.`,
    `🤖 LIBERAR ${code} — devolve para a IA sem enviar mensagem.`,
    `✅ ENCERRAR ${code} — encerra sem enviar mensagem.`,
  ].join('\n');
}

function buildAdminNotification({ code, contactName, phone, message }) {
  return [
    '🔔 Cliente aguardando atendimento',
    `Código: ${code}`,
    `Cliente: ${contactName || 'Nome não informado'} — ${phone}`,
    `Mensagem: “${String(message || 'Sem mensagem registrada').slice(0, 900)}”`,
    '',
    buildAdminLegend(code),
  ].join('\n');
}

async function ensureSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS n8n_bot_handoffs (
      remote_jid VARCHAR(120) PRIMARY KEY,
      phone VARCHAR(32) NOT NULL,
      code VARCHAR(8) NOT NULL,
      contact_name VARCHAR(160) NULL,
      status ENUM('open','released','closed') NOT NULL DEFAULT 'open',
      requested_at DATETIME NOT NULL,
      expires_at DATETIME NOT NULL,
      notification_claimed_at DATETIME NULL,
      notified_at DATETIME NULL,
      last_admin_phone VARCHAR(32) NULL,
      last_admin_response_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_n8n_bot_handoffs_code (code),
      INDEX idx_n8n_bot_handoffs_status_expiry (status, expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

function newCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

async function notifyAdmins({ pool, identity, sendText }) {
  const [existingRows] = await pool.query(
    `SELECT * FROM n8n_bot_handoffs WHERE remote_jid = ? AND status = 'open' AND expires_at > CURRENT_TIMESTAMP LIMIT 1`,
    [identity.remoteJid],
  );
  let handoff = existingRows?.[0] || null;
  if (!handoff) {
    const [messageRows] = await pool.query(
      `SELECT contact_name, message_text FROM n8n_bot_messages WHERE remote_jid = ? AND direction = 'inbound' ORDER BY id DESC LIMIT 1`,
      [identity.remoteJid],
    );
    const latest = messageRows?.[0] || {};
    let code = newCode();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const [collision] = await pool.query('SELECT remote_jid FROM n8n_bot_handoffs WHERE code = ? AND remote_jid <> ? LIMIT 1', [code, identity.remoteJid]);
      if (!collision?.length) break;
      code = newCode();
    }
    await pool.query(
      `INSERT INTO n8n_bot_handoffs (remote_jid, phone, code, contact_name, status, requested_at, expires_at, notification_claimed_at, notified_at)
       VALUES (?, ?, ?, ?, 'open', CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 24 HOUR), NULL, NULL)
       ON DUPLICATE KEY UPDATE phone=VALUES(phone), code=VALUES(code), contact_name=VALUES(contact_name), status='open', requested_at=VALUES(requested_at), expires_at=VALUES(expires_at), notification_claimed_at=NULL, notified_at=NULL`,
      [identity.remoteJid, identity.phone, code, latest.contact_name || null],
    );
    handoff = { remote_jid: identity.remoteJid, phone: identity.phone, code, contact_name: latest.contact_name || null, message_text: latest.message_text || '' };
  }
  if (handoff.notified_at) return { notified: false, duplicate: true, code: handoff.code };
  const [claim] = await pool.query(
    `UPDATE n8n_bot_handoffs SET notification_claimed_at=CURRENT_TIMESTAMP WHERE remote_jid=? AND notified_at IS NULL AND (notification_claimed_at IS NULL OR notification_claimed_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 2 MINUTE))`,
    [identity.remoteJid],
  );
  if (!claim.affectedRows) return { notified: false, duplicate: true, code: handoff.code };
  const [latestRows] = await pool.query(`SELECT contact_name, message_text FROM n8n_bot_messages WHERE remote_jid=? AND direction='inbound' ORDER BY id DESC LIMIT 1`, [identity.remoteJid]);
  const latest = latestRows?.[0] || {};
  const [admins] = await pool.query(`SELECT remote_jid, phone FROM n8n_bot_admin_numbers WHERE active=1 ORDER BY updated_at DESC`);
  const notification = buildAdminNotification({ code: handoff.code, contactName: latest.contact_name || handoff.contact_name, phone: identity.phone, message: latest.message_text || handoff.message_text });
  let sent = 0;
  for (const admin of admins || []) {
    const result = await sendText({ remoteJid: admin.remote_jid, phone: admin.phone }, notification);
    if (result?.ok && result?.body?.error !== true) sent += 1;
  }
  await pool.query(`UPDATE n8n_bot_handoffs SET notified_at=IF(? > 0, CURRENT_TIMESTAMP, notified_at), notification_claimed_at=NULL WHERE remote_jid=?`, [sent, identity.remoteJid]);
  return { notified: sent > 0, sent, code: handoff.code };
}

async function handleRelayCommand({ pool, command, admin, sendText, logMessage }) {
  const [rows] = await pool.query(`SELECT * FROM n8n_bot_handoffs WHERE code=? AND status='open' AND expires_at > CURRENT_TIMESTAMP LIMIT 1`, [command.code]);
  const handoff = rows?.[0];
  if (!handoff) return { handled: true, action: command.action, reply: `⚠️ Atendimento ${command.code} não encontrado ou expirado.` };
  if (['responder', 'responder_liberar', 'responder_encerrar'].includes(command.action)) {
    const identity = { remoteJid: handoff.remote_jid, phone: handoff.phone };
    const result = await sendText(identity, command.message);
    if (!result?.ok || result?.body?.error === true) return { handled: true, action: command.action, reply: `❌ Não consegui enviar ao cliente ${command.code}. Tente novamente.` };
    const waMessageId = String(result.body?.key?.id || result.body?.messageId || '').slice(0, 160) || null;
    await logMessage({ ...identity, direction: 'outbound', message: command.message, messageType: 'text', sourceNode: 'admin-whatsapp-relay', waMessageId, payload: { handoffCode: command.code, adminPhone: admin.phone } });
    await pool.query(`UPDATE n8n_bot_handoffs SET last_admin_phone=?, last_admin_response_at=CURRENT_TIMESTAMP WHERE remote_jid=?`, [admin.phone, handoff.remote_jid]);
    if (command.action === 'responder_liberar' || command.action === 'responder_encerrar') {
      const status = command.action === 'responder_liberar' ? 'released' : 'closed';
      await pool.query(`UPDATE n8n_bot_handoffs SET status=?, last_admin_phone=? WHERE remote_jid=?`, [status, admin.phone, handoff.remote_jid]);
      await pool.query(`UPDATE n8n_bot_client_controls SET human_handoff_until=NULL, human_handoff_by=NULL, updated_at=CURRENT_TIMESTAMP WHERE remote_jid=?`, [handoff.remote_jid]);
      return {
        handled: true,
        action: command.action,
        reply: command.action === 'responder_liberar'
          ? `✅ Mensagem enviada ao cliente ${command.code}. Atendimento devolvido para a IA.`
          : `✅ Mensagem enviada ao cliente ${command.code}. Atendimento humano encerrado.`,
      };
    }
    await pool.query(`UPDATE n8n_bot_client_controls SET human_handoff_until=DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 24 HOUR), human_handoff_by='admin-whatsapp-relay', updated_at=CURRENT_TIMESTAMP WHERE remote_jid=?`, [handoff.remote_jid]);
    return { handled: true, action: command.action, reply: `✅ Mensagem enviada ao cliente ${command.code}.\n\n${buildAdminLegend(command.code)}` };
  }
  const status = command.action === 'liberar' ? 'released' : 'closed';
  await pool.query(`UPDATE n8n_bot_handoffs SET status=?, last_admin_phone=? WHERE remote_jid=?`, [status, admin.phone, handoff.remote_jid]);
  await pool.query(`UPDATE n8n_bot_client_controls SET human_handoff_until=NULL, human_handoff_by=NULL, updated_at=CURRENT_TIMESTAMP WHERE remote_jid=?`, [handoff.remote_jid]);
  return { handled: true, action: command.action, reply: command.action === 'liberar' ? `🤖 Atendimento ${command.code} devolvido para a IA.` : `✅ Atendimento ${command.code} encerrado.` };
}

module.exports = { normalizeRelayCommand, buildAdminLegend, buildAdminNotification, ensureSchema, notifyAdmins, handleRelayCommand };
