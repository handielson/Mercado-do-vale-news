import React from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { standalonePixService } from '../../services/standalonePixService';
import type { StandalonePixPayment } from '../../types/standalonePix';
import { formatStandalonePixStatus, isStandalonePixPayable } from '../../types/standalonePix';

function formatCurrency(cents: number): string {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PublicPixPage() {
  const { token = '' } = useParams();
  const [pix, setPix] = React.useState<StandalonePixPayment | null>(null);
  const [loading, setLoading] = React.useState(true);

  const loadPix = React.useCallback(async () => {
    setLoading(true);
    try {
      setPix(await standalonePixService.getPublic(token));
    } catch (error: any) {
      toast.error(error?.message || 'Pix nao encontrado');
      setPix(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    void loadPix();
  }, [loadPix]);

  async function copyCode() {
    if (!pix?.qr_code) {
      toast.error('Pix copia e cola indisponivel');
      return;
    }
    await navigator.clipboard.writeText(pix.qr_code);
    toast.success('Copiar codigo Pix realizado');
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <section className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-black text-slate-900">Mercado do Vale</h1>
          <p className="text-sm text-slate-500">Pix avulso</p>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Carregando Pix...</div>
        ) : pix ? (
          <div className="space-y-5">
            <div className="text-center">
              <div className="text-3xl font-black text-slate-900">{formatCurrency(pix.amount)}</div>
              <div className="mt-1 text-sm font-semibold text-cyan-700">{formatStandalonePixStatus(pix)}</div>
              {pix.expires_at && <div className="mt-1 text-xs text-slate-500">Expira em {new Date(pix.expires_at).toLocaleString('pt-BR')}</div>}
            </div>

            <div className="flex justify-center rounded border border-slate-200 bg-slate-50 p-4">
              {pix.qr_code_base64 && isStandalonePixPayable(pix) ? (
                <img src={`data:image/png;base64,${pix.qr_code_base64}`} alt="QR Code Pix" className="h-64 w-64 object-contain" />
              ) : (
                <div className="flex h-64 w-64 items-center justify-center text-center text-sm font-semibold text-slate-500">
                  Cancelado por falta de pagamento
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 text-sm font-bold text-slate-800">Pix copia e cola</div>
              <p className="break-all rounded bg-slate-50 p-3 font-mono text-xs text-slate-600">{pix.qr_code || 'Codigo indisponivel'}</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button onClick={copyCode} className="inline-flex flex-1 items-center justify-center gap-2 rounded bg-cyan-600 px-4 py-3 text-sm font-bold text-white">
                <Copy size={16} /> Copiar codigo Pix
              </button>
              <button onClick={loadPix} className="inline-flex items-center justify-center gap-2 rounded border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
                <RefreshCw size={16} /> Atualizar
              </button>
            </div>
          </div>
        ) : (
          <div className="py-16 text-center text-sm text-slate-500">Pix nao encontrado.</div>
        )}
      </section>
    </main>
  );
}
