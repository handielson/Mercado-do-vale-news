import { buildAuthHeaders } from './authSession';
import { buildVpsUrl } from './vpsProxyBase';

export interface PrintPaper { name: string; kind: number; widthMm: number; heightMm: number }
export interface PrintDestination { deviceId: string; deviceName: string; name: string; online: boolean; status: string; papers: PrintPaper[]; customSize?: boolean }
export interface PrintDevice { id: string; name: string; enabled: boolean; online: boolean; allowed_printers: string[]; inventory: { name: string; status: string; papers: PrintPaper[]; customSize?: boolean }[] }
export interface PrintJob { id: string; title: string; printer_name: string; status: string; pages: number; last_error?: string; created_at?: string }
export const printStatusLabels: Record<string, string> = {
  queued: 'Aguardando', reserved: 'Preparando', sending: 'Enviando', submitted: 'Enviado à impressora',
  failed: 'Falhou antes do envio', uncertain: 'Conferir impressão', cancelled: 'Cancelado',
};
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(buildVpsUrl(`/admin/printing${path}`, { method }), {
    method, headers: await buildAuthHeaders({ 'Content-Type': 'application/json' }),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}), cache: 'no-store', signal: AbortSignal.timeout(30000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Impressão central indisponível (${response.status}).`);
  return data;
}
export const centralPrintingService = {
  devices: () => request<{ devices: PrintDevice[] }>('/devices'),
  async destinations(): Promise<PrintDestination[]> {
    const { devices } = await this.devices();
    return devices.filter(d => d.enabled).flatMap(d => d.inventory.map(p => ({
      ...p, deviceId: d.id, deviceName: d.name, online: d.online,
    })));
  },
  jobs: () => request<{ jobs: PrintJob[] }>('/jobs'),
  job: (id: string) => request<PrintJob>(`/jobs/${encodeURIComponent(id)}`),
  createDevice: (name: string, printers: string[]) => request<{ id: string; token: string }>('/devices', 'POST', { name, printers }),
  revokeDevice: (id: string) => request(`/devices/${encodeURIComponent(id)}`, 'DELETE'),
  cancel: (id: string) => request(`/jobs/${encodeURIComponent(id)}/cancel`, 'POST', {}),
  reprint: (id: string, reason: string, idempotencyKey: string) => request<PrintJob>(`/jobs/${encodeURIComponent(id)}/reprint`, 'POST', { reason, idempotencyKey }),
  async submit(pdf: Blob, destination: PrintDestination, title: string, settings: Record<string, unknown>, idempotencyKey: string): Promise<PrintJob> {
    if (pdf.size > 8 * 1024 * 1024) throw new Error('O PDF deve ter no máximo 8 MB.');
    const pdfBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(pdf);
    });
    return request<PrintJob>('/jobs', 'POST', { deviceId: destination.deviceId, printerName: destination.name, title: title.slice(0, 120), settings, pdfBase64, idempotencyKey });
  },
};
export function destinationKey(d: PrintDestination) { return `${d.deviceId}:${d.name}`; }
export function supportsPrintSize(d: PrintDestination, width: number, height: number) {
  const near = (a: number, b: number) => Math.abs(a - b) <= 0.3;
  return d.customSize === true || d.papers.some(p => (near(p.widthMm, width) && near(p.heightMm, height)) || (near(p.heightMm, width) && near(p.widthMm, height)));
}
