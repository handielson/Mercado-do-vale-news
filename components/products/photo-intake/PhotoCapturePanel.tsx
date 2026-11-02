import React, { useRef, useState } from 'react';
import { Camera, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { smartphonePhotoIntakeService } from '../../../services/smartphonePhotoIntakeService';
import type { SmartphonePhotoIntake } from '../../../types/smartphone-photo-intake';

interface PhotoCapturePanelProps {
  onProcessed: (intake: SmartphonePhotoIntake) => void;
}

function isDuplicateQueuePhotoError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return /\[VPS\]\s*409\b/.test(message) && message.includes('Esta foto já está na fila');
}

export function PhotoCapturePanel({ onProcessed }: PhotoCapturePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');

  const handleFiles = async (files: FileList | null) => {
    const selected = Array.from(files || []).filter(file => file.type.startsWith('image/'));
    if (selected.length === 0) return;

    setProcessing(true);
    const batchId = crypto.randomUUID();
    let completed = 0;
    let duplicateCount = 0;
    let uploadFailureCount = 0;
    try {
      for (const [index, file] of selected.entries()) {
        setProgress(`Enviando foto ${index + 1} de ${selected.length}...`);
        let created: SmartphonePhotoIntake;
        try {
          created = await smartphonePhotoIntakeService.upload(file, batchId);
        } catch (error) {
          if (isDuplicateQueuePhotoError(error)) {
            duplicateCount += 1;
          } else {
            uploadFailureCount += 1;
            console.error('[PhotoCapturePanel] upload failed:', error);
          }
          continue;
        }
        onProcessed(created);

        setProgress(`Lendo foto ${index + 1} de ${selected.length} com a IA...`);
        try {
          const analyzed = await smartphonePhotoIntakeService.analyze(created.id);
          onProcessed(analyzed);
          completed += 1;
        } catch (error) {
          console.error('[PhotoCapturePanel] analyze failed:', error);
          toast.error(`A foto ${file.name} foi salva, mas a leitura falhou. Ela ficou disponível para tentar novamente.`);
        }
      }
      if (completed > 0) toast.success(`${completed} foto(s) analisada(s) e adicionada(s) à fila.`);
      if (duplicateCount > 0) {
        toast.info(`${duplicateCount} foto(s) repetida(s) já estava(m) na fila e foi(ram) ignorada(s). As demais continuaram normalmente.`);
      }
      if (uploadFailureCount > 0) {
        toast.error(`${uploadFailureCount} foto(s) não pôde(ram) ser enviada(s). As demais continuaram normalmente.`);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível enviar as fotos.');
    } finally {
      setProcessing(false);
      setProgress('');
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <section className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-blue-800">
            <Camera size={21} />
            <h2 className="font-bold">Cadastrar smartphones por foto</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Fotografe a etiqueta da caixa com modelo, cor, memória, serial e IMEIs bem visíveis.
          </p>
          <p className="mt-1 text-xs text-slate-500" data-photo-intake-quality-tip>
            Melhor leitura: fotografe por aqui no celular. Se a foto vier por WhatsApp ou Telegram, envie como arquivo (sem compressão).
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={processing}
            data-photo-intake-camera
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-base font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 md:hidden"
          >
            {processing ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
            {processing ? 'Processando...' : 'Fotografar caixa'}
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={processing}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-5 py-2.5 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 md:border-transparent md:bg-blue-600 md:text-white md:hover:bg-blue-700"
          >
            {processing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            {processing ? 'Processando...' : <><span className="md:hidden">Escolher da galeria</span><span className="hidden md:inline">Selecionar fotos</span></>}
          </button>
        </div>
        {/* Câmera direta: uma foto por vez, em resolução total. */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={event => { void handleFiles(event.target.files); event.currentTarget.value = ''; }}
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={event => void handleFiles(event.target.files)}
        />
      </div>
      {progress && <p className="mt-3 text-sm font-medium text-blue-700">{progress}</p>}
    </section>
  );
}
