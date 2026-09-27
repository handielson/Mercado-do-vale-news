import { type FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { print3dAccountClient } from '@/services/print3dAccountClient';

export default function Print3dAccountActionPage() {
  const location = useLocation();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const demo = params.get('demo') === '1';
  const verify = location.pathname.endsWith('/confirmar-email');
  const previewPath = location.pathname.startsWith('/loja-3d/');
  const hostname = typeof window === 'undefined' ? '' : window.location.hostname.toLowerCase();
  const allowedHost = ['3dmv.com.br', 'www.3dmv.com.br', 'localhost', '127.0.0.1'].includes(hostname);
  const [state, setState] = useState<'waiting' | 'success' | 'error'>(verify ? 'waiting' : 'success');
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (!allowedHost && !previewPath) return <Navigate to="/" replace />;
  const confirmEmail = () => {
    if (demo) { setState('success'); setMessage('Prévia: nenhum e-mail foi confirmado.'); return; }
    if (!token) { setState('error'); setMessage('O link de confirmação está incompleto.'); return; }
    setBusy(true);
    print3dAccountClient.verifyEmail(token).then(() => {
      setState('success'); setMessage('E-mail confirmado. Você já pode entrar na sua conta 3D.');
    }).catch(reason => { setState('waiting'); setMessage(reason instanceof Error ? reason.message : 'Não foi possível confirmar. Tente novamente.'); })
      .finally(() => setBusy(false));
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setMessage('');
    if (demo) { setMessage('Prévia: nenhuma senha foi alterada.'); setBusy(false); return; }
    print3dAccountClient.resetPassword(token, password).then(() => {
      setState('success'); setMessage('Senha atualizada. Entre na sua conta 3D.');
    }).catch(reason => { setState('error'); setMessage(reason instanceof Error ? reason.message : 'Não foi possível redefinir a senha. Tente novamente.'); })
      .finally(() => setBusy(false));
  };
  return <main className="flex min-h-screen items-center justify-center bg-[var(--print3d-surface)] px-5 py-12 text-[#1f2925]">
    <section className="w-full max-w-md rounded-[24px] border border-[#e0e4dd] bg-white p-8 shadow-[0_20px_60px_rgba(32,47,38,.07)]">
      <Link to={demo ? '/loja-3d?demo=1' : '/loja-3d'} className="text-[22px] font-bold tracking-[-.07em]">3D <span className="font-normal">do Vale</span><span className="text-[var(--print3d-accent)]">.</span></Link>
      {verify ? <><div className="mt-9">{state === 'error' ? <XCircle size={36} className="text-[#b34f35]" /> : <CheckCircle2 size={36} className="text-[#577d6a]" />}</div><h1 className="mt-5 text-2xl font-semibold">{state === 'waiting' ? 'Confirmar e-mail' : state === 'success' ? 'E-mail confirmado' : 'Não foi possível confirmar'}</h1><p className="mt-3 text-sm leading-6 text-[#617067]">{message || 'Confirme para ativar o acesso à sua conta 3D.'}</p>{state === 'waiting' && <button type="button" disabled={busy} onClick={confirmEmail} className="mt-6 w-full rounded-xl bg-[var(--print3d-accent)] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50">Confirmar e-mail</button>}</>
        : <><h1 className="mt-9 text-2xl font-semibold">Nova senha</h1><p className="mt-3 text-sm text-[#617067]">Escolha uma senha de pelo menos 12 caracteres.</p>{!token && !demo ? <p className="mt-5 text-sm text-[#b34f35]">O link de redefinição está incompleto.</p> : <form onSubmit={submit} className="mt-6"><label htmlFor="new-password" className="mb-2 block text-sm font-medium">Nova senha</label><input id="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-xl border border-[#d9dcd7] px-4 py-3 outline-none focus:border-[var(--print3d-accent)]" /><button disabled={busy} className="mt-5 w-full rounded-xl bg-[var(--print3d-accent)] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50">Salvar nova senha</button></form>}{message && <p role="status" className={`mt-5 text-sm ${state === 'error' ? 'text-[#b34f35]' : 'text-[#305842]'}`}>{message}</p>}</>}
      <Link to={demo ? '/loja-3d/conta?demo=1' : '/loja-3d/conta'} className="mt-8 inline-block text-sm font-semibold text-[var(--print3d-accent)]">Voltar à minha conta</Link>
    </section>
  </main>;
}
