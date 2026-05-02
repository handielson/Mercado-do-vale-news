import { useEffect } from 'react';
import { getPublicCompanyData } from '../services/publicCompanySettings';
import { router } from '../routes/index';

declare global {
    interface Window {
        gtag?: (...args: unknown[]) => void;
        dataLayer?: unknown[];
    }
}

const scheduleIdle = (callback: () => void) => {
    let idleCleanup: (() => void) | undefined;

    const delayId = window.setTimeout(() => {
        if ('requestIdleCallback' in window) {
            const idleId = window.requestIdleCallback(callback, { timeout: 8000 });
            idleCleanup = () => window.cancelIdleCallback(idleId);
            return;
        }

        callback();
    }, 8000);

    return () => {
        window.clearTimeout(delayId);
        idleCleanup?.();
    };
};

/**
 * Injects GA4 dynamically and tracks SPA page navigation.
 */
export function useGoogleAnalytics() {
    useEffect(() => {
        let unsubscribe: (() => void) | undefined;
        let cancelled = false;

        const cancelIdle = scheduleIdle(() => {
            getPublicCompanyData().then((company) => {
                if (cancelled) return;

                const gaId = company.googleAnalyticsId?.trim();
                if (!gaId || !gaId.startsWith('G-')) return;

                if (!document.getElementById('ga-script')) {
                    const script = document.createElement('script');
                    script.id = 'ga-script';
                    script.async = true;
                    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
                    document.head.appendChild(script);

                    const inlineScript = document.createElement('script');
                    inlineScript.id = 'ga-config';
                    inlineScript.innerHTML = `
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', '${gaId}', { send_page_view: false });
                `;
                    document.head.appendChild(inlineScript);
                }

                unsubscribe = router.subscribe((state) => {
                    if (state.navigation.state !== 'idle') return;
                    if (typeof window.gtag !== 'function') return;

                    window.gtag('event', 'page_view', {
                        page_path: state.location.pathname + state.location.search,
                        page_title: document.title,
                        page_location: window.location.href,
                    });
                });
            });
        });

        return () => {
            cancelled = true;
            cancelIdle();
            unsubscribe?.();
        };
    }, []);
}
