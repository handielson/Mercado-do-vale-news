#!/usr/bin/env node
/**
 * backup-synology.cjs
 * 
 * Cria um backup documentado no Synology Drive com changelog rico.
 * 
 * MODOS DE USO:
 *   Automático (pós-commit):  node backup-synology.cjs auto
 *   Manual (sob demanda):     node backup-synology.cjs manual "nome-do-backup"
 * 
 * EXEMPLOS:
 *   node backup-synology.cjs auto
 *   node backup-synology.cjs manual "correcao-preco-atacado"
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ═══════════════════════════════════════════════════════════
// CONFIGURAÇÃO — ajuste conforme necessário
// ═══════════════════════════════════════════════════════════
const CONFIG = {
  // Pasta raiz do Synology onde o backup será salvo
  synologyBase: 'C:\\Users\\Nitro\\SynologyDrive\\SynologyDrive',
  // Nome da pasta compartilhada de backup
  backupFolder: 'backup-mercadodovale',
  // Subpasta de código/changelog
  dbFolder: 'db',
  codigoFolder: 'codigo',
  // Informações do sistema (contexto para a IA)
  sistema: {
    nome: 'Mercado do Vale — E-commerce B2B/B2C',
    stack: 'React + Vite (frontend), Node.js/Express (VPS), Supabase (auth/pedidos)',
    fonteDaVerdade: 'VPS MySQL — produtos e catálogo',
    urlProducao: 'https://mercado-do-vale-news.vercel.app',
    urlAdmin: 'https://mercado-do-vale-news.vercel.app/admin/dashboard',
    bancoVPS: 'MySQL — banco: mercado_do_vale',
    deploy: 'Vercel (automático via push na branch main)',
    pm2Service: 'server — gerenciado pelo PM2 na VPS',
  }
};

// ═══════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function dataHoje() {
  const agora = new Date();
  const offset = -3; // Brasília UTC-3
  const local = new Date(agora.getTime() + offset * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10); // YYYY-MM-DD
}

function dataHoraAgora() {
  const agora = new Date();
  const offset = -3;
  const local = new Date(agora.getTime() + offset * 60 * 60 * 1000);
  const d = local.toISOString();
  const data = d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4);
  const hora = d.slice(11, 16);
  return `${data} às ${hora} (Horário de Brasília)`;
}

function pergunta(rl, texto) {
  return new Promise(resolve => rl.question(texto, resolve));
}

// ═══════════════════════════════════════════════════════════
// COLETA DE DADOS DO GIT
// ═══════════════════════════════════════════════════════════

function coletarDadosGit() {
  const hash = run('git log -1 --format="%H"');
  const hashCurto = hash.slice(0, 7);
  const msgCommit = run('git log -1 --format="%s"');
  const branch = run('git rev-parse --abbrev-ref HEAD');
  const autor = run('git log -1 --format="%an"');
  const hashAnterior = run('git log -2 --format="%H"').split('\n')[1]?.slice(0, 7) || 'N/A';
  const msgAnterior = run('git log -2 --format="%s"').split('\n')[1] || 'N/A';

  // Arquivos modificados no último commit
  const arquivosRaw = run('git diff --name-status HEAD~1 HEAD');
  const arquivos = arquivosRaw
    ? arquivosRaw.split('\n').filter(Boolean).map(linha => {
        const [status, ...partes] = linha.split('\t');
        return { status: status.trim(), arquivo: partes.join('\t').trim() };
      })
    : [];

  // Arquivos não commitados (modificados mas não no staging)
  const naoCommitados = run('git status --short');

  return { hash, hashCurto, msgCommit, branch, autor, hashAnterior, msgAnterior, arquivos, naoCommitados };
}

// ═══════════════════════════════════════════════════════════
// GERADOR DO CHANGELOG RICO
// ═══════════════════════════════════════════════════════════

function gerarChangelog(dados) {
  const { git, meta, contexto } = dados;
  const linha = '═'.repeat(68);
  const linhaMenor = '─'.repeat(68);

  // Formata lista de arquivos com legenda
  function formatarArquivos(arquivos) {
    if (!arquivos.length) return '  (nenhum arquivo rastreado pelo git)';
    const legenda = { M: 'Modificado', A: 'Adicionado', D: 'Deletado', R: 'Renomeado' };
    return arquivos.map(({ status, arquivo }) => {
      const tipo = legenda[status[0]] || status;
      const desc = contexto.descArquivos?.[arquivo] || '(sem descrição — adicionar manualmente)';
      return [
        `  ${status.padEnd(3)} ${arquivo}`,
        `       → Tipo: ${tipo}`,
        `       → O que mudou: ${desc}`,
        `       → Impacto potencial: Verificar dependências antes de reverter`,
      ].join('\n');
    }).join('\n\n');
  }

  return `
${linha}
         MERCADO DO VALE — REGISTRO DE BACKUP E CHANGELOG
${linha}

[IDENTIFICAÇÃO]
  ID DO BACKUP    : ${meta.id}
  DATA E HORA     : ${meta.dataHora}
  TIPO            : ${meta.tipo}
  GERADO POR      : backup-synology.cjs v1.0

[COMMIT ASSOCIADO]
  HASH COMPLETO   : ${git.hash || 'N/A (backup manual)'}
  HASH CURTO      : ${git.hashCurto || 'N/A'}
  MENSAGEM        : ${git.msgCommit || 'N/A'}
  BRANCH          : ${git.branch || 'N/A'}
  COMMIT ANTERIOR : ${git.hashAnterior} — "${git.msgAnterior}"

${linhaMenor}
[CONTEXTO DO SISTEMA]
  APLICAÇÃO       : ${CONFIG.sistema.nome}
  STACK TÉCNICA   : ${CONFIG.sistema.stack}
  FONTE DA VERDADE: ${CONFIG.sistema.fonteDaVerdade}
  URL PRODUÇÃO    : ${CONFIG.sistema.urlProducao}
  URL ADMIN       : ${CONFIG.sistema.urlAdmin}
  BANCO DE DADOS  : ${CONFIG.sistema.bancoVPS}
  DEPLOY          : ${CONFIG.sistema.deploy}
  SERVIÇO VPS     : ${CONFIG.sistema.pm2Service}

${linhaMenor}
[RESUMO DA MUDANÇA — O QUE FOI FEITO]
${contexto.resumo || '  (não informado)'}

[MOTIVO DA MUDANÇA — POR QUE FOI FEITO]
${contexto.motivo || '  (não informado)'}

[ESTADO DO SISTEMA ANTES DESTA MUDANÇA]
${contexto.estadoAntes || `  Versão anterior: commit ${git.hashAnterior}
  Consulte o changelog anterior para detalhes do estado prévio.`}

[ESTADO DO SISTEMA APÓS ESTA MUDANÇA]
${contexto.estadoDepois || '  (não informado)'}

${linhaMenor}
[ARQUIVOS MODIFICADOS]
  Legenda: M = Modificado | A = Adicionado | D = Deletado | R = Renomeado

${formatarArquivos(git.arquivos)}

${linhaMenor}
[DEPENDÊNCIAS CRÍTICAS DO SISTEMA]
  ⚠ Token OAuth Bling   : Renovado automaticamente, salvo no Supabase
  ⚠ Variáveis de Ambiente: Configuradas no Vercel (Settings → Env Vars)
  ⚠ VPS MySQL           : Deve estar online para webhooks funcionarem
  ⚠ PM2 na VPS          : Gerencia server.js. Reiniciar com: pm2 restart server
  ⚠ Supabase RLS        : Políticas de segurança ativas em todas as tabelas
  ⚠ GitHub Actions      : Deploy automático na Vercel via push na main

${linhaMenor}
[COMO VERIFICAR SE O SISTEMA ESTÁ FUNCIONANDO]
  Após qualquer restauração, execute esta checklist na ordem:

  1. Frontend produção
     → Acesse: ${CONFIG.sistema.urlProducao}
     → Verifique: catálogo carrega sem erros no console

  2. Admin dashboard
     → Acesse: ${CONFIG.sistema.urlAdmin}
     → Verifique: login funciona com conta Google do administrador

  3. Integração Bling
     → Acesse: ${CONFIG.sistema.urlAdmin}/bling
     → Verifique: token OAuth aparece como "Ativo e válido"

  4. VPS MySQL (via SSH)
     → Comando: mysql -u root -p -e "SELECT COUNT(*) FROM products;"
     → Esperado: número > 0 (produtos cadastrados)

  5. PM2 na VPS
     → Comando: pm2 status
     → Esperado: processo "server" com status "online"

  6. Logs de erro
     → Comando: pm2 logs server --lines 50
     → Esperado: sem erros críticos nos últimos minutos

${linhaMenor}
[COMO REVERTER — PASSO A PASSO]
  !! LEIA ANTES DE AGIR: Execute os passos na ordem indicada.   !!
  !! Não pule etapas. Em caso de dúvida, pare e peça orientação. !!

  OPÇÃO A — Reverter apenas o código (banco de dados NÃO foi alterado):
    Quando usar: mudança foi só no frontend/API, sem migração de banco.
    
    Passo 1: git revert ${git.hashCurto || '<HASH>'} --no-edit
    Passo 2: git push origin main
    Passo 3: Aguardar deploy automático na Vercel (aproximadamente 2 minutos)
    Passo 4: Acessar ${CONFIG.sistema.urlProducao} e verificar funcionamento
    Passo 5: Executar checklist de verificação (seção acima)

  OPÇÃO B — Restaurar banco de dados da VPS (MySQL):
    Quando usar: houve migração ou alteração de dados na VPS.
    
    Passo 1: Conectar na VPS via SSH
    Passo 2: cd /var/backups/ (ou local do dump)
    Passo 3: mysql -u root -p mercado_do_vale < ${meta.id}_pre-backup.sql
    Passo 4: pm2 restart server
    Passo 5: Verificar: mysql -u root -p -e "SELECT COUNT(*) FROM products;"
    Passo 6: Executar checklist de verificação (seção acima)

  OPÇÃO C — Restaurar tudo (código + banco de dados):
    Quando usar: falha crítica que afetou código e dados ao mesmo tempo.
    
    Passo 1: Executar OPÇÃO B primeiro (banco de dados)
    Passo 2: Esperar confirmação do banco restaurado
    Passo 3: Executar OPÇÃO A (código)
    Passo 4: Executar checklist de verificação completa (seção acima)

  OPÇÃO D — Restaurar a partir do ZIP de código (sem git):
    Quando usar: repositório git corrompido ou sem acesso ao terminal git.
    
    Passo 1: Abrir pasta backup-mercadodovale/codigo/ no Synology
    Passo 2: Encontrar o ZIP anterior a este backup
    Passo 3: Extrair e substituir a pasta do projeto
    Passo 4: Executar: npm install
    Passo 5: Executar: npx vercel --prod (para fazer deploy manual)

${linhaMenor}
[NOTAS DO DESENVOLVEDOR]
${contexto.notas || '  (nenhuma nota adicional informada)'}

[HISTÓRICO RECENTE DE BACKUPS]
${meta.historicoAnterior || '  (primeira entrada ou histórico não disponível)'}

${linha}
  Backup gerado em: ${meta.dataHora}
  Arquivo        : backup-mercadodovale/db/${meta.id}.txt
  Dump do banco  : backup-mercadodovale/db/${meta.id}.sql (se gerado)
  Código ZIP     : backup-mercadodovale/codigo/${meta.id}.zip (se gerado)
${linha}
`.trim();
}

// ═══════════════════════════════════════════════════════════
// MODO AUTOMÁTICO — Lê do git, pede só o contexto de negócio
// ═══════════════════════════════════════════════════════════

async function modoAutomatico() {
  console.log('\n🔄 MODO AUTOMÁTICO — Lendo dados do git...\n');

  const git = coletarDadosGit();

  console.log(`📌 Último commit : ${git.hashCurto} — "${git.msgCommit}"`);
  console.log(`📁 Arquivos      : ${git.arquivos.length} modificado(s)\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('Responda as perguntas abaixo (Enter para pular, Ctrl+C para cancelar):\n');

  const resumo        = await pergunta(rl, '📝 Resumo da mudança (o que foi feito?)\n→ ');
  const motivo        = await pergunta(rl, '\n💡 Motivo (por que foi necessário?)\n→ ');
  const estadoAntes   = await pergunta(rl, '\n⏪ Estado antes (como estava antes?)\n→ ');
  const estadoDepois  = await pergunta(rl, '\n⏩ Estado depois (como ficou agora?)\n→ ');
  const notas         = await pergunta(rl, '\n📎 Notas adicionais (riscos, pendências, observações)\n→ ');

  rl.close();

  const meta = {
    id: `${dataHoje()}_${git.hashCurto}_${slugify(resumo || git.msgCommit)}`,
    dataHora: dataHoraAgora(),
    tipo: 'Automático (pós-commit)',
    historicoAnterior: `→ Commit anterior: ${git.hashAnterior} — "${git.msgAnterior}"`,
  };

  const contexto = { resumo, motivo, estadoAntes, estadoDepois, notas };

  await salvarBackup({ git, meta, contexto });
}

// ═══════════════════════════════════════════════════════════
// MODO MANUAL — Pede todas as informações interativamente
// ═══════════════════════════════════════════════════════════

async function modoManual(nomeArg) {
  console.log('\n✋ MODO MANUAL — Backup sob demanda\n');

  const git = coletarDadosGit();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('Preencha as informações abaixo (Enter para pular, Ctrl+C para cancelar):\n');

  const nomeBackup    = nomeArg || await pergunta(rl, '🏷️  Nome deste backup (ex: correcao-preco-atacado)\n→ ');
  const resumo        = await pergunta(rl, '\n📝 Resumo da mudança (o que foi feito?)\n→ ');
  const motivo        = await pergunta(rl, '\n💡 Motivo (por que foi necessário?)\n→ ');
  const estadoAntes   = await pergunta(rl, '\n⏪ Estado antes (como estava o sistema?)\n→ ');
  const estadoDepois  = await pergunta(rl, '\n⏩ Estado depois (como ficou agora?)\n→ ');
  const notas         = await pergunta(rl, '\n📎 Notas adicionais (riscos, pendências)\n→ ');
  const incluirZip    = await pergunta(rl, '\n📦 Criar ZIP do código? (s/n)\n→ ');

  rl.close();

  const meta = {
    id: `${dataHoje()}_MANUAL_${slugify(nomeBackup || 'backup-manual')}`,
    dataHora: dataHoraAgora(),
    tipo: 'Manual (sob demanda pelo desenvolvedor)',
    historicoAnterior: `→ Commit atual: ${git.hashCurto} — "${git.msgCommit}"`,
  };

  const contexto = { resumo, motivo, estadoAntes, estadoDepois, notas };

  await salvarBackup({ git, meta, contexto, criarZip: incluirZip?.toLowerCase() === 's' });
}

// ═══════════════════════════════════════════════════════════
// SALVAR O BACKUP NO SYNOLOGY
// ═══════════════════════════════════════════════════════════

async function salvarBackup({ git, meta, contexto, criarZip = false }) {
  const pastaDb     = path.join(CONFIG.synologyBase, CONFIG.backupFolder, CONFIG.dbFolder);
  const pastaCodigo = path.join(CONFIG.synologyBase, CONFIG.backupFolder, CONFIG.codigoFolder);

  // Criar pastas se não existirem
  [pastaDb, pastaCodigo].forEach(p => {
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true });
      console.log(`\n📁 Pasta criada: ${p}`);
    }
  });

  // Gerar e salvar o .txt de changelog
  const changelog = gerarChangelog({ git, meta, contexto });
  const arquivoTxt = path.join(pastaDb, `${meta.id}.txt`);
  fs.writeFileSync(arquivoTxt, changelog, 'utf8');
  console.log(`\n✅ Changelog salvo: ${arquivoTxt}`);

  // Criar ZIP do código se solicitado
  if (criarZip) {
    try {
      const zipPath = path.join(pastaCodigo, `${meta.id}.zip`);
      // Usa PowerShell para criar o ZIP (compatível com Windows)
      const cwd = process.cwd();
      execSync(
        `powershell -Command "Compress-Archive -Path '${cwd}\\*' -DestinationPath '${zipPath}' -Force"`,
        { stdio: 'inherit' }
      );
      console.log(`✅ ZIP do código salvo: ${zipPath}`);
    } catch (e) {
      console.log(`⚠️  Não foi possível criar o ZIP: ${e.message}`);
    }
  }

  // Atualizar índice de backups (txt)
  atualizarIndice({ pastaDb, meta, git });

  // Atualizar backup-history.json (lido pela aba Backups no admin)
  atualizarHistoricoJson({ meta, git, contexto });

  console.log(`
╔══════════════════════════════════════════════════════════╗
║  ✅ BACKUP CONCLUÍDO                                      ║
║                                                          ║
║  ID      : ${meta.id.slice(0, 44).padEnd(44)} ║
║  Pasta   : backup-mercadodovale/db/                      ║
║  Synology: sincronizará automaticamente                  ║
╚══════════════════════════════════════════════════════════╝
  `);
}

// ═══════════════════════════════════════════════════════════
// HISTÓRICO JSON (lido pela aba Backups no admin)
// ═══════════════════════════════════════════════════════════

function atualizarHistoricoJson({ meta, git, contexto }) {
  const jsonPath = path.join(process.cwd(), 'public', 'backup-history.json');
  let historico = [];
  if (fs.existsSync(jsonPath)) {
    try {
      historico = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch { historico = []; }
  }
  const entrada = {
    id: meta.id,
    date: meta.dataHora,
    commit: git.hashCurto || 'N/A',
    commitMsg: git.msgCommit || '',
    type: meta.tipo,
    summary: contexto.resumo || '',
    motivo: contexto.motivo || '',
    files: git.arquivos.map(a => a.arquivo),
    notas: contexto.notas || '',
  };
  historico.push(entrada);
  fs.writeFileSync(jsonPath, JSON.stringify(historico, null, 2), 'utf8');
  console.log(`✅ Histórico JSON atualizado: public/backup-history.json`);
}

// ═══════════════════════════════════════════════════════════
// ÍNDICE GERAL DE BACKUPS (ÍNDICE.txt)
// ═══════════════════════════════════════════════════════════

function atualizarIndice({ pastaDb, meta, git }) {
  const arquivoIndice = path.join(pastaDb, 'INDICE.txt');
  const entrada = `${meta.dataHora} | ${meta.id} | ${git.msgCommit || 'backup manual'}\n`;

  let conteudo = '';
  if (fs.existsSync(arquivoIndice)) {
    conteudo = fs.readFileSync(arquivoIndice, 'utf8');
  } else {
    conteudo = `ÍNDICE DE BACKUPS — MERCADO DO VALE\n${'═'.repeat(68)}\n\n`;
  }

  fs.writeFileSync(arquivoIndice, conteudo + entrada, 'utf8');
  console.log(`✅ Índice atualizado: INDICE.txt`);
}

// ═══════════════════════════════════════════════════════════
// UTILITÁRIO
// ═══════════════════════════════════════════════════════════

function slugify(texto) {
  return (texto || 'sem-nome')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

// ═══════════════════════════════════════════════════════════
// PONTO DE ENTRADA
// ═══════════════════════════════════════════════════════════

async function main() {
  const modo = process.argv[2] || '';
  const nomeArg = process.argv[3] || '';

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║        MERCADO DO VALE — SISTEMA DE BACKUP SYNOLOGY      ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (modo === 'auto') {
    await modoAutomatico();
  } else if (modo === 'manual') {
    await modoManual(nomeArg);
  } else {
    console.log(`
  USO:
    node backup-synology.cjs auto              → Backup automático (pós-commit)
    node backup-synology.cjs manual            → Backup manual interativo
    node backup-synology.cjs manual "nome"     → Backup manual com nome definido

  EXEMPLOS:
    node backup-synology.cjs auto
    node backup-synology.cjs manual "correcao-webhook-bling"
    node backup-synology.cjs manual "rollback-preco-atacado"
    `);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('❌ Erro no backup:', err.message);
  process.exit(1);
});
