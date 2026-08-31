import React from 'react';
import { BatteryCharging, Camera, Cpu, Database, Hammer, Monitor, Radio, Ruler, Smartphone } from 'lucide-react';
import type { ProductBlueprintData, ProductBlueprintSection } from './productBlueprintArtwork';

interface Props {
  data: ProductBlueprintData;
  imageUrls: string[];
  watermarkUrl?: string | null;
}

const sectionIcons: Record<ProductBlueprintSection['key'], React.ComponentType<{ className?: string }>> = {
  display: Monitor,
  cameras: Camera,
  performance: Cpu,
  memory: Database,
  battery: BatteryCharging,
  connectivity: Radio,
  construction: Hammer,
  dimensions: Ruler,
  system: Smartphone,
};

export default function ProductBlueprintCard({ data, imageUrls, watermarkUrl }: Props) {
  const visibleImages = imageUrls.filter(Boolean).slice(0, 4);
  const leftSections = data.sections.filter((entry) => ['performance', 'memory', 'battery', 'connectivity', 'system'].includes(entry.key));
  const rightSections = data.sections.filter((entry) => ['display', 'cameras', 'construction', 'dimensions'].includes(entry.key));

  const renderSection = (section: ProductBlueprintSection) => {
    const Icon = sectionIcons[section.key];
    return (
      <section key={section.key} className="rounded-[18px] border bg-[#081119]/90 px-5 py-4" style={{ borderColor: `${data.theme.accent}70` }}>
        <h2 className="mb-3 flex items-center gap-2 text-[20px] font-black uppercase tracking-wide" style={{ color: data.theme.accent }}>
          <Icon className="h-6 w-6" /> {section.label}
        </h2>
        <div className="grid grid-cols-1 gap-1.5 text-[15px] leading-tight">
          {section.items.map((entry) => (
            <div key={`${entry.label}:${entry.value}`} className="grid grid-cols-[135px_1fr] gap-3 border-t border-white/10 pt-1.5 first:border-0 first:pt-0">
              <span className="font-bold text-white/58">{entry.label}</span>
              <span className="font-semibold text-white">{entry.value}</span>
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#050c12] text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      <div className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(circle at 48% 42%, ${data.theme.accent}3d 0, transparent 35%)` }} />
      {watermarkUrl && (
        <img
          data-blueprint-watermark="true"
          src={watermarkUrl}
          crossOrigin="anonymous"
          alt="Marca d'água Mercado do Vale"
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 max-h-[410px] max-w-[720px] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.12]"
        />
      )}

      <div className="relative z-20 flex h-full flex-col p-[30px]">
        <header className="flex h-[105px] items-center justify-between border-b pb-5" style={{ borderColor: `${data.theme.accent}70` }}>
          <div>
            <div className="text-[19px] font-black uppercase tracking-[0.24em]" style={{ color: data.theme.accent }}>/ blueprint oficial</div>
            <h1 className="mt-1 text-[58px] font-black uppercase italic leading-none tracking-tight">{data.name}</h1>
            {data.subtitle && <p className="mt-1 text-[23px] font-black uppercase tracking-[0.12em] text-white/75">{data.subtitle}</p>}
          </div>
          <div className="min-w-[180px] rounded-sm px-8 py-4 text-center text-[36px] font-black uppercase" style={{ background: data.theme.accent, color: data.theme.accentText }}>{data.brand}</div>
        </header>

        <div className="mt-5 grid min-h-0 flex-1 grid-cols-[30%_40%_30%] gap-4">
          <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
            {(data.overview || data.colors.length > 0) && (
              <section className="rounded-[18px] border bg-[#081119]/90 px-5 py-4" style={{ borderColor: `${data.theme.accent}70` }}>
                <h2 className="text-[20px] font-black uppercase" style={{ color: data.theme.accent }}>Visão geral</h2>
                {data.overview && <p className="mt-2 text-[16px] leading-[1.35] text-white/85">{data.overview}</p>}
                {data.colors.length > 0 && <p className="mt-3 text-[15px]"><strong style={{ color: data.theme.accent }}>Cores:</strong> {data.colors.join(' • ')}</p>}
              </section>
            )}
            {leftSections.map(renderSection)}
          </div>

          <div className="relative flex min-h-0 items-center justify-center overflow-hidden rounded-[22px] border bg-black/20" style={{ borderColor: `${data.theme.accent}50` }}>
            {visibleImages.length ? (
              <div className={`grid h-full w-full items-center justify-items-center gap-2 p-5 ${visibleImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {visibleImages.map((url, index) => (
                  <img
                    key={url}
                    data-marketing-product-image={index === 0 ? 'true' : undefined}
                    data-marketing-source-url={index === 0 ? url : undefined}
                    data-marketing-image-ready="true"
                    src={url}
                    crossOrigin="anonymous"
                    alt={`${data.name} ${index + 1}`}
                    className="max-h-full max-w-full object-contain drop-shadow-[0_28px_24px_rgba(0,0,0,.75)]"
                  />
                ))}
              </div>
            ) : <Smartphone className="h-56 w-56 text-white/15" />}
            <div className="absolute bottom-4 left-5 right-5 rounded-full border bg-black/75 px-5 py-2 text-center text-[15px] font-bold" style={{ borderColor: `${data.theme.accent}80`, color: data.theme.accent }}>
              Imagens e especificações conforme cadastro oficial do modelo
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
            {rightSections.map(renderSection)}
          </div>
        </div>

        <footer className="mt-4 flex h-[54px] items-center justify-between border-t px-1 pt-4 text-[14px] font-bold uppercase tracking-wider text-white/70" style={{ borderColor: `${data.theme.accent}70` }}>
          <span>Mercado do Vale • mercadodovale.com.br</span>
          <span style={{ color: data.theme.accent }}>Ficha técnica ilustrada</span>
        </footer>
      </div>
    </div>
  );
}
