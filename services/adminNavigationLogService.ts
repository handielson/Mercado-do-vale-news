import { vpsClient } from './vpsClient';

type RouterState = {
    location: {
        pathname: string;
        search?: string;
        hash?: string;
    };
    navigation: {
        state: string;
    };
};

type SubscribableRouter = {
    state?: RouterState;
    subscribe: (callback: (state: RouterState) => void) => () => void;
};

const SENSITIVE_QUERY_KEYS = new Set([
    'access_token',
    'auth_token',
    'code',
    'email',
    'password',
    'refresh_token',
    'token',
]);

let lastLoggedUrl = '';

export function redactSensitiveSearch(search = ''): string {
    if (!search) return '';
    const params = new URLSearchParams(search);
    for (const key of Array.from(params.keys())) {
        if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
            params.set(key, '[redacted]');
        }
    }
    const redacted = params.toString();
    return redacted ? `?${redacted}` : '';
}

function getReferrerPath(): string {
    if (!document.referrer) return '';
    try {
        const referrer = new URL(document.referrer);
        if (referrer.origin !== window.location.origin) return referrer.origin;
        return `${referrer.pathname}${redactSensitiveSearch(referrer.search)}${referrer.hash}`;
    } catch {
        return '';
    }
}

function logAdminNavigation(state: RouterState): void {
    if (state.navigation.state !== 'idle') return;

    const { pathname, hash = '' } = state.location;
    if (!(pathname.startsWith('/admin') || pathname.startsWith('/pdv'))) return;

    const search = redactSensitiveSearch(state.location.search || '');
    const fullUrl = `${window.location.origin}${pathname}${search}${hash}`;
    if (fullUrl === lastLoggedUrl) return;
    lastLoggedUrl = fullUrl;

    void vpsClient.post('/admin/navigation-log', {
        pathname,
        search,
        hash,
        fullUrl,
        title: document.title,
        referrerPath: getReferrerPath(),
        metadata: {
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            visibilityState: document.visibilityState,
        },
    }).catch((error) => {
        if (import.meta.env.DEV) {
            console.warn('[adminNavigationLog] failed to send navigation event', error);
        }
    });
}

export function installAdminNavigationLogger(router: SubscribableRouter): () => void {
    if (typeof window === 'undefined') return () => {};

    if (router.state) {
        window.setTimeout(() => logAdminNavigation(router.state as RouterState), 0);
    }

    return router.subscribe((state) => {
        logAdminNavigation(state);
    });
}
