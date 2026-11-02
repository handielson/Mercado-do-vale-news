import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ImageUp, Loader2, ScanLine, X } from 'lucide-react';
import { pickScannedValues } from '../../services/deviceIdentifiers.mjs';
import { decodeImageFile, imageDataFrom, loadBarcodeDecoder } from '../../services/barcodeScanner';
import { cn } from '../../utils/cn';

export type ScanKind = 'imei' | 'ean' | 'serial';

const KIND_LABEL: Record<ScanKind, string> = {
  imei: 'IMEI',
  ean: 'código de barras (EAN)',
  serial: 'número de série',
};

interface BarcodeScanButtonProps {
  kind: ScanKind;
  /** Valores lidos, na ordem da etiqueta (de cima para baixo). */
  onScan: (values: string[]) => void;
  /** IMEI: permite "usar os dois" quando a etiqueta mostra IMEI 1 e IMEI 2 juntos. */
  allowPair?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
}

/** Botão 📷 ao lado do campo: abre a câmera e lê o código de barras. */
export const BarcodeScanButton: React.FC<BarcodeScanButtonProps> = ({ kind, onScan, allowPair = false, disabled, className, title }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-barcode-scan={kind}
        disabled={disabled}
        onClick={() => setOpen(true)}
        title={title || `Ler ${KIND_LABEL[kind]} pela câmera`}
        aria-label={title || `Ler ${KIND_LABEL[kind]} pela câmera`}
        className={cn(
          'inline-flex h-11 w-11 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100 disabled:opacity-50',
          className,
        )}
      >
        <ScanLine size={20} />
      </button>
      {open && (
        <BarcodeScannerDialog
          kind={kind}
          allowPair={allowPair}
          onClose={() => setOpen(false)}
          onPick={values => { setOpen(false); onScan(values); }}
        />
      )}
    </>
  );
};

interface DialogProps {
  kind: ScanKind;
  allowPair: boolean;
  onClose: () => void;
  onPick: (values: string[]) => void;
}

function BarcodeScannerDialog({ kind, allowPair, onClose, onPick }: DialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hitsRef = useRef<Map<string, number>>(new Map());
  const doneRef = useRef(false);
  const [status, setStatus] = useState<'starting' | 'scanning' | 'nocamera' | 'reading-photo'>('starting');
  const [message, setMessage] = useState('');
  const [candidates, setCandidates] = useState<string[]>([]);

  const finish = useCallback((values: string[]) => {
    if (doneRef.current || !values.length) return;
    doneRef.current = true;
    try { navigator.vibrate?.(60); } catch { /* sem vibração no iPhone */ }
    onPick(values);
  }, [onPick]);

  // Junta o que foi lido; aceita sozinho quando há um único valor confirmado em 2 leituras.
  const handleValues = useCallback((values: string[]) => {
    if (!values.length || doneRef.current) return;
    const hits = hitsRef.current;
    for (const value of values) hits.set(value, (hits.get(value) || 0) + 1);
    const all = [...hits.keys()];
    setCandidates(current => {
      const merged = [...current];
      for (const value of values) if (!merged.includes(value)) merged.push(value);
      return merged;
    });
    // No IMEI 1 espera um pouco mais: a etiqueta costuma ter IMEI 1 e 2 e o segundo pode aparecer logo depois.
    const needed = kind === 'imei' && allowPair ? 4 : 2;
    if (all.length === 1 && (hits.get(all[0]) || 0) >= needed) finish([all[0]]);
  }, [finish, kind, allowPair]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let busy = false;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const tick = async () => {
      if (cancelled || doneRef.current) return;
      const video = videoRef.current;
      if (!busy && video && video.readyState >= 2) {
        busy = true;
        try {
          const decode = await loadBarcodeDecoder();
          const frame = imageDataFrom(video, video.videoWidth, video.videoHeight, 1600);
          if (frame && !cancelled) handleValues(pickScannedValues(kind, await decode(frame)));
        } catch {
          // quadro ruim: tenta no próximo
        } finally {
          busy = false;
        }
      }
      timer = window.setTimeout(tick, 180);
    };

    (async () => {
      // Carrega o leitor enquanto a câmera abre.
      void loadBarcodeDecoder().catch(() => {});
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('nocamera');
        setMessage('Este navegador não abre a câmera ao vivo. Use "Tirar foto".');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        setStatus('scanning');
        tick();
      } catch {
        setStatus('nocamera');
        setMessage('Não foi possível abrir a câmera (permissão negada?). Use "Tirar foto" ou libere a câmera nas configurações do navegador.');
      }
    })();

    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [kind, handleValues, onClose]);

  const readPhoto = async (file: File | undefined) => {
    if (!file) return;
    setStatus('reading-photo');
    setMessage('');
    try {
      const values = pickScannedValues(kind, await decodeImageFile(file));
      if (!values.length) {
        setMessage(`Não encontrei ${KIND_LABEL[kind]} nessa foto. Chegue mais perto do código e tente de novo.`);
      } else if (values.length === 1) {
        finish(values);
        return;
      } else {
        setCandidates(values);
      }
    } catch {
      setMessage('Não foi possível ler a foto.');
    }
    setStatus(streamRef.current ? 'scanning' : 'nocamera');
  };

  const showPair = kind === 'imei' && allowPair && candidates.length >= 2;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={`Ler ${KIND_LABEL[kind]}`} data-barcode-scanner>
      <div className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <p className="text-base font-semibold">Aponte para o {KIND_LABEL[kind]}</p>
        <button type="button" onClick={onClose} aria-label="Fechar leitor" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
          <X size={22} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" />
        {status === 'scanning' && (
          <div className="pointer-events-none absolute inset-x-6 top-1/2 h-32 -translate-y-1/2 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
            <div className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-red-500" />
          </div>
        )}
        {(status === 'starting' || status === 'reading-photo') && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm">
            <Loader2 className="animate-spin" size={20} /> {status === 'starting' ? 'Abrindo a câmera…' : 'Lendo a foto…'}
          </div>
        )}
      </div>

      <div className="space-y-3 bg-black px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {message && <p className="text-sm text-amber-300">{message}</p>}
        {candidates.length > 0 && (
          <div className="space-y-2" data-barcode-candidates>
            <p className="text-xs text-white/70">{candidates.length > 1 ? 'Encontrei mais de um. Toque no certo:' : 'Encontrado:'}</p>
            {showPair && (
              <button type="button" onClick={() => finish(candidates.slice(0, 2))} className="min-h-[48px] w-full rounded-xl bg-emerald-500 px-3 text-base font-bold text-white">
                Usar os dois (IMEI 1 e IMEI 2)
              </button>
            )}
            {candidates.slice(0, 4).map(value => (
              <button key={value} type="button" onClick={() => finish([value])} className="min-h-[48px] w-full rounded-xl bg-white px-3 font-mono text-base font-bold text-slate-900">
                {value}
              </button>
            ))}
          </div>
        )}
        {status === 'scanning' && candidates.length === 0 && !message && (
          <p className="text-center text-sm text-white/70">Deixe o código dentro do quadro. Lê sozinho.</p>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-semibold">
            {status === 'nocamera' ? <Camera size={18} /> : <ImageUp size={18} />} Tirar foto
          </button>
          <button type="button" onClick={onClose} className="min-h-[48px] rounded-xl bg-white/10 px-4 text-sm font-semibold">Cancelar</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={event => { void readPhoto(event.target.files?.[0]); event.target.value = ''; }} />
      </div>
    </div>,
    document.body,
  );
}
