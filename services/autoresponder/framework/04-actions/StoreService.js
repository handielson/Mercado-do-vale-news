let pool = null;

export function init(mysqlPool) {
    pool = mysqlPool;
}

function errorResponse(code, message) {
    return { success: false, error: { code, message } };
}

function successResponse(data) {
    return { success: true, data };
}

function checkPool() {
    if (!pool) throw new Error('DATABASE_POOL_NOT_INITIALIZED');
}

export async function getStoreAddress() {
    return successResponse({
        address: 'Av. Souza Filho, 100 - Centro, Petrolina - PE, 56302-000',
        maps_url: 'https://maps.google.com/?q=Mercado+do+Vale+Petrolina'
    });
}

export async function getBusinessHours() {
    return successResponse([
        { days: 'Segunda a Sexta', hours: '08:00 - 18:00' },
        { days: 'Sábado', hours: '08:00 - 12:00' },
        { days: 'Domingo', hours: 'Fechado' }
    ]);
}

export async function isStoreOpen() {
    try {
        const now = new Date();
        const hour = now.getHours();
        const minutes = now.getMinutes();
        const day = now.getDay(); // 0 = Sunday, 6 = Saturday, 1-5 = Weekdays

        const currentMinutes = (hour * 60) + minutes;

        // Monday to Friday: 8h (480 min) to 18h (1080 min)
        if (day >= 1 && day <= 5) {
            if (currentMinutes >= 480 && currentMinutes < 1080) {
                return successResponse({ open: true, status: 'aberta', next_change: '18:00' });
            }
            return successResponse({ open: false, status: 'fechada', next_change: 'Amanhã às 08:00' });
        }

        // Saturday: 8h (480 min) to 12h (720 min)
        if (day === 6) {
            if (currentMinutes >= 480 && currentMinutes < 720) {
                return successResponse({ open: true, status: 'aberta', next_change: '12:00' });
            }
            return successResponse({ open: false, status: 'fechada', next_change: 'Segunda às 08:00' });
        }

        // Sunday: Closed
        return successResponse({ open: false, status: 'fechada', next_change: 'Segunda às 08:00' });
    } catch (err) {
        return errorResponse('ERP_UNAVAILABLE', err.message);
    }
}
