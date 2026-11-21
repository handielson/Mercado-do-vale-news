'use strict';

// bot-error-library-v1 (21/11/2026): biblioteca de erros do robô — cada erro com sintoma, onde, causa, correção e como testar.
// Quem grava: os agentes do servidor de casa (qualidade, saúde), os erros do n8n que chegam em /n8n-bot/error-alerts
// e a importação do histórico do repositório. Quem lê: os agentes (casos parecidos antes de sugerir correção) e o painel.
// - mesmo erro (mesma "chave") soma ocorrência; se estava "corrigido" e acontece de novo, vira "voltou";
// - rotas com a chave MDV_MONITOR_KEY (x-agent-key), registradas por services/botMonitorApi.cjs.

const crypto = require('node:crypto');

const STATUS = ['aberto', 'corrigido', 'voltou'];
const LIMITES = { titulo: 200, sintoma: 2000, onde: 120, causa: 2000, correcao: 3000, versao: 80, como_testar: 1500, exemplo: 4000, origem: 40, tags: 255 };
const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').trim().slice(0, n);
const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();

function chaveDe(e) {
  if (e.chave) return crypto.createHash('sha1').update(String(e.chave)).digest('hex');
  return crypto.createHash('sha1').update(`${norm(e.origem)}|${norm(e.onde)}|${norm(e.titulo)}`).digest('hex');
}

