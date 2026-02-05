import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Banner } from '@/types/catalog';
import { bannerService } from '@/services/bannerService';

interface BannerCarouselProps {
    autoPlayInterval?: number;
    showDots?: boolean;
    showArrows?: boolean;
}

export function BannerCarousel({
    autoPlayInterval = 5000,
    showDots = true,
    showArrows = true
}: BannerCarouselProps) {
    const [banners, setBanners] = useState<Banner[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const [loading, setLoading] = useState(true);

    // Carregar banners
    useEffect(() => {
        loadBanners();
    }, []);

    const loadBanners = async () => {
        try {
            const data = await bannerService.getActiveBanners();
            setBanners(data);

            // Registrar views
            data.forEach(banner => {
                bannerService.trackBannerView(banner.id);
            });
        } catch (error) {
            console.error('Erro ao carregar banners:', error);
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

    const handleBannerClick = async (banner: Banner) => {
        // Registrar clique
        await bannerService.trackBannerClick(banner.id);

        // Navegar
        if (banner.link_type === 'product' && banner.link_value) {
            window.location.href = `/catalog?product=${banner.link_value}`;
        } else if (banner.link_type === 'category' && banner.link_value) {
            window.location.href = `/catalog?category=${banner.link_value}`;
        } else if (banner.link_type === 'url' && banner.link_value) {
            window.open(banner.link_value, '_blank');
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
                            onClick={() => handleBannerClick(banner)}
                        >
                            <img
                                src={banner.image_url}
                                alt={banner.title}
                                className="w-full h-full object-cover"
                            />

                            {/* Overlay com título */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent">
                                <div className="absolute bottom-0 left-0 right-0 p-8">
                                    <h2 className="text-white text-3xl md:text-4xl font-bold mb-2 drop-shadow-lg">
                                        {banner.title}
                                    </h2>
                                    {banner.subtitle && (
                                        <p className="text-white/90 text-lg md:text-xl drop-shadow-lg">
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
            {showDots && banners.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {banners.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => goToSlide(index)}
                            className={`transition-all ${index === currentIndex
                                    ? 'w-8 h-2 bg-white'
                                    : 'w-2 h-2 bg-white/50 hover:bg-white/75'
                                } rounded-full`}
                            aria-label={`Ir para banner ${index + 1}`}
                        />
                    ))}
                </div>
            )}

            {/* Contador */}
            <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-md text-white text-sm font-semibold">
                {currentIndex + 1} / {banners.length}
            </div>
        </div>
    );
}
