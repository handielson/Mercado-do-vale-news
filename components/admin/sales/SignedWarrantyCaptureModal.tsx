import React, { useEffect, useRef, useState } from 'react';
import { Camera, Upload, X } from 'lucide-react';

interface SignedWarrantyCaptureModalProps {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (file: File) => void | Promise<void>;
}

function buildCaptureFileName(): string {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  return `termo-garantia-assinado-${stamp}.jpg`;
}

export function SignedWarrantyCaptureModal({
  open,
  busy = false,
  onClose,
  onConfirm,
}: SignedWarrantyCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function clearPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setSelectedFile(null);
  }

  useEffect(() => {
    if (!open) {
      stopCamera();
      clearPreview();
      setCameraError('');
    }
    return () => {
      stopCamera();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [open]);

  if (!open) return null;

  async function startCamera() {
    setCameraError('');
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : 'Não foi possível abrir a câmera.');
    }
  }

  function setPreviewFile(file: File) {
    clearPreview();
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function captureFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError('Câmera ainda não carregou a imagem.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError('Não foi possível capturar a foto.');
        return;
      }
      setPreviewFile(new File([blob], buildCaptureFileName(), { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPreviewFile(file);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Digitalizar termo assinado</h3>
            <p className="text-sm text-slate-500">Capture uma foto ou selecione uma imagem JPEG/PNG.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
            {previewUrl ? (
              <img src={previewUrl} alt="Prévia do termo assinado" className="max-h-[55vh] w-full object-contain" />
            ) : (
              <video ref={videoRef} playsInline autoPlay muted className="max-h-[55vh] w-full bg-slate-950 object-contain" />
            )}
          </div>

          {cameraError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {cameraError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={startCamera} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              <Camera size={16} /> Abrir câmera
            </button>
            <button type="button" onClick={captureFrame} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              Fotografar
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Upload size={16} /> Celular/arquivo
              <input type="file" accept="image/jpeg,image/png" capture="environment" onChange={handleFile} className="hidden" />
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Escolher arquivo
              <input type="file" accept="image/jpeg,image/png" onChange={handleFile} className="hidden" />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={() => selectedFile && onConfirm(selectedFile)} disabled={!selectedFile || busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {busy ? 'Enviando...' : 'Confirmar envio'}
          </button>
        </div>
      </div>
    </div>
  );
}
