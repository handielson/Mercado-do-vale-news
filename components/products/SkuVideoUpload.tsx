import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Video, VideoOff } from 'lucide-react';
import { toast } from 'sonner';
import { vpsApiService } from '../../services/vpsApiService';
import { productVideoFileName, uploadProductVideo, validateProductVideo } from '../../services/productVideoUpload';

// sku-video-upload-v1: envio do vídeo de cada variação direto da Página do Produto.
// O arquivo é sempre gravado como <SKU>.mp4 no Synology (padrão lido pelo site e pelos marketplaces),
// qualquer que seja o nome escolhido no celular/computador.
type State = { checking: boolean; exists: boolean; url: string | null; uploading: boolean; progress: number; message: string };

export const SkuVideoUpload: React.FC<{ sku?: string | null }> = ({ sku }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const code = String(sku || '').trim().replace(/\s+/g, '');
    const [state, setState] = useState<State>({ checking: Boolean(code), exists: false, url: null, uploading: false, progress: 0, message: '' });

    useEffect(() => {
        if (!code) return;
        let alive = true;
        vpsApiService.checkVideoBySku(code)
            .then(info => { if (alive) setState(s => ({ ...s, checking: false, exists: Boolean(info?.exists), url: info?.url || null })); })
            .catch(() => { if (alive) setState(s => ({ ...s, checking: false })); });
        return () => { alive = false; };
    }, [code]);

    if (!code) return null;

    const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        let target: string;
        try {
            validateProductVideo(file);
            target = productVideoFileName(code);
        } catch (error: any) {
            toast.error(error?.message || 'Vídeo inválido');
            return;
        }
        if (state.exists && !window.confirm(`Já existe um vídeo para ${code}. Substituir pelo arquivo "${file.name}"?`)) return;
        setState(s => ({ ...s, uploading: true, progress: 0, message: 'Enviando vídeo...' }));
        try {
            const url = await uploadProductVideo(file, code, { onProgress: (progress, message) => setState(s => ({ ...s, progress, message })) });
            const confirmed = await vpsApiService.checkVideoBySku(code, { noCache: true }).catch(() => null);
            setState(s => ({ ...s, uploading: false, exists: true, url: confirmed?.url || url, progress: 100, message: '' }));
            toast.success(`Vídeo de ${code} enviado`, {
                description: file.name === target ? undefined : `"${file.name}" foi renomeado para ${target}`,
            });
        } catch (error: any) {
            setState(s => ({ ...s, uploading: false, progress: 0, message: '' }));
            toast.error('Falha no envio do vídeo', { description: error?.message || 'Erro desconhecido' });
        }
    };

    const segment = 'inline-flex items-center gap-1 border-l border-slate-200 px-2 py-1 text-xs font-semibold';
    return (
        <>
            <input ref={inputRef} type="file" accept="video/mp4,.mp4" className="hidden" onChange={onFile} data-testid={`sku-video-input-${code}`} />
            {state.uploading ? (
                <span className={`${segment} text-purple-700`} title={state.message}>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {state.progress}%
                </span>
            ) : state.checking ? (
                <span className={`${segment} text-slate-400`} title="Verificando vídeo"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Vídeo</span>
            ) : state.exists && state.url ? (
                <>
                    <a href={state.url} target="_blank" rel="noreferrer" className={`${segment} text-purple-700 hover:bg-purple-50`} title={`Ver vídeo ${code}.mp4`}>
                        <Video className="h-3.5 w-3.5" /> Vídeo
                    </a>
                    <button type="button" onClick={() => inputRef.current?.click()} className={`${segment} text-slate-600 hover:bg-slate-50`} title={`Trocar o vídeo de ${code} (salvo como ${code}.mp4)`}>
                        Trocar
                    </button>
                </>
            ) : (
                <button type="button" onClick={() => inputRef.current?.click()} className={`${segment} text-purple-700 hover:bg-purple-50`} title={`Enviar vídeo MP4 da variação (salvo como ${code}.mp4)`}>
                    <VideoOff className="h-3.5 w-3.5" /> Enviar vídeo
                </button>
            )}
        </>
    );
};
