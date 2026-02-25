import React, { useState, useEffect } from 'react';
import { Clock, CalendarDays, Check, AlertCircle } from 'lucide-react';
import { BusinessHours, DaySchedule } from '../../types/companySettings';
import { companySettingsService } from '../../services/companySettingsService';
import { holidayService, Holiday } from '../../utils/holidayService';
import toast from 'react-hot-toast';

const DEFAULT_HOURS: BusinessHours = {
    monday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '13:30' },
    tuesday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '13:30' },
    wednesday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '13:30' },
    thursday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '13:30' },
    friday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '13:30' },
    saturday: { isOpen: true, openTime: '08:00', closeTime: '12:00', hasLunchBreak: false, lunchStart: '12:00', lunchEnd: '13:30' },
    sunday: { isOpen: false, openTime: '08:00', closeTime: '12:00', hasLunchBreak: false, lunchStart: '12:00', lunchEnd: '13:30' },
};

const DAY_LABELS: Record<keyof BusinessHours, string> = {
    monday: 'Segunda-feira',
    tuesday: 'Terça-feira',
    wednesday: 'Quarta-feira',
    thursday: 'Quinta-feira',
    friday: 'Sexta-feira',
    saturday: 'Sábado',
    sunday: 'Domingo',
};

export function BusinessHoursPanel() {
    const [hours, setHours] = useState<BusinessHours>(DEFAULT_HOURS);
    const [holidayOverrides, setHolidayOverrides] = useState<string[]>([]);
    const [availableHolidays, setAvailableHolidays] = useState<Holiday[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                // Fetch settings
                const settings = await companySettingsService.get();
                if (settings?.business_hours) {
                    // Merge with DEFAULT_HOURS to ensure no missing days or properties
                    const mergedHours = { ...DEFAULT_HOURS };

                    if (typeof settings.business_hours === 'object') {
                        Object.keys(DEFAULT_HOURS).forEach((key) => {
                            const day = key as keyof BusinessHours;
                            if (settings.business_hours?.[day]) {
                                mergedHours[day] = {
                                    ...DEFAULT_HOURS[day],
                                    ...settings.business_hours[day]
                                };
                            }
                        });
                    }

                    setHours(mergedHours);
                }
            } catch (error) {
                console.error('Failed to load business hours:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadSettings();
    }, []);

    const handleSave = async (updatedHours: BusinessHours, updatedOverrides: string[]) => {
        setIsSaving(true);
        try {
            await companySettingsService.update({
                business_hours: updatedHours,
                holiday_overrides: updatedOverrides
            });
            // We keep it silent since it auto-saves constantly
        } catch (error) {
            console.error('Failed to save business hours:', error);
            toast.error('Erro ao salvar horários.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (day: keyof BusinessHours, field: keyof DaySchedule, value: string | boolean) => {
        const newHours = {
            ...hours,
            [day]: {
                ...hours[day],
                [field]: value
            }
        };
        setHours(newHours);

        if (saveTimeout) clearTimeout(saveTimeout);

        const timeout = setTimeout(() => handleSave(newHours, holidayOverrides), 1000);
        setSaveTimeout(timeout);
    };

    const handleHolidayToggle = (dateString: string, isOpening: boolean) => {
        let newOverrides = [...holidayOverrides];

        if (isOpening && !newOverrides.includes(dateString)) {
            newOverrides.push(dateString);
        } else if (!isOpening) {
            newOverrides = newOverrides.filter(d => d !== dateString);
        }

        setHolidayOverrides(newOverrides);

        if (saveTimeout) clearTimeout(saveTimeout);
        const timeout = setTimeout(() => handleSave(hours, newOverrides), 1000);
        setSaveTimeout(timeout);
    };

    if (isLoading) {
        return <div className="p-6 text-center text-slate-500 animate-pulse bg-white rounded-xl border border-slate-200">Carregando horários...</div>;
    }

    const days = Object.keys(DEFAULT_HOURS) as (keyof BusinessHours)[];

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                        <Clock size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Horários de Funcionamento</h2>
                        <p className="text-sm text-slate-500">
                            Defina os dias e horários em que a loja está aberta para atendimento e entregas.
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    {days.map(day => (
                        <div key={day} className={`flex items-center justify-between p-4 rounded-lg border ${hours[day].isOpen ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="flex items-center gap-4 w-1/3">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={hours[day].isOpen}
                                        onChange={(e) => handleChange(day, 'isOpen', e.target.checked)}
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                                <span className={`font-medium ${hours[day].isOpen ? 'text-slate-800' : 'text-slate-400'}`}>
                                    {DAY_LABELS[day]}
                                </span>
                            </div>

                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="time"
                                        value={hours[day].openTime}
                                        onChange={(e) => handleChange(day, 'openTime', e.target.value)}
                                        className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                    />
                                    <span className="text-slate-400 font-medium">até</span>
                                    <input
                                        type="time"
                                        value={hours[day].closeTime}
                                        onChange={(e) => handleChange(day, 'closeTime', e.target.value)}
                                        className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={!!hours[day].hasLunchBreak}
                                            onChange={(e) => handleChange(day, 'hasLunchBreak', e.target.checked)}
                                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-slate-600">Pausa pro almoço</span>
                                    </label>

                                    {hours[day].hasLunchBreak && (
                                        <div className="flex items-center gap-2 fade-in">
                                            <input
                                                type="time"
                                                value={hours[day].lunchStart || '12:00'}
                                                onChange={(e) => handleChange(day, 'lunchStart', e.target.value)}
                                                className="px-2 py-1 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                            />
                                            <span className="text-slate-400 text-xs font-medium">até</span>
                                            <input
                                                type="time"
                                                value={hours[day].lunchEnd || '13:30'}
                                                onChange={(e) => handleChange(day, 'lunchEnd', e.target.value)}
                                                className="px-2 py-1 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-start gap-3 mt-6">
                    <CalendarDays className="text-blue-500 mt-0.5 flex-shrink-0" size={20} />
                    <div className="w-full">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-semibold text-blue-800">Feriados Nacionais</h4>
                                <p className="text-sm text-blue-600 mt-1">
                                    A loja será sinalizada automaticamente como "Fechada" em feriados nacionais oficiais (BrasilAPI).
                                    Caso decida abrir em algum deles, marque a opção abaixo.
                                </p>
                            </div>
                        </div>

                        {availableHolidays.length > 0 ? (
                            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                {availableHolidays.map((holiday) => {
                                    const isOverridden = holidayOverrides.includes(holiday.date);
                                    // Parse date safely
                                    const [year, month, day] = holiday.date.split('-');
                                    const dateStr = `${day}/${month}/${year}`;

                                    return (
                                        <div key={holiday.date} className="flex items-center justify-between bg-white bg-opacity-60 p-3 rounded border border-blue-100">
                                            <div>
                                                <p className="font-medium text-slate-800 text-sm">
                                                    {dateStr} - {holiday.name}
                                                </p>
                                                <p className="text-xs text-slate-500">{holiday.type}</p>
                                            </div>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <span className={`text-xs font-semibold ${isOverridden ? 'text-green-600' : 'text-slate-400'}`}>
                                                    {isOverridden ? 'Atenderemos' : 'Fechado'}
                                                </span>
                                                <div className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={isOverridden}
                                                        onChange={(e) => handleHolidayToggle(holiday.date, e.target.checked)}
                                                    />
                                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                                                </div>
                                            </label>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="mt-4 p-3 bg-white bg-opacity-60 rounded flex items-center gap-2 text-sm text-slate-600">
                                <AlertCircle size={16} className="text-amber-500" />
                                Nenhum feriado futuro encontrado para este ano.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Status Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <div className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-colors ${isSaving ? 'text-amber-600 bg-amber-50' : 'text-slate-500'}`}>
                    {isSaving ? (
                        <>
                            <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                            Salvando alterações...
                        </>
                    ) : (
                        <>
                            <Check size={16} className="text-green-500" />
                            Horários atualizados e sincronizados
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
