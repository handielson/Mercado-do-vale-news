import React, { useEffect, useState } from 'react';
import { companyFiscalService, fiscalRegimes, type FiscalCompany } from '../../services/companyFiscalService';

const emptyCompany = (): FiscalCompany => ({ id: 'new', primary: false, identitySource: 'fiscal_profile', cnpj: '', name: '', legalName: '', stateRegistration: '', stateRegistrationExempt: false, municipalRegistration: '', suframaRegistration: '', cnae: '', cnaeActivities: [], companySize: '', mainActivity: '', segments: [], annualRevenueBand: '', employeesBand: '', contactPerson: '', phone: '', mobilePhone: '', email: '', billingEmail: '', website: '', substituteStateRegistrations: [], uf: '', municipalityCode: '', address: { zipCode: '', street: '', number: '', complement: '', neighborhood: '', city: '' }, regime: 'nao_definido', crt: '', effectiveFrom: '', notes: '', version: 0, lookup: null });
const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100';
const buttonClass = 'rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50';
const flag = (value: boolean | null) => value === true ? 'Sim' : value === false ? 'Não' : 'Não informado';
const regimeName = (key: string) => fiscalRegimes.find(([value]) => value === key)?.[1] || key;
const readinessLabels: Record<string, string> = {
    empresa: 'Vínculo da empresa', cnpj: 'CNPJ', razao_social: 'Razão social', inscricao_estadual: 'Inscrição estadual informada',
    inscricao_estadual_invalida: 'Inscrição estadual com formato ou dígito verificador inválido',
    inscricao_estadual_uf_sem_regra: 'Validação estadual da IE ainda indisponível para esta UF',
    isencao_ie_pendente_validacao: 'Isenção de IE exige confirmação cadastral antes de emitir',
    uf: 'UF', municipio_ibge: 'Código IBGE do município', municipio_uf: 'Código IBGE incompatível com a UF',
    cep: 'CEP', logradouro: 'Logradouro', numero: 'Número', bairro: 'Bairro', cidade: 'Cidade',
    municipio_nome_uf: 'Cidade/UF não coincidem com o IBGE', municipio_inexistente: 'Código municipal não encontrado no IBGE',
    municipio_consulta_indisponivel: 'Não foi possível conferir o município no IBGE',
    regime: 'Regime tributário', crt: 'CRT', regime_crt_incompativeis: 'Regime e CRT incompatíveis', vigencia: 'Vigência válida',
};

