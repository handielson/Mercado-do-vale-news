import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Layers, DownloadCloud, UploadCloud, RefreshCw, Trash2, Pencil } from 'lucide-react';
import { ModelActionsMenu } from '../components/settings/ModelActionsMenu';
import '../index.css';

function Preview() {
    const [result, setResult] = useState('Nenhuma ação');
    const [busy, setBusy] = useState(false);
    return <main className="p-6 bg-slate-50 min-h-screen">
        <h1 className="text-xl font-bold mb-4">Gestão de Modelos</h1>
        <label><input type="checkbox" checked={busy} onChange={e => setBusy(e.target.checked)} /> Bling ocupado</label>
        <p role="status">{result}</p>
        <div data-testid="table-scroll" className="mt-4 overflow-auto max-h-[420px] rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[900px] table-fixed"><colgroup><col /><col className="w-24" /><col className="w-40" /></colgroup>
                <thead><tr className="bg-slate-100"><th className="p-4 text-left">Modelo</th><th>Status</th><th>Ações</th></tr></thead>
                <tbody>{['Poco X8 5G', 'Redmi 15C', 'Modelo de teste', 'Último modelo'].map(name => <tr key={name} className="border-t border-slate-100">
                    <td className="p-6 font-medium">{name}</td><td><span className="rounded-full bg-green-100 text-green-800 px-2 py-1 text-xs">✓ Ativo</span></td>
                    <td className="p-4 sticky right-0 bg-white"><div className="flex justify-end gap-2">
                        <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 text-xs font-semibold text-blue-700" onClick={() => setResult('Editar')}><Pencil size={14} />Editar</button>
                        <ModelActionsMenu modelName={name} actions={[
                            { section: 'Produto', label: 'Produto pai, fotos e variações', icon: <Layers size={16} />, onClick: () => setResult('Produto pai') },
                            { section: 'Integração Bling', label: 'Trazer medidas do Bling', icon: <DownloadCloud size={16} />, disabled: busy, onClick: () => setResult('Trazer medidas') },
                            { label: 'Enviar medidas para o Bling', icon: <UploadCloud size={16} />, disabled: busy, onClick: () => setResult('Enviar medidas') },
                            { label: 'Re-sincronizar SKUs do Bling', icon: <RefreshCw size={16} />, disabled: busy, onClick: () => setResult('SKUs') },
                            { section: 'Modelo', label: 'Excluir modelo', icon: <Trash2 size={16} />, destructive: true, onClick: () => setResult('Excluir') },
                        ]} />
                    </div></td>
                </tr>)}</tbody>
            </table>
        </div>
        <button className="mt-4" onClick={() => setResult('Fora')}>Fora da tabela</button>
    </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
