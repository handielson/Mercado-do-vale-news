export type SystemStatusState = 'healthy' | 'warning' | 'error' | 'configured' | 'unconfigured' | 'unknown';
export type SystemStatusGroup = 'Infraestrutura' | 'Comunicação' | 'Publicações' | 'Integrações';
export interface SystemStatusDefinition {
  id: string;
  name: string;
  group: SystemStatusGroup;
  href: string;
  source: string | null;
}
export interface SystemStatusCheck extends SystemStatusDefinition {
  state: SystemStatusState;
  label: string;
  detail: string;
  checkedAt: string | null;
  sourceAt?: string | null;
}

// Each source is queried once per refresh; multiple cards may consume that result.
export const systemStatusDefinitions: SystemStatusDefinition[] = [
  { id: 'site', name: 'Site e versão', group: 'Infraestrutura', href: '/admin', source: 'site' },
  { id: 'api', name: 'API / VPS', group: 'Infraestrutura', href: '/admin/settings/vps-status', source: 'api' },
  { id: 'mysql', name: 'Banco MySQL', group: 'Infraestrutura', href: '/admin/settings/vps-status', source: 'api' },
  { id: 'disk', name: 'Disco da VPS', group: 'Infraestrutura', href: '/admin/settings/vps-status', source: 'api' },
  { id: 'synology', name: 'NAS / Synology', group: 'Infraestrutura', href: '/admin/settings/vps-status', source: 'synology' },
  { id: 'backup', name: 'Backups', group: 'Infraestrutura', href: '/admin/settings/system-backup', source: 'backup' },
  { id: 'bot', name: 'Servidor do bot / n8n', group: 'Comunicação', href: '/admin/whatsapp/novo-bot', source: 'bot' },
  { id: 'attendance', name: 'WhatsApp de atendimento', group: 'Comunicação', href: '/admin/settings/whatsapp', source: 'attendance' },
  { id: 'waha', name: 'WhatsApp dos Status / WAHA', group: 'Publicações', href: '/admin/settings/marketing?tab=whatsapp', source: 'waha' },
  { id: 'instagram', name: 'Instagram / Stories', group: 'Publicações', href: '/admin/settings/marketing?tab=instagram', source: 'meta' },
  { id: 'facebook', name: 'Facebook / Meta', group: 'Publicações', href: '/admin/settings/marketing?tab=instagram', source: 'meta' },
  { id: 'stories', name: 'Publicações de hoje', group: 'Publicações', href: '/admin/settings/marketing?tab=calendar', source: 'stories' },
  { id: 'ml', name: 'Mercado Livre', group: 'Integrações', href: '/admin/settings/mercado-livre', source: 'ml' },
  { id: 'shopee', name: 'Shopee', group: 'Integrações', href: '/admin/settings/shopee', source: 'shopee' },
  { id: 'tiktok', name: 'TikTok Shop', group: 'Integrações', href: '/admin/settings/tiktok-shop', source: 'tiktok' },
  { id: 'bling', name: 'Bling · sincronização fiscal', group: 'Integrações', href: '/admin/settings/bling', source: 'bling' },
  { id: 'payments', name: 'Pagamentos do site', group: 'Integrações', href: '/admin/settings/integrations', source: 'payments' },
  { id: 'fiscal', name: 'Alertas de certificados fiscais', group: 'Integrações', href: '/admin/settings/company', source: 'fiscal' },
  { id: 'print3d', name: 'Loja 3D', group: 'Integrações', href: '/admin/loja-3d/configuracoes', source: 'print3d' },
  { id: 'telegram', name: 'Telegram', group: 'Comunicação', href: '/admin/settings/telegram', source: null },
  { id: 'email', name: 'E-mail', group: 'Comunicação', href: '/admin/settings/email', source: null },
  { id: 'contacts', name: 'Agenda Google', group: 'Comunicação', href: '/admin/settings/whatsapp', source: null },
];

export function initialSystemStatusChecks(): SystemStatusCheck[] {
  return systemStatusDefinitions.map(def => ({ ...def, state: 'unknown', label: def.source ? 'Aguardando consulta' : 'Sem monitoramento',
    detail: def.source ? 'O diagnóstico ainda não foi consultado.' : 'Sem diagnóstico automático disponível. Consulte os detalhes da integração.', checkedAt: null }));
}

