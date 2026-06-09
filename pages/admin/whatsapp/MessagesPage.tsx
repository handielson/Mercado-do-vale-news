import React from 'react';
import { MessageCircle } from 'lucide-react';
import { WhatsAppConversationsPanel } from '../../../components/whatsapp/WhatsAppConversationsPanel';

export default function WhatsAppMessagesPage() {
  return (
    <div className="mx-auto max-w-7xl animate-in fade-in duration-500 pb-20">
      <div className="mb-6">
        <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900">
          <MessageCircle className="text-emerald-500" size={28} />
          Mensagens WhatsApp
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Atendimento WhatsApp com conversas ativas, pausas, historico, tags de envio e mensagens manuais em uma tela propria.
        </p>
      </div>

      <WhatsAppConversationsPanel />
    </div>
  );
}
