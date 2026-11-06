import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { productService } from '../../services/products';
import { BarcodeScanButton } from '../ui/BarcodeScanButton';
import { PARENT_MESSAGE } from './FixedVariationCard';
import { nameWithSku } from './entryList.js';

export const LOOKUP_NOT_FOUND = 'Produto não encontrado. Cadastre em Produtos → Novo produto.';
const LOOKUP_ERROR = 'Não foi possível buscar o produto. Tente de novo.';

interface Found { id: string; name: string; sku?: string | null; is_parent?: boolean | number | null }

type Result =
    | { kind: 'not-found'; code: string }
    | { kind: 'parent' }
    | { kind: 'choose'; options: Found[] }
    | { kind: 'error' };

const isParent = (p: Found) => p.is_parent === true || Number(p.is_parent) === 1;
const looksLikeEan = (code: string) => /^\d{8,14}$/.test(code);

/**
 * Entrada: "Buscar produto por código de barras ou SKU". Achou uma variação → prende pelo mesmo
 * ?variacao= do atalho (sem ?aba=: a página escolhe Bipar para celular e Manual para o resto).
 */
export const BarcodeProductLookup: React.FC<{ disabled?: boolean }> = ({ disabled }) => {
    const navigate = useNavigate();
    const [code, setCode] = useState('');
    const [searching, setSearching] = useState(false);
    const [result, setResult] = useState<Result | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const pick = (id: string) => navigate(`/admin/entrada?variacao=${encodeURIComponent(id)}`);

    const lookup = async (raw: string) => {
        const value = String(raw ?? '').trim();
        if (!value || searching) return;
        setSearching(true);
        setResult(null);
        try {
            const found = (await productService.findByCode(value)) as unknown as Found[];
            const variations = found.filter(p => !isParent(p));
            if (variations.length === 1) { pick(String(variations[0].id)); return; }
            if (variations.length > 1) { setResult({ kind: 'choose', options: variations }); return; }
            setResult(found.length > 0 ? { kind: 'parent' } : { kind: 'not-found', code: value });
            setCode('');
        } catch {
            setResult({ kind: 'error' });
        } finally {
            setSearching(false);
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    };

    return (
        <div className="space-y-2">
            <label htmlFor="entry-code-lookup" className="block text-sm font-medium text-slate-700">Buscar produto por código de barras ou SKU</label>
            <div className="flex items-center gap-2">
                <input
                    id="entry-code-lookup" ref={inputRef} type="text" autoComplete="off" value={code}
                    disabled={disabled || searching} placeholder="Bipe o código de barras ou digite o SKU e pressione Enter"
                    onChange={e => setCode(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void lookup(e.currentTarget.value); } }}
                    className="flex h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                <BarcodeScanButton kind="ean" disabled={disabled || searching} onScan={values => { setCode(values[0] || ''); void lookup(values[0] || ''); }} />
                <button type="button" disabled={disabled || searching || !code.trim()} onClick={() => void lookup(code)}
                    className="px-3 py-2 rounded-md border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    Buscar
                </button>
            </div>
            {searching && <p role="status" className="text-sm text-slate-600">Buscando…</p>}
            {result?.kind === 'not-found' && (
                <p role="alert" className="text-sm text-red-600">
                    {LOOKUP_NOT_FOUND}{' '}
                    <Link to="/admin/products/new" state={looksLikeEan(result.code) ? { ean: result.code } : undefined} className="underline font-medium">Novo produto</Link>
                </p>
            )}
            {result?.kind === 'parent' && <p role="alert" className="text-sm text-red-600">{PARENT_MESSAGE}</p>}
            {result?.kind === 'error' && <p role="alert" className="text-sm text-red-600">{LOOKUP_ERROR}</p>}
            {result?.kind === 'choose' && (
                <div className="space-y-1">
                    <p className="text-sm text-slate-700">Este código está em mais de um produto. Escolha:</p>
                    <div className="flex flex-wrap gap-2">
                        {result.options.map(p => (
                            <button key={p.id} type="button" onClick={() => pick(String(p.id))}
                                className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50">
                                {nameWithSku(p.name, p.sku)}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BarcodeProductLookup;
