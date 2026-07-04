import React from 'react';
import { ExternalLink, MonitorSmartphone, RefreshCw, ShieldAlert } from 'lucide-react';

const PLAY_TEST_URL = 'https://play.google.com/apps/testing/br.com.mercadodovale.totempix';

export function TotemPixUpdatePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col justify-center">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/15 text-blue-200">
              <MonitorSmartphone className="h-7 w-7" />
            </span>
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-blue-200">Totem Pix Mercado do Vale</p>
              <h1 className="text-3xl font-black sm:text-4xl">Atualizar aplicativo</h1>
            </div>
          </div>

          <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-amber-50">
            <div className="flex gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-200" />
              <p className="text-sm leading-relaxed">
                Se a Play Store mostrar "App not available", confirme que o aparelho esta usando o e-mail cadastrado como testador interno e aguarde a liberacao da nova versao.
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border border-white/10 bg-white/10 p-5 text-slate-100">
            <h2 className="text-xl font-black">Passo a passo no aparelho</h2>
            <ol className="space-y-3 text-base leading-relaxed">
              <li><strong>1.</strong> Abra a Play Store com o mesmo e-mail usado na lista de testadores.</li>
              <li><strong>2.</strong> Toque em aceitar/participar do teste, se a Play pedir.</li>
              <li><strong>3.</strong> Volte para a Play Store e toque em atualizar o Totem Pix.</li>
              <li><strong>4.</strong> Depois da instalacao, abra o Totem Pix novamente.</li>
            </ol>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={PLAY_TEST_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-5 py-3 text-base font-black text-white shadow-lg transition-colors hover:bg-blue-400"
            >
              <RefreshCw className="h-5 w-5" />
              Abrir teste interno
            </a>
            <a
              href="/display"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 px-5 py-3 text-base font-black text-white transition-colors hover:bg-white/10"
            >
              Voltar ao display
              <ExternalLink className="h-5 w-5" />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

export default TotemPixUpdatePage;
