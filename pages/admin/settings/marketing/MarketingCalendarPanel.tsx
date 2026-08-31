import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Instagram,
  MessageCircle,
  Facebook,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Plus,
  Eye,
  Filter,
  Layers,
  X,
  CalendarDays,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  socialStoryScheduleService,
  type SocialStorySchedule,
  type SocialStoryScheduleItem,
} from '../../../../services/socialStoryScheduleService';
import {
  marketingApprovalService,
  type MarketingApprovalRequest,
} from '../../../../services/marketingApprovalService';
import {
  instagramScheduleService,
  type InstagramSlot,
  CONTENT_TYPE_LABELS,
} from '../../../../services/instagramScheduleService';
import {
  whatsappStatusCampaignService,
  type WhatsAppStatusCampaign,
} from '../../../../services/whatsappStatusCampaignService';
import {
  facebookMarketplaceScheduleService,
  type FacebookMarketplaceSchedule,
} from '../../../../services/facebookMarketplaceScheduleService';
import { toBrowserSafeMediaUrl } from '../../../../utils/media-url';

export interface CalendarEvent {
  id: string;
  type: 'story_schedule' | 'approval_request' | 'weekly_slot' | 'whatsapp_campaign' | 'facebook_schedule';
  title: string;
  dateKey: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
  destinations: Array<'instagram' | 'whatsapp' | 'facebook'>;
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed' | 'slot';
  statusLabel: string;
  itemsCount: number;
  thumbnailUrl?: string | null;
  thumbnailMediaType?: 'image' | 'video' | null;
  rawPayload?: any;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface MarketingCalendarPanelProps {
  onNavigateToTab?: (tab: string) => void;
  onSelectDateForNewSchedule?: (dateKey: string) => void;
}

function parseDateKey(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') {
    const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const hasTimeZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(val.trim());
    if (match && !hasTimeZone) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((part) => part.type === 'year')?.value || '';
  const m = parts.find((part) => part.type === 'month')?.value || '';
  const day = parts.find((part) => part.type === 'day')?.value || '';
  return `${y}-${m}-${day}`;
}

function parseTimeStr(val: any): string {
  if (!val) return '00:00';
  if (typeof val === 'string') {
    const hasTimeZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(val.trim());
    if (hasTimeZone) {
      const zonedDate = new Date(val);
      if (!Number.isNaN(zonedDate.getTime())) {
        return zonedDate.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo',
        });
      }
    }
    const match = val.match(/(\d{2}):(\d{2})/);
    if (match) return `${match[1]}:${match[2]}`;
  }
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '00:00';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

function isVideoMedia(mediaType: unknown, mediaUrl: unknown): boolean {
  return mediaType === 'video' || /\.(?:mp4|mov|webm)(?:[?#]|$)/i.test(String(mediaUrl || ''));
}

function CalendarMediaPreview({
  url,
  mediaType,
  title,
  className,
}: {
  url: string;
  mediaType?: unknown;
  title: string;
  className: string;
}) {
  if (isVideoMedia(mediaType, url)) {
    return (
      <video
        src={url}
        aria-label={`Prévia do vídeo ${title}`}
        muted
        playsInline
        preload="metadata"
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          if (Number.isFinite(video.duration) && video.duration > 0 && video.currentTime === 0) {
            video.currentTime = Math.min(0.1, video.duration / 2);
          }
        }}
        className={className}
      />
    );
  }

  return <img src={url} alt={title} className={className} />;
}

function duplicateDestinations(event: CalendarEvent, events: CalendarEvent[]): CalendarEvent['destinations'] {
  const normalizedTitle = event.title.trim().toLocaleLowerCase('pt-BR');
  return event.destinations.filter((destination) => events.some((candidate) => (
    candidate.id !== event.id
    && candidate.type === 'story_schedule'
    && event.type === 'story_schedule'
    && candidate.timeStr === event.timeStr
    && candidate.title.trim().toLocaleLowerCase('pt-BR') === normalizedTitle
    && candidate.destinations.includes(destination)
  )));
}

