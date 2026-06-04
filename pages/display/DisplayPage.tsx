import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, MonitorSmartphone, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react';
import { pdvDisplayService } from '../../services/pdvDisplayService';
import { productService } from '../../services/products';
import type { PdvDisplay, PdvDisplayIdleContent, PdvDisplayState, PdvPixPayment } from '../../types/pdvDisplay';
import type { Product } from '../../types/product';
import { formatCurrency } from '../../utils/saleCalculations';

export const PDV_DISPLAY_TOKEN_STORAGE_KEY = '@mdv_pdv_display_token';
const POLLING_INTERVAL_MS = 5000;
const APPROVED_PIX_VISIBLE_MS = 8000;

function getStoredDisplayToken(): string {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(PDV_DISPLAY_TOKEN_STORAGE_KEY) || '';
}

function saveDisplayToken(token: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(PDV_DISPLAY_TOKEN_STORAGE_KEY, token);
}

function clearDisplayToken(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(PDV_DISPLAY_TOKEN_STORAGE_KEY);
}

function normalizePairingCode(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    if (digits.length <= 3) return digits;
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

function getIdleContent(display: PdvDisplay | null): Partial<PdvDisplayIdleContent> {
    return display?.idle_content || { messages: ['Mercado do Vale'], banners: [], products: [], categories: [] };
}

function shuffleArray<T>(items: T[]): T[] {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const target = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
    }
    return shuffled;
}

function chunkProducts(products: Product[], size = 6): Product[][] {
    const chunks: Product[][] = [];
    for (let index = 0; index < products.length; index += size) {
        chunks.push(products.slice(index, index + size));
    }
    return chunks;
}

function getDisplayAdInstallment(priceInCents: number): number {
    return Math.floor((priceInCents * 1.15) / 12);
}

function ProductAdPrice({ priceInCents, compact = false }: { priceInCents: number; compact?: boolean }) {
    if (!Number.isFinite(priceInCents) || priceInCents <= 0) return null;

    return (
        <div className={compact ? 'mt-3 space-y-1' : 'mt-4 space-y-1.5'}>
            <p className={compact ? 'text-3xl font-black text-blue-200' : 'text-4xl font-black text-blue-200 md:text-5xl'}>
                {formatCurrency(priceInCents)}
            </p>
            <p className={compact ? 'text-lg font-bold text-emerald-200' : 'text-xl font-bold text-emerald-200 md:text-2xl'}>
                A vista
            </p>
            <p className={compact ? 'text-xl font-bold text-white' : 'text-2xl font-bold text-white md:text-3xl'}>
                12x de {formatCurrency(getDisplayAdInstallment(priceInCents))}
            </p>
        </div>
    );
}

export function shouldShowPixPayment(payment: PdvPixPayment | null, now = Date.now()): boolean {
    if (!payment) return false;
    const status = String(payment.status || '');
    if (status === 'pending') return true;
    if (status !== 'approved') return false;

    const approvedAt = Date.parse(String(payment.updated_at || payment.created_at || ''));
    if (!Number.isFinite(approvedAt)) return false;
    return now - approvedAt < APPROVED_PIX_VISIBLE_MS;
}

