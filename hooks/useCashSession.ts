/**
 * useCashSession
 * Sessao de caixa aberta do operador autenticado.
 * Consumido pelo PDV (gate de finalizacao), Pix Avulso e paginas de caixa.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { cashRegisterService } from '../services/cashRegisterService';
import type { CashSession, CashSessionSummary } from '../types/cashRegister';
import { createEmptyCashSessionSummary, normalizeCashSessionSummary } from '../types/cashRegister';
import { useVpsAuth } from './useVpsAuth';

interface UseCashSessionResult {
    session: CashSession | null;
    summary: CashSessionSummary | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<CashSession | null>;
}

export function useCashSession(): UseCashSessionResult {
    const { user, isLoading: isAuthLoading } = useVpsAuth();
    const [session, setSession] = useState<CashSession | null>(null);
    const [summary, setSummary] = useState<CashSessionSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef(true);

    const refresh = useCallback(async (): Promise<CashSession | null> => {
        try {
            setError(null);
            const result = await cashRegisterService.getCurrentSession();
            let nextSummary = result.summary
                ? normalizeCashSessionSummary(result.summary, result.session)
                : null;
            if (result.session && !nextSummary) {
                try {
                    const detail = await cashRegisterService.getSessionSummary(result.session.id);
                    nextSummary = normalizeCashSessionSummary(detail.summary, detail.session || result.session);
                } catch (summaryErr) {
                    console.warn('[cash-register] resumo detalhado indisponivel:', summaryErr);
                    nextSummary = createEmptyCashSessionSummary(result.session);
                }
            }
            if (!mountedRef.current) return result.session;
            setSession(result.session);
            setSummary(nextSummary);
            return result.session;
        } catch (err) {
            if (mountedRef.current) {
                setError(err instanceof Error ? err.message : 'Erro ao consultar caixa');
                setSession(null);
                setSummary(null);
            }
            return null;
        } finally {
            if (mountedRef.current) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        if (isAuthLoading) return () => { mountedRef.current = false; };
        if (!user) {
            setSession(null);
            setSummary(null);
            setError(null);
            setIsLoading(false);
            return () => { mountedRef.current = false; };
        }
        setIsLoading(true);
        void refresh();
        return () => {
            mountedRef.current = false;
        };
    }, [isAuthLoading, refresh, user?.id]);

    useEffect(() => {
        if (!session || session.requires_closing || !session.cutoff_at) return;
        const delay = Math.max(0, Date.parse(session.cutoff_at) - Date.now());
        const timer = window.setTimeout(() => { void refresh(); }, Math.min(delay + 1000, 2147483647));
        return () => window.clearTimeout(timer);
    }, [session?.id, session?.cutoff_at, session?.requires_closing, refresh]);

    useEffect(() => {
        const onReturn = () => { if (document.visibilityState === 'visible') void refresh(); };
        document.addEventListener('visibilitychange', onReturn);
        window.addEventListener('focus', onReturn);
        return () => {
            document.removeEventListener('visibilitychange', onReturn);
            window.removeEventListener('focus', onReturn);
        };
    }, [refresh]);

    return { session, summary, isLoading, error, refresh };
}
