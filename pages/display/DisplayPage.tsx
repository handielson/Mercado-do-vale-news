import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as ReactQRCode from 'react-qr-code';
import { CheckCircle2, Home, Loader2, MessageCircle, MonitorSmartphone, QrCode, RefreshCw, Settings, ShieldAlert, Volume2, WifiOff, X } from 'lucide-react';
import { pdvDisplayService } from '../../services/pdvDisplayService';
import { productService } from '../../services/products';
import { publicCompanySettingsService, type PublicCompanySettings } from '../../services/publicCompanySettings';
import type { PdvDisplay, PdvDisplayIdleContent, PdvDisplayState, PdvPixPayment, PdvPixReceiptShareLinkResponse } from '../../types/pdvDisplay';
import type { Product } from '../../types/product';
import { formatCurrency } from '../../utils/saleCalculations';
import { getStoreStatus } from '../../utils/storeStatus';

export const PDV_DISPLAY_TOKEN_STORAGE_KEY = '@mdv_pdv_display_token';
const POLLING_INTERVAL_MS = 5000;
const PIX_QR_VISIBLE_MS = 5 * 60 * 1000;
const APPROVED_RECEIPT_VISIBLE_MS = 10 * 60 * 1000;
const STORE_SITE_URL = 'https://www.mercadodovale.com.br';
const TOTEM_UPDATE_HELP_URL = `${STORE_SITE_URL}/totem-pix/atualizar`;
const DISPLAY_APP_VERSION = 'V1.14';
const STORE_SLEEP_CHECK_INTERVAL_MS = 60 * 1000;
const TOTEM_LOCAL_SETTINGS_STORAGE_KEY = '@mdv_totem_local_settings';

type TotemVersionInfo = {
    version?: string;
    totem_pix_android?: {
        latest_version_name?: string;
        latest_version_code?: number;
        minimum_recommended_version_name?: string;
        update_message?: string;
        update_url?: string;
    };
};

declare global {
    interface Window {
        MdvTotem?: {
            getAppVersionName?: () => string;
            getAppVersionCode?: () => number;
            getWifiSsid?: () => string;
            setDisplayAwake?: (awake: boolean) => void;
            requestScreenSleep?: () => void;
            requestScreenLockPermission?: () => void;
            isScreenLockPermissionActive?: () => boolean;
            playPaymentSuccessTone?: (tone: string, volume?: number) => void;
            chooseSystemPaymentTone?: () => void;
            clearSystemPaymentTone?: () => void;
            hasSystemPaymentTone?: () => boolean;
            openAppUpdate?: () => void;
            returnToAppHome?: () => void;
        };
    }
}

const QRCode = (
    (ReactQRCode as any).default?.default ||
    (ReactQRCode as any).default?.QRCode ||
    (ReactQRCode as any).QRCode ||
    (ReactQRCode as any).default
) as React.ComponentType<any>;

type IdleQrCard = {
    type: 'site' | 'instagram' | 'wifi';
    title: string;
    subtitle: string;
    value: string;
    qrValue: string;
    logoUrl?: string;
    ssid?: string;
    password?: string;
    security?: 'WPA' | 'WEP' | 'nopass';
};

type TotemLocalSettings = {
    paymentSuccessSound: boolean;
    paymentSuccessTone: 'success' | 'cash' | 'bell';
    paymentSuccessVolume: number;
};

const DEFAULT_TOTEM_LOCAL_SETTINGS: TotemLocalSettings = {
    paymentSuccessSound: true,
    paymentSuccessTone: 'success',
    paymentSuccessVolume: 80,
};

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
    return display?.idle_content || { messages: [], banners: [], products: [], categories: [] };
}

function readTotemLocalSettings(): TotemLocalSettings {
    if (typeof localStorage === 'undefined') return DEFAULT_TOTEM_LOCAL_SETTINGS;
    try {
        const raw = localStorage.getItem(TOTEM_LOCAL_SETTINGS_STORAGE_KEY);
        if (!raw) return DEFAULT_TOTEM_LOCAL_SETTINGS;
        const parsed = { ...DEFAULT_TOTEM_LOCAL_SETTINGS, ...JSON.parse(raw) };
        return {
            ...parsed,
            paymentSuccessVolume: clampPaymentVolume(parsed.paymentSuccessVolume),
        };
    } catch {
        return DEFAULT_TOTEM_LOCAL_SETTINGS;
    }
}

function clampPaymentVolume(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_TOTEM_LOCAL_SETTINGS.paymentSuccessVolume;
    return Math.max(0, Math.min(100, Math.round(parsed)));
}

