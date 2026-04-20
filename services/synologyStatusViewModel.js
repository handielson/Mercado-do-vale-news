const HEARTBEAT_ONLINE_MS = 2 * 60 * 1000;
const HEARTBEAT_OFFLINE_MS = 5 * 60 * 1000;

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function formatLocalDateTime(value) {
    const date = toDate(value);
    if (!date) return '';
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(date);
}

function resolveTone(state) {
    switch (state) {
        case 'online':
            return 'success';
        case 'desatualizado':
        case 'stale':
            return 'warning';
        case 'offline':
            return 'danger';
        default:
            return 'muted';
    }
}

function resolveStateLabel(state) {
    switch (state) {
        case 'online':
            return 'Synology online';
        case 'desatualizado':
        case 'stale':
            return 'Leitura desatualizada';
        case 'offline':
            return 'Synology offline';
        case 'missing':
        default:
            return 'Sem dados do Synology';
    }
}

function resolveHeartbeatLabel(freshnessState, ageMs, timestamp) {
    if (freshnessState === 'missing') return 'Sem heartbeat recebido';
    if (freshnessState === 'offline') {
        return ageMs == null ? 'Heartbeat expirado' : `Heartbeat expirado há ${formatDuration(ageMs)}`;
    }
    if (ageMs == null) {
        return 'Heartbeat recebido';
    }
    return `Heartbeat há ${formatDuration(ageMs)}`;
}

function resolveHeartbeatDetail(timestamp, freshnessState) {
    const formatted = formatLocalDateTime(timestamp);
    if (!formatted) {
        return freshnessState === 'missing'
            ? 'Aguardando a primeira leitura do NAS'
            : 'Sem timestamp informado';
    }
    return `Recebido em ${formatted}`;
}

function resolveScheduleLabel(scheduledReboot) {
    if (scheduledReboot?.enabled) {
        return scheduledReboot.label || 'Reboot semanal configurado';
    }
    return 'Agendamento não configurado';
}

function resolveScheduleDetail(scheduledReboot) {
    if (scheduledReboot?.enabled) {
        return 'Reboot automático habilitado no NAS';
    }
    return 'Nenhum reboot semanal ativo';
}

function commandCommandLabel(command) {
    switch (command) {
        case 'restart-cloudflared':
            return 'Reiniciar túnel';
        case 'reboot-nas':
            return 'Reiniciar NAS';
        default:
            return command ? String(command) : 'Comando';
    }
}

function resolveCommandState(commandStatus) {
    if (!commandStatus || (!commandStatus.command && !commandStatus.status && !commandStatus.result)) {
        return {
            blocked: false,
            label: 'Nenhum comando pendente',
            detail: 'As ações estão liberadas',
            tone: 'muted',
            command: null,
            reason: null,
        };
    }

    const status = String(commandStatus.status || '').toLowerCase();
    const commandLabel = commandCommandLabel(commandStatus.command);
    const blocked = status === 'pending';
    const result = typeof commandStatus.result === 'string' && commandStatus.result.trim()
        ? commandStatus.result.trim()
        : '';
    const completedAt = commandStatus.completedAt ? formatLocalDateTime(commandStatus.completedAt) : '';
    const enqueuedAt = commandStatus.enqueuedAt ? formatLocalDateTime(commandStatus.enqueuedAt) : '';

    if (blocked) {
        return {
            blocked: true,
            label: `Comando pendente: ${commandLabel.toLowerCase()}`,
            detail: enqueuedAt ? `Enfileirado em ${enqueuedAt}` : 'Aguardando execução no NAS',
            tone: 'warning',
            command: commandStatus,
            reason: `Existe um comando pendente de ${commandLabel.toLowerCase()}. Aguarde concluir antes de iniciar outro.`,
        };
    }

    if (status === 'success') {
        return {
            blocked: false,
            label: `${commandLabel} concluído`,
            detail: [completedAt ? `Concluído em ${completedAt}` : '', result].filter(Boolean).join(' • ') || 'Execução concluída',
            tone: 'success',
            command: commandStatus,
            reason: null,
        };
    }

    if (status === 'failed') {
        return {
            blocked: false,
            label: `${commandLabel} falhou`,
            detail: [completedAt ? `Falhou em ${completedAt}` : '', result].filter(Boolean).join(' • ') || 'Ação não concluída',
            tone: 'danger',
            command: commandStatus,
            reason: null,
        };
    }

    if (status === 'expired') {
        return {
            blocked: false,
            label: `${commandLabel} expirado`,
            detail: enqueuedAt ? `Enfileirado em ${enqueuedAt}` : 'Tempo de execução expirado',
            tone: 'muted',
            command: commandStatus,
            reason: null,
        };
    }

    return {
        blocked: false,
        label: commandLabel,
        detail: result || 'Estado atual do comando disponível',
        tone: 'muted',
        command: commandStatus,
        reason: null,
    };
}

