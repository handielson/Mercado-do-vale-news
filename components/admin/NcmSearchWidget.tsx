import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Loader2, X, CheckCircle2, Info, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { vpsApiService } from '../../services/vpsApiService';

interface NcmResult {
  codigo: string;
  descricao: string;
}

async function fetchNcmResults(searchTerm: string): Promise<NcmResult[]> {
  const term = searchTerm.trim();
  if (!term) return [];

  const res = await fetch(`/api/brasilapi-ncm?search=${encodeURIComponent(term)}`);
  if (!res.ok) throw new Error(`BrasilAPI HTTP ${res.status}`);
  return res.json();
}

/**
 * Mapa NCM → CEST para eletrônicos comuns (Tabela CONFAZ / Conv. ICMS 142/2018).
 * Fonte: https://www.confaz.fazenda.gov.br
 * Segmento 21 = Materiais Elétricos | Segmento 17 = Produtos Eletrônicos, Eletroeletrônicos
 * ⚠️  A sujeição ao ICMS-ST depende do estado. Em PE: Decreto 56.411/2024.
 */
const NCM_CEST_MAP: Record<string, { cest: string; segmento: string; descricao: string }> = {
  // Celulares / Smartphones
  '85171300': { cest: '1700100', segmento: '17', descricao: 'Telefone celular / Smartphone' },
  '85171400': { cest: '1700100', segmento: '17', descricao: 'Telefone celular / Smartphone' },
  '85176262': { cest: '1700100', segmento: '17', descricao: 'Aparelho de comunicação por tecnologia celular' },
  '85176290': { cest: '1700100', segmento: '17', descricao: 'Outros aparelhos de comunicação' },

  // Tablets / iPads
  '84713012': { cest: '1700500', segmento: '17', descricao: 'Tablets' },
  '84713019': { cest: '1700500', segmento: '17', descricao: 'Tablets (outros)' },

  // Notebooks / Laptops
  '84713690': { cest: '1700400', segmento: '17', descricao: 'Notebook / Computador portátil' },
  '84714190': { cest: '1700400', segmento: '17', descricao: 'Notebook (outros)' },

  // Smartwatch / Relógio Inteligente
  '91021900': { cest: '1701100', segmento: '17', descricao: 'Smartwatch / Relógio inteligente' },

  // Câmeras fotográficas
  '85258020': { cest: '1700600', segmento: '17', descricao: 'Câmera fotográfica digital' },
  '85258029': { cest: '1700600', segmento: '17', descricao: 'Câmera fotográfica digital (outros)' },

  // Fone de ouvido / Headphone / Earphone
  '85183000': { cest: '1700700', segmento: '17', descricao: 'Fone de ouvido / Headphone' },
  '85182900': { cest: '1700700', segmento: '17', descricao: 'Alto-falantes / fone sem fio' },

  // Caixa de som / Speaker portátil
  '85182200': { cest: '1700700', segmento: '17', descricao: 'Caixa de som portátil (Bluetooth)' },

  // Carregador / Fonte de alimentação
  '85044010': { cest: '2100100', segmento: '21', descricao: 'Carregador de celular / adaptador de carga' },
  '85044090': { cest: '2100100', segmento: '21', descricao: 'Carregadores (outros)' },

  // Cabo USB / HDMI
  '85444290': { cest: '2100200', segmento: '21', descricao: 'Cabo USB / HDMI / dados' },
  '85444299': { cest: '2100200', segmento: '21', descricao: 'Cabos elétricos (outros)' },

  // TV / Monitor
  '85285200': { cest: '1700200', segmento: '17', descricao: 'Monitor / TV LCD / LED' },
  '85289099': { cest: '1700200', segmento: '17', descricao: 'Aparelho de TV (outros)' },

  // Console de videogame
  '95045000': { cest: '1700900', segmento: '17', descricao: 'Videogame / Console' },
  '84717010': { cest: '1700900', segmento: '17', descricao: 'Controle / Console portátil' },

  // Teclado / Mouse
  '84716060': { cest: '2100300', segmento: '21', descricao: 'Teclado de computador' },
  '84716010': { cest: '2100400', segmento: '21', descricao: 'Mouse de computador' },

  // Power bank / Bateria externa
  '85078000': { cest: '2100100', segmento: '21', descricao: 'Bateria / Power bank' },
  '85076000': { cest: '2100100', segmento: '21', descricao: 'Bateria de lítio (outros)' },
};

/** Busca o CEST correspondente ao NCM (exato ou primeiros 6 dígitos) */
function suggestCest(ncm: string): typeof NCM_CEST_MAP[string] | null {
  const clean = ncm.replace(/\D/g, '');
  if (NCM_CEST_MAP[clean]) return NCM_CEST_MAP[clean];
  const prefix = clean.slice(0, 6);
  const match = Object.entries(NCM_CEST_MAP).find(([k]) => k.startsWith(prefix));
  return match ? match[1] : null;
}

