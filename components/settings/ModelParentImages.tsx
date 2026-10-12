import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, Save, ChevronDown } from 'lucide-react';
import { productService } from '../../services/products';
import { uploadProductImages } from '../../services/productImageUpload';
import { uploadProductVideo, validateProductVideo, SynologyUploadError } from '../../services/productVideoUpload';
import { ProductImages } from '../products/sections/ProductImages';
import { isLocalCatalogPreviewRuntime } from '../../services/localCatalogPreview';
import type { Product } from '../../types/product';
import { toBrowserSafeMediaUrl } from '../../utils/media-url';

export function ModelParentImages({ modelId, onBusyChange, onSaveReady }: { modelId: string; onBusyChange?: (busy: boolean) => void; onSaveReady?: (save: (() => Promise<boolean>) | null) => void }) {
    const [parents, setParents] = useState<Product[]>([]);
    const [selectedId, setSelectedId] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    const [images, setImages] = useState<string[]>([]);
    const [videoUrl, setVideoUrl] = useState('');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');
    const [expanded, setExpanded] = useState(false);
    const pendingVideo = useRef<{ file: File; id?: string; url?: string } | null>(null);
    const operation = useRef(false);
    useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
    useEffect(() => () => { onBusyChange?.(false); }, [onBusyChange]);

    function selectParent(parent?: Product) {
        setSelectedId(parent?.id || ''); setImages(parent?.images || []);
        setVideoUrl(parent?.video_url || ''); setVideoFile(null); pendingVideo.current = null;
        setStatus(''); setError('');
    }
    useEffect(() => {
        let active = true;
        setLoading(true); setError(''); setParents([]); selectParent();
        productService.listParentsByModel(modelId).then(data => {
            if (!active) return;
            setParents(data); selectParent(data[0]);
        }).catch(failure => {
            if (active) setError(failure instanceof Error ? failure.message : 'Não foi possível carregar as fotos do pai.');
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [modelId, retry]);
    const parent = parents.find(item => item.id === selectedId);
    const dirty = Boolean(parent && (JSON.stringify(images) !== JSON.stringify(parent.images || []) || videoUrl !== (parent.video_url || '') || videoFile));
    useEffect(() => {
        onSaveReady?.(dirty ? save : null);
        return () => { onSaveReady?.(null); };
    }, [onSaveReady, dirty, images, videoUrl, videoFile, parent]);
    async function persistPhotos(next: string[]) {
        if (!parent) return;
        setImages(next);
        const saved = await productService.saveParentMedia(modelId, parent.id, { images: next, video_url: parent.video_url || null });
        setParents(current => current.map(item => item.id === saved.id ? saved : item));
        setStatus(isLocalCatalogPreviewRuntime() ? 'Fotos salvas automaticamente no rascunho local. Permanecem após atualizar a página.' : 'Fotos do pai salvas automaticamente.');
    }
    async function changePhotos(next: string[]) {
        if (!parent || operation.current) return;
        operation.current = true; setBusy(true); setError(''); setStatus('Salvando fotos do pai...');
        try { await persistPhotos(next); }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Falha ao salvar fotos.'); setStatus('Fotos ainda não salvas. Clique em Salvar para tentar novamente antes de atualizar a página.'); }
        finally { operation.current = false; setBusy(false); }
    }
    async function addImages(event: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(event.target.files || []); event.target.value = '';
        if (!parent || !files.length || operation.current) return;
        if (files.length + images.length > 5) { setError(`O limite é 5 fotos. Você pode adicionar mais ${Math.max(0, 5 - images.length)}.`); return; }
        if (files.some(file => !file.type.startsWith('image/'))) { setError('Selecione apenas fotos.'); return; }
        operation.current = true; setBusy(true); setError(''); setStatus('Enviando fotos...');
        try { const uploaded = await uploadProductImages(parent.id, files); await persistPhotos([...images, ...uploaded]); }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Falha ao enviar as fotos.'); setStatus(''); }
        finally { operation.current = false; setBusy(false); }
    }
    async function save(): Promise<boolean> {
        if (!parent || operation.current) return false;
        operation.current = true; setBusy(true); setError(''); setStatus('Salvando mídias do pai...');
        try {
            let url = videoUrl.trim();
            if (videoFile) {
                const pending: { file: File; id?: string; url?: string } = pendingVideo.current?.file === videoFile ? pendingVideo.current : { file: videoFile };
                pendingVideo.current = pending;
                url = pending.url || await uploadProductVideo(videoFile, parent.sku || '', {
                    uploadId: pending.id, onAccepted: id => { pending.id = id; },
                    onProgress: (_, message) => setStatus(message),
                });
                pending.url = url;
            }
            const saved = await productService.saveParentMedia(modelId, parent.id, { images, video_url: url || null });
            setParents(current => current.map(item => item.id === saved.id ? saved : item));
            setVideoUrl(url); setVideoFile(null); pendingVideo.current = null;
            setStatus(isLocalCatalogPreviewRuntime() ? 'Mídias salvas no rascunho local do pai. A publicação depende da aprovação do rascunho.' : 'Mídias do pai salvas.');
            return true;
        } catch (failure) {
            if (failure instanceof SynologyUploadError && failure.uploadFailed && videoFile) pendingVideo.current = { file: videoFile };
            setError(failure instanceof Error ? failure.message : 'Falha ao salvar as mídias.'); setStatus('');
            return false;
        }
        finally { operation.current = false; setBusy(false); }
    }
    return <section aria-label="Fotos do produto pai" className="mb-5 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <button type="button" disabled={busy || dirty} aria-expanded={expanded} aria-controls={`parent-media-${modelId}`} onClick={() => setExpanded(value => !value)} className="flex w-full items-center justify-between gap-3 text-left">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ImageIcon size={18} className="text-blue-600" />Fotos e vídeo do produto pai</h3>
            <span className="flex items-center gap-2 text-xs text-slate-500">{parent ? `${parent.images?.length || 0} fotos · ${parent.video_url ? '1 vídeo' : 'sem vídeo'}` : ''}<ChevronDown size={18} className={expanded ? 'rotate-180' : ''}/></span>
        </button>
        <p className="text-xs text-slate-500">Até 5 fotos e 1 vídeo do pai. Clique acima para editar. As fotos de cada cor continuam abaixo.</p>
        {loading ? <p role="status" className="flex items-center gap-2 py-3 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />Carregando mídias do pai...</p>
            : !parents.length ? <>{error ? <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-red-600">{error}<button type="button" onClick={() => setRetry(value => value + 1)} className="underline">Tentar novamente</button></div> : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Este modelo ainda não possui um produto pai vinculado. Cadastre o pai antes de adicionar suas mídias.</p>}</>
            : expanded && <fieldset id={`parent-media-${modelId}`} disabled={busy} className="space-y-4 min-w-0">
                {parents.length > 1 ? <label className="block text-sm text-slate-600">Produto pai
                    <select disabled={dirty || busy} value={selectedId} onChange={event => selectParent(parents.find(item => item.id === event.target.value))} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
                        {parents.map(item => <option key={item.id} value={item.id}>{item.name}{item.sku ? ` · ${item.sku}` : ''}</option>)}
                    </select>
                    {dirty && <span className="text-xs text-slate-500">Salve ou descarte as alterações antes de trocar de pai.</span>}
                </label> : <p className="text-sm font-medium text-slate-700">{parent?.name}{parent?.sku ? ` · ${parent.sku}` : ''}</p>}
                <ProductImages compact title="Fotos do pai" imagePreviews={images} isCompressing={busy} handleImageUpload={event => void addImages(event)} removeImage={index => void changePhotos(images.filter((_, i) => i !== index))} onReorder={busy ? undefined : next => void changePhotos(next)}/>
                <p className="text-xs text-emerald-700">Fotos salvas automaticamente ao adicionar, excluir ou reordenar. Aguarde a confirmação antes de atualizar a página.</p>
                <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                    <label className="block text-sm font-medium">Vídeo do pai (1 vídeo)
                        <input disabled={Boolean(videoFile)} type="url" value={videoUrl} onChange={event => { setVideoUrl(event.target.value); setStatus(''); }} placeholder="https://…" className="mt-1 w-full rounded-lg border p-2 text-sm"/>
                    </label>
                    <label className="inline-flex cursor-pointer rounded-lg border border-blue-200 px-3 py-2 text-sm text-blue-700">{videoFile || videoUrl ? 'Trocar vídeo MP4' : 'Adicionar vídeo MP4'}
                        <input type="file" accept="video/mp4,.mp4" aria-label="Enviar vídeo do pai" className="sr-only" onChange={event => {
                            const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
                            try { validateProductVideo(file); setVideoFile(file); pendingVideo.current = null; setError(''); setStatus('Vídeo selecionado. Clique em Salvar mídias do pai para enviar e confirmar.'); }
                            catch (failure) { setError(failure instanceof Error ? failure.message : 'Vídeo inválido.'); }
                        }}/>
                    </label>
                    {(videoFile || videoUrl) && <button type="button" onClick={() => { setVideoFile(null); setVideoUrl(''); pendingVideo.current = null; setStatus(''); }} className="ml-3 text-sm text-red-600">Remover vídeo</button>}
                    {videoFile ? <p className="break-all text-xs text-slate-600">{videoFile.name}</p> : videoUrl && <video controls preload="metadata" src={toBrowserSafeMediaUrl(videoUrl)} className="max-h-56 w-full rounded-lg bg-black"/>}
                    <p className="text-xs text-slate-500">Escolha um MP4 de até 500 MB ou cole um link público. O arquivo é enviado pelo fluxo de vídeo já usado no cadastro do produto.</p>
                </div>
                {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
                {status && <p role="status" className="text-sm text-slate-600">{status}</p>}
                <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={!dirty || busy || images.length > 5} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}Salvar mídias do pai</button>
                    {dirty && <button type="button" onClick={() => selectParent(parent)} className="rounded-lg border px-3 py-2 text-sm">Descartar alterações</button>}
                </div>
                <p className="text-xs text-slate-500">O botão Salvar do modelo também confirma o vídeo e qualquer mídia pendente antes de fechar. Fotos por cor continuam salvas separadamente.</p>
            </fieldset>}
    </section>;
}