function dateKeyDayOffset(dateKey: string, startDateKey: string): number {
  const dateParts = dateKey.split('-').map(Number);
  const startParts = startDateKey.split('-').map(Number);
  if (dateParts.length !== 3 || startParts.length !== 3) return Number.NaN;
  const dateUtc = Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]);
  const startUtc = Date.UTC(startParts[0], startParts[1] - 1, startParts[2]);
  return Math.round((dateUtc - startUtc) / 86_400_000);
}

function whatsappCampaignDateKeys(campaign: WhatsAppStatusCampaign): string[] {
  const selectedDates = Array.isArray(campaign.selected_dates)
    ? campaign.selected_dates.map(parseDateKey).filter(Boolean)
    : [];
  const startDateKey = parseDateKey(campaign.start_date) || selectedDates[0] || '';
  if (!startDateKey) return [];

  const candidates = selectedDates.length > 0
    ? selectedDates
    : Array.from({ length: Math.max(1, Number(campaign.repeat_days) || 1) }, (_, offset) => {
        const parts = startDateKey.split('-').map(Number);
        return parseDateKey(new Date(parts[0], parts[1] - 1, parts[2] + offset));
      });

  return Array.from(new Set(candidates)).filter((dateKey) => {
    const dayOffset = dateKeyDayOffset(dateKey, startDateKey);
    if (!Number.isFinite(dayOffset) || dayOffset < 0) return false;
    if (campaign.frequency === 'once') return dayOffset === 0;
    if (campaign.frequency === 'weekly') return dayOffset % 7 === 0;
    return true;
  });
}

