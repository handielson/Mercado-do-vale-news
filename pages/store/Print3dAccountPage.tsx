import { type FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Mail, MessageCircle, ShieldCheck } from 'lucide-react';
import { print3dAccountClient } from '@/services/print3dAccountClient';
import { readCheckoutCart } from '@/services/print3dCheckoutClient';
import { GoogleButton } from '@/components/auth/GoogleButton';

type Channel = 'email' | 'whatsapp';
type LoginChannel = 'email' | 'phone' | 'cpf';
type Step = 'details' | 'code' | 'email-pending' | 'signed-in' | 'profile-code' | 'forgot' | 'forgot-code' | 'forgot-new';

const inputClass = 'w-full rounded-xl border border-[#d9dcd7] bg-white px-4 py-3 text-[15px] text-[#1f2925] outline-none transition focus:border-[var(--print3d-accent)] focus:ring-2 focus:ring-[#577d6a]/10';
const labelClass = 'mb-1.5 block text-sm font-medium text-[#35443c]';
const buttonClass = 'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--print3d-accent)] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#193b2c] disabled:cursor-not-allowed disabled:opacity-50';

export default function Print3dAccountPage() {
  const [params] = useSearchParams();
  const demo = params.get('demo') === '1';
  const [view, setView] = useState<'register' | 'login'>('register');
  const [channel, setChannel] = useState<Channel>('email');
  const [loginChannel, setLoginChannel] = useState<LoginChannel>('email');
  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [resetProof, setResetProof] = useState('');
  const [resetChannel, setResetChannel] = useState<Channel>('email');
  const [busy, setBusy] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [error, setError] = useState(params.has('google_error') ? 'Não foi possível concluir o acesso com Google. Tente novamente.' : '');
  const [notice, setNotice] = useState(params.get('google') === 'success' ? 'Google confirmado na sua conta 3D.' : '');
  const [googleEnabled, setGoogleEnabled] = useState(demo);

  useEffect(() => {
    if (demo) return;
    let active = true;
    void print3dAccountClient.googleConfig().then(config => { if (active) setGoogleEnabled(config.configured); }).catch(() => {});
    return () => { active = false; };
  }, [demo]);

  useEffect(() => {
    if (demo) return;
    let active = true;
    void (async () => {
      const customer = await print3dAccountClient.me();
      if (!active || !customer) return;
      const status = await print3dAccountClient.phoneStatus().catch(() => ({ verified: false, phone: null }));
      if (!active) return;
      setPhoneVerified(status.verified);
      if (status.phone) setPhone(status.phone);
      setStep('signed-in');
    })().catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível consultar sua conta. Tente novamente.'); });
    return () => { active = false; };
  }, [demo]);

  const changeView = (next: 'register' | 'login') => {
    setView(next); setStep('details'); setError(''); setNotice(''); setCode(''); setChallengeId('');
  };
  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await work(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível continuar.'); }
    finally { setBusy(false); }
  };
  const register = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (demo) { setNotice('Prévia da conta: nenhum cadastro ou mensagem foi enviado.'); return; }
      if (channel === 'email') {
        await print3dAccountClient.registerEmail(name, email, password, cpf || undefined);
        setStep('email-pending');
      } else {
        const challenge = await print3dAccountClient.requestRegistrationPhoneCode(phone);
        setChallengeId(challenge.challenge_id);
        setStep('code');
      }
    });
  };
  const google = (link = false) => void run(async () => {
    if (demo) { setNotice('Prévia: o login Google será exclusivo da loja 3D. Nenhuma conta foi acessada.'); return; }
    await print3dAccountClient.beginGoogle(link);
  });
  const confirmRegistrationPhone = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (demo) { setNotice('Prévia: nenhum código foi verificado.'); return; }
      const proof = await print3dAccountClient.verifyRegistrationPhoneCode(challengeId, code);
      await print3dAccountClient.registerWhatsApp(name, phone, password, proof.phone_verification_token, cpf || undefined);
      setPhoneVerified(true);
      setStep('signed-in');
    });
  };
  const login = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (demo) { setNotice('Prévia da conta: nenhum login foi realizado.'); return; }
      await print3dAccountClient.login(loginChannel, loginChannel === 'email' ? email : loginChannel === 'phone' ? phone : cpf, password);
      const status = await print3dAccountClient.phoneStatus().catch(() => ({ verified: false, phone: null }));
      setPhoneVerified(status.verified);
      if (status.phone) setPhone(status.phone);
      setStep('signed-in');
    });
  };
  const startProfilePhone = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (demo) { setNotice('Prévia: nenhum código foi enviado.'); return; }
      const challenge = await print3dAccountClient.requestProfilePhoneCode(phone);
      setChallengeId(challenge.challenge_id);
      setStep('profile-code');
    });
  };
  const confirmProfilePhone = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (demo) { setNotice('Prévia: nenhum telefone foi alterado.'); return; }
      const proof = await print3dAccountClient.verifyProfilePhoneCode(challengeId, code);
      await print3dAccountClient.confirmProfilePhone(phone, proof.phone_verification_token);
      setPhoneVerified(true);
      setStep('signed-in'); setNotice('WhatsApp confirmado. Agora você poderá solicitar encomendas quando o checkout estiver disponível.');
    });
  };
  const startReset = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (demo) { setNotice('Prévia: nenhuma instrução de recuperação foi enviada.'); return; }
      if (resetChannel === 'email') {
        await print3dAccountClient.requestPasswordReset(email);
        setNotice('Se existir uma conta com esse e-mail, enviaremos o link de recuperação.');
      } else {
        const challenge = await print3dAccountClient.requestPhonePasswordReset(phone);
        if ('challenge_id' in challenge) { setChallengeId(challenge.challenge_id); setStep('forgot-code'); }
      }
    });
  };
  const verifyResetCode = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (demo) { setNotice('Prévia: nenhum código foi verificado.'); return; }
      const proof = await print3dAccountClient.verifyPhonePasswordReset(phone, challengeId, code);
      setResetProof(proof.phone_verification_token); setPassword(''); setStep('forgot-new');
    });
  };
  const finishPhoneReset = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (demo) { setNotice('Prévia: nenhuma senha foi alterada.'); return; }
      await print3dAccountClient.resetPasswordWithPhone(phone, resetProof, password);
      changeView('login'); setNotice('Senha atualizada. Entre com seu telefone ou CPF.');
    });
  };

  return <div className="min-h-screen bg-[var(--print3d-surface)] text-[#1f2925]">
    <header className="border-b border-[#e0e4dd] bg-white">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link to={demo ? '/loja-3d?demo=1' : '/loja-3d'} className="text-[22px] font-bold tracking-[-.07em]">3DMV<span className="text-[var(--print3d-accent)]">.</span></Link>
        <Link to={demo ? '/loja-3d?demo=1' : '/loja-3d'} className="inline-flex items-center gap-2 text-sm font-medium text-[#53665a] hover:text-[var(--print3d-accent)]"><ArrowLeft size={16} /> Voltar à loja</Link>
      </div>
    </header>
    <main className="mx-auto grid max-w-6xl gap-12 px-5 py-12 sm:px-8 md:grid-cols-[1fr_440px] md:py-20">
      <div className="max-w-lg pt-2">
        <span className="text-xs font-bold uppercase tracking-[.2em] text-[#b66843]">Sua conta 3D</span>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Comece do seu jeito.</h1>
        <p className="mt-5 text-base leading-7 text-[#617067]">{googleEnabled ? 'Crie sua conta com Google, e-mail ou WhatsApp. Você pode confirmar seu WhatsApp depois.' : 'Escolha e-mail ou WhatsApp para criar sua conta. Confirme o canal escolhido para começar. Se escolher e-mail, poderá confirmar seu WhatsApp depois.'}</p>
        <div className="mt-9 space-y-5 text-sm text-[#43564a]">
          <p className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-[#577d6a]" size={21} /> Sua conta e seus pedidos ficam separados do Mercado do Vale.</p>
          <p className="flex items-start gap-3"><MessageCircle className="mt-0.5 shrink-0 text-[#577d6a]" size={21} /> Para encomendar uma peça, o WhatsApp precisa estar confirmado.</p>
        </div>
        {demo && <p className="mt-9 rounded-xl border border-[#d7ded5] bg-white px-4 py-3 text-sm text-[#52665a]">Esta é uma prévia visual. Nenhuma conta será criada e nenhum código será enviado.</p>}
      </div>
      <div className="rounded-[24px] border border-[#e0e4dd] bg-white p-6 shadow-[0_20px_60px_rgba(32,47,38,.07)] sm:p-8">
        {step === 'email-pending' ? <div className="py-8 text-center"><Mail className="mx-auto text-[#577d6a]" size={38} /><h2 className="mt-5 text-2xl font-semibold">Confira seu e-mail</h2><p className="mt-3 text-sm leading-6 text-[#617067]">Enviamos um link para confirmar sua conta. Após confirmar, você poderá entrar.</p><button className="mt-6 text-sm font-semibold text-[var(--print3d-accent)]" onClick={() => changeView('login')}>Ir para o login</button></div>
          : step === 'signed-in' ? <div className="py-5"><div className="flex items-center gap-3 text-[var(--print3d-accent)]"><Check size={24} /><h2 className="text-2xl font-semibold">Conta pronta</h2></div><p className="mt-3 text-sm leading-6 text-[#617067]">{phoneVerified ? 'Seu WhatsApp está confirmado para futuras encomendas.' : 'Seu cadastro 3D está separado da conta do Mercado do Vale. Antes de encomendar, confirme seu WhatsApp.'}</p>{!phoneVerified && <form onSubmit={startProfilePhone} className="mt-7"><label className={labelClass} htmlFor="profile-phone">Confirmar WhatsApp</label><input id="profile-phone" className={inputClass} value={phone} onChange={event => setPhone(event.target.value)} placeholder="(87) 99999-9999" required /><button disabled={busy} className={`${buttonClass} mt-4`}>Enviar código <ArrowRight size={16} /></button></form>}<button type="button" className="mt-6 text-sm font-semibold text-[var(--print3d-accent)]" onClick={() => { print3dAccountClient.logout(); setPassword(''); setCode(''); setPhoneVerified(false); changeView('login'); }}>Sair da conta</button></div>
            : step === 'code' || step === 'profile-code' ? <div><h2 className="text-2xl font-semibold tracking-[-.03em]">Confirme seu WhatsApp</h2><p className="mt-2 text-sm text-[#617067]">Digite o código de seis dígitos enviado para {phone}. Ele vale por 10 minutos.</p><form onSubmit={step === 'code' ? confirmRegistrationPhone : confirmProfilePhone} className="mt-7"><label className={labelClass} htmlFor="phone-code">Código de confirmação</label><input id="phone-code" className={inputClass} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required /><button disabled={busy || code.length !== 6} className={`${buttonClass} mt-5`}>Confirmar <ArrowRight size={16} /></button></form><button type="button" onClick={() => setStep(step === 'code' ? 'details' : 'signed-in')} className="mt-5 text-sm text-[#617067]">Voltar e corrigir o número</button></div>
              : step === 'forgot' || step === 'forgot-code' || step === 'forgot-new' ? <div><h2 className="text-2xl font-semibold">Recuperar senha</h2><p className="mt-2 text-sm leading-6 text-[#617067]">{step === 'forgot' ? 'Escolha como deseja receber as instruções.' : step === 'forgot-code' ? `Digite o código enviado para ${phone}.` : 'Crie uma nova senha para sua conta 3D.'}</p>{step === 'forgot' && <><div className="mt-6 grid grid-cols-2 gap-2">{(['email', 'whatsapp'] as Channel[]).map(value => <button key={value} type="button" onClick={() => setResetChannel(value)} className={`rounded-xl border px-3 py-3 text-sm font-medium ${resetChannel === value ? 'border-[var(--print3d-accent)] bg-[var(--print3d-surface)] text-[var(--print3d-accent)]' : 'border-[#e0e4dd] text-[#617067]'}`}>{value === 'email' ? 'E-mail' : 'WhatsApp'}</button>)}</div><form onSubmit={startReset} className="mt-6"><label className={labelClass} htmlFor="reset-contact">{resetChannel === 'email' ? 'E-mail' : 'WhatsApp com DDD'}</label><input id="reset-contact" className={inputClass} type={resetChannel === 'email' ? 'email' : 'tel'} value={resetChannel === 'email' ? email : phone} onChange={event => resetChannel === 'email' ? setEmail(event.target.value) : setPhone(event.target.value)} required /><button disabled={busy} className={`${buttonClass} mt-5`}>Enviar instruções</button></form></>}{step === 'forgot-code' && <form onSubmit={verifyResetCode} className="mt-6"><label className={labelClass} htmlFor="reset-code">Código de seis dígitos</label><input id="reset-code" className={inputClass} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required /><button disabled={busy || code.length !== 6} className={`${buttonClass} mt-5`}>Verificar código</button></form>}{step === 'forgot-new' && <form onSubmit={finishPhoneReset} className="mt-6"><label className={labelClass} htmlFor="reset-new-password">Nova senha</label><input id="reset-new-password" className={inputClass} type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required /><button disabled={busy} className={`${buttonClass} mt-5`}>Salvar nova senha</button></form>}<button type="button" className="mt-5 text-sm font-medium text-[var(--print3d-accent)]" onClick={() => changeView('login')}>Voltar ao login</button></div>
              : <><div className="grid grid-cols-2 rounded-xl bg-[#f1f3ee] p-1 text-sm font-semibold"><button type="button" onClick={() => changeView('register')} className={`rounded-lg py-2.5 ${view === 'register' ? 'bg-white text-[var(--print3d-accent)] shadow-sm' : 'text-[#69766d]'}`}>Criar conta</button><button type="button" onClick={() => changeView('login')} className={`rounded-lg py-2.5 ${view === 'login' ? 'bg-white text-[var(--print3d-accent)] shadow-sm' : 'text-[#69766d]'}`}>Entrar</button></div>
                <h2 className="mt-7 text-2xl font-semibold tracking-[-.03em]">{view === 'register' ? 'Crie sua conta' : 'Bem-vindo de volta'}</h2>
                <p className="mt-2 text-sm text-[#617067]">{view === 'register' ? 'Escolha como prefere confirmar seu cadastro.' : 'Entre com e-mail, WhatsApp ou CPF cadastrado.'}</p>
                {googleEnabled && <div className="mt-6"><GoogleButton loading={busy} onClick={() => google()} /><p className="mt-4 text-center text-xs text-[#7c8880]">ou continue com seus dados</p></div>}
                <div className="mt-6 grid grid-cols-2 gap-2">{(view === 'register' ? ['email', 'whatsapp'] as Channel[] : ['email', 'phone', 'cpf'] as LoginChannel[]).map(value => <button type="button" key={value} onClick={() => view === 'register' ? setChannel(value as Channel) : setLoginChannel(value as LoginChannel)} className={`rounded-xl border px-3 py-3 text-sm font-medium ${(view === 'register' ? channel : loginChannel) === value ? 'border-[var(--print3d-accent)] bg-[var(--print3d-surface)] text-[var(--print3d-accent)]' : 'border-[#e0e4dd] text-[#617067]'}`}>{value === 'email' ? 'E-mail' : value === 'cpf' ? 'CPF' : 'WhatsApp'}</button>)}</div>
                <form onSubmit={view === 'register' ? register : login} className="mt-6 space-y-4">
                  {view === 'register' && <div><label className={labelClass} htmlFor="account-name">Nome completo</label><input id="account-name" className={inputClass} value={name} onChange={event => setName(event.target.value)} autoComplete="name" required /></div>}
                  {(view === 'register' ? channel === 'email' : loginChannel === 'email') && <div><label className={labelClass} htmlFor="account-email">E-mail</label><input id="account-email" className={inputClass} type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></div>}
                  {(view === 'register' ? channel === 'whatsapp' : loginChannel === 'phone') && <div><label className={labelClass} htmlFor="account-phone">WhatsApp com DDD</label><input id="account-phone" className={inputClass} value={phone} onChange={event => setPhone(event.target.value)} autoComplete="tel" placeholder="(87) 99999-9999" required /></div>}
                  {(view === 'register' || loginChannel === 'cpf') && <div><label className={labelClass} htmlFor="account-cpf">CPF {view === 'register' && <span className="font-normal text-[#7c8880]">(opcional)</span>}</label><input id="account-cpf" className={inputClass} value={cpf} onChange={event => setCpf(event.target.value)} inputMode="numeric" autoComplete="off" required={view === 'login' && loginChannel === 'cpf'} /></div>}
                  <div><label className={labelClass} htmlFor="account-password">Senha</label><input id="account-password" className={inputClass} type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={view === 'register' ? 'new-password' : 'current-password'} minLength={view === 'register' ? 12 : undefined} maxLength={128} required /></div>
                  <button disabled={busy} className={buttonClass}>{view === 'register' ? channel === 'whatsapp' ? 'Enviar código' : 'Criar conta com e-mail' : 'Entrar'} <ArrowRight size={16} /></button>
                </form>
                {view === 'login' && <button type="button" onClick={() => { setStep('forgot'); setError(''); setNotice(''); }} className="mt-5 text-sm font-medium text-[var(--print3d-accent)]">Esqueceu sua senha?</button>}
              </>}
        {step === 'signed-in' && <>{readCheckoutCart().length > 0 && <Link to="/loja-3d/checkout" className="mt-5 block rounded-xl bg-[var(--print3d-accent)] px-4 py-3 text-center font-semibold text-white">Retomar minha compra</Link>}<Link to="/loja-3d/pedidos" className="mt-5 block rounded-xl border border-[var(--print3d-accent)] px-4 py-3 text-center font-semibold text-[var(--print3d-accent)]">Meus pedidos e pagamentos</Link><Link to="/loja-3d/conta/producao" className="mt-3 block text-center font-semibold text-[var(--print3d-accent)]">Acompanhar produção dos meus pedidos</Link></>}
        {step === 'signed-in' && googleEnabled && <div className="mt-5"><GoogleButton loading={busy} text="Vincular Google" onClick={() => google(true)} /><p className="mt-3 text-xs text-[#617067]">Use a mesma conta Google nos próximos acessos à loja 3D.</p></div>}
        {error && <p role="alert" className="mt-5 rounded-xl bg-[#fff0ea] px-4 py-3 text-sm text-[#a2482b]">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-xl bg-[#edf5ee] px-4 py-3 text-sm text-[#305842]">{notice}</p>}
      </div>
    </main>
  </div>;
}
