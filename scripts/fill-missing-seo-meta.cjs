'use strict';
// seo-meta-fill-v1: preenche Título SEO (meta_title) e Meta Descrição (meta_description) VAZIOS dos produtos ativos.
// Nunca sobrescreve texto existente. Mesmo estilo do botão "Regenerar" do admin (ProductSEO.tsx), com limpeza:
// tira "Cor:X" do título, não corta com "...", remove HTML/markdown e junta palavras coladas da descrição.
//
// Na VPS (/var/www/mdv-api):
//   node scripts/fill-missing-seo-meta.cjs            # prévia: contagem + exemplos (não grava)
//   node scripts/fill-missing-seo-meta.cjs --apply    # grava, com backup dos ids alterados
const fs = require('node:fs');
const path = require('node:path');

const SUFFIX = ' | Mercado do Vale';
const TITLE_MAX = 60;
const DESC_MAX = 160;

const clean = (text) => String(text || '')
  .replace(/<br\s*\/?>/gi, '. ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&[a-z]+;/gi, ' ')
  .replace(/[*_#`>]+/g, ' ')
  .replace(/([a-zà-ú0-9])([A-ZÀ-Ú][a-zà-ú])/g, '$1. $2') // "CAT6Informações" → "CAT6. Informações"
  .replace(/\s*\.\s*\./g, '.').replace(/\s+/g, ' ').trim();

function cleanName(name) {
  return String(name || '')
    .replace(/\s*[,|-]?\s*\b(?:cor|color)\s*:\s*[^|]+$/i, '')
    .replace(/\b(?:tam|tamanho)\s*:\s*/gi, '')
    .replace(/,\s*global\b/i, '')
    .replace(/\s+/g, ' ').trim();
}

function cutWords(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const at = cut.lastIndexOf(' ');
  return (at > max * 0.6 ? cut.slice(0, at) : text.slice(0, max)).replace(/[\s,;:.–-]+$/, '');
}

function metaTitle(product) {
  const name = cleanName(product.name);
  if (!name) return '';
  // nome cabe com o sufixo → "Nome | Mercado do Vale"; senão o nome inteiro (até 60), sem cortar o modelo
  if (name.length + SUFFIX.length <= TITLE_MAX) return name + SUFFIX;
  return cutWords(name, TITLE_MAX);
}

// Primeira frase completa da descrição que não repete o nome; frase cortada não entra.
function firstSentence(description, name, room) {
  const nameWords = name.toLowerCase().split(/\s+/).slice(0, 3).join(' ');
  const sentences = clean(description).replace(/^descri[cç][aã]o do produto\s*/i, '')
    .split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => x.length >= 20);
  for (const sentence of sentences.slice(0, 3)) {
    const lower = sentence.toLowerCase();
    if (lower.startsWith(nameWords) && sentence.length < name.length + 25) continue;
    if (/descri[cç][aã]o do produto|informa[cç][oõ]es? do produto|caracter[ií]sticas:?\s*$/i.test(sentence)) continue;
    if (!/[a-zà-ú]{3,}\s+[a-zà-ú]{3,}\s+[a-zà-ú]{3,}/i.test(sentence)) continue;
    const text = /[.!?]$/.test(sentence) ? sentence : sentence + '.';
    if (text.length <= room) return text;
  }
  return '';
}

function metaDescription(product, { isPhone }) {
  const name = cleanName(product.name);
  if (!name) return '';
  const specs = (() => { try { return typeof product.specs === 'string' ? JSON.parse(product.specs || '{}') : (product.specs || {}); } catch { return {}; } })();
  const memory = isPhone && specs.ram && specs.storage && !name.includes(specs.storage) ? ` ${specs.ram}/${specs.storage}` : '';
  const head = `Compre ${name}${memory} na Mercado do Vale.`;
  const tail = isPhone ? ' Novo, com garantia e parcelamento em até 12x.' : ' Com garantia e parcelamento em até 12x.';
  const room = DESC_MAX - head.length - tail.length - 1;
  const extra = room > 25 ? firstSentence(product.description, name, room) : '';
  const middle = extra ? ` ${extra}` : '';
  return cutWords(`${head}${middle}${tail}`.replace(/\s+/g, ' ').trim(), DESC_MAX);
}

async function main() {
  require('dotenv').config({ path: '/var/www/mdv-api/.env', quiet: true });
  const mysql = require('mysql2/promise');
  const db = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
  const apply = process.argv.includes('--apply');
  try {
    const [rows] = await db.query(`SELECT p.id, p.name, p.description, p.specs, p.meta_title, p.meta_description, c.name AS category
      FROM products p LEFT JOIN models m ON m.id = p.model_id LEFT JOIN categories c ON c.id = COALESCE(m.category_id, p.category_id)
      WHERE p.status = 'active' AND COALESCE(p.exclude_from_seo, 0) = 0
        AND (COALESCE(TRIM(p.meta_title), '') = '' OR COALESCE(TRIM(p.meta_description), '') = '')`);
    const changes = rows.map((p) => {
      const isPhone = /^(smartphones?|celulares?)$/i.test(String(p.category || '').trim());
      return {
        id: p.id,
        meta_title: String(p.meta_title || '').trim() ? null : metaTitle(p),
        meta_description: String(p.meta_description || '').trim() ? null : metaDescription(p, { isPhone }),
      };
    }).filter((c) => c.meta_title || c.meta_description);
    const summary = { mode: apply ? 'apply' : 'preview', products: changes.length,
      titles: changes.filter((c) => c.meta_title).length, descriptions: changes.filter((c) => c.meta_description).length,
      longestTitle: Math.max(0, ...changes.map((c) => (c.meta_title || '').length)), longestDescription: Math.max(0, ...changes.map((c) => (c.meta_description || '').length)) };
    if (!apply) {
      const step = Math.max(1, Math.floor(changes.length / 12));
      summary.samples = changes.filter((_, i) => i % step === 0).slice(0, 12).map((c) => ({ title: c.meta_title, description: c.meta_description }));
      return summary;
    }
    const backupDir = `/var/www/mdv-api/backups/seo-meta-fill-${Date.now()}`;
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(backupDir, 'ids.json'), JSON.stringify(changes.map((c) => ({ id: c.id, setTitle: Boolean(c.meta_title), setDescription: Boolean(c.meta_description) }))), { mode: 0o600 });
    await db.beginTransaction();
    let updated = 0;
    for (const c of changes) {
      const [r] = await db.query(`UPDATE products SET
          meta_title = IF(COALESCE(TRIM(meta_title), '') = '' AND ? IS NOT NULL, ?, meta_title),
          meta_description = IF(COALESCE(TRIM(meta_description), '') = '' AND ? IS NOT NULL, ?, meta_description)
        WHERE id = ?`, [c.meta_title, c.meta_title, c.meta_description, c.meta_description, c.id]);
      updated += r.affectedRows;
    }
    await db.commit();
    return { ...summary, updated, backup: backupDir, undo: 'os ids e campos preenchidos estão em ids.json (eram vazios antes)' };
  } finally {
    await db.end();
  }
}

if (require.main === module) {
  main().then((r) => console.log(JSON.stringify(r, null, 2))).catch((e) => { console.error(e.message); process.exitCode = 1; });
}
module.exports = { cleanName, metaTitle, metaDescription, clean };
