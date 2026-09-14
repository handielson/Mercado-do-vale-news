import React, { useEffect, useState } from 'react';
import {
  BatteryCharging, Camera, CheckCircle2, Cpu, Database, Gauge, HardDrive,
  Cable, Circle, Gamepad2, Headphones, MessageCircle, Monitor, Network, PackageCheck, PlugZap, Server, ShieldCheck, Smartphone, Truck, UserRound,
} from 'lucide-react';
import type { MarketingAssetFormat } from '../../../../utils/marketing-sticker';
import type { ProductMarketingArtworkData, ProductMarketingSpec } from './productMarketingArtwork';
import { formatProductMarketingPrice } from './productCommercialCopy';

interface Props {
  data: ProductMarketingArtworkData;
  format: Exclude<MarketingAssetFormat, 'sticker'>;
  imageUrl: string | null;
  backgroundUrl?: string | null;
  logoUrl?: string | null;
  whatsapp: string;
  website: string;
  showPrice: boolean;
  carouselLabel?: string;
  template?: ProductMarketingTemplate;
}

export type ProductMarketingTemplate = 'technical' | 'showcase';

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

const isNearWhite = (pixels: Uint8ClampedArray, offset: number) => (
  pixels[offset] >= 238 && pixels[offset + 1] >= 238 && pixels[offset + 2] >= 238
);

