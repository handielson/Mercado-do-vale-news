import { useState, useEffect, useCallback } from 'react';
import type { Banner } from '@/types/catalog';
import { bannerService, type CustomerType } from '@/services/bannerService';
import { buildResponsiveImageSources } from '@/utils/responsive-image-sources.js';
import { ImageZoomModal } from './ImageZoomModal';

interface BannerCarouselProps {
    banners?: Banner[];       // Modo preview (editor de catálogo)
    customerType?: CustomerType;   // Filtra por tipo de cliente (varejo/revenda/atacado)
    autoPlayInterval?: number;
    showDots?: boolean;
    showArrows?: boolean;
}

export function BannerCarousel({
    banners: externalBanners,
    customerType,
    autoPlayInterval = 5000,
    showDots = true,
    showArrows = true
}: BannerCarouselProps) {
    const [banners, setBanners] = useState<Banner[]>(externalBanners || []);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const [loading, setLoading] = useState(!externalBanners);
    const [zoomedBanner, setZoomedBanner] = useState<Banner | null>(null);

    // Atualizar banners quando prop externa mudar (preview mode)
    useEffect(() => {
        if (externalBanners) {
            setBanners(externalBanners);
            setLoading(false);
        }
    }, [externalBanners]);

    // Carregar banners apenas se não foram fornecidos externamente
    useEffect(() => {
        if (!externalBanners) {
            loadBanners();
        }
    }, [externalBanners]);

    const loadBanners = async () => {
        try {
            const data = await bannerService.getActiveBanners(customerType);
            setBanners(data);

            // Registrar views
            data.forEach(banner => {
                bannerService.trackBannerView(banner.id).catch(() => {});
            });
        } catch (error: any) {
            if (error.code !== '20' && error.name !== 'AbortError' && !error.message?.includes('aborted')) {
                console.error('Erro ao carregar banners:', error);
            }
        } finally {
            setLoading(false);
        }
    };


    // Auto-play
    useEffect(() => {
        if (banners.length <= 1 || isHovered) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % banners.length);
        }, autoPlayInterval);

        return () => clearInterval(interval);
    }, [banners.length, autoPlayInterval, isHovered]);

    const goToSlide = useCallback((index: number) => {
        setCurrentIndex(index);
    }, []);

    const goToPrevious = useCallback(() => {
        setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
    }, [banners.length]);

    const goToNext = useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, [banners.length]);

    const handleBannerClick = async (banner: Banner, event: React.MouseEvent) => {
        // Prevenir navegação se clicar nas setas ou dots
        if ((event.target as HTMLElement).closest('button')) {
            return;
        }

        // Registrar clique sem bloquear a navegacao caso a VPS esteja instavel.
        bannerService.trackBannerClick(banner.id).catch(() => {});

        // Bug fix: usar link_target (campo canônico) com fallback para link_url (campo legado real na tabela)
        const destination = banner.link_target ?? banner.link_url;

        if (banner.link_type === 'product' && destination) {
            window.location.href = `/catalog?product=${destination}`;
        } else if (banner.link_type === 'category' && destination) {
            window.location.href = `/catalog?category=${destination}`;
        } else if (banner.link_type === 'external' && destination) {
            window.open(destination, '_blank');
        } else {
            // Sem link → abrir zoom
            setZoomedBanner(banner);
        }
    };

    if (loading) {
        return (
            <div className="relative w-full aspect-[21/9] bg-slate-200 rounded-xl animate-pulse" />
        );
    }

    if (banners.length === 0) {
        return null;
    }

    return (
        <div
            className="relative w-full aspect-[21/9] rounded-xl overflow-hidden bg-slate-900 group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Banners */}
            <div className="relative w-full h-full">
                {banners.map((banner, index) => (
                    <div
                        key={banner.id}
                        className={`absolute inset-0 transition-all duration-700 ease-in-out ${index === currentIndex
                            ? 'opacity-100 scale-100'
                            : 'opacity-0 scale-105'
                            }`}
                        style={{ pointerEvents: index === currentIndex ? 'auto' : 'none' }}
                    >
                        <div
                            className="w-full h-full cursor-pointer"
                            onClick={(e) => handleBannerClick(banner, e)}
                        >
                            {(() => {
                                const responsiveImageSources = buildResponsiveImageSources(banner.image_url, { kind: 'banner' });

                                return (
                                    <picture>
                                        {responsiveImageSources && (
                                            <>
                                                <source type="image/avif" srcSet={responsiveImageSources.avifSrcSet} sizes={responsiveImageSources.sizes} />
                                                <source type="image/webp" srcSet={responsiveImageSources.webpSrcSet} sizes={responsiveImageSources.sizes} />
                                            </>
                                        )}
                                        <img
                                            src={banner.image_url}
                                            alt={banner.title}
                                            loading={index === 0 ? 'eager' : 'lazy'}
                                            decoding={index === 0 ? 'sync' : 'async'}
                                            fetchPriority={index === 0 ? 'high' : 'auto'}
                                            width={1280}
                                            height={549}
                                            className="w-full h-full object-cover"
                                        />
                                    </picture>
                                );
                            })()}

                            {/* Overlay com título */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent">
                                <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-8">
                                    <h2 className="text-white text-base sm:text-3xl md:text-4xl font-bold mb-1 sm:mb-2 drop-shadow-lg">
                                        {banner.title}
                                    </h2>
                                    {banner.subtitle && (
                                        <p className="hidden sm:block text-white/90 text-lg md:text-xl drop-shadow-lg">
                                            {banner.subtitle}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Setas de navegação */}
            {showArrows && banners.length > 1 && (
                <>
                    <button
                        onClick={goToPrevious}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition-all opacity-0 group-hover:opacity-100 shadow-lg"
                        aria-label="Banner anterior"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                        onClick={goToNext}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition-all opacity-0 group-hover:opacity-100 shadow-lg"
                        aria-label="Próximo banner"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </>
            )}

            {/* Dots de navegação */}
            {showDots && banners.length > 1 
