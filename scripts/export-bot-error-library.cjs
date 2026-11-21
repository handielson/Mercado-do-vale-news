'use strict';
// bot-error-library-v1: exporta a biblioteca de erros (API /agent/monitor/errors) para docs/biblioteca-erros.md,
// para qualquer IA ou pessoa ler o histórico de erro + correção sem acessar o banco.
// Uso: MDV_MONITOR_KEY=... node scripts/export-bot-error-library.cjs [https://api.xiaomipetrolina.com.br]
// Não exporta o campo "exemplo" (tem conversa de cliente).
const fs = require('node:fs');
const path = require('node:path');

const ROT = { voltou: '🔴 Voltou', aberto: '🟡 Aberto', corrigido: '🟢 Corrigido' };
const linha = (v) => String(v ?? '').replace(/\r/g, '').trim();
const data = (v) => (v ? String(v).slice(0, 10) : '—');

function montar(erros, geradoEm = new Date()) {
  const grupos = new Map();
  for (const e of erros) {
    const area = linha(e.onde).split('·')[0].trim() || 'Outros';
    if (!grupos.has(area)) grupos.set(area, []);
    grupos.get(area).push(e);
  }
  const conta = (s) => erros.filter((e) => e.status === s).length;
  const partes = [
    '# Biblioteca de erros do robô e do sistema',
    '',
    `> Gerado em ${geradoEm.toISOString().slice(0, 16).replace('T', ' ')} UTC por \`scripts/export-bot-error-library.cjs\` a partir da tabela \`bot_error_library\`.`,
    '> **Antes de investigar um erro, procure aqui** (Ctrl+F pelo sintoma). Para editar, use a aba Erros do painel do servidor',
    '> (https://servidor.mercadodovale.com.br/agentes.html) e exporte de novo. Não edite este arquivo à mão.',
    '',
    `Total: ${erros.length} · ${conta('voltou')} voltaram · ${conta('aberto')} abertos · ${conta('corrigido')} corrigidos.`,
    '',
  ];
  for (const [area, lista] of [...grupos.entries()].sort((a, b) => b[1].length - a[1].length)) {
    partes.push(`## ${area} (${lista.length})`, '');
    for (const e of lista) {
      partes.push(`### #${e.id} ${linha(e.titulo)}`, '');
      partes.push(`- **Situação:** ${ROT[e.status] || e.status} · ${e.ocorrencias}x · última ${data(e.ultima_vez)}${e.versao ? ` · versão ${linha(e.versao)}` : ''} · origem ${linha(e.origem) || '—'}`);
      if (e.onde) partes.push(`- **Onde:** ${linha(e.onde)}`);
      if (e.sintoma) partes.push(`- **O que aconteceu:** ${linha(e.sintoma).replace(/\n+/g, ' ')}`);
      if (e.causa) partes.push(`- **Causa:** ${linha(e.causa).replace(/\n+/g, ' ')}`);
      if (e.correcao) partes.push(`- **Correção:** ${linha(e.correcao).replace(/\n+/g, ' ')}`);
      if (e.como_testar) partes.push(`- **Como testar:** ${linha(e.como_testar).replace(/\n+/g, ' ')}`);
      if (e.tags) partes.push(`- **Tags:** ${linha(e.tags)}`);
      partes.push('');
    }
  }
  return `${partes.join('\n').trimEnd()}\n`;
}

async function main() {
  const base = (process.argv[2] || 'https://api.xiaomipetrolina.com.br').replace(/\/+$/, '');
  const key = process.env.MDV_MONITOR_KEY;
  if (!key) throw new Error('Defina MDV_MONITOR_KEY');
  const r = await fetch(`${base}/agent/monitor/errors?limite=500`, { headers: { 'x-agent-key': key } });
  if (!r.ok) throw new Error(`API respondeu ${r.status}`);
  const { erros } = await r.json();
  const out = path.join(__dirname, '..', 'docs', 'biblioteca-erros.md');
  fs.writeFileSync(out, montar(erros || []));
  console.log(`${(erros || []).length} erros em ${out}`);
}

module.exports = { montar };
if (require.main === module) main().catch((e) => { console.error(e.message); process.exitCode = 1; });
