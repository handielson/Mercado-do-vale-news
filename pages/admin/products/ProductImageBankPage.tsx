import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Images, Trash2, RefreshCw, CheckCircle2, AlertCircle, FileImage, X, Info, Copy, Tag, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import {
    uploadImagesToBank,
    listAllBankImages,
    deleteImageFromBank,
    ImageBankEntry,
    UploadResult,
    parseImageFilename,
    toSlug,
} from '../../../services/productImageBank';
import { supabase } from '../../../services/supabase';
import { productService } from '../../../services/products';
import { colorService } from '../../../services/colors';

// Agrupar por SKU
function groupBySku(images: ImageBankEntry[]): Record<string, ImageBankEntry[]> {
    const grouped: Record<string, ImageBankEntry[]> = {};
    for (const img of images) {
        if (!grouped[img.sku]) grouped[img.sku] = [];
        grouped[img.sku].push(img);
    }
    return grouped;
}

export function ProductImageBankPage() {
    const [bankImages, setBankImages] = useState<ImageBankEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadQueue, setUploadQueue] = useState<{ id: string; file: File; preview: string }[]>([]);
    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
    const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
    const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<{ updated: number; notFound: string[] } | null>(null);
    const [previewFile, setPreviewFile] = useState<{ name: string; url: string } | null>(null);
    const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());

    const toggleSkuSelection = (sku: string) => {
        setSelectedSkus(prev => {
            const next = new Set(prev);
            next.has(sku) ? next.delete(sku) : next.add(sku);
            return next;
        });
    };
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Drag-to-reorder no banco de imagens (por SKU)
    const [draggedBankImg, setDraggedBankImg] = useState<{ sku: string; fromIdx: number } | null>(null);

    const handleBankDragStart = (sku: string, fromIdx: number) => {
        setDraggedBankImg({ sku, fromIdx });
    };

    const handleBankDragOver = (e: React.DragEvent, sku: string, toIdx: number) => {
        e.preventDefault();
        if (!draggedBankImg || draggedBankImg.sku !== sku || draggedBankImg.fromIdx === toIdx) return;
        setBankImages(prev => {
            const skuImages = prev.filter(img => img.sku === sku);
            const others = prev.filter(img => img.sku !== sku);
            const moved = skuImages[draggedBankImg.fromIdx];
            if (!moved) return prev;
            const reordered = [...skuImages];
            reordered.splice(draggedBankImg.fromIdx, 1);
            reordered.splice(toIdx, 0, moved);
            return [...others, ...reordered];
        });
        setDraggedBankImg({ sku, fromIdx: toIdx });
    };

    const handleBankDragEnd = () => setDraggedBankImg(null);

    // Dados do banco para o gerador
    const [dbSkus, setDbSkus] = useState<{ sku: string; name: string; color?: string }[]>([]);
    const [dbColors, setDbColors] = useState<string[]>([]);

    // Gerador de nomes
    const [genSku, setGenSku] = useState('');
    const [genColor, setGenColor] = useState('');
    const [genQty, setGenQty] = useState(1);
    const [genStart, setGenStart] = useState(1);
    const [genExt, setGenExt] = useState('jpg');
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
    const [showSkuDrop, setShowSkuDrop] = useState(false);
    const [showColorDrop, setShowColorDrop] = useState(false);
    const skuInputRef = useRef<HTMLDivElement>(null);
    const colorInputRef = useRef<HTMLDivElement>(null);

    // Filtragem para dropdown
    const filteredSkus = genSku.length >= 1
        ? dbSkus.filter(s => s.sku.toLowerCase().includes(genSku.toLowerCase()) || s.name.toLowerCase().includes(genSku.toLowerCase())).slice(0, 8)
        : dbSkus.slice(0, 8);
    const filteredColors = genColor.length >= 1
        ? dbColors.filter(c => c.toLowerCase().includes(genColor.toLowerCase())).slice(0, 8)
        : dbColors.slice(0, 8);

    // Carrega SKUs e cores do banco
    useEffect(() => {
        productService.list().then(products => {
            const seen = new Set<string>();
            const skus = products
                .filter(p => p.sku && !seen.has(p.sku) && seen.add(p.sku!))
                .map(p => ({ sku: p.sku!, name: p.name, color: p.specs?.color?.toUpperCase() }))
                .sort((a, b) => a.sku.localeCompare(b.sku));
            setDbSkus(skus);
        }).catch(() => { });

        colorService.list().then(colors => {
            setDbColors(colors.map(c => c.name.toUpperCase()).sort());
        }).catch(() => { });
    }, []);

    // Fecha dropdowns ao clicar fora
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (skuInputRef.current && !skuInputRef.current.contains(e.target as Node)) setShowSkuDrop(false);
            if (colorInputRef.current && !colorInputRef.current.contains(e.target as Node)) setShowColorDrop(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Slug SEO: "Capa de Silicone Realme Note 70" → "capa-de-silicone-realme-note-70"
    const toSlug = (text: string) =>
        text.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

    const selectedProductName = dbSkus.find(s => s.sku === genSku.trim().toUpperCase())?.name ?? '';

    const generatedNames = (() => {
        if (!genSku.trim()) return [];
        const skuUp = genSku.trim().toUpperCase();
        return Array.from({ length: genQty }, (_, i) => {
            const num = String(genStart + i).padStart(2, '0');
            if (genColor.trim()) {
                // Com cor: {SKU}_{cor}_{num}.ext  (formato legado SEO)
                const colorSlug = toSlug(genColor.trim());
                const nameSlug = selectedProductName ? toSlug(selectedProductName) : toSlug(genSku.trim());
                return `${nameSlug}_${colorSlug}_${num}.${genExt}`;
            }
            // Sem cor: {SKU}_{num}.ext  (novo padrão recomendado)
            return `${skuUp}_${num}.${genExt}`;
        });
    })();

    const copyName = (name: string, idx: number) => {
        navigator.clipboard.writeText(name);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 1500);
    };

    const copyAll = () => {
        navigator.clipboard.writeText(generatedNames.join('\n'));
        toast.success('Todos os nomes copiados!');
    };

    const loadImages = useCallback(async () => {
        setIsLoading(true);
        try {
            const all = await listAllBankImages();
            setBankImages(all.sort((a, b) => a.sku.localeCompare(b.sku) || a.color.localeCompare(b.color) || a.order - b.order));
        } catch {
            toast.error('Erro ao carregar banco de imagens');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { loadImages(); }, [loadImages]);

    // Extensões de imagem aceitas
    const IMAGE_EXTS = /\.(jpe?g|png|pnj|webp|gif|avif|heic|bmp|tiff?)$/i;
    const hasUploadContext = !!genSku.trim();

    const validateFiles = (files: File[]) =>
        files.filter(f => f.type.startsWith('image/') || IMAGE_EXTS.test(f.name));

    const handleFiles = (files: FileList | null) => {
        if (!files) return;
        const arr = Array.from(files);
        const valid = validateFiles(arr);
        if (!hasUploadContext && valid.length > 0) {
            toast.warning('⚠️ Sem SKU selecionado: as imagens serão enviadas, mas clique em Sincronizar após o upload para atualizar os produtos.');
        }
        if (valid.length < arr.length)
            toast.warning(`${arr.length - valid.length} arquivo(s) não são imagens e foram ignorados.`);
        
        const newItems = valid.map(file => ({
            id: Math.random().toString(36).substring(7),
            file,
            preview: URL.createObjectURL(file)
        }));
        
        setUploadQueue(prev => [...prev, ...newItems]);
    };

    // Cleanup object URLs when component unmounts or queue is cleared
    useEffect(() => {
        return () => {
            uploadQueue.forEach(item => URL.revokeObjectURL(item.preview));
        };
    }, []);

    const clearQueue = () => {
        uploadQueue.forEach(item => URL.revokeObjectURL(item.preview));
        setUploadQueue([]);
    };

    const removeFromQueue = (id: string, index: number) => {
        URL.revokeObjectURL(uploadQueue[index].preview);
        setUploadQueue(prev => prev.filter(item => item.id !== id));
    };

    // --- Funcionalidade de Drag and Drop para Ordenação ---
    const handleDragStartItem = (e: React.DragEvent, index: number) => {
        e.dataTransfer.effectAllowed = 'move';
        // Hack para sumir com o ghost padrão e deixar mais limpo se quiser, mas funciona bem o padrão
        setDraggedItemIndex(index);
    };

    const handleDragOverItem = (e: React.DragEvent, index: number) => {
        e.preventDefault(); // Necessário para permitir o drop
        if (draggedItemIndex === null || draggedItemIndex === index) return;
        
        setUploadQueue(prev => {
            const newQueue = [...prev];
            const draggedItem = newQueue[draggedItemIndex];
            newQueue.splice(draggedItemIndex, 1);
            newQueue.splice(index, 0, draggedItem);
            setDraggedItemIndex(index); // Atualiza o índice do item sendo arrastado
            return newQueue;
        });
    };

    const handleDragEndItem = () => {
        setDraggedItemIndex(null);
    };
    // ----------------------------------------------------

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    const handleUpload = async () => {
        if (uploadQueue.length === 0) return;
        setUploadResult(null);
        setUploadProgress({ done: 0, total: uploadQueue.length });

        const context = hasUploadContext ? {
            sku: genSku.trim().toUpperCase(),
            productName: selectedProductName || genSku.trim(),
            color: genColor.trim() || 'PADRAO',
            startOrder: genStart,
        } : undefined;

        const filesToUpload = uploadQueue.map(item => item.file);

        const result = await uploadImagesToBank(filesToUpload, (done, total) => {
            setUploadProgress({ done, total });
        }, context);

        setUploadResult(result);
        setUploadProgress(null);
        clearQueue();

        if (result.success.length > 0) {
            toast.success(`✅ ${result.success.length} imagem(ns) enviada(s)!`);

            // Agrupa as URLs enviadas por SKU e sincroniza diretamente (sem re-listar do Storage)
            const urlsBySku = new Map<string, { order: number; url: string }[]>();
            for (const item of result.success) {
                if (!urlsBySku.has(item.sku)) urlsBySku.set(item.sku, []);
                urlsBySku.get(item.sku)!.push({ order: item.order, url: item.url });
            }

            // Busca imagens já existentes no banco para cada SKU e mescla
            let synced = 0;
            for (const [sku, newItems] of urlsBySku.entries()) {
                try {
                    // Existentes no banco (campo images atual)
                    const { data: prod } = await supabase
                        .from('products')
                        .select('images')
                        .eq('sku', sku)
                        .maybeSingle();

                    const existingUrls: string[] = Array.isArray(prod?.images) ? prod.images : [];

                    // Merge: adiciona novos sem duplicar
                    const newUrls = newItems.sort((a, b) => a.order - b.order).map(i => i.url);
                    const merged = [...new Set([...existingUrls, ...newUrls])];

                    const { error } = await supabase.rpc('sync_product_images', {
                        p_sku: sku,
                        p_urls: merged,
                    });
                    if (!error) synced++;
                } catch { /* ignora erros individuais */ }
            }

            if (synced > 0) toast.success('🔄 Produto(s) atualizado(s) automaticamente!');
            else toast.warning('Upload OK — clique em Sincronizar para atualizar o produto.');
        }
        if (result.errors.length > 0) toast.error(`⚠️ ${result.errors.length} erro(s) no upload`);
        await loadImages();
    };

    const handleDelete = async (img: ImageBankEntry) => {
        if (!confirm(`Excluir "${img.filename}"?`)) return;
        try {
            await deleteImageFromBank(img.path);
            toast.success('Imagem removida');
            setBankImages(prev => prev.filter(i => i.path !== img.path));
        } catch (err: any) {
            toast.error(`Erro: ${err.message}`);
        }
    };

    const handleSyncToProducts = async (onlySelected = false) => {
        setIsSyncing(true);
        setSyncResult(null);
        try {
            const [allImages, allProductsList] = await Promise.all([
                listAllBankImages(),
                productService.list(),
            ]);

            if (!allProductsList || allProductsList.length === 0) {
                toast.error('Nenhum produto encontrado');
                return;
            }

            // Agrupa imagens por (pasta + cor)
            const groups = new Map<string, ImageBankEntry[]>();
            for (const img of allImages) {
                // Filtra por SKUs selecionados se modo seletivo
                if (onlySelected && !selectedSkus.has(img.sku)) continue;
                const key = `${img.sku}|||${img.color}`;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(img);
            }

            let updated = 0;
            const notFound: string[] = [];

            for (const [key, images] of groups.entries()) {
                const [folderName, colorInFile] = key.split('|||');
                const urls = images.sort((a, b) => a.order - b.order).map(i => i.url);

                // Estrategia 1: pasta é um SKU exato
                let matchedSku = allProductsList.find(p =>
                    p.sku.toUpperCase() === folderName.toUpperCase()
                )?.sku ?? null;

                // Estrategia 2: pasta é slug do nome → busca por specs.color + palavras-chave do nome
                if (!matchedSku) {
                    const folderSlug = toSlug(folderName);
                    const colorSlug = colorInFile.toLowerCase();
                    const keywords = folderSlug.split('-').filter(w => w.length > 2);
                    const match = allProductsList.find(p => {
                        const specColor = toSlug((p as any).specs?.color || (p as any).color_name || '');
                        const colorMatches = specColor === colorSlug;
                        const pSlug = toSlug(p.name);
                        const hasKeywords = keywords.every(w => pSlug.includes(w));
                        return colorMatches && hasKeywords;
                    });
                    matchedSku = match?.sku ?? null;
                }

                if (!matchedSku) { notFound.push(`${folderName}/${colorInFile}`); continue; }

                const { error } = await supabase.rpc('sync_product_images', {
                    p_sku: matchedSku,
                    p_urls: urls,
                });
                if (error) {
                    console.error('RPC error para', matchedSku, error);
                    notFound.push(`${matchedSku}: ${error.message}`);
                } else updated++;
            }

            setSyncResult({ updated, notFound });
            toast.success(`✅ ${updated} produto(s) sincronizado(s)!`);
            if (notFound.length) toast.warning(`${notFound.length} grupo(s) não encontrado(s): ${notFound.slice(0, 3).join(', ')}`);
            if (onlySelected) setSelectedSkus(new Set()); // limpa seleção após sync
        } catch (err: any) {
            toast.error(`Erro na sincronização: ${err.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const grouped = groupBySku(bankImages);
    const skuList = Object.keys(grouped).sort();

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Images size={24} className="text-blue-600" />
                        Banco de Imagens
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {bankImages.length} imagem{bankImages.length !== 1 ? 'ns' : ''} em {skuList.length} SKU{skuList.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={loadImages}
                        className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        <RefreshCw size={14} />
                        Atualizar
                    </button>
                    {selectedSkus.size > 0 && (
                        <button
                            onClick={() => handleSyncToProducts(true)}
                            disabled={isSyncing}
                            className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                            {isSyncing ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                            Sincronizar Selecionados ({selectedSkus.size})
                        </button>
                    )}
                    <button
                        onClick={() => handleSyncToProducts(false)}
                        disabled={isSyncing || bankImages.length === 0}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        {isSyncing ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        Sincronizar Todos
                    </button>
                </div>
            </div>

            {/* Instrução de nomenclatura */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                <Info size={18} className="text-blue-600 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">📋 Como fazer upload de imagens por SKU:</p>
                    <p className="mt-1 text-blue-700">
                        <strong>Modo rápido (envio em massa):</strong> renomeie as fotos no padrão{' '}
                        <code className="font-mono text-xs bg-blue-100 px-1 rounded">SKU_01.jpg</code>,{' '}
                        <code className="font-mono text-xs bg-blue-100 px-1 rounded">SKU_02.jpg</code>...
                        e arraste tudo de uma vez — sem precisar selecionar SKU na tela.
                    </p>
                    <p className="mt-1 text-blue-700">
                        Exemplo: <code className="font-mono text-xs bg-blue-100 px-1 rounded">XRN14-T025_01.jpg</code>{' '}
                        → salvo como <code className="font-mono text-xs bg-blue-100 px-1 rounded">products/XRN14-T025/XRN14-T025_01.webp</code>
                    </p>
                    <p className="mt-1 text-blue-600 text-xs">
                        💡 Use o <strong>Gerador de Nomes</strong> abaixo para gerar os nomes corretos e copiá-los. O sistema converte automaticamente para WebP (máx 300KB/1000px).
                    </p>
                </div>
            </div>

            {/* Gerador de Nomes */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Tag size={16} className="text-amber-500" />
                    Gerador de Nomes de Arquivo
                    <span className="text-xs font-normal text-slate-400 ml-1">— gere e copie os nomes corretos para renomear suas fotos</span>
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                    {/* SKU — combobox dinâmico */}
                    <div className="md:col-span-2 space-y-1" ref={skuInputRef}>
                        <label className="text-xs font-medium text-slate-600">SKU do Produto</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={genSku}
                                onChange={e => { setGenSku(e.target.value); setShowSkuDrop(true); }}
                                onFocus={() => setShowSkuDrop(true)}
                                placeholder="Digite ou selecione..."
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-amber-400 outline-none"
                            />
                            {showSkuDrop && filteredSkus.length > 0 && (
                                <ul className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                                    {filteredSkus.map(s => (
                                        <li
                                            key={s.sku}
                                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-amber-50"
                                            onMouseDown={() => {
                                                setGenSku(s.sku);
                                                if (s.color) setGenColor(s.color);
                                                setShowSkuDrop(false);
                                            }}
                                        >
                                            <span className="font-mono text-xs font-bold text-slate-700 w-32 shrink-0 truncate">{s.sku}</span>
                                            <span className="text-xs text-slate-400 truncate">{s.name}</span>
                                            {s.color && (
                                                <span className="text-xs text-amber-600 font-medium shrink-0">{s.color}</span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Cor — combobox dinâmico */}
                    <div className="space-y-1" ref={colorInputRef}>
                        <label className="text-xs font-medium text-slate-600">Cor</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={genColor}
                                onChange={e => { setGenColor(e.target.value); setShowColorDrop(true); }}
                                onFocus={() => setShowColorDrop(true)}
                                placeholder="Digite ou selecione..."
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-amber-400 outline-none"
                            />
                            {showColorDrop && filteredColors.length > 0 && (
                                <ul className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                                    {filteredColors.map(c => (
                                        <li
                                            key={c}
                                            className="px-3 py-2 text-sm font-mono cursor-pointer hover:bg-amber-50 text-slate-700"
                                            onMouseDown={() => { setGenColor(c); setShowColorDrop(false); }}
                                        >{c}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Extensão */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">Extensão</label>
                        <select
                            value={genExt}
                            onChange={e => setGenExt(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 outline-none"
                        >
                            <option value="jpg">jpg</option>
                            <option value="jpeg">jpeg</option>
                            <option value="png">png</option>
                            <option value="webp">webp</option>
                        </select>
                    </div>

                    {/* Qtd + início */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">Fotos / Início</label>
                        <div className="flex gap-1">
                            <input
                                type="number"
                                min={1} max={20}
                                value={genQty}
                                onChange={e => setGenQty(Math.max(1, Number(e.target.value)))}
                                className="w-1/2 border border-slate-300 rounded-lg px-2 py-2 text-sm text-center focus:ring-2 focus:ring-amber-400 outline-none"
                                title="Quantidade de fotos"
                            />
                            <input
                                type="number"
                                min={1} max={99}
                                value={genStart}
                                onChange={e => setGenStart(Math.max(1, Number(e.target.value)))}
                                className="w-1/2 border border-slate-300 rounded-lg px-2 py-2 text-sm text-center focus:ring-2 focus:ring-amber-400 outline-none"
                                title="Número inicial"
                            />
                        </div>
                    </div>
                </div>

                {/* Lista de nomes gerados */}
                {generatedNames.length > 0 && (
                    <div className="space-y-2">
                        {selectedProductName && (
                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                                <span className="text-slate-400">Produto:</span>
                                <span className="font-medium text-slate-700">{selectedProductName}</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-green-700 font-medium">🌐 Nomes SEO — prontos para renomear e enviar</p>
                            <button
                                onClick={copyAll}
                                className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
                            >
                                <Copy size={12} />
                                Copiar todos
                            </button>
                        </div>
                        <div className="space-y-1">
                            {generatedNames.map((name, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2"
                                >
                                    <span className="flex-1 font-mono text-sm text-green-800">{name}</span>
                                    <button
                                        onClick={() => copyName(name, idx)}
                                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-all shrink-0 ${copiedIdx === idx
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-white border border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-700'
                                            }`}
                                    >
                                        {copiedIdx === idx ? (
                                            <><CheckCircle2 size={11} /> Copiado!</>
                                        ) : (
                                            <><Copy size={11} /> Copiar</>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {!genSku.trim() && (
                    <p className="text-xs text-slate-400 text-center py-2">
                        Preencha o SKU e a Cor acima para gerar os nomes
                    </p>
                )}
            </div>

            {/* Zona de Upload */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Upload size={16} className="text-slate-500" />
                    Enviar Imagens
                </h2>

                {/* Contexto ativo de upload */}
                {hasUploadContext ? (
                    <div className="mb-4 flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
                        <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                        <div className="flex-1 text-sm text-green-800">
                            <span className="font-semibold">SKU:</span> {genSku.toUpperCase()}
                            {genColor && <><span className="mx-2 text-green-400">·</span><span className="font-semibold">Cor:</span> {genColor.toUpperCase()}</>}
                            <span className="mx-2 text-green-400">·</span>
                            <span className="text-green-600 text-xs">Arraste as imagens — o sistema gera os nomes SEO e sincroniza automaticamente</span>
                        </div>
                    </div>
                ) : (
                    <div className="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                        <Info size={16} className="text-amber-600 shrink-0" />
                        <p className="text-xs text-amber-800">
                            <strong>Sem SKU selecionado:</strong> renomeie os arquivos com os nomes gerados pelo Gerador acima (ex: <code className="font-mono">nome-produto_preto_01.jpg</code>), envie tudo de uma vez e clique em <strong>Sincronizar com Produtos</strong>.
                        </p>
                    </div>
                )}

                {/* Drop Zone */}
                <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${isDragging
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-slate-300 hover:border-blue-300 hover:bg-slate-50'
                        }`}
                >
                    <FileImage size={32} className={`mx-auto mb-3 ${isDragging ? 'text-blue-500' : 'text-slate-300'}`} />
                    <p className="text-sm font-medium text-slate-600">
                        Arraste as imagens ou clique para selecionar
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                        PNG, JPG, WEBP — serão convertidas automaticamente para WebP
                    </p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFiles(e.target.files)}
                    />
                </div>

                {/* Fila de upload */}
                {uploadQueue.length > 0 && (
                    <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-slate-700">
                                {uploadQueue.length} arquivo{uploadQueue.length !== 1 ? 's' : ''} na fila
                            </p>
                            <button
                                onClick={clearQueue}
                                className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                            >
                                Limpar fila
                            </button>
                        </div>
                        
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
                            <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
                                <Info size={14} className="text-blue-500" />
                                <strong>Dica:</strong> Arraste e solte as imagens para ordenar. A capa será a etiqueta <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">#01 Principal</span>. As demais seguirão a ordem.
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[300px] overflow-y-auto pr-2 pb-2">
                                {uploadQueue.map((item, i) => {
                                    const isDragged = draggedItemIndex === i;
                                    return (
                                        <div
                                            key={item.id}
                                            draggable
                                            onDragStart={(e) => handleDragStartItem(e, i)}
                                            onDragOver={(e) => handleDragOverItem(e, i)}
                                            onDragEnd={handleDragEndItem}
                                            className={`relative group bg-white rounded-lg border-2 shadow-sm overflow-hidden flex flex-col cursor-grab active:cursor-grabbing transition-all ${
                                                isDragged ? 'border-blue-400 opacity-50 scale-95' : 'border-slate-200 hover:border-blue-300'
                                            }`}
                                        >
                                            <div className="absolute top-1 left-1 z-10 bg-black/60 text-white backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1">
                                                <GripVertical size={10} className="text-white/70" />
                                                #{String(i + genStart).padStart(2, '0')}
                                            </div>
                                            {i === 0 && (
                                                <div className="absolute bottom-1 left-1 z-10 bg-blue-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm">
                                                    Principal
                                                </div>
                                            )}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeFromQueue(item.id, i); }}
                                                className="absolute top-1 right-1 z-10 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all"
                                                title="Remover imagem"
                                            >
                                                <X size={12} />
                                            </button>
                                            
                                            <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                                                <img 
                                                    src={item.preview} 
                                                    alt={item.file.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            
                                            <div className="px-2 py-1.5 border-t border-slate-100 bg-slate-50">
                                                <p className="text-[10px] text-slate-500 truncate" title={item.file.name}>
                                                    {item.file.name}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {uploadProgress ? (
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span>Enviando...</span>
                                    <span>{uploadProgress.done}/{uploadProgress.total}</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 transition-all rounded-full"
                                        style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={handleUpload}
                                className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Enviar {uploadQueue.length} imagem{uploadQueue.length !== 1 ? 'ns' : ''}
                            </button>
                        )}
                    </div>
                )}

                {/* Resultado do upload */}
                {uploadResult && (
                    <div className="mt-4 space-y-2">
                        {uploadResult.success.length > 0 && (
                            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                                <CheckCircle2 size={14} />
                                {uploadResult.success.length} imagem{uploadResult.success.length !== 1 ? 'ns' : ''} enviada{uploadResult.success.length !== 1 ? 's' : ''} com sucesso
                            </div>
                        )}
                        {uploadResult.errors.map((e, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-red-700 bg-red-50 px-3 py-2 rounded-lg">
                                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                <div>
                                    <span className="font-mono text-xs">{e.file}</span>
                                    <span className="text-xs ml-2 text-red-500">— {e.reason}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Resultado da Sincronização */}
            {syncResult && (
                <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 text-sm ${syncResult.notFound.length > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-green-50 border-green-200 text-green-800'
                    }`}>
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span>
                        {syncResult.updated} produto{syncResult.updated !== 1 ? 's' : ''} atualizado{syncResult.updated !== 1 ? 's' : ''}.
                        {syncResult.notFound.length > 0 && (
                            <span className="ml-2 text-amber-700">
                                SKUs não encontrados: {syncResult.notFound.join(', ')}
                            </span>
                        )}
                    </span>
                </div>
            )}

            {/* Galeria por SKU */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Images size={16} className="text-slate-500" />
                        Imagens no Banco
                        {selectedSkus.size > 0 && (
                            <span className="text-xs font-normal text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                                {selectedSkus.size} selecionado{selectedSkus.size !== 1 ? 's' : ''}
                            </span>
                        )}
                    </h2>
                    {skuList.length > 0 && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setSelectedSkus(new Set(skuList))}
                                className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                            >
                                Selecionar todos
                            </button>
                            {selectedSkus.size > 0 && (
                                <>
                                    <span className="text-slate-300">|</span>
                                    <button
                                        onClick={() => setSelectedSkus(new Set())}
                                        className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
                                    >
                                        Desmarcar
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {isLoading ? (
                    <div className="p-12 text-center text-slate-400 text-sm">
                        <RefreshCw size={24} className="mx-auto mb-2 animate-spin" />
                        Carregando...
                    </div>
                ) : skuList.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-sm">
                        <Images size={32} className="mx-auto mb-2 opacity-30" />
                        <p>Nenhuma imagem no banco ainda.</p>
                        <p className="text-xs mt-1">Faça o upload acima para começar.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {skuList.map(sku => (
                            <div
                                key={sku}
                                className={`p-4 transition-colors ${selectedSkus.has(sku) ? 'bg-green-50' : ''}`}
                            >
                                <div className="flex items-center gap-2 mb-3">
                                    <input
                                        type="checkbox"
                                        checked={selectedSkus.has(sku)}
                                        onChange={() => toggleSkuSelection(sku)}
                                        className="w-4 h-4 text-green-600 rounded border-slate-300 focus:ring-green-500 cursor-pointer"
                                        title="Selecionar para sincronizar"
                                    />
                                    <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                        SKU: {sku}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        {grouped[sku].length} imagem{grouped[sku].length !== 1 ? 'ns' : ''}
                                        {' — '}
                                        {[...new Set(grouped[sku].map(i => i.color))].join(', ')}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {grouped[sku].map((img, imgIdx) => {
                                        const isDraggingThis = draggedBankImg?.sku === sku && draggedBankImg?.fromIdx === imgIdx;
                                        return (
                                            <div
                                                key={img.path}
                                                draggable
                                                onDragStart={() => handleBankDragStart(sku, imgIdx)}
                                                onDragOver={(e) => handleBankDragOver(e, sku, imgIdx)}
                                                onDragEnd={handleBankDragEnd}
                                                className={`group relative w-24 h-24 rounded-lg overflow-hidden border-2 bg-slate-50 cursor-grab active:cursor-grabbing transition-all ${
                                                    isDraggingThis
                                                        ? 'border-blue-400 opacity-40 scale-95'
                                                        : imgIdx === 0
                                                            ? 'border-blue-400'
                                                            : 'border-slate-200 hover:border-blue-300'
                                                }`}
                                                onClick={() => setPreviewFile({ name: img.filename, url: img.url })}
                                            >
                                                {/* Grip icon */}
                                                <div className="absolute top-1 left-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <GripVertical size={14} className="text-white drop-shadow" />
                                                </div>
                                                {/* Badge Principal */}
                                                {imgIdx === 0 && (
                                                    <div className="absolute top-1 right-1 z-10 bg-blue-600 text-white text-[8px] font-bold px-1 py-0.5 rounded shadow">
                                                        CAPA
                                                    </div>
                                                )}
                                                <img
                                                    src={img.url}
                                                    alt={img.filename}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(img); }}
                                                        className="p-1.5 bg-red-500 text-white rounded-full"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                                                    <p className="text-[9px] text-white truncate text-center">
                                                        #{imgIdx + 1} {img.color && img.color !== '' ? img.color : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Preview Modal */}
            {previewFile && (
                <div
                    className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
                    onClick={() => setPreviewFile(null)}
                >
                    <div className="relative max-w-xl w-full" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setPreviewFile(null)}
                            className="absolute -top-4 -right-4 bg-white rounded-full p-1.5 shadow-lg text-slate-500 hover:text-black"
                        >
                            <X size={16} />
                        </button>
                        <img src={previewFile.url} alt={previewFile.name} className="w-full rounded-xl shadow-2xl" />
                        <p className="text-center text-white text-xs mt-2 font-mono">{previewFile.name}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
