export const BRAZIL_TIME_ZONE = 'America/Sao_Paulo';

type DateValue = string | number | Date;

export function formatBrazilDate(value: DateValue, options: Intl.DateTimeFormatOptions = {}): string {
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: BRAZIL_TIME_ZONE,
        ...options,
    }).format(new Date(value));
}

export function formatBrazilTime(value: DateValue, options: Intl.DateTimeFormatOptions = {}): string {
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: BRAZIL_TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        ...options,
    }).format(new Date(value));
}

export function formatBrazilDateTime(value: DateValue, options: Intl.DateTimeFormatOptions = {}): string {
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: BRAZIL_TIME_ZONE,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...options,
    }).format(new Date(value));
}
