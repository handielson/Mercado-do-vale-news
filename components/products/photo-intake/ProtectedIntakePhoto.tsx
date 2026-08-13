import React, { useEffect, useState } from 'react';
import { ImageOff, Loader2, ZoomIn } from 'lucide-react';
import { ImageZoomModal } from '../../catalog/ImageZoomModal';
import { smartphonePhotoIntakeService } from '../../../services/smartphonePhotoIntakeService';

export function ProtectedIntakePhoto({ intakeId }: { intakeId: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    let active = true;
    let currentUrl: string | null = null;
    setObjectUrl(null);
    setFailed(false);
    setZoomed(false);

    smartphonePhotoIntakeService.loadProtectedPhoto(intakeId)
      .then(blob => {
        if (!active) return;
        currentUrl = URL.createObjectURL(blob);
        setObjectUrl(currentUrl);
      })
      .catch(error => {
        console.error('[ProtectedIntakePhoto] failed:', error);
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [intakeId]);

  if (failed) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <div className="text-center"><ImageOff className="mx-auto" /><p className="mt-2 text-xs">Foto protegida indisponível</p></div>
      </div>
    );
  }

  if (!objectUrl) {
    return <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-slate-100"><Loader2 className="animate-spin text-slate-400" /></div>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        className="group relative block w-full overflow-hidden rounded-xl bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-label="Abrir foto da etiqueta em tamanho ampliado"
        title="Clique para ampliar a foto"
      >
        <img
          src={objectUrl}
          alt="Foto protegida da etiqueta do aparelho"
          className="aspect-[4/3] w-full object-contain transition-transform group-hover:scale-[1.02]"
        />
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-slate-950/75 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
          <ZoomIn size={15} /> Ampliar
        </span>
      </button>
      {zoomed && (
        <ImageZoomModal
          imageUrl={objectUrl}
          title="Foto da etiqueta do aparelho"
          onClose={() => setZoomed(false)}
        />
      )}
    </>
  );
}
