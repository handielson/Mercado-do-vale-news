import { BusinessHours, LocalHoliday } from '../types/companySettings';

import { holidayService, Holiday } from './holidayService';

export type StoreState = 'open' | 'closed' | 'holiday' | 'closing_soon';

export interface StoreStatus {
    status: StoreState;
    message: string;
    actionMessage?: string;
    holiday?: Holiday;
}

const DAYS_OF_WEEK: (keyof BusinessHours)[] = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
];

const DEFAULT_HOURS: BusinessHours = {
    monday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '13:30' },
    tuesday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '13:30' },
    wednesday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '13:30' },
    thursday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '13:30' },
    friday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '13:30' },
    saturday: { isOpen: true, openTime: '08:00', closeTime: '12:00', hasLunchBreak: false, lunchStart: '12:00', lunchEnd: '13:30' },
    sunday: { isOpen: false, openTime: '08:00', closeTime: '12:00', hasLunchBreak: false, lunchStart: '12:00', lunchEnd: '13:30' },
};

export async function getStoreStatus(
    businessHours?: BusinessHours,
    holidayOverrides?: string[],
    localHolidays?: LocalHoliday[]
): Promise<StoreStatus> {
    const hours = businessHours || DEFAULT_HOURS;
    const now = new Date();

    // Format date string
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    // 0. Feriados locais têm prioridade máxima
    if (localHolidays && localHolidays.length > 0) {
        const localMatch = localHolidays.find(h => h.date === dateString);
        if (localMatch) {
            return {
                status: 'holiday',
                message: `Fechado - ${localMatch.label}`,
                actionMessage: `A loja está fechada hoje (${localMatch.label}). Seu pedido será processado no próximo dia útil.`,
            };
        }
    }

    // 1. Check national holiday
    const holiday = await holidayService.isHoliday(now);

    // If it's a holiday, but NOT in the overrides list, we are closed
    if (holiday && (!holidayOverrides || !holidayOverrides.includes(dateString))) {
        return {
            status: 'holiday',
            message: `Fechado - Feriado (${holiday.name})`,
            actionMessage: 'A loja está fechada devido ao feriádo. Seu pedido será processado no próximo dia útil.',
            holiday
        };
    }

    // 2. Check day of week
    const dayName = DAYS_OF_WEEK[now.getDay()];
    // Merge DB schedule with default to prevent missing properties causing closed state
    const todaySchedule = { ...DEFAULT_HOURS[dayName], ...(hours[dayName] || {}) };

    if (!todaySchedule.isOpen) {
        return {
            status: 'closed',
            message: 'Fechado Hoje',
            actionMessage: 'A loja está fechada hoje. Seu pedido será processado amanhã.'
        };
    }

    // 3. Check time
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    const openTimeStr = todaySchedule.openTime || '08:00';
    const closeTimeStr = todaySchedule.closeTime || '18:00';

    const [openH, openM] = openTimeStr.split(':').map(Number);
    const [closeH, closeM] = closeTimeStr.split(':').map(Number);

    const openTimeMinutes = openH * 60 + openM;
    const closeTimeMinutes = closeH * 60 + closeM;

    // Check if within lunch break
    if (todaySchedule.hasLunchBreak && todaySchedule.lunchStart && todaySchedule.lunchEnd) {
        const [lStartH, lStartM] = todaySchedule.lunchStart.split(':').map(Number);
        const [lEndH, lEndM] = todaySchedule.lunchEnd.split(':').map(Number);

        const lunchStartMins = lStartH * 60 + lStartM;
        const lunchEndMins = lEndH * 60 + lEndM;

        if (currentTimeMinutes >= lunchStartMins && currentTimeMinutes < lunchEndMins) {
            return {
                status: 'closed',
                message: `Retorna às ${todaySchedule.lunchEnd}`,
                actionMessage: `A loja está em horário de almoço. Seu pedido será processado a partir das ${todaySchedule.lunchEnd}.`
            };
        }
    }

    if (currentTimeMinutes >= openTimeMinutes && currentTimeMinutes < closeTimeMinutes) {
        // Enhanced Status: Check if within 30 minutes of closing
        if (closeTimeMinutes - currentTimeMinutes <= 30) {
            return {
                status: 'closing_soon',
                message: 'Fechando em breve',
                actionMessage: `A loja fechará às ${closeTimeStr}! Garanta seu pedido para envio imediato.`
            };
        }
        return { status: 'open', message: 'Loja Aberta' };
    } else if (currentTimeMinutes < openTimeMinutes) {
        return {
            status: 'closed',
            message: `Abre às ${openTimeStr}`,
            actionMessage: `A loja está fechada no momento. Seu pedido será processado hoje a partir das ${openTimeStr}.`
        };
    } else {
        return {
            status: 'closed',
            message: 'Loja física fechada',
            actionMessage: 'A loja encerrou o expediente de hoje. Seu pedido será processado amanhã.'
        };
    }
}
