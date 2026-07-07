import React from 'react';
import { MessageCircle } from 'lucide-react';
import { WhatsAppAttendantsPanel } from '../../../components/whatsapp/WhatsAppAttendantsPanel';
import { WhatsAppBotSettingsPanel } from '../../../components/whatsapp/WhatsAppBotSettingsPanel';
import { WhatsAppChatGptPanel } from '../../../components/whatsapp/WhatsAppChatGptPanel';
import { WhatsAppInternalBotTester } from '../../../components/whatsapp/WhatsAppInternalBotTester';
import { WhatsAppAutomationTemplatesPanel } from '../../../components/whatsapp/WhatsAppAutomationTemplatesPanel';
import { WhatsAppNumberSwitchPanel } from '../../../components/whatsapp/WhatsAppNumberSwitchPanel';

export default function WhatsAppPage() {
  return (
    <div className="mx-auto max-w-7xl animate-in fade-in duration-500 pb-20">
      <div className="mb-6">
        <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900">
          <MessageCircle className="text-emerald-500" size={28} />
          Centro WhatsApp
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Nova central para Conexao WhatsApp, Atendimento WhatsApp, ChatGPT, ferramentas oficiais e migracao gradual das funcoes do AutoResponder legado.
        </p>
      </div>

      <div className="space-y-4">
        <WhatsAppNumberSwitchPanel />
        <WhatsAppBotSettingsPanel />
        <WhatsAppAutomationTemplatesPanel />
        <WhatsAppChatGptPanel />
        <WhatsAppInternalBotTester />
        <WhatsAppAttendantsPanel />
      </div>
    </div>
  );
}
