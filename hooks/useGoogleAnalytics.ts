import { useEffect } from 'react';
import { getCompanyData } from '../services/companyService';
import { router } from '../routes/index';

declare global {
    interface Window {
        gtag?: (...args: unknown[]) => void;
        dataLayer?: unknown[];
    }
}

const scheduleIdle = (callback: () => void) => {
    if ('requestIdleCallback' in window) {
        const id = window.requestIdleCallback(callback, { timeout: 3000 });
        return () => window.cancelIdleCallback(id);
    }

    const id = window.setTimeout(callback, 1500);
    return () => window.clearTimeout(id);
};

/**
 * Injects GA4 dynamically and tracks SPA page navigation.
 *
 * Two behaviors:
 * 1. On mount: loads gtag.js using the ID from company_settings
 * 2. On every route change (via router.subscribe): fires page_view event
 *
 * Without the subscriber, a React SPA only tracks the first page load.
 * GA4 Enhanced Measurement alone does NOT reliably cover React Router navigation.
 */
export function useGoogleAnalytics() {
    useEffect(() => {
        let unsubscribe: (() => void) | undefined;
        let cancelled = false;

        const cancelIdle = scheduleIdle(() => {
            getCompanyData().then((company) => {
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
