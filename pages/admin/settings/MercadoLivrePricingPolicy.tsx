import React, { useEffect, useState } from 'react';
import { CurrencyInput } from '../../../components/ui/CurrencyInput';
import { mercadoLivreService } from '../../../services/mercadoLivreService';
import { editField } from '../../../services/mercadoLivrePreparation';
import type { Batch, Draft } from '../../../services/mercadoLivrePreparation';

const percentLabels = { marginBps: 'Margem líquida desejada (%)', taxBps: 'Impostos sobre a venda (%)', adsBps: 'Publicidade sobre a venda (%)', otherBps: 'Outras despesas sobre a venda (%)' };
const moneyLabels = { packagingCents: 'Embalagem por unidade', shippingCents: 'Frete pago pela loja por unidade', otherFixedCents: 'Outras despesas por unidade' };
const empty = () => ({marginBps:'',taxBps:'0',adsBps:'0',otherBps:'0',packagingCents:0,shippingCents:0,otherFixedCents:0,logisticType:'',billableWeightGrams:''});
const money = (cents:number) => (cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export function PricingSummary({quote}:{quote:any}) {
  if(!quote) return null;
  const labels:Record<string,string>={costCents:'Custo cadastrado',saleFeeCents:'Tarifa de venda (inclui tarifa fixa)',listingFeeCents:'Tarifa de anúncio',taxCents:'Impostos',adsCents:'Publicidade',otherPercentCents:'Outras despesas percentuais',packagingCents:'Embalagem',shippingCents:'Frete configurado da loja',otherFixedCents:'Outras despesas fixas',profitCents:'Lucro estimado por unidade'};
  return <div className="bg-blue-50 p-3 rounded"><p className="font-semibold">Preço calculado: {money(quote.priceCents)} • Margem estimada: {(quote.marginBps/100).toLocaleString('pt-BR')}% • Meta: {quote.targetMarginBps/100}%</p><dl>{Object.entries(labels).map(([key,label])=><div key={key} className="flex justify-between gap-3 text-sm"><dt>{label}</dt><dd>{money(quote[key])}</dd></div>)}</dl><p className="text-xs mt-2">Tarifas consultadas em {quote.quotedAt}. Frete e demais despesas são os valores configurados; revise-os conforme o produto e a logística.</p></div>;
}
export default function MercadoLivrePricingPolicy({batch,active,onApply,run}:{batch:Batch;active:string;onApply:(drafts:Draft[])=>void;run:(operation:()=>Promise<void>)=>Promise<void>}) {
  const storageKey=`mdv.ml.pricing-policy.${batch.sellerId}`;
  const [config,setConfig]=useState(empty);
  const product=batch.snapshot.products.find(p=>p.id===active);
  const catalogWeight=product?.weight_kg?Math.ceil(product.weight_kg*1000):undefined;
  useEffect(()=>{try {const saved=localStorage.getItem(storageKey);setConfig(saved?{...empty(),...JSON.parse(saved)}:empty());}catch{setConfig(empty());}},[storageKey]);
  const calculate=(all:boolean)=>void run(async()=>{
    const policy:any={...config};
    for(const key of Object.keys(percentLabels)) {
      const value=String((config as any)[key]).replace(',','.');
      if(!/^\d{1,2}(\.\d{1,2})?$/.test(value)) throw new Error('Preencha os percentuais de 0 a 99,99%, com até duas casas decimais.');
      const [whole,fraction='']=value.split('.');policy[key]=Number(whole)*100+Number(fraction.padEnd(2,'0'));
    }
    policy.billableWeightGrams=Number(config.billableWeightGrams);
    const selected=batch.drafts.filter(d=>all || d.productId===active);
    if(!selected.length || selected.length>5) throw new Error('Selecione de 1 a 5 produtos para calcular.');
    const priced:Draft[]=[];
    for(const draft of selected) {
      const sourceProduct=batch.snapshot.products.find(p=>p.id===draft.productId);
      const productPolicy={...policy,...(sourceProduct?.weight_kg?{billableWeightGrams:Math.ceil(sourceProduct.weight_kg*1000)}:{})};
      const quote=await mercadoLivreService.calculateListingPrice(batch.sellerId,draft,productPolicy);
      const source={kind:'operator' as const,reference:`política de preço configurada para ${draft.sku}`};
      let next=editField(draft,'commercialPolicy',{...draft.fields.commercialPolicy?.value,pricing:quote.policy,pricingQuote:quote},source);
      next=editField(next,'priceCents',quote.priceCents,{kind:'official_document',reference:quote.feeReference});
      priced.push(next);
    }
    localStorage.setItem(storageKey,JSON.stringify(config));
    onApply(batch.drafts.map(d=>priced.find(p=>p.productId===d.productId) || d));
  });
  const change=(key:string,value:any)=>setConfig(current=>({...current,[key]:value}));
  return <section className="border rounded p-4 space-y-3">
    <h3 className="font-semibold">Política de preço • margem líquida sobre a venda</h3>
    <p className="text-sm">Defina a margem e todas as despesas. Zero significa que você está declarando que esse custo não incide. Os valores serão usados por unidade em cada anúncio selecionado.</p>
    <div className="grid sm:grid-cols-2 gap-3">
      {Object.entries(percentLabels).map(([key,label])=><label key={key}>{label}<input aria-label={label} inputMode="decimal" className="border rounded p-2 block w-full" value={(config as any)[key]} onChange={e=>change(key,e.target.value)} /></label>)}
      {Object.entries(moneyLabels).map(([key,label])=><label key={key}>{label}<CurrencyInput value={(config as any)[key]} onChange={value=>change(key,value)} /></label>)}
      <label>Modalidade logística<select aria-label="Modalidade logística" className="border p-2 block" value={config.logisticType} onChange={e=>change('logisticType',e.target.value)}><option value="">Selecione a modalidade da conta</option><option value="drop_off">Postagem em agência</option><option value="xd_drop_off">Postagem em ponto de coleta</option><option value="cross_docking">Coleta pelo Mercado Livre</option><option value="fulfillment">Full</option><option value="self_service">Flex</option><option value="custom">Envio combinado</option></select></label>
      <label>Peso faturável (gramas)<input aria-label="Peso faturável (gramas)" type="number" min="1" step="1" className="border p-2 block" value={catalogWeight ?? config.billableWeightGrams} disabled={Boolean(catalogWeight)} onChange={e=>change('billableWeightGrams',e.target.value)} /></label>
    </div>
    <p className="text-sm">Peso e medidas são aproveitados automaticamente do cadastro de cada produto. Medidas fracionadas são arredondadas para cima no envio ao Mercado Livre. Quando o peso não estiver cadastrado, preencha-o para calcular. As tarifas de venda são consultadas por categoria, preço, anúncio e logística. O frete da loja é configurado manualmente nesta versão.</p>
    <button disabled={!active} onClick={()=>calculate(false)} className="border rounded p-2">Calcular preço deste anúncio</button>
    <button disabled={!batch.drafts.length || batch.drafts.length>5} onClick={()=>calculate(true)} className="border rounded p-2 ml-2">Aplicar política aos selecionados</button>
    <p className="text-sm">Configuração salva neste navegador ao calcular. Confira o preço e confirme novamente as condições comerciais. O sistema consulta as tarifas e confere o custo atual antes de publicar.</p>
  </section>;
}
