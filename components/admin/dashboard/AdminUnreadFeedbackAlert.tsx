import React from 'react';
import { MessageSquareDashed } from 'lucide-react';

interface AdminUnreadFeedbackAlertProps {
  unreadFeedbacks: number;
  onClick: () => void;
}

export const AdminUnreadFeedbackAlert: React.FC<AdminUnreadFeedbackAlertProps> = ({ unreadFeedbacks, onClick }) => {
  if (unreadFeedbacks <= 0) return null;

  return (
    <div
      onClick={onClick}
      className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm cursor-pointer hover:bg-amber-100 transition-colors flex items-start gap-3"
    >
      <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
        <MessageSquareDashed size={20} />
      </div>
      <div>
        <h3 className="text-amber-800 font-bold text-sm">Atenção: Novas Mensagens!</h3>
        <p className="text-amber-700 text-sm mt-0.5">
          Você tem <strong>{unreadFeedbacks}</strong> {unreadFeedbacks === 1 ? 'mensagem' : 'mensagens'} aguardando leitura na sua caixa de entrada. Clique aqui para ler.
        </p>
      </div>
    </div>
  );
};
