import React, { useEffect, useState } from 'react';
import { ProductImages } from './sections/ProductImages';
import { uploadProductImages } from '../../services/productImageUpload';
import { vpsApiService } from '../../services/vpsApiService';
import { validateProductVideo } from '../../services/productVideoUpload';

export function VariationMedia({ productId, sku, name, images, parentImages, inheritImages, videoUrl, videoFile, parentVideo = '', inheritVideo = false, disabled, onChange, onBusyChange }: {
    videoFile?: File | null;
    parentVideo?: string; inheritVideo?: boolean;
    sku?: string;
    productId: string; name: string; images: string[]; parentImages: string[];
    inheritImages: boolean; videoUrl: string; disabled: boolean;
    onChange: (media: { images: string[]; inheritImages: boolean; videoUrl: string; inheritVideo?: boolean; videoFile?: File | null }) => void;
    onBusyChange: (busy: boolean) => void;
}) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [videoStatus, setVideoStatus] = useState('');
    const [checkingVideo, setCheckingVideo] = useState(false);
    const checkVideo = async (force = false) => {
        if (!sku?.trim()) { setVideoStatus('Salve a família para obter o SKU definitivo e nomear o vídeo.'); return; }
        setCheckingVideo(true); onBusyChange(true);
        try {
            const result = await vpsApiService.checkVideoBySku(sku, { noCache: force });
            if (!result) setVideoStatus('Não foi possível consultar o Synology. Tente novamente.');
            else if (result.exists && result.url) {
                onChange({ images, inheritImages, videoUrl: result.url, videoFile: null });
                setVideoStatus('Vídeo reconhecido no Synology.');
            } else setVideoStatus(`Arquivo não encontrado. Coloque ${sku}.mp4 na pasta de vídeos do Synology e clique em Reconhecer vídeo.`);
        } catch { setVideoStatus('Não foi possível consultar o Synology. Tente novamente.'); }
        finally { setCheckingVideo(false); onBusyChange(false); }
    };
    useEffect(() => {
        if (!sku || videoUrl || videoFile || inheritVideo || disabled) return;
        let cancelled = false;
        const timer = setTimeout(() => {
            void vpsApiService.checkVideoBySku(sku).then(result => {
                if (cancelled) return;
                if (result?.exists && result.url) {
                    onChange({ images, inheritImages, videoUrl: result.url });
                    setVideoStatus('Vídeo reconhecido no Synology.');
                }
            }).catch(() => { if (!cancelled) setVideoStatus('Não foi possível consultar o Synology.'); });
        }, 800);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [sku, videoUrl, videoFile, images, inheritImages, inheritVideo, disabled, onChange]);
    const displayed = inheritImages ? parentImages : images;
    const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const input = event.target;
        const files = Array.from(input.files || []);
        input.value = '';
        if (!files.length || uploading || disabled) return;
        const slots = 5 - displayed.length;
        if (files.length > slots) { setError(`Você pode adicionar mais ${slots} foto(s). O limite é 5 por variação.`); return; }
        setUploading(true); onBusyChange(true); setError('');
        try {
            const uploaded = await uploadProductImages(productId, files);
            onChange({ images: [...displayed, ...uploaded], inheritImages: false, videoUrl });
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Não foi possível enviar as fotos.');
        } finally { setUploading(false); onBusyChange(false); }
    };
    return <fieldset disabled={disabled || uploading} className="w-full space-y-3 rounded-lg border border-slate-200 bg-white p-3" aria-label={`Fotos e vídeo da variação ${name}`}>
        <legend className="px-1 text-sm font-semibold">Fotos e vídeo desta variação</legend>
        <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={inheritImages} onChange={event => onChange({ images, inheritImages: event.target.checked, videoUrl })} />
            Usar fotos do pai
        </label>
        <ProductImages compact imagePreviews={displayed} isCompressing={uploading}
            handleImageUpload={event => void upload(event)}
            removeImage={index => { if (!disabled && !uploading) onChange({ images: displayed.filter((_, i) => i !== index), inheritImages: false, videoUrl }); }}
            onReorder={reordered => { if (!disabled && !uploading) onChange({ images: reordered, inheritImages: false, videoUrl }); }} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={inheritVideo} onChange={event => { setVideoStatus(''); onChange({ images, inheritImages, videoUrl, inheritVideo: event.target.checked, videoFile: event.target.checked ? null : videoFile }); }} />Usar vídeo do pai</label>
        <label className="block text-sm">Link do vídeo desta variação
            <input disabled={inheritVideo || Boolean(videoFile)} aria-label={`Vídeo da variação ${name}`} value={inheritVideo ? parentVideo : videoUrl} onChange={event => { setVideoStatus(''); onChange({ images, inheritImages, videoUrl: event.target.value, videoFile: null }); }}
                placeholder="Cole o link público do vídeo" className="mt-1 w-full rounded-lg border p-2" />
        </label>
        <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={inheritVideo || checkingVideo} onClick={() => document.getElementById(`variation-video-${productId}`)?.click()} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{videoFile ? 'Trocar vídeo' : 'Enviar vídeo'}</button>
            <input id={`variation-video-${productId}`} aria-label={`Enviar vídeo da variação ${name}`} type="file" accept="video/mp4,.mp4" className="hidden" disabled={inheritVideo || checkingVideo} onChange={event => {
                const file = event.target.files?.[0]; event.target.value = '';
                if (!file) return;
                try { validateProductVideo(file); setError(''); setVideoStatus(''); onChange({ images, inheritImages, videoUrl: '', inheritVideo: false, videoFile: file }); }
                catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível selecionar o vídeo.'); }
            }} />
            <button type="button" disabled={checkingVideo || !sku || inheritVideo || Boolean(videoFile)} onClick={() => void checkVideo(true)} className="rounded border px-3 py-1.5 text-xs text-blue-700 disabled:opacity-50">{checkingVideo ? 'Consultando...' : 'Reconhecer vídeo no Synology'}</button>
            <span className="text-xs text-slate-500">{sku ? `Arquivo: ${sku}.mp4` : 'Nome do arquivo disponível após salvar o SKU do filho.'}</span>
        </div>
        {videoFile && <div role="status" className="rounded-lg bg-blue-50 p-2 text-xs text-blue-900">
            <p className="break-all font-medium">{videoFile.name} · {(videoFile.size / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB</p>
            <p>Selecionado. Será enviado ao Synology ao salvar a família, com o SKU definitivo desta variação. Não feche a página antes de salvar.</p>
            <button type="button" className="mt-1 underline" onClick={() => onChange({ images, inheritImages, videoUrl, videoFile: null })}>Remover vídeo selecionado</button>
        </div>}
        {videoStatus && <p role="status" className="text-xs text-slate-600">{videoStatus}</p>}
        <p className="text-xs text-slate-500">Até 5 fotos; a primeira é a capa. Vídeo MP4 até 500 MB. Escolha o arquivo aqui ou informe um link público.</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </fieldset>;
}
