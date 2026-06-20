import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Loader2, RotateCcw, Save, Send, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  listWhatsAppAutomationTemplates,
  previewWhatsAppAutomationTemplate,
  resetWhatsAppAutomationTemplate,
  saveWhatsAppAutomationTemplate,
  type WhatsAppAutomationTemplate,
  type WhatsAppAutomationTemplateCategory,
} from '../../services/whatsappAutomationTemplateService';

const CATEGORY_LABELS: Record<WhatsAppAutomationTemplateCategory, string> = {
  transactional: 'Transacionais',
  promotional: 'Promocionais',
  informational: 'Informativos',
  future: 'Futuros',
};

const CATEGORY_ORDER: WhatsAppAutomationTemplateCategory[] = ['transactional', 'promotional', 'informational', 'future'];

export function WhatsAppAutomationTemplatesPanel() {
  const [templates, setTemplates] = useState<WhatsAppAutomationTemplate[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [category, setCategory] = useState<WhatsAppAutomationTemplateCategory>('transactional');
  const [draft, setDraft] = useState<WhatsAppAutomationTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const filteredTemplates = useMemo(
    () => templates.filter(template => template.category === category),
    [templates, category]
  );

  useEffect(() => {
    let mounted = true;
    listWhatsAppAutomationTemplates()
      .then((data) => {
        if (!mounted) return;
        setTemplates(data);
        const first = data.find(template => template.category === category) || data[0] || null;
        setSelectedKey(first?.template_key || '');
        setDraft(first ? { ...first } : null);
      })
      .catch((error) => {
        console.error('Erro ao carregar templates automaticos:', error);
        toast.error('Erro ao carregar templates automaticos');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const selected = templates.find(template => template.template_key === selectedKey) || null;
    setDraft(selected ? { ...selected } : null);
  }, [selectedKey, templates]);

  useEffect(() => {
    const firstInCategory = templates.find(template => template.category === category);
    if (firstInCategory && !filteredTemplates.some(template => template.template_key === selectedKey)) {
      setSelectedKey(firstInCategory.template_key);
    }
  }, [category, filteredTemplates, selectedKey, templates]);

  const updateDraft = (patch: Partial<WhatsAppAutomationTemplate>) => {
    setDraft(current => current ? { ...current, ...patch } : current);
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const saved = await saveWhatsAppAutomationTemplate(draft);
      setTemplates(current => current.map(template => (
        template.template_key === saved.template_key ? saved : template
      )));
      setDraft(saved);
      toast.success('Template salvo');
    } catch (error) {
      console.error('Erro ao salvar template automatico:', error);
      toast.error('Erro ao salvar template');
    } finally {
      setSaving(false);
    }
  };


  const handleSendTest = async () => {
    if (!draft) return;
    setTesting(true);
    try {
      const result = await sendWhatsAppAutomationTemplateTest(draft);
      if (result.status === 'sent') {
        toast.success(`Teste enviado para ${result.phone || 'telefone da loja'}`);
      } else {
        toast.error(result.error || 'Erro ao enviar teste');
      }
    } catch (error) {
      console.error('Erro ao enviar teste do template automatico:', error);
      toast.error('Erro ao enviar teste');
    } finally {
      setTesting(false);
    }
  };

  const handleReset = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const reset = await resetWhatsAppAutomationTemplate(draft.template_key, draft.id);
      setTemplates(current => current.map(template => (
        template.template_key === reset.template_key ? reset : template
      )));
      setDraft(reset);
      toast.success('Template restaurado');
    } catch (error) {
      console.error('Erro ao restaurar template automatico:', error);
      toast.error('Erro ao restaurar template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Templates automaticos</p>
          <h3 className="mt-1 flex items-center gap-2 text-lg font-semibold text-slate-900">
            <FileText className="h-5 w-5 text-emerald-600" />
            Mensagens editaveis por evento
          </h3>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Cada mensagem tem uma trava propria para pausar o envio automatico sem desligar os outros fluxos.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando templates automaticos...
        </div>
      ) : draft ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_ORDER.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={[
                    'rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                    category === item
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {CATEGORY_LABELS[item]}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filteredTemplates.map(template => (
                <button
                  key={template.template_key}
                  type="button"
                  onClick={() => setSelectedKey(template.template_key)}
                  className={[
                    'w-full rounded-lg border p-3 text-left transition-colors',
                    selectedKey === template.template_key
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50',
                  ].join(' ')}
                >
                  <span className="block text-sm font-semibold text-slate-900">{template.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{template.description}</span>
                  <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${template.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {template.enabled ? 'Envio ligado' : 'Envio pausado'}
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h4 className="text-base font-semibold text-slate-900">{draft.title}</h4>
                  <p className="mt-1 text-sm text-slate-500">{draft.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateDraft({ enabled: !draft.enabled })}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${draft.enabled ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                  title="Pausar envio deste template"
                >
                  {draft.enabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                  {draft.enabled ? 'Envio ligado' : 'Envio pausado'}
                </button>
              </div>
              <p className="mt-2 text-xs font-medium text-slate-500">Pausar envio deste template</p>
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Texto da mensagem</span>
              <textarea
                value={draft.content}
                onChange={(event) => updateDraft({ content: event.target.value })}
                className="mt-2 min-h-[260px] w-full rounded-lg border border-slate-200 p-3 text-sm leading-6 text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">Variaveis disponiveis</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {draft.variables.map(variable => (
                  <code key={variable} className="rounded bg-white px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-slate-200">{`{${variable}}`}</code>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-700">Previa da mensagem</p>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-sm leading-6 text-slate-50">
                {previewWhatsAppAutomationTemplate(draft)}
              </pre>
            </div>

            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">Numero de teste</p>
              <p className="mt-1 text-sm text-emerald-800">
                O envio de teste usa o telefone salvo em Dados da Empresa. Se ele estiver vazio, usa 87988032612.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handleSendTest}
                disabled={testing || saving}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar teste
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <RotateCcw className="h-4 w-4" />
                Restaurar padrao
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar template
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
          Nenhum template automatico encontrado.
        </div>
      )}
    </section>
  );
}
