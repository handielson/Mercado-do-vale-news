import React, { useState } from 'react';
import {
  Server,
  CheckCircle2,
  Settings,
  ShieldAlert,
  AlertCircle,
  Lightbulb,
  Rocket,
  Terminal,
  Wrench,
  Copy,
  CheckCheck,
} from 'lucide-react';

type Snippet = { label: string; code: string };

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      {label && <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</div>}
      <pre className="bg-slate-900 text-green-300 text-xs p-3 rounded-lg overflow-x-auto leading-relaxed pr-12">{code}</pre>
      <button
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute top-2 right-2 p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all opacity-0 group-hover:opacity-100"
        title="Copiar"
      >
        {copied ? <CheckCheck size={14} className="text-emerald-400" /> : <Copy size={14} />}
      </button>
    </div>
  );
}

const DIAGNOSTIC_CMDS: Snippet[] = [
  {
    label: '1. Tunel CF respondendo? (deve dar 200)',
    code: 'curl -s -o /dev/null -w "%{http_code}\\n" https://videos.mercadodovale.com.br/1RCAMX2RCAF.mp4',
  },
  {
    label: '2. API DSM acessível via tunel? (deve dar success:true)',
    code: 'curl -s "https://dsm-api.xiaomipetrolina.com.br/webapi/query.cgi?api=SYNO.API.Info&version=1&method=query&query=SYNO.API.Auth,SYNO.FileStation.List"',
  },
  {
    label: '3. Login DSM funciona? (deve retornar sid)',
    code: 'curl -s "https://dsm-api.xiaomipetrolina.com.br/webapi/auth.cgi?api=SYNO.API.Auth&version=7&method=login&account=Handielson&passwd=SUA_SENHA&session=FileStation&format=sid"',
  },
  {
    label: '4. VPS lista os 491 vídeos? (precisa do x-sync-key)',
    code: 'curl -s -D- -H "x-sync-key: $SYNC_SECRET" "https://api.xiaomipetrolina.com.br/synology/files?folder=videos&limit=5" | head -20',
  },
  {
    label: '5. Rodar script de diagnóstico local completo',
    code: 'node diagnose-synology.cjs',
  },
];

const RESTORE_CMDS: Snippet[] = [
  {
    label: 'A. Fix automático: .env da VPS + pm2 restart',
    code: 'node fix-synology-url-vps.cjs',
  },
  {
    label: 'B. Fix manual via SSH (se o script falhar)',
    code: [
      'ssh root@76.13.232.162',
      'sed -i \'s|^SYNOLOGY_URL=.*|SYNOLOGY_URL="https://dsm-api.xiaomipetrolina.com.br"|\' /var/www/mdv-api/.env',
      'grep SYNOLOGY_URL /var/www/mdv-api/.env    # conferir',
      'pm2 restart all --update-env',
      'pm2 logs mdv-api --lines 30                # observar',
    ].join('\n'),
  },
  {
    label: 'C. Se o túnel CF estiver caído (admin ficar 0 mesmo com .env correto)',
    code: [
      '# No DSM do NAS: Painel de Controle → Agendador de Tarefas',
      '# Localizar: instalar-cloudflared',
      '# 1) Verificar se está HABILITADA',
      '# 2) Botão Executar',
      '# 3) Aguardar ~30s, testar: curl https://videos.mercadodovale.com.br/<algum>.mp4',
    ].join('\n'),
  },
];

