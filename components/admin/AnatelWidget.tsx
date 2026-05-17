import React, { useState, useEffect } from 'react';
import { ExternalLink, Loader2, CheckCircle2, AlertCircle, Save, Info, Radio, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { vpsApiService } from '../../services/vpsApiService';

interface AnatelWidgetProps {
  productId: string;
  productName?: string;
  brand?: string;
  currentCertificate?: string;
  onSaved?: (certificate: string) => void;
  onChange?: (certificate: string) => void;
  autoSave?: boolean;
  currentSpecs?: Record<string, any>;
}

const ANATEL_SCH_URL = 'https://sistemas.anatel.gov.br/sch/Consulta/Homologacao/tela.asp';
const ANATEL_SGCH_URL = 'https://sistemas.anatel.gov.br/sgch/';

async function copyAndOpen(text: string, url: string, message: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message);
  } catch {
    toast.info('Copie manualmente o termo de busca: ' + text);
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function AnatelWidget({
  productId,
  productName = '',
  brand = '',
  currentCertificate = '',
  onSaved,
  onChange,
  autoSave = true,
  currentSpecs = {},
}: AnatelWidgetProps) {
  const [value, setValue] = useState(currentCertificate);
  const [saving, setSaving] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => { setValue(currentCertificate); }, [currentCertificate]);

  const handleChange = (v: string) => {
    setValue(v);
    onChange?.(v);
  };

  const handleSave = async () => {
    if (!autoSave) return;
    const trimmed = value.trim();
    setSaving(true);
    try {
      const ok = await vpsApiService.updateProductFiscal(productId, {
        anatel_certificate: trimmed,
        specs: { ...currentSpecs, anatel_certificate: trimmed },
      });
      if (ok) {
        toast.success('Homologacao ANATEL salva na VPS!');
        onSaved?.(trimmed);
      } else {
        const specs = { ...currentSpecs, anatel_certificate: trimmed };
        const fallback = await vpsApiService.updateProduct(productId, { specs });
        if (fallback) {
          toast.success('Homologacao ANATEL salva!');
          onSaved?.(trimmed);
        } else {
          toast.error('Falha ao salvar homologacao ANATEL na VPS.');
        }
      }
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const isFilled = value.trim().length > 0;
  const searchTerm = [brand, productName].map((v) => String(v || '').trim()).filter(Boolean).join(' ').slice(0, 120);

  const handleOpenSch = () => {
    const term = searchTerm || productName || '';
    if (term) {
      void copyAndOpen(term, ANATEL_SCH_URL, `Termo "${term}" copiado. Cole no campo "Nome Comercial" do portal SCH.`);
    } else {
      window.open(ANATEL_SCH_URL, '_blank', 'noopener,noreferrer');
    }
  };

  const handleOpenSgch = () => {
    const term = searchTerm || productName || '';
    if (term) {
      void copyAndOpen(term, ANATEL_SGCH_URL, `Termo "${term}" copiado. Cole no campo de busca do SGCH.`);
    } else {
      window.open(ANATEL_SGCH_URL, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-slate-400" />
          Homologacao ANATEL
          {isFilled ? (
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              preenchido
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
              <AlertCircle className="w-3 h-3" />
              vazio
            </span>
          )}
        </label>
        <button
          type="button"
          onClick={() => setShowInfo(v => !v)}
          className="text-slate-400 hover:text-blue-500 transition-colors"
          title="O que e a homologacao ANATEL?"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>

      {showInfo && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-[11px] text-sky-900 leading-relaxed space-y-1.5">
          <p>
            <strong>Homologacao ANATEL</strong> - Numero emitido pela Agencia Nacional de Telecomunicacoes
            apos o produto ser certificado para operar nas faixas de radiofrequencia brasileiras.
            Obrigatorio para vender produtos com Wi-Fi, Bluetooth, celular, controles remotos sem fio,
            roteadores, carregadores wireless, etc.
          </p>
          <p>
            <strong>Formato tipico:</strong> <code className="bg-sky-100 px-1 rounded font-mono">12345-23-67890</code>
            {' '}(numero do certificado-ano-id)
          </p>
          <p>
            <strong>Shopee:</strong> Exige esse numero nos atributos de categoria para fones, smartwatches,
            roteadores, controles, carregadores wireless e qualquer produto com transmissor.
          </p>
          <p>
            <strong>Como encontrar:</strong> No selo do produto (etiqueta ANATEL), na caixa, manual,
            ou pesquise pelo nome/fabricante no portal abaixo.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleOpenSch}
              className="inline-flex items-center gap-1 bg-sky-100 hover:bg-sky-200 text-sky-800 font-semibold px-2 py-1 rounded-lg transition-colors"
            >
              <Copy className="w-2.5 h-2.5" /> Buscar no SCH <ExternalLink className="w-2.5 h-2.5" />
            </button>
            <button
              type="button"
              onClick={handleOpenSgch}
              className="inline-flex items-center gap-1 bg-sky-100 hover:bg-sky-200 text-sky-800 font-semibold px-2 py-1 rounded-lg transition-colors"
            >
              <Copy className="w-2.5 h-2.5" /> Buscar no SGCH <ExternalLink className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-1">
        <input
          type="text"
          value={value}
          onChange={e => handleChange(e.target.value)}
          placeholder="No de homologacao, ex: 12345-23-67890"
          className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-orange-500 bg-white"
        />
        {autoSave && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isFilled}
            title="Salvar homologacao na VPS"
            className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold disabled:opacity-40 flex items-center gap-1 transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleOpenSch}
          className="inline-flex items-center gap-1 text-[10px] text-orange-500 hover:text-orange-700 hover:underline font-semibold"
        >
          <Copy className="w-2.5 h-2.5" /> Buscar no SCH <ExternalLink className="w-2.5 h-2.5" />
        </button>
        <span className="text-slate-200">|</span>
        <button
          type="button"
          onClick={handleOpenSgch}
          className="inline-flex items-center gap-1 text-[10px] text-orange-500 hover:text-orange-700 hover:underline font-semibold"
        >
          <Copy className="w-2.5 h-2.5" /> Buscar no SGCH <ExternalLink className="w-2.5 h-2.5" />
        </button>
      </div>

      <p className="text-[10px] text-slate-400 leading-snug">
        Obrigatorio para produtos com transmissor (Wi-Fi, Bluetooth, celular, RF).
        O botao copia o nome do produto para a area de transferencia antes de abrir o portal.
      </p>
    </div>
  );
}
