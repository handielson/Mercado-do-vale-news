import React from 'react';
import { ArrowRight, BrainCircuit, CalendarDays, Facebook, Home, Instagram, MessageCircle, ShieldCheck, Smartphone, Sparkles } from 'lucide-react';
import { MARKETING_SECTIONS, type MarketingTab } from './marketingNavigation';

const icons = { overview: Home, studio: Sparkles, tables: Smartphone, calendar: CalendarDays, campaigns: BrainCircuit, instagram: Instagram, whatsapp: MessageCircle, facebook: Facebook, approvals: ShieldCheck };
const groups = [...new Set(MARKETING_SECTIONS.map(section => section.group))];
const shortcuts: MarketingTab[] = ['studio', 'tables', 'instagram', 'calendar', 'approvals', 'campaigns'];

export default function MarketingWorkspace({ activeTab, onNavigate, children }: { activeTab: MarketingTab; onNavigate: (tab: MarketingTab) => void; children: React.ReactNode }) {
  const current = MARKETING_SECTIONS.find(section => section.id === activeTab)!;
  return (
    <div className="mx-auto max-w-[1700px] p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-violet-600">Mercado do Vale</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Marketing</h1></div>
        <p className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-500">Criar → Planejar → Agendar → Revisar</p>
      </div>
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <label className="block text-xs font-bold text-slate-500 lg:hidden">Área de Marketing
            <select aria-label="Área de Marketing" value={activeTab} onChange={event => onNavigate(event.target.value as MarketingTab)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900">
              {groups.map(group => <optgroup key={group} label={group}>{MARKETING_SECTIONS.filter(section => section.group === group).map(section => <option key={section.id} value={section.id}>{section.label}</option>)}</optgroup>)}
            </select>
          </label>
          <nav aria-label="Ferramentas de Marketing" className="hidden flex-wrap items-start gap-x-5 gap-y-3 lg:flex">
            {groups.map(group => <div key={group} className="min-w-0">
              <p className="mb-1 px-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{group}</p>
              <div className="flex flex-wrap gap-1">{MARKETING_SECTIONS.filter(section => section.group === group).map(section => {
                const Icon = icons[section.id];
                return <button type="button" key={section.id} aria-current={activeTab === section.id ? 'page' : undefined} onClick={() => onNavigate(section.id)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${activeTab === section.id ? 'bg-violet-50 text-violet-800 ring-1 ring-violet-100' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}><Icon className="h-4 w-4 shrink-0" />{section.label}</button>;
              })}</div>
            </div>)}
          </nav>
        </div>
        <main className="min-w-0" aria-label={current.title}>
          <div className="mb-5"><p className="text-xs font-semibold text-slate-400">Marketing / {current.group}</p><h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{current.title}</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">{current.description}</p></div>
          {activeTab === 'overview' ? <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{shortcuts.map(id => {
              const section = MARKETING_SECTIONS.find(section => section.id === id)!;
              const Icon = icons[id];
              return <button key={id} type="button" onClick={() => onNavigate(id)} className="group flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"><span className="mb-4 rounded-xl bg-violet-50 p-3 text-violet-600"><Icon className="h-6 w-6" /></span><span className="text-base font-black text-slate-900">{section.label}</span><span className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">{section.description}</span><span className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-violet-700">Abrir ferramenta <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span></button>;
            })}</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><h3 className="text-sm font-bold text-slate-800">Agendar em outros canais</h3><div className="mt-3 flex flex-wrap gap-3">{(['whatsapp', 'facebook'] as const).map(id => { const Icon = icons[id]; return <button key={id} type="button" onClick={() => onNavigate(id)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-violet-300"><Icon className="h-4 w-4" />{MARKETING_SECTIONS.find(section => section.id === id)!.label}</button>; })}</div></div>
          </div> : children}
        </main>
      </div>
    </div>
  );
}
