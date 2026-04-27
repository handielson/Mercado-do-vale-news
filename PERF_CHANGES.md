# Sprint 1 — Correções de Performance (Lighthouse)

**Branch:** `perf/lighthouse-fixes` (criada a partir de `615cbe5` em `mdv-perf-main`)
**Data:** abr/2026
**Escopo:** baixo risco, mudanças isoladas. Refatorações maiores (Provider de payment-fees, batch de product_reviews, manualChunks no Vite, React Query) ficam para Sprint 2/3 conforme o estudo `Estudo_Melhorias_Performance_MercadoDoVale.docx`.

## Resumo

20 arquivos modificados, 1 novo (`services/companyContext.ts`), `+113 / −233` linhas — saldo negativo em código graças à eliminação de `getCompanyId()` duplicado em 15 services.

## O que foi mudado

### 1. Preconnect / dns-prefetch (`index.html`)

Adicionadas dicas de pré-conexão no `<head>`:

- `preconnect`: Supabase e `api.xiaomipetrolina.com.br` (dados primários, custos de DNS+TCP+TLS antecipados).
- `dns-prefetch`: Open-Meteo (forecast e geocoding) e BrasilAPI (feriados) — mais barato porque essas origens não são consultadas no LCP.

**Ganho esperado:** −700 a 1.500 ms de LCP (Lighthouse estimou economia de 740 + 730 + 320 + 300 ms só para essas origens).

### 2. `VITE_COMPANY_ID` + `services/companyContext.ts` (novo arquivo)

Antes, 15 services tinham um `async function getCompanyId()` IDÊNTICO que disparava `supabase.from('companies').select('id').eq('slug', 'mercado-do-vale')` — Lighthouse mostrou esse lookup repetido 3× na home.

Foi criado um helper único em `services/companyContext.ts` que:

1. Lê `VITE_COMPANY_ID` da env. Se definida, retorna **sem fazer query**.
2. Caso contrário, faz **uma única** chamada Supabase, dedupe de promessas concorrentes e cache de módulo.

Cada um dos 15 services passou a importar `getCompanyId` desse helper:

- `services/{models,brands,colors,model-color-images,modelColorImages,models-new,orderService,paymentIntegrationService,productService,units,warrantyTemplates,warrantyDocumentService,products,customers,modelImageCache}.ts`

Compatibilidade: a assinatura `getCompanyId(): Promise<string>` é idêntica à anterior, então nenhum chamador precisou ser ajustado. `customers.ts` e `modelImageCache.ts` foram tratados como casos especiais (método de classe e retorno `Promise<string | null>`, respectivamente).

**Ação requerida no deploy:** definir `VITE_COMPANY_ID = "9717131e-7b14-4aec-84a4-4317c0489985"` no Vercel (já documentado em `VERCEL_ENV_VARS.md` e `.env.example`).

**Ganho esperado:** −300 a 600 ms de LCP, eliminação completa das ~3 chamadas duplicadas.

### 3. `jspdf` como dynamic import (`utils/catalogPDFGenerator.ts`, `utils/legacySalePdfGenerator.ts`)

Antes, `import jsPDF from 'jspdf'` no topo do módulo fazia o pacote (~128 KiB) cair no chunk inicial — mesmo para usuários que nunca clicam em "Gerar catálogo".

Agora `jsPDF` é importado dinamicamente:

```ts
const { default: JsPDF } = (await import('jspdf')) as { default: JsPdfClass };
const doc = new JsPDF({ ... });
```

A tipagem foi preservada via `import type { default as JsPdfType }` no topo (não vai pro runtime).

`autoTable` (do `jspdf-autotable`) foi removido porque era importado mas não usado em lugar nenhum.

**Ganho esperado:** −128,64 KiB removidos do bundle de carregamento inicial.

### 4. WeatherWidget — deduplicação de fetches (`components/WeatherWidget.tsx`)

O `WeatherWidget` é deliberadamente montado 2× no `PublicHeader` (mobile via `sm:hidden` e desktop via `hidden sm:flex`). React monta ambos componentes, então cada um disparava `fetchCoords` + `fetchWeather` — aparecendo no Lighthouse como 2× `/v1/forecast` e 2× `/v1/search`.

Solução: Maps `_coordsInflight` e `_weatherInflight` no nível do módulo. Quando uma URL já tem promise em voo, a segunda chamada apanha a mesma promise. Resultado: 1 fetch por URL, mesmo com duas instâncias do componente.

A liberação do cache acontece 100 ms após a resolução (não cachear erros indefinidamente).

**Ganho esperado:** elimina 2 chamadas (~700 a 900 ms paralelos eliminados do caminho crítico).

## Validação

- [x] Cada arquivo modificado passa no parser do esbuild (sintaxe TS/TSX válida).
- [x] Todos os 15 services importam `./companyContext` corretamente.
- [x] `getCompanyId()` continua sendo chamado pelo mesmo nome em todos os consumidores.
- [x] `index.html` contém todas as 5 tags de preconnect/dns-prefetch.
- [ ] **Pendente:** rodar `npm run build` localmente para validação completa de TypeScript (não foi possível no ambiente de geração; o `node_modules` é um symlink quebrado no mount Linux).
- [ ] **Pendente:** rodar Lighthouse pós-deploy em staging para confirmar a queda do LCP.

## Como aplicar

As mudanças já estão aplicadas no working tree do worktree `mdv-perf-main` (branch `perf/lighthouse-fixes`). Há também um patch unificado em `lighthouse-perf-fixes.patch` na raiz da pasta, caso prefira aplicar manualmente em outro lugar:

```bash
cd <repo>
git checkout -b perf/lighthouse-fixes
git apply lighthouse-perf-fixes.patch
git add -A
git commit -m "perf(lighthouse): preconnect, VITE_COMPANY_ID, lazy jspdf, dedup WeatherWidget"
```

## Próximos passos sugeridos (Sprint 2)

Quando quiser dar continuidade, os ganhos maiores estão nestes itens (não aplicados aqui por demandarem mais testes):

1. **Centralizar `paymentFeesService.list()` em Provider** (–4,5 a 5,0 s — o maior ganho disponível).
2. **Batch `/product_reviews` via `.in()`** — substituir 30+ chamadas por 1 (–4,0 a 6,5 s).
3. **`manualChunks` no Vite** para agrupar ícones Lucide em um único chunk (–300 a 500 ms).
4. **Remover `?_t=` em endpoints GET** e configurar `Cache-Control + ETag`.
