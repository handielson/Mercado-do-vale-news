#!/usr/bin/env node
// Atualiza as tabelas oficiais usadas no cadastro fiscal dos produtos:
//   - NCM vigente (Siscomex / Portal Único) -> data/fiscal/ncm-vigente.json
//   - CEST do Convênio ICMS 142/2018 (Confaz)  -> data/fiscal/cest-conv142.json
// Uso: node scripts/fiscal-catalog-import.cjs [--ncm-file <json>] [--cest-file <html>]
// Sem os arquivos, baixa das fontes oficiais. Nunca grava dado de cliente.
const fs = require('fs');
const path = require('path');

const NCM_URL = 'https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json?perfil=PUBLICO';
const CEST_URL = 'https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18';
const OUT_DIR = path.join(__dirname, '..', 'data', 'fiscal');

const arg = name => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const decode = s => String(s)
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const clean = s => decode(String(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();
const brDate = s => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || '').trim()); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };

async function load(file, url, kind) {
  if (file) return fs.readFileSync(file, 'utf8');
  const res = await fetch(url, { headers: { 'user-agent': 'mdv-fiscal-catalog/1.0' } });
  if (!res.ok) throw new Error(`${kind}: HTTP ${res.status} em ${url}`);
  return res.text();
}

function buildNcm(raw, today = new Date().toISOString().slice(0, 10)) {
  const data = JSON.parse(raw);
  const list = data.Nomenclaturas || [];
  const headings = new Map();
  for (const row of list) if (/^\d{2}\.\d{2}$/.test(row.Codigo)) headings.set(row.Codigo.replace('.', ''), clean(row.Descricao));
  const items = [];
  for (const row of list) {
    if (!/^\d{4}\.\d{2}\.\d{2}$/.test(row.Codigo)) continue;
    const start = brDate(row.Data_Inicio); const end = brDate(row.Data_Fim);
    if (!start || !end || end < today || start > today) continue;
    const code = row.Codigo.replace(/\./g, '');
    const desc = clean(row.Descricao).replace(/^[-–\s]+/, '');
    items.push([code, desc, start, end]);
  }
  items.sort((a, b) => a[0].localeCompare(b[0]));
  if (items.length < 9000) throw new Error(`NCM: só ${items.length} códigos de 8 dígitos vigentes; arquivo parece incompleto.`);
  return { source: 'Siscomex - Portal Único (Nomenclatura NCM)', url: NCM_URL, vigencia: data.Data_Ultima_Atualizacao_NCM || '', ato: data.Ato || '',
    generatedAt: new Date().toISOString(), fields: ['ncm', 'descricao', 'inicio', 'fim'], count: items.length,
    headings: Object.fromEntries([...headings].filter(([code]) => items.some(item => item[0].startsWith(code)))), items };
}

function buildCest(html) {
  const rows = html.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
  const seen = new Map();
  const anomalies = [];
  for (const row of rows) {
    const cells = (row.match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi) || []).map(clean);
    if (cells.length < 4) continue;
    const cestMatch = /^(\d{2})\.(\d{3})\.(\d{2})$/.exec(cells[1]);
    if (!cestMatch) continue;
    const cest = cestMatch[1] + cestMatch[2] + cestMatch[3];
    // O Confaz lista primeiro a redação vigente e depois as anteriores: vale a primeira ocorrência.
    if (seen.has(cest)) continue;
    const desc = cells.slice(3).join(' ').trim();
    const ncms = [];
    const chapters = /^Cap[íi]tulos?\s+(.+)$/i.exec(cells[2]);
    if (chapters) {
      // Ex.: "Capítulos 13 e 15 a 23" -> prefixos de 2 dígitos 13, 15..23
      for (const part of chapters[1].split(/\s*(?:,|\be\b)\s*/i).filter(Boolean)) {
        const range = /^(\d{1,2})\s*a\s*(\d{1,2})$/i.exec(part.trim());
        if (range) for (let n = Number(range[1]); n <= Number(range[2]); n++) ncms.push(String(n).padStart(2, '0'));
        else if (/^\d{1,2}$/.test(part.trim())) ncms.push(part.trim().padStart(2, '0'));
        else anomalies.push(`${cells[1]}: "${part}"`);
      }
    } else for (const token of cells[2].split(/[\s;,]+/).filter(Boolean)) {
      const digits = token.replace(/\./g, '');
      if (/^\d{2,8}$/.test(digits)) ncms.push(digits);
      else if (!/^(e|ou|exceto|-)$/i.test(token)) anomalies.push(`${cells[1]}: "${token}"`);
    }
    seen.set(cest, { cest, revoked: /^REVOGAD/i.test(desc), ncms, desc, segment: cestMatch[1] });
  }
  const items = [...seen.values()].filter(row => !row.revoked).map(row => [row.cest, row.segment, row.ncms, row.desc]);
  items.sort((a, b) => a[0].localeCompare(b[0]));
  if (items.length < 500) throw new Error(`CEST: só ${items.length} itens vigentes; página parece incompleta.`);
  return { data: { source: 'Confaz - Convênio ICMS 142/2018 (anexos II a XXVI)', url: CEST_URL,
    note: 'CEST vigentes (primeira redação listada pelo Confaz; itens revogados removidos). NCM pode ser prefixo. A aplicação de ST na UF é decidida pela contabilidade.',
    generatedAt: new Date().toISOString(), fields: ['cest', 'segmento', 'ncm_prefixos', 'descricao'], count: items.length, revoked: [...seen.values()].filter(r => r.revoked).length, items }, anomalies };
}

async function main() {
  const ncm = buildNcm(await load(arg('--ncm-file'), NCM_URL, 'NCM'));
  const { data: cest, anomalies } = buildCest(await load(arg('--cest-file'), CEST_URL, 'CEST'));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'ncm-vigente.json'), JSON.stringify(ncm));
  fs.writeFileSync(path.join(OUT_DIR, 'cest-conv142.json'), JSON.stringify(cest));
  console.log(`NCM: ${ncm.count} códigos (${ncm.vigencia}; ${ncm.ato})`);
  console.log(`CEST: ${cest.count} vigentes, ${cest.revoked} revogados ignorados`);
  if (anomalies.length) console.log(`Tokens de NCM ignorados no CEST (${anomalies.length}):`, anomalies.slice(0, 15).join(' | '));
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exit(1); });
module.exports = { buildNcm, buildCest };
