import React, { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { downloadSignedWarrantyPdf, getSignedWarrantySnapshot } from '../../../services/signedWarrantyDocumentService';
import type { SignedWarrantyDocument } from '../../../types/signedWarrantyDocument';

interface SignedWarrantyDocumentCardProps {
    saleId: string;
}

function makeFileName(document: SignedWarrantyDocument): string {
    const saleCode = document.sale_code || document.sale_id || document.id;
    return `termo-garantia-venda-${saleCode}.pdf`;
}

async function withDocumentUrl(
    documentId: string,
    action: (url: string, blob: Blob) => void | Promise<void>
): Promise<void> {
    const blob = await downloadSignedWarrantyPdf(documentId);
    const url = URL.createObjectURL(blob);
    try {
        await action(url, blob);
    } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }
}

export function SignedWarrantyDocumentCard({ saleId }: SignedWarrantyDocumentCardProps) {
    const [document, setDocument] = useState<SignedWarrantyDocument | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [busyAction, setBusyAction] = useState<'view' | 'save' | 'print' | null>(null);

    useEffect(() => {
        let alive = true;

        async function loadDocument() {
            try {
                const snapshot = await getSignedWarrantySnapshot(saleId);
                if (alive) setDocument(snapshot.active);
            } catch {
                if (alive) setDocument(null);
            } finally {
                if (alive) setIsLoading(false);
            }
        }

        loadDocument();

        return () => {
            alive = false;
        };
    }, [saleId]);

    if (isLoading || !document) return null;

    const handleView = async () => {
        setBusyAction('view');
        try {
            await withDocumentUrl(document.id, (url) => {
                const opened = window.open(url, '_blank', 'noopener,noreferrer');
                if (!opened) throw new Error('POPUP_BLOCKED');
            });
        } catch {
            toast.error('Nao foi possivel abrir o PDF do termo de garantia.');
        } finally {
            setBusyAction(null);
        }
    };

    const handleDownload = async () => {
        setBusyAction('save');
        try {
            await withDocumentUrl(document.id, (url) => {
                const anchor = window.document.createElement('a');
                anchor.href = url;
                anchor.download = makeFileName(document);
                window.document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
            });
        } catch {
            toast.error('Nao foi possivel baixar o PDF do termo de garantia.');
        } finally {
            setBusyAction(null);
        }
    };

    const handlePrint = async () => {
        setBusyAction('print');
        try {
            await withDocumentUrl(document.id, (url) => {
                const opened = window.open(url, '_blank', 'noopener,noreferrer');
                if (!opened) throw new Error('POPUP_BLOCKED');
                window.setTimeout(() => {
                    try {
                        opened.focus();
                        opened.print();
                    } catch {
                        // Se o navegador impedir a chamada automatica, o PDF ja fica aberto para impressao manual.
                    }
                }, 900);
            });
        } catch {
            toast.error('Nao foi possivel imprimir o PDF do termo de garantia.');
        } finally {
            setBusyAction(null);
        }
    };

    return (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <FileText size={20} />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-emerald-950">Termo de garantia assinado</h4>
                        <p className="mt-1 text-xs leading-5 text-emerald-800">
                            {document.discard_message || 'Documento fisico digitalizado, destruido e descartado.'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 sm:justify-end">
                    <button
                        type="button"
                        onClick={handleView}
                        disabled={busyAction !== null}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <ExternalLink size={14} />
                        {busyAction === 'view' ? 'Abrindo...' : 'Visualizar PDF'}
                    </button>
                    <button
                        type="button"
                        onClick={handleDownload}
                        disabled={busyAction !== null}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <Download size={14} />
                        {busyAction === 'save' ? 'Baixando...' : 'Baixar'}
                    </button>
                    <button
                        type="button"
                        onClick={handlePrint}
                        disabled={busyAction !== null}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <Printer size={14} />
                        {busyAction === 'print' ? 'Abrindo...' : 'Imprimir'}
                    </button>
                </div>
            </div>
        </div>
    );
}
