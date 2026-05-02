import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { reviewService } from '../../services/reviews';
import { ProductReview } from '../../types/review';

const STARTUP_RATING_DELAY_MS = 7000;

const scheduleIdle = (callback: () => void) => {
    let idleId: number | null = null;

    const timeoutId = window.setTimeout(() => {
        if ('requestIdleCallback' in window) {
            idleId = window.requestIdleCallback(callback, { timeout: 3000 });
            return;
        }

        callback();
    }, STARTUP_RATING_DELAY_MS);

    return () => {
        window.clearTimeout(timeoutId);
        if (idleId !== null) {
            window.cancelIdleCallback(idleId);
        }
    };
};

interface ProductRatingBadgeProps {
    productId: string;
    className?: string;
}

export const ProductRatingBadge: React.FC<ProductRatingBadgeProps> = ({ productId, className = '' }) => {
    const [average, setAverage] = useState<number>(0);
    const [count, setCount] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        let isMounted = true;
        const fetchRating = async () => {
            try {
                // To do: No futuro, a própria view de produtos `ai_product_catalog_view` pode retornar isso
                // Por agora, fazemos fetch individual (apenas das reviews aprovadas)
                const reviews = await reviewService.getProductReviews(productId);
                
                if (!isMounted) return;

                if (reviews && reviews.length > 0) {
                    const total = reviews.reduce((acc, rev) => acc + rev.rating, 0);
                    setAverage(total / reviews.length);
                    setCount(reviews.length);
                } else {
                    setAverage(0);
                    setCount(0);
                }
            } catch (error) {
                console.error("Erro ao buscar rating silencioso para o mini badge", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        const cancelIdle = scheduleIdle(fetchRating);
        
        return () => {
            isMounted = false;
            cancelIdle();
        };
    }, [productId]);

    if (loading) {
        return <div className={`h-4 w-16 bg-slate-100 rounded animate-pulse ${className}`} />;
    }

    if (count === 0) {
        return null; // Oculta a badge se não tiver review nenhuma ainda
    }

    return (
        <div className={`flex items-center gap-1.5 ${className}`}>
            <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
            <span className="text-xs font-bold text-slate-700">{average.toFixed(1)}</span>
            <span className="text-[10px] text-slate-400">({count})</span>
        </div>
    );
};
