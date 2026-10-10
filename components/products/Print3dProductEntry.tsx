import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Printer, X } from 'lucide-react';
import { vpsApiService } from '../../services/vpsApiService';

export function Print3dProductEntry() {
    const navigate = useNavigate();
    const dialog = useRef<HTMLDialogElement>(null);
    const [open, setOpen] = useState(false);
    const [sku, setSku] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (open) dialog.current?.showModal();
        else dialog.current?.close();
    }, [open]);

    const openExisting = async () => {
        const targetSku = sku.trim();
        if (!targetSku || loading) return;
        setLoading(true);
        setError('');
        try {
            const products = await vpsApiService.getProducts({ sku: targetSku, status: 'all', limit: 10, noCache: true });
            const product = products?.find(item => String(item.sku).toLowerCase() === targetSku.toLowerCase());
            if (!product) throw new Error('SKU não encontrado. Confira o código no cadastro de produtos.');
            navigate(`/admin/products/${encodeURIComponent(product.id)}?print3d=1`);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Não foi possível buscar o produto.');
        } finally {
            setLoading(false);
        }
    };

    return <>
        <button type="button" onClick={() => { setError(''); setOpen(true); }} className="flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-800">
            <Printer className="h-4 w-4" /> Produto 3D
        </button>
        <dialog ref={dialog} onClose={() => setOpen(false)} aria-labelledby="print3d-entry-title" className="w-[calc(100%_-_2rem)] max-w-lg rounded-xl p-0 shadow-xl backdrop:bg-slate-900/50">
            <div className="space-y-5 p-6">
                <div className="flex items-start justify-between gap-4">
                    <div><h2 id="print3d-entry-title" className="text-xl font-bold text-slate-900">Incluir produto 3D</h2><p className="mt-1 text-sm text-slate-600">Cadastre um produto novo ou use um SKU que já existe no sistema.</p></div>
                    <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
                </div>
                <button type="button" onClick={() => navigate('/admin/products/new?print3d=1')} className="flex w-full items-center gap-3 rounded-lg border border-violet-200 bg-violet-50 p-4 text-left text-violet-900 hover:bg-violet-100">
                    <Plus size={22} /><span><strong className="block">Cadastrar novo produto 3D</strong><span className="mt-1 block text-sm">O cadastro já abre com a opção de impressão 3D marcada.</span></span>
                </button>
                <form onSubmit={event => { event.preventDefault(); void openExisting(); }} className="space-y-3 rounded-lg border border-slate-200 p-4">
                    <h3 className="font-semibold text-slate-900">Incluir produto existente na 3DMV</h3>
                    <label htmlFor="print3d-existing-sku" className="block text-sm text-slate-600">SKU do sistema</label>
                    <input id="print3d-existing-sku" autoFocus required value={sku} onChange={event => setSku(event.target.value)} placeholder="Ex.: SFKU3XMVB" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    <p className="text-xs text-slate-500">Confira os dados e salve para marcar o produto como 3D, mantendo o SKU atual.</p>
                    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                    <button type="submit" disabled={loading || !sku.trim()} className="w-full rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50">{loading ? 'Buscando...' : 'Abrir cadastro do produto'}</button>
                </form>
                <p className="text-xs text-slate-500">Depois do cadastro, continue com a ficha de produção, arquivo de impressão e oferta na 3DMV.</p>
            </div>
        </dialog>
    </>;
}
