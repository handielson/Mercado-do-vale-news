import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import type { RegisteredCheckState } from '../../services/registeredIdentifier';

/** Aviso logo abaixo do campo: "Já cadastrado em 05/08/2026 — vendido (Realme C71) · Ver aparelho". */
export const RegisteredIdentifierNotice: React.FC<{ check: RegisteredCheckState }> = ({ check }) => {
  if (check.state === 'checking') {
    return (
      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500" data-registered-check="checking">
        <Loader2 size={12} className="animate-spin" /> Conferindo se já está cadastrado…
      </p>
    );
  }
  if (check.state !== 'found') return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-700" role="alert" data-registered-check="found">
      <AlertTriangle size={14} className="shrink-0" />
      <span className="min-w-0">{check.info.message}</span>
      <Link to={check.info.link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[32px] items-center gap-1 underline">
        Ver aparelho <ExternalLink size={12} />
      </Link>
    </div>
  );
};