const PALAVRAS_VAZIAS = new Set('para com sem uma umas uns que nao não por pelo pela das dos nas nos the and esta este isso essa esse quando robo robô cliente mensagem'.split(' '));
function palavras(texto) {
  return [...new Set(norm(texto).replace(/[^a-z#\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !PALAVRAS_VAZIAS.has(w)))];
}

/** Pontua casos parecidos por palavras em comum (título e sintoma valem mais) e mesmo lugar. */
function pontuar(rows, texto, onde) {
  const alvo = palavras(texto);
  if (!alvo.length) return [];
  return rows.map((r) => {
    const forte = new Set(palavras(`${r.titulo} ${r.sintoma} ${r.tags}`));
    const fraco = new Set(palavras(`${r.causa} ${r.correcao}`));
    let p = 0;
    for (const w of alvo) p += forte.has(w) ? 2 : fraco.has(w) ? 1 : 0;
    if (onde && norm(r.onde) && norm(r.onde) === norm(onde)) p += 2;
    return { r, p };
  }).filter((x) => x.p >= 3).sort((a, b) => b.p - a.p);
}

function createBotErrorLibrary({ pool, now = () => new Date() } = {}) {
  let pronto = null;
  function ensure() {
    if (!pronto) pronto = pool.query(`CREATE TABLE IF NOT EXISTS bot_error_library (
      id INT AUTO_INCREMENT PRIMARY KEY,
      chave CHAR(40) NOT NULL UNIQUE,
      titulo VARCHAR(200) NOT NULL,
      sintoma TEXT NULL, onde VARCHAR(120) NULL, causa TEXT NULL, correcao TEXT NULL,
      versao VARCHAR(80) NULL, como_testar TEXT NULL,
      status ENUM('aberto','corrigido','voltou') NOT NULL DEFAULT 'aberto',
      ocorrencias INT NOT NULL DEFAULT 1,
      primeira_vez DATETIME NULL, ultima_vez DATETIME NULL, corrigido_em DATETIME NULL,
      exemplo TEXT NULL, origem VARCHAR(40) NULL, tags VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_status (status), KEY idx_ultima (ultima_vez)) DEFAULT CHARSET=utf8mb4`).catch((e) => { pronto = null; throw e; });
    return pronto;
  }

  const campos = (e) => Object.fromEntries(Object.entries(LIMITES).map(([k, n]) => [k, e[k] == null ? null : clean(typeof e[k] === 'object' ? JSON.stringify(e[k]) : e[k], n) || null]));

  /**
   * Grava um erro. Se já existe pela chave: ocorrência +1 (menos na importação do histórico) e, se estava corrigido, "voltou".
   * Campos vazios na biblioteca são completados; o que já foi escrito não é apagado.
   */
  async function registrar(entrada = {}) {
    await ensure();
    const e = campos(entrada);
    if (!e.titulo) throw Object.assign(new Error('Título obrigatório.'), { statusCode: 400 });
    const chave = chaveDe({ ...entrada, ...e });
    const quando = entrada.quando ? new Date(entrada.quando) : now();
    const historico = e.origem === 'historico';
    const status = STATUS.includes(entrada.status) ? entrada.status : (historico ? 'corrigido' : 'aberto');
    const [rows] = await pool.query('SELECT id, status, ocorrencias FROM bot_error_library WHERE chave = ?', [chave]);
    const atual = rows?.[0];
    if (!atual) {
      const [r] = await pool.query(`INSERT INTO bot_error_library (chave, titulo, sintoma, onde, causa, correcao, versao, como_testar, status, ocorrencias,
          primeira_vez, ultima_vez, corrigido_em, exemplo, origem, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
        [chave, e.titulo, e.sintoma, e.onde, e.causa, e.correcao, e.versao, e.como_testar, status, quando, quando, status === 'corrigido' ? quando : null, e.exemplo, e.origem, e.tags]);
      return { id: Number(r.insertId), novo: true, voltou: false, status };
    }
    const voltou = !historico && atual.status === 'corrigido';
    const sets = ['titulo = COALESCE(titulo, ?)'];
    const vals = [e.titulo];
    for (const k of ['sintoma', 'onde', 'causa', 'correcao', 'versao', 'como_testar', 'tags']) { sets.push(`${k} = COALESCE(NULLIF(${k}, ''), ?)`); vals.push(e[k]); }
    if (!historico) {
      sets.push('ocorrencias = ocorrencias + 1', 'ultima_vez = ?'); vals.push(quando);
      if (e.exemplo) { sets.push('exemplo = ?'); vals.push(e.exemplo); }
      if (voltou) sets.push("status = 'voltou'");
    }
    vals.push(atual.id);
    await pool.query(`UPDATE bot_error_library SET ${sets.join(', ')} WHERE id = ?`, vals);
    return { id: Number(atual.id), novo: false, voltou, status: voltou ? 'voltou' : atual.status };
  }

  async function atualizar(id, entrada = {}) {
    await ensure();
    const n = Number.parseInt(id, 10);
    if (!Number.isFinite(n)) throw Object.assign(new Error('Erro não informado.'), { statusCode: 400 });
    const e = campos(entrada);
    const sets = [], vals = [];
    for (const k of ['titulo', 'sintoma', 'onde', 'causa', 'correcao', 'versao', 'como_testar', 'tags']) if (entrada[k] !== undefined) { sets.push(`${k} = ?`); vals.push(e[k]); }
    if (entrada.status !== undefined) {
      if (!STATUS.includes(entrada.status)) throw Object.assign(new Error('Situação inválida.'), { statusCode: 400 });
      sets.push('status = ?'); vals.push(entrada.status);
      if (entrada.status === 'corrigido') sets.push('corrigido_em = CURRENT_TIMESTAMP');
    }
    if (!sets.length) throw Object.assign(new Error('Nada para mudar.'), { statusCode: 400 });
    vals.push(n);
    const [r] = await pool.query(`UPDATE bot_error_library SET ${sets.join(', ')} WHERE id = ?`, vals);
    if (!r?.affectedRows) throw Object.assign(new Error('Erro não existe.'), { statusCode: 404 });
    return { ok: true, id: n };
  }

  const linha = (r) => ({
    id: Number(r.id), titulo: r.titulo, sintoma: r.sintoma, onde: r.onde, causa: r.causa, correcao: r.correcao, versao: r.versao,
    como_testar: r.como_testar, status: r.status, ocorrencias: Number(r.ocorrencias || 0), origem: r.origem, tags: r.tags,
    primeira_vez: r.primeira_vez, ultima_vez: r.ultima_vez, corrigido_em: r.corrigido_em, exemplo: r.exemplo,
  });

  async function listar(q = {}) {
    await ensure();
    const where = [], vals = [];
    if (STATUS.includes(q.status)) { where.push('status = ?'); vals.push(q.status); }
    if (q.origem) { where.push('origem = ?'); vals.push(clean(q.origem, 40)); }
    if (q.q) {
      const like = `%${clean(q.q, 80).replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
      where.push('(titulo LIKE ? OR sintoma LIKE ? OR causa LIKE ? OR correcao LIKE ? OR tags LIKE ? OR onde LIKE ?)'); vals.push(like, like, like, like, like, like);
    }
    const n = Number.parseInt(q.limite, 10);
    const limite = Number.isFinite(n) && n > 0 ? Math.min(n, 500) : 100;
    const [rows] = await pool.query(`SELECT * FROM bot_error_library ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY FIELD(status, 'voltou', 'aberto', 'corrigido'), ultima_vez DESC LIMIT ?`, [...vals, limite]);
    const [cont] = await pool.query('SELECT status, COUNT(*) AS n FROM bot_error_library GROUP BY status');
    return { erros: (rows || []).map(linha), totais: Object.fromEntries((cont || []).map((c) => [c.status, Number(c.n)])) };
  }

  async function parecidos(q = {}) {
    await ensure();
    const [rows] = await pool.query('SELECT id, titulo, sintoma, onde, causa, correcao, versao, como_testar, status, ocorrencias, tags FROM bot_error_library ORDER BY ultima_vez DESC LIMIT 600');
    const n = Number.parseInt(q.limite, 10);
    return { erros: pontuar(rows || [], q.texto, q.onde).slice(0, Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 5).map(({ r, p }) => ({ ...linha(r), pontos: p })) };
  }

  return { ensure, registrar, atualizar, listar, parecidos };
}

module.exports = { createBotErrorLibrary, chaveDe, palavras, pontuar, STATUS };
