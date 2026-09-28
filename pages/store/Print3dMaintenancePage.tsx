import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Wrench } from 'lucide-react';

export default function Print3dMaintenancePage({ message }: { message: string }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#f4f1ea] px-5 py-12 text-[#1c2220]">
    <Helmet>
      <title>Manutenção | 3DMV</title>
      <meta name="robots" content="noindex, follow" />
    </Helmet>
    <section className="w-full max-w-xl rounded-[2rem] border border-[#ded8cd] bg-white p-8 text-center shadow-[0_24px_80px_rgba(39,31,20,.10)] sm:p-12">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Wrench size={30} /></div>
      <p className="mt-7 text-sm font-bold uppercase tracking-[.28em] text-violet-700">3DMV</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Estamos em manutenção</h1>
      <p className="mx-auto mt-5 max-w-md text-base leading-7 text-[#667069]">{message || 'Estamos preparando novidades e melhorias. A 3DMV volta em breve.'}</p>
    </section>
  </main>;
}