/** Remove somente o fundo branco conectado às bordas da foto oficial. */
function useProductCutout(sourceUrl: string | null) {
  const [renderedUrl, setRenderedUrl] = useState(sourceUrl);
  const [ready, setReady] = useState(!sourceUrl);

  useEffect(() => {
    let cancelled = false;
    setRenderedUrl(sourceUrl);
    setReady(!sourceUrl);
    if (!sourceUrl) return () => { cancelled = true; };

    const source = new Image();
    source.crossOrigin = 'anonymous';
    source.onload = () => {
      try {
        const maxDimension = 1400;
        const scale = Math.min(1, maxDimension / Math.max(source.naturalWidth, source.naturalHeight));
        const width = Math.max(1, Math.round(source.naturalWidth * scale));
        const height = Math.max(1, Math.round(source.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Canvas indisponível');
        context.drawImage(source, 0, 0, width, height);

        const image = context.getImageData(0, 0, width, height);
        const visited = new Uint8Array(width * height);
        const queue = new Int32Array(width * height);
        let head = 0;
        let tail = 0;
        const enqueue = (index: number) => {
          if (visited[index]) return;
          visited[index] = 1;
          if (!isNearWhite(image.data, index * 4)) return;
          queue[tail++] = index;
        };

        for (let x = 0; x < width; x += 1) {
          enqueue(x);
          enqueue((height - 1) * width + x);
        }
        for (let y = 1; y < height - 1; y += 1) {
          enqueue(y * width);
          enqueue(y * width + width - 1);
        }
        while (head < tail) {
          const index = queue[head++];
          image.data[index * 4 + 3] = 0;
          const x = index % width;
          const y = Math.floor(index / width);
          if (x > 0) enqueue(index - 1);
          if (x + 1 < width) enqueue(index + 1);
          if (y > 0) enqueue(index - width);
          if (y + 1 < height) enqueue(index + width);
        }
        context.putImageData(image, 0, 0);

        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            if (image.data[(y * width + x) * 4 + 3] <= 16) continue;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }

        let output = canvas;
        if (maxX >= minX && maxY >= minY) {
          const padding = Math.max(8, Math.round(Math.max(maxX - minX, maxY - minY) * 0.025));
          const cropX = Math.max(0, minX - padding);
          const cropY = Math.max(0, minY - padding);
          const cropWidth = Math.min(width - cropX, maxX - minX + 1 + padding * 2);
          const cropHeight = Math.min(height - cropY, maxY - minY + 1 + padding * 2);
          const cropped = document.createElement('canvas');
          cropped.width = cropWidth;
          cropped.height = cropHeight;
          cropped.getContext('2d')?.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
          output = cropped;
        }

        if (!cancelled) setRenderedUrl(output.toDataURL('image/png'));
      } catch {
        if (!cancelled) setRenderedUrl(sourceUrl);
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    source.onerror = () => {
      if (!cancelled) {
        setRenderedUrl(sourceUrl);
        setReady(true);
      }
    };
    source.src = sourceUrl;
    return () => { cancelled = true; };
  }, [sourceUrl]);

  return { renderedUrl, ready };
}

function ProductMarketingShowcase({ data, format, imageUrl, backgroundUrl, logoUrl, whatsapp, website, showPrice }: Props) {
  const story = format === 'status';
  const hasPrice = showPrice && data.price > 0;
  const { renderedUrl, ready } = useProductCutout(imageUrl);
  const commercialIdentity = `${data.commercial.badge} ${data.commercial.technicalName}`.toLowerCase();
  const categoryIdentity = `${data.categoryName} ${data.name}`.toLowerCase();
  const scenarioKind = /rack|patch panel|rede|rj45|cat\d|keystone/.test(`${commercialIdentity} ${categoryIdentity}`) ? 'network-rack'
    : /carregador|bateria|power bank|cabo usb/.test(categoryIdentity) ? 'charging-station'
      : /fone|headset|áudio|audio|caixa de som/.test(categoryIdentity) ? 'entertainment'
        : /gamer|gaming/.test(categoryIdentity) ? 'gaming-setup'
          : /câmera|camera|segurança|monitoramento/.test(categoryIdentity) ? 'security-monitoring' : 'neutral-tech';
  const ContextIcon = scenarioKind === 'network-rack'
    ? Server
    : /rede|rj45|cat\d|keystone|cabo/.test(`${commercialIdentity} ${categoryIdentity}`)
    ? Network
    : /carregador|bateria|power bank/.test(commercialIdentity)
    ? BatteryCharging
    : PackageCheck;

  return (
    <div data-marketing-scenario={backgroundUrl ? 'photographic' : 'neutral'} className="absolute inset-0 overflow-hidden bg-[#050b11] text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {backgroundUrl ? <>
        <img data-marketing-scene-image="true" src={backgroundUrl} alt="Fotografia do cenário contextual" crossOrigin="anonymous" className="absolute inset-0 h-full w-full object-cover" style={{ filter: 'blur(1.2px) saturate(.8)', transform: 'scale(1.01)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(4,13,24,.80) 0%,rgba(4,13,24,.42) 28%,rgba(4,13,24,.14) 52%,rgba(4,13,24,.45) 75%,rgba(4,13,24,.92) 100%)' }} />
      </> : <>
      <div className="absolute inset-0" style={{ background: scenarioKind === 'network-rack' ? `radial-gradient(ellipse at 55% 58%, ${data.theme.accent}55 0, transparent 38%), radial-gradient(ellipse at 12% 28%, #0ea5e944 0, transparent 34%), linear-gradient(155deg, #17283a 0%, #07111b 52%, #020508 100%)` : `radial-gradient(ellipse at 55% 58%, ${data.theme.accent}55 0, transparent 38%), linear-gradient(155deg, #182635 0%, #07111b 52%, #020508 100%)` }} />
      </>}

      <div className={`relative z-10 flex h-full flex-col ${story ? 'px-9 py-8' : 'px-8 py-7'}`}>
        <header className="flex shrink-0 items-center justify-between">
          <img src={logoUrl || '/brand/mercado-do-vale-logo.png'} crossOrigin="anonymous" alt="Logomarca Mercado do Vale" className={`${story ? 'h-[76px] max-w-[250px]' : 'h-[52px] max-w-[180px]'} object-contain object-left`} />
          <span className={`${story ? 'px-6 py-3 text-2xl' : 'px-4 py-2 text-lg'} rounded-full font-black uppercase tracking-wide`} style={{ backgroundColor: data.theme.accent, color: data.theme.accentText }}>{data.brand}</span>
        </header>

        <div className={`${story ? 'mt-5' : 'mt-4'} shrink-0 text-left`}>
          <span className={`${story ? 'mb-5 px-6 py-2.5 text-xl' : 'mb-3 px-4 py-1.5 text-sm'} inline-block rounded-full border font-black uppercase tracking-[0.15em]`} style={{ borderColor: data.theme.accent, color: data.theme.accent }}>{data.commercial.badge}</span>
          <h1 className={`${story ? 'text-[82px]' : 'text-[56px]'} max-w-[94%] font-black uppercase leading-[0.84] tracking-[-0.04em]`}><span className="block text-white">{data.commercial.title.split(/\s+/).slice(0, Math.max(1, Math.ceil(data.commercial.title.split(/\s+/).length / 2))).join(' ')}</span><span className="block" style={{ color: data.theme.accent }}>{data.commercial.title.split(/\s+/).slice(Math.max(1, Math.ceil(data.commercial.title.split(/\s+/).length / 2))).join(' ')}</span></h1>
          <p className={`${story ? 'mt-5 text-[30px]' : 'mt-3 text-xl'} font-bold leading-tight text-white/82`}>{data.commercial.subtitle}</p>
        </div>

        <section className={`relative flex min-h-0 flex-1 items-center justify-center ${story ? 'my-1' : 'my-0'}`}>
          <div className="absolute bottom-[12%] h-[24%] w-[70%] rounded-full blur-3xl" style={{ backgroundColor: `${data.theme.accent}28` }} />
          {!backgroundUrl && <ContextIcon className={`${story ? 'h-[560px] w-[560px]' : 'h-[300px] w-[300px]'} absolute text-white/[0.045]`} strokeWidth={0.7} />}
          {renderedUrl ? (
          <img
              data-marketing-product-image="true"
              data-marketing-source-url={imageUrl || ''}
              data-marketing-image-ready={ready ? 'true' : 'false'}
              src={renderedUrl}
              crossOrigin="anonymous"
              alt={data.name}
              className={`${story ? 'max-h-[700px] max-w-[80%]' : 'max-h-[420px] max-w-[74%]'} relative z-10 object-contain drop-shadow-[0_42px_32px_rgba(0,0,0,0.95)]`}
            />
          ) : <Smartphone className="h-56 w-56 text-white/20" />}
        </section>

        {data.commercial.benefits.length > 0 && <div className={`${story ? 'mb-3 min-h-[92px]' : 'mb-2 min-h-[64px]'} grid shrink-0`} style={{ gridTemplateColumns: `repeat(${Math.min(3, data.commercial.benefits.length)}, minmax(0, 1fr))` }}>
          {data.commercial.benefits.slice(0, 3).map((benefit, index) => <div key={benefit} className="flex items-center justify-center gap-2 border-r border-white/20 px-3 text-center last:border-r-0"><span className="flex items-center justify-center rounded-full border-2 p-2" style={{ borderColor: data.theme.accent }}><CheckCircle2 className={`${story ? 'h-6 w-6' : 'h-4 w-4'}`} style={{ color: data.theme.accent }} /></span><span className={`${story ? 'text-lg' : 'text-sm'} font-black uppercase leading-tight`}>{benefit}</span></div>)}
        </div>}

        <div className="mb-2 flex shrink-0 items-center justify-between gap-3 rounded-lg border border-white/15 bg-black/35 px-4 py-2"><span className={`${story ? 'text-base' : 'text-xs'} min-w-0 truncate font-bold uppercase tracking-wide text-white/70`}>{data.commercial.technicalName}</span>{hasPrice && <strong className={`${story ? 'text-2xl' : 'text-lg'} shrink-0`} style={{ color: data.theme.accent }}>{formatProductMarketingPrice(data.price)}</strong>}</div>

        <footer className={`${story ? 'min-h-[72px] text-2xl' : 'min-h-[54px] text-lg'} flex shrink-0 items-center justify-center gap-3 rounded-xl px-5 font-black uppercase shadow-[0_8px_25px_rgba(249,115,22,.3)]`} style={{ backgroundColor: data.theme.accent, color: data.theme.accentText }}><MessageCircle className="h-7 w-7" />{data.commercial.cta || 'PEÇA AGORA NO WHATSAPP'}</footer>
        <div className={`${story ? 'mt-2 text-lg' : 'mt-1 text-sm'} shrink-0 text-center font-bold text-white/85`}>{whatsapp} <span className="mx-2 text-white/45">•</span> {website}</div>
      </div>
    </div>
  );
}

export default function ProductMarketingCard(props: Props) {
  return props.template === 'showcase' ? <ProductMarketingShowcase {...props} /> : <ProductMarketingTechnical {...props} />;
}

function ProductMarketingTechnical({ data, format, imageUrl, whatsapp, website, showPrice }: Props) {
  const story = format === 'status';
  const visibleSpecs = data.specs.slice(0, story ? 8 : 4);
  const subtitle = [data.version, data.technology].filter(Boolean).join('  |  ');
  const { renderedUrl, ready } = useProductCutout(imageUrl);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#071017] text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(circle at 13% 52%, ${data.theme.accent}70 0, transparent 30%), radial-gradient(circle at 86% 18%, ${data.theme.accent}24 0, transparent 28%)` }} />
      <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(120deg, transparent 0 48%, #fff 49% 49.5%, transparent 50% 100%)', backgroundSize: '90px 90px' }} />

      <div className={`relative z-10 flex h-full flex-col justify-between ${story ? 'px-8 py-7' : 'px-8 py-6'}`}>
        <header className={`flex shrink-0 items-center justify-between ${story ? 'h-[130px]' : 'h-[78px]'}`}>
          <div className={`${story ? 'h-[120px] w-[315px]' : 'h-[74px] w-[230px]'} flex items-center`}>
            <img src="/brand/mercado-do-vale-logo.png" crossOrigin="anonymous" alt="Mercado do Vale" className="max-h-full max-w-full object-contain object-left" />
          </div>
          <div className={`${story ? 'px-8 py-4 text-4xl' : 'px-6 py-3 text-2xl'} rounded-sm font-black uppercase`} style={{ backgroundColor: data.theme.accent, color: data.theme.accentText }}>{data.brand}</div>
        </header>

        <div className={`shrink-0 text-center ${story ? 'mt-1 min-h-[160px]' : 'min-h-[105px]'}`}>
          <h1 className={`${story ? 'text-[70px]' : 'text-[48px]'} font-black uppercase leading-[0.94] tracking-tight`}>{data.name}</h1>
          {subtitle && <div className={`${story ? 'mt-4 px-8 py-2 text-2xl' : 'mt-2 px-6 py-1.5 text-lg'} mx-auto inline-block rounded-xl font-black uppercase`} style={{ backgroundColor: data.theme.accent, color: data.theme.accentText }}>{subtitle}</div>}
        </div>

        <div className={`grid shrink-0 grid-cols-[44%_56%] ${story ? 'h-[900px] gap-5' : 'h-[470px] gap-4'}`}>
          <section className="relative flex min-h-0 items-center justify-center overflow-visible">
            <div className="absolute bottom-[7%] left-[4%] h-[62%] w-[92%] rounded-full blur-3xl" style={{ backgroundColor: `${data.theme.accent}2b` }} />
            {renderedUrl ? (
              <img
                data-marketing-product-image="true"
                data-marketing-source-url={imageUrl || ''}
                data-marketing-image-ready={ready ? 'true' : 'false'}
                src={renderedUrl}
                crossOrigin="anonymous"
                alt={data.name}
                className={`${story ? 'max-h-[875px]' : 'max-h-[455px]'} relative z-10 max-w-[112%] object-contain drop-shadow-[0_36px_28px_rgba(0,0,0,0.8)]`}
              />
            ) : <Smartphone className="mb-24 h-56 w-56 text-white/20" />}
            {data.sellingBadge && <div className={`${story ? 'bottom-7 px-5 py-4 text-2xl' : 'bottom-3 px-4 py-2 text-base'} absolute left-0 z-20 max-w-[92%] rounded-2xl border-2 bg-[#071017]/95 text-center font-black uppercase`} style={{ borderColor: data.theme.accent, color: data.theme.accent }}>{data.sellingBadge}</div>}
          </section>

          <section className={`grid h-full grid-cols-2 content-stretch ${story ? 'grid-rows-4 gap-3 py-5' : 'grid-rows-2 gap-2 py-2'}`}>
            {visibleSpecs.map((spec) => {
              const Icon = icons[spec.key];
              return <div key={spec.key} className={`${story ? 'gap-4 rounded-3xl px-4 py-4' : 'gap-3 rounded-2xl px-3 py-2'} flex min-h-0 items-center overflow-hidden border bg-black/35`} style={{ borderColor: `${data.theme.accent}66` }}>
                <Icon className={`${story ? 'h-14 w-14' : 'h-9 w-9'} shrink-0`} style={{ color: data.theme.accent }} />
                <div className="min-w-0 overflow-hidden">
                  <div className={`${story ? 'text-[15px]' : 'text-[11px]'} font-bold uppercase leading-tight text-white/70`}>{spec.label}</div>
                  <div className={`${story ? 'text-[27px]' : 'text-[18px]'} max-h-[3.8em] overflow-hidden font-black leading-[1.05]`}>{spec.value}</div>
                  {spec.detail && <div className={`${story ? 'text-base' : 'text-xs'} font-black uppercase`} style={{ color: data.theme.accent }}>{spec.detail}</div>}
                </div>
              </div>;
            })}
          </section>
        </div>

        <div className={`${story ? 'mt-4 min-h-[82px]' : 'mt-3 min-h-[54px]'} flex shrink-0 items-center justify-center gap-10 rounded-3xl border bg-black/40 px-8`} style={{ borderColor: `${data.theme.accent}70` }}>
          {data.features.length ? data.features.map(feature => <div key={feature} className={`${story ? 'text-2xl' : 'text-lg'} flex items-center gap-3 font-black`}><CheckCircle2 className={`${story ? 'h-9 w-9' : 'h-6 w-6'}`} style={{ color: data.theme.accent }} />{feature}</div>) : <div className="text-xl font-black uppercase" style={{ color: data.theme.accent }}>Consulte os recursos disponíveis</div>}
        </div>

        {showPrice ? (
          <div className={`${story ? 'mt-4 min-h-[176px]' : 'mt-3 min-h-[116px]'} grid shrink-0 grid-cols-2 overflow-hidden rounded-[2rem] border-2`} style={{ borderColor: data.theme.accent }}>
            <div className="flex flex-col items-center justify-center" style={{ background: `linear-gradient(135deg, ${data.theme.accent}, ${data.theme.accentSoft})`, color: data.theme.accentText }}>
              <span className={`${story ? 'text-2xl' : 'text-lg'} font-black uppercase`}>À vista no PIX</span>
              <strong className={`${story ? 'text-[58px]' : 'text-[40px]'} leading-none`}>{formatProductMarketingPrice(data.price)}</strong>
            </div>
            <div className="flex flex-col items-center justify-center bg-black/60">
              <span className={`${story ? 'text-2xl' : 'text-lg'} font-bold uppercase`}>Ou em até {data.installmentCount}x</span>
              <strong className={`${story ? 'text-[50px]' : 'text-[36px]'} leading-none`}>{formatProductMarketingPrice(data.installmentValue)}</strong>
              <span className={`${story ? 'mt-2 text-base' : 'mt-1 text-xs'} text-white/55`}>Total a prazo: {formatProductMarketingPrice(data.installmentTotal)}</span>
            </div>
          </div>
        ) : (
          <div className={`${story ? 'mt-4 min-h-[176px]' : 'mt-3 min-h-[116px]'} flex shrink-0 flex-col items-center justify-center rounded-[2rem] border-2 bg-black/50`} style={{ borderColor: data.theme.accent }}>
            <strong className={`${story ? 'text-4xl' : 'text-3xl'} uppercase`} style={{ color: data.theme.accent }}>Consulte condições e disponibilidade</strong>
            <span className="mt-2 text-2xl font-bold">Fale com nossa equipe</span>
          </div>
        )}

        {story && <div className="mt-4 grid min-h-[78px] shrink-0 grid-cols-3 items-center divide-x divide-white/20 px-5">
          <div className="flex items-center justify-center gap-3"><PackageCheck className="h-10 w-10" style={{ color: data.theme.accent }} /><span className="text-base font-black uppercase leading-tight">Produto original<br /><em className="not-italic" style={{ color: data.theme.accent }}>com garantia</em></span></div>
          <div className="flex items-center justify-center gap-3"><Truck className="h-10 w-10" style={{ color: data.theme.accent }} /><span className="text-base font-black uppercase leading-tight">Entrega rápida<br /><em className="not-italic" style={{ color: data.theme.accent }}>todo o Brasil</em></span></div>
          <div className="flex items-center justify-center gap-3"><ShieldCheck className="h-10 w-10" style={{ color: data.theme.accent }} /><span className="text-base font-black uppercase leading-tight">Compra segura<br /><em className="not-italic" style={{ color: data.theme.accent }}>site protegido</em></span></div>
        </div>}

        <div className={`${story ? 'mt-3 min-h-[62px]' : 'mt-3 min-h-[52px]'} flex shrink-0 items-center justify-between rounded-2xl px-7 text-xl font-black`} style={{ backgroundColor: data.theme.accent, color: data.theme.accentText }}>
          <span>CONSULTE CORES DISPONÍVEIS</span>
          <span className="flex items-center gap-2"><MessageCircle className="h-7 w-7" />{whatsapp}</span>
          <span>{website}</span>
        </div>
      </div>
    </div>
  );
}