/** Capítulos NCM mais comuns em eletrônicos/varejo */
const NCM_CHAPTER_MAP: Record<string, string> = {
  '84': 'Reatores nucleares, máquinas e aparelhos mecânicos',
  '85': 'Máquinas e aparelhos elétricos; aparelhos de gravação de som',
  '87': 'Veículos automóveis, tratores e outros veículos terrestres',
  '90': 'Instrumentos de óptica, fotografia e instrumentos de medida',
  '91': 'Aparelhos de relojoaria e suas partes',
  '94': 'Móveis; mobiliário médico-cirúrgico; colchões',
  '95': 'Brinquedos, jogos, artigos para divertimento e esporte',
  '96': 'Obras diversas',
};

interface NcmPosInfo {
  name: string;
  examples: Array<{ item: string; ok: boolean; redirect?: string }>;
  cestNote: string;
}

/** Posições NCM → exemplos de produtos ✅/❌ */
const NCM_POSITION_MAP: Record<string, NcmPosInfo> = {
  '851712': {
    name: 'Telefones para redes celulares — outros tipos',
    examples: [
      { item: 'Smartphone / Celular (qualquer marca)', ok: true },
      { item: 'Feature phone (celular simples, não-smart)', ok: true },
      { item: 'Telefone fixo residencial', ok: false, redirect: '8517.11' },
      { item: 'Telefone IP/VOIP de mesa', ok: false, redirect: '8517.61' },
    ],
    cestNote: 'CEST 17.001.00 — Sujeito a ICMS-ST em PE',
  },
  '851713': {
    name: 'Telefones para redes celulares — com câmera (câmera-phone)',
    examples: [
      { item: 'Smartphone com câmera principal ≥ 1 lente', ok: true },
      { item: 'iPhone, Galaxy, Redmi, Motorola', ok: true },
    ],
    cestNote: 'CEST 17.001.00 — Sujeito a ICMS-ST em PE',
  },
  '851762': {
    name: 'Outros aparelhos para comunicação sem fio em rede local',
    examples: [
      { item: 'Roteador Wi-Fi doméstico', ok: true },
      { item: 'Modem/Roteador 4G/5G', ok: true },
      { item: 'Access point Wi-Fi', ok: true },
      { item: 'Repetidor de sinal Wi-Fi', ok: true },
      { item: 'Celular / Smartphone', ok: false, redirect: '8517.13' },
    ],
    cestNote: 'Verificar — roteadores geralmente não têm CEST',
  },
  '847130': {
    name: 'Máquinas automáticas de processamento de dados, portáteis (peso ≤ 10 kg)',
    examples: [
      { item: 'Tablet (iPad, Android tablet)', ok: true },
      { item: 'Tablet com teclado removível', ok: true },
      { item: 'Notebook fino (como Macbook Air)', ok: true },
      { item: 'Desktop / PC de mesa', ok: false, redirect: '8471.41' },
    ],
    cestNote: 'CEST 17.005.00 (tablet) / 17.004.00 (notebook) — ICMS-ST',
  },
  '847136': {
    name: 'Outras máquinas automáticas de processamento de dados portáteis',
    examples: [
      { item: 'Notebook / Laptop convencional', ok: true },
      { item: 'Ultrabook', ok: true },
      { item: 'Netbook / Chromebook', ok: true },
      { item: 'Desktop / Tower', ok: false, redirect: '8471.41' },
    ],
    cestNote: 'CEST 17.004.00 (Seg. 17) — Sujeito a ICMS-ST',
  },
  '852580': {
    name: 'Câmeras de televisão, câmeras digitais e câmeras de vídeo',
    examples: [
      { item: 'Câmera fotográfica digital compacta', ok: true },
      { item: 'Câmera DSLR / Mirrorless', ok: true },
      { item: 'Câmera de ação (GoPro, DJI Action)', ok: true },
      { item: 'Filmadora / Câmera de vídeo', ok: true },
      { item: 'Câmera de segurança IP/CFTV', ok: false, redirect: '8525.89' },
    ],
    cestNote: 'CEST 17.006.00 (Seg. 17) — Câmeras digitais',
  },
  '851830': {
    name: 'Fones de ouvido, mesmo combinados com microfone',
    examples: [
      { item: 'Headphone com fio (P2/P3)', ok: true },
      { item: 'Fone intra-auricular (earphone)', ok: true },
      { item: 'Headset gamer com microfone', ok: true },
      { item: 'TWS / Fone Bluetooth sem fio', ok: true },
      { item: 'Caixa de som Bluetooth portátil', ok: false, redirect: '8518.22' },
    ],
    cestNote: 'CEST 17.007.00 (Seg. 17) — Fones e headsets',
  },
  '851822': {
    name: 'Alto-falantes múltiplos, montados em caixas acústicas',
    examples: [
      { item: 'Caixa de som Bluetooth portátil (JBL, Sony)', ok: true },
      { item: 'Soundbar / Barra de som para TV', ok: true },
      { item: 'Caixa acústica Hi-Fi para home theater', ok: true },
      { item: 'Subwoofer automotivo', ok: false, redirect: '8518.29' },
      { item: 'Fone de ouvido', ok: false, redirect: '8518.30' },
    ],
    cestNote: 'CEST 17.007.00 (Seg. 17)',
  },
  '850440': {
    name: 'Conversores estáticos — carregadores e fontes de alimentação',
    examples: [
      { item: 'Carregador de celular (USB / USB-C)', ok: true },
      { item: 'Carregador de notebook (pino)', ok: true },
      { item: 'Carregador USB-C GaN / turbo', ok: true },
      { item: 'Carregador sem fio (Qi / MagSafe)', ok: true },
      { item: 'Carregador veicular (isqueiro)', ok: true },
      { item: 'Hub USB com carregamento', ok: true },
    ],
    cestNote: 'CEST 21.001.00 (Seg. 21) — Materiais elétricos',
  },
  '854442': {
    name: 'Outros condutores elétricos para tensão ≤ 1.000 V — com peças de conexão',
    examples: [
      { item: 'Cabo USB-A para USB-C', ok: true },
      { item: 'Cabo USB-A para Micro-USB', ok: true },
      { item: 'Cabo HDMI', ok: true },
      { item: 'Cabo Lightning (iPhone)', ok: true },
      { item: 'Cabo de dados / sincronização', ok: true },
      { item: 'Fio de extensão elétrica simples', ok: false, redirect: '8544.42.99' },
    ],
    cestNote: 'CEST 21.002.00 (Seg. 21)',
  },
  '852852': {
    name: 'Monitores aptos a serem conectados diretamente a máquinas de processamento',
    examples: [
      { item: 'Monitor de computador LCD/LED/IPS', ok: true },
      { item: 'Monitor gamer (alta taxa de atualização)', ok: true },
      { item: 'Monitor ultrawide / curvo', ok: true },
      { item: 'Televisor doméstico comum', ok: false, redirect: '8528.71/72' },
    ],
    cestNote: 'CEST 17.002.00 (Seg. 17)',
  },
  '850780': {
    name: 'Outros acumuladores elétricos (exceto chumbo e níquel)',
    examples: [
      { item: 'Power bank / Bateria portátil USB', ok: true },
      { item: 'Bateria recarregável Li-ion avulsa', ok: true },
      { item: 'Bateria para notebook (módulo)', ok: true },
      { item: 'Bateria para celular (avulsa)', ok: true },
      { item: 'Bateria automotiva de chumbo', ok: false, redirect: '8507.10' },
    ],
    cestNote: 'CEST 21.001.00 (Seg. 21)',
  },
  '850760': {
    name: 'Acumuladores de íons de lítio',
    examples: [
      { item: 'Bateria Li-ion para celular (avulsa)', ok: true },
      { item: 'Célula / pack de bateria de lítio', ok: true },
      { item: 'Bateria Li-Po para drone', ok: true },
      { item: 'Power bank (bateria externa)', ok: true },
    ],
    cestNote: 'CEST 21.001.00 (Seg. 21)',
  },
  '950450': {
    name: 'Videogames dos tipos utilizados com receptor de televisão',
    examples: [
      { item: 'Console PlayStation (PS4, PS5)', ok: true },
      { item: 'Console Xbox (Series X/S, One)', ok: true },
      { item: 'Nintendo Switch (dock + portátil)', ok: true },
      { item: 'Controle/gamepad sem fio', ok: true },
      { item: 'Game de tabuleiro / brinquedo físico', ok: false, redirect: '9504.40' },
    ],
    cestNote: 'CEST 17.009.00 (Seg. 17)',
  },
  '852910': {
    name: 'Antenas e refletores de antenas de qualquer tipo; partes adequadas',
    examples: [
      { item: 'Antena externa de TV (UHF/VHF)', ok: true },
      { item: 'Antena parabólica (satélite)', ok: true },
      { item: 'Antena de roteador Wi-Fi (rosca externa)', ok: true },
      { item: 'Antena para câmera de segurança wireless', ok: true },
      { item: 'Booster / amplificador de sinal celular (antena)', ok: true },
      { item: 'Antena Yagi (radioamador / ponto a ponto)', ok: true },
      { item: 'Antena interna de varinha / "orelha"', ok: false, redirect: '8529.10.11' },
      { item: 'Antena embutida no celular', ok: false, redirect: 'parte do 8517' },
    ],
    cestNote: 'Geralmente NÃO tem CEST — antenas raramente sujeitas a ICMS-ST em PE',
  },
  '910219': {
    name: 'Relógios de pulso, bolso e semelhantes — outros (não de metais preciosos)',
    examples: [
      { item: 'Smartwatch (Apple Watch, Galaxy Watch)', ok: true },
      { item: 'Smartband / Pulseira inteligente (Xiaomi, Fitbit)', ok: true },
      { item: 'Relógio esportivo com GPS (Garmin, Polar)', ok: true },
      { item: 'Relógio analógico simples de pulso', ok: false, redirect: '9102.11/12' },
    ],
    cestNote: 'CEST 17.011.00 (Seg. 17)',
  },
};