function saveTotemLocalSettings(settings: TotemLocalSettings): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(TOTEM_LOCAL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function normalizeInstagramUrl(value: string | null | undefined): { label: string; url: string } | null {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) {
        try {
            const url = new URL(raw);
            const username = url.pathname.split('/').filter(Boolean)[0] || raw;
            return { label: `@${username.replace(/^@/, '')}`, url: raw };
        } catch {
            return null;
        }
    }
    const username = raw.replace(/^@/, '').replace(/^instagram\.com\//i, '').split('/')[0]?.trim();
    if (!username) return null;
    return { label: `@${username}`, url: `https://www.instagram.com/${username}` };
}

function escapeWifiQrValue(value: string | undefined): string {
    return String(value || '').replace(/([\\;,":])/g, '\\$1');
}

function buildWifiQrValue(card: IdleQrCard): string {
    if (card.security === 'nopass') {
        return `WIFI:T:nopass;S:${escapeWifiQrValue(card.ssid)};;`;
    }
    return `WIFI:T:${escapeWifiQrValue(card.security)};S:${escapeWifiQrValue(card.ssid)};P:${escapeWifiQrValue(card.password)};;`;
}

function buildIdleQrCards(
    idleContent: Partial<PdvDisplayIdleContent>,
    companySettings: PublicCompanySettings | null
): IdleQrCard[] {
    const logoUrl = companySettings?.logo || companySettings?.receipt_logo_url || undefined;
    const instagram = normalizeInstagramUrl(companySettings?.social_instagram);
    const wifi = idleContent.wifi;
    const cards: IdleQrCard[] = [
        {
            type: 'site',
            title: 'Acesse nossas novidades!',
            subtitle: 'www.mercadodovale.com.br',
            value: STORE_SITE_URL,
            qrValue: STORE_SITE_URL,
            logoUrl,
        },
    ];

    if (instagram) {
        cards.push({
            type: 'instagram',
            title: 'Siga nosso Instagram!',
            subtitle: instagram.label,
            value: instagram.url,
            qrValue: instagram.url,
            logoUrl,
        });
    }

    if (wifi?.enabled && wifi.ssid && (wifi.security === 'nopass' || wifi.password)) {
        const card: IdleQrCard = {
            type: 'wifi',
            title: 'Conecte-se ao nosso Wi-Fi',
            subtitle: wifi.ssid,
            value: wifi.ssid,
            qrValue: '',
            logoUrl,
            ssid: wifi.ssid,
            password: wifi.password || '',
            security: wifi.security || 'WPA',
        };
        card.qrValue = buildWifiQrValue(card);
        cards.push(card);
    }

    return cards;
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
    const startedAt = Date.parse(String(payment.created_at || payment.updated_at || ''));
    if (!Number.isFinite(startedAt)) return status === 'pending';
    if (status === 'pending') return now - startedAt < PIX_QR_VISIBLE_MS;
    if (status !== 'approved') return false;

    const approvedAt = Date.parse(String(payment.updated_at || payment.created_at || ''));
    if (!Number.isFinite(approvedAt)) return false;
    return now - approvedAt < APPROVED_RECEIPT_VISIBLE_MS;
}

function getRemainingMs(startedAt: string | undefined, durationMs: number, now: number): number {
    const parsed = Date.parse(String(startedAt || ''));
    if (!Number.isFinite(parsed)) return durationMs;
    return Math.max(0, durationMs - (now - parsed));
}

function formatCountdown(milliseconds: number): string {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getStandalonePixCode(payment: PdvPixPayment): string {
    const localReference = String(payment.local_reference || '').trim();
    const standaloneId = localReference.toLowerCase().startsWith('standalone_pix:')
        ? localReference.slice(localReference.indexOf(':') + 1)
        : '';
    const source = String(standaloneId || payment.id || payment.mercado_pago_payment_id || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
    return source.slice(-6) || 'AVULSO';
}

function isStandalonePixPayment(payment: PdvPixPayment, orderNumber = ''): boolean {
    return String(payment.local_reference || '').toLowerCase().startsWith('standalone_pix:')
        || String(payment.receipt?.order_number || orderNumber).toUpperCase().startsWith('PIX-');
}

function getPaymentOrderNumber(payment: PdvPixPayment): string {
    const receiptOrderNumber = String(payment.receipt?.order_number || '').trim();
    if (receiptOrderNumber && !receiptOrderNumber.toLowerCase().startsWith('standalone_pix:') && receiptOrderNumber !== 'Pix avulso') {
        return receiptOrderNumber;
    }

    const saleDraftId = String(payment.sale_draft_id || '').trim();
    if (saleDraftId) return saleDraftId;

    const localReference = String(payment.local_reference || '').trim();
    if (localReference.toLowerCase().startsWith('standalone_pix:')) {
        return `PIX-${getStandalonePixCode(payment)}`;
    }

    return localReference || payment.id;
}

function getPaymentTitle(payment: PdvPixPayment): string {
    const orderNumber = getPaymentOrderNumber(payment);
    return isStandalonePixPayment(payment, orderNumber) ? `Pix avulso #${orderNumber.replace(/^PIX-/i, '')}` : `Pedido ${orderNumber}`;
}

function getDisplayVersionLabel(name: string | undefined): string {
    return `${DISPLAY_APP_VERSION} - ${String(name || 'Display Android').trim() || 'Display Android'}`;
}

function normalizeVersionNumber(value: string | undefined): number {
    const match = String(value || '').match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    if (!match) return 0;
    const major = Number(match[1] || 0);
    const minor = Number(match[2] || 0);
    const patch = Number(match[3] || 0);
    return (major * 10000) + (minor * 100) + patch;
}

function isLikelyAndroidWebView(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /Android/i.test(navigator.userAgent) && /; wv\)|Version\/\d+/i.test(navigator.userAgent);
}

function readNativeTotemVersion(): { name: string; code: number } | null {
    try {
        const bridge = window.MdvTotem;
        const name = String(bridge?.getAppVersionName?.() || '').trim();
        const code = Number(bridge?.getAppVersionCode?.() || 0);
        if (name || code > 0) return { name, code };
    } catch {
        return null;
    }
    return null;
}

function getTotemUpdateNotice(versionInfo: TotemVersionInfo | null, nativeVersion: { name: string; code: number } | null): string {
    const latest = versionInfo?.totem_pix_android;
    const latestName = String(latest?.latest_version_name || '').trim();
    const latestCode = Number(latest?.latest_version_code || 0);
    if (!latestName && latestCode <= 0) return '';

    const message = String(latest?.update_message || '').trim() || `Atualizacao disponivel: instale o Totem Pix ${latestName || 'mais recente'}.`;
    if (!nativeVersion) return isLikelyAndroidWebView() ? message : '';
    if (latestCode > 0 && nativeVersion.code > 0) return nativeVersion.code < latestCode ? message : '';
    return normalizeVersionNumber(nativeVersion.name) < normalizeVersionNumber(latestName) ? message : '';
}

function syncNativeDisplayPower(shouldStayAwake: boolean): void {
    try {
        const bridge = window.MdvTotem;
        bridge?.setDisplayAwake?.(shouldStayAwake);
    } catch {
        // Native bridge is optional outside the Android app.
    }
}

function ensureNativeScreenLockPermission(): void {
    try {
        const bridge = window.MdvTotem;
        if (!bridge?.requestScreenLockPermission || bridge?.isScreenLockPermissionActive?.()) return;
        const storageKey = '@mdv_totem_screen_lock_permission_requested';
        if (typeof localStorage !== 'undefined' && localStorage.getItem(storageKey) === '1') return;
        if (typeof localStorage !== 'undefined') localStorage.setItem(storageKey, '1');
        bridge.requestScreenLockPermission();
    } catch {
        // The display still works without immediate screen lock permission.
    }
}

function playWebPaymentSuccessTone(tone: TotemLocalSettings['paymentSuccessTone'], volume: number): void {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioContext = new AudioContextClass();
    const gain = audioContext.createGain();
    const frequencies = tone === 'cash' ? [880, 1175, 1568] : tone === 'bell' ? [1046, 1318] : [784, 988];
    const normalizedVolume = clampPaymentVolume(volume) / 100;
    gain.gain.value = 0.02 + normalizedVolume * 0.28;
    gain.connect(audioContext.destination);
    if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => undefined);
    }
    frequencies.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        const start = audioContext.currentTime + index * 0.16;
        oscillator.start(start);
        oscillator.stop(start + 0.12);
    });
    window.setTimeout(() => audioContext.close().catch(() => undefined), 900);
}

function playPaymentSuccessTone(settings: TotemLocalSettings): void {
    if (!settings.paymentSuccessSound) return;
    try {
        const bridge = window.MdvTotem;
        if (bridge?.playPaymentSuccessTone) {
            bridge.playPaymentSuccessTone(settings.paymentSuccessTone, clampPaymentVolume(settings.paymentSuccessVolume));
            return;
        }
        playWebPaymentSuccessTone(settings.paymentSuccessTone, settings.paymentSuccessVolume);
    } catch {
        // Sound feedback is optional and must never block the payment screen.
    }
}

export default function DisplayPage() {
    const [token, setToken] = useState(() => getStoredDisplayToken());
    const [pairingCode, setPairingCode] = useState('');
    const [state, setState] = useState<PdvDisplayState | null>(null);
    const [loading, setLoading] = useState(Boolean(token));
    const [pairing, setPairing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
    const [now, setNow] = useState(Date.now());
    const [idleSlide, setIdleSlide] = useState(0);
    const [companySettings, setCompanySettings] = useState<PublicCompanySettings | null>(null);
    const [versionInfo, setVersionInfo] = useState<TotemVersionInfo | null>(null);
    const [nativeVersion, setNativeVersion] = useState<{ name: string; code: number } | null>(null);
    const [storeShouldStayAwake, setStoreShouldStayAwake] = useState(true);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [screenLockPermissionActive, setScreenLockPermissionActive] = useState(false);
    const [nativeWifiSsid, setNativeWifiSsid] = useState('');
    const [systemPaymentToneActive, setSystemPaymentToneActive] = useState(false);
    const [totemLocalSettings, setTotemLocalSettings] = useState<TotemLocalSettings>(() => readTotemLocalSettings());
    const lastSuccessTonePaymentIdRef = useRef('');
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
    const updateNotice = getTotemUpdateNotice(versionInfo, nativeVersion);
    const updateUrl = String(versionInfo?.totem_pix_android?.update_url || TOTEM_UPDATE_HELP_URL).trim();
    const showPix = shouldShowPixPayment(active_pix, now);
    const nativeBridgeAvailable = Boolean(window.MdvTotem);

    const idleItems = useMemo(() => {
        const qrCards = buildIdleQrCards(idle_content, companySettings).map((card) => ({ type: 'qr-card' as const, card }));
        const displayName = String(display?.name || '').trim().toLowerCase();
        const messages = (idle_content.messages || [])
            .map((message) => String(message || '').trim())
            .filter((message) => message && message.toLowerCase() !== displayName && message.toLowerCase() !== 'mercado do vale')
            .map((message) => ({ type: 'message' as const, message }));
        const banners = (idle_content.banners || []).filter((banner) => banner.image_url).map((banner) => ({ type: 'banner' as const, banner }));
        const products = (idle_content.products || []).filter((product) => product.name).map((product) => ({ type: 'product' as const, product }));
        const productPages = categoryProductPages.map((productPage) => ({ type: 'product-page' as const, productPage }));
        return [...qrCards, ...banners, ...productPages, ...products, ...messages];
    }, [idle_content, categoryProductPages, companySettings, display?.name]);

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
        publicCompanySettingsService.get()
            .then(setCompanySettings)
            .catch(() => setCompanySettings(null));
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function refreshStoreWakeState() {
            if (!companySettings?.business_hours) {
                if (!cancelled) setStoreShouldStayAwake(true);
                return;
            }

            const status = await getStoreStatus(
                companySettings.business_hours,
                companySettings.holiday_overrides,
                companySettings.local_holidays,
            );
            if (!cancelled) {
                setStoreShouldStayAwake(status.status === 'open' || status.status === 'closing_soon');
            }
        }

        refreshStoreWakeState();
        const interval = setInterval(refreshStoreWakeState, STORE_SLEEP_CHECK_INTERVAL_MS);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [
        JSON.stringify(companySettings?.business_hours || {}),
        JSON.stringify(companySettings?.holiday_overrides || []),
        JSON.stringify(companySettings?.local_holidays || []),
    ]);

    useEffect(() => {
        const shouldStayAwake = showPix || storeShouldStayAwake;
        syncNativeDisplayPower(shouldStayAwake);
        if (!shouldStayAwake) ensureNativeScreenLockPermission();
    }, [showPix, storeShouldStayAwake]);

    useEffect(() => {
        setNativeVersion(readNativeTotemVersion());
        refreshNativeSettingsStatus();
        fetch('/VERSION.json', { cache: 'no-store' })
            .then((response) => response.ok ? response.json() : null)
            .then((data) => setVersionInfo(data || null))
            .catch(() => setVersionInfo(null));
    }, []);

    useEffect(() => {
        saveTotemLocalSettings(totemLocalSettings);
    }, [totemLocalSettings]);

    useEffect(() => {
        if (active_pix?.status !== 'approved') return;
        const paymentId = active_pix.id || active_pix.mercado_pago_payment_id || active_pix.updated_at || '';
        if (!paymentId || lastSuccessTonePaymentIdRef.current === paymentId) return;
        lastSuccessTonePaymentIdRef.current = paymentId;
        playPaymentSuccessTone(totemLocalSettings);
    }, [active_pix?.id, active_pix?.mercado_pago_payment_id, active_pix?.status, active_pix?.updated_at, totemLocalSettings]);

    useEffect(() => {
        const rotationSeconds = Math.max(3, Number(settings.adRotationSeconds || 8));
        const interval = setInterval(() => {
            setIdleSlide((current) => current + 1);
        }, rotationSeconds * 1000);
        return () => clearInterval(interval);
    }, [settings.adRotationSeconds]);

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

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

    function refreshNativeSettingsStatus() {
        try {
            const bridge = window.MdvTotem;
            setNativeVersion(readNativeTotemVersion());
            setScreenLockPermissionActive(Boolean(bridge?.isScreenLockPermissionActive?.()));
            setNativeWifiSsid(String(bridge?.getWifiSsid?.() || '').trim());
            setSystemPaymentToneActive(Boolean(bridge?.hasSystemPaymentTone?.()));
        } catch {
            setScreenLockPermissionActive(false);
            setNativeWifiSsid('');
            setSystemPaymentToneActive(false);
        }
    }

    function requestAdminPermission() {
        window.MdvTotem?.requestScreenLockPermission?.();
        window.setTimeout(refreshNativeSettingsStatus, 1000);
    }

    function requestSleepNow() {
        window.MdvTotem?.requestScreenSleep?.();
    }

    function testPaymentTone() {
        playPaymentSuccessTone(totemLocalSettings);
    }

    function chooseSystemPaymentTone() {
        window.MdvTotem?.chooseSystemPaymentTone?.();
        window.setTimeout(refreshNativeSettingsStatus, 1000);
    }

    function clearSystemPaymentTone() {
        window.MdvTotem?.clearSystemPaymentTone?.();
        window.setTimeout(refreshNativeSettingsStatus, 250);
    }

    function openAppUpdate(event: React.MouseEvent<HTMLAnchorElement>) {
        const bridge = window.MdvTotem;
        if (!bridge?.openAppUpdate) return;
        event.preventDefault();
        bridge.openAppUpdate();
    }

    function returnToAppHome() {
        setSettingsOpen(false);
        window.MdvTotem?.setDisplayAwake?.(true);
        window.MdvTotem?.returnToAppHome?.();
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

    return (
        <main className="h-screen overflow-hidden bg-slate-950 text-white">
            <section className={`mx-auto flex h-full min-h-0 w-full ${orientationClass} flex-col p-3 sm:p-5`}>
                {showPix && active_pix ? (
                    <header className="flex flex-shrink-0 items-center justify-between gap-3 text-sm text-slate-300">
                        <p className="min-w-0 truncate font-mono text-lg font-bold text-white">{getPaymentTitle(active_pix)}</p>
                        {error && <p className="text-amber-300"><WifiOff className="mr-1 inline h-4 w-4" />{error}</p>}
                    </header>
                ) : (
                    <header className="flex flex-shrink-0 items-center justify-end gap-4 text-sm text-slate-300">
                        <div className="text-right">
                            <p>{lastUpdatedAt ? `Atualizado ${lastUpdatedAt.toLocaleTimeString('pt-BR')}` : 'Conectando'}</p>
                            {error && <p className="text-amber-300"><WifiOff className="mr-1 inline h-4 w-4" />{error}</p>}
                        </div>
                    </header>
                )}

                {showPix ? (
                    <PixView payment={active_pix} display={display} now={now} />
                ) : (
                    <IdleView items={idleItems} slide={idleSlide} />
                )}
                {updateNotice && (
                    <div className="absolute bottom-16 left-1/2 z-20 w-[min(92vw,520px)] -translate-x-1/2 rounded-lg border border-amber-300/50 bg-amber-400 p-3 text-center text-sm font-black text-slate-950 shadow-2xl sm:text-base">
                        <p className="whitespace-pre-line">{updateNotice}</p>
                        <a
                            href={updateUrl}
                            onClick={openAppUpdate}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-lg"
                        >
                            Atualizar agora
                        </a>
                    </div>
                )}
                {!showPix && (
                    <button
                        type="button"
                        onClick={() => {
                            refreshNativeSettingsStatus();
                            setSettingsOpen(true);
                        }}
                        className="absolute bottom-4 left-4 z-10 flex max-w-[60vw] items-center gap-2 rounded-lg bg-slate-900/60 px-3 py-2 text-left text-sm font-semibold text-slate-400 backdrop-blur transition-colors hover:bg-slate-800 hover:text-white sm:text-base"
                    >
                        <Settings className="h-4 w-4 flex-shrink-0" />
                        {getDisplayVersionLabel(display?.name)}
                    </button>
                )}
                {settingsOpen && (
                    <TotemSettingsPanel
                        nativeBridgeAvailable={nativeBridgeAvailable}
                        nativeVersion={nativeVersion}
                        nativeWifiSsid={nativeWifiSsid}
                        screenLockPermissionActive={screenLockPermissionActive}
                        systemPaymentToneActive={systemPaymentToneActive}
                        storeShouldStayAwake={storeShouldStayAwake}
                        localSettings={totemLocalSettings}
                        onChangeLocalSettings={setTotemLocalSettings}
                        onClose={() => setSettingsOpen(false)}
                        onRefresh={refreshNativeSettingsStatus}
                        onRequestAdminPermission={requestAdminPermission}
                        onRequestSleepNow={requestSleepNow}
                        onChooseSystemPaymentTone={chooseSystemPaymentTone}
                        onClearSystemPaymentTone={clearSystemPaymentTone}
                        onTestPaymentTone={testPaymentTone}
                        onReturnToAppHome={returnToAppHome}
                    />
                )}
            </section>
        </main>
    );
}

function TotemSettingsPanel({
    nativeBridgeAvailable,
    nativeVersion,
    nativeWifiSsid,
    screenLockPermissionActive,
    systemPaymentToneActive,
    storeShouldStayAwake,
    localSettings,
    onChangeLocalSettings,
    onClose,
    onRefresh,
    onRequestAdminPermission,
    onRequestSleepNow,
    onChooseSystemPaymentTone,
    onClearSystemPaymentTone,
    onTestPaymentTone,
    onReturnToAppHome,
}: {
    nativeBridgeAvailable: boolean;
    nativeVersion: { name: string; code: number } | null;
    nativeWifiSsid: string;
    screenLockPermissionActive: boolean;
    systemPaymentToneActive: boolean;
    storeShouldStayAwake: boolean;
    localSettings: TotemLocalSettings;
    onChangeLocalSettings: (settings: TotemLocalSettings) => void;
    onClose: () => void;
    onRefresh: () => void;
    onRequestAdminPermission: () => void;
    onRequestSleepNow: () => void;
    onChooseSystemPaymentTone: () => void;
    onClearSystemPaymentTone: () => void;
    onTestPaymentTone: () => void;
    onReturnToAppHome: () => void;
}) {
    const [activeAction, setActiveAction] = useState('');
    const [feedbackMessage, setFeedbackMessage] = useState('');

    function runPanelAction(action: string, successMessage: string, callback: () => void, delayMs = 650) {
        setActiveAction(action);
        setFeedbackMessage('');
        callback();
        window.setTimeout(() => {
            setActiveAction('');
            setFeedbackMessage(successMessage);
        }, delayMs);
    }

    return (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur">
            <div className="w-full max-w-xl rounded-lg border border-white/10 bg-slate-900 p-5 text-left text-white shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-black">Configuracoes do Totem</h2>
                        <p className="mt-1 text-sm font-semibold text-slate-400">Status local deste aparelho</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg bg-white/10 p-2 text-slate-200">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="mt-5 grid gap-3 text-sm font-semibold">
                    <StatusRow label="Ponte Android" value={nativeBridgeAvailable ? 'Conectada' : 'Nao detectada'} ok={nativeBridgeAvailable} />
                    <StatusRow label="Versao instalada" value={nativeVersion ? `${nativeVersion.name || '-'} / ${nativeVersion.code || '-'}` : 'Nao informada'} ok={Boolean(nativeVersion)} />
                    <StatusRow label="Administrador do dispositivo" value={screenLockPermissionActive ? 'Ativo' : 'Nao ativado'} ok={screenLockPermissionActive} />
                    <StatusRow label="Wi-Fi do aparelho" value={nativeWifiSsid || 'Nao informado'} ok={Boolean(nativeWifiSsid)} />
                    <StatusRow label="Toque do aparelho" value={systemPaymentToneActive ? 'Selecionado' : 'Tom interno'} ok={systemPaymentToneActive} />
                    <StatusRow label="Horario da loja" value={storeShouldStayAwake ? 'Aberta ou fechando' : 'Fechada'} ok={storeShouldStayAwake} />
                    <StatusRow label="Online com tela apagada" value="Ativo por wake lock parcial" ok />
                </div>

                <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-4">
                    <label className="flex items-center justify-between gap-3 text-sm font-bold">
                        <span className="flex items-center gap-2"><Volume2 className="h-4 w-4" /> Som ao aprovar pagamento</span>
                        <input
                            type="checkbox"
                            checked={localSettings.paymentSuccessSound}
                            onChange={(event) => onChangeLocalSettings({ ...localSettings, paymentSuccessSound: event.target.checked })}
                            className="h-5 w-5"
                        />
                    </label>
                    <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                        <select
                            value={localSettings.paymentSuccessTone}
                            onChange={(event) => onChangeLocalSettings({ ...localSettings, paymentSuccessTone: event.target.value as TotemLocalSettings['paymentSuccessTone'] })}
                            className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm font-bold text-white"
                        >
                            <option value="success">Confirmacao</option>
                            <option value="cash">Caixa</option>
                            <option value="bell">Campainha</option>
                        </select>
                        <ActionButton
                            actionId="test-tone"
                            activeAction={activeAction}
                            onClick={() => runPanelAction('test-tone', 'Som de teste enviado.', onTestPaymentTone, 500)}
                            className="bg-emerald-500 px-4 py-2 text-white"
                        >
                            Testar
                        </ActionButton>
                    </div>
                    <label className="mt-4 block text-sm font-bold text-slate-200">
                        Volume do som: {clampPaymentVolume(localSettings.paymentSuccessVolume)}%
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={clampPaymentVolume(localSettings.paymentSuccessVolume)}
                            onChange={(event) => onChangeLocalSettings({ ...localSettings, paymentSuccessVolume: clampPaymentVolume(event.target.value) })}
                            className="mt-2 w-full accent-emerald-400"
                        />
                    </label>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                        <ActionButton
                            actionId="choose-tone"
                            activeAction={activeAction}
                            onClick={() => runPanelAction('choose-tone', 'Seletor de toque aberto.', onChooseSystemPaymentTone, 700)}
                            className="bg-blue-500 px-3 py-2 text-white"
                        >
                            Escolher toque do aparelho
                        </ActionButton>
                        <ActionButton
                            actionId="clear-tone"
                            activeAction={activeAction}
                            onClick={() => runPanelAction('clear-tone', 'Tom interno ativado.', onClearSystemPaymentTone, 500)}
                            className="bg-slate-700 px-3 py-2 text-white"
                        >
                            Usar tom interno
                        </ActionButton>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-slate-400">
                        Se um toque do aparelho for escolhido, ele substitui o tom interno acima e continua respeitando o volume configurado.
                    </p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                    <ActionButton
                        actionId="home"
                        activeAction={activeAction}
                        onClick={() => runPanelAction('home', 'Voltando para a tela inicial.', onReturnToAppHome, 250)}
                        className="col-span-2 bg-emerald-500 px-3 py-3 text-white"
                    >
                        <span className="inline-flex items-center justify-center gap-2">
                            <Home className="h-4 w-4" />
                            Voltar para tela inicial do app
                        </span>
                    </ActionButton>
                    <ActionButton
                        actionId="admin"
                        activeAction={activeAction}
                        onClick={() => runPanelAction('admin', 'Solicitacao de admin enviada.', onRequestAdminPermission, 900)}
                        className="bg-blue-500 px-3 py-3 text-white"
                    >
                        Ativar admin
                    </ActionButton>
                    <ActionButton
                        actionId="sleep"
                        activeAction={activeAction}
                        onClick={() => runPanelAction('sleep', 'Comando para apagar a tela enviado.', onRequestSleepNow, 600)}
                        className="bg-slate-700 px-3 py-3 text-white"
                    >
                        Apagar tela
                    </ActionButton>
                    <ActionButton
                        actionId="refresh"
                        activeAction={activeAction}
                        onClick={() => runPanelAction('refresh', 'Status atualizado.', onRefresh, 500)}
                        className="col-span-2 bg-white px-3 py-3 text-slate-950"
                    >
                        Atualizar status
                    </ActionButton>
                </div>
                {feedbackMessage && (
                    <p className="mt-3 animate-pulse rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-center text-sm font-black text-emerald-200">
                        {feedbackMessage}
                    </p>
                )}
            </div>
        </div>
    );
}

function ActionButton({
    actionId,
    activeAction,
    onClick,
    className,
    children,
}: {
    actionId: string;
    activeAction: string;
    onClick: () => void;
    className: string;
    children: React.ReactNode;
}) {
    const active = activeAction === actionId;
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={Boolean(activeAction)}
            className={`rounded-lg text-sm font-black transition-all duration-150 active:scale-95 disabled:cursor-wait disabled:opacity-70 ${active ? 'scale-[0.98] animate-pulse ring-2 ring-white/60' : 'hover:scale-[1.02]'} ${className}`}
        >
            {active ? 'Aguarde...' : children}
        </button>
    );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
            <span className="text-slate-300">{label}</span>
            <span className={ok ? 'text-emerald-300' : 'text-amber-300'}>{value}</span>
        </div>
    );
}

