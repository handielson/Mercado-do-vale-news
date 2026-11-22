'use strict';

// agent-lock-v1 (22/11/2026): trava de emergência dos agentes do servidor de casa.
// - travar: o painel do servidor (botão ou Sentinela) chama POST /agent/monitor/lock; com a trava ligada a API recusa
//   tudo que muda algo (mensagem a cliente, fechar atendimento e, depois, aplicar correção no robô) e o portão do n8n na VPS também;
// - destravar: NUNCA só com a chave do servidor de casa (se ele foi invadido, quem invadiu tem a chave). A API manda um código
//   de 6 dígitos no WhatsApp dos admins; só com esse código digitado no painel a trava sai. O código vale 10 min, 5 tentativas.
const crypto = require('node:crypto');

const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const hash = (codigo, sal) => crypto.createHash('sha256').update(`${sal}:${codigo}`).digest('hex');

function createAgentMonitorLock({ pool, sendAdmins, now = () => Date.now(), random = () => crypto.randomInt(0, 1e6) } = {}) {
  let pronto = null;
  const ensure = () => {
    if (!pronto) pronto = pool.query(`CREATE TABLE IF NOT EXISTS agent_monitor_settings (
      chave VARCHAR(60) PRIMARY KEY, valor TEXT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) DEFAULT CHARSET=utf8mb4`).catch((e) => { pronto = null; throw e; });
    return pronto;
  };
  async function ler(chave) {
    await ensure();
    const [rows] = await pool.query('SELECT valor FROM agent_monitor_settings WHERE chave = ?', [chave]);
    try { return rows?.[0]?.valor ? JSON.parse(rows[0].valor) : null; } catch { return null; }
  }
  async function gravar(chave, valor) {
    await ensure();
    await pool.query('INSERT INTO agent_monitor_settings (chave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)', [chave, valor == null ? null : JSON.stringify(valor)]);
  }

  async function estado() {
    const t = await ler('trava');
    return t?.travado ? { travado: true, motivo: t.motivo || '', em: t.em || null, por: t.por || '' } : { travado: false };
  }
  async function travar(body = {}) {
    const atual = await estado();
    if (atual.travado) return atual;
    const t = { travado: true, motivo: clean(body.motivo || 'emergência', 300), em: new Date(now()).toISOString(), por: clean(body.por || 'servidor de casa', 60) };
    await gravar('trava', t);
    await gravar('destrava', null);
    if (sendAdmins) await sendAdmins(`🛑 *Agentes TRAVADOS* (${t.por})\nMotivo: ${t.motivo}\n\nNada é aplicado no robô nem enviado a clientes até destravar. Para destravar: painel do servidor → Destravar (chega um código aqui).`).catch(() => {});
    return t;
  }
  async function pedirCodigo() {
    const t = await estado();
    if (!t.travado) return { ok: true, travado: false };
    const d = (await ler('destrava')) || {};
    const pedidos = (d.pedidos || []).filter((x) => now() - x < 3600e3);
    if (pedidos.length >= 3) throw Object.assign(new Error('Muitos pedidos de código nesta hora.'), { statusCode: 429 });
    const codigo = String(random()).padStart(6, '0');
    const sal = crypto.randomBytes(8).toString('hex');
    await gravar('destrava', { sal, hash: hash(codigo, sal), expira: now() + 10 * 60e3, tentativas: 0, pedidos: [...pedidos, now()] });
    if (!sendAdmins) throw Object.assign(new Error('Sem WhatsApp configurado para mandar o código.'), { statusCode: 503 });
    await sendAdmins(`🔐 Código para DESTRAVAR os agentes: *${codigo}*\nVale 10 minutos. Se não foi você que pediu, NÃO use: alguém está no painel do servidor.`);
    return { ok: true, enviado: true };
  }
  async function destravar(body = {}) {
    const t = await estado();
    if (!t.travado) return { ok: true, travado: false };
    const d = await ler('destrava');
    if (!d?.hash || now() > d.expira) throw Object.assign(new Error('Peça um código novo.'), { statusCode: 400 });
    if (d.tentativas >= 5) throw Object.assign(new Error('Tentativas esgotadas. Peça um código novo.'), { statusCode: 429 });
    const ok = (() => {
      const a = Buffer.from(hash(clean(body.codigo, 12).replace(/\D/g, ''), d.sal));
      const b = Buffer.from(d.hash);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    })();
    if (!ok) { await gravar('destrava', { ...d, tentativas: d.tentativas + 1 }); throw Object.assign(new Error('Código errado.'), { statusCode: 403 }); }
    await gravar('trava', { travado: false, destravadoEm: new Date(now()).toISOString() });
    await gravar('destrava', null);
    if (sendAdmins) await sendAdmins('✅ Agentes destravados. Eles continuam pausados: reative pelo painel quando quiser.').catch(() => {});
    return { ok: true, travado: false };
  }
  /** Para as rotas que mudam algo: lança 423 se estiver travado. */
  async function exigirDestravado() {
    const t = await estado();
    if (t.travado) throw Object.assign(new Error(`Agentes travados em emergência: ${t.motivo}`), { statusCode: 423 });
  }
  return { estado, travar, pedirCodigo, destravar, exigirDestravado };
}

module.exports = { createAgentMonitorLock };
