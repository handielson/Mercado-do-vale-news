import React from 'react';
import { BatteryCharging, Camera, CheckCircle2, Cpu, Database, Gauge, HardDrive, MessageCircle, Smartphone, UserRound } from 'lucide-react';
import type { MarketingAssetFormat } from '../../../../utils/marketing-sticker';
import type { ProductMarketingArtworkData, ProductMarketingSpec } from './productMarketingArtwork';

interface Props {
  data: ProductMarketingArtworkData;
  format: Exclude<MarketingAssetFormat, 'sticker'>;
  imageUrl: string | null;
  logoUrl?: string | null;
  whatsapp: string;
  website: string;
  showPrice: boolean;
  carouselLabel?: string;
}

const icons: Record<ProductMarketingSpec['key'], React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  rearCamera: Camera,
  frontCamera: UserRound,
  battery: BatteryCharging,
  processor: Cpu,
  display: Smartphone,
  refreshRate: Gauge,
  storage: HardDrive,
  ram: Database,
};

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

export default function ProductMarketingCard({ data, format, imageUrl, logoUrl, whatsapp, website, showPrice, carouselLabel }: Props) {
  const story = format === 'status';
  const visibleSpecs = data.specs.slice(0, story ? 8 : 4);
  const subtitle = [data.version, data.technology].filter(Boolean).join('  |  ');
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#071017] text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(circle at 20% 48%, ${data.theme.accent}88 0, transparent 35%), radial-gradient(circle at 85% 20%, ${data.theme.accent}30 0, transparent 30%)` }} />
      <div className={`relative z-10 flex h-full flex-col ${story ? 'px-8 py-8' : 'px-9 py-7'}`}>
        <header className={`flex items-center justify-between ${story ? 'h-[155px]' : 'h-[105px]'}`}>
          <div className={`${story ? 'h-[130px] w-[310px]' : 'h-[90px] w-[240px]'} flex items-center`}>
            {logoUrl ? <img src={logoUrl} crossOrigin="anonymous" alt="Mercado do Vale" className="max-h-full max-w-full object-contain object-left" /> : <strong className="text-4xl">Mercado do Vale</strong>}
          </div>
          <div className="rounded-sm px-8 py-4 text-4xl font-black uppercase" style={{ backgroundColor: data.theme.accent, color: data.theme.accentText }}>{data.brand}</div>
        </header>

        <div className={`text-center ${story ? 'mt-2' : '-mt-1'}`}>
          <h1 className={`${story ? 'text-[78px]' : 'text-[58px]'} font-black uppercase leading-[0.92] tracking-tight`}>{data.name}</h1>
          {subtitle && <div className={`mx-auto mt-4 inline-block rounded-xl px-8 py-2 text-2xl font-black uppercase`} style={{ backgroundColor: data.theme.accent, color: data.theme.accentText }}>{subtitle}</div>}
          {carouselLabel && <div className="absolute right-8 top-40 rounded-full bg-black/70 px-5 py-2 text-lg font-bold">{carouselLabel}</div>}
        </div>

        <div className={`grid flex-1 ${story ? 'mt-7 grid-cols-[44%_56%] gap-5' : 'mt-5 grid-cols-[46%_54%] gap-5'} min-h-0`}>
          <section className="relative flex min-h-0 flex-col items-center justify-center">
            {imageUrl ? (
              <img key={imageUrl} data-marketing-product-image="true" src={imageUrl} crossOrigin="anonymous" alt={data.name} className="max-h-[88%] max-w-full object-contain drop-shadow-[0_35px_28px_rgba(0,0,0,0.75)]" />
            ) : <Smartphone className="h-56 w-56 text-white/20" />}
            {data.sellingBadge && <div className="absolute bottom-5 left-0 max-w-[90%] rounded-2xl border-2 bg-[#071017]/95 px-5 py-4 text-center text-2xl font-black uppercase" style={{ borderColor: data.theme.accent, color: data.theme.accent }}>{data.sellingBadge}</div>}
          </section>
          <section className={`grid content-center grid-cols-2 ${story ? 'gap-3' : 'gap-2'}`}>
            {visibleSpecs.map((spec) => {
              const Icon = icons[spec.key];
              return <div key={spec.key} className={`${story ? 'min-h-[152px] px-4 py-4' : 'min-h-[104px] px-3 py-3'} flex items-center gap-4 rounded-3xl border bg-black/25`} style={{ borderColor: `${data.theme.accent}55` }}>
                <Icon className={`${story ? 'h-14 w-14' : 'h-10 w-10'} shrink-0`} style={{ color: data.theme.accent }} />
                <div className="min-w-0">
                  <div className={`${story ? 'text-base' : 'text-sm'} font-bold uppercase text-white/70`}>{spec.label}</div>
                  <div className={`${story ? 'text-[29px]' : 'text-[22px]'} font-black leading-tight break-words`}>{spec.value}</div>
                  {spec.detail && <div className="text-base font-black uppercase" style={{ color: data.theme.accent }}>{spec.detail}</div>}
                </div>
              </div>;
            })}
          </section>
        </div>

        <div className={`${story ? 'mt-5 min-h-[88px]' : 'mt-3 min-h-[62px]'} flex items-center justify-center gap-10 rounded-3xl border bg-black/30 px-8`} style={{ borderColor: `${data.theme.accent}66` }}>
          {data.features.length ? data.features.map(feature => <div key={feature} className="flex items-center gap-3 text-2xl font-black"><CheckCircle2 className="h-9 w-9" style={{ color: data.theme.accent }} />{feature}</div>) : <div className="text-2xl font-black uppercase" style={{ color: data.theme.accent }}>Consulte os recursos disponíveis</div>}
        </div>

        {showPrice ? (
          <div className={`${story ? 'mt-5 min-h-[190px]' : 'mt-3 min-h-[128px]'} grid grid-cols-2 overflow-hidden rounded-[2rem] border-2`} style={{ borderColor: data.theme.accent }}>
            <div className="flex flex-col items-center justify-center" style={{ background: `linear-gradient(135deg, ${data.theme.accent}, ${data.theme.accentSoft})`, color: data.theme.accentText }}>
              <span className="text-2xl font-black uppercase">À vista</span><strong className={`${story ? 'text-[61px]' : 'text-[43px]'} leading-none`}>{money(data.price)}</strong>
            </div>
            <div className="flex flex-col items-center justify-center bg-black/55">
              <span className="text-2xl font-bold uppercase">Ou em até {data.installmentCount}x</span>
              <strong className={`${story ? 'text-[52px]' : 'text-[39px]'} leading-none`}>{money(data.installmentValue)}</strong>
              <span className="mt-2 text-lg text-white/60">Total a prazo: {money(data.installmentTotal)}</span>
            </div>
          </div>
        ) : (
          <div className={`${story ? 'mt-5 min-h-[150px]' : 'mt-3 min-h-[105px]'} flex flex-col items-center justify-center rounded-[2rem] border-2 bg-black/45`} style={{ borderColor: data.theme.accent }}>
            <strong className={`${story ? 'text-4xl' : 'text-3xl'} uppercase`} style={{ color: data.theme.accent }}>Consulte condições e disponibilidade</strong>
            <span className="mt-2 text-2xl font-bold">Fale com nossa equipe</span>
          </div>
        )}

        <div className={`${story ? 'mt-5' : 'mt-3'} flex items-center justify-between rounded-2xl px-7 py-4 text-xl font-black`} style={{ backgroundColor: data.theme.accent, color: data.theme.accentText }}>
          <span>CONSULTE CORES DISPONÍVEIS</span>
          <span className="flex items-center gap-2"><MessageCircle className="h-7 w-7" />{whatsapp}</span>
          <span>{website}</span>
        </div>
      </div>
    </div>
  );
}
