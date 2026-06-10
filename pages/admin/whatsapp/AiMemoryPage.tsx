import React from 'react';
import { Brain } from 'lucide-react';
import { WhatsAppAiMemoryPanel } from '../../../components/whatsapp/WhatsAppAiMemoryPanel';

export default function WhatsAppAiMemoryPage() {
  return (
    <div className="mx-auto max-w-7xl animate-in fade-in duration-500 pb-20">
      <div className="mb-6">
        <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900">
          <Brain className="text-emerald-500" size={28} />
          Memoria IA WhatsApp
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Contexto recente e instrucoes dinamicas para o ChatGPT responder cada cliente com mais continuidade.
        </p>
      </div>

      <WhatsAppAiMemoryPanel />
    </div>
  );
}
