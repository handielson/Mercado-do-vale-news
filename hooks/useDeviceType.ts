import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

function detect(): DeviceType {
    const ua = navigator.userAgent;
    const isMobileUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isTabletUA = /iPad|Android(?!.*Mobile)/i.test(ua);
    const w = window.innerWidth;

    if (isTabletUA || (w >= 640 && w < 1024 && !isMobileUA)) return 'tablet';
    if (isMobileUA || w < 640) return 'mobile';
    return 'desktop';
}

export function useDeviceType(): DeviceType {
    const [device, setDevice] = useState<DeviceType>(() => {
        if (typeof window === 'undefined') return 'desktop';
        return detect();
    });

    useEffect(() => {
        const handler = () => setDevice(detect());
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);

    return device;
}