function localDay(value: string | Date): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function recent(value: unknown, now: Date, maxAgeMs: number): boolean {
  if (typeof value !== 'string') return false;
  const age = now.getTime() - new Date(value).getTime();
  return Number.isFinite(age) && age >= -60000 && age <= maxAgeMs;
}
function expiryTime(value: unknown): number {
  if (typeof value === 'number' || typeof value === 'string' && /^\d{10,13}$/.test(value)) {
    const numeric = Number(value);
    return numeric < 1e12 ? numeric * 1000 : numeric;
  }
  return typeof value === 'string' ? Date.parse(value) : NaN;
}
const result = (state: SystemStatusState, label: string, detail: string, sourceAt?: string | null) => ({ state, label, detail, sourceAt });
const unknown = () => result('unknown', 'Sem diagnóstico', 'A resposta não contém um diagnóstico válido. Consulte os detalhes.');

// Responses are reduced to safe summaries. Never render raw API errors, tokens or contact data.
export function interpretSystemStatus(id: string, data: any, now = new Date()): Pick<SystemStatusCheck, 'state' | 'label' | 'detail' | 'sourceAt'> {
  if (data == null) return unknown();
  switch (id) {
    case 'site': return typeof data.version === 'string' ? result('healthy', 'Disponível', `Versão ${data.version}.`) : unknown();
    case 'api': return typeof data.ok === 'boolean' ? result(data.ok ? 'healthy' : 'error', data.ok ? 'Online' : 'Com falha', `Resposta da API: ${Number(data.response_ms) || 0} ms.`) : unknown();
    case 'mysql': return typeof data.mysql?.ok === 'boolean' ? result(data.mysql.ok ? 'healthy' : 'error', data.mysql.ok ? 'Online' : 'Com falha', data.mysql.ok ? `Consulta ao banco: ${Number(data.mysql.ping_ms) || 0} ms.` : 'A API não conseguiu consultar o banco.') : unknown();
    case 'disk': {
      const total = data.disk?.total_gb; const free = data.disk?.free_gb;
      if (typeof total !== 'number' || total <= 0 || typeof free !== 'number' || free < 0 || free > total) return unknown();
      const used = (total - free) / total * 100;
      return result(used >= 95 ? 'error' : used >= 85 ? 'warning' : 'healthy', used >= 85 ? 'Espaço baixo' : 'Normal', `${free.toFixed(1)} GB livres · ${used.toFixed(0)}% utilizado.`);
    }
    case 'synology': {
      if (!['online', 'stale', 'offline', 'missing'].includes(data.state)) return unknown();
      if (data.state === 'missing') return result('unknown', 'Sem dados', 'Nenhum heartbeat do NAS disponível.');
      if (!data.snapshot && data.state === 'online') return unknown();
      const at = data.snapshot?.timestamp;
      if (data.state === 'offline') return result('error', 'Offline', 'O heartbeat do NAS expirou.', at);
      if (data.state === 'stale') return result('warning', 'Desatualizado', 'A leitura do NAS está desatualizada.', at);
      return result(data.snapshot?.health?.level === 'critical' ? 'error' : data.snapshot?.health?.level === 'warning' ? 'warning' : 'healthy', 'Heartbeat recebido', 'Estado e saúde informados pelo monitor do NAS.', at);
    }
    case 'bot': {
      if (!['online', 'offline', 'checking'].includes(data.status)) return unknown();
      if (!recent(data.checkedAt, now, 120000)) return result('unknown', 'Leitura desatualizada', 'Sem verificação recente do servidor do bot.', data.checkedAt);
      return result(data.status === 'online' ? 'healthy' : data.status === 'offline' ? 'error' : 'unknown', data.status === 'online' ? 'Online' : data.status === 'offline' ? 'Offline' : 'Verificando', 'Saúde do servidor; a conexão WhatsApp é verificada separadamente.', data.checkedAt);
    }
    case 'attendance': {
      if (typeof data.evolution?.state !== 'string') return unknown();
      if (data.evolution.state !== 'open') return result('error', 'Desconectado', 'O WhatsApp de atendimento precisa reconectar.');
      if (data.control?.paused === true) return result('warning', 'Bot pausado', 'WhatsApp conectado, mas o atendimento automático está pausado.');
      if (data.webhook?.valid !== true) return result('warning', 'Webhook pendente', 'WhatsApp conectado; integração do atendimento precisa de conferência.');
      return result('healthy', 'Conectado', 'WhatsApp conectado e webhook validado.');
    }
    case 'waha': {
      if (data.configured === false) return result('unconfigured', 'Não configurado', 'A sessão de publicação dos Status não foi configurada.');
      if (!recent(data.checkedAt, now, 120000)) return result('unknown', 'Leitura desatualizada', 'Sem verificação recente da sessão de publicação.', data.checkedAt);
      if (data.connected === true && data.state === 'WORKING') return result('healthy', 'Conectado', 'Sessão dos Status pronta. A confirmação de cada envio aparece nas publicações.', data.checkedAt);
      return result(data.state === 'STARTING' ? 'warning' : 'error', data.state === 'SCAN_QR_CODE' ? 'Precisa de QR Code' : data.state === 'STARTING' ? 'Iniciando' : 'Indisponível', 'A sessão WAHA usada pelos Status não está pronta.', data.checkedAt);
    }
    case 'instagram': case 'facebook': {
      const conn = data.connection;
      if (!conn || typeof conn.configured !== 'boolean') return unknown();
      if (!conn.configured) return result('unconfigured', 'Não configurado', 'Configuração Meta pendente.');
      if (conn.status !== 'connected' || (conn.tokenExpiresAt && expiryTime(conn.tokenExpiresAt) < now.getTime())) return result('warning', conn.status === 'expired' || conn.status === 'connected' ? 'Token expirado' : 'Não conectado', 'Confira a autorização da conta Meta.');
      if (id === 'instagram' && (!conn.selectedInstagramAccountId || !Array.isArray(conn.missingPublishingScopes) || conn.missingPublishingScopes.length)) return result('warning', 'Permissões pendentes', 'Selecione o Instagram e confira as permissões para Stories.');
      if (id === 'facebook' && !conn.selectedPage) return result('warning', 'Página pendente', 'Selecione a página da conta Meta.');
      return result('configured', 'Autorizado', 'Autorização registrada. O estado de cada publicação é acompanhado separadamente.');
    }
    case 'stories': {
      if (!Array.isArray(data.items)) return unknown();
      const todayItems = data.items.flatMap((s: any) => Array.isArray(s?.items) ? s.items : []).filter((i: any) => i && localDay(i.scheduled_at) === localDay(now));
      const deliveries = todayItems.flatMap((i: any) => Array.isArray(i.deliveries) ? i.deliveries.filter((d: any) => d && typeof d.status === 'string') : []);
      const count = (state: string) => deliveries.filter((d: any) => d.status === state).length;
      const failed = count('failed'); const published = count('published');
      const pending = count('pending') + count('waiting_approval'); const processing = count('processing');
      const overdue = todayItems.some((i: any) => new Date(i.scheduled_at).getTime() < now.getTime() - 900000 && Array.isArray(i.deliveries) && i.deliveries.some((d: any) => d?.status === 'pending'));
      return result(failed ? 'error' : overdue || pending || processing ? 'warning' : deliveries.length ? 'healthy' : 'unknown', failed ? 'Falhas hoje' : overdue ? 'Envios atrasados' : processing ? 'Publicando' : pending ? 'Aguardando envios' : deliveries.length ? 'Concluídas' : 'Sem publicações hoje', `${published} publicadas · ${failed} falhas · ${pending} aguardando · ${processing} em andamento · ${count('cancelled')} canceladas. Até 100 agendamentos recentes.`);
    }
    case 'backup': {
      if (!data.status || typeof data.status.state !== 'string') return unknown();
      if (data.status.state === 'running') return result('warning', 'Em andamento', 'Backup em execução.', data.status.startedAt);
      if (['failed', 'partial'].includes(data.status.state)) return result(data.status.state === 'failed' ? 'error' : 'warning', data.status.state === 'failed' ? 'Falhou' : 'Parcial', 'Confira o último backup e sua cópia no NAS.', data.status.finishedAt);
      if (data.config?.enabled === false) return result('warning', 'Automático desativado', 'O backup automático está desativado.', data.status.finishedAt);
      if (data.status.state === 'success') return result(recent(data.status.finishedAt, now, 36 * 3600000) ? 'healthy' : 'warning', recent(data.status.finishedAt, now, 36 * 3600000) ? 'Último backup concluído' : 'Backup antigo', 'Confira os detalhes e as cópias disponíveis.', data.status.finishedAt);
      return result('unknown', 'Sem backup confirmado', 'Ainda não há uma execução concluída confirmada.');
    }
    case 'ml': case 'tiktok': {
      if (typeof data.configured !== 'boolean' || typeof data.connected !== 'boolean') return unknown();
      if (!data.configured) return result('unconfigured', 'Não configurado', 'Configure a integração para autorizar a loja.');
      if (!data.connected) return result('warning', 'Não autorizado', 'Confira a autorização da loja.');
      const expiresAt = id === 'ml' ? data.tokenExpiresAt : data.access_token_expires_at;
      if (expiresAt && expiryTime(expiresAt) < now.getTime()) return result('warning', 'Token expirado', 'Confira a renovação da autorização nos detalhes.');
      return result('configured', 'Autorizado', 'Autorização registrada. Esta consulta não testa uma venda ou sincronização.');
    }
    case 'shopee': {
      if (!Array.isArray(data.connections)) return unknown();
      const active = data.connections.filter((c: any) => c.active === true || c.active === 1);
      if (!active.length) return result('unconfigured', 'Sem loja ativa', 'Nenhuma conexão Shopee ativa cadastrada.');
      const connected = active.filter((c: any) => c.authorization_status === 'connected').length;
      return result(connected < active.length ? 'warning' : 'configured', connected < active.length ? 'Autorização pendente' : 'Autorizado', `${connected} de ${active.length} lojas ativas com autorização registrada. Não testa sincronização.`);
    }
    case 'bling': {
      if (typeof data.enabled !== 'boolean') return unknown();
      if (!data.enabled || data.state === 'disabled') return result('unconfigured', 'Sincronização desativada', 'A automação fiscal do Bling está desativada.');
      if (['failed', 'error', 'disconnected', 'missing_profile'].includes(data.state)) return result('error', 'Requer atenção', 'Confira a conexão e a automação fiscal do Bling.', data.lastAttemptAt);
      if (data.running) return result('warning', 'Sincronizando', 'Sincronização fiscal em andamento.', data.lastAttemptAt);
      return result(data.lastSuccessAt ? 'configured' : 'unknown', data.lastSuccessAt ? 'Última execução concluída' : 'Sem execução confirmada', 'Este diagnóstico cobre a sincronização fiscal, não todas as funções do Bling.', data.lastSuccessAt);
    }
    case 'payments': {
      if (!Array.isArray(data)) return unknown();
      const active = data.filter((p: any) => p.is_active === true || p.is_active === 1);
      return result(active.length ? 'configured' : 'unconfigured', active.length ? 'Configurado' : 'Sem gateway ativo', `${active.length} gateways ativos. Configuração do checkout; não testa cobrança real.`);
    }
    case 'fiscal': return Array.isArray(data.alerts) ? result(data.alerts.length ? 'warning' : 'configured', data.alerts.length ? 'Certificados com alerta' : 'Sem alertas registrados', `${data.alerts.length} alertas de certificado. Não testa emissão ou disponibilidade da SEFAZ.`) : unknown();
    case 'print3d': return typeof data.enabled === 'boolean' ? result(data.enabled ? 'configured' : 'unconfigured', data.enabled ? 'Habilitada' : 'Desativada', 'Estado do módulo 3D registrado na API; não testa produção ou pagamento.') : unknown();
    default: return unknown();
  }
}

export function failedSystemStatusCheck(check: SystemStatusCheck, attemptedAt: string): SystemStatusCheck {
  return { ...check, state: 'unknown', label: 'Consulta indisponível', detail: 'Não foi possível obter o diagnóstico. Consulte os detalhes ou tente atualizar.', checkedAt: attemptedAt, sourceAt: null };
}
