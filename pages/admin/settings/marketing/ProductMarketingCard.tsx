import React, { useEffect, useState } from 'react';
import {
  BatteryCharging, Camera, CheckCircle2, Cpu, Database, Gauge, HardDrive,
  MessageCircle, PackageCheck, ShieldCheck, Smartphone, Truck, UserRound,
} from 'lucide-react';
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

const money = (cents: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL',
}).format(cents / 100);

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

export default function ProductMarketingCard({ data, format, imageUrl, whatsapp, website, showPrice }: Props) {
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
              <strong className={`${story ? 'text-[58px]' : 'text-[40px]'} leading-none`}>{money(data.price)}</strong>
            </div>
            <div className="flex flex-col items-center justify-center bg-black/60">
              <span className={`${story ? 'text-2xl' : 'text-lg'} font-bold uppercase`}>Ou em até {data.installmentCount}x</span>
              <strong className={`${story ? 'text-[50px]' : 'text-[36px]'} leading-none`}>{money(data.installmentValue)}</strong>
              <span className={`${story ? 'mt-2 text-base' : 'mt-1 text-xs'} text-white/55`}>Total a prazo: {money(data.installmentTotal)}</span>
            </div>
          </div>
        ) : (
          <div className={`${story ? 'mt-4 min-h-[150px]' : 'mt-3 min-h-[100px]'} flex shrink-0 flex-col items-center justify-center rounded-[2rem] border-2 bg-black/50`} style={{ borderColor: data.theme.accent }}>
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
