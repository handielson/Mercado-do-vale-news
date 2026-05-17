import React, { useState, useEffect } from 'react';
import { ExternalLink, Loader2, CheckCircle2, AlertCircle, Save, Info, ShieldCheck, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { vpsApiService } from '../../services/vpsApiService';

interface InmetroWidgetProps {
  /** ID do produto na VPS */
  productId: string;
  /** Nome do produto — usado para sugestão no link ProdCert */
  productName?: string;
  /** Marca/fabricante — usado para refinar a busca */
  brand?: string;
  /** Valor atual do certificado (specs.inmetro_certificate) */
  currentCertificate?: string;
  /** Callback após salvar com sucesso */
  onSaved?: (certificate: string) => void;
  /** Callback quando o valor muda localmente */
  onChange?: (certificate: string) => void;
  /** Se false, não auto-salva na VPS */
  autoSave?: boolean;
  /** Specs atuais do produto (para merge correto) */
  currentSpecs?: Record<string, any>;
}

const PRODCERT_URL = 'http://www.inmetro.gov.br/prodcert/';
const REGISTRO_OBJETOS_URL = 'http://www.inmetro.gov.br/registrosobjetos/';

async function copyAndOpen(text: string, url: string, message: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message);
  } catch {
    toast.info('Copie manualmente o termo de busca: ' + text);
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * InmetroWidget — Certificado Inmetro com links para ProdCert e Registro de Objetos.
 * VPS-first: salva em specs.inmetro_certificate (JSON flexível, sem migration).
 * Shopee exige este campo em categorias regulamentadas.
 *
 * LINKS CORRETOS (verificados em 01/04/2026):
 * ProdCert:           http://www.inmetro.gov.br/prodcert/
 * Registro de Objeto: http://www.inmetro.gov.br/registrosobjetos/
 */
export function InmetroWidget({
  productId,
  productName = '',
  brand = '',
  currentCertificate = '',
  onSaved,
  onChange,
  autoSave = true,
  currentSpecs = {},
}: InmetroWidgetProps) {
  const [value, setValue] = useState(currentCertificate);
  const [saving, setSaving] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => { setValue(currentCertificate); }, [currentCertificate]);

  const handleChange = (v: string) => {
    setValue(v);
    onChange?.(v);
  };

  const searchTerm = [brand, productName].map((v) => String(v || '').trim()).filter(Boolean).join(' ').slice(0, 120);

  const handleOpenProdcert = () => {
    const term = searchTerm || productName || '';
    if (term) {
      void copyAndOpen(term, PRODCERT_URL, `Termo "${term}" copiado. Cole no campo de busca do ProdCert.`);
    } else {
      window.open(PRODCERT_URL, '_blank', 'noopener,noreferrer');
    }
  };

  const handleOpenRegistroObjetos = () => {
    const term = searchTerm || productName || '';
    if (term) {
      void copyAndOpen(term, REGISTRO_OBJETOS_URL, `Termo "${term}" copiado. Cole no campo de busca do Registro de Objetos.`);
    } else {
      window.open(REGISTRO_OBJETOS_URL, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSave = async () => {
    if (!autoSave) return;
    const trimmed = value.trim();
    setSaving(true);
    try {
      // Endpoint /fiscal com fallback para PUT
      const ok = await vpsApiService.updateProductFiscal(productId, {
        inmetro_certificate: trimmed,
        specs: currentSpecs,
      });
      if (ok) {
        toast.success('Certificado Inmetro salvo na VPS!');
        onSaved?.(trimmed);
      } else {
        // Fallback: merge specs e usa updateProduct
        const specs = { ...currentSpecs, inmetro_certificate: trimmed };
        const fallback = await vpsApiService.updateProduct(productId, { specs });
        if (fallback) {
          toast.success('Certificado Inmetro salvo!');
          onSaved?.(trimmed);
        } else {
          toast.error('Falha ao salvar certificado na VPS.');
        }
      }
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const isFilled = value.trim().length > 0;

  return (
    <div className="flex flex-col gap-2">

      {/* ── Cabeçalho */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          Certificado Inmetro
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
          title="O que é o certificado Inmetro?"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Painel informativo */}
      {showInfo && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed space-y-1.5">
          <p>
            <strong>Certificado Inmetro</strong> — Número emitido pelo Inmetro ou por organismo acreditado
            (OCP) após ensaios de conformidade. Obrigatório para venda no Brasil de produtos regulamentados
            (eletrônicos, carregadores, baterias, brinquedos, etc.).
          </p>
          <p>
            <strong>Formato típico:</strong> <code className="bg-amber-100 px-1 rounded font-mono">011/2025</code>
            {' '}ou <code className="bg-amber-100 px-1 rounded font-mono">007-2024-0012345</code>
          </p>
          <p>
            <strong>Shopee:</strong> Exige o número do certificado nos atributos de categoria para
            eletrônicos, equipamentos, produtos de saúde e brinquedos. Sem isso, a listagem pode
            ser removida ou bloqueada.
          </p>
          <p>
            <strong>Como encontrar:</strong> Consulte o rótulo do produto, a documentação do fabricante
            ou procure pelo produto no portal ProdCert do Inmetro.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleOpenProdcert}
              className="inline-flex items-center gap-1 bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold px-2 py-1 rounded-lg transition-colors"
            >
              <Copy className="w-2.5 h-2.5" /> ProdCert <ExternalLink className="w-2.5 h-2.5" />
            </button>
            <button
              type="button"
              onClick={handleOpenRegistroObjetos}
              className="inline-flex items-center gap-1 bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold px-2 py-1 rounded-lg transition-colors"
            >
              <Copy className="w-2.5 h-2.5" /> Registro de Objetos <ExternalLink className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Input + botão salvar */}
      <div className="flex gap-1">
        <input
          type="text"
          value={value}
          onChange={e => handleChange(e.target.value)}
          placeholder="Nº do certificado, ex: 011/2025"
          className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-orange-500 bg-white"
        />
        {autoSave && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isFilled}
            title="Salvar certificado na VPS"
            className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold disabled:opacity-40 flex items-center gap-1 transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* ── Links rápidos */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleOpenProdcert}
          className="inline-flex items-center gap-1 text-[10px] text-orange-500 hover:text-orange-700 hover:underline font-semibold"
        >
          <Copy className="w-2.5 h-2.5" /> Consultar ProdCert <ExternalLink className="w-2.5 h-2.5" />
        </button>
        <span className="text-slate-200">|</span>
        <button
          type="button"
          onClick={handleOpenRegistroObjetos}
          className="inline-flex items-center gap-1 text-[10px] text-orange-500 hover:text-orange-700 hover:underline font-semibold"
        >
          <Copy className="w-2.5 h-2.5" /> Registro de Objetos <ExternalLink className="w-2.5 h-2.5" />
        </button>
      </div>

      <p className="text-[10px] text-slate-400 leading-snug">
        Exigido pela Shopee em eletrônicos, saúde e brinquedos.
        O botão copia o nome do produto para a área de transferência antes de abrir o portal.
      </p>

    </div>
  );
}