function PixView({ payment, display, now }: { payment: PdvPixPayment; display: PdvDisplay | null; now: number }) {
    const settings = display?.settings || {};
    const qrImage = payment.qr_code_base64 ? `data:image/png;base64,${payment.qr_code_base64}` : '';
    const isApproved = payment.status === 'approved';
    const qrRemainingMs = getRemainingMs(payment.created_at || payment.updated_at, PIX_QR_VISIBLE_MS, now);

    if (isApproved) {
        return <ApprovedReceiptView payment={payment} now={now} />;
    }

    return (
        <div className="grid min-h-0 flex-1 grid-rows-[1fr_auto] items-center gap-3 py-3">
            <div className="mx-auto flex min-h-0 w-full max-w-[520px] items-center justify-center rounded-lg bg-white p-3 text-slate-950 shadow-2xl">
                {qrImage ? (
                    <img src={qrImage} alt="QR Code Pix" className="aspect-square w-full object-contain" />
                ) : (
                    <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-slate-200 p-5 text-center font-mono text-xs break-all">
                        {payment.qr_code}
                    </div>
                )}
            </div>
            <div className="flex flex-shrink-0 flex-col items-center gap-2 text-center">
                {settings.showPixAmount !== false && (
                    <p className="text-5xl font-black leading-none text-white sm:text-7xl">{formatCurrency(payment.amount)}</p>
                )}
                <p className="font-mono text-2xl font-bold text-cyan-200">{formatCountdown(qrRemainingMs)}</p>
                {settings.showInstructions !== false && <p className="text-base font-semibold text-slate-200">Aponte a camera do banco para pagar com Pix</p>}
            </div>
        </div>
    );
}

