import { BusinessHours } from '../types/companySettings';
import { holidayService, Holiday } from './holidayService';

export type StoreState = 'open' | 'closed' | 'holiday';

export interface StoreStatus {
    status: StoreState;
    message: string;
    holiday?: Holiday;
}

const DAYS_OF_WEEK: (keyof BusinessHours)[] = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
];

export async function getStoreStatus(businessHours?: BusinessHours, holidayOverrides?: string[]): Promise<StoreStatus> {
    if (!businessHours) {
        return { status: 'open', message: 'Aberto' }; // Default fallback if not configured
    }

    // Get current date/time in local timezone (assuming user is in Brazil or we use device time)
    const now = new Date();

    // 1. Check holiday first
    const holiday = await holidayService.isHoliday(now);

    // Format date string to check against overrides
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    // If it's a holiday, but NOT in the overrides list, we are closed
    if (holiday && (!holidayOverrides || !holidayOverrides.includes(dateString))) {
        return {
            status: 'holiday',
            message: `Fechado - Feriado (${holiday.name})`,
            holiday
        };
    }

    // 2. Check day of week
    const dayName = DAYS_OF_WEEK[now.getDay()];
    const todaySchedule = businessHours[dayName];

    if (!todaySchedule || !todaySchedule.isOpen) {
        return { status: 'closed', message: 'Fechado Hoje' };
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

    console.log('[StoreStatus Check Internal]', {
        dayName,
        currentTimeMinutes,
        openTimeMinutes,
        closeTimeMinutes,
        isOpenFlag: todaySchedule.isOpen,
        hasLunchBreak: todaySchedule.hasLunchBreak
    });

    // Check if within lunch break
    if (todaySchedule.hasLunchBreak && todaySchedule.lunchStart && todaySchedule.lunchEnd) {
        const [lStartH, lStartM] = todaySchedule.lunchStart.split(':').map(Number);
        const [lEndH, lEndM] = todaySchedule.lunchEnd.split(':').map(Number);

        const lunchStartMins = lStartH * 60 + lStartM;
        const lunchEndMins = lEndH * 60 + lEndM;

        if (currentTimeMinutes >= lunchStartMins && currentTimeMinutes < lunchEndMins) {
            return { status: 'closed', message: `Retorna às ${todaySchedule.lunchEnd}` };
        }
    }

    if (currentTimeMinutes >= openTimeMinutes && currentTimeMinutes < closeTimeMinutes) {
        return { status: 'open', message: 'Loja Aberta' };
    } else if (currentTimeMinutes < openTimeMinutes) {
        return { status: 'closed', message: `Abre às ${openTimeStr}` };
    } else {
        return { status: 'closed', message: 'Fechado' };
    }
}