export default function DisplayPage() {
    const [token, setToken] = useState(() => getStoredDisplayToken());
    const [pairingCode, setPairingCode] = useState('');
    const [state, setState] = useState<PdvDisplayState | null>(null);
    const [loading, setLoading] = useState(Boolean(token));
    const [pairing, setPairing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
    const [idleSlide, setIdleSlide] = useState(0);
    const [categoryProductPages, setCategoryProductPages] = useState<Array<{
        categoryId: string;
        categoryName: string;
        products: Product[];
    }>>([]);

    const display = state?.display || null;
    const active_pix = state?.active_pix || null;
    const settings = display?.settings || {};
    const idle_content = getIdleContent(display);
    const orientationClass = display?.orientation === 'portrait' ? 'max-w-[760px]' : 'max-w-[1280px]';

    const idleItems = useMemo(() => {
        const messages = (idle_content.messages || []).filter(Boolean).map((message) => ({ type: 'message' as const, message }));
        const banners = (idle_content.banners || []).filter((banner) => banner.image_url).map((banner) => ({ type: 'banner' as const, banner }));
        const products = (idle_content.products || []).filter((product) => product.name).map((product) => ({ type: 'product' as const, product }));
        const productPages = categoryProductPages.map((productPage) => ({ type: 'product-page' as const, productPage }));
        return [...banners, ...productPages, ...products, ...messages];
    }, [idle_content, categoryProductPages]);

    async function loadCategoryProducts() {
        const categories = (idle_content.categories || []).filter((category) => category.category_id);
        if (categories.length === 0) {
            setCategoryProductPages([]);
            return;
        }

        try {
            const loaded = await Promise.all(categories.map(async (category) => {
                const products = await productService.listByCategory(category.category_id, 120);
                return chunkProducts(shuffleArray(products), 1).map((page) => ({
                    categoryId: category.category_id,
                    categoryName: category.category_name || '',
                    products: page,
                }));
            }));
            setCategoryProductPages(shuffleArray(loaded.flat().filter((page) => page.products.length > 0)));
        } catch (err: any) {
            setError(err?.message || 'Erro ao carregar produtos da categoria');
        }
    }

    async function loadDisplayState(currentToken = token) {
        if (!currentToken) return;
        try {
            setError(null);
            const nextState = await pdvDisplayService.getDisplayState(currentToken);
            setState(nextState);
            setLastUpdatedAt(new Date());
        } catch (err: any) {
            const message = err?.message || 'Token revogado ou invalido';
            if (message.includes('401') || message.toLowerCase().includes('token')) {
                clearDisplayToken();
                setToken('');
                setState(null);
                setError('Token revogado. Informe um novo codigo de pareamento.');
                return;
            }
            setError(message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!token) {
            setLoading(false);
            return;
        }
        loadDisplayState(token);
        const interval = setInterval(() => {
            loadDisplayState(token);
        }, POLLING_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [token]);

    useEffect(() => {
        const rotationSeconds = Math.max(3, Number(settings.adRotationSeconds || 8));
        const interval = setInterval(() => {
            setIdleSlide((current) => current + 1);
        }, rotationSeconds * 1000);
        return () => clearInterval(interval);
    }, [settings.adRotationSeconds]);

    useEffect(() => {
        loadCategoryProducts();
    }, [JSON.stringify(idle_content.categories || []), display?.orientation]);

    async function handlePair(event: React.FormEvent) {
        event.preventDefault();
        const code = normalizePairingCode(pairingCode);
        if (code.length !== 7) {
            setError('Informe o codigo de pareamento com 6 digitos.');
            return;
        }
        try {
            setPairing(true);
            setError(null);
            const result = await pdvDisplayService.pairDisplay(code);
            saveDisplayToken(result.token);
            setToken(result.token);
            setPairingCode('');
            await loadDisplayState(result.token);
        } catch (err: any) {
            setError(err?.message || 'Codigo de pareamento invalido ou expirado.');
        } finally {
            setPairing(false);
        }
    }

    if (!token) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
                <form onSubmit={handlePair} className="w-full max-w-md space-y-6 rounded-lg border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
                    <div className="text-center">
                        <MonitorSmartphone className="mx-auto h-12 w-12 text-blue-300" />
                        <h1 className="mt-4 text-3xl font-bold">Display Android</h1>
                        <p className="mt-2 text-sm text-slate-300">Codigo de pareamento</p>
                    </div>
                    <label className="block">
                        <span className="text-sm font-semibold text-slate-200">Digite o codigo gerado no admin</span>
                        <input
                            value={pairingCode}
                            onChange={(event) => setPairingCode(normalizePairingCode(event.target.value))}
                            placeholder="847-219"
                            inputMode="numeric"
                            autoFocus
                            className="mt-2 w-full rounded-lg border border-white/20 bg-slate-950 px-4 py-4 text-center font-mono text-4xl font-bold tracking-widest text-white outline-none focus:ring-2 focus:ring-blue-400"
                        />
                    </label>
                    {error && (
                        <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
                            <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={pairing}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-3 font-bold text-white transition-colors hover:bg-blue-400 disabled:opacity-60"
                    >
                        {pairing ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                        Parear display
                    </button>
                </form>
            </main>
        );
    }

    if (loading && !state) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
                <div className="text-center">
                    <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-300" />
                    <p className="mt-4 text-sm text-slate-300">Carregando display...</p>
                </div>
            </main>
        );
    }

    const showPix = shouldShowPixPayment(active_pix);

    return (
        <main className="h-screen overflow-hidden bg-slate-950 text-white">
            <section className={`mx-auto flex h-full min-h-0 w-full ${orientationClass} flex-col p-3 sm:p-5`}>
                <header className="flex flex-shrink-0 items-center justify-between gap-4 text-sm text-slate-300">
                    <div>
                        {settings.showStoreName !== false && <p className="text-lg font-bold text-white">Mercado do Vale</p>}
                        <p>{display?.name || 'Display Android'}</p>
                    </div>
                    <div className="text-right">
                        <p>{lastUpdatedAt ? `Atualizado ${lastUpdatedAt.toLocaleTimeString('pt-BR')}` : 'Conectando'}</p>
                        {error && <p className="text-amber-300"><WifiOff className="mr-1 inline h-4 w-4" />{error}</p>}
                    </div>
                </header>

                {showPix ? (
                    <PixView payment={active_pix} display={display} />
                ) : (
                    <IdleView items={idleItems} slide={idleSlide} display={display} />
                )}
            </section>
        </main>
    );
}

function PixView({ payment, display }: { payment: PdvPixPayment; display: PdvDisplay | null }) {
    const settings = display?.settings || {};
    const qrImage = payment.qr_code_base64 ? `data:image/png;base64,${payment.qr_code_base64}` : '';
    const statusText = payment.status === 'approved' ? 'Pagamento aprovado' : 'Aguardando pagamento';
    const isApproved = payment.status === 'approved';

    return (
        <div className="grid min-h-0 flex-1 items-center gap-5 py-4 lg:grid-cols-[minmax(260px,440px)_1fr]">
            <div className="mx-auto w-full max-w-[440px] rounded-lg bg-white p-4 text-slate-950 shadow-2xl">
                {isApproved ? (
                    <div className="flex aspect-square flex-col items-center justify-center rounded-lg bg-emerald-50 text-center text-emerald-700">
                        <p className="text-8xl font-black">OK</p>
                        <p className="mt-4 text-2xl font-bold">Pix aprovado</p>
                    </div>
                ) : qrImage ? (
                    <img src={qrImage} alt="QR Code Pix" className="aspect-square w-full object-contain" />
                ) : (
                    <div className="flex aspect-square items-center justify-center rounded-lg border border-slate-200 p-6 text-center font-mono text-xs break-all">
                        {payment.qr_code}
                    </div>
                )}
            </div>
            <div className="space-y-6">
                <div>
                    <p className="text-lg font-semibold uppercase tracking-wide text-blue-200">{statusText}</p>
                    {settings.showPixAmount !== false && (
                        <p className="mt-2 text-6xl font-black tracking-tight sm:text-7xl">{formatCurrency(payment.amount)}</p>
                    )}
                </div>
                {!isApproved && settings.showInstructions !== false && (
                    <div className="rounded-lg border border-white/10 bg-white/10 p-5 text-xl leading-relaxed text-slate-100">
                        Abra o app do banco, escolha Pix com QR Code e aponte a camera para a tela.
                    </div>
                )}
                {settings.showItems !== false && (
                    <div className="rounded-lg border border-white/10 bg-white/5 p-5">
                        <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">Resumo</p>
                        <p className="mt-2 text-slate-200">Venda PDV Mercado do Vale</p>
                    </div>
                )}
                {settings.showAdsDuringPix && (
                    <div className="rounded-lg bg-blue-500/20 p-4 text-sm text-blue-100">
                        Obrigado por comprar no Mercado do Vale.
                    </div>
                )}
            </div>
        </div>
    );
}

function IdleView({ items, slide, display }: { items: Array<any>; slide: number; display: PdvDisplay | null }) {
    const current = items.length > 0 ? items[slide % items.length] : { type: 'message', message: 'Mercado do Vale' };

    return (
        <div className="flex min-h-0 flex-1 items-center justify-center py-3">
            <div className="h-full min-h-0 w-full text-center">
                {current.type === 'banner' && (
                    <div className="mx-auto max-w-5xl overflow-hidden rounded-lg bg-white/5">
                        <img src={current.banner.image_url} alt={current.banner.title || 'Banner'} className="max-h-[72vh] w-full object-contain" />
                        {current.banner.title && <p className="p-5 text-3xl font-bold">{current.banner.title}</p>}
                    </div>
                )}
                {current.type === 'product' && (
                    <div className="mx-auto grid h-full min-h-0 max-w-5xl grid-rows-[minmax(0,1fr)_auto] items-center gap-5 rounded-lg bg-white/5 p-5 md:grid-cols-2 md:grid-rows-1 md:p-6">
                        <div className="flex h-full min-h-0 items-center justify-center rounded-lg bg-white p-4">
                            {current.product.image_url && <img src={current.product.image_url} alt={current.product.name} className="max-h-full max-w-full object-contain" />}
                        </div>
                        <div className="min-h-0 text-left">
                            <p className="line-clamp-3 break-words text-3xl font-black leading-tight md:text-5xl">{current.product.name}</p>
                            {current.product.category_name && (
                                <p className="mt-2 text-xl font-semibold uppercase tracking-wide text-blue-100 md:text-2xl">{current.product.category_name}</p>
                            )}
                            {current.product.price != null && <ProductAdPrice priceInCents={Number(current.product.price)} />}
                        </div>
                    </div>
                )}
                {current.type === 'product-page' && (
                    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col text-left">
                        {current.productPage.categoryName && (
                            <p className="mb-3 flex-shrink-0 text-center text-3xl font-black uppercase tracking-wide text-blue-100 md:text-4xl">
                                {current.productPage.categoryName}
                            </p>
                        )}
                        {current.productPage.products.map((product: Product) => (
                            <div key={product.id} className="mx-auto grid min-h-0 w-full max-w-5xl flex-1 grid-rows-[minmax(0,1fr)_auto] items-center gap-5 rounded-lg bg-white/5 p-5 md:grid-cols-2 md:grid-rows-1 md:p-6">
                                <div className="flex h-full min-h-0 items-center justify-center rounded-lg bg-white p-4">
                                    {product.images?.[0] ? (
                                        <img src={product.images[0]} alt={product.name} className="max-h-full max-w-full object-contain" />
                                    ) : (
                                        <span className="text-center text-xl font-semibold text-slate-500">Sem imagem</span>
                                    )}
                                </div>
                                <div className="min-h-0 text-left">
                                    <p className="line-clamp-3 break-words text-3xl font-black leading-tight md:text-5xl">{product.name}</p>
                                    {product.price_retail != null && <ProductAdPrice priceInCents={Number(product.price_retail)} />}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {current.type === 'message' && (
                    <div>
                        <p className="text-6xl font-black tracking-tight sm:text-8xl">{current.message}</p>
                        <p className="mt-6 text-2xl text-slate-300">{display?.name || 'Display Android'}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
