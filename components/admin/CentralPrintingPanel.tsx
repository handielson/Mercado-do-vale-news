import React, { useEffect, useRef, useState } from 'react';
import { centralPrintingService as service, destinationKey, printStatusLabels, PrintDestination, PrintDevice, PrintJob } from '../../services/centralPrintingService';

export function CentralPrintingPanel() {
  const [devices, setDevices] = useState<PrintDevice[]>([]);
  const [destinations, setDestinations] = useState<PrintDestination[]>([]);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [token, setToken] = useState(''); const [selected, setSelected] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [deviceName, setDeviceName] = useState('Lenovo');
  const [printerNames, setPrinterNames] = useState('P50 Printer\nComprovante\nZDesigner ZD220-203dpi ZPL');
  const submission = useRef<{ key: string; file: File; destination: string } | null>(null);
  const reprints = useRef(new Map<string, string>());
  const actionLock = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const refresh = async () => {
    const [a, b] = await Promise.all([service.devices(), service.jobs()]);
    setDevices(a.devices); setJobs(b.jobs);
    setDestinations(a.devices.filter(d => d.enabled).flatMap(d => d.inventory.map(p => ({ ...p, deviceId: d.id, deviceName: d.name, online: d.online }))));
    setError('');
  };
  useEffect(() => {
    let active = true;
    const load = () => { if (active) void refresh().catch(e => { if (active) setError(e.message); }); };
    load(); const timer = setInterval(load, 15000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  const run = async (fn: () => Promise<unknown>) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true); setError('');
    try { await fn(); await refresh(); } catch (e) { setError((e as Error).message); } finally { actionLock.current = false; setBusy(false); }
  };
  return <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-4">
    <div className="flex items-center justify-between gap-3"><h3 className="font-bold">Impressão central — Lenovo</h3>
      <button type="button" disabled={busy} onClick={() => void run(refresh)} className="underline">Atualizar fila</button></div>
    <p className="text-sm">Envie PDFs para as impressoras da loja. O tamanho vem do documento; a impressão usa escala real.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="space-y-2">{devices.map(d => <div key={d.id} className="text-sm flex justify-between gap-2">
      <span>{d.name}: {!d.enabled ? 'revogado' : d.online ? 'conectado' : 'desconectado'}</span>
      {!!d.enabled && <button type="button" disabled={busy} onClick={() => {
        if (window.confirm(`Revogar o acesso de ${d.name} à impressão central?`)) void run(() => service.revokeDevice(d.id));
      }} className="text-red-700 underline">Revogar acesso</button>}
    </div>)}</div>
    <details><summary className="cursor-pointer text-sm font-semibold">Cadastrar computador de impressão</summary>
      <div className="mt-3 space-y-2">
        <label className="block text-sm">Nome do computador<input value={deviceName} onChange={e => setDeviceName(e.target.value)} className="block border rounded p-2 w-full" /></label>
        <label className="block text-sm">Impressoras permitidas — uma por linha<textarea value={printerNames} onChange={e => setPrinterNames(e.target.value)} className="block border rounded p-2 w-full" /></label>
        <button type="button" disabled={busy || !deviceName.trim()} className="underline" onClick={() => void run(async () => {
          const result = await service.createDevice(deviceName, printerNames.split('\n').map(v => v.trim()).filter(Boolean)); setToken(result.token);
        })}>Gerar credencial do computador</button>
        {token && <div className="text-sm space-y-2"><p>Credencial exibida somente agora. Salve na configuração do agente no Lenovo.</p>
          <input type="password" value={token} readOnly aria-label="Credencial do dispositivo" className="w-full border p-2" />
          <button type="button" className="underline" onClick={() => void navigator.clipboard.writeText(token).catch(() => setError('Não foi possível copiar a credencial.'))}>Copiar credencial</button>
          <button type="button" className="underline ml-3" onClick={() => setToken('')}>Fechar credencial</button></div>}
      </div></details>
    <div className="space-y-2 border-t border-blue-200 pt-3">
      <label className="block text-sm">Impressora<select value={selected} onChange={e => setSelected(e.target.value)} className="block w-full border rounded p-2">
        <option value="">Selecione o destino</option>{destinations.map(d => <option key={destinationKey(d)} value={destinationKey(d)}>{d.deviceName} — {d.name}{!d.online ? ' (desconectado)' : ''}</option>)}
      </select></label>
      <label className="block text-sm">PDF para imprimir<input ref={fileInput} type="file" accept="application/pdf,.pdf" onChange={e => { setFile(e.target.files?.[0] || null); submission.current = null; }} className="block w-full" /></label>
      <p className="text-xs">Todas as páginas são impressas uma vez. Para etiquetas de produtos, use “Imprimir Etiqueta” no produto para preservar as configurações do sistema.</p>
      <button type="button" disabled={busy || !file || !selected} className="rounded bg-blue-600 text-white px-3 py-2 disabled:opacity-50" onClick={() => void run(async () => {
        const destination = destinations.find(d => destinationKey(d) === selected);
        if (!destination || !file) return;
        if (!submission.current || submission.current.file !== file || submission.current.destination !== selected) submission.current = { key: crypto.randomUUID(), file, destination: selected };
        await service.submit(file, destination, file.name, {}, submission.current.key);
        setFile(null); submission.current = null;
        if (fileInput.current) fileInput.current.value = '';
      })}>Enviar PDF</button>
    </div>
    <div className="overflow-x-auto"><table className="text-sm w-full"><thead><tr className="text-left"><th>Documento</th><th>Impressora</th><th>Estado</th><th>Ações</th></tr></thead>
      <tbody>{jobs.map(job => <tr key={job.id} className="border-t border-blue-100 align-top"><td className="py-2">{job.title}<div className="text-xs">{job.pages} página(s)</div></td><td>{job.printer_name}</td>
        <td>{printStatusLabels[job.status] || job.status}{job.last_error && <div className="text-xs text-red-700">{job.last_error}</div>}</td>
        <td>{job.status === 'queued' ? <button type="button" disabled={busy} className="underline" onClick={() => void run(() => service.cancel(job.id))}>Cancelar</button> :
          ['submitted', 'failed', 'uncertain', 'cancelled'].includes(job.status) && <button type="button" disabled={busy} className="underline" onClick={() => {
            const reason = window.prompt('Confira a impressora. Reimprimir pode gerar outra via. Informe o motivo:');
            if (reason?.trim()) void run(async () => {
              const key = reprints.current.get(job.id) || crypto.randomUUID(); reprints.current.set(job.id, key);
              await service.reprint(job.id, reason.trim(), key); reprints.current.delete(job.id);
            });
          }}>Reimprimir</button>}</td></tr>)}</tbody></table></div>
    <p className="text-xs">“Enviado à impressora” confirma o envio ao Windows. Confira a saída física em caso de falta de papel ou erro do equipamento.</p>
  </section>;
}
