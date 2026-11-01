import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Plus, Save, Search, Sparkles, Trash2, X } from 'lucide-react';
import {
  emptyFiscalTaxProfile, fiscalIssueText, fiscalTaxProfileService,
  type FiscalProductDetail, type FiscalProductFilter, type FiscalProductsPage, type FiscalTaxBlockKind, type FiscalTaxProfile,
} from '../../services/fiscalTaxProfileService';

const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100';
const label = 'block text-xs font-semibold text-slate-600';
const primaryBtn = 'inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50';
const ghostBtn = 'inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const errText = (e: unknown) => (e instanceof Error ? e.message : 'Falha inesperada.');
const PIS_COFINS_HINT = 'No Simples Nacional costuma ser 49 ou 99 com alíquota 0 — confirme com a contadora.';

export interface FiscalCompanyOption { id: string; name: string; cnpj?: string }
export interface FiscalProductTaxPanelProps { listCompanies: () => Promise<{ companies: FiscalCompanyOption[] }>; productLink?: (productId: string) => string }

function Badge({ ok, children, title }: { ok: boolean; children: React.ReactNode; title?: string }) {
  return <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
    {ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}{children}</span>;
}

function Field({ name, children, hint }: { name: string; children: React.ReactNode; hint?: string }) {
  return <label className="space-y-1"><span className={label}>{name}</span>{children}{hint && <span className="block text-[11px] text-slate-500">{hint}</span>}</label>;
}

function BlockEditor({ kind, profile, csosn, onChange }: { kind: FiscalTaxBlockKind; profile: FiscalTaxProfile; csosn: Record<string, string>; onChange: (patch: Record<string, unknown>) => void }) {
  const block = profile[kind] as unknown as Record<string, string | boolean>;
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ [field]: e.target.value });
  const credit = ['101', '201'].includes(String(block.csosn));
  return <div className="space-y-3">
    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
      <input type="checkbox" checked={!!block.used} onChange={e => onChange({ used: e.target.checked })} />
      {kind === 'nfce' ? 'Este perfil emite NFC-e (cupom, modelo 65)' : 'Este perfil emite NF-e (nota para empresa, modelo 55)'}
    </label>
    {block.used && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {kind === 'nfce'
        ? <Field name="CFOP" hint="Ex.: 5102 sem ST, 5405 com ST"><input className={input} inputMode="numeric" maxLength={4} value={String(block.cfop || '')} onChange={set('cfop')} /></Field>
        : <>
          <Field name="CFOP dentro do estado" hint="Ex.: 5102 ou 5405"><input className={input} inputMode="numeric" maxLength={4} value={String(block.cfopInternal || '')} onChange={set('cfopInternal')} /></Field>
          <Field name="CFOP fora do estado" hint="Ex.: 6102 ou 6404"><input className={input} inputMode="numeric" maxLength={4} value={String(block.cfopInterstate || '')} onChange={set('cfopInterstate')} /></Field>
        </>}
      <Field name="CSOSN (ICMS no Simples)">
        <select className={input} value={String(block.csosn || '')} onChange={set('csosn')}>
          <option value="">Selecione…</option>
          {Object.entries(csosn).map(([code, text]) => <option key={code} value={code}>{code} — {text}</option>)}
        </select>
      </Field>
      {credit && <Field name="Alíquota de crédito (pCredSN %)"><input className={input} inputMode="decimal" value={String(block.pCredSN || '')} onChange={set('pCredSN')} /></Field>}
      <Field name="CST PIS" hint={PIS_COFINS_HINT}><input className={input} inputMode="numeric" maxLength={2} value={String(block.pisCst || '')} onChange={set('pisCst')} /></Field>
      <Field name="Alíquota PIS %"><input className={input} inputMode="decimal" value={String(block.pisRate || '')} onChange={set('pisRate')} /></Field>
      <Field name="CST COFINS"><input className={input} inputMode="numeric" maxLength={2} value={String(block.cofinsCst || '')} onChange={set('cofinsCst')} /></Field>
      <Field name="Alíquota COFINS %"><input className={input} inputMode="decimal" value={String(block.cofinsRate || '')} onChange={set('cofinsRate')} /></Field>
      <Field name="CST IBS/CBS (reforma)" hint="Opcional enquanto a contadora não definir"><input className={input} inputMode="numeric" maxLength={3} value={String(block.ibsCbsCst || '')} onChange={set('ibsCbsCst')} /></Field>
      <Field name="cClassTrib (reforma)"><input className={input} inputMode="numeric" maxLength={6} value={String(block.cClassTrib || '')} onChange={set('cClassTrib')} /></Field>
      <Field name="Unidade comercial"><input className={input} maxLength={6} value={String(block.unit || '')} onChange={set('unit')} /></Field>
    </div>}
  </div>;
}

