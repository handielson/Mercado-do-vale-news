import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  tiktokShopService,
  type TikTokShopSafeStatus,
} from '../../../../services/tiktokShopService';
import TikTokShopProductPreparation from './TikTokShopProductPreparation';

type Props = {
  productId: string;
  onClose: () => void;
  onSuccess?: (tiktokProductId: string) => void;
};

export default function TikTokShopSyncModal({ productId, onClose, onSuccess }: Props) {
  const [status, setStatus] = useState<TikTokShopSafeStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    tiktokShopService.getStatus()
      .then((result) => {
        if (!cancelled) setStatus(result);
      })
      .catch((error) => {
        console.error('[TikTokShopSyncModal] status error:', error);
        if (!cancelled) toast.error('Nao foi possivel abrir a sincronizacao do TikTok Shop.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Sincronizar produto com TikTok Shop"
    >
      <div
        className="max-h-[94vh] w-full max-w-[1500px] overflow-y-auto rounded-2xl bg-slate-50 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="font-bold text-slate-900">Sincronizar com TikTok Shop</h2>
            <p className="text-xs text-slate-500">Produto, categoria e requisitos sem sair da grade.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label="Fechar sincronizacao TikTok"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="flex min-h-52 items-center justify-center text-sm text-slate-600">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Preparando TikTok Shop...
            </div>
          ) : (
            <TikTokShopProductPreparation
              status={status}
              initialProductId={productId}
              onDraftCreated={onSuccess}
            />
          )}
        </div>
      </div>
    </div>
  );
}
