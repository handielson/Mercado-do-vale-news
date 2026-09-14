import { vpsClient } from './vpsClient';

export interface SceneBackground {
  id: string; origin: string; url: string; thumbnail?: string; contextKey: string; context: string;
  categoryId?: string; subcategoryId?: string; tags: string[]; orientation: string;
  width: number; height: number; photographer?: string; photographerPage?: string; photoPage?: string;
  approved: boolean; active: boolean; imported: boolean; uses: number;
  assessment?: { score: number; status: string };
}
export interface SceneChoice { background: SceneBackground; dataUrl: string }
export interface SceneItem {
  productId: string; productName: string; background: SceneBackground | null;
  context: { key: string; context: string }; status: string; attempts: number; message?: string;
  outputUrl?: string; completedAt?: string;
  completedSlides?: number[];
}
export interface ScenePlan { items: SceneItem[]; queries: number; contexts: number; reused: number; newBackgrounds: number; warnings: string[] }
export interface SceneJob extends ScenePlan { id: string; createdAt: string; updatedAt?: string; cancelled: boolean; format: 'status' | 'feed'; showPrice: boolean }
const base = '/admin/marketing/scenes';
const images = new Map<string, Promise<string>>();
const executions = new Map<string, string>();
export const marketingScenes = {
  status: () => vpsClient.get<{ configured: boolean; limits?: { remaining: number; reset: number } }>(base + '/status'),
  library: () => vpsClient.get<{ items: SceneBackground[] }>(base + '/library'),
  upload: (productId: string, dataUrl: string) => vpsClient.post<SceneBackground>(base + '/upload', { productId, dataUrl }),
  search: (productId: string, query = '', page = 1, locale = 'en-US') => vpsClient.post<{ items: SceneBackground[]; scene: { context: string; primaryQuery: string }; hasMore: boolean; warning: string; cached: boolean }>(base + '/search', { productId, query, page, locale }),
  import: (ids: string[], approved: boolean) => vpsClient.post<{ items: (SceneBackground & { message?: string; status?: string })[] }>(base + '/import', { ids, approved }),
  select: (productId: string, id: string) => vpsClient.post(base + '/select', { productId, id }),
  update: (id: string, changes: { approved?: boolean; active?: boolean }) => vpsClient.patch<SceneBackground>(base + '/library/' + encodeURIComponent(id), changes),
  prepare: (productIds: string[], variation = 0) => vpsClient.post<ScenePlan>(base + '/prepare', { productIds, variation }),
  image: (id: string) => {
    if (!images.has(id)) {
      if (images.size >= 24) images.delete(images.keys().next().value!);
      images.set(id, vpsClient.post<{ dataUrl: string }>(base + '/image', { id }).then(r => r.dataUrl).catch(error => { images.delete(id); throw error; }));
    }
    return images.get(id)!;
  },
  jobs: () => vpsClient.get<{ items: SceneJob[] }>(base + '/jobs'),
  job: (productIds: string[], format: string, showPrice: boolean, idempotencyKey: string) => vpsClient.post<SceneJob>(base + '/jobs', { productIds, format, showPrice, idempotencyKey }),
  claim: async (id: string) => { const token=crypto.randomUUID(); await vpsClient.post(base+'/jobs/'+encodeURIComponent(id)+'/claim',{runToken:token}); executions.set(id,token); },
  replan: (id: string) => vpsClient.post<SceneJob>(base+'/jobs/'+encodeURIComponent(id)+'/replan',{runToken:executions.get(id)}),
  release: async (id: string) => { const token=executions.get(id); if(token) { await vpsClient.post(base+'/jobs/'+encodeURIComponent(id)+'/release',{runToken:token}); executions.delete(id); } },
  progress: (id: string, changes: Record<string, unknown>) => vpsClient.patch<SceneJob>(base + '/jobs/' + encodeURIComponent(id), { ...changes, runToken: executions.get(id) }),
};

export function downloadSceneReport(job: SceneJob, format: 'json' | 'csv') {
  const counts = job.items.reduce<Record<string, number>>((result, item) => ({ ...result, [item.status]: (result[item.status] || 0) + 1 }), {});
  const escape = (value: unknown) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
  const contents = format === 'json' ? JSON.stringify({ ...job, counts, elapsedMs: Date.parse(job.updatedAt || job.createdAt) - Date.parse(job.createdAt) }, null, 2)
    : '\uFEFF' + [['produto_id', 'produto', 'contexto', 'status', 'tentativas', 'fundo', 'fotografo', 'credito', 'arquivo', 'observacao'], ...job.items.map(i => [i.productId, i.productName, i.context?.context, i.status, i.attempts, i.background?.id, i.background?.photographer, i.background?.photoPage, i.outputUrl, i.message])].map(row => row.map(escape).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([contents], { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `cenarios-${job.id}.${format}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
