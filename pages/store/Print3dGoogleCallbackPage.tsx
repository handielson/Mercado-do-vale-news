import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { print3dAccountClient } from '@/services/print3dAccountClient';

export default function Print3dGoogleCallbackPage() {
  const navigate = useNavigate();
  const [code] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('code') || '');
  const [message, setMessage] = useState('Confirmando seu acesso à loja 3D…');
  useEffect(() => {
    let active = true;
    window.history.replaceState({}, '', window.location.pathname);
    void print3dAccountClient.completeGoogle(code).then(() => {
      if (active) navigate('/loja-3d/conta?google=success', { replace: true });
    }).catch(reason => { if (active) setMessage(reason instanceof Error ? reason.message : 'Não foi possível concluir o login.'); });
    return () => { active = false; };
  }, [code, navigate]);
  return <main className="flex min-h-screen items-center justify-center bg-[var(--print3d-surface)] px-5">
    <section className="w-full max-w-md rounded-3xl border border-[#e0e4dd] bg-white p-8">
      <h1 className="text-2xl font-semibold text-[var(--print3d-accent)]">Sua conta 3D</h1>
      <p role="status" className="mt-4 text-[#617067]">{message}</p>
      <Link to="/loja-3d/conta" className="mt-6 inline-block font-semibold text-[var(--print3d-accent)]">Voltar à minha conta</Link>
    </section>
  </main>;
}
