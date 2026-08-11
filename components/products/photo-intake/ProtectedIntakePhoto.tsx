import React, { useEffect, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import { smartphonePhotoIntakeService } from '../../../services/smartphonePhotoIntakeService';

export function ProtectedIntakePhoto({ intakeId }: { intakeId: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let currentUrl: string | null = null;
    setObjectUrl(null);
    setFailed(false);

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
    <img
      src={objectUrl}
      alt="Foto protegida da etiqueta do aparelho"
      className="aspect-[4/3] w-full rounded-xl bg-slate-100 object-contain"
    />
  );
}