export const SynologyConfigPage = () => {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
              <Server size={20} />
            </div>
            Configuração Synology & CDN
          </h1>
          <p className="text-slate-500 mt-2">
            Infraestrutura, URLs, credenciais e runbook de restauração da integração Synology NAS via Cloudflare Tunnel.
          </p>
        </div>
        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200 uppercase tracking-wider whitespace-nowrap self-start md:self-auto">
          Ativo — Cloudflare Tunnel ✓
        </span>
      </div>

      {/* RUNBOOK — em destaque, porque é o motivo de a página existir */}
      <section className="bg-white rounded-xl border-2 border-rose-200 overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-rose-50 to-amber-50 border-b border-rose-200 p-6 flex items-center gap-3">
          <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center text-rose-600 shrink-0">
            <Wrench size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">🚨 Runbook — Quando os vídeos aparecerem 0</h2>
            <p className="text-sm text-slate-600">Sintoma clássico: admin mostra 0 arquivos mas o File Station tem centenas. Use na ordem.</p>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Terminal size={16} className="text-indigo-500" />
              Passo 1 — Diagnóstico (identificar a camada quebrada)
            </h3>
            <div className="space-y-3">
              {DIAGNOSTIC_CMDS.map((s, i) => (
                <CodeBlock key={i} code={s.code} label={s.label} />
              ))}
            </div>
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 leading-relaxed">
              <strong className="text-slate-800">Como ler os resultados:</strong>
              <ul className="list-disc list-inside mt-1.5 space-y-1">
                <li>Passo 1 falhar (≠200): tunel CF caído → <strong>Passo C</strong> do restauro.</li>
                <li>Passo 2 falhar: tunel CF caído OU hostname <code className="bg-slate-200 px-1 rounded">dsm-api</code> sem rota no config.yml.</li>
                <li>Passo 3 falhar: senha Synology mudou — atualizar <code className="bg-slate-200 px-1 rounded">SYNOLOGY_PASS</code> no .env da VPS.</li>
                <li>Passo 4 falhar com lista vazia mas passos 1–3 OK: <code className="bg-slate-200 px-1 rounded">SYNOLOGY_URL</code> na VPS apontando pra QuickConnect → <strong>Passo A</strong>.</li>
              </ul>
            </div>
          </div>

          <hr className="border-slate-100" />

          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Wrench size={16} className="text-emerald-500" />
              Passo 2 — Restauração (na ordem: A → B → C)
            </h3>
            <div className="space-y-3">
              {RESTORE_CMDS.map((s, i) => (
                <CodeBlock key={i} code={s.code} label={s.label} />
              ))}
            </div>
          </div>

          <hr className="border-slate-100" />

          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h4 className="font-semibold text-indigo-800 text-sm flex items-center gap-2 mb-2">
              <AlertCircle size={16} /> Causa raiz conhecida (Abr/2026)
            </h4>
            <p className="text-sm text-indigo-700 leading-relaxed">
              Em 18/04/2026 os vídeos caíram para 0 no admin. Causa: a VPS (Hostinger) tentava falar com o NAS via{' '}
              <code className="bg-indigo-100 px-1 rounded text-xs">192-168-1-25.handielson.direct.quickconnect.to:5001</code>, mas a VPS fica fora da rede do NAS —
              esse endereço só é alcançável de dispositivos na mesma LAN. A correção foi trocar <code className="bg-indigo-100 px-1 rounded text-xs">SYNOLOGY_URL</code> para{' '}
              <code className="bg-indigo-100 px-1 rounded text-xs">https://dsm-api.xiaomipetrolina.com.br</code> (roteia pela Cloudflare Tunnel, que tem alcance global) e <code className="bg-indigo-100 px-1 rounded text-xs">pm2 restart all --update-env</code>.
              Se voltar a quebrar, <strong>checar primeiro se o .env da VPS foi revertido</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* URLS ATIVAS */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-slate-50 border-b border-slate-200 p-6 flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
            <Rocket size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">URLs Ativas do CDN</h2>
            <p className="text-sm text-slate-500">Todas via Cloudflare Tunnel <code className="bg-slate-100 px-1 rounded text-xs">mdv-videos</code>.</p>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-2">🎬 Vídeos</h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                <li><span className="font-semibold">CDN principal:</span> <code className="bg-slate-100 px-1 rounded">https://videos.mercadodovale.com.br/</code></li>
                <li><span className="font-semibold">DDNS alternativo:</span> <code className="bg-slate-100 px-1 rounded">https://mdvvideos.i234.me/</code> (só LAN — CGNAT bloqueia externo)</li>
                <li><span className="font-semibold">Pasta origem:</span> <code className="bg-slate-100 px-1 rounded">/web/videos/</code> no NAS</li>
                <li><span className="font-semibold">Convenção:</span> arquivo nomeado com SKU (ex: <code className="bg-slate-100 px-1 rounded">P3DP.mp4</code>) aparece automaticamente no produto</li>
              </ul>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-2">🖼️ Imagens</h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                <li><span className="font-semibold">CDN:</span> <code className="bg-slate-100 px-1 rounded">https://imagens.xiaomipetrolina.com.br/</code></li>
                <li><span className="font-semibold">Pasta origem:</span> <code className="bg-slate-100 px-1 rounded">/web/imagens/</code> no NAS</li>
              </ul>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-2">📄 Arquivos</h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                <li><span className="font-semibold">CDN:</span> <code className="bg-slate-100 px-1 rounded">https://arquivos.xiaomipetrolina.com.br/</code></li>
                <li><span className="font-semibold">Pasta origem:</span> <code className="bg-slate-100 px-1 rounded">/web/arquivos/</code> no NAS</li>
              </ul>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-2">🛠️ API DSM (listagem/upload)</h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                <li><span className="font-semibold">Endpoint:</span> <code className="bg-slate-100 px-1 rounded">https://dsm-api.xiaomipetrolina.com.br/</code></li>
                <li><span className="font-semibold">Uso:</span> a VPS faz login + <code className="bg-slate-100 px-1 rounded">SYNO.FileStation</code> por este hostname</li>
                <li><span className="font-semibold">Porta interna:</span> <code className="bg-slate-100 px-1 rounded">https://127.0.0.1:5001</code> com <code className="bg-slate-100 px-1 rounded">noTLSVerify: true</code></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* INFRAESTRUTURA */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-slate-50 border-b border-slate-200 p-6 flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
            <Settings size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Infraestrutura Instalada</h2>
            <p className="text-sm text-slate-500">Onde mora cada parte da integração.</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-3">🖥️ Synology NAS</h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                <li><span className="font-semibold">IP local:</span> <code className="bg-slate-100 px-1 rounded">192.168.1.2</code></li>
                <li><span className="font-semibold">QuickConnect:</span> <code className="bg-slate-100 px-1 rounded">handielson.direct.quickconnect.to:5001</code> (só LAN)</li>
                <li><span className="font-semibold">URL admin externo:</span> <code className="bg-slate-100 px-1 rounded">https://handielson.us2.quickconnect.to</code></li>
                <li><span className="font-semibold">Usuário admin:</span> <code className="bg-slate-100 px-1 rounded">Handielson</code></li>
                <li><span className="font-semibold">cloudflared:</span> <code className="bg-slate-100 px-1 rounded">/usr/local/bin/cloudflared</code> v2026.3.0</li>
                <li><span className="font-semibold">Credenciais túnel:</span> <code className="bg-slate-100 px-1 rounded">/volume1/.cloudflared/7680ed44-...json</code></li>
                <li><span className="font-semibold">Config túnel:</span> <code className="bg-slate-100 px-1 rounded">/volume1/.cloudflared/config.yml</code></li>
                <li><span className="font-semibold">Log túnel:</span> <code className="bg-slate-100 px-1 rounded">/volume1/.cloudflared/tunnel.log</code></li>
              </ul>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-3">☁️ Cloudflare Tunnel</h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                <li><span className="font-semibold">Conta:</span> Handielson@gmail.com</li>
                <li><span className="font-semibold">Túnel:</span> <code className="bg-slate-100 px-1 rounded">mdv-videos</code></li>
                <li><span className="font-semibold">ID:</span> <code className="bg-slate-100 px-1 rounded">7680ed44-a7a9-4700-a37e-2026b3653360</code></li>
                <li><span className="font-semibold">Edge ativo:</span> São Paulo (gru08/gru17/gru19/gru21)</li>
                <li><span className="font-semibold">NS Handielson:</span> <code className="bg-slate-100 px-1 rounded">carlos.ns.cloudflare.com</code> + <code className="bg-slate-100 px-1 rounded">jill.ns.cloudflare.com</code></li>
                <li><span className="font-semibold">Zone ID:</span> <code className="bg-slate-100 px-1 rounded">e9e17e9e9d6d9ac89cf99f09fd70c34</code></li>
                <li><span className="font-semibold">Account ID:</span> <code className="bg-slate-100 px-1 rounded">8114558994545fcb1dac3536aad408a4</code></li>
              </ul>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-3">🖥️ VPS Hostinger (API)</h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                <li><span className="font-semibold">Host:</span> <code className="bg-slate-100 px-1 rounded">76.13.232.162</code></li>
                <li><span className="font-semibold">Caminho:</span> <code className="bg-slate-100 px-1 rounded">/var/www/mdv-api/</code></li>
                <li><span className="font-semibold">Processo:</span> <code className="bg-slate-100 px-1 rounded">pm2</code> (app <code className="bg-slate-100 px-1 rounded">mdv-api</code>)</li>
                <li><span className="font-semibold">Env file:</span> <code className="bg-slate-100 px-1 rounded">/var/www/mdv-api/.env</code></li>
                <li><span className="font-semibold">API pública:</span> <code className="bg-slate-100 px-1 rounded">https://api.xiaomipetrolina.com.br</code></li>
                <li><span className="font-semibold">Auth:</span> header <code className="bg-slate-100 px-1 rounded">x-sync-key</code> (<code className="bg-slate-100 px-1 rounded">SYNC_SECRET</code>)</li>
              </ul>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-3">🌐 Domínios (GoDaddy)</h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                <li><span className="font-semibold">mercadodovale.com.br:</span> NS amos + nora (CF outra conta) — loja ativa</li>
                <li><span className="font-semibold">mercadodovale.com:</span> NS ns77/ns78 (GoDaddy) — só redirect</li>
                <li><span className="font-semibold">xiaomipetrolina.com.br:</span> NS ns77/ns78 (GoDaddy) — em construção</li>
                <li className="text-amber-700 font-semibold pt-1">⚠️ Email ativo: contato@mercadodovale.com.br → 31.57.174.13</li>
              </ul>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase mb-2">📄 Config do túnel (/volume1/.cloudflared/config.yml)</h4>
            <pre className="text-xs text-green-300 overflow-x-auto leading-relaxed">{`tunnel: 7680ed44-a7a9-4700-a37e-2026b3653360
credentials-file: /volume1/.cloudflared/7680ed44-...json
ingress:
  - hostname: videos.mercadodovale.com.br
    service: http://127.0.0.1:80
  - hostname: imagens.xiaomipetrolina.com.br
    service: http://127.0.0.1:80
  - hostname: arquivos.xiaomipetrolina.com.br
    service: http://127.0.0.1:80
  - hostname: dsm-api.xiaomipetrolina.com.br
    service: https://127.0.0.1:5001
    originRequest:
      noTLSVerify: true
  - service: http_status:404`}</pre>
          </div>

          <div className="bg-slate-800 rounded-lg p-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase mb-2">🔑 Variáveis esperadas no .env da VPS (<code className="text-amber-300">/var/www/mdv-api/.env</code>)</h4>
            <pre className="text-xs text-green-300 overflow-x-auto leading-relaxed">{`SYNOLOGY_URL="https://dsm-api.xiaomipetrolina.com.br"
SYNOLOGY_USER="Handielson"
SYNOLOGY_PASS="<senha do usuário Handielson no DSM>"
SYNC_SECRET="<chave compartilhada com o frontend (VITE_VPS_SYNC_KEY)>"`}</pre>
            <p className="text-xs text-slate-400 mt-2">
              Backup dos .env anteriores fica em <code className="bg-slate-900 text-amber-300 px-1 rounded">/var/www/mdv-api/.env.bak.&lt;timestamp&gt;</code> (criado pelo script <code className="bg-slate-900 text-amber-300 px-1 rounded">fix-synology-url-vps.cjs</code>).
              Template versionado: <code className="bg-slate-900 text-amber-300 px-1 rounded">.env.vps.example</code> na raiz.
            </p>
          </div>
        </div>
      </section>

      {/* ATENÇÃO MANUTENÇÃO */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-slate-50 border-b border-slate-200 p-6 flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
            <ShieldAlert size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Pontos de Atenção</h2>
            <p className="text-sm text-slate-500">O que pode quebrar e por quê.</p>
          </div>
        </div>
        <div className="p-6 space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-semibold text-amber-800 text-sm flex items-center gap-2">
              <AlertCircle size={16} /> Tarefa <code className="bg-amber-100 px-1 rounded">instalar-cloudflared</code> deve ficar HABILITADA
            </h4>
            <p className="text-sm text-amber-700 mt-2">
              Em Abr/2026 o tunnel caiu porque a tarefa agendada estava desabilitada desde 21/03. Se o tunnel cair, no DSM: <strong>Agendador de Tarefas</strong> → <code className="bg-amber-100 px-1 rounded">instalar-cloudflared</code> → <strong>Executar</strong>. A tarefa roda automaticamente no boot do NAS.
            </p>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
            <h4 className="font-semibold text-rose-800 text-sm flex items-center gap-2">
              <AlertCircle size={16} /> VPS precisa acessar o NAS pela internet pública
            </h4>
            <p className="text-sm text-rose-700 mt-2">
              A VPS (Hostinger) fica fora da rede do NAS, logo <strong>QuickConnect/IP local não funcionam</strong> para ela. Sempre usar <code className="bg-rose-100 px-1 rounded">https://dsm-api.xiaomipetrolina.com.br</code> em <code className="bg-rose-100 px-1 rounded">SYNOLOGY_URL</code>.
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-semibold text-amber-800 text-sm flex items-center gap-2">
              <AlertCircle size={16} /> Registro <code className="bg-amber-100 px-1 rounded">mail</code> com Proxy ligado no Cloudflare
            </h4>
            <p className="text-sm text-amber-700 mt-1">
              Na zona Cloudflare, <code className="bg-amber-100 px-1 rounded">A mail → 31.57.174.13</code> está "Proxied". Antes de ativar NS de mercadodovale.com.br, mudar para <strong>DNS only</strong> (nuvem cinza) para não quebrar o SMTP de <code className="bg-amber-100 px-1 rounded">contato@mercadodovale.com.br</code>.
            </p>
          </div>
          <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
            <h4 className="font-semibold text-sky-800 text-sm flex items-center gap-2">
              <AlertCircle size={16} /> Portas liberadas na operadora (inutilizadas por CGNAT)
            </h4>
            <p className="text-sm text-sky-700 mt-1">
              <code className="bg-sky-100 px-1 rounded">59996</code> → HTTP NAS:80 · <code className="bg-sky-100 px-1 rounded">59997</code> → HTTPS NAS:443 · <code className="bg-sky-100 px-1 rounded">60532</code> livre. Configurado no ZTE, mas a operadora Leste/Vero usa NAT de operadora — acesso externo só funciona via Cloudflare Tunnel.
            </p>
          </div>
        </div>
      </section>

      {/* O QUE FOI FEITO */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-slate-50 border-b border-slate-200 p-6 flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Histórico do Setup</h2>
            <p className="text-sm text-slate-500">Marcos do que foi feito para chegar ao estado atual.</p>
          </div>
        </div>
        <div className="p-6">
          <ul className="space-y-3">
            {[
              ['Web Station e DDNS', 'Diretório /web/videos criado no Synology, Web Station na porta 80, CORS liberado, DDNS mdvvideos.i234.me.'],
              ['CGNAT identificado', 'Operadora Leste/Vero usa NAT de operadora (WAN 100.64.32.168). Bloqueia port forwarding e DMZ do ZTE.'],
              ['Cloudflare Tunnel instalado', 'cloudflared v2026.3.0 em /usr/local/bin/cloudflared via Agendador (root).'],
              ['Túnel mdv-videos conectado', 'ID 7680ed44-... edge São Paulo (gru08/17/19/21), saída 45.168.152.106.'],
              ['Zona CF mercadodovale.com.br', 'Criada na conta Handielson. CNAMEs de videos, MX, mail → 31.57.174.13, DKIM, SPF.'],
              ['Tarefas no Agendador', 'instalar-cloudflared + update-tunnel-config (ambas como root, boot do NAS).'],
              ['Hostnames ativos', 'dsm-api, imagens, arquivos (xiaomipetrolina.com.br) + videos (mercadodovale.com.br) via túnel.'],
              ['Fix 18/04/2026', 'SYNOLOGY_URL da VPS migrada do QuickConnect para dsm-api.xiaomipetrolina.com.br. Listagem voltou a 491 vídeos.'],
            ].map(([title, desc], i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <p><strong className="text-slate-800">{title}:</strong> {desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* SUGESTÕES FUTURAS */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-slate-50 border-b border-slate-200 p-6 flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
            <Lightbulb size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Sugestões Futuras p/ o Synology</h2>
            <p className="text-sm text-slate-500">Possíveis usos do NAS além do CDN.</p>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="border border-slate-200 rounded-lg p-5 bg-white hover:border-purple-300 hover:shadow-md transition-all">
              <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2"><span className="text-purple-500 text-lg">🎬</span> Auto-Compressão</h4>
              <p className="text-xs text-slate-600 leading-relaxed">FFmpeg nativo do Synology para comprimir vídeos crus automaticamente, economizando banda no 4G do cliente.</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-5 bg-white hover:border-green-300 hover:shadow-md transition-all">
              <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2"><span className="text-green-500 text-lg">🖼️</span> Auto-Capa de Vídeo</h4>
              <p className="text-xs text-slate-600 leading-relaxed">NAS gera JPEG do frame 00:03 de cada vídeo. Vitrine mostra imagem leve e baixa o vídeo só quando o cliente der play.</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-5 bg-white hover:border-sky-300 hover:shadow-md transition-all">
              <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2"><span className="text-sky-500 text-lg">💾</span> Backup Diário</h4>
              <p className="text-xs text-slate-600 leading-relaxed">Rotina noturna para backup do VPS e pedidos Bling no NAS. Segurança local caso a nuvem tenha indisponibilidade.</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-5 bg-white hover:border-rose-300 hover:shadow-md transition-all">
              <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2"><span className="text-rose-500 text-lg">🗂️</span> Storage Off-Cloud</h4>
              <p className="text-xs text-slate-600 leading-relaxed">NAS como banco de imagens/PDFs, eliminando custo de storage premium no VPS (cobrança em dólar/GB).</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-5 bg-white hover:border-indigo-300 hover:shadow-md transition-all">
              <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2"><span className="text-indigo-500 text-lg">📊</span> BI Local</h4>
              <p className="text-xs text-slate-600 leading-relaxed">Metabase no Docker do Synology conectando ao VPS para dashboards de lucro, curva ABC e conversão na intranet.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SynologyConfigPage;