export function buildSynologyStatusViewModel({
    synologyStatus,
    commandStatus,
    now = new Date(),
}) {
    const snapshot = synologyStatus?.snapshot || null;
    const rawState = synologyStatus?.state || snapshot?.freshness?.state || 'missing';
    const state = rawState === 'desatualizado' ? 'stale' : rawState;
    const rawFreshnessState = snapshot?.freshness?.state || state;
    const freshnessState = rawFreshnessState === 'desatualizado' ? 'stale' : rawFreshnessState;
    const heartbeatAgeMs = snapshot?.freshness?.age_ms ?? (() => {
        const timestamp = toDate(snapshot?.timestamp);
        if (!timestamp) return null;
        return Math.max(0, now.getTime() - timestamp.getTime());
    })();

    const command = resolveCommandState(commandStatus || synologyStatus?.command || null);
    const memoryUsedMb = toNumber(snapshot?.memory?.used_mb);
    const memoryTotalMb = toNumber(snapshot?.memory?.total_mb);
    const swapUsedMb = toNumber(snapshot?.swap?.used_mb);
    const swapTotalMb = toNumber(snapshot?.swap?.total_mb);

    return {
        title: snapshot?.hostname || 'Synology NAS',
        subtitle: snapshot?.model || '',
        status: {
            value: state,
            label: resolveStateLabel(state),
            tone: resolveTone(state),
            detail: snapshot?.health?.message || (state === 'missing' ? 'Aguardando o primeiro heartbeat do NAS' : 'Sem detalhe adicional'),
        },
        heartbeat: {
            state: freshnessState,
            label: resolveHeartbeatLabel(freshnessState, heartbeatAgeMs, snapshot?.timestamp),
            detail: resolveHeartbeatDetail(snapshot?.timestamp, freshnessState),
            ageMs: heartbeatAgeMs,
            timestamp: snapshot?.timestamp || null,
        },
        schedule: {
            enabled: Boolean(snapshot?.scheduled_reboot?.enabled),
            label: resolveScheduleLabel(snapshot?.scheduled_reboot),
            detail: resolveScheduleDetail(snapshot?.scheduled_reboot),
        },
        memory: {
            usedMb: memoryUsedMb,
            totalMb: memoryTotalMb,
            availableMb: toNumber(snapshot?.memory?.available_mb),
            usedPercent: memoryTotalMb > 0 ? Math.round((memoryUsedMb / memoryTotalMb) * 100) : toNumber(snapshot?.memory?.used_percent),
        },
        swap: {
            usedMb: swapUsedMb,
            totalMb: swapTotalMb,
            freeMb: toNumber(snapshot?.swap?.free_mb),
            usedPercent: swapTotalMb > 0 ? Math.round((swapUsedMb / swapTotalMb) * 100) : toNumber(snapshot?.swap?.used_percent),
        },
        command,
        actions: {
            refresh: {
                label: 'Atualizar agora',
            },
            restartTunnel: {
                label: 'Reiniciar túnel',
                disabled: command.blocked,
                reason: command.reason,
            },
            rebootNas: {
                label: 'Reiniciar NAS agora',
                disabled: command.blocked,
                reason: command.reason,
            },
        },
        snapshot,
    };
}