function ProfilesSection({ companyId, onChanged }: { companyId: string; onChanged: () => void }) {
  const [profiles, setProfiles] = useState<FiscalTaxProfile[]>([]);
  const [csosn, setCsosn] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<FiscalTaxProfile | null>(null);
  const [blockTab, setBlockTab] = useState<FiscalTaxBlockKind>('nfce');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try { const r = await fiscalTaxProfileService.listProfiles(companyId); setProfiles(r.profiles); setCsosn(r.csosn); }
    catch (e) { setError(errText(e)); } finally { setBusy(false); }
  }, [companyId]);
  useEffect(() => { void load(); }, [load]);
  const patch = (p: Partial<FiscalTaxProfile>) => setEditing(cur => (cur ? { ...cur, ...p } : cur));
  const patchBlock = (kind: FiscalTaxBlockKind) => (p: Record<string, unknown>) => setEditing(cur => (cur ? { ...cur, [kind]: { ...cur[kind], ...p } } : cur));
  const save = async () => {
    if (!editing) return;
    setBusy(true); setError(''); setWarnings([]);
    try {
      const r = editing.id ? await fiscalTaxProfileService.updateProfile(companyId, editing) : await fiscalTaxProfileService.createProfile(companyId, editing);
      setEditing(r.profile); setWarnings(r.warnings); await load(); onChanged();
    } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  };
  const remove = async (profile: FiscalTaxProfile) => {
    if (!profile.id || !window.confirm(`Excluir o perfil "${profile.name}"?`)) return;
    setBusy(true); setError('');
    try { await fiscalTaxProfileService.deleteProfile(companyId, profile.id); setEditing(null); await load(); onChanged(); }
    catch (e) { setError(errText(e)); } finally { setBusy(false); }
  };
  const shownWarnings = editing ? [...new Set([...(editing.completeness?.warnings || []), ...warnings])] : [];
  return <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
    <aside className="space-y-2">
      <button type="button" className={`${primaryBtn} w-full justify-center`} onClick={() => { setEditing(emptyFiscalTaxProfile()); setWarnings([]); setBlockTab('nfce'); }}><Plus size={16} />Novo perfil</button>
      {profiles.length === 0 && !busy && <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">Nenhum perfil ainda. Ex.: "Celular com ST", "Acessório sem ST", "Produto 3D".</p>}
      {profiles.map(p => <button key={p.id} type="button" onClick={() => { setEditing(p); setWarnings([]); }}
        className={`w-full rounded-xl border p-3 text-left ${editing?.id === p.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
        <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-900">{p.name}</span>
          <Badge ok={p.status === 'approved'}>{p.status === 'approved' ? 'Aprovado' : 'Rascunho'}</Badge></div>
        <p className="mt-1 text-xs text-slate-500">{p.productCount || 0} produto(s){p.requiresCest ? ' · exige CEST' : ''}</p>
        {p.completeness && !p.completeness.complete && <p className="mt-1 text-xs text-amber-700">Falta: {p.completeness.errors.slice(0, 2).join('; ')}{p.completeness.errors.length > 2 ? '…' : ''}</p>}
      </button>)}
    </aside>
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!editing ? <p className="text-sm text-slate-500">Escolha um perfil à esquerda ou crie um novo. Cada perfil tem a tributação da NFC-e (65) e da NF-e (55); os valores são passados pela contadora.</p> : <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="Nome do perfil"><input className={input} value={editing.name} onChange={e => patch({ name: e.target.value })} placeholder="Celular com ST" /></Field>
          <Field name="NCMs que usam este perfil (prefixos)" hint="Usado para sugerir o perfil. Ex.: 85171300 ou 8517"><input className={input} value={editing.ncmPrefixes.join(', ')} onChange={e => patch({ ncmPrefixes: e.target.value.split(/[\s,;]+/).map(v => v.replace(/\D/g, '')).filter(Boolean) })} /></Field>
          <Field name="Descrição"><input className={input} value={editing.description} onChange={e => patch({ description: e.target.value })} /></Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={editing.requiresCest} onChange={e => patch({ requiresCest: e.target.checked })} />Exige CEST (produto com substituição tributária)</label>
        </div>
        <div>
          <nav className="mb-3 flex gap-2 border-b border-slate-200">
            {(['nfce', 'nfe'] as const).map(k => <button key={k} type="button" onClick={() => setBlockTab(k)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${blockTab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>
              {k === 'nfce' ? 'NFC-e (65) · cupom' : 'NF-e (55) · nota para empresa'}</button>)}
          </nav>
          <BlockEditor kind={blockTab} profile={editing} csosn={csosn} onChange={patchBlock(blockTab)} />
        </div>
        <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-700">Aprovação da contadora</legend>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field name="Situação"><select className={input} value={editing.status} onChange={e => patch({ status: e.target.value as FiscalTaxProfile['status'] })}><option value="draft">Rascunho</option><option value="approved">Aprovado</option></select></Field>
            <Field name="Nome de quem aprovou"><input className={input} value={editing.reviewerName} onChange={e => patch({ reviewerName: e.target.value })} /></Field>
            <Field name="Registro (CRC)"><input className={input} value={editing.reviewerRegistration} onChange={e => patch({ reviewerRegistration: e.target.value })} /></Field>
            <Field name="Data"><input type="date" className={input} value={editing.reviewedAt} onChange={e => patch({ reviewedAt: e.target.value })} /></Field>
          </div>
          <Field name="Observações"><textarea className={input} rows={2} value={editing.notes} onChange={e => patch({ notes: e.target.value })} /></Field>
        </fieldset>
        {editing.completeness && editing.completeness.errors.length > 0 && <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><b>Para aprovar, falta:</b> {editing.completeness.errors.join('; ')}.</div>}
        {shownWarnings.length > 0 && <ul className="space-y-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{shownWarnings.map(w => <li key={w} className="flex gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{w}</li>)}</ul>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primaryBtn} disabled={busy} onClick={() => void save()}><Save size={16} />Salvar perfil</button>
          {editing.id && <button type="button" className={ghostBtn} disabled={busy} onClick={() => void remove(editing)}><Trash2 size={16} />Excluir</button>}
          <button type="button" className={ghostBtn} onClick={() => setEditing(null)}>Fechar</button>
        </div>
      </div>}
    </section>
  </div>;
}

function ProductDrawer({ companyId, productId, onClose, onSaved, productLink }: { companyId: string; productId: string; onClose: () => void; onSaved: () => void; productLink?: (id: string) => string }) {
  const [detail, setDetail] = useState<FiscalProductDetail | null>(null);
  const [profiles, setProfiles] = useState<FiscalTaxProfile[]>([]);
  const [profileId, setProfileId] = useState<string>('');
  const [overrides, setOverrides] = useState<Record<FiscalTaxBlockKind, Record<string, string>>>({ nfce: {}, nfe: {} });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const [d, p] = await Promise.all([fiscalTaxProfileService.productDetail(companyId, productId), fiscalTaxProfileService.listProfiles(companyId)]);
      setDetail(d); setProfiles(p.profiles); setProfileId(d.settings?.taxProfileId || '');
      setOverrides({ nfce: { ...(d.settings?.overrides?.nfce || {}) }, nfe: { ...(d.settings?.overrides?.nfe || {}) } });
    } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  }, [companyId, productId]);
  useEffect(() => { void load(); }, [load]);
  const profile = profiles.find(p => p.id === profileId);
  const save = async () => {
    setBusy(true); setError('');
    try {
      const clean = Object.fromEntries((['nfce', 'nfe'] as const).map(k => [k, Object.fromEntries(Object.entries(overrides[k]).filter(([, v]) => String(v).trim() !== ''))]));
      await fiscalTaxProfileService.saveProduct(companyId, productId, { taxProfileId: profileId || null, overrides: clean, version: detail?.settings?.version });
      await load(); onSaved();
    } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  };
  const overrideInput = (kind: FiscalTaxBlockKind, field: string, name: string) => {
    const base = profile ? String((profile[kind] as unknown as Record<string, string>)[field] || '') : '';
    return <Field key={`${kind}-${field}`} name={name}><input className={`${input} ${overrides[kind][field] ? 'border-blue-500' : ''}`} placeholder={base || '—'} value={overrides[kind][field] || ''}
      onChange={e => setOverrides(cur => ({ ...cur, [kind]: { ...cur[kind], [field]: e.target.value } }))} /></Field>;
  };
  const resolvedRow = (title: string, r?: FiscalProductDetail['resolved']['nfce']) => r && <div className="rounded-lg border border-slate-200 p-3 text-sm">
    <div className="mb-1 flex items-center justify-between"><b>{title}</b><Badge ok={r.ready}>{r.ready ? 'Pronto' : 'Pendente'}</Badge></div>
    <p className="text-slate-700">CFOP <b>{r.fields.cfop || '—'}</b> · CSOSN <b>{r.fields.csosn || '—'}</b> · PIS {r.fields.pisCst || '—'} · COFINS {r.fields.cofinsCst || '—'}{r.fields.cest ? ` · CEST ${r.fields.cest}` : ''}</p>
    {r.overriddenFields.length > 0 && <p className="text-xs text-blue-700">Ajustado só neste produto: {r.overriddenFields.join(', ')}</p>}
    {!r.ready && <p className="text-xs text-amber-800">{r.issues.map(i => fiscalIssueText[i] || i).join('; ')}</p>}
  </div>;
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label="Tributação do produto" className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div><h3 className="text-lg font-bold text-slate-900">{detail?.name || 'Produto'}</h3><p className="text-sm text-slate-500">SKU {detail?.sku || '—'}</p></div>
        <button type="button" aria-label="Fechar" className={ghostBtn} onClick={onClose}><X size={16} /></button>
      </div>
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {detail && <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 p-4 text-sm">
          <p><b>NCM:</b> {detail.ncm.formatted || detail.ncm.raw || '—'} {detail.ncm.valid ? <span className="text-slate-600">— {detail.ncm.description}</span> : <span className="font-semibold text-amber-800">— {detail.ncm.message}</span>}</p>
          <p className="mt-1"><b>CEST:</b> {detail.cest || '—'} · <b>Origem:</b> {detail.origin === '' ? '—' : detail.origin}</p>
          {detail.cestOptions.length > 0 && <p className="mt-2 text-xs text-slate-600"><b>CESTs do Convênio 142/2018 para este NCM:</b> {detail.cestOptions.slice(0, 6).map(o => `${o.formatted} (${o.description.slice(0, 50)}${o.description.length > 50 ? '…' : ''})`).join(' · ')}</p>}
          {detail.ncm.valid && detail.cestOptions.length === 0 && <p className="mt-2 text-xs text-slate-600">Nenhum CEST no Convênio 142/2018 para este NCM — em geral, sem substituição tributária.</p>}
          {productLink && <a className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700" href={productLink(detail.id)} target="_blank" rel="noreferrer"><ExternalLink size={12} />Corrigir NCM/CEST/origem no cadastro do produto</a>}
        </div>
        <Field name="Perfil fiscal">
          <select className={input} value={profileId} onChange={e => setProfileId(e.target.value)}>
            <option value="">Sem perfil</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}{p.status === 'approved' ? '' : ' (rascunho)'}</option>)}
          </select>
        </Field>
        {detail.suggestedProfile && !profileId && <button type="button" className={ghostBtn} onClick={() => setProfileId(detail.suggestedProfile!.id)}><Sparkles size={16} />Usar sugerido pelo NCM: {detail.suggestedProfile.name}</button>}
        <div className="grid gap-2">{resolvedRow('NFC-e (65)', detail.resolved.nfce)}{resolvedRow('NF-e (55) dentro do estado', detail.resolved.nfeInternal)}{resolvedRow('NF-e (55) fora do estado', detail.resolved.nfeInterstate)}</div>
        <details className="rounded-xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">Ajustar só neste produto (deixe vazio para usar o perfil)</summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs font-semibold text-slate-500">NFC-e (65)</p>
            <div className="grid gap-3 sm:grid-cols-3">{overrideInput('nfce', 'cfop', 'CFOP')}{overrideInput('nfce', 'csosn', 'CSOSN')}{overrideInput('nfce', 'pisCst', 'CST PIS')}{overrideInput('nfce', 'cofinsCst', 'CST COFINS')}{overrideInput('nfce', 'unit', 'Unidade')}</div>
            <p className="text-xs font-semibold text-slate-500">NF-e (55)</p>
            <div className="grid gap-3 sm:grid-cols-3">{overrideInput('nfe', 'cfopInternal', 'CFOP dentro do estado')}{overrideInput('nfe', 'cfopInterstate', 'CFOP fora do estado')}{overrideInput('nfe', 'csosn', 'CSOSN')}{overrideInput('nfe', 'pisCst', 'CST PIS')}{overrideInput('nfe', 'cofinsCst', 'CST COFINS')}{overrideInput('nfe', 'unit', 'Unidade')}</div>
          </div>
        </details>
        <button type="button" className={primaryBtn} disabled={busy} onClick={() => void save()}><Save size={16} />Salvar produto</button>
      </div>}
    </section>
  </div>;
}

function ProductsSection({ companyId, refreshKey, productLink }: { companyId: string; refreshKey: number; productLink?: (id: string) => string }) {
  const [data, setData] = useState<FiscalProductsPage | null>(null);
  const [filter, setFilter] = useState<FiscalProductFilter>('missing_profile');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkProfile, setBulkProfile] = useState('');
  const [openId, setOpenId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try { setData(await fiscalTaxProfileService.listProducts(companyId, { filter, search, page, pageSize: 50 })); }
    catch (e) { setError(errText(e)); } finally { setBusy(false); }
  }, [companyId, filter, search, page]);
  useEffect(() => { const t = setTimeout(() => void load(), search ? 300 : 0); return () => clearTimeout(t); }, [load, refreshKey, search]);
  const run = async (fn: () => Promise<{ changed: number }>, done: string) => {
    setBusy(true); setError(''); setMessage('');
    try { const r = await fn(); setMessage(`${done}: ${r.changed} produto(s).`); setSelected(new Set()); await load(); }
    catch (e) { setError(errText(e)); } finally { setBusy(false); }
  };
  const filters: Array<[FiscalProductFilter, string, number | undefined]> = [
    ['missing_profile', 'Sem perfil', data?.summary.missingProfile], ['ncm_invalid', 'NCM inválido', data?.summary.ncmInvalid],
    ['not_ready', 'Pendentes NFC-e', data ? data.summary.total - data.summary.nfceReady : undefined], ['ready', 'Prontos NFC-e', data?.summary.nfceReady], ['all', 'Todos', data?.summary.total],
  ];
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const allOnPage = useMemo(() => data?.items.map(i => i.id) || [], [data]);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      {filters.map(([key, name, count]) => <button key={key} type="button" onClick={() => { setFilter(key); setPage(1); }}
        className={`rounded-full px-3 py-1.5 text-sm font-semibold ${filter === key ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}>{name}{count !== undefined ? ` (${count})` : ''}</button>)}
      <div className="relative ml-auto"><Search size={14} className="absolute left-3 top-2.5 text-slate-400" /><input className={`${input} pl-8`} placeholder="Nome, SKU ou NCM" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
    </div>
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <button type="button" className={ghostBtn} disabled={busy} onClick={() => void run(() => fiscalTaxProfileService.assign(companyId, { mode: 'suggested' }), 'Perfis sugeridos aplicados')}><Sparkles size={16} />Aplicar perfis sugeridos pelo NCM (só em quem está sem perfil)</button>
      <span className="text-sm text-slate-500">{selected.size} selecionado(s)</span>
      <select className={`${input} w-auto`} value={bulkProfile} onChange={e => setBulkProfile(e.target.value)}>
        <option value="">Escolha um perfil…</option>{data?.profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <button type="button" className={primaryBtn} disabled={busy || !selected.size || !bulkProfile} onClick={() => void run(() => fiscalTaxProfileService.assign(companyId, { productIds: [...selected], taxProfileId: bulkProfile }), 'Perfil aplicado')}>Aplicar aos selecionados</button>
    </div>
    {message && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr>
          <th className="p-3"><input type="checkbox" aria-label="Selecionar página" checked={allOnPage.length > 0 && allOnPage.every(id => selected.has(id))} onChange={e => setSelected(cur => { const next = new Set(cur); allOnPage.forEach(id => (e.target.checked ? next.add(id) : next.delete(id))); return next; })} /></th>
          <th className="p-3">Produto</th><th className="p-3">NCM</th><th className="p-3">CEST</th><th className="p-3">Perfil</th><th className="p-3">NFC-e 65</th><th className="p-3">NF-e 55</th>
        </tr></thead>
        <tbody>{data?.items.map(item => <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
          <td className="p-3"><input type="checkbox" aria-label={`Selecionar ${item.name}`} checked={selected.has(item.id)} onChange={e => setSelected(cur => { const next = new Set(cur); if (e.target.checked) next.add(item.id); else next.delete(item.id); return next; })} /></td>
          <td className="p-3"><button type="button" className="text-left font-semibold text-blue-700 hover:underline" onClick={() => setOpenId(item.id)}>{item.name}</button><div className="text-xs text-slate-500">{item.sku}</div></td>
          <td className="p-3" title={item.ncm.valid ? item.ncm.description : item.ncm.message}><Badge ok={item.ncm.valid}>{item.ncm.formatted || item.ncm.raw || 'sem NCM'}</Badge></td>
          <td className="p-3 text-slate-700">{item.cest || '—'}</td>
          <td className="p-3">{item.profile ? <span className="font-medium">{item.profile.name}</span> : item.suggestedProfile ? <span className="text-xs text-slate-500">sugestão: {item.suggestedProfile.name}</span> : <span className="text-xs text-slate-400">—</span>}</td>
          <td className="p-3"><Badge ok={item.readiness.nfce.ready} title={item.readiness.nfce.issues.map(i => fiscalIssueText[i] || i).join('; ')}>{item.readiness.nfce.ready ? `${item.readiness.nfce.cfop}/${item.readiness.nfce.csosn}` : 'pendente'}</Badge></td>
          <td className="p-3"><Badge ok={item.readiness.nfe.ready} title={item.readiness.nfe.issues.map(i => fiscalIssueText[i] || i).join('; ')}>{item.readiness.nfe.ready ? `${item.readiness.nfe.cfop}/${item.readiness.nfe.csosn}` : 'pendente'}</Badge></td>
        </tr>)}
          {data && data.items.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-500">Nenhum produto neste filtro.</td></tr>}
        </tbody>
      </table>
    </div>
    {data && pages > 1 && <div className="flex items-center justify-end gap-2 text-sm"><button type="button" className={ghostBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</button><span>Página {page} de {pages}</span><button type="button" className={ghostBtn} disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Próxima</button></div>}
    {openId && <ProductDrawer companyId={companyId} productId={openId} productLink={productLink} onClose={() => setOpenId('')} onSaved={() => void load()} />}
  </div>;
}

/** Tributação por produto: perfis fiscais (NFC-e 65 / NF-e 55) e vínculo dos produtos. Só cadastro; não emite nota. */
export function FiscalProductTaxPanel({ listCompanies, productLink }: FiscalProductTaxPanelProps) {
  const [companies, setCompanies] = useState<FiscalCompanyOption[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [tab, setTab] = useState<'products' | 'profiles'>('profiles');
  const [refreshKey, setRefreshKey] = useState(0);
  const [info, setInfo] = useState<string>('');
  const [error, setError] = useState('');
  useEffect(() => {
    listCompanies().then(r => { setCompanies(r.companies); setCompanyId(r.companies[0]?.id || ''); }).catch(e => setError(errText(e)));
    fiscalTaxProfileService.catalogInfo().then(r => setInfo(`NCM: ${r.ncm.vigencia} (${r.ncm.ato}) · CEST: ${r.cest.source}`)).catch(() => setInfo(''));
  }, [listCompanies]);
  return <section className="space-y-4" aria-label="Tributação por produto">
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
      <p><b>Tributação por produto.</b> Crie perfis (ex.: "Celular com ST", "Acessório sem ST") com a tributação da NFC-e (65) e da NF-e (55) e vincule cada produto ao seu perfil. Os valores são definidos pela contadora; o sistema só confere formato e aponta inconsistências. Nada aqui emite nota.</p>
      {info && <p className="mt-1 text-xs text-blue-800">Tabelas oficiais: {info}</p>}
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="flex flex-wrap items-center gap-3">
      {companies.length > 1 && <select className={`${input} w-auto`} value={companyId} onChange={e => setCompanyId(e.target.value)}>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
      <nav className="flex gap-2 rounded-xl border border-slate-200 bg-white p-1">
        {(['profiles', 'products'] as const).map(k => <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === k ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>{k === 'profiles' ? 'Perfis fiscais' : 'Produtos'}</button>)}
      </nav>
    </div>
    {companyId && (tab === 'profiles'
      ? <ProfilesSection companyId={companyId} onChanged={() => setRefreshKey(k => k + 1)} />
      : <ProductsSection companyId={companyId} refreshKey={refreshKey} productLink={productLink} />)}
  </section>;
}

export default FiscalProductTaxPanel;