function ApprovedReceiptView({ payment, now }: { payment: PdvPixPayment; now: number }) {
    const receipt = payment.receipt;
    const [phone, setPhone] = useState('');
    const [sending, setSending] = useState(false);
    const [shareLink, setShareLink] = useState<PdvPixReceiptShareLinkResponse | null>(null);
    const [shareError, setShareError] = useState<string | null>(null);
    const receiptRemainingMs = getRemainingMs(payment.updated_at || payment.created_at, APPROVED_RECEIPT_VISIBLE_MS, now);
    const linkRemainingMs = shareLink?.expires_at ? Math.max(0, Date.parse(shareLink.expires_at) - now) : 0;

    async function handleGenerateLink() {
        try {
            setSending(true);
            setShareError(null);
            const result = await pdvDisplayService.createPixReceiptShareLink(payment.id, {});
            setShareLink(result);
        } catch (err: any) {
            setShareError(err?.message || 'Erro ao gerar link do comprovante');
        } finally {
            setSending(false);
        }
    }

    async function handleSendWhatsApp(event: React.FormEvent) {
        event.preventDefault();
        try {
            setSending(true);
            setShareError(null);
            await pdvDisplayService.sendPixReceiptWhatsApp(payment.id, { phone });
            setPhone('');
            setShareError('Comprovante enviado.');
        } catch (err: any) {
            setShareError(err?.message || 'Erro ao enviar comprovante');
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 py-3">
            <div className="text-center">
                <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-300" />
                <p className="mt-2 text-3xl font-black text-white">Pagamento aprovado</p>
            </div>

            <div className="mx-auto flex w-full max-w-xl flex-col justify-center rounded-lg border border-emerald-300/30 bg-white p-5 text-slate-950 shadow-2xl">
                <div className="space-y-3 text-center">
                    <p className="text-sm font-bold uppercase text-slate-500">{receipt?.store_name || 'Mercado do Vale'}</p>
                    <p className="font-mono text-2xl font-black">{getPaymentTitle(payment)}</p>
                    <p className="text-5xl font-black text-emerald-700">{receipt?.amount_label || formatCurrency(payment.amount)}</p>
                    <div className="grid gap-2 rounded-lg bg-slate-100 p-3 text-left text-sm font-semibold text-slate-700">
                        <p>Pagamento: Pix</p>
                        <p>Autenticacao: {receipt?.authentication_code || payment.mercado_pago_payment_id || payment.id}</p>
                        <p>Data/hora: {receipt?.approved_at_label || new Date(payment.updated_at || payment.created_at || Date.now()).toLocaleString('pt-BR')}</p>
                    </div>
                </div>
            </div>

            <div className="mx-auto w-full max-w-xl space-y-3">
                <div className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-300">
                    <span>Visualizacao encerra em {formatCountdown(receiptRemainingMs)}</span>
                    {receipt?.customer_phone_mask && <span>{receipt.customer_phone_mask}</span>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={handleGenerateLink}
                        disabled={sending}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-3 text-sm font-bold text-slate-900 disabled:opacity-60"
                    >
                        <QrCode className="h-5 w-5" />
                        QR comprovante
                    </button>
                    <form onSubmit={handleSendWhatsApp} className="flex min-w-0 gap-2">
                        <input
                            value={phone}
                            onChange={(event) => setPhone(event.target.value)}
                            placeholder="WhatsApp"
                            inputMode="tel"
                            className="min-w-0 flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-300"
                        />
                        <button
                            type="submit"
                            disabled={sending || phone.trim().length < 8}
                            className="inline-flex aspect-square h-12 items-center justify-center rounded-lg bg-emerald-500 text-white disabled:opacity-60"
                            aria-label="Enviar comprovante"
                        >
                            <MessageCircle className="h-5 w-5" />
                        </button>
                    </form>
                </div>
                {shareLink && (
                    <div className="mx-auto grid max-w-sm place-items-center gap-2 rounded-lg bg-white p-3 text-slate-950">
                        <QRCode value={shareLink.url} size={140} />
                        <p className="font-mono text-sm font-bold">Expira em {formatCountdown(linkRemainingMs)}</p>
                    </div>
                )}
                {shareError && <p className="text-center text-sm font-semibold text-emerald-200">{shareError}</p>}
            </div>
        </div>
    );
}

function IdleView({ items, slide }: { items: Array<any>; slide: number }) {
    const current = items.length > 0 ? items[slide % items.length] : {
        type: 'qr-card',
        card: {
            type: 'site',
            title: 'Acesse nossas novidades!',
            subtitle: 'www.mercadodovale.com.br',
            value: STORE_SITE_URL,
            qrValue: STORE_SITE_URL,
        },
    };

    return (
        <div className="flex min-h-0 flex-1 items-center justify-center py-3">
            <div className="h-full min-h-0 w-full text-center">
                {current.type === 'qr-card' && (
                    <IdleQrCardView card={current.card} />
                )}
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
                    </div>
                )}
            </div>
        </div>
    );
}

function IdleQrCardView({ card }: { card: IdleQrCard }) {
    return (
        <div className="mx-auto grid h-full min-h-0 w-full max-w-3xl place-items-center px-4 py-2">
            <div className="flex w-full flex-col items-center justify-center gap-5 text-center">
                {card.logoUrl ? (
                    <img src={card.logoUrl} alt="Logo da loja" className="max-h-24 max-w-[70%] object-contain sm:max-h-32" />
                ) : (
                    <div className="h-1" />
                )}
                <div className="space-y-3">
                    <p className="text-4xl font-black leading-tight text-white sm:text-6xl">{card.title}</p>
                    <p className="break-words text-2xl font-bold text-cyan-100 sm:text-4xl">{card.subtitle}</p>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-2xl sm:p-5">
                    <QRCode value={card.qrValue} size={220} />
                </div>
                {card.type === 'wifi' && (
                    <p className="max-w-xl text-lg font-semibold text-slate-300 sm:text-2xl">Aponte a camera para conectar automaticamente</p>
                )}
            </div>
        </div>
    );
}