/**
 * Retorna dados estruturados de abrangência para um NCM.
 * Tenta match exato (6 dígitos), depois por família (4 dígitos).
 */
function getNcmInfo(ncm: string): { chapterName: string | null; posInfo: NcmPosInfo | null } {
  const clean = ncm.replace(/\D/g, '');
  const chapter = clean.slice(0, 2);
  const prefix6 = clean.slice(0, 6);
  const prefix4 = clean.slice(0, 4);

  const chapterName = NCM_CHAPTER_MAP[chapter] ?? null;
  const posInfo = NCM_POSITION_MAP[prefix6] ?? NCM_POSITION_MAP[prefix4] ?? null;

  return { chapterName, posInfo };
}

interface NcmSearchWidgetProps {
  /** ID do produto na VPS */
  productId: string;
  /** SKU do produto (log) */
  sku?: string;
  /** Nome do produto — pré-popula o campo de busca */
  productName?: string;
  /** Valor NCM atual */
  currentNcm?: string;
  /** Valor CEST atual */
  currentCest?: string;
  /** Callback após salvar com sucesso */
  onSaved?: (ncm: string, cest?: string) => void;
  /** Callback quando valor muda localmente */
  onChange?: (ncm: string) => void;
  /** Se false, não auto-salva na VPS */
  autoSave?: boolean;
  /** Rótulo exibido acima do campo */
  label?: string;
}

