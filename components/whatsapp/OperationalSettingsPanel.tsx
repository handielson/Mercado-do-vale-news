import React from 'react';
import { Bot, Power, Save, RefreshCw, Cpu, User, Users, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { autoResponderService } from '../../services/autoResponderService';

export function OperationalSettingsPanel() {
  const [enabled, setEnabled] = React.useState(true);
  const [handoffEnabled, setHandoffEnabled] = React.useState(true);
  const [typingEnabled, setTypingEnabled] = React.useState(true);
  const [typingProfile, setTypingProfile] = React.useState('balanced');
  const [pauseTimeout, setPauseTimeout] = React.useState(1440);

  // Indicators
  const [indicators, setIndicators] = React.useState({
    botEnabled: true,
    aiCount: 0,
    humanCount: 0,
    mixedCount: 0,
    pausedCount: 0,
    avgResponseTime: 0,
    lastHandoff: null as string | null
  });

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const fetchSettingsAndIndicators = React.useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const settings = await autoResponderService.getOperationalSettings();
      setEnabled(settings['automation.enabled'] !== false);
      setHandoffEnabled(settings['automation.handoff_enabled'] !== false);
      setTypingEnabled(settings['automation.typing_enabled'] !== false);
      setTypingProfile(settings['automation.typing_profile'] || 'balanced');
      setPauseTimeout(Number(settings['automation.pause_timeout']) || 1440);

      const ind = await autoResponderService.getOperationalIndicators();
      setIndicators(ind);
    } catch (err) {
      toast.error('Erro ao carregar dados do painel operacional');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchSettingsAndIndicators();
  }, [fetchSettingsAndIndicators]);

  async function saveSettings() {
    setSaving(true);
    try {
      await autoResponderService.updateOperationalSettings({
        'automation.enabled': enabled,
        'automation.handoff_enabled': handoffEnabled,
        'automation.typing_enabled': typingEnabled,
        'automation.typing_profile': typingProfile,
        'automation.pause_timeout': pauseTimeout
      });
      toast.success('Configurações operacionais salvas com sucesso!');
      await fetchSettingsAndIndicators(true);
    } catch (err) {
      toast.error('Falha ao salvar configurações operacionais');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const ind = await autoResponderService.getOperationalIndicators();
      setIndicators(ind);
      toast.success('Indicadores operacionais atualizados');
    } catch (err) {
      toast.error('Falha ao atualizar indicadores');
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Real-time Indicators grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Status card */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Status do Bot</span>
            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${indicators.botEnabled ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900">
              {indicators.botEnabled ? '🟢 Ativado' : '🔴 Desativado'}
            </span>
          </div>
        </div>

        {/* AI count card */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium">Conversas com IA</span>
            <Cpu size={18} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-slate-900">{indicators.aiCount}</span>
            <span className="text-xs text-slate-500">ativas</span>
          </div>
        </div>

        {/* Human count card */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium">Atendimento Humano</span>
            <User size={18} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-slate-900">{indicators.humanCount + indicators.mixedCount}</span>
            <span className="text-xs text-slate-500">
              ({indicators.humanCount} human / {indicators.mixedCount} mixed)
            </span>
          </div>
        </div>

        {/* Paused count card */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium">Conversas Pausadas</span>
            <AlertCircle size={18} className="text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-slate-900 text-amber-600">{indicators.pausedCount}</span>
            <span className="text-xs text-slate-500">em pausa</span>
          </div>
        </div>
      </div>

      {/* Timing and Last Handoff details */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <Clock className="text-emerald-600" size={24} />
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Tempo Médio de Resposta (Últimos 7 dias)</p>
            <p className="text-lg font-semibold text-slate-900">
              {indicators.avgResponseTime > 0 ? `${(indicators.avgResponseTime / 1000).toFixed(2)} segundos` : 'Sem dados'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <Users className="text-indigo-600" size={24} />
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Último Handoff Detectado</p>
            <p className="text-lg font-semibold text-slate-900">
              {indicators.lastHandoff ? new Date(indicators.lastHandoff).toLocaleString('pt-BR') : 'Nenhum handoff recente'}
            </p>
          </div>
        </div>
      </div>

      {/* Control panel & Settings */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-emerald-600">
              <Bot size={15} />
              Operação & Controle (Framework v1.0)
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">Configurações Operacionais</h3>
            <p className="mt-1 text-sm text-slate-500">
              Gerencie a ativação global do bot, regras de handoff e simulação de presença.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              Atualizar
            </button>

            <button
              type="button"
              onClick={saveSettings}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <Save size={16} />
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100 p-5 space-y-6">
          {/* Row 1: Global Enable Switch */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-6">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Ativação Global da Automação</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Desligar este botão pausa imediatamente todas as interações da IA em todos os canais.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${enabled ? 'bg-emerald-600' : 'bg-slate-200'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Row 2: Handoff Settings */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-6">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Handoff Automático</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Pausa a IA imediatamente se uma mensagem for enviada por um operador humano.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setHandoffEnabled(!handoffEnabled)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${handoffEnabled ? 'bg-emerald-600' : 'bg-slate-200'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${handoffEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>

              <select
                value={pauseTimeout}
                onChange={(e) => setPauseTimeout(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500"
              >
                <option value={30}>Pausar por 30m</option>
                <option value={60}>Pausar por 1h</option>
                <option value={120}>Pausar por 2h</option>
                <option value={240}>Pausar por 4h</option>
                <option value={720}>Pausar por 12h</option>
                <option value={1440}>Pausar por 24h</option>
              </select>
            </div>
          </div>

          {/* Row 3: Typing Profile */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-6">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Simulação de Digitação</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Exibe o status "digitando..." oficial no chat com base no perfil de velocidade selecionado.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setTypingEnabled(!typingEnabled)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${typingEnabled ? 'bg-emerald-600' : 'bg-slate-200'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${typingEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>

              <select
                value={typingProfile}
                onChange={(e) => setTypingProfile(e.target.value)}
                disabled={!typingEnabled}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500 disabled:opacity-50"
              >
                <option value="instant">Instantâneo</option>
                <option value="fast">Rápido</option>
                <option value="balanced">Equilibrado (balanced)</option>
                <option value="human">Simulação Humana</option>
              </select>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
