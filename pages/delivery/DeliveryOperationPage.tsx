import React, { useEffect, useMemo, useState } from 'react';
import { Bike, Camera, CheckCircle2, Loader2, MapPin, Phone, QrCode, RefreshCw, Upload, MessageCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { vpsClient } from '../../services/vpsClient';
import { formatCurrencyCents, toCents } from '../../services/customerDebtService';
import {
    completeDeliveryJob,
    createDeliveryPixIntent,
    getDeliveryJob,
    refreshDeliveryPaymentStatus,
    saveDeliveryProof,
    type CustomerDeliveryJob,
    type CustomerDeliveryProof,
} from '../../services/customerDeliveryService';
import { compressImage } from '../../utils/image-compression';

interface SynologyUploadResponse {
    url?: string;
    publicUrl?: string;
    cdnUrl?: string;
}

const DELIVERY_PAYMENT_POLL_INTERVAL_MS = 10_000;

export function buildDeliveryProofFileName(orderNumber: string, jobId: string, originalName: string): string {
    const safeOrder = String(orderNumber || 'pedido').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
    const safeJob = String(jobId || '').replace(/[^a-zA-Z0-9-]+/g, '').slice(0, 8);
    const ext = originalName.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    return `entrega-${safeOrder}-${safeJob}-${stamp}.${ext}`;
}

function phoneDigits(value?: string | null): string {
    return String(value || '').replace(/\D/g, '');
}

function getDeliveryErrorMessage(error: unknown, fallback: string): string {
    const message = error instanceof Error ? error.message : String((error as any)?.error || (error as any)?.message || '');
    if (!message) return fallback;
    if (/pix/i.test(message) && /aprov/i.test(message)) return 'O Pix da entrega ainda nao foi aprovado. Consulte o pagamento novamente antes de finalizar.';
    if (/foto|comprov/i.test(message)) return 'A foto de comprovacao e obrigatoria. Envie a foto da entrega e tente finalizar novamente.';
    if (/mercado pago/i.test(message)) return 'Nao foi possivel comunicar com o Mercado Pago agora. Tente novamente em alguns segundos.';
    if (/synology|upload/i.test(message)) return 'Nao foi possivel enviar a foto para o Synology. Confira a conexao e tente novamente.';
    if (/entrega nao encontrada/i.test(message)) return 'Entrega nao encontrada. Confira se o link recebido esta correto.';
    return message || fallback;
}

const DeliveryOperationPage: React.FC = () => {
    const { token = '' } = useParams();
    const [job, setJob] = useState<CustomerDeliveryJob | null>(null);
    const [proof, setProof] = useState<CustomerDeliveryProof | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [note, setNote] = useState('');
    const [proofDescription, setProofDescription] = useState('');

    const buyerPhone = phoneDigits(job?.buyer_phone);
    const whatsappUrl = buyerPhone ? `https://wa.me/55${buyerPhone}` : '';
    const callUrl = buyerPhone ? `tel:${buyerPhone}` : '';
    const items = Array.isArray(job?.receipt_snapshot_json?.items) ? job.receipt_snapshot_json.items : [];
    const pixApproved = job?.payment_status === 'approved' || job?.payment_status === 'not_required';
    const canComplete = Boolean(job && pixApproved && proof?.image_url && job.delivery_status !== 'delivered');
    const pixExpired = useMemo(() => {
        if (!job?.pix_expires_at || job.payment_status === 'approved') return false;
        return new Date(job.pix_expires_at).getTime() <= Date.now();
    }, [job?.pix_expires_at, job?.payment_status]);

    const load = async () => {
        if (!token) return;
        setLoading(true);
        setErrorMessage('');
        try {
            const data = await getDeliveryJob(token);
            setJob(data.job);
            setProof(data.proof || null);
        } catch (error) {
            setErrorMessage(getDeliveryErrorMessage(error, 'Erro ao carregar a entrega.'));
            setJob(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, [token]);

    useEffect(() => {
        if (!token || !job || job.payment_status !== 'pending') return;
        const interval = window.setInterval(() => {
            refreshDeliveryPaymentStatus(token)
                .then(setJob)
                .catch((error) => setErrorMessage(getDeliveryErrorMessage(error, 'Erro ao consultar o pagamento.')));
        }, DELIVERY_PAYMENT_POLL_INTERVAL_MS);
        return () => window.clearInterval(interval);
    }, [token, job?.id, job?.payment_status]);

    const handleCreatePix = async () => {
        setBusy(true);
        setErrorMessage('');
        try {
            setJob(await createDeliveryPixIntent(token));
            toast.success('Pix da entrega gerado');
        } catch (error) {
            const message = getDeliveryErrorMessage(error, 'Erro ao gerar Pix da entrega.');
            setErrorMessage(message);
            toast.error(message);
        } finally {
            setBusy(false);
        }
    };

    const handleRefreshPayment = async () => {
        setBusy(true);
        setErrorMessage('');
        try {
            const updated = await refreshDeliveryPaymentStatus(token);
            setJob(updated);
            toast.success(updated.payment_status === 'approved' ? 'Pix aprovado' : 'Status atualizado');
        } catch (error) {
            const message = getDeliveryErrorMessage(error, 'Erro ao consultar pagamento.');
            setErrorMessage(message);
            toast.error(message);
        } finally {
            setBusy(false);
        }
    };

    const handleProofUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !job) return;
        setBusy(true);
        setErrorMessage('');
        try {
            const compressed = await compressImage(file);
            const renamed = new File(
                [compressed],
                buildDeliveryProofFileName(job.order_number || job.sale_id, job.id, file.name),
                { type: compressed.type || 'image/jpeg' }
            );
            const formData = new FormData();
            formData.append('file', renamed);
            const upload = await vpsClient.upload<SynologyUploadResponse>('/synology/upload?folder=imagens', formData);
            const imageUrl = upload.url || upload.publicUrl || upload.cdnUrl;
            if (!imageUrl) throw new Error('Upload Synology nao retornou URL');
            const savedProof = await saveDeliveryProof(token, {
                image_url: imageUrl,
                original_file_name: renamed.name,
                compressed_size_bytes: renamed.size,
                description: proofDescription.trim() || undefined,
            });
            setProof(savedProof);
            toast.success('Foto de comprovacao enviada');
        } catch (error) {
            const message = getDeliveryErrorMessage(error, 'Erro ao enviar foto de comprovacao.');
            setErrorMessage(message);
            toast.error(message);
        } finally {
            setBusy(false);
            event.target.value = '';
        }
    };

    const handleComplete = async () => {
        if (!canComplete) return;
        setBusy(true);
        setErrorMessage('');
        try {
            setJob(await completeDeliveryJob(token, { delivery_person_note: note.trim() || undefined }));
            toast.success('Entrega realizada com sucesso');
        } catch (error) {
            const message = getDeliveryErrorMessage(error, 'Erro ao finalizar entrega.');
            setErrorMessage(message);
            toast.error(message);
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Carregando entrega...</div>;
    }

    if (!job) {
        return <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center text-slate-700">{errorMessage || 'Entrega nao encontrada.'}</div>;
    }

    return (
        <main className="min-h-screen bg-slate-50">
            <div className="mx-auto max-w-3xl px-4 py-6">
                <header className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase text-blue-700">Operacao de entrega</p>
                        <h1 className="mt-1 text-2xl font-bold text-slate-900">Pedido {job.order_number || job.sale_id}</h1>
                        <p className="mt-1 text-sm text-slate-600">{job.buyer_name}</p>
                    </div>
                    <Bike className="h-8 w-8 text-blue-600" />
                </header>

                {errorMessage && (
                    <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                        {errorMessage}
                    </div>
                )}

                <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                        <MapPin className="mt-1 h-5 w-5 text-emerald-600" />
                        <div>
                            <p className="text-sm font-semibold text-slate-800">Endereco completo da entrega</p>
                            <p className="mt-1 text-sm text-slate-600">{job.delivery_address_text}</p>
                            {job.delivery_route_url ? (
                                <a className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white" href={job.delivery_route_url} target="_blank" rel="noreferrer">Abrir rota</a>
                            ) : (
                                <p className="mt-3 text-sm font-semibold text-red-600">Endereco incompleto para rota.</p>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        {whatsappUrl ? <a className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700" href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />Falar no WhatsApp</a> : null}
                        {callUrl ? <a className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" href={callUrl}><Phone className="h-4 w-4" />Ligar para cliente</a> : null}
                        {!buyerPhone && <p className="text-sm font-semibold text-amber-700">Contato do cliente indisponivel para revisao admin.</p>}
                    </div>
                </section>

                <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-base font-semibold text-slate-900">Resumo da compra</h2>
                    <div className="mt-3 divide-y divide-slate-100">
                        {items.length === 0 ? <p className="py-3 text-sm text-slate-500">Itens nao carregados no comprovante.</p> : items.map((item, index) => (
                            <div key={index} className="flex justify-between gap-3 py-3 text-sm">
                                <span className="text-slate-700">{String(item.product_name || 'Item')} x {String(item.quantity || 1)}</span>
                                <span className="font-semibold text-slate-900">{formatCurrencyCents(toCents(item.total) || toCents(item.unit_price))}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 font-semibold">
                        <span>Valor da entrega</span>
                        <span>{formatCurrencyCents(job.delivery_amount)}</span>
                    </div>
                </section>

                <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900"><QrCode className="h-5 w-5" />Pix da entrega</h2>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{job.payment_status}</span>
                    </div>
                    {job.qr_code_base64 && <img className="mx-auto mt-4 h-52 w-52 rounded-lg border border-slate-200 object-contain p-2" src={`data:image/png;base64,${job.qr_code_base64}`} alt="QR Code Pix" />}
                    {job.qr_code && <textarea className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-xs" readOnly value={job.qr_code} rows={3} />}
                    {job.pix_expires_at && <p className="mt-2 text-xs text-slate-500">Expira em {new Date(job.pix_expires_at).toLocaleString('pt-BR')}</p>}
                    {pixExpired && <p className="mt-2 text-sm font-semibold text-red-600">Pix expirado. Gere um novo Pix para continuar.</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                        <button className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy || job.payment_status === 'approved'} onClick={handleCreatePix}><QrCode className="h-4 w-4" />Gerar Pix</button>
                        <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60" disabled={busy} onClick={handleRefreshPayment}><RefreshCw className="h-4 w-4" />Consultar pagamento</button>
                    </div>
                </section>

                <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900"><Camera className="h-5 w-5" />Foto de comprovacao</h2>
                    {proof?.image_url && <img className="mt-4 max-h-72 w-full rounded-xl object-cover" src={proof.image_url} alt="Foto de comprovacao da entrega" />}
                    <textarea className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm" value={proofDescription} onChange={(e) => setProofDescription(e.target.value)} placeholder="Descricao interna da foto" />
                    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                        <Upload className="h-4 w-4" />Enviar foto
                        <input className="hidden" type="file" accept="image/*" onChange={handleProofUpload} disabled={busy} />
                    </label>
                </section>

                <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-base font-semibold text-slate-900">Finalizar</h2>
                    <textarea className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observacao do entregador apenas para uso interno" />
                    <button className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={busy || !canComplete} onClick={handleComplete}>
                        {job.delivery_status === 'delivered' ? <CheckCircle2 className="h-5 w-5" /> : null}
                        Entrega realizada com sucesso
                    </button>
                </section>
            </div>
        </main>
    );
};

export default DeliveryOperationPage;