export default function MarketingCalendarPanel({
  onNavigateToTab,
  onSelectDateForNewSchedule,
}: MarketingCalendarPanelProps) {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [schedules, setSchedules] = useState<SocialStorySchedule[]>([]);
  const [approvals, setApprovals] = useState<MarketingApprovalRequest[]>([]);
  const [slots, setSlots] = useState<InstagramSlot[]>([]);
  const [whatsappCampaigns, setWhatsappCampaigns] = useState<WhatsAppStatusCampaign[]>([]);
  const [facebookSchedules, setFacebookSchedules] = useState<FacebookMarketplaceSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(() => parseDateKey(new Date()));
  const [channelFilter, setChannelFilter] = useState<'all' | 'instagram' | 'whatsapp' | 'facebook'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'completed'>('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const [schedRes, appRes, slotsRes, whatsappRes, facebookRes] = await Promise.allSettled([
        socialStoryScheduleService.list(),
        marketingApprovalService.list('all'),
        instagramScheduleService.list(),
        whatsappStatusCampaignService.list(),
        facebookMarketplaceScheduleService.list(),
      ]);

      if (schedRes.status === 'fulfilled') {
        const val = schedRes.value;
        const list = Array.isArray(val)
          ? val
          : Array.isArray((val as any)?.items)
          ? (val as any).items
          : [];
        setSchedules(list);
      } else {
        setSchedules([]);
        console.error('Erro ao carregar lotes de Stories no calendário:', schedRes.reason);
      }
      if (appRes.status === 'fulfilled') {
        const val = appRes.value;
        const list = Array.isArray((val as any)?.items)
          ? (val as any).items
          : Array.isArray(val)
          ? val
          : [];
        setApprovals(list);
      } else {
        setApprovals([]);
        console.error('Erro ao carregar aprovações no calendário:', appRes.reason);
      }
      if (slotsRes.status === 'fulfilled') {
        const val = slotsRes.value;
        setSlots(Array.isArray(val) ? val : []);
      } else {
        setSlots([]);
        console.error('Erro ao carregar a agenda semanal do Instagram no calendário:', slotsRes.reason);
      }
      if (whatsappRes.status === 'fulfilled') {
        setWhatsappCampaigns(Array.isArray(whatsappRes.value) ? whatsappRes.value : []);
      } else {
        setWhatsappCampaigns([]);
        console.error('Erro ao carregar campanhas de Status do WhatsApp no calendário:', whatsappRes.reason);
      }
      if (facebookRes.status === 'fulfilled') {
        setFacebookSchedules(Array.isArray(facebookRes.value) ? facebookRes.value : []);
      } else {
        setFacebookSchedules([]);
        console.error('Erro ao carregar programações do Facebook Marketplace no calendário:', facebookRes.reason);
      }

      const results = [schedRes, appRes, slotsRes, whatsappRes, facebookRes];
      const failedSources = results.filter((result) => result.status === 'rejected').length;
      if (failedSources > 0) {
        toast.error(
          failedSources === results.length
            ? 'Não foi possível carregar as programações do calendário.'
            : 'Parte das programações não pôde ser carregada.',
          { id: 'marketing-calendar-load-error' },
        );
      }
    } catch (error) {
      console.error('Erro ao carregar dados do calendário de marketing:', error);
      toast.error('Não foi possível carregar as programações do calendário.', {
        id: 'marketing-calendar-load-error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    const nextDate = new Date(year, month - 1, 1);
    setCurrentDate(nextDate);
    setSelectedDayKey(parseDateKey(nextDate));
  };

  const handleNextMonth = () => {
    const nextDate = new Date(year, month + 1, 1);
    setCurrentDate(nextDate);
    setSelectedDayKey(parseDateKey(nextDate));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDayKey(parseDateKey(today));
  };

  const allEvents = useMemo(() => {
    const events: CalendarEvent[] = [];
    const safeSchedules = Array.isArray(schedules) ? schedules : [];
    const safeApprovals = Array.isArray(approvals) ? approvals : [];
    const safeWhatsappCampaigns = Array.isArray(whatsappCampaigns) ? whatsappCampaigns : [];
    const safeFacebookSchedules = Array.isArray(facebookSchedules) ? facebookSchedules : [];

    // 1. Social Story Schedules & Individual Scheduled Items
    for (const schedule of safeSchedules) {
      let destinations: Array<'instagram' | 'whatsapp' | 'facebook'> = [];
      if (Array.isArray(schedule.destinations)) {
        destinations = schedule.destinations as any;
      } else if (typeof schedule.destinations === 'string') {
        try {
          destinations = JSON.parse(schedule.destinations);
        } catch {
          destinations = ['whatsapp'];
        }
      }
      if (!destinations || destinations.length === 0) {
        destinations = ['whatsapp'];
      }

      let normalizedStatus: CalendarEvent['status'] = 'pending';
      let statusLabel = 'Aguardando aprovação';

      if (schedule.status === 'approved') {
        normalizedStatus = 'approved';
        statusLabel = 'Aprovado';
      } else if (schedule.status === 'processing' || schedule.status === 'executing') {
        normalizedStatus = 'executing';
        statusLabel = 'Publicando';
      } else if (schedule.status === 'completed' || schedule.status === 'partial') {
        normalizedStatus = 'completed';
        statusLabel = 'Concluído';
      } else if (schedule.status === 'failed') {
        normalizedStatus = 'failed';
        statusLabel = 'Falhou';
      } else if (schedule.status === 'cancelled') {
        normalizedStatus = 'failed';
        statusLabel = 'Cancelado';
      }

      const scheduleItems = Array.isArray(schedule.items) ? schedule.items : [];

      if (scheduleItems.length > 0) {
        // Agrupa itens por dia (YYYY-MM-DD)
        const itemsByDate = new Map<string, typeof scheduleItems>();
        for (const item of scheduleItems) {
          const itemDateKey = parseDateKey(item.scheduled_at || schedule.scheduled_at);
          if (itemDateKey) {
            const list = itemsByDate.get(itemDateKey) || [];
            list.push(item);
            itemsByDate.set(itemDateKey, list);
          }
        }

        for (const [dateKey, dayItems] of itemsByDate.entries()) {
          const firstItem = dayItems[0];
          const timeStr = parseTimeStr(firstItem?.scheduled_at || schedule.scheduled_at);
          const firstMedia = dayItems.find((it) => it.media_url);
          const title = dayItems.length === 1
            ? (firstItem?.label || schedule.title || '1 Story')
            : `${dayItems.length} Stories · ${firstItem?.label || schedule.title || 'Lote'}`;

          events.push({
            id: `sched-${schedule.id}-${dateKey}`,
            type: 'story_schedule',
            title,
            dateKey,
            timeStr,
            destinations,
            status: normalizedStatus,
            statusLabel,
            itemsCount: dayItems.length,
            thumbnailUrl: firstMedia?.media_url ? toBrowserSafeMediaUrl(firstMedia.media_url) : null,
            thumbnailMediaType: firstMedia?.media_type || null,
            rawPayload: { schedule, dayItems },
          });
        }
      } else {
        const dateKey = parseDateKey(schedule.scheduled_at);
        const timeStr = parseTimeStr(schedule.scheduled_at);
        if (dateKey) {
          events.push({
            id: `sched-${schedule.id}`,
            type: 'story_schedule',
            title: schedule.title || 'Agendamento de Stories',
            dateKey,
            timeStr,
            destinations,
            status: normalizedStatus,
            statusLabel,
            itemsCount: 1,
            thumbnailUrl: null,
            rawPayload: { schedule, dayItems: [] },
          });
        }
      }
    }

    // 2. Approval Requests
    for (const app of safeApprovals) {
      const propState = (app.proposed_state || {}) as any;
      const scheduledAt = propState.scheduledAt || (app as any).created_at;
      if (scheduledAt) {
        const dateKey = parseDateKey(scheduledAt);
        const timeStr = parseTimeStr(scheduledAt);

        const alreadyRepresentedBySchedule = events.some(
          (event) => event.type === 'story_schedule' && event.rawPayload?.schedule?.approval_id === app.id,
        );
        const alreadyRepresentedByDirectSchedule = [...safeWhatsappCampaigns, ...safeFacebookSchedules]
          .some((schedule) => schedule.id === app.target_id);

        if (!alreadyRepresentedBySchedule && !alreadyRepresentedByDirectSchedule && !events.some((event) => event.id === 'app-' + app.id)) {
          let normalizedStatus: CalendarEvent['status'] = 'pending';
          let statusLabel = 'Aguardando aprovação';

          if (app.status === 'approved') {
            normalizedStatus = 'approved';
            statusLabel = 'Aprovada';
          } else if (app.status === 'executing') {
            normalizedStatus = 'executing';
            statusLabel = 'Executando';
          } else if (app.status === 'succeeded') {
            normalizedStatus = 'completed';
            statusLabel = 'Concluída';
          } else if (app.status === 'failed') {
            normalizedStatus = 'failed';
            statusLabel = 'Falhou';
          } else if (app.status === 'cancelled' || app.status === 'rejected') {
            normalizedStatus = 'failed';
            statusLabel = app.status === 'rejected' ? 'Rejeitada' : 'Cancelada';
          }

          const destinations: Array<'instagram' | 'whatsapp' | 'facebook'> = [];
          if (app.channel === 'instagram' || propState?.destinations?.includes('instagram')) destinations.push('instagram');
          if (app.channel === 'whatsapp' || propState?.destinations?.includes('whatsapp')) destinations.push('whatsapp');
          if (app.channel === 'facebook' || propState?.destinations?.includes('facebook')) destinations.push('facebook');
          if (destinations.length === 0) destinations.push('instagram');

          if (dateKey) {
            events.push({
              id: 'app-' + app.id,
              type: 'approval_request',
              title: app.title || 'Campanha ' + app.channel,
              dateKey,
              timeStr,
              destinations,
              status: normalizedStatus,
              statusLabel,
              itemsCount: propState?.items?.length || 1,
              thumbnailUrl: propState?.items?.[0]?.mediaUrl ? toBrowserSafeMediaUrl(propState.items[0].mediaUrl) : null,
              rawPayload: app,
            });
          }
        }
      }
    }

    // 3. Recurring slots from the canonical weekly Instagram schedule.
    // Materialize only the dates visible in the current calendar grid.
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const visibleDays = Math.ceil((firstDayIndex + daysInCurrentMonth) / 7) * 7;
    const firstVisibleDate = new Date(year, month, 1 - firstDayIndex);

    for (let offset = 0; offset < visibleDays; offset++) {
      const date = new Date(
        firstVisibleDate.getFullYear(),
        firstVisibleDate.getMonth(),
        firstVisibleDate.getDate() + offset,
      );
      const dateKey = parseDateKey(date);

      for (const slot of slots) {
        if (!slot.active || Number(slot.day_of_week) !== date.getDay()) continue;

        events.push({
          id: `slot-${slot.id}-${dateKey}`,
          type: 'weekly_slot',
          title: slot.hook?.trim() || CONTENT_TYPE_LABELS[slot.content_type] || 'Post do Instagram',
          dateKey,
          timeStr: parseTimeStr(slot.scheduled_time),
          destinations: ['instagram'],
          status: 'slot',
          statusLabel: 'Grade semanal',
          itemsCount: 1,
          thumbnailUrl: null,
          rawPayload: { slot },
        });
      }
    }

    // 4. Automated WhatsApp Status campaigns.
    for (const campaign of safeWhatsappCampaigns) {
      for (const dateKey of whatsappCampaignDateKeys(campaign)) {
        events.push({
          id: `whatsapp-${campaign.id}-${dateKey}`,
          type: 'whatsapp_campaign',
          title: campaign.title || 'Status do WhatsApp',
          dateKey,
          timeStr: parseTimeStr(campaign.start_time),
          destinations: ['whatsapp'],
          status: campaign.active ? 'approved' : 'completed',
          statusLabel: campaign.active ? 'Programado' : 'Encerrado',
          itemsCount: campaign.repeat_mode === 'single_product'
            ? 1
            : Math.max(1, Number(campaign.daily_limit) || 1),
          thumbnailUrl: null,
          rawPayload: { campaign },
        });
      }
    }

    // 5. Facebook Marketplace assisted publication queue.
    for (const schedule of safeFacebookSchedules) {
      const dateKey = parseDateKey(schedule.scheduled_for);
      if (!dateKey) continue;

      const scheduledTimestamp = new Date(String(schedule.scheduled_for).replace(' ', 'T')).getTime();
      const effectiveStatus = schedule.status === 'scheduled' && Number.isFinite(scheduledTimestamp) && scheduledTimestamp <= Date.now()
        ? 'ready'
        : schedule.status;
      const normalized = effectiveStatus === 'published'
        ? { status: 'completed' as const, label: 'Publicado' }
        : effectiveStatus === 'cancelled'
        ? { status: 'failed' as const, label: 'Cancelado' }
        : effectiveStatus === 'ready'
        ? { status: 'pending' as const, label: 'Pronto para publicar' }
        : { status: 'approved' as const, label: 'Agendado' };

      events.push({
        id: `facebook-${schedule.id}`,
        type: 'facebook_schedule',
        title: schedule.product_name || 'Facebook Marketplace',
        dateKey,
        timeStr: parseTimeStr(schedule.scheduled_for),
        destinations: ['facebook'],
        status: normalized.status,
        statusLabel: normalized.label,
        itemsCount: 1,
        thumbnailUrl: schedule.image_urls?.[0] ? toBrowserSafeMediaUrl(schedule.image_urls[0]) : null,
        rawPayload: { schedule },
      });
    }

    return events;
  }, [schedules, approvals, slots, whatsappCampaigns, facebookSchedules, year, month]);

  const filteredEvents = useMemo(() => {
    return allEvents.filter((event) => {
      // Cancelled/rejected records remain available for audit in the backend, but
      // must not look like active publications in the editorial calendar.
      if (event.status === 'failed') return false;
      if (channelFilter !== 'all') {
        if (!event.destinations.includes(channelFilter)) return false;
      }
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending' && event.status !== 'pending') return false;
        if (statusFilter === 'approved' && event.status !== 'approved') return false;
        if (statusFilter === 'completed' && event.status !== 'completed') return false;
      }
      return true;
    });
  }, [allEvents, channelFilter, statusFilter]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of filteredEvents) {
      const list = map.get(event.dateKey) || [];
      list.push(event);
      map.set(event.dateKey, list);
    }
    return map;
  }, [filteredEvents]);

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{
      dayNumber: number;
      dateKey: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      events: CalendarEvent[];
    }> = [];

    const todayDateKey = parseDateKey(new Date());

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const d = new Date(year, month - 1, dayNum);
      const dateKey = parseDateKey(d);

      days.push({
        dayNumber: dayNum,
        dateKey,
        isCurrentMonth: false,
        isToday: dateKey === todayDateKey,
        events: eventsByDate.get(dateKey) || [],
      });
    }

    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
      const d = new Date(year, month, dayNum);
      const dateKey = parseDateKey(d);

      days.push({
        dayNumber: dayNum,
        dateKey,
        isCurrentMonth: true,
        isToday: dateKey === todayDateKey,
        events: eventsByDate.get(dateKey) || [],
      });
    }

    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dateKey = parseDateKey(d);

      days.push({
        dayNumber: i,
        dateKey,
        isCurrentMonth: false,
        isToday: dateKey === todayDateKey,
        events: eventsByDate.get(dateKey) || [],
      });
    }

    return days;
  }, [year, month, eventsByDate]);

  const selectedDayData = useMemo(() => {
    if (!selectedDayKey) return null;
    const events = eventsByDate.get(selectedDayKey) || [];
    const parts = selectedDayKey.split('-').map(Number);
    const dateObj = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(selectedDayKey + 'T12:00:00');

    return {
      dateKey: selectedDayKey,
      formattedDate: dateObj.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      events: [...events].sort((a, b) => a.timeStr.localeCompare(b.timeStr)),
    };
  }, [selectedDayKey, eventsByDate]);

  const getStatusBadgeClass = (status: CalendarEvent['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'approved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'executing':
        return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'completed':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'failed':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Controls & Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-tr from-pink-500 to-rose-500 rounded-xl text-white shadow-md shadow-pink-500/20">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                Calendário Editorial & Programações
              </h2>
              <p className="text-xs text-slate-500">
                Visualize e acompanhe todas as postagens e lotes programados no mês.
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {onSelectDateForNewSchedule && (
              <button
                type="button"
                onClick={() => onSelectDateForNewSchedule(selectedDayKey || new Date().toISOString().slice(0, 10))}
                className="inline-flex items-center gap-1.5 bg-pink-600 hover:bg-pink-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" /> Agendar Post
              </button>
            )}

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
              title="Atualizar Calendário"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Month Navigator & Filters Bar */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Month Navigator */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
              title="Mês anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-slate-800 min-w-[180px] text-center capitalize">
              {MONTH_NAMES[month]} <span className="text-slate-400 font-normal">{year}</span>
            </h3>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
              title="Próximo mês"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={handleToday}
              className="ml-2 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Hoje
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setChannelFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  channelFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos canais
              </button>
              <button
                type="button"
                onClick={() => setChannelFilter('instagram')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  channelFilter === 'instagram' ? 'bg-pink-600 text-white shadow-xs' : 'text-slate-600 hover:text-pink-600'
                }`}
              >
                <Instagram className="w-3.5 h-3.5" /> Instagram
              </button>
              <button
                type="button"
                onClick={() => setChannelFilter('whatsapp')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  channelFilter === 'whatsapp' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-emerald-600'
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setChannelFilter('facebook')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  channelFilter === 'facebook' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-blue-600'
                }`}
              >
                <Facebook className="w-3.5 h-3.5" /> Facebook
              </button>
            </div>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos status
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('approved')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  statusFilter === 'approved' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                Aprovados
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  statusFilter === 'pending' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-amber-700'
                }`}
              >
                Pendentes
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout: Grid Calendar + Day Details Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center py-2.5">
            {WEEK_DAYS.map((wd, i) => (
              <span
                key={wd}
                className={`text-xs font-bold uppercase tracking-wider ${
                  i === 0 || i === 6 ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                {wd}
              </span>
            ))}
          </div>

          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-pink-600" />
              <p className="text-sm font-medium">Carregando programações do calendário...</p>
            </div>
          ) : (
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 bg-slate-100">
              {calendarDays.map((day, idx) => {
                const isSelected = day.dateKey === selectedDayKey;
                const hasEvents = day.events.length > 0;

                return (
                  <div
                    key={`${day.dateKey}-${idx}`}
                    onClick={() => setSelectedDayKey(day.dateKey)}
                    className={`min-h-[105px] p-2 bg-white transition-all cursor-pointer flex flex-col justify-between group ${
                      !day.isCurrentMonth ? 'bg-slate-50/60 text-slate-400' : ''
                    } ${isSelected ? 'ring-2 ring-pink-500 ring-inset z-10 bg-pink-50/20' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-black inline-flex items-center justify-center w-6 h-6 rounded-full transition-transform ${
                          day.isToday
                            ? 'bg-pink-600 text-white shadow-sm scale-110'
                            : isSelected
                            ? 'bg-slate-900 text-white'
                            : day.isCurrentMonth
                            ? 'text-slate-800 group-hover:scale-105'
                            : 'text-slate-400'
                        }`}
                      >
                        {day.dayNumber}
                      </span>

                      <div className="flex items-center gap-1">
                        {hasEvents && (
                          <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 my-1 overflow-hidden">
                      {day.events.slice(0, 2).map((ev) => (
                        <div
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDayKey(day.dateKey);
                          }}
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded truncate border flex items-center gap-1 transition-opacity ${getStatusBadgeClass(
                            ev.status
                          )} hover:opacity-80`}
                        >
                          {ev.destinations.includes('instagram') && (
                            <Instagram className="w-2.5 h-2.5 shrink-0 text-pink-600" />
                          )}
                          {ev.destinations.includes('whatsapp') && (
                            <MessageCircle className="w-2.5 h-2.5 shrink-0 text-emerald-600" />
                          )}
                          {ev.destinations.includes('facebook') && (
                            <Facebook className="w-2.5 h-2.5 shrink-0 text-blue-600" />
                          )}
                          <span className="truncate">{ev.timeStr} · {ev.title}</span>
                        </div>
                      ))}

                      {day.events.length > 2 && (
                        <span className="text-[9px] font-bold text-slate-500 pl-1">
                          +{day.events.length - 2} mais
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                      {hasEvents ? `${day.events.length} item(s)` : '+'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Day Timeline & Details */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col h-full">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-pink-600">
                  Programação do Dia
                </span>
                <h3 className="text-base font-black text-slate-900 capitalize mt-0.5">
                  {selectedDayData ? selectedDayData.formattedDate : 'Selecione um dia'}
                </h3>
              </div>

              {onSelectDateForNewSchedule && selectedDayKey && (
                <button
                  type="button"
                  onClick={() => onSelectDateForNewSchedule(selectedDayKey)}
                  className="p-1.5 bg-pink-50 hover:bg-pink-100 text-pink-600 rounded-lg transition-colors"
                  title="Agendar neste dia"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="mt-4 flex-1 overflow-y-auto space-y-3 max-h-[550px] pr-1">
              {selectedDayData && selectedDayData.events.length > 0 ? (
                selectedDayData.events.map((event) => {
                  const duplicates = duplicateDestinations(event, selectedDayData.events);
                  return (
                    <div
                      key={event.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all flex flex-col gap-2"
                    >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {event.timeStr}
                        </span>

                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${getStatusBadgeClass(
                            event.status
                          )}`}
                        >
                          {event.statusLabel}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {event.destinations.includes('instagram') && (
                          <span className="p-1 bg-pink-50 text-pink-600 rounded" title="Instagram Stories">
                            <Instagram className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {event.destinations.includes('whatsapp') && (
                          <span className="p-1 bg-emerald-50 text-emerald-600 rounded" title="WhatsApp Status">
                            <MessageCircle className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {event.destinations.includes('facebook') && (
                          <span className="p-1 bg-blue-50 text-blue-600 rounded" title="Facebook Marketplace">
                            <Facebook className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </div>

                    {duplicates.length > 0 && (
                      <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        Possível duplicidade em {duplicates.map((destination) => (
                          destination === 'whatsapp' ? 'WhatsApp' : destination === 'instagram' ? 'Instagram' : 'Facebook'
                        )).join(' + ')} neste horário
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      {event.thumbnailUrl ? (
                        <CalendarMediaPreview
                          url={event.thumbnailUrl}
                          mediaType={event.thumbnailMediaType}
                          title={event.title}
                          className="w-12 h-16 object-cover rounded-lg border border-slate-200 shrink-0 bg-slate-100"
                        />
                      ) : (
                        <div className="w-12 h-16 rounded-lg border border-dashed border-slate-200 bg-slate-100 flex items-center justify-center shrink-0 text-slate-400">
                          <Layers className="w-5 h-5" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 truncate">{event.title}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {event.type === 'weekly_slot'
                            ? `${CONTENT_TYPE_LABELS[event.rawPayload?.slot?.content_type as keyof typeof CONTENT_TYPE_LABELS] || 'Post do Instagram'} · programação recorrente`
                            : event.type === 'whatsapp_campaign'
                            ? `${event.itemsCount} Status · programação automática`
                            : event.type === 'facebook_schedule'
                            ? 'Publicação assistida no Marketplace'
                            : `${event.itemsCount} arte(s) / storie(s) neste dia`}
                        </p>
                        {Array.isArray(event.rawPayload?.dayItems) && event.rawPayload.dayItems.length > 1 && (
                          <div className="mt-2.5 space-y-1.5 pt-2 border-t border-slate-200/60 max-h-36 overflow-y-auto pr-1">
                            {event.rawPayload.dayItems.map((it: any, i: number) => (
                              <div key={it.id || i} className="flex items-center gap-2 text-[11px] text-slate-700 bg-white/70 p-1 rounded border border-slate-200/40">
                                {it.media_url ? (
                                  <CalendarMediaPreview
                                    url={toBrowserSafeMediaUrl(it.media_url)}
                                    mediaType={it.media_type}
                                    title={it.label || `Story ${i + 1}`}
                                    className="w-5 h-7 object-cover rounded shrink-0 border border-slate-200"
                                  />
                                ) : (
                                  <div className="w-5 h-7 rounded bg-slate-100 shrink-0" />
                                )}
                                <span className="truncate font-medium">{it.label || `Story ${i + 1}`}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {event.type === 'approval_request' && onNavigateToTab && (
                          <button
                            type="button"
                            onClick={() => onNavigateToTab('approvals')}
                            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700"
                          >
                            Ver na Central de Aprovações <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                        {event.type === 'facebook_schedule' && onNavigateToTab && (
                          <button
                            type="button"
                            onClick={() => onNavigateToTab('facebook')}
                            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700"
                          >
                            Ver no Facebook Marketplace <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                        {event.type === 'whatsapp_campaign' && onNavigateToTab && (
                          <button
                            type="button"
                            onClick={() => onNavigateToTab('whatsapp')}
                            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700"
                          >
                            Ver no Status WhatsApp <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 px-4">
                  <CalendarIcon className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">Nenhum post agendado para este dia.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Clique em "+ Agendar Post" para programar publicações para essa data.
                  </p>
                  {onSelectDateForNewSchedule && selectedDayKey && (
                    <button
                      type="button"
                      onClick={() => onSelectDateForNewSchedule(selectedDayKey)}
                      className="mt-4 inline-flex items-center gap-1.5 bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Criar Programação
                    </button>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
