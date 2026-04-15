import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { Upload, Copy, Trash2, Image, Video, FileText, RefreshCw, ExternalLink, CheckCircle, Shield, Clock, GitCommit, FileArchive, ChevronDown, ChevronUp } from 'lucide-react';
import { vpsClient } from '../../../services/vpsClient';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CDNFile {
    name: string;
    size: number;
    modified: string | null;
    url: string;
}

type Folder = 'imagens' | 'videos' | 'arquivos';
type ActiveSection = Folder | 'backups';

interface BackupEntry {
    id: string;
    date: string;
    commit: string;
    commitMsg: string;
    type: string;
    summary: string;
    motivo: string;
    files: string[];
    notas: string;
}

const TABS: { id: Folder; label: string; icon: React.ReactNode; accept: string; cdn: string }[] = [
    {
        id: 'imagens',
        label: 'Imagens',
        icon: <Image size={16} />,
        accept: 'image/*',
        cdn: 'imagens.xiaomipetrolina.com.br',
    },
    {
        id: 'videos',
        label: 'Vídeos',
        icon: <Video size={16} />,
        accept: 'video/*',
        cdn: 'videos.mercadodovale.com.br',
    },
    {
        id: 'arquivos',
        label: 'Arquivos',
        icon: <FileText size={16} />,
        accept: '*/*',
        cdn: 'arquivos.xiaomipetrolina.com.br',
    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function isImageFile(name: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)$/i.test(name);
}

function isVideoFile(name: string): boolean {
    return /\.(mp4|webm|avi|mov|mkv|m4v)$/i.test(name);
}

// ─── File Card ────────────────────────────────────────────────────────────────

function FileCard({ file, onDelete, onCopy }: { file: CDNFile; onDelete: () => void; onCopy: () => void }) {
    const [copied, setCopied] = useState(false);
    const [deleting, setDeleting] = useState(false);

    function handleCopy() {
        navigator.clipboard.writeText(file.url).then(() => {
            setCopied(true);
            onCopy();
            setTimeout(() => setCopied(false), 2000);
        });
    }

    async function handleDelete() {
        if (!confirm(`Excluir "${file.name}"?`)) return;
        setDeleting(true);
        try {
            await onDelete();
        } finally {
            setDeleting(false);
        }
    }

    const isImage = isImageFile(file.name);
    const isVideo = isVideoFile(file.name);

    return (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all group">
            {/* Preview */}
            <div className="h-36 bg-slate-100 flex items-center justify-center overflow-hidden relative">
                {isImage ? (
                    <img
                        src={file.url}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                ) : isVideo ? (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Video size={36} />
                        <span className="text-xs">Vídeo</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                        <FileText size={36} />
                        <span className="text-xs">{file.name.split('.').pop()?.toUpperCase()}</span>
                    </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all" />
            </div>

            {/* Info */}
            <div className="p-3">
                <p className="text-xs font-medium text-slate-800 truncate" title={file.name}>{file.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{formatBytes(file.size)}</p>

                {/* URL */}
                <div className="mt-2 flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
                    <span className="text-xs text-slate-500 truncate flex-1 font-mono" title={file.url}>
                        {file.url.replace('https://', '')}
                    </span>
                </div>

                {/* Actions */}
                <div className="mt-2 flex gap-1.5">
                    <button
                        onClick={handleCopy}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            copied
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                        }`}
                        title="Copiar URL"
                    >
                        {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
                        {copied ? 'Copiado!' : 'Copiar URL'}
                    </button>
                    <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all"
                        title="Abrir"
                    >
                        <ExternalLink size={12} />
                    </a>
                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="px-2 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all disabled:opacity-50"
                        title="Excluir"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Dropzone ─────────────────────────────────────────────────────────────────

function Dropzone({ folder, accept, onUploadDone }: { folder: Folder; accept: string; onUploadDone: () => void }) {
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [processing, setProcessing] = useState(false); // aguardando resposta do Synology
    const [progress, setProgress] = useState<string | null>(null);
    const [pct, setPct] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    async function uploadFiles(files: FileList) {
        setUploading(true);
        let success = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setPct(0);
            setProcessing(false);
            setProgress(`Enviando ${i + 1}/${files.length}: ${file.name}`);
            try {
                const fd = new FormData();
                fd.append('file', file);
                await vpsClient.uploadWithProgress(
                    `/synology/upload?folder=${folder}`,
                    fd,
                    (p, phase) => { setPct(p); setProcessing(phase === 'processing'); }
                );
                success++;
            } catch (e: unknown) {
                toast.error(`Erro ao enviar "${file.name}": ${e instanceof Error ? e.message : 'Erro desconhecido'}`);
            }
        }
        setUploading(false);
        setProcessing(false);
        setProgress(null);
        setPct(0);
        if (success > 0) {
            toast.success(`${success} arquivo(s) enviado(s)! Atualizando lista em alguns segundos...`);
            // Aguarda o Synology processar o upload em background antes de recarregar a lista
            setTimeout(() => onUploadDone(), 6000);
        }
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files?.length) uploadFiles(e.target.files);
    }

    return (
        <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && inputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                dragging
                    ? 'border-blue-400 bg-blue-50'
                    : uploading
                    ? 'border-slate-300 bg-slate-50 cursor-not-allowed'
                    : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50'
            }`}
        >
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                multiple
                className="hidden"
                onChange={handleChange}
            />
            <div className="flex flex-col items-center gap-3 pointer-events-none">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${dragging ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Upload size={24} />
                </div>
                {uploading ? (
                    <div className="w-full max-w-xs">
                        <p className="text-sm font-medium text-slate-700">
                            {processing ? 'Salvando no Synology...' : 'Enviando para o servidor...'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 truncate">{progress}</p>
                        {/* Barra de progresso */}
                        <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden w-full">
                            {processing ? (
                                // Indeterminate quando servidor está processando
                                <div className="h-full bg-blue-500 rounded-full animate-pulse w-full" />
                            ) : (
                                <div
                                    className="h-full bg-blue-500 rounded-full transition-all duration-200"
                                    style={{ width: `${pct}%` }}
                                />
                            )}
                        </div>
                        <p className="text-xs text-blue-600 font-semibold mt-1">
                            {processing ? 'Aguardando Synology...' : `${pct}%`}
                        </p>
                    </div>
                ) : (
                    <div>
                        <p className="text-sm font-medium text-slate-700">
                            Arraste arquivos aqui ou <span className="text-blue-600">clique para selecionar</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-1">Múltiplos arquivos suportados</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// ─── Backup Tab ───────────────────────────────────────────────────────────────

function BackupCard({ entry }: { entry: BackupEntry }) {
    const [expanded, setExpanded] = useState(false);
    const typeColor = entry.type.includes('Manual')
        ? 'bg-amber-100 text-amber-700'
        : 'bg-green-100 text-green-700';

    return (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
            <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeColor}`}>
                                {entry.type.includes('Manual') ? '✋ Manual' : '🔄 Automático'}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                                <Clock size={11} />
                                {entry.date}
                            </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 truncate" title={entry.id}>
                            {entry.id}
                        </p>
                        {entry.commit && entry.commit !== 'N/A' && (
                            <p className="flex items-center gap-1 text-xs text-slate-400 mt-1 font-mono">
                                <GitCommit size={11} />
                                {entry.commit} — {entry.commitMsg}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={() => setExpanded(e => !e)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all shrink-0"
                        title={expanded ? 'Recolher' : 'Ver detalhes'}
                    >
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                </div>

                {/* Resumo */}
                {entry.summary && (
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">{entry.summary}</p>
                )}

                {/* Arquivos — sempre visíveis */}
                {entry.files && entry.files.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {entry.files.map(f => (
                            <span key={f} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                                {f.split('/').pop()}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Expandido: detalhes ricos */}
            {expanded && (
                <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-3">
                    {entry.motivo && (
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">💡 Motivo</p>
                            <p className="text-sm text-slate-700">{entry.motivo}</p>
                        </div>
                    )}
                    {entry.notas && (
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">📎 Notas</p>
                            <p className="text-sm text-slate-700">{entry.notas}</p>
                        </div>
                    )}
                    {entry.files && entry.files.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">📁 Arquivos modificados</p>
                            <div className="space-y-0.5">
                                {entry.files.map(f => (
                                    <p key={f} className="text-xs font-mono text-slate-600">{f}</p>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="pt-1 flex items-center gap-2 text-xs text-slate-400">
                        <FileArchive size={11} />
                        <span>Armazenado em: backup-mercadodovale/db/{entry.id}.txt</span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SynologyFilesPage() {
    const [activeTab, setActiveTab] = useState<ActiveSection>('imagens');
    const [files, setFiles] = useState<Record<Folder, CDNFile[] | null>>({
        imagens: null, videos: null, arquivos: null,
    });
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [backupHistory, setBackupHistory] = useState<BackupEntry[] | null>(null);
    const [loadingBackups, setLoadingBackups] = useState(false);

    const currentTab = TABS.find(t => t.id === activeTab)!;

    const loadFiles = useCallback(async (folder: Folder) => {
        setLoading(true);
        try {
            const data = await vpsClient.get<CDNFile[]>(`/synology/files?folder=${folder}`);
            setFiles(prev => ({ ...prev, [folder]: data }));
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Erro';
            // "Folder not found" é esperado em modo local — não exibe toast
            if (!msg.includes('Folder not found') && !msg.includes('500')) {
                toast.error(`Erro ao listar arquivos: ${msg}`);
            }
            setFiles(prev => ({ ...prev, [folder]: [] }));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab !== 'backups' && files[activeTab as Folder] === null) {
            loadFiles(activeTab as Folder);
        }
    }, [activeTab, files, loadFiles]);

    useEffect(() => {
        if (activeTab === 'backups' && backupHistory === null) {
            setLoadingBackups(true);
            fetch('/backup-history.json')
                .then(r => r.json())
                .then((data: BackupEntry[]) => setBackupHistory([...data].reverse()))
                .catch(() => setBackupHistory([]))
                .finally(() => setLoadingBackups(false));
        }
    }, [activeTab, backupHistory]);

    async function handleDelete(folder: Folder, name: string) {
        try {
            await vpsClient.delete(`/synology/file?folder=${folder}&name=${encodeURIComponent(name)}`);
            toast.success(`"${name}" excluído!`);
            setFiles(prev => ({
                ...prev,
                [folder]: (prev[folder] || []).filter(f => f.name !== name),
            }));
        } catch (e: unknown) {
            toast.error(`Erro ao excluir: ${e instanceof Error ? e.message : 'Erro'}`);
            throw e;
        }
    }

    const currentFiles = files[activeTab];
    const filtered = currentFiles
        ? currentFiles.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
        : [];

    return (
        <div className="animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">CDN Synology</h2>
                    <p className="text-slate-500 text-sm mt-1">Gerencie arquivos nos CDNs do Synology NAS</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-6">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setSearch(''); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === tab.id
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                        {files[tab.id] !== null && (
                            <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">
                                {files[tab.id]!.length}
                            </span>
                        )}
                    </button>
                ))}
                {/* Aba Backups */}
                <button
                    onClick={() => { setActiveTab('backups'); setSearch(''); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'backups'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Shield size={16} />
                    Backups
                    {backupHistory !== null && (
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">
                            {backupHistory.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Conteúdo condicional por aba */}
            {activeTab === 'backups' ? (
                // ─── ABA BACKUPS ─────────────────────────────────────────────
                <div>
                    <div className="mb-5 flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                        <Shield size={16} className="text-green-600" />
                        <span className="text-sm text-green-800 font-medium">Histórico de backups gerados pelo script <code className="font-mono bg-green-100 px-1 rounded">backup-synology.cjs</code></span>
                        <button
                            onClick={() => { setBackupHistory(null); }}
                            className="ml-auto p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-all"
                            title="Atualizar"
                        >
                            <RefreshCw size={14} className={loadingBackups ? 'animate-spin' : ''} />
                        </button>

                    {/* Acesso rápido às pastas no SynologyDrive */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                        <button
                            onClick={() => {
                                const path = 'C:\\Users\\Nitro\\SynologyDrive\\SynologyDrive\\backup-mercadodovale\\imagens\\products';
                                navigator.clipboard.writeText(path);
                                toast.success('Caminho copiado! Cole no Explorador de Arquivos (Win+E).');
                            }}
                            className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
                        >
                            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                <Image size={18} className="text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800">📸 Imagens de Produtos</p>
                                <p className="text-xs text-slate-400 font-mono truncate">backup-mercadodovale/imagens/products/</p>
                            </div>
                            <Copy size={14} className="text-slate-400 shrink-0" />
                        </button>
                        <button
                            onClick={() => {
                                const path = 'C:\\Users\\Nitro\\SynologyDrive\\SynologyDrive\\backup-mercadodovale\\db';
                                navigator.clipboard.writeText(path);
                                toast.success('Caminho copiado! Cole no Explorador de Arquivos (Win+E).');
                            }}
                            className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl hover:border-green-300 hover:bg-green-50 transition-all text-left"
                        >
                            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                                <FileArchive size={18} className="text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800">📄 Changelogs / DB</p>
                                <p className="text-xs text-slate-400 font-mono truncate">backup-mercadodovale/db/</p>
                            </div>
                            <Copy size={14} className="text-slate-400 shrink-0" />
                        </button>
                    </div>
                    </div>

                    {loadingBackups ? (
                        <div className="space-y-3">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="bg-slate-100 rounded-xl h-28 animate-pulse" />
                            ))}
                        </div>
                    ) : !backupHistory || backupHistory.length === 0 ? (
                        <div className="text-center py-16 text-slate-400">
                            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <Shield size={28} />
                            </div>
                            <p className="font-medium">Nenhum backup registrado ainda</p>
                            <p className="text-sm mt-1">Execute: <code className="font-mono bg-slate-100 px-1 rounded">node backup-synology.cjs auto</code></p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {backupHistory.map(entry => (
                                <BackupCard key={entry.id} entry={entry} />
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                // ─── ABAS CDN (Imagens, Vídeos, Arquivos) ────────────────────
                <>
                    {/* CDN URL Info */}
                    <div className="mb-5 flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
                        <span className="text-blue-600 text-sm">🌐</span>
                        <span className="text-sm text-blue-800">CDN:</span>
                        <code className="text-sm text-blue-700 font-mono font-medium">https://{currentTab?.cdn}/</code>
                    </div>

                    {/* Upload Zone */}
                    {currentTab && (
                        <Dropzone
                            folder={activeTab as Folder}
                            accept={currentTab.accept}
                            onUploadDone={() => loadFiles(activeTab as Folder)}
                        />
                    )}

                    {/* File List Header */}
                    <div className="flex items-center justify-between mt-6 mb-4">
                        <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-slate-800">
                                {loading ? 'Carregando...' : `${filtered.length} arquivo(s)`}
                            </h3>
                            <button
                                onClick={() => loadFiles(activeTab as Folder)}
                                disabled={loading}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all disabled:opacity-40"
                                title="Atualizar"
                            >
                                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar arquivo..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg w-48 focus:outline-none focus:border-blue-400"
                        />
                    </div>

                    {/* File Grid */}
                    {loading && currentFiles === null ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="bg-slate-100 rounded-xl h-52 animate-pulse" />
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-16 text-slate-400">
                            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                {currentTab?.icon}
                            </div>
                            <p className="font-medium">
                                {search ? 'Nenhum arquivo encontrado' : 'Nenhum arquivo nesta pasta'}
                            </p>
                            <p className="text-sm mt-1">
                                {search ? 'Tente uma busca diferente' : 'Faça upload acima para começar'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {filtered.map(file => (
                                <FileCard
                                    key={file.name}
                                    file={file}
                                    onCopy={() => toast.success('URL copiada!')}
                                    onDelete={() => handleDelete(activeTab as Folder, file.name)}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
