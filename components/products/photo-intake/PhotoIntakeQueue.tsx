import React from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Loader2, Smartphone } from 'lucide-react';
import type { SmartphonePhotoIntake } from '../../../types/smartphone-photo-intake';
import { SMARTPHONE_PHOTO_INTAKE_STATUS_LABELS } from '../../../types/smartphone-photo-intake';

interface PhotoIntakeQueueProps {
  items: SmartphonePhotoIntake[];
  groupSizeById?: Record<string, number>;
  selectedId?: string | null;
  loading?: boolean;
  onSelect: (item: SmartphonePhotoIntake) => void;
}
const STATUS_STYLE: Record<string, string> = {
  uploaded: 'bg-blue-50 text-blue-700 border-blue-200',
  analyzing: 'bg-blue-50 text-blue-700 border-blue-200',
  waiting_model_registration: 'bg-violet-50 text-violet-700 border-violet-200',
  waiting_price_confirmation: 'bg-amber-50 text-amber-700 border-amber-200',
  review_required: 'bg-orange-50 text-orange-700 border-orange-200',
  ready_to_finalize: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

function StatusIcon({ status }: { status: SmartphonePhotoIntake['status'] }) {
  if (status === 'analyzing') return <Loader2 size={14} className="animate-spin" />;
  if (status === 'completed' || status === 'ready_to_finalize') return <CheckCircle2 size={14} />;
  if (status === 'failed' || status === 'review_required') return <AlertTriangle size={14} />;
  return <Clock3 size={14} />;
}

export function PhotoIntakeQueue({ items, groupSizeById = {}, selectedId, loading, onSelect }: PhotoIntakeQueueProps) {
  if (loading && items.length === 0) {
    return <div className="flex justify-center py-12 text-slate-400"><Loader2 className="animate-spin" /></div>;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 px-5 py-12 text-center">
        <Smartphone className="mx-auto text-slate-300" size={36} />
        <p className="mt-3 text-sm font-medium text-slate-600">Nenhum aparelho na fila.</p>
        <p className="mt-1 text-xs text-slate-400">Envie a primeira foto para começar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map(item => {
        const title = [item.detected_brand, item.detected_model].filter(Boolean).join(' ') || 'Aguardando leitura';
        const details = [item.detected_ram, item.detected_storage, item.detected_color].filter(Boolean).join(' · ');
        const selected = selectedId === item.id;
        const groupSize = groupSizeById[item.id] || 1;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className={`w-full rounded-xl border p-3 text-left transition-all ${selected
              ? 'border-blue-400 bg-blue-50 shadow-sm'
              : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm font-bold text-slate-800">{title}</p>
                  {groupSize > 1 && (
                    <span className="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black text-white">
                      {groupSize} aparelhos
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">{details || 'Dados ainda não confirmados'}</p>
              </div>
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${STATUS_STYLE[item.status] || STATUS_STYLE.uploaded}`}>
                <StatusIcon status={item.status} />
                {SMARTPHONE_PHOTO_INTAKE_STATUS_LABELS[item.status] || item.status}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              {new Date(item.created_at).toLocaleString('pt-BR')}
            </p>
          </button>
        );
      })}
    </div>
  );
}
