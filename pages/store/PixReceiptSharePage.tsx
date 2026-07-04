import React from 'react';
import { CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { pdvDisplayService } from '../../services/pdvDisplayService';
import type { PdvPixReceiptShareResponse } from '../../types/pdvDisplay';

function formatCountdown(milliseconds: number): string {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function PixReceiptSharePage() {
    const { token = '' } = useParams();
    const [data, setData] = React.useState<PdvPixReceiptShareResponse | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [now, setNow] = React.useState(Date.now());

    React.useEffect(() => {
        const interval = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(interval);
    }, []);

    React.useEffect(() => {
        let cancelled = false;
        async function loadReceipt() {
            try {
                setLoading(true);
                setError(null);
                const result = await pdvDisplayService.getTemporaryPixReceipt(token);
                if (!cancelled) setData(result);
            } catch (err: any) {
                if (!cancelled) setError(err?.message || 'Comprovante expirado ou nao encontrado');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        if (token) {
            loadReceipt();
        } else {
            setError('Comprovante nao encontrado');
            setLoading(false);
        }

        return () => {
            cancelled = true;
        };
    }, [token]);

    const receipt = data?.receipt;
    const remainingMs = data?.expires_at ? Math.max(0, Date.parse(data.expires_at) - now) : 0;
    const expired = data?.expires_at ? remainingMs <= 0 : false;

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
                <div className="text-center">
                    <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-300" />
                    <p className="mt-3 text-sm font-semibold text-slate-300">Carregando comprovante...</p>
                </div>
            </main>
        );
    }

    if (error || !receipt || expired) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
                <div className="w-full max-w-md rounded-lg border border-red-300/20 bg-white/10 p-6 text-center">
                    <ShieldAlert className="mx-auto h-12 w-12 text-red-300" />
                    <h1 className="mt-4 text-2xl font-black">Comprovante indisponivel</h1>
                    <p className="mt-2 text-sm text-slate-300">{expired ? 'O tempo de visualizacao expirou.' : error}</p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6">
            <section className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-lg flex-col justify-center gap-4 sm:min-h-[calc(100vh-3rem)]">
                <div className="rounded-lg bg-white p-6 text-center text-slate-950 shadow-2xl">
                    <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
                    <p className="mt-3 text-sm font-bold uppercase text-slate-500">{receipt.store_name || 'Mercado do Vale'}</p>
                    <h1 className="mt-2 font-mono text-3xl font-black">Pedido {receipt.order_number}</h1>
                    <p className="mt-4 text-5xl font-black text-emerald-700">{receipt.amount_label}</p>
                    <div className="mt-5 space-y-2 rounded-lg bg-slate-100 p-4 text-left text-sm font-semibold text-slate-700">
                        <p>Pagamento: Pix</p>
                        <p>Autenticacao: {receipt.authentication_code}</p>
                        <p>Data/hora: {receipt.approved_at_label}</p>
                    </div>
                    {receipt.customer_name && <p className="mt-4 text-sm font-semibold text-slate-600">{receipt.customer_name}</p>}
                </div>
                <p className="text-center font-mono text-lg font-bold text-emerald-200">Expira em {formatCountdown(remainingMs)}</p>
            </section>
        </main>
    );
}

export default PixReceiptSharePage;
