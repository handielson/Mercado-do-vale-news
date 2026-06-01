import React, { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { useVpsAuth } from '../contexts/VpsAuthContext';
import { shippingService } from '../services/shippingService';
import type { FastDeliveryConfig } from '../types/shipping';

// Normaliza string para comparação sem acento/case
function normalize(s: string): string {
    return s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

interface FastDeliveryBadgeProps {
    className?: string;
}

export function FastDeliveryBadge({ className = '' }: FastDeliveryBadgeProps) {
    const { customer } = useVpsAuth();
    const [config, setConfig] = useState<FastDeliveryConfig | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        shippingService.getSettings().then(settings => {
            if (settings?.fast_delivery_config) {
                setConfig(settings.fast_delivery_config);
            }
        });
    }, []);

    useEffect(() => {
        if (!config || !config.enabled || !customer) {
            setVisible(false);
            return;
        }

        const customerCity = customer.address?.city;
        if (!customerCity) {
            setVisible(false);
            return;
        }

        const isLocalCity = config.cities.some(
            city => normalize(city) === normalize(customerCity)
        );
        setVisible(isLocalCity);
    }, [config, customer]);

    if (!visible || !config) return null;

    return (
        <div className={`fast-delivery-banner ${className}`}>
            <div
                style={{
                    background: 'linear-gradient(90deg, #f59e0b 0%, #ea580c 100%)',
                    borderRadius: '12px',
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#fff',
                    fontSize: '14px',
                    boxShadow: '0 2px 8px rgba(245,158,11,0.25)',
                    animation: 'fdSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
                }}
            >
                <Zap size={18} style={{ flexShrink: 0 }} />
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 700 }}>{config.badge_label}</span>
                    <span style={{ opacity: 0.7, fontSize: '12px' }}>—</span>
                    <span style={{ opacity: 0.92 }}>{config.message}</span>
                </div>
            </div>

            <style>{`
                @keyframes fdSlideIn {
                    from { opacity: 0; transform: translateY(-8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
