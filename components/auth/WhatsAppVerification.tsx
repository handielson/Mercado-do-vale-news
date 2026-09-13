import React, { useEffect, useRef, useState } from 'react';
import { vpsAuthService } from '../../services/vpsAuthService';
import { normalizeBrazilianPhone } from '../../utils/cpfCnpjValidation';

export function WhatsAppVerification({ phone, purpose = 'registration', onVerified }: {
    phone: string;
    purpose?: 'registration' | 'profile';
    onVerified: (token: string) => void;
}) {
    const [challenge, setChallenge] = useState('');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [verified, setVerified] = useState(false);
    const [message, setMessage] = useState('');
    const [retryAt, setRetryAt] = useState(0);
    const [expiresAt, setExpiresAt] = useState(0);
    const [time, setTime] = useState(Date.now());
    const generation = useRef(0);
    const notify = useRef(onVerified);
    notify.current = onVerified;

    useEffect(() => {
        generation.current++;
        setChallenge(''); setCode(''); setBusy(false); setVerified(false);
        setMessage(''); setRetryAt(0); setExpiresAt(0);
        notify.current('');
        return () => { generation.current++; };
    }, [phone, purpose]);

    useEffect(() => {
        const timer = window.setInterval(() => setTime(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);
    useEffect(() => {
        if (verified && expiresAt && time >= expiresAt) {
            setVerified(false);
            notify.current('');
            setMessage('A confirmação expirou. Solicite outro código para continuar.');
        }
    }, [verified, expiresAt, time]);

    const requestCode = async () => {
        const current = generation.current;
        setBusy(true); setMessage(''); notify.current(''); setVerified(false);
        setRetryAt(Date.now() + 60000);
        try {
            const result = await vpsAuthService.requestPhoneCode(phone, purpose);
            if (current !== generation.current) return;
            setChallenge(result.challenge_id);
            setCode('');
            setRetryAt(Date.now() + result.retry_after * 1000);
            setMessage('Código enviado! Confira seu WhatsApp. Ele vale por 10 minutos.');
        } catch (error: any) {
            if (current === generation.current) setMessage(error.message || 'Não foi possível enviar o código.');
        } finally { if (current === generation.current) setBusy(false); }
    };

    const confirmCode = async () => {
        const current = generation.current;
        setBusy(true); setMessage('');
        try {
            const result = await vpsAuthService.verifyPhoneCode(challenge, code, purpose);
            if (current !== generation.current) return;
            setVerified(true);
            setExpiresAt(Date.now() + result.expires_in * 1000);
            notify.current(result.phone_verification_token);
            setMessage('WhatsApp confirmado. Você já pode concluir o cadastro.');
        } catch (error: any) {
            if (current === generation.current) setMessage(error.message || 'Não foi possível confirmar o código.');
        } finally { if (current === generation.current) setBusy(false); }
    };

    const remaining = Math.max(0, Math.ceil((retryAt - time) / 1000));
    return (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-slate-800">Confirme seu WhatsApp</p>
            <p className="text-xs text-slate-600">Enviaremos um código para o número informado acima.</p>
            {!verified && (
                <>
                    <button type="button" onClick={requestCode}
                        disabled={busy || remaining > 0 || !normalizeBrazilianPhone(phone)}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                        {remaining ? 'Reenviar em ' + remaining + 's' : challenge ? 'Reenviar código' : 'Enviar código no WhatsApp'}
                    </button>
                    {challenge && (
                        <div className="flex flex-wrap gap-2">
                            <label className="flex-1 text-sm">
                                Código recebido
                                <input type="text" inputMode="numeric" autoComplete="one-time-code"
                                    value={code} maxLength={6}
                                    onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 tracking-widest"
                                    placeholder="000000" />
                            </label>
                            <button type="button" onClick={confirmCode} disabled={busy || code.length !== 6}
                                className="self-end rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                                Confirmar código
                            </button>
                        </div>
                    )}
                </>
            )}
            {busy && <p role="status" className="text-sm text-blue-800">Aguarde...</p>}
            {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
        </div>
    );
}
