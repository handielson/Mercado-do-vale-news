/**
 * useCashSession
 * Sessao de caixa aberta do operador autenticado.
 * Consumido pelo PDV (gate de finalizacao), Pix Avulso e paginas de caixa.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { cashRegisterService } from '../services/cashRegisterService';
import type { CashSession, CashSessionSummary } from '../types/cashRegister';

interface UseCashSessionResult {
    session: CashSession | null;
    summary: CashSessionSummary | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<CashSession | null>;
}

export function useCashSession(): UseCashSessionResult {
    const [session, setSession] = useState<CashSession | null>(null);
    const [summary, setSummary] = useState<CashSessionSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef(true);

    const refresh = useCallback(async (): Promise<CashSession | null> => {
        try {
            setError(null);
            const result = await cashRegisterService.getCurrentSession();
            if (!mountedRef.current) return result.session;
            setSession(result.session);
            setSummary(result.summary || null);
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
        refresh();
        return () => {
            mountedRef.current = false;
        };
    }, [refresh]);

    return { session, summary, isLoading, error, refresh };
}
