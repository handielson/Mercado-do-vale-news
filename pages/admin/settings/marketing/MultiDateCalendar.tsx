import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';

function localDateKey(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value: string, amount: number) {
  const date = dateFromKey(value);
  date.setDate(date.getDate() + amount);
  return localDateKey(date);
}

export function consecutiveDateKeys(startDate: string, count: number, step = 1) {
  return Array.from({ length: Math.max(1, count) }, (_, index) => addDays(startDate, index * step));
}

interface MultiDateCalendarProps {
  value: string[];
  onChange: (dates: string[]) => void;
  minDate?: string;
  maxSelected?: number;
  label?: string;
}

export default function MultiDateCalendar({
  value,
  onChange,
  minDate,
  maxSelected = 60,
  label = 'Dias da publicação',
}: MultiDateCalendarProps) {
  const normalized = useMemo(
    () => Array.from(new Set(value.map((date) => String(date).slice(0, 10)).filter(Boolean))).sort(),
    [value],
  );
  const initial = normalized[0] || minDate || localDateKey(new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = dateFromKey(initial);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const selected = useMemo(() => new Set(normalized), [normalized]);
  const firstWeekday = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);

  const toggleDate = (dateKey: string) => {
    if (minDate && dateKey < minDate) return;
    if (selected.has(dateKey)) return onChange(normalized.filter((date) => date !== dateKey));
    if (normalized.length >= maxSelected) return;
    onChange([...normalized, dateKey].sort());
  };

  const applyPattern = (step: number) => {
    const start = normalized[0] || minDate || localDateKey(new Date());
    onChange(consecutiveDateKeys(start, step === 1 ? 30 : 15, step).slice(0, maxSelected));
    const date = dateFromKey(start);
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-600">
          <CalendarDays className="h-4 w-4 text-emerald-600" /> {label}
        </div>
        <span className="text-xs font-bold text-emerald-700">{normalized.length} selecionado(s)</span>
      </div>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="rounded p-1 text-slate-500 hover:bg-white" title="Mês anterior"><ChevronLeft className="h-4 w-4" /></button>
        <span className="text-sm font-black capitalize text-slate-700">{visibleMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
        <button type="button" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="rounded p-1 text-slate-500 hover:bg-white" title="Próximo mês"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => <span key={`${day}-${index}`} className="py-1 text-[10px] font-black text-slate-400">{day}</span>)}
        {cells.map((day, index) => {
          if (!day) return <span key={`blank-${index}`} />;
          const key = localDateKey(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day));
          const disabled = Boolean(minDate && key < minDate);
          const active = selected.has(key);
          return (
            <button key={key} type="button" disabled={disabled} onClick={() => toggleDate(key)} className={`aspect-square rounded-lg text-xs font-bold transition ${active ? 'bg-emerald-600 text-white shadow-sm' : disabled ? 'text-slate-300' : 'bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'}`} aria-pressed={active}>{day}</button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => applyPattern(2)} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700">Dia sim, dia não</button>
        <button type="button" onClick={() => applyPattern(1)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600">Todos os dias</button>
        {normalized.length > 0 && <button type="button" onClick={() => onChange([])} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"><X className="h-3.5 w-3.5" /> Limpar</button>}
      </div>
      {normalized.length > 0 && <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{normalized.map((date) => dateFromKey(date).toLocaleDateString('pt-BR')).join(' · ')}</p>}
    </div>
  );
}
