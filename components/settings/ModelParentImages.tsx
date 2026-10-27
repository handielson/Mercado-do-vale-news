import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { familyWorkspacePath } from '../../services/productFormDrafts';

// One editor owns family media, operational fields and variation drafts.
export function ModelParentImages({ modelId, onBusyChange, onSaveReady }: {
    modelId: string;
    onBusyChange?: (busy: boolean) => void;
    onSaveReady?: (save: (() => Promise<boolean>) | null) => void;
}) {
    useEffect(() => { onBusyChange?.(false); onSaveReady?.(null); }, [onBusyChange, onSaveReady]);
    return <section aria-label="Fotos do produto pai" className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
        <h3 className="font-semibold">Fotos do pai, vídeo e variações</h3>
        <p className="text-sm text-slate-700">Continue no cadastro único da família. Fotos, unidade de venda, produção e variações ficam no mesmo rascunho até salvar o produto.</p>
        <Link to={familyWorkspacePath(modelId)} className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Abrir cadastro único da família</Link>
    </section>;
}