export function CompanyFiscalPanel({ api = companyFiscalService }: { api?: typeof companyFiscalService }) {
    const [companies, setCompanies] = useState<FiscalCompany[]>([]);
    const [draft, setDraft] = useState<FiscalCompany | null>(null);
    const [enabled, setEnabled] = useState(false);
    const [busy, setBusy] = useState(true);
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [reload, setReload] = useState(0);
    const [readiness, setReadiness] = useState<Awaited<ReturnType<typeof companyFiscalService.readiness>> | null>(null);
    useEffect(() => {
        let active = true;
        setBusy(true); setError('');
        api.list().then(result => {
            if (!active) return;
            setEnabled(result.enabled); setCompanies(result.companies);
            setDraft(result.companies[0] || null); setDirty(false); setReadiness(null);
        }).catch(() => { if (active) setError('Não foi possível carregar as empresas fiscais. Tente novamente.'); })
            .finally(() => { if (active) setBusy(false); });
        return () => { active = false; };
    }, [api, reload]);
    const change = (patch: Partial<FiscalCompany>) => { setDraft(current => current ? { ...current, ...patch } : current); setDirty(true); setMessage(''); setReadiness(null); };
    const changeAddress = (patch: Partial<FiscalCompany['address']>) => { if (draft) change({ address: { ...draft.address, ...patch } }); };
    const select = (id: string) => {
        if (dirty && !window.confirm('Descartar as alterações fiscais não salvas?')) return;
        setDraft(id === 'new' ? emptyCompany() : companies.find(c => c.id === id) || null);
        setDirty(false); setError(''); setMessage(''); setReadiness(null);
    };
    const accept = (company: FiscalCompany) => {
        setCompanies(current => current.some(c => c.id === company.id) ? current.map(c => c.id === company.id ? company : c) : [...current, company]);
        setDraft(company); setDirty(false); setReadiness(null);
    };
    const run = async (action: 'save' | 'refresh') => {
        if (!draft) return;
        setBusy(true); setError(''); setMessage('');
        try {
            accept(await (action === 'save' ? api.save(draft) : api.refresh(draft)));
            setMessage(action === 'save' ? 'Cadastro fiscal salvo.' : 'Consulta atualizada. Sua seleção manual foi preservada.');
        } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível concluir a operação.'); }
        finally { setBusy(false); }
    };
    const checkReadiness = async () => {
        if (!draft || dirty || draft.id === 'new' || draft.version === 0) return;
        setBusy(true); setError(''); setReadiness(null);
        try { setReadiness(await api.readiness(draft)); }
        catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível verificar o cadastro fiscal.'); }
        finally { setBusy(false); }
    };
    const lockedIdentity = !!draft?.primary;
    return <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5" aria-labelledby="fiscal-title">
        <div>
            <h2 id="fiscal-title" className="text-lg font-bold text-slate-800">Empresas e regime tributário</h2>
            <p className="text-sm text-slate-600 mt-1">Cadastre os CNPJs e escolha as configurações fiscais de cada empresa. A empresa selecionada aqui é a que você está editando.</p>
        </div>
        {busy && <p role="status">Carregando...</p>}
        {error && <div role="alert" className="text-sm text-red-700 break-words">{error}{!draft && <button type="button" className={`${buttonClass} ml-3`} onClick={() => setReload(n => n + 1)}>Tentar novamente</button>}</div>}
        {message && <p role="status" className="text-sm text-green-700">{message}</p>}
        {!busy && !error && !enabled && <p className="text-sm text-slate-600">O cadastro fiscal está aguardando ativação no servidor.</p>}
        {enabled && <>
            <div className="flex flex-wrap items-end gap-3">
                <label className="flex-1 min-w-48 text-sm font-semibold">Empresa fiscal
                    <select aria-label="Empresa fiscal" className={`${inputClass} mt-1`} value={draft?.id || ''} disabled={busy} onChange={e => select(e.target.value)}>
                        {!draft && <option value="">Selecione uma empresa</option>}
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name} — {c.cnpj}{c.primary ? ' (loja atual)' : ''}</option>)}
                        {draft?.id === 'new' && <option value="new">Nova empresa</option>}
                    </select>
                </label>
                <button type="button" className={buttonClass} disabled={busy} onClick={() => select('new')}>Adicionar empresa</button>
            </div>
            {draft && <>
                {draft.primary && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><strong>Fonte: Dados gerais e operacionais.</strong> Os campos compartilhados da loja principal aparecem abaixo somente para conferência. Para alterá-los, use a aba “Dados gerais e operacionais”; o salvamento fiscal não substitui esses valores.</div>}
                {draft.identityConflict && <p role="alert" className="text-sm text-red-700">O CNPJ da loja mudou. Revise o vínculo fiscal antes de continuar.</p>}
                <fieldset disabled={busy || draft.identityConflict} className="space-y-4">
                    <legend className="sr-only">Cadastro fiscal da empresa selecionada</legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="text-sm">Nome da empresa<input className={inputClass} value={draft.name} maxLength={255} disabled={lockedIdentity} onChange={e => change({ name: e.target.value })} /></label>
                        <label className="text-sm">Tipo de pessoa<input className={inputClass} value="Pessoa Jurídica" disabled /></label>
                        <label className="text-sm">CNPJ da empresa<input className={inputClass} value={draft.cnpj} maxLength={18} disabled={lockedIdentity || draft.id !== 'new'} placeholder="CNPJ numérico ou alfanumérico" onChange={e => change({ cnpj: e.target.value.toUpperCase() })} /></label>
                        <label className="text-sm">Razão social fiscal<input className={inputClass} value={draft.legalName} maxLength={255} disabled={lockedIdentity} onChange={e => change({ legalName: e.target.value })} /></label>
                        <div><label className="text-sm">Inscrição estadual fiscal<input className={inputClass} value={draft.stateRegistration} maxLength={30} disabled={lockedIdentity || draft.stateRegistrationExempt} onChange={e => change({ stateRegistration: e.target.value })} /></label><label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.stateRegistrationExempt} disabled={!!draft.stateRegistration} onChange={e => change({ stateRegistrationExempt: e.target.checked })} />Isento de inscrição estadual</label></div>
                        <label className="text-sm">Inscrição municipal<input className={inputClass} value={draft.municipalRegistration} maxLength={30} onChange={e => change({ municipalRegistration: e.target.value })} /></label>
                        <label className="text-sm">Inscrição Suframa<input className={inputClass} value={draft.suframaRegistration} maxLength={30} onChange={e => change({ suframaRegistration: e.target.value })} /></label>
                        <label className="text-sm">CNAE principal<input className={inputClass} value={draft.cnae} maxLength={255} disabled={lockedIdentity} onChange={e => change({ cnae: e.target.value })} /></label>
                        <label className="text-sm">Atividade principal (descrição)<input className={inputClass} value={draft.mainActivity} maxLength={255} onChange={e => change({ mainActivity: e.target.value })} /></label>
                        <label className="text-sm">Porte da empresa<input className={inputClass} value={draft.companySize} maxLength={80} disabled={lockedIdentity} onChange={e => change({ companySize: e.target.value })} /></label>
                        <label className="text-sm">UF fiscal<select className={inputClass} value={draft.uf} disabled={lockedIdentity} onChange={e => change({ uf: e.target.value })}><option value="">Selecione</option>{'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').map(uf => <option key={uf}>{uf}</option>)}</select></label>
                        <label className="text-sm">Código IBGE do município<input className={inputClass} value={draft.municipalityCode} maxLength={7} inputMode="numeric" onChange={e => change({ municipalityCode: e.target.value })} /></label>
                        <label className="text-sm font-semibold">Regime tributário<select className={inputClass} value={draft.regime} onChange={e => change({ regime: e.target.value as FiscalCompany['regime'] })}>{fiscalRegimes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                        <label className="text-sm font-semibold">CRT para emissão<select className={inputClass} value={draft.crt} onChange={e => change({ crt: e.target.value })}><option value="">Não definido</option><option value="1">1 — Simples Nacional</option><option value="2">2 — Simples Nacional: excesso de sublimite</option><option value="3">3 — Regime Normal</option><option value="4">4 — MEI</option></select></label>
                        <label className="text-sm">Vigência da configuração<input type="date" className={inputClass} value={draft.effectiveFrom} onChange={e => change({ effectiveFrom: e.target.value })} /></label>
                        <label className="text-sm">Observações da configuração<textarea className={inputClass} value={draft.notes} maxLength={1000} onChange={e => change({ notes: e.target.value })} /></label>
                    </div>
                    <div className="space-y-2">
                        <h3 className="font-semibold text-slate-800">CNAEs cadastrados</h3>
                        {draft.cnaeActivities.length ? <ul className="list-disc pl-5 text-sm">{draft.cnaeActivities.map(item => <li key={item.code}>{item.primary ? 'Principal' : 'Secundário'}: {item.code} — {item.description}</li>)}</ul> : <p className="text-sm text-slate-500">Nenhuma lista de CNAEs salva. Atualize a consulta do CNPJ e confira as atividades antes de aplicá-las.</p>}
                        <p className="text-xs text-slate-500">A descrição identifica a atividade econômica; não define sozinha os produtos permitidos nem a tributação da nota. As <a className="underline" href="https://concla.ibge.gov.br/busca-online-cnae.html" target="_blank" rel="noopener noreferrer">notas explicativas do IBGE</a> detalham o alcance de cada CNAE.</p>
                    </div>
                    <div className="space-y-3">
                        <h3 className="font-semibold text-slate-800">Inscrições estaduais como substituto tributário</h3>
                        {draft.substituteStateRegistrations.map((item, index) => <div key={index} className="grid gap-3 sm:grid-cols-[8rem_1fr_auto]">
                            <label className="text-sm">UF<select aria-label="UF substituta" className={inputClass} value={item.uf} onChange={e => change({ substituteStateRegistrations: draft.substituteStateRegistrations.map((entry, i) => i === index ? { ...entry, uf: e.target.value } : entry) })}><option value="">Selecione</option>{'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').map(uf => <option key={uf}>{uf}</option>)}</select></label>
                            <label className="text-sm">Inscrição estadual<input aria-label="Inscrição estadual substituta" className={inputClass} value={item.registration} maxLength={30} onChange={e => change({ substituteStateRegistrations: draft.substituteStateRegistrations.map((entry, i) => i === index ? { ...entry, registration: e.target.value } : entry) })} /></label>
                            <button type="button" className={buttonClass} onClick={() => change({ substituteStateRegistrations: draft.substituteStateRegistrations.filter((_, i) => i !== index) })}>Remover</button>
                        </div>)}
                        <button type="button" className={buttonClass} disabled={draft.substituteStateRegistrations.length >= 27} onClick={() => change({ substituteStateRegistrations: [...draft.substituteStateRegistrations, { uf: '', registration: '' }] })}>Adicionar inscrição</button>
                    </div>
                    <div className="space-y-3">
                        <h3 className="font-semibold text-slate-800">Perfil cadastral</h3>
                        <div className="flex flex-wrap gap-4 text-sm">{([['comercio', 'Comércio'], ['ecommerce', 'E-commerce'], ['industria', 'Indústria'], ['servicos', 'Serviços']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={draft.segments.includes(key)} onChange={e => change({ segments: e.target.checked ? [...draft.segments, key] : draft.segments.filter(s => s !== key) })} />{label}</label>)}</div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="text-sm">Faixa de faturamento do último ano<select className={inputClass} value={draft.annualRevenueBand} onChange={e => change({ annualRevenueBand: e.target.value })}><option value="">Não informado</option>{['Até R$ 60.000,00', 'De R$ 60.000,00 a R$ 360.000,00', 'Maior que R$ 360.000,00'].map(value => <option key={value}>{value}</option>)}</select></label>
                            <label className="text-sm">Faixa de funcionários<select className={inputClass} value={draft.employeesBand} onChange={e => change({ employeesBand: e.target.value })}><option value="">Não informado</option>{['Até 5 funcionários', 'De 5 a 10 funcionários', 'Mais de 10 funcionários'].map(value => <option key={value}>{value}</option>)}</select></label>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h3 className="font-semibold text-slate-800">Contato da empresa</h3>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="text-sm">Pessoa de contato<input className={inputClass} value={draft.contactPerson} maxLength={255} onChange={e => change({ contactPerson: e.target.value })} /></label>
                            <label className="text-sm">Telefone<input className={inputClass} value={draft.phone} maxLength={30} disabled={lockedIdentity} onChange={e => change({ phone: e.target.value })} /></label>
                            <label className="text-sm">Celular<input className={inputClass} value={draft.mobilePhone} maxLength={30} onChange={e => change({ mobilePhone: e.target.value })} /></label>
                            <label className="text-sm">E-mail principal<input type="email" className={inputClass} value={draft.email} maxLength={255} disabled={lockedIdentity} onChange={e => change({ email: e.target.value })} /></label>
                            <label className="text-sm">E-mail de cobrança<input type="email" className={inputClass} value={draft.billingEmail} maxLength={255} onChange={e => change({ billingEmail: e.target.value })} /></label>
                            <label className="text-sm">Site<input className={inputClass} value={draft.website} maxLength={255} disabled={lockedIdentity} onChange={e => change({ website: e.target.value })} /></label>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h3 className="font-semibold text-slate-800">Endereço fiscal da empresa</h3>
                        {draft.primary && <p className="text-xs text-slate-500">O endereço da loja atual vem do cadastro principal acima. Atualize-o lá e recarregue esta página.</p>}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="text-sm">CEP fiscal<input className={inputClass} value={draft.address.zipCode} maxLength={9} inputMode="numeric" disabled={lockedIdentity} onChange={e => changeAddress({ zipCode: e.target.value })} /></label>
                            <label className="text-sm">Cidade fiscal<input className={inputClass} value={draft.address.city} maxLength={255} disabled={lockedIdentity} onChange={e => changeAddress({ city: e.target.value })} /></label>
                            <label className="text-sm">Logradouro fiscal<input className={inputClass} value={draft.address.street} maxLength={255} disabled={lockedIdentity} onChange={e => changeAddress({ street: e.target.value })} /></label>
                            <label className="text-sm">Número fiscal<input className={inputClass} value={draft.address.number} maxLength={30} disabled={lockedIdentity} onChange={e => changeAddress({ number: e.target.value })} /></label>
                            <label className="text-sm">Bairro fiscal<input className={inputClass} value={draft.address.neighborhood} maxLength={255} disabled={lockedIdentity} onChange={e => changeAddress({ neighborhood: e.target.value })} /></label>
                            <label className="text-sm">Complemento fiscal<input className={inputClass} value={draft.address.complement} maxLength={255} disabled={lockedIdentity} onChange={e => changeAddress({ complement: e.target.value })} /></label>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500">A configuração escolhida fica salva por empresa. Confirme o regime, o CRT e a vigência com a contabilidade antes da emissão.</p>
                    <div className="flex flex-wrap gap-3">
                        <button type="button" className={buttonClass} onClick={() => run('save')}>Salvar cadastro fiscal</button>
                        <button type="button" className={buttonClass} disabled={dirty || draft.version === 0 || draft.id === 'new'} onClick={() => run('refresh')}>Atualizar dados tributários</button>
                        <button type="button" className={buttonClass} disabled={dirty || draft.version === 0 || draft.id === 'new'} onClick={checkReadiness}>Verificar dados para emissão</button>
                    </div>
                    {(dirty || draft.version === 0) && <p className="text-xs text-slate-500">Salve o cadastro fiscal antes de atualizar a consulta.</p>}
                </fieldset>
                {readiness && <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm" role="status">
                    <h3 className="font-semibold">Pré-validação cadastral</h3>
                    {readiness.ready ? <p>Dados cadastrais completos para análise fiscal. A emissão ainda exige conferir a situação cadastral da IE, as regras tributárias e o certificado.</p>
                        : <><p>Revise os seguintes dados antes de preparar uma nota:</p><ul className="list-disc pl-5">{readiness.missing.map(item => <li key={item}>{readinessLabels[item] || item}</li>)}</ul></>}
                    {readiness.municipality.status === 'confirmed' && <p>Município confirmado no IBGE: {readiness.municipality.officialName}/{readiness.municipality.officialUf}.</p>}
                    {readiness.municipality.status === 'mismatch' && <p>O código informado corresponde a {readiness.municipality.officialName}/{readiness.municipality.officialUf} no IBGE. Confira a cidade e a UF cadastradas.</p>}
                </div>}
                {draft.lookup && <div className="rounded-lg bg-slate-50 p-4 space-y-2 text-sm">
                    <h3 className="font-semibold">Resultado da consulta do CNPJ</h3>
                    <p>Simples Nacional: <strong>{flag(draft.lookup.simples)}</strong> · MEI: <strong>{flag(draft.lookup.mei)}</strong></p>
                    <p>Fonte: {draft.lookup.source} · Consultado em {new Date(draft.lookup.consultedAt).toLocaleString('pt-BR')}</p>
                    <p>Opção pelo Simples: {draft.lookup.simplesSince || 'Não informada'} · Exclusão: {draft.lookup.simplesUntil || 'Não informada'}</p>
                    <p className="text-xs text-slate-600">A data acima é da consulta, não da atualização da base pública. O resultado pode estar defasado. Não ser optante não distingue Lucro Real de Lucro Presumido.</p>
                    {draft.lookup.suggestedRegime && <button type="button" className={buttonClass} disabled={busy || draft.identityConflict} onClick={() => change({ regime: draft.lookup!.suggestedRegime! })}>Usar sugestão: {regimeName(draft.lookup.suggestedRegime)}</button>}
                    {draft.lookup.municipalityCode && <button type="button" className={`${buttonClass} sm:ml-2`} disabled={busy || draft.identityConflict} onClick={() => change({ municipalityCode: draft.lookup!.municipalityCode! })}>Usar código IBGE consultado</button>}
                    {!!draft.lookup.cnaeActivities?.length && <><p className="font-semibold">Atividades econômicas consultadas</p><ul className="list-disc pl-5">{draft.lookup.cnaeActivities.map(item => <li key={item.code}>{item.primary ? 'Principal' : 'Secundário'}: {item.code} — {item.description}</li>)}</ul><button type="button" className={buttonClass} disabled={busy || draft.identityConflict || (draft.primary && (!draft.cnae || draft.cnae.replace(/\D/g, '').slice(0, 7) !== draft.lookup.cnaeActivities.find(item => item.primary)?.code))} onClick={() => { const activities = draft.lookup!.cnaeActivities; const principal = activities.find(item => item.primary); change({ cnaeActivities: activities, ...(draft.primary ? {} : { cnae: principal?.code || draft.cnae }), mainActivity: principal?.description || draft.mainActivity }); }}>Usar todos os CNAEs consultados</button>{draft.primary && (!draft.cnae || draft.cnae.replace(/\D/g, '').slice(0, 7) !== draft.lookup.cnaeActivities.find(item => item.primary)?.code) && <p className="text-amber-700">O CNAE principal consultado está ausente ou difere do cadastro principal. Confira e salve primeiro os dados da loja.</p>}</>}
                    <p><a className="text-blue-700 underline" href="https://www8.receita.fazenda.gov.br/SimplesNacional/" target="_blank" rel="noopener noreferrer">Conferir opção no portal oficial do Simples Nacional</a></p>
                </div>}
            </>}
        </>}
    </section>;
}
