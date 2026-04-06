import React, { useState, useRef, useEffect } from 'react';
import { Camera, Download, Upload, Image as ImageIcon, Sparkles, Smartphone, Layers, Plus, Search, X, Copy, PenTool, Heart, MessageCircle, Send, Bookmark, MoreHorizontal, CheckCircle2, Calendar, Trash2, Clock, ToggleLeft, ToggleRight, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';
import { catalogService } from '../../../services/catalogService';
import type { CatalogProduct } from '../../../types/catalog';
import { groupProductsByVariants } from '../../../services/productGrouping';
import { formatCurrency } from '../../../utils/saleCalculations';
import { useTheme } from '../../../contexts/ThemeContext';
import { getCompanyData } from '../../../services/companyService';
import { Company } from '../../../types/company';
import { instagramScheduleService, InstagramSlot, CONTENT_TYPE_LABELS, DAY_LABELS, ContentType } from '../../../services/instagramScheduleService';

const BACKGROUND_OPTIONS = [
    { id: 'dark', label: 'Dark Premium', class: 'bg-gradient-to-br from-slate-900 to-black' },
    { id: 'blue', label: 'Azul Profundo', class: 'bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900' },
    { id: 'purple', label: 'Roxo Neon', class: 'bg-gradient-to-br from-indigo-900 via-purple-900 to-black' },
    { id: 'orange', label: 'Laranja Oferta', class: 'bg-gradient-to-br from-orange-600 to-red-600' },
    { id: 'gold', label: 'Amarelo Ouro', class: 'bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500' },
    { id: 'gray', label: 'Cinza Metálico', class: 'bg-gradient-to-br from-slate-400 to-slate-600' },
    { id: 'emerald', label: 'Esmeralda Tech', class: 'bg-gradient-to-br from-teal-900 via-emerald-800 to-slate-900' },
    { id: 'pink', label: 'Rosa Pink', class: 'bg-gradient-to-br from-fuchsia-900 via-pink-600 to-rose-900' },
    { id: 'midnight', label: 'Meia Noite', class: 'bg-gradient-to-t from-slate-900 via-indigo-950 to-slate-900' },
    { id: 'white', label: 'Branco Clean', class: 'bg-white' },
];

const TagBadge = ({ tag, colorClass }: { tag: string, colorClass: string }) => (
    <code
        onClick={() => {
            navigator.clipboard.writeText(tag);
            toast.success(`${tag} copiada!`);
        }}
        className={`bg-slate-100 px-1.5 py-0.5 rounded cursor-pointer transition-transform hover:scale-105 active:scale-95 inline-block ${colorClass}`}
        title="Copiar tag para usar na legenda"
    >
        {tag}
    </code>
);

export default function MarketingPage() {
    const { settings } = useTheme();
    const [selectedBg, setSelectedBg] = useState(BACKGROUND_OPTIONS[0]);
    const [customBgUrl, setCustomBgUrl] = useState<string | null>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);
    const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
    const [companyInfo, setCompanyInfo] = useState<Company | null>(null);
    const [format, setFormat] = useState<'feed' | 'status'>('feed');
    const [activeTab, setActiveTab] = useState<'studio' | 'agenda'>('studio');

    // Agenda Instagram
    const [scheduleSlots, setScheduleSlots] = useState<InstagramSlot[]>([]);
    const [scheduleLoading, setScheduleLoading] = useState(false);
    const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
    const [editingSlot, setEditingSlot] = useState<InstagramSlot | null>(null);
    const [showSlotForm, setShowSlotForm] = useState(false);
    const [slotForm, setSlotForm] = useState<Partial<InstagramSlot & { id?: string }>>({
        day_of_week: new Date().getDay(),
        scheduled_time: '09:00',
        content_type: 'story' as ContentType,
        hook: '',
        caption: '',
        cta: '',
        hashtags: '',
        visual_notes: '',
        send_telegram_reminder: true,
        active: true,
        sort_order: 0
    });

    // Carregar dados reais da empresa (Telefone, Instagram, Watermark)
    const loadCompanyData = async () => {
        try {
            const data = await getCompanyData();
            setCompanyInfo(data);
        } catch (e) {
            console.error(e)
        }
    };

    useEffect(() => {
        loadCompanyData();

        // Sempre que o usuário voltar pra aba ou janela, atualiza os dados
        const handleFocus = () => loadCompanyData();
        window.addEventListener('focus', handleFocus);

        // Também tenta escutar um custom event, caso disparemos do Settings salvar
        const handleSettingsUpdate = () => loadCompanyData();
        window.addEventListener('company_settings_updated', handleSettingsUpdate);

        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('company_settings_updated', handleSettingsUpdate);
        };
    }, []);

    // Carregar agenda
    const loadSchedule = async () => {
        setScheduleLoading(true);
        try {
            const data = await instagramScheduleService.list();
            setScheduleSlots(data);
        } catch {
            toast.error('Erro ao carregar agenda');
        } finally {
            setScheduleLoading(false);
        }
    };

    useEffect(() => { loadSchedule(); }, []);

    const handleToggleSlotActive = async (slot: InstagramSlot) => {
        try {
            await instagramScheduleService.toggleActive(slot.id, !slot.active);
            setScheduleSlots(prev => prev.map(s => s.id === slot.id ? { ...s, active: !s.active } : s));
        } catch { toast.error('Erro ao atualizar slot'); }
    };

    const handleDeleteSlot = async (id: string) => {
        if (!window.confirm('Excluir este slot?')) return;
        try {
            await instagramScheduleService.delete(id);
            setScheduleSlots(prev => prev.filter(s => s.id !== id));
            toast.success('Slot excluído!');
        } catch { toast.error('Erro ao excluir slot'); }
    };

    const handleOpenNewSlot = () => {
        setEditingSlot(null);
        setSlotForm({
            day_of_week: selectedDay,
            scheduled_time: '09:00',
            content_type: 'story' as ContentType,
            hook: '', caption: '', cta: '', hashtags: '', visual_notes: '',
            send_telegram_reminder: true, active: true, sort_order: scheduleSlots.filter(s => s.day_of_week === selectedDay).length
        });
        setShowSlotForm(true);
    };

    const handleOpenEditSlot = (slot: InstagramSlot) => {
        setEditingSlot(slot);
        const nl = (s: string | null | undefined) => (s || '').replace(/\\n/g, '\n');
        setSlotForm({ ...slot, scheduled_time: slot.scheduled_time?.slice(0, 5), hook: nl(slot.hook), caption: nl(slot.caption), cta: nl(slot.cta), visual_notes: nl(slot.visual_notes) });

        setShowSlotForm(true);
    };

    const handleSaveSlot = async () => {
        try {
            const payload: any = { ...slotForm };
            if (editingSlot) {
                const updated = await instagramScheduleService.update(editingSlot.id, payload);
                setScheduleSlots(prev => prev.map(s => s.id === editingSlot.id ? updated : s));
                toast.success('Slot atualizado!');
            } else {
                const created = await instagramScheduleService.create(payload);
                setScheduleSlots(prev => [...prev, created]);
                toast.success('Slot criado!');
            }
            setShowSlotForm(false);
            setEditingSlot(null);
        } catch { toast.error('Erro ao salvar slot'); }
    };

    // Produto Logic
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
    const [generatedCopy, setGeneratedCopy] = useState('');
    const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());

    // Copywrighting Template Logic
    const [isEditingTemplate, setIsEditingTemplate] = useState(false);
    const [captionTemplate, setCaptionTemplate] = useState('');

    useEffect(() => {
        const savedTemplate = localStorage.getItem('marketing_caption_template');
        if (savedTemplate) {
            setCaptionTemplate(savedTemplate);
        } else {
            setCaptionTemplate(`🔥 OPORTUNIDADE! Máquina em mãos! \n\nO {produto} acabou de chegar e está disponível no nosso catálogo! \n\n✨ Tecnologia de ponta com um design premium que você merece.\n\n🏃‍♂️ Garanta já o seu antes que o estoque acabe!\n\n🔗 Compre Direto no Site:\n{link}\n\n👉 Ou tire dúvidas pelo WhatsApp {whatsapp}.\n\n#{marca} #{hashtag} #{instagram} #Tecnologia #Ofertas`);
        }
    }, []);

    const saveTemplate = () => {
        localStorage.setItem('marketing_caption_template', captionTemplate);
        setIsEditingTemplate(false);
        toast.success('Modelo de legenda salvo com sucesso!');
    };

    // Category & Grouping Logic
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);
    const [groupedResults, setGroupedResults] = useState<any[]>([]);

    useEffect(() => {
        catalogService.getCategoriesWithNames().then(setCategories);
    }, []);


    // Gera a Copy Mágica sempre que o produto, template ou empresa mudar
    useEffect(() => {
        if (!selectedProduct || !captionTemplate) {
            setGeneratedCopy('');
            return;
        }

        const precoBaseCents = selectedProduct.price_retail || 0;
        const parcelas = formatCurrency(Math.floor((precoBaseCents * 1.15) / 12));
        const vista = formatCurrency(precoBaseCents);
        const nomeEmpresa = settings.company_name || 'Mercado do Vale';

        let whatsEmpresa = '(11) 99999-9999';
        if (companyInfo?.phone) {
            whatsEmpresa = companyInfo.phone;
        }

        let insta = nomeEmpresa.replace(/\s+/g, '');
        if (companyInfo?.socialMedia?.instagram) {
            const rawInsta = companyInfo.socialMedia.instagram;
            const match = rawInsta.match(/(?:instagram\.com\/|@)([a-zA-Z0-9_\.]+)/);
            if (match && match[1]) {
                insta = match[1];
            } else {
                insta = rawInsta.replace(/[^a-zA-Z0-9_\.]/g, '');
            }
        }

        const marcaTag = selectedProduct.brand ? selectedProduct.brand.replace(/\s+/g, '') : 'Smartphone';
        const hashtagTag = selectedProduct.name.split(' ').slice(0, 2).join('').replace(/[^a-zA-Z0-9]/g, '');
        const productLink = `${window.location.origin}/?search=${encodeURIComponent(selectedProduct.name)}`;

        const catName = categories.find(c => c.id === selectedProduct.category_id)?.name || 'Eletro';
        const specsRam = selectedProduct.specs?.ram || '';
        const specsStorage = selectedProduct.specs?.storage || '';
        const specsBattery = selectedProduct.specs?.battery || '';
        const specsProcessor = selectedProduct.specs?.processor || '';

        // Remove as tags HTML que vêm do rich-text da descrição original do aparelho
        const rawDesc = selectedProduct.description || 'Descrição completa no nosso site!';
        const descriptionTxt = rawDesc.replace(/<[^>]*>?/gm, '').trim();

        let finalCopy = captionTemplate
            .replace(/{produto}/g, selectedProduct.name)
            .replace(/{marca}/g, marcaTag)
            .replace(/{categoria}/g, catName)
            .replace(/{preco_vista}/g, vista)
            .replace(/{preco_parcelado}/g, parcelas)
            .replace(/{link}/g, productLink)
            .replace(/{whatsapp}/g, whatsEmpresa)
            .replace(/{instagram}/g, insta)
            .replace(/{hashtag}/g, hashtagTag)
            .replace(/{ram}/g, specsRam)
            .replace(/{armazenamento}/g, specsStorage)
            .replace(/{bateria}/g, specsBattery)
            .replace(/{processador}/g, specsProcessor)
            .replace(/{descricao}/g, descriptionTxt);

        setGeneratedCopy(finalCopy);
    }, [selectedProduct, settings, companyInfo, captionTemplate, categories]);

    // Debounced Search & Category Fetch
    useEffect(() => {
        if ((!searchQuery || searchQuery.length < 2) && !selectedCategory) {
            setGroupedResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                // Get full products to get the injected images from catalogService
                const res = await catalogService.getProducts({
                    search: searchQuery || undefined,
                    categories: selectedCategory ? [selectedCategory] : undefined
                }, 1, 30);

                // Agrupar produtos pelas variantes para não repetir cores do mesmo modelo
                const grouped = groupProductsByVariants(res.products);
                setGroupedResults(grouped);
                setBulkSelectedIds(new Set());
            } catch (err) {
                console.error(err);
            } finally {
                setIsSearching(false);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, selectedCategory]);

    // Export to Image Logic
    const handleDownload = async () => {
        if (!canvasRef.current) return;

        try {
            setIsGenerating(true);
            const width = 1080;
            const height = format === 'feed' ? 1080 : 1920;

            const dataUrl = await toPng(canvasRef.current, {
                cacheBust: true,
                pixelRatio: 1, // Não precisamos de 2x pq a lona já é 1080/1920 nativa
                quality: 1.0,
                canvasWidth: width,
                canvasHeight: height,
                fetchRequest: {
                    cache: 'no-cache',
                }
            });

            const link = document.createElement('a');
            link.download = `oferta-${selectedProduct?.name ? selectedProduct.name.replace(/\s+/g, '-').toLowerCase() : 'marketing'}.png`;
            link.href = dataUrl;
            link.click();

            toast.success('Arte gerada e baixada com sucesso! 🚀');
        } catch (err) {
            console.error('Falha ao gerar imagem', err);
            toast.error('Ocorreu um erro ao gerar a arte, tente novamente.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleBulkDownload = async () => {
        if (!canvasRef.current || bulkSelectedIds.size === 0) return;

        const productsToGenerate = groupedResults
            .map(g => g.representativeProduct)
            .filter(p => bulkSelectedIds.has(p.id));

        if (productsToGenerate.length === 0) return;

        setIsGeneratingBulk(true);
        setBulkProgress({ current: 0, total: productsToGenerate.length });

        // Salva o produto que estava no palco para não perder a referência do usuário
        const productOnStage = selectedProduct;

        try {
            const width = 1080;
            const height = format === 'feed' ? 1080 : 1920;

            for (let i = 0; i < productsToGenerate.length; i++) {
                const product = productsToGenerate[i];

                // Força o componente a renderizar este produto no palco
                setSelectedProduct(product);

                // Aguarda o DOM reagir e as imagens de internet carregarem (1.5 segundos de respiro)
                await new Promise(resolve => setTimeout(resolve, 1500));

                // Se a referência sumir no meio do caminho (usuário saiu da tela), aborta
                if (!canvasRef.current) break;

                const dataUrl = await toPng(canvasRef.current, {
                    cacheBust: true,
                    pixelRatio: 1,
                    quality: 1.0,
                    canvasWidth: width,
                    canvasHeight: height,
                    fetchRequest: {
                        cache: 'no-cache',
                    }
                });

                const link = document.createElement('a');
                link.download = `oferta-${product.name.replace(/\s+/g, '-').toLowerCase()}.png`;
                link.href = dataUrl;
                link.click();

                setBulkProgress({ current: i + 1, total: productsToGenerate.length });

                // Pausa antes do próximo download pra não travar o navegador
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            toast.success(`Lote gerado com sucesso! ${productsToGenerate.length} imagens baixadas.`);
            setBulkSelectedIds(new Set()); // Limpa selecoes apos o download

        } catch (error) {
            console.error('Erro ao gerar lote:', error);
            toast.error('Ocorreu um erro gerando o lote. Processo interrompido.');
        } finally {
            setIsGeneratingBulk(false);
            // Devolve pro palco o produto original que o usuário estava editando
            if (productOnStage) setSelectedProduct(productOnStage);
        }
    };

    const handleCustomBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Basic validation
        if (!file.type.startsWith('image/')) {
            toast.error('Por favor, envie apenas imagens (JPG, PNG).');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            if (typeof event.target?.result === 'string') {
                setCustomBgUrl(event.target.result);
                toast.success('Fundo customizado aplicado!');
            }
        };
        reader.readAsDataURL(file);
    };

    const handleClearCustomBg = () => {
        setCustomBgUrl(null);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Cabeçalho */}
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-pink-50 rounded-xl">
                    <Sparkles className="w-6 h-6 text-pink-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Estúdio de Marketing</h1>
                    <p className="text-sm text-slate-500">Crie artes, baixe em lote e gerencie o cronograma do Instagram</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Menu Lateral */}
                <div className="w-full md:w-64 flex-shrink-0 bg-white border border-slate-200 rounded-2xl p-3 shadow-sm sticky top-24">
                    <nav className="flex flex-col gap-1.5">
                        <button
                            onClick={() => setActiveTab('studio')}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'studio'
                                ? 'bg-blue-50 text-blue-800 shadow-sm border border-blue-200/60'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Sparkles className={`w-5 h-5 ${activeTab === 'studio' ? 'text-blue-600' : 'text-slate-400'}`} />
                                Gerador de Arte
                            </div>
                            {activeTab === 'studio' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                        </button>

                        <button
                            onClick={() => setActiveTab('agenda')}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'agenda'
                                ? 'bg-blue-50 text-blue-800 shadow-sm border border-blue-200/60'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Calendar className={`w-5 h-5 ${activeTab === 'agenda' ? 'text-blue-600' : 'text-slate-400'}`} />
                                Agenda Semanal
                            </div>
                            {activeTab === 'agenda' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                        </button>
                    </nav>
                </div>

                {/* Conteúdo Principal */}
                <div className="flex-1 min-w-0 space-y-6">

                    {activeTab === 'studio' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Toolbar */}
                            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                                    <button
                                        onClick={() => setFormat('feed')}
                                        className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${format === 'feed' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Feed (1:1)
                                    </button>
                                    <button
                                        onClick={() => setFormat('status')}
                                        className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${format === 'status' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Status (9:16)
                                    </button>
                                </div>

                                <button
                                    onClick={handleDownload}
                                    disabled={isGenerating || (!selectedProduct && !customBgUrl)}
                                    className="bg-pink-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-pink-700 transition-colors disabled:opacity-50"
                                >
                                    <Download className="w-5 h-5" />
                                    {isGenerating ? 'Gerando...' : 'Baixar Arte'}
                                </button>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                                {/* LADO ESQUERDO: Controles (4 Colunas) */}
                                <div className="lg:col-span-4 space-y-6">

                                    {/* Bloco 1: Seleção de Fundo */}
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                                        <h2 className="text-sm font-bold flex items-center gap-2 mb-4 text-slate-800">
                                            <Layers className="w-4 h-4 text-pink-500" />
                                            1. Fundo da Arte
                                        </h2>

                                        <div className="space-y-4">
                                            {/* Option A: Cores/Gradientes Padrão */}
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Fundos Catálogo</label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {BACKGROUND_OPTIONS.map(bg => (
                                                        <button
                                                            key={bg.id}
                                                            onClick={() => {
                                                                setSelectedBg(bg);
                                                                handleClearCustomBg(); // Se clicou numa cor limpa o bg customizado
                                                            }}
                                                            className={`h-12 rounded-lg border-2 transition-all ${bg.class} ${(!customBgUrl && selectedBg.id === bg.id)
                                                                ? 'border-pink-500 ring-2 ring-pink-500/20 scale-105 shadow-md'
                                                                : 'border-transparent hover:scale-105 opacity-80 hover:opacity-100'
                                                                }`}
                                                            title={bg.label}
                                                        />
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Option B: Fundo Customizado (Lifestyle) */}
                                            <div className="pt-2">
                                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Ou Fundo Personalizado (Lifestyle)</label>
                                                {customBgUrl ? (
                                                    <div className="relative h-24 rounded-lg overflow-hidden group border border-slate-200">
                                                        <img src={customBgUrl} alt="Background" className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <button
                                                                onClick={handleClearCustomBg}
                                                                className="text-white text-xs font-bold bg-red-500 px-3 py-1 rounded shadow"
                                                            >
                                                                Remover
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 hover:border-pink-400 transition-colors">
                                                        <Upload className="w-6 h-6 text-slate-400 mb-2" />
                                                        <span className="text-xs font-semibold text-slate-600">Fazer Upload (Foto de Fundo)</span>
                                                        <span className="text-[10px] text-slate-400 text-center mt-1">Dica: Selecione uma foto real segurando o aparelho ou no cenário da loja.</span>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={handleCustomBgUpload}
                                                        />
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bloco 2: Seleção de Produto */}
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                                        <h2 className="text-sm font-bold flex items-center gap-2 mb-4 text-slate-800">
                                            <Smartphone className="w-4 h-4 text-blue-500" />
                                            2. Aparelho e Seleção em Lote
                                        </h2>

                                        <div className="space-y-3">
                                            {/* Seleção do Produto Principal (Preview) */}
                                            {selectedProduct && (
                                                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 relative group mb-4">
                                                    <button
                                                        onClick={() => setSelectedProduct(null)}
                                                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow hover:bg-red-600 transition-colors z-10"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                    <div className="flex items-center gap-3">
                                                        {selectedProduct.images && selectedProduct.images[0] ? (
                                                            <div className="w-12 h-12 bg-white rounded shadow-sm flex items-center justify-center p-1">
                                                                <img src={selectedProduct.images[0]} crossOrigin="anonymous" alt={selectedProduct.name} className="max-w-full max-h-full object-contain" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-12 h-12 bg-slate-200 rounded flex items-center justify-center"><Smartphone className="w-5 h-5 text-slate-400" /></div>
                                                        )}
                                                        <div>
                                                            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Produto no Palco (Preview)</p>
                                                            <p className="text-sm font-bold text-slate-800 line-clamp-1">{selectedProduct.name}</p>
                                                            <p className="text-xs font-bold text-green-600">
                                                                R$ {formatCurrency(selectedProduct.price_retail || 0)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Busca e Lista */}
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Buscar ou filtrar..."
                                                        value={searchQuery}
                                                        onChange={e => setSearchQuery(e.target.value)}
                                                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 outline-none"
                                                    />
                                                    {isSearching && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />}
                                                </div>
                                                <select
                                                    value={selectedCategory}
                                                    onChange={e => setSelectedCategory(e.target.value)}
                                                    className="py-2 px-3 border border-slate-200 rounded-lg text-sm outline-none bg-white text-slate-700 w-1/3 truncate"
                                                >
                                                    <option value="">Todas</option>
                                                    {categories.map(cat => (
                                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Botao de Lote e Lista de Selecionaveis */}
                                            {groupedResults.length > 0 && (
                                                <>
                                                    <div className="flex justify-between items-end px-1 mt-2">
                                                        <span className="text-xs font-semibold text-slate-500">{groupedResults.length} modelos listados</span>
                                                        <button
                                                            onClick={() => {
                                                                if (bulkSelectedIds.size === groupedResults.length) {
                                                                    setBulkSelectedIds(new Set());
                                                                } else {
                                                                    setBulkSelectedIds(new Set(groupedResults.map(g => g.representativeProduct.id)));
                                                                }
                                                            }}
                                                            className="text-[11px] font-bold text-purple-600 hover:text-purple-700 hover:underline"
                                                        >
                                                            {bulkSelectedIds.size === groupedResults.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                                                        </button>
                                                    </div>

                                                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[220px] overflow-y-auto bg-white shadow-inner">
                                                        {groupedResults.map(group => {
                                                            const p = group.representativeProduct;
                                                            const isSelectedPreview = selectedProduct?.id === p.id;
                                                            const isChecked = bulkSelectedIds.has(p.id);
                                                            return (
                                                                <div
                                                                    key={group.groupKey}
                                                                    className={`w-full flex items-center gap-3 p-2 transition-colors ${isSelectedPreview ? 'bg-purple-50' : 'hover:bg-slate-50'}`}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={(e) => {
                                                                            const newSet = new Set(bulkSelectedIds);
                                                                            if (e.target.checked) newSet.add(p.id);
                                                                            else newSet.delete(p.id);
                                                                            setBulkSelectedIds(newSet);
                                                                        }}
                                                                        className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer ml-1"
                                                                    />
                                                                    <div
                                                                        onClick={() => setSelectedProduct(p)}
                                                                        className="flex-1 flex items-center gap-3 text-left cursor-pointer"
                                                                        title="Clique para enviar este modelo para o Palco de Preview"
                                                                    >
                                                                        {p.images && p.images[0] ? (
                                                                            <img src={p.images[0]} crossOrigin="anonymous" alt={group.model} className="w-8 h-8 object-contain rounded" />
                                                                        ) : (
                                                                            <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center"><Smartphone className="w-4 h-4 text-slate-400" /></div>
                                                                        )}
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className={`text-xs font-bold truncate flex items-center gap-2 ${isSelectedPreview ? 'text-purple-700' : 'text-slate-800'}`}>
                                                                                <span className="truncate">{group.model}</span>
                                                                                {p.specs?.ram && p.specs?.storage && (
                                                                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded whitespace-nowrap">
                                                                                        {p.specs.ram}/{p.specs.storage}
                                                                                    </span>
                                                                                )}
                                                                            </p>
                                                                            <p className="text-[10px] text-slate-500">
                                                                                {group.variants.length > 1 ? `A partir de R$ ${formatCurrency(group.globalPriceRange?.min || 0)}` : `R$ ${formatCurrency(p.price_retail || 0)}`}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </>
                                            )}

                                            {bulkSelectedIds.size > 0 && (
                                                <button
                                                    onClick={handleBulkDownload}
                                                    disabled={isGeneratingBulk}
                                                    className="w-full flex items-center justify-center gap-2 py-3 mt-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-sm font-bold rounded-lg transition-all shadow-md active:scale-[0.98] disabled:opacity-70"
                                                >
                                                    <Layers className="w-5 h-5" />
                                                    {isGeneratingBulk
                                                        ? `Gerando lote... (${bulkProgress.current}/${bulkProgress.total})`
                                                        : `Baixar os ${bulkSelectedIds.size} Selecionados`
                                                    }
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bloco 3: Copywriting (Legenda) */}
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mt-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h2 className="text-sm font-bold flex items-center gap-2 text-slate-800">
                                                <PenTool className="w-4 h-4 text-purple-500" />
                                                3. Legenda Automática
                                            </h2>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        if (isEditingTemplate) saveTemplate();
                                                        else setIsEditingTemplate(true);
                                                    }}
                                                    className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-colors ${isEditingTemplate ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                                >
                                                    {isEditingTemplate ? 'Salvar Modelo' : 'Editar Modelo'}
                                                </button>
                                                {generatedCopy && !isEditingTemplate && (
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(generatedCopy);
                                                            toast.success('Legenda copiada para a área de transferência!');
                                                        }}
                                                        className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-md hover:bg-purple-100 transition-colors font-semibold"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" /> Copiar
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {isEditingTemplate ? (
                                            <div className="space-y-3">
                                                <p className="text-[11px] text-slate-500 leading-relaxed flex flex-wrap gap-1.5 items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                    <span className="font-bold mr-1 w-full text-slate-700">Tags Básicas:</span>
                                                    <TagBadge tag="{produto}" colorClass="text-pink-600" />
                                                    <TagBadge tag="{marca}" colorClass="text-pink-600" />
                                                    <TagBadge tag="{categoria}" colorClass="text-pink-600" />
                                                    <TagBadge tag="{preco_vista}" colorClass="text-pink-600" />
                                                    <TagBadge tag="{preco_parcelado}" colorClass="text-pink-600" />

                                                    <span className="font-bold mr-1 w-full mt-1 text-slate-700">Tags Técnicas:</span>
                                                    <TagBadge tag="{ram}" colorClass="text-indigo-600" />
                                                    <TagBadge tag="{armazenamento}" colorClass="text-indigo-600" />
                                                    <TagBadge tag="{bateria}" colorClass="text-indigo-600" />
                                                    <TagBadge tag="{processador}" colorClass="text-indigo-600" />
                                                    <TagBadge tag="{descricao}" colorClass="text-amber-600" />

                                                    <span className="font-bold mr-1 w-full mt-1 text-slate-700">Contatos:</span>
                                                    <TagBadge tag="{link}" colorClass="text-emerald-600" />
                                                    <TagBadge tag="{whatsapp}" colorClass="text-emerald-600" />
                                                    <TagBadge tag="{instagram}" colorClass="text-emerald-600" />
                                                </p>
                                                <textarea
                                                    value={captionTemplate}
                                                    onChange={(e) => setCaptionTemplate(e.target.value)}
                                                    className="w-full h-48 p-3 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none leading-relaxed"
                                                    placeholder="Escreva seu modelo com variáveis..."
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                {!selectedProduct ? (
                                                    <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                                                        <p className="text-xs text-slate-400">Selecione um produto para gerar uma legenda persuasiva e ver o resultado do seu modelo.</p>
                                                    </div>
                                                ) : (
                                                    <textarea
                                                        value={generatedCopy}
                                                        onChange={(e) => setGeneratedCopy(e.target.value)}
                                                        className="w-full h-48 p-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg outline-none resize-none leading-relaxed"
                                                    />
                                                )}
                                            </>
                                        )}
                                    </div>

                                </div>

                                {/* LADO DIREITO: O Palco (8 Colunas) */}
                                <div className="lg:col-span-8 flex flex-col items-center justify-center bg-slate-200/50 rounded-2xl border-2 border-dashed border-slate-300 p-8 min-h-[600px] overflow-hidden relative">

                                    {/* O Palco Visível (A Janela Responsiva que esconde o que vaza do Zoom) */}
                                    <div
                                        className={`relative shadow-2xl bg-white overflow-hidden transition-all duration-300 origin-top flex-shrink-0 flex items-center justify-center
                            ${format === 'feed' ? 'aspect-square w-[432px] rounded-xl ring-1 ring-slate-200' : 'aspect-[9/16] w-[324px] rounded-3xl ring-4 ring-slate-200'}`}
                                    >

                                        {/* O Motor Real: Elemento GIGANTE e fixo em 1080x1080 ou 1080x1920 (Tamanho Nativo) */}
                                        {/* Usamos o ResizeObserver puro do CSS transform para caber no parente */}
                                        <div
                                            className="absolute top-0 left-0 origin-top-left"
                                            style={{
                                                width: '1080px',
                                                height: format === 'feed' ? '1080px' : '1920px',
                                                transform: format === 'feed' ? 'scale(0.40)' : 'scale(0.30)',
                                            }}
                                        >

                                            <div
                                                ref={canvasRef}
                                                className={`w-[1080px] ${format === 'feed' ? 'h-[1080px]' : 'h-[1920px]'} flex flex-col items-center justify-center relative bg-white ${!customBgUrl ? selectedBg.class : ''}`}
                                                style={customBgUrl ? {
                                                    backgroundImage: `url(${customBgUrl})`,
                                                    backgroundSize: 'cover',
                                                    backgroundPosition: 'center'
                                                } : {}}
                                            >
                                                {/* Conteúdo Placeholder */}
                                                {!selectedProduct && !customBgUrl && (
                                                    <div className="text-center space-y-8">
                                                        <ImageIcon className="w-48 h-48 mx-auto text-white/20" />
                                                        <h3 className="text-white/50 font-bold text-5xl tracking-widest uppercase">{settings.company_name || 'MERCADO DO VALE'}</h3>
                                                    </div>
                                                )}

                                                {!selectedProduct && customBgUrl && (
                                                    <div className="absolute inset-0 bg-black/20 flex flex-col items-center justify-center">
                                                        <h3 className="text-white font-bold text-5xl tracking-widest uppercase shadow-black/50 drop-shadow-lg">{settings.company_name || 'MERCADO DO VALE'}</h3>
                                                    </div>
                                                )}

                                                {/* A ARTE RENDERIZADA AO VIVO (Tamanhos Grandes Oficiais em PX/REM) */}
                                                {selectedProduct && (
                                                    <div className={`absolute inset-0 flex flex-col ${format === 'feed' ? 'p-12 lg:p-16' : 'p-16 lg:p-24 pt-32 pb-48'}`}>

                                                        {/* Módulo Superior: Imagem num Bloco Branco */}
                                                        <div className={`relative flex-1 ${format === 'status' ? 'rounded-[4rem]' : 'rounded-[4rem]'} mb-6 shadow-2xl flex items-center justify-center overflow-visible ${customBgUrl ? '' : 'bg-white'} ${format === 'feed' ? 'mt-[100px]' : ''}`}>

                                                            {/* Gatilho Flutuante removido à pedido */}

                                                            {/* Imagem */}
                                                            {selectedProduct.images?.[0] && (
                                                                <img
                                                                    src={selectedProduct.images[0]}
                                                                    crossOrigin="anonymous"
                                                                    alt="Aparelho"
                                                                    className={`max-w-[80%] max-h-[80%] object-contain ${customBgUrl ? 'drop-shadow-2xl' : 'mix-blend-multiply'}`}
                                                                />
                                                            )}
                                                        </div>

                                                        {/* Logo Centralizada Entre os Módulos */}
                                                        <div className="relative z-30 flex justify-center items-center pointer-events-none" style={{ height: 0 }}>
                                                            <div className={`absolute bg-white rounded-full shadow-xl flex items-center justify-center p-5 border-[8px] border-slate-100 ${format === 'status' ? 'w-56 h-56 -top-36' : 'w-44 h-44 -top-28'}`} style={format === 'feed' ? { top: '-7rem' } : undefined}>
                                                                {(companyInfo?.watermarkLogoUrl || settings.logo_url) ? (
                                                                    <img
                                                                        src={companyInfo?.watermarkLogoUrl || settings.logo_url}
                                                                        crossOrigin="anonymous"
                                                                        alt="Logo Central"
                                                                        className="w-full h-full object-contain"
                                                                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                                                                    />
                                                                ) : (
                                                                    <span className={`font-black italic text-slate-800 uppercase text-center leading-tight ${format === 'status' ? 'text-3xl' : 'text-2xl'}`}>
                                                                        {settings.company_name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Módulo Inferior: Textos e Preços num Bloco Branco Fixo na Base */}
                                                        <div className={`bg-white ${format === 'status' ? 'rounded-[4rem] px-16 pb-16 pt-24' : 'rounded-[3rem] px-10 pb-10 pt-16 mt-auto'} shadow-2xl relative shrink-0 overflow-hidden box-border ${format === 'feed' ? 'mb-[150px]' : ''}`}>
                                                            <h2 className={`${format === 'status' ? 'text-6xl text-center' : 'text-5xl text-center'} font-black text-slate-800 uppercase tracking-tight leading-tight flex flex-col items-center gap-3`}>
                                                                <span className="line-clamp-2">{selectedProduct.name}</span>
                                                                {selectedProduct.specs?.ram && selectedProduct.specs?.storage && (
                                                                    <span className={`${format === 'status' ? 'text-3xl' : 'text-2xl'} bg-slate-100 text-slate-600 px-4 py-2 rounded-2xl tracking-normal`}>
                                                                        {selectedProduct.specs.ram} / {selectedProduct.specs.storage}
                                                                    </span>
                                                                )}
                                                            </h2>

                                                            <div className="h-3 w-32 bg-pink-500 rounded-full my-8 mx-auto" />

                                                            {format === 'status' ? (
                                                                <div className="flex flex-col gap-4 relative z-10 items-center text-center">
                                                                    <div className="flex flex-col items-center">
                                                                        <p className="text-2xl border-b-[4px] border-green-200 pb-2 w-max font-bold text-green-700 mb-2">Por apenas:</p>
                                                                        <div className="flex items-baseline gap-2">
                                                                            <span className="text-[7.5rem] font-black text-green-600 tracking-tighter leading-none mt-2">
                                                                                {formatCurrency(selectedProduct.price_retail || 0)}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-2xl font-bold mt-4 text-slate-500 bg-slate-100 border-2 border-slate-200 px-6 py-3 rounded-xl inline-block">
                                                                            À vista (PIX)
                                                                        </p>
                                                                    </div>

                                                                    <div className="mt-6 text-3xl text-slate-500 font-bold border-t-2 border-slate-100 pt-6 w-full text-center">
                                                                        <span>Ou até 12x de </span>
                                                                        <span className="text-slate-800">{formatCurrency(Math.floor(((selectedProduct.price_retail || 0) * 1.15) / 12))}</span>
                                                                        <span> no cartão</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col gap-4 relative z-10 w-full">
                                                                    {/* Especificações Técnicas Estilo Catálogo */}
                                                                    <div className="grid grid-cols-2 gap-4 w-full">
                                                                        {selectedProduct.specs?.ram && (
                                                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col">
                                                                                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Memória RAM</span>
                                                                                <span className="text-2xl font-black text-slate-800">{selectedProduct.specs.ram}</span>
                                                                            </div>
                                                                        )}
                                                                        {selectedProduct.specs?.storage && (
                                                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col">
                                                                                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Armazenamento</span>
                                                                                <span className="text-2xl font-black text-slate-800">{selectedProduct.specs.storage}</span>
                                                                            </div>
                                                                        )}
                                                                        {selectedProduct.specs?.battery && (
                                                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col">
                                                                                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Bateria</span>
                                                                                <span className="text-2xl font-black text-slate-800">{selectedProduct.specs.battery}</span>
                                                                            </div>
                                                                        )}
                                                                        {selectedProduct.specs?.processor && (
                                                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col">
                                                                                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Processador</span>
                                                                                <span className="text-2xl font-black text-slate-800 truncate" title={selectedProduct.specs.processor}>{selectedProduct.specs.processor}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Etiqueta de disponibilidade em cores variadas se for agrupado */}
                                                                    <div className="bg-green-50 border border-green-200 rounded-2xl p-4 w-full flex items-center gap-3">
                                                                        <CheckCircle2 className="w-8 h-8 text-green-500 shrink-0" />
                                                                        <div className="flex flex-col">
                                                                            <span className="text-lg font-bold text-green-800 leading-tight">Catalogo Completo</span>
                                                                            <span className="text-sm text-green-700 leading-tight">Cores e Variações Detalhadas no Site</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                    </div>
                                                )}
                                            </div>

                                            {/* ========================================================== */}
                                            {/* OVERLAY DE SIMULAÇÃO INSTAGRAM (FORA DO DOWNLOAD DA FOTO!) */}
                                            {/* ========================================================== */}

                                            {/* 1. Overlay FEED */}
                                            {format === 'feed' && (
                                                <>
                                                    {/* Cabeçalho Instagram */}
                                                    <div className="absolute top-0 left-0 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 px-8 py-5 flex items-center justify-between z-50">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-14 h-14 rounded-full bg-slate-200 border-2 border-pink-500 p-0.5 overflow-hidden shrink-0">
                                                                {settings.logo_url && <img src={settings.logo_url} className="w-full h-full object-cover rounded-full" alt="Perfil" />}
                                                            </div>
                                                            <div className="flex flex-col text-left">
                                                                <span className="font-bold text-2xl text-slate-800 tracking-tight leading-tight">{settings.company_name || 'Instagram'}</span>
                                                                <span className="text-lg text-slate-500 leading-tight">Patrocinado</span>
                                                            </div>
                                                        </div>
                                                        <MoreHorizontal className="w-10 h-10 text-slate-500" />
                                                    </div>

                                                    {/* Rodapé Instagram */}
                                                    <div className="absolute bottom-0 left-0 w-full bg-white/95 backdrop-blur-md px-8 pt-5 pb-8 flex flex-col gap-5 z-50 text-left">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex gap-8">
                                                                <Heart className="w-10 h-10 text-slate-800" />
                                                                <MessageCircle className="w-10 h-10 text-slate-800" />
                                                                <Send className="w-10 h-10 text-slate-800" />
                                                            </div>
                                                            <Bookmark className="w-10 h-10 text-slate-800" />
                                                        </div>
                                                        <div className="flex flex-col gap-3 mt-4">
                                                            <span className="font-bold text-lg text-slate-800">1.240 curtidas</span>
                                                            <p className="text-base text-slate-800">
                                                                <strong className="mr-2">{settings.company_name?.replace(/\s+/g, '').toLowerCase() || 'sua_loja'}</strong>
                                                                <span className="whitespace-pre-line line-clamp-2" title={generatedCopy || 'Aproveite essa promoção incrível e exclusiva! 🔥 Entregamos na mesma hora.'}>
                                                                    {generatedCopy || 'Aproveite essa promoção incrível e exclusiva! 🔥 Entregamos na mesma hora.'}
                                                                </span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {/* 2. Overlay STATUS / STORIES */}
                                            {format === 'status' && (
                                                <>
                                                    <div className="absolute top-0 left-0 w-full p-8 flex flex-col gap-6 z-50 pointer-events-none bg-gradient-to-b from-black/60 via-black/20 to-transparent pb-32">
                                                        <div className="w-full flex gap-3">
                                                            <div className="h-2 bg-white/40 rounded-full flex-1 overflow-hidden"><div className="w-1/3 h-full bg-white rounded-full bg-white" /></div>
                                                            <div className="h-2 bg-white/40 rounded-full flex-1" />
                                                        </div>
                                                        <div className="flex items-center justify-between text-white">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-16 h-16 rounded-full bg-slate-200 border-2 border-white overflow-hidden shadow-lg shrink-0">
                                                                    {settings.logo_url && <img src={settings.logo_url} className="w-full h-full object-cover" alt="Perfil" />}
                                                                </div>
                                                                <span className="font-bold text-2xl drop-shadow-md">{settings.company_name || 'Instagram'}</span>
                                                                <span className="text-xl opacity-80 font-medium">10 h</span>
                                                            </div>
                                                            <div className="flex gap-6 items-center">
                                                                <MoreHorizontal className="w-10 h-10 drop-shadow-md" />
                                                                <X className="w-12 h-12 drop-shadow-md" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="absolute bottom-0 left-0 w-full p-10 flex items-center gap-6 z-50 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-32">
                                                        <div className="flex-1 rounded-full border-2 border-white/40 bg-black/20 backdrop-blur-md px-8 py-5 text-white/90 font-medium text-2xl flex items-center text-left">
                                                            Enviar mensagem...
                                                        </div>
                                                        <Heart className="w-12 h-12 text-white drop-shadow-lg" />
                                                        <Send className="w-12 h-12 text-white drop-shadow-lg" />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <p className="text-slate-500 text-sm font-medium mt-6 flex items-center gap-2">
                                        <Camera className="w-4 h-4" /> Preview Ao Vivo ({format === 'feed' ? '1080x1080' : '1080x1920'} Escalonado)
                                    </p>
                                </div>

                            </div>
                        </div>
                    )}
                    {/* ═══════════ AGENDA SEMANAL ═══════════ */}
                    {activeTab === 'agenda' && (
                        <div className="space-y-6 animate-in fade-in duration-300">

                            {/* Day Selector */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                                <div className="flex gap-1 overflow-x-auto pb-1">
                                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, i) => {
                                        const count = scheduleSlots.filter(s => s.day_of_week === i && s.active).length;
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => setSelectedDay(i)}
                                                className={`flex flex-col items-center px-4 py-2.5 rounded-lg text-sm font-bold transition-all min-w-[60px] ${selectedDay === i
                                                    ? 'bg-pink-600 text-white shadow-md'
                                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                                                    }`}
                                            >
                                                <span>{d}</span>
                                                {count > 0 && (
                                                    <span className={`text-[10px] mt-0.5 font-semibold ${selectedDay === i ? 'text-pink-100' : 'text-pink-500'}`}>
                                                        {count} post{count > 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Slots do Dia + Botão Adicionar */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-pink-500" />
                                        {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][selectedDay]}
                                        <span className="text-sm font-normal text-slate-400">
                                            — {scheduleSlots.filter(s => s.day_of_week === selectedDay).length} slot(s)
                                        </span>
                                    </h2>
                                    <button
                                        onClick={handleOpenNewSlot}
                                        className="flex items-center gap-1.5 bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-pink-700 transition-colors"
                                    >
                                        <Plus className="w-4 h-4" /> Adicionar Slot
                                    </button>
                                </div>

                                {scheduleLoading ? (
                                    <div className="p-8 text-center text-slate-400">Carregando...</div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {scheduleSlots
                                            .filter(s => s.day_of_week === selectedDay)
                                            .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time))
                                            .map(slot => (
                                                <div key={slot.id} className={`p-4 transition-colors ${slot.active ? '' : 'opacity-50 bg-slate-50'}`}>
                                                    <div className="flex items-start gap-3">
                                                        {/* Toggle ativo */}
                                                        <button onClick={() => handleToggleSlotActive(slot)} className="mt-1 shrink-0" title={slot.active ? 'Desativar' : 'Ativar'}>
                                                            {slot.active
                                                                ? <ToggleRight className="w-6 h-6 text-green-500" />
                                                                : <ToggleLeft className="w-6 h-6 text-slate-300" />}
                                                        </button>

                                                        <div className="flex-1 min-w-0">
                                                            {/* Horário + tipo */}
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                                    <Clock className="w-3 h-3" />
                                                                    {slot.scheduled_time?.slice(0, 5)}
                                                                </span>
                                                                <span className="text-xs font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded">
                                                                    {CONTENT_TYPE_LABELS[slot.content_type as ContentType]}
                                                                </span>
                                                                {slot.send_telegram_reminder && (
                                                                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-semibold">📲 Telegram</span>
                                                                )}
                                                            </div>

                                                            {/* Hook */}
                                                            {slot.hook && (
                                                                <p className="text-sm font-semibold text-slate-800 mb-1">🎣 {slot.hook}</p>
                                                            )}

                                                            {/* Caption (truncada) */}
                                                            {slot.caption && (
                                                                <p className="text-xs text-slate-600 line-clamp-2 mb-1">{slot.caption}</p>
                                                            )}

                                                            {/* CTA */}
                                                            {slot.cta && (
                                                                <p className="text-xs text-emerald-700 font-medium">👉 {slot.cta}</p>
                                                            )}

                                                            {/* Hashtags */}
                                                            {slot.hashtags && (
                                                                <p className="text-[11px] text-blue-500 mt-1 truncate">{slot.hashtags}</p>
                                                            )}

                                                            {/* Notas visuais */}
                                                            {slot.visual_notes && (
                                                                <p className="text-[11px] text-amber-600 mt-1">🎨 {slot.visual_notes}</p>
                                                            )}
                                                        </div>

                                                        {/* Ações */}
                                                        <div className="flex gap-1 shrink-0">
                                                            <button
                                                                onClick={() => handleOpenEditSlot(slot)}
                                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                title="Editar"
                                                            >
                                                                <PenTool className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteSlot(slot.id)}
                                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                title="Excluir"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        }
                                        {scheduleSlots.filter(s => s.day_of_week === selectedDay).length === 0 && (
                                            <div className="p-8 text-center">
                                                <Calendar className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                                                <p className="text-sm text-slate-400">Nenhum slot neste dia.</p>
                                                <p className="text-xs text-slate-300">Clique em "Adicionar Slot" para começar.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Modal / Form de Edição */}
                            {showSlotForm && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowSlotForm(false); }}>
                                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                                        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                                            <h3 className="font-bold text-slate-800 text-lg">
                                                {editingSlot ? 'Editar Slot' : 'Novo Slot de Conteúdo'}
                                            </h3>
                                            <button onClick={() => setShowSlotForm(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="p-6 space-y-4">
                                            {/* Dia da semana */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dia da Semana</label>
                                                <select
                                                    value={slotForm.day_of_week}
                                                    onChange={e => setSlotForm(f => ({ ...f, day_of_week: Number(e.target.value) }))}
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-500"
                                                >
                                                    {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((d, i) => (
                                                        <option key={i} value={i}>{d}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Horário + Tipo */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Horário</label>
                                                    <input
                                                        type="time"
                                                        value={slotForm.scheduled_time || '09:00'}
                                                        onChange={e => setSlotForm(f => ({ ...f, scheduled_time: e.target.value }))}
                                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
                                                    <select
                                                        value={slotForm.content_type}
                                                        onChange={e => setSlotForm(f => ({ ...f, content_type: e.target.value as ContentType }))}
                                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-500"
                                                    >
                                                        <option value="story">📸 Story</option>
                                                        <option value="reels">🎬 Reels</option>
                                                        <option value="carrossel">🎴 Carrossel</option>
                                                        <option value="post">📷 Post Feed</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Hook */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">🎣 Hook (primeiros 3 segundos)</label>
                                                <input
                                                    type="text"
                                                    value={slotForm.hook || ''}
                                                    onChange={e => setSlotForm(f => ({ ...f, hook: e.target.value }))}
                                                    placeholder="Ex: Você sabia que esse celular tem esse preço? 😱"
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-500"
                                                />
                                            </div>

                                            {/* Legenda */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">📝 Legenda completa (pronta pra copiar)</label>
                                                <textarea
                                                    value={slotForm.caption || ''}
                                                    onChange={e => setSlotForm(f => ({ ...f, caption: e.target.value }))}
                                                    placeholder="Escreva a legenda completa do post..."
                                                    rows={5}
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-500 resize-none"
                                                />
                                            </div>

                                            {/* CTA */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">👉 CTA (Call-to-Action)</label>
                                                <input
                                                    type="text"
                                                    value={slotForm.cta || ''}
                                                    onChange={e => setSlotForm(f => ({ ...f, cta: e.target.value }))}
                                                    placeholder="Ex: Manda 'QUERO' nos comentários!"
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-500"
                                                />
                                            </div>

                                            {/* Hashtags */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">🏷️ Hashtags</label>
                                                <input
                                                    type="text"
                                                    value={slotForm.hashtags || ''}
                                                    onChange={e => setSlotForm(f => ({ ...f, hashtags: e.target.value }))}
                                                    placeholder="#celular #iphone #oferta #MercadoDoVale"
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-500"
                                                />
                                            </div>

                                            {/* Notas Visuais */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">🎨 Notas Visuais</label>
                                                <input
                                                    type="text"
                                                    value={slotForm.visual_notes || ''}
                                                    onChange={e => setSlotForm(f => ({ ...f, visual_notes: e.target.value }))}
                                                    placeholder="Ex: Produto na mão, fundo branco, luz natural"
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-500"
                                                />
                                            </div>

                                            {/* Toggles */}
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={slotForm.send_telegram_reminder ?? true}
                                                        onChange={e => setSlotForm(f => ({ ...f, send_telegram_reminder: e.target.checked }))}
                                                        className="w-4 h-4 text-pink-600 rounded border-slate-300 focus:ring-pink-500"
                                                    />
                                                    <span className="text-sm font-medium text-slate-700">📲 Enviar no Telegram</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={slotForm.active ?? true}
                                                        onChange={e => setSlotForm(f => ({ ...f, active: e.target.checked }))}
                                                        className="w-4 h-4 text-green-600 rounded border-slate-300 focus:ring-green-500"
                                                    />
                                                    <span className="text-sm font-medium text-slate-700">✅ Ativo</span>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex gap-3 justify-end rounded-b-2xl">
                                            <button
                                                onClick={() => setShowSlotForm(false)}
                                                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={handleSaveSlot}
                                                className="px-6 py-2 text-sm font-bold bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
                                            >
                                                {editingSlot ? 'Salvar Alterações' : 'Criar Slot'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
