import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Image as ImageIcon, Instagram, Loader2, MessageCircle, Plus, RefreshCw, Send, Trash2, Upload, Video } from 'lucide-react';
import { toast } from 'sonner';
import { vpsClient } from '../../../../services/vpsClient';
import { whatsappStatusCampaignService, type WhatsAppStatusCampaign } from '../../../../services/whatsappStatusCampaignService';
import {
  socialStoryScheduleService,
  type SocialStoryDestination,
  type SocialStoryDraftItem,
  type SocialStorySchedule,
} from '../../../../services/socialStoryScheduleService';

function defaultDateTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setSeconds(0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function statusLabel(status: string) {
  return ({
    pending_approval: 'Aguardando aprovação', approved: 'Aprovado', processing: 'Publicando',
    completed: 'Concluído', partial: 'Concluído parcialmente', failed: 'Falhou', cancelled: 'Cancelado',
  } as Record<string, string>)[status] || status;
}

async function uploadStoryFile(file: File): Promise<SocialStoryDraftItem> {
  const isVideo = file.type.startsWith('video/');
  const extension = file.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
  const safeName = `story-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
  const renamed = new File([file], safeName, { type: file.type });
  const form = new FormData();
  form.append('file', renamed);
  const upload = await vpsClient.upload<{ uploadId: string; url: string }>(
    `/synology/upload?folder=${isVideo ? 'videos' : 'imagens'}`, form,
  );
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const progress = await vpsClient.get<{ status: string; error?: string }>(`/synology/upload-status?id=${encodeURIComponent(upload.uploadId)}`);
    if (progress.status === 'success') return { mediaType: isVideo ? 'video' : 'image', mediaUrl: upload.url, label: file.name };
    if (progress.status === 'error') throw new Error(progress.error || 'Falha no upload');
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error('O upload não foi confirmado dentro do tempo esperado');
}

export default function SocialStorySchedulerPanel() {
  const [mode, setMode] = useState<'standalone' | 'whatsapp_campaign'>('standalone');
  const [title, setTitle] = useState('Story avulso');
  const [scheduledAt, setScheduledAt] = useState(defaultDateTime);
  const [destinations, setDestinations] = useState<SocialStoryDestination[]>(['instagram', 'whatsapp']);
  const [campaigns, setCampaigns] = useState<WhatsAppStatusCampaign[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [items, setItems] = useState<SocialStoryDraftItem[]>([]);
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [schedules, setSchedules] = useState<SocialStorySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [campaignRows, scheduleRows] = await Promise.all([
        whatsappStatusCampaignService.list(), socialStoryScheduleService.list(),
      ]);
      setCampaigns(campaignRows);
      setSchedules(scheduleRows);
      setCampaignId((current) => current || campaignRows[0]?.id || '');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao carregar agendamentos');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const expectedDeliveries = useMemo(() => items.length * destinations.length, [items.length, destinations.length]);

  const toggleDestination = (destination: SocialStoryDestination) => {
    setDestinations((current) => current.includes(destination)
      ? current.filter((value) => value !== destination)
      : [...current, destination]);
  };

  const previewCampaign = async () => {
    if (!campaignId) return;
    setBusy(true);
    try {
      const preview = await socialStoryScheduleService.previewWhatsApp(campaignId);
      setItems(preview);
      const campaign = campaigns.find((row) => row.id === campaignId);
      if (campaign) setTitle(`Stories - ${campaign.title}`);
      toast.success(`${preview.length} mídias importadas na ordem do Status`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao importar campanha');
    } finally { setBusy(false); }
  };

  const addUrl = () => {
    const mediaUrl = url.trim();
    if (!/^https:\/\//i.test(mediaUrl)) return toast.error('Informe uma URL pública HTTPS');
    const mediaType = /\.(mp4|mov|webm)(?:\?|$)/i.test(mediaUrl) ? 'video' : 'image';
    setItems((current) => [...current, { mediaType, mediaUrl, caption: caption.trim(), label: `Mídia ${current.length + 1}` }]);
    setUrl('');
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const uploaded: SocialStoryDraftItem[] = [];
      for (const file of Array.from(files)) uploaded.push({ ...(await uploadStoryFile(file)), caption: caption.trim() });
      setItems((current) => [...current, ...uploaded]);
      toast.success(`${uploaded.length} mídia(s) enviada(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha no upload');
    } finally { setBusy(false); }
  };

  const schedule = async () => {
    if (!title.trim() || !scheduledAt || !destinations.length || !items.length) {
      return toast.error('Preencha título, data, canal e ao menos uma mídia');
    }
    setBusy(true);
    try {
      const result = await socialStoryScheduleService.create({
        title: title.trim(), sourceType: mode, sourceId: mode === 'whatsapp_campaign' ? campaignId : null,
        scheduledAt: new Date(scheduledAt).toISOString(), destinations, items: mode === 'standalone' ? items : undefined,
      });
      toast.success(`Agendamento criado com ${result.itemCount} Stories. Aprove na Central de Aprovações.`);
      setItems([]);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao criar agendamento');
    } finally { setBusy(false); }
  };

  const cancel = async (id: string) => {
    if (!window.confirm('Cancelar as publicações ainda pendentes deste agendamento?')) return;
    try { await socialStoryScheduleService.cancel(id); await load(); toast.success('Agendamento cancelado'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível cancelar'); }
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><CalendarClock className="w-5 h-5 text-pink-600" /> Publicação automática de Stories</h2>
          <p className="text-sm text-slate-500 mt-1">Agende uma peça avulsa ou reutilize, na mesma ordem, o conteúdo de uma campanha do WhatsApp.</p>
        </div>
        <button onClick={() => void load()} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="Atualizar"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>

      <div className="p-5 grid xl:grid-cols-[1.15fr_.85fr] gap-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button onClick={() => { setMode('standalone'); setItems([]); setTitle('Story avulso'); }} className={`py-2 rounded-lg text-sm font-bold ${mode === 'standalone' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Story avulso</button>
            <button onClick={() => { setMode('whatsapp_campaign'); setItems([]); }} className={`py-2 rounded-lg text-sm font-bold ${mode === 'whatsapp_campaign' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Importar do WhatsApp</button>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-xs font-bold text-slate-600">Título
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-bold text-slate-600">Data e horário
              <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </label>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-600 mb-2">Publicar em</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => toggleDestination('instagram')} className={`px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 ${destinations.includes('instagram') ? 'bg-pink-50 border-pink-300 text-pink-700' : 'border-slate-200 text-slate-400'}`}><Instagram className="w-4 h-4" /> Instagram {destinations.includes('instagram') && <Check className="w-4 h-4" />}</button>
              <button onClick={() => toggleDestination('whatsapp')} className={`px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 ${destinations.includes('whatsapp') ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-slate-200 text-slate-400'}`}><MessageCircle className="w-4 h-4" /> WhatsApp {destinations.includes('whatsapp') && <Check className="w-4 h-4" />}</button>
            </div>
          </div>

          {mode === 'whatsapp_campaign' ? (
            <div className="flex gap-2">
              <select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}
              </select>
              <button onClick={() => void previewCampaign()} disabled={busy || !campaignId} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold disabled:opacity-50">Ver conteúdo</button>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-dashed border-slate-300 p-4">
              <label className="flex items-center justify-center gap-2 py-3 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer text-sm font-bold text-slate-700">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Enviar imagens ou vídeos 9:16
                <input type="file" multiple accept="image/jpeg,image/png,video/mp4" className="hidden" onChange={(event) => void handleFiles(event.target.files)} />
              </label>
              <div className="grid md:grid-cols-[1fr_auto] gap-2">
                <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="ou cole uma URL pública HTTPS" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                <button onClick={addUrl} className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold flex items-center gap-1"><Plus className="w-4 h-4" /> Adicionar</button>
              </div>
              <textarea value={caption} onChange={(event) => setCaption(event.target.value)} rows={2} placeholder="Legenda opcional (usada no Status do WhatsApp)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <p className="text-[11px] text-slate-500">Para o Instagram, imagens são preparadas automaticamente em JPEG 1080 × 1920 sem cortar a arte.</p>
            </div>
          )}

          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={`${item.mediaUrl}-${index}`} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
                {item.mediaType === 'video' ? <Video className="w-5 h-5 text-purple-500" /> : <ImageIcon className="w-5 h-5 text-blue-500" />}
                <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-700 truncate">{index + 1}. {item.label || item.mediaUrl}</p><p className="text-[11px] text-slate-400 truncate">{item.mediaUrl}</p></div>
                {mode === 'standalone' && <button onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="p-1.5 text-red-500"><Trash2 className="w-4 h-4" /></button>}
              </div>
            ))}
            {!items.length && <p className="text-sm text-center text-slate-400 py-4">Nenhuma mídia selecionada.</p>}
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">A criação gera um pedido na Central de Aprovações. Nada será publicado antes da aprovação por outro administrador.</div>
          <button onClick={() => void schedule()} disabled={busy || !items.length || !destinations.length} className="w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-black flex items-center justify-center gap-2 disabled:opacity-50"><Send className="w-4 h-4" /> Solicitar aprovação ({expectedDeliveries} entregas)</button>
        </div>

        <div>
          <h3 className="font-black text-slate-800 mb-3">Agendamentos</h3>
          <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
            {schedules.map((scheduleRow) => (
              <div key={scheduleRow.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2"><div><p className="font-bold text-slate-800">{scheduleRow.title}</p><p className="text-xs text-slate-500">{new Date(scheduleRow.scheduled_at).toLocaleString('pt-BR')} · {scheduleRow.items.length} Stories</p></div><span className="text-[10px] font-black uppercase px-2 py-1 rounded-full bg-slate-100 text-slate-600">{statusLabel(scheduleRow.status)}</span></div>
                <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">{scheduleRow.destinations.includes('instagram') && <Instagram className="w-4 h-4 text-pink-500" />}{scheduleRow.destinations.includes('whatsapp') && <MessageCircle className="w-4 h-4 text-emerald-500" />}{scheduleRow.last_error && <span className="text-red-600 truncate" title={scheduleRow.last_error}>{scheduleRow.last_error}</span>}</div>
                {['pending_approval', 'approved', 'processing'].includes(scheduleRow.status) && <button onClick={() => void cancel(scheduleRow.id)} className="mt-3 text-xs font-bold text-red-600 hover:underline">Cancelar pendentes</button>}
              </div>
            ))}
            {!schedules.length && !loading && <p className="text-sm text-slate-400 text-center py-8">Nenhum agendamento automático ainda.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
