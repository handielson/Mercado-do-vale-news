import React, { useState } from 'react';
import { toast } from 'sonner';
import { vpsClient } from '../../../services/vpsClient';

type StockCheck = { product_id: string; sku: string; quantity: number; applied_quantity: number; confirmed: boolean; conflict: boolean };
export function SaleStockReconciliation({saleId,onReconciled}:{saleId:string;onReconciled:()=>void}) {
    const [report,setReport]=useState<StockCheck[]|null>(null);
    const [confirmed,setConfirmed]=useState<Record<string,boolean>>({});
    const [note,setNote]=useState('');
    const [busy,setBusy]=useState(false);
    const missing=report?.filter(item=>!item.confirmed)||[];
    const canConfirm=Boolean(report?.length)&&!report?.some(item=>item.conflict)
        &&missing.every(item=>confirmed[item.product_id])&&(!missing.length||note.trim().length>=20);
    const load=async()=>{
        setBusy(true);
        try{const result=await vpsClient.get<{report:StockCheck[]}>(`/sales/${encodeURIComponent(saleId)}/stock-reconciliation`);setReport(result.report);setConfirmed({});}
        catch(error){toast.error(error instanceof Error?error.message:'Nao foi possivel conferir os movimentos.');}
        finally{setBusy(false);}
    };
    const reconcile=async()=>{
        if(!canConfirm)return;
        setBusy(true);
        try{
            const result=await vpsClient.post<{status:string}>(`/sales/${encodeURIComponent(saleId)}/stock-reconciliation`,{
                evidence:missing.map(item=>({product_id:item.product_id,quantity:item.quantity,source:'bling',reference:saleId.slice(0,8).toUpperCase(),note:note.trim()})),
            });
            toast.success(result.status==='success'?'Conferencia registrada. Revisao encerrada.':'Estoque conferido. Outras pendencias continuam em revisao.');onReconciled();
        }catch(error){toast.error(error instanceof Error?error.message:'Nao foi possivel registrar a conferencia.');}
        finally{setBusy(false);}
    };
    return <div className="mt-3 space-y-3 rounded-lg border border-amber-200 bg-white p-3 text-sm text-slate-700">
        <p className="font-semibold">Conferência da baixa de estoque</p>
        <p className="text-xs">Esta conferência atualiza a auditoria da venda. Não baixa nem repõe estoque.</p>
        {!report?<button type="button" disabled={busy} onClick={load} className="rounded border px-3 py-2 font-semibold disabled:opacity-50">{busy?'Conferindo…':'Conferir movimentos desta venda'}</button>:<>
            {report.map(item=><div key={item.product_id} className="rounded border p-2">
                <p><strong>{item.sku}</strong> · Venda: {item.quantity} · Baixa local registrada: {item.applied_quantity}</p>
                {item.conflict?<p className="text-red-700">Quantidades divergentes. Investigue antes de encerrar a revisão.</p>:item.confirmed?<p className="text-emerald-700">Baixa local confirmada.</p>:<label className="mt-2 flex items-start gap-2 text-xs"><input type="checkbox" checked={Boolean(confirmed[item.product_id])} onChange={event=>setConfirmed({...confirmed,[item.product_id]:event.target.checked})}/>Conferi no histórico do Bling uma saída de {item.quantity} para este SKU, vinculada à venda #{saleId.slice(0,8).toUpperCase()}, e o saldo já está refletido em nosso sistema.</label>}
            </div>)}
            {!!missing.length&&<label className="block text-xs">Registre data, lançamento e resultado da conferência no Bling<textarea maxLength={1000} value={note} onChange={event=>setNote(event.target.value)} className="mt-1 block w-full rounded border p-2" placeholder="Descreva a evidência consultada (mínimo 20 caracteres)"/></label>}
            <button type="button" disabled={busy||!canConfirm} onClick={reconcile} className="rounded bg-blue-600 px-3 py-2 font-semibold text-white disabled:opacity-50">{busy?'Registrando…':'Registrar conferência sem alterar estoque'}</button>
        </>}
    </div>;
}
