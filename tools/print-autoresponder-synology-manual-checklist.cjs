#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SYNOLOGY_DOC = path.join(ROOT, 'Synology.md');

const CANONICAL_TUNNEL = {
  name: 'mdv-videos',
  uuid: '7680ed44-a7a9-4700-a37e-2026b3653360',
};

const checklist = [
  {
    id: 'ram_swap',
    env: 'AUTORESPONDER_SYNOLOGY_RAM_SWAP_OK',
    title: 'Conferir RAM/swap do NAS',
    evidence_needed: 'Registrar uso de RAM e swap antes de qualquer ação remota.',
    safe_method: 'DSM Resource Monitor ou leitura manual equivalente.',
  },
  {
    id: 'canonical_tunnel',
    env: 'AUTORESPONDER_SYNOLOGY_TUNNEL_OK',
    title: 'Conferir túnel canônico',
    evidence_needed: `Confirmar túnel ${CANONICAL_TUNNEL.name} com UUID ${CANONICAL_TUNNEL.uuid}.`,
    safe_method: 'Consulta visual/manual no painel já existente, sem reiniciar serviço.',
  },
  {
    id: 'dsm_api',
    env: 'AUTORESPONDER_SYNOLOGY_DSM_API_OK',
    title: 'Conferir DSM API',
    evidence_needed: 'Confirmar que a consulta de leitura da DSM API responde com sucesso.',
    safe_method: 'Abrir a URL de query no navegador e registrar o retorno.',
  },
  {
    id: 'legacy_token_absent',
    env: 'AUTORESPONDER_SYNOLOGY_LEGACY_TOKEN_ABSENT',
    title: 'Conferir ausência de processo legado',
    evidence_needed: 'Confirmar que não existe processo cloudflared legado usando --token.',
    safe_method: 'Inspeção manual/read-only de processos, sem parar nada.',
  },
];

const forbiddenActions = [
  'não altera Synology',
  'não reinicia túnel',
  'não altera DNS',
  'não altera tarefas agendadas',
  'não reinicia processos',
  'não habilita limpeza de logs',
];

function main() {
  const synologyDocExists = fs.existsSync(SYNOLOGY_DOC);

  console.log(JSON.stringify({
    ok: synologyDocExists,
    manual_only: true,
    read_only: true,
    does_not_execute_remote_checks: true,
    source_of_truth: 'Synology.md',
    source_of_truth_exists: synologyDocExists,
    canonical_tunnel: CANONICAL_TUNNEL,
    checklist,
    gate_envs_to_confirm_after_manual_checks: checklist.map((item) => item.env),
    dsm_api_read_url: 'https://dsm-api.xiaomipetrolina.com.br/webapi/query.cgi?api=SYNO.API.Info&version=1&method=query&query=SYNO.API.Auth,SYNO.FileStation.List',
    forbidden_actions: forbiddenActions,
    next_safe_step: 'Executar apenas as conferências manuais e depois rodar o safety gate local.',
  }, null, 2));

  if (!synologyDocExists) process.exitCode = 1;
}

main();