/**
 * NcmSearchWidget — Busca NCM pelo nome do produto via BrasilAPI.
 * Também exibe e persiste o CEST (campo fiscal auxiliar).
 * VPS-first: salva em /products/{id}/fiscal como fonte primária.
 */
export function NcmSearchWidget({
  productId,
  sku,
  productName = '',
  currentNcm = '',
  currentCest = '',
  onSaved,
  onChange,
  autoSave = true,
  label = 'NCM',
}: NcmSearchWidgetProps) {
  const [query, setQuery] = useState(productName);
  const [results, setResults] = useState<NcmResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(currentNcm);
  const [selectedDesc, setSelectedDesc] = useState('');
  const [cest, setCest] = useState(currentCest);
  const [cestSuggestion, setCestSuggestion] = useState<typeof NCM_CEST_MAP[string] | null>(null);
  const [open, setOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  // Consulta avulsa (não afeta o produto)
  const [lookupNcm, setLookupNcm] = useState('');
  const [lookupDesc, setLookupDesc] = useState('');
  const [lookupInfo, setLookupInfo] = useState<{ chapterName: string | null; posInfo: NcmPosInfo | null } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [showLookup, setShowLookup] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelected(currentNcm);
    // Se tiver NCM salvo mas sem descrição ainda, busca na BrasilAPI
    if (currentNcm && !selectedDesc) {
      const code = currentNcm.replace(/\D/g, '');
      const formatted = `${code.slice(0,4)}.${code.slice(4,6)}.${code.slice(6,8)}`;
      fetchNcmResults(formatted)
        .then((data: NcmResult[]) => {
          const match = data.find(r => r.codigo.replace(/\./g, '') === code);
          if (match) setSelectedDesc(match.descricao);
        })
        .catch(() => {}); // silencioso — mapa interno serve de fallback
    }
  }, [currentNcm]);
  useEffect(() => { setCest(currentCest); }, [currentCest]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (term: string) => {
    if (!term.trim() || term.trim().length < 3) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const data = await fetchNcmResults(term);
      // Filtra apenas códigos folha (8+ dígitos sem pontos)
      const leaves = data.filter(r => r.codigo.replace(/\./g, '').length >= 8).slice(0, 25);
      setResults(leaves);
      setOpen(leaves.length > 0);
    } catch (err) {
      console.warn('[NcmSearch] error:', err);
      toast.error('Erro ao buscar NCM. Verifique a conexão.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    // Limpa seleção se usuário editar manualmente
    if (selected && value !== `${selected} — ${selectedDesc}`) {
      setSelected('');
      setSelectedDesc('');
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 400);
  };

  const handleSelect = async (result: NcmResult) => {
    const code = result.codigo.replace(/\./g, ''); // "8517.62.62" → "85176262"
    setSelected(code);
    setSelectedDesc(result.descricao);
    setQuery(`${code} — ${result.descricao}`);
    setOpen(false);
    onChange?.(code);

    // Sugestão automática de CEST
    const sugg = suggestCest(code);
    setCestSuggestion(sugg);
    if (sugg && !cest) {
      setCest(sugg.cest); // pré-preenche se CEST ainda estava vazio
    }
    if (!autoSave) return;

    setSaving(true);
    try {
      const ok = await vpsApiService.updateProductFiscal(productId, { ncm: code });
      if (ok) {
        toast.success(`NCM ${code} salvo na VPS!`);
        onSaved?.(code, cest);
      } else {
        // Fallback: endpoint /fiscal ainda não existe na VPS — usa PUT
        const fallback = await vpsApiService.updateProduct(productId, { ncm: code });
        if (fallback) {
          toast.success(`NCM ${code} atualizado!`);
          onSaved?.(code, cest);
        } else {
          toast.error('Falha ao salvar NCM na VPS.');
        }
      }
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCest = async () => {
    if (!cest.trim()) return;
    setSaving(true);
    try {
      const ok = await vpsApiService.updateProductFiscal(productId, { ncm: selected || undefined });
      const fallback = !ok
        ? await vpsApiService.updateProduct(productId, { cest: cest.trim() })
        : await vpsApiService.updateProduct(productId, { cest: cest.trim() });
      if (ok || fallback) {
        toast.success(`CEST ${cest.trim()} salvo!`);
        onSaved?.(selected, cest.trim());
      } else {
        toast.error('Falha ao salvar CEST.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setSelected('');
    setSelectedDesc('');
    setQuery(productName);
    setResults([]);
    onChange?.('');
  };

  // Formata o código NCM com pontos para exibição: 85176262 → 8517.62.62
  const formatNcm = (code: string) => {
    const c = code.replace(/\D/g, '');
    if (c.length !== 8) return code;
    return `${c.slice(0, 4)}.${c.slice(4, 6)}.${c.slice(6, 8)}`;
  };

  /** Consulta avulsa: busca info do NCM digitado sem salvar no produto */
  const handleLookup = async () => {
    const code = lookupNcm.replace(/\D/g, '');
    if (code.length < 4) { toast.error('Digite ao menos 4 dígitos do NCM.'); return; }
    setLookupLoading(true);
    setLookupDesc('');
    setLookupInfo(null);
    try {
      // 1. Tenta mapa interno (instantâneo)
      const info = getNcmInfo(code);
      setLookupInfo(info);
      // 2. Busca descrição oficial na BrasilAPI
      const formatted = code.length === 8
        ? `${code.slice(0,4)}.${code.slice(4,6)}.${code.slice(6,8)}`
        : code;
      const data = await fetchNcmResults(formatted);
      const match = data.find(r => r.codigo.replace(/\./g, '') === code)
        ?? data.find(r => r.codigo.replace(/\./g, '').startsWith(code.slice(0, 6)));
      if (match) setLookupDesc(match.descricao);
      // Refina info se ainda não tinha
      if (!info.posInfo) setLookupInfo(getNcmInfo(code));
    } catch { toast.error('Erro ao consultar BrasilAPI.'); }
    finally { setLookupLoading(false); }
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-3 relative">

      {/* ───────────────────────────────────────────────────────
          CONSULTA AVULSA — digita qualquer NCM e vê a abrangência
          Não salva, não afeta o produto
      ─────────────────────────────────────────────────────── */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        {/* Cabeçalho clicavel para expandir */}
        <button
          type="button"
          onClick={() => setShowLookup(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            Consulta Avulsa de NCM
          </span>
          <span className="text-[10px] text-slate-400">
            {showLookup ? '▲ fechar' : '▼ abrir'}
          </span>
        </button>

        {showLookup && (
          <div className="p-3 flex flex-col gap-2">
            <p className="text-[10px] text-slate-400">
              Digite qualquer código NCM (com ou sem pontos) para ver a abrangência, produtos e CEST. Não altera o produto.
            </p>

            {/* Input + botão */}
            <div className="flex gap-1">
              <input
                type="text"
                value={lookupNcm}
                onChange={e => setLookupNcm(e.target.value.replace(/[^0-9.]/g, '').slice(0, 11))}
                onKeyDown={e => e.key === 'Enter' && handleLookup()}
                placeholder="Ex: 8529.10.19 ou 85291019"
                className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm font-mono focus:ring-1 focus:ring-orange-500 bg-white"
              />
              <button
                type="button"
                onClick={handleLookup}
                disabled={lookupLoading || lookupNcm.replace(/\D/g,'').length < 4}
                className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold disabled:opacity-40 flex items-center gap-1 transition-colors"
              >
                {lookupLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Consultar
              </button>
              {(lookupInfo || lookupDesc) && (
                <button
                  type="button"
                  onClick={() => { setLookupNcm(''); setLookupDesc(''); setLookupInfo(null); }}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                  title="Limpar consulta"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Resultado da consulta avulsa */}
            {(lookupInfo || lookupDesc) && lookupNcm.replace(/\D/g,'').length >= 4 && (() => {
              const code = lookupNcm.replace(/\D/g,'');
              const { chapterName, posInfo } = lookupInfo ?? getNcmInfo(code);
              return (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-[11px] space-y-2">
                  {/* Cabeçalho */}
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 font-mono text-xs font-bold text-orange-700 bg-orange-100 border border-orange-200 px-2 py-0.5 rounded">
                      {formatNcm(code)}
                    </span>
                    <div>
                      {chapterName && (
                        <p className="text-[10px] text-orange-500 font-semibold uppercase tracking-wide">
                          Cap. {code.slice(0, 2)} — {chapterName}
                        </p>
                      )}
                      <p className="text-orange-900 font-semibold leading-snug mt-0.5">
                        {posInfo?.name ?? lookupDesc ?? 'NCM não mapeado internamente'}
                      </p>
                      {lookupDesc && posInfo && posInfo.name !== lookupDesc && (
                        <p className="text-orange-700 text-[10px] leading-snug mt-0.5 italic">
                          Descrição oficial: {lookupDesc}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Lista produtos */}
                  {posInfo && (
                    <>
                      <div className="border-t border-orange-200 pt-2">
                        <p className="text-[10px] font-semibold text-orange-800 uppercase tracking-wide mb-1">
                          Produtos que se enquadram neste NCM
                        </p>
                        <ul className="space-y-0.5">
                          {posInfo.examples.map((ex, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className={`shrink-0 text-[10px] font-bold mt-0.5 ${ex.ok ? 'text-emerald-600' : 'text-red-400'}`}>
                                {ex.ok ? '✅' : '❌'}
                              </span>
                              <span className={`leading-snug ${ex.ok ? 'text-orange-800' : 'text-slate-400 line-through'}`}>
                                {ex.item}
                                {ex.redirect && (
                                  <span className="no-underline ml-1 text-[9px] bg-slate-100 text-slate-500 px-1 rounded font-mono not-italic">
                                    → {ex.redirect}
                                  </span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className={`rounded-lg px-2 py-1.5 text-[10px] font-semibold ${
                        posInfo.cestNote.includes('NÃO')
                          ? 'bg-slate-100 text-slate-600'
                          : posInfo.cestNote.includes('Verificar')
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        📋 CEST: {posInfo.cestNote}
                      </div>
                    </>
                  )}

                  {!posInfo && !lookupDesc && (
                    <p className="text-orange-700 text-[10px]">
                      ℹ️ NCM não encontrado na BrasilAPI nem no mapa interno.
                      Verifique o código nos links abaixo.
                    </p>
                  )}
                  {!posInfo && lookupDesc && (
                    <p className="text-orange-700 text-[10px]">
                      ℹ️ Não há mapa de produtos para este NCM. Descrição oficial acima é de fonte BrasilAPI.
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── Separador visual */}
      <div className="border-t border-slate-100" />

      {/* ── Cabeçalho com label e botão info */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
          {label} — NCM
          {selected && (
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              {formatNcm(selected)}
            </span>
          )}
          {saving && <Loader2 className="w-3 h-3 animate-spin text-orange-500" />}
        </label>
        <button
          type="button"
          onClick={() => setShowInfo(v => !v)}
          className="text-slate-400 hover:text-blue-500 transition-colors"
          title="O que é NCM e CEST?"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
        <a
          href="https://brasilapi.com.br/api/ncm/v1?search=celular"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-[10px] text-slate-400 hover:text-orange-500 flex items-center gap-0.5"
          title="Ver BrasilAPI NCM"
        >
          BrasilAPI <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>

      {/* ── Painel informativo (colapso) */}
      {showInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-800 leading-relaxed space-y-1.5">
          <p>
            <strong>NCM</strong> (Nomenclatura Comum do Mercosul) — Código de <strong>8 dígitos</strong> que classifica
            a mercadoria para fins de tributação federal (IPI, Imposto de Importação).
            Obrigatório em nota fiscal (NF-e) e no Bling.
          </p>
          <p>
            <strong>Exemplos:</strong> Celular → <code className="bg-blue-100 px-1 rounded font-mono">8517.62.62</code>
            {' '}Câmera → <code className="bg-blue-100 px-1 rounded font-mono">8525.80.29</code>
            {' '}Fone → <code className="bg-blue-100 px-1 rounded font-mono">8518.30.00</code>
          </p>
          <p>
            <strong>CEST</strong> (Código Especificador da Substit. Tributária) — <strong>7 dígitos</strong>,
            exigido quando o produto é sujeito ao ICMS-ST. Não aplicar se o produto não está na lista.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 space-y-1">
            <p className="font-semibold text-amber-800">⚠️ Pernambuco — regras ICMS-ST (2024)</p>
            <p className="text-amber-700">
              Alíquota interna padrão: <strong>20,5%</strong> (desde jan/2024 — Decreto 56.411/2024).
              Consulte as MVAs e quais NCMs estão sujeitos ao ICMS-ST na tabela da SEFAZ-PE.
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-2 space-y-1">
            <p className="font-semibold text-green-800">🔍 Como pesquisar o CEST do seu produto</p>
            <ol className="text-green-800 space-y-1 list-decimal list-inside">
              <li>Copie o <strong>NCM</strong> selecionado acima</li>
              <li>Acesse uma das ferramentas abaixo (gratuitas)</li>
              <li>Cole o NCM no campo de busca</li>
              <li>Confirme pela descrição se bate com seu produto</li>
            </ol>
            <p className="text-green-700 text-[10px] italic mt-1">
              ⚠️ O CONFAZ não tem busca — é um documento legal. Use as ferramentas abaixo.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href="https://buscacest.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 bg-green-100 hover:bg-green-200 text-green-800 font-semibold px-2 py-1 rounded-lg transition-colors"
              title="Pesquise CEST pelo NCM — gratuito"
            >
              🔍 BuscaCEST <ExternalLink className="w-2.5 h-2.5" />
            </a>
            <a
              href="https://codigocest.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 bg-green-100 hover:bg-green-200 text-green-800 font-semibold px-2 py-1 rounded-lg transition-colors"
              title="Pesquise CEST pelo NCM — gratuito"
            >
              📋 CodigoCEST <ExternalLink className="w-2.5 h-2.5" />
            </a>
            <a
              href="https://cosmos.bluesoft.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 bg-blue-100 hover:bg-blue-200 text-blue-800 font-semibold px-2 py-1 rounded-lg transition-colors"
              title="Pesquise por nome, EAN ou NCM — gratuito"
            >
              🌐 Bluesoft Cosmos <ExternalLink className="w-2.5 h-2.5" />
            </a>
            <a
              href="https://www.sefaz.pe.gov.br"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold px-2 py-1 rounded-lg transition-colors"
            >
              🏦 SEFAZ-PE <ExternalLink className="w-2.5 h-2.5" />
            </a>
            <a
              href="https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold px-2 py-1 rounded-lg transition-colors"
              title="Convênio ICMS 142/2018 — documento legal"
            >
              📜 CONFAZ 142/18 <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>
      )}



      {/* ── Campo de busca */}
      <div className="flex gap-1">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Buscar NCM pelo nome do produto..."
            className="w-full pl-7 pr-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-orange-500 bg-white"
          />
          {loading && (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-orange-400" />
          )}
        </div>
        {selected && (
          <button
            type="button"
            onClick={handleClear}
            title="Limpar NCM selecionado"
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-400 hover:text-red-500 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Dropdown de resultados */}
      {open && results.length > 0 && (
        <div className="absolute top-[calc(100%-2.5rem)] left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto">
          <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
            {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
          </div>
          {results.map(r => {
            const code = r.codigo.replace(/\./g, '');
            return (
              <button
                key={r.codigo}
                type="button"
                onClick={() => handleSelect(r)}
                className="w-full text-left px-3 py-2.5 hover:bg-orange-50 transition-colors border-b border-slate-50 last:border-0 group"
              >
                <div className="flex items-start gap-2">
                  <span className="shrink-0 font-mono text-xs font-bold text-orange-600 bg-orange-50 group-hover:bg-orange-100 px-1.5 py-0.5 rounded border border-orange-100">
                    {formatNcm(code)}
                  </span>
                  <span className="text-xs text-slate-700 leading-snug">
                    {r.descricao}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Painel de abrangência estruturado do NCM selecionado */}
      {selected && (() => {
        const { chapterName, posInfo } = getNcmInfo(selected);
        // Mostra só se tiver mapa interno OU descrição da BrasilAPI
        if (!posInfo && !selectedDesc) return null;
        return (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-[11px] space-y-2">
            {/* Cabeçalho: código + capítulo */}
            <div className="flex items-start gap-2">
              <span className="shrink-0 font-mono text-xs font-bold text-orange-700 bg-orange-100 border border-orange-200 px-2 py-0.5 rounded">
                {formatNcm(selected)}
              </span>
              <div>
                {chapterName && (
                  <p className="text-[10px] text-orange-500 font-semibold uppercase tracking-wide">
                    Cap. {selected.replace(/\D/g, '').slice(0, 2)} — {chapterName}
                  </p>
                )}
                <p className="text-orange-900 font-semibold leading-snug mt-0.5">
                  {posInfo?.name ?? selectedDesc}
                </p>
                {posInfo && posInfo.name !== selectedDesc && (
                  <p className="text-orange-700 text-[10px] leading-snug mt-0.5 italic">
                    Descrição oficial: {selectedDesc}
                  </p>
                )}
              </div>
            </div>

            {/* Lista de produtos ✅/❌ */}
            {posInfo && (
              <>
                <div className="border-t border-orange-200 pt-2">
                  <p className="text-[10px] font-semibold text-orange-800 uppercase tracking-wide mb-1">
                    Produtos que se enquadram neste NCM
                  </p>
                  <ul className="space-y-0.5">
                    {posInfo.examples.map((ex, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className={`shrink-0 text-[10px] font-bold mt-0.5 ${ex.ok ? 'text-emerald-600' : 'text-red-400'}`}>
                          {ex.ok ? '✅' : '❌'}
                        </span>
                        <span className={`leading-snug ${ex.ok ? 'text-orange-800' : 'text-slate-400 line-through'}`}>
                          {ex.item}
                          {ex.redirect && (
                            <span className="no-underline ml-1 text-[9px] bg-slate-100 text-slate-500 px-1 rounded font-mono not-italic">
                              → {ex.redirect}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Nota CEST */}
                <div className={`rounded-lg px-2 py-1.5 text-[10px] font-semibold ${
                  posInfo.cestNote.includes('NÃO')
                    ? 'bg-slate-100 text-slate-600'
                    : posInfo.cestNote.includes('Verificar')
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  📋 CEST: {posInfo.cestNote}
                </div>
              </>
            )}

            {/* Fallback: NCM sem mapa interno */}
            {!posInfo && (
              <p className="text-orange-700 text-[10px]">
                ℹ️ Abrangência não mapeada internamente para este NCM.
                Consulte as ferramentas abaixo para verificar os produtos correspondentes.
              </p>
            )}
          </div>
        );
      })()}

      {/* ── Banner de sugestão CEST (aparece ao selecionar NCM) */}
      {cestSuggestion && (
        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-[11px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-emerald-800">
              CEST sugerido: <code className="font-mono bg-emerald-100 px-1 rounded">{cestSuggestion.cest}</code>
              <span className="ml-1.5 text-emerald-600 font-normal">Seg. {cestSuggestion.segmento}</span>
            </p>
            <p className="text-emerald-700 mt-0.5">{cestSuggestion.descricao}</p>
            <p className="text-emerald-600 mt-0.5">
              ⚠️ Confirme na tabela CONFAZ se este CEST se aplica ao seu produto em PE (ICMS-ST).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCestSuggestion(null)}
            className="text-emerald-400 hover:text-emerald-600"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ── Campo CEST */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-semibold text-slate-600">
            CEST — Substituição Tributária
          </label>
          {cest.length === 7 && (
            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
              {cest.slice(0, 2)}.{cest.slice(2, 5)}.{cest.slice(5, 7)}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <input
            type="text"
            value={cest}
            onChange={e => setCest(e.target.value.replace(/\D/g, '').slice(0, 7))}
            placeholder="7 dígitos, ex: 1700100"
            maxLength={7}
            className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm font-mono focus:ring-1 focus:ring-orange-500 bg-white"
          />
          {autoSave && (
            <button
              type="button"
              onClick={handleSaveCest}
              disabled={saving || cest.length !== 7}
              title="Salvar CEST na VPS"
              className="px-2.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold disabled:opacity-40 flex items-center gap-1 transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Salvar'}
            </button>
          )}
        </div>
        <p className="text-[10px] text-slate-400">7 dígitos — só se sujeito ao ICMS-ST em PE.</p>
        {/* Links sempre visíveis para consultar CEST */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <a
            href="https://buscacest.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 font-semibold px-2 py-0.5 rounded-full transition-colors"
            title="Pesquise CEST pelo NCM — gratuito"
          >
            🔍 BuscaCEST <ExternalLink className="w-2 h-2" />
          </a>
          <a
            href="https://codigocest.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 font-semibold px-2 py-0.5 rounded-full transition-colors"
            title="Pesquise CEST pelo NCM — gratuito"
          >
            📋 CódigoCEST <ExternalLink className="w-2 h-2" />
          </a>
          <a
            href="https://cosmos.bluesoft.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold px-2 py-0.5 rounded-full transition-colors"
            title="Busque por nome, EAN ou NCM — gratuito"
          >
            🌐 Bluesoft <ExternalLink className="w-2 h-2" />
          </a>
          <a
            href="https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200 font-semibold px-2 py-0.5 rounded-full transition-colors"
            title="Tabela CEST oficial (CONFAZ) — documento legal"
          >
            📜 CONFAZ <ExternalLink className="w-2 h-2" />
          </a>
        </div>
      </div>

    </div>
  );
}
