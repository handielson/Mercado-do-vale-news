import React, { useState, useEffect } from 'react';
import { Clock, CalendarDays, Check } from 'lucide-react';
import { BusinessHours, DaySchedule } from '../../types/companySettings';
import { companySettingsService } from '../../services/companySettingsService';
import toast from 'react-hot-toast';

const DEFAULT_HOURS: BusinessHours = {
    monday: { isOpen: true, openTime: '08:00', closeTime: '18:00' },
    tuesday: { isOpen: true, openTime: '08:00', closeTime: '18:00' },
    wednesday: { isOpen: true, openTime: '08:00', closeTime: '18:00' },
    thursday: { isOpen: true, openTime: '08:00', closeTime: '18:00' },
    friday: { isOpen: true, openTime: '08:00', closeTime: '18:00' },
    saturday: { isOpen: true, openTime: '08:00', closeTime: '12:00' },
    sunday: { isOpen: false, openTime: '08:00', closeTime: '12:00' },
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
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const settings = await companySettingsService.get();
                if (settings?.business_hours) {
                    setHours(settings.business_hours);
                }
            } catch (error) {
                console.error('Failed to load business hours:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadSettings();
    }, []);

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

        const timeout = setTimeout(async () => {
            setIsSaving(true);
            try {
                await companySettingsService.update({ business_hours: newHours });
                // We keep it silent since it auto-saves constantly
            } catch (error) {
                console.error('Failed to save business hours:', error);
                toast.error('Erro ao salvar horários.');
            } finally {
                setIsSaving(false);
            }
        }, 1000);

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

                            <div className={`flex items-center gap-3 transition-opacity ${hours[day].isOpen ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
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
                        </div>
                    ))}
                </div>

                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-start gap-3 mt-6">
                    <CalendarDays className="text-blue-500 mt-0.5 flex-shrink-0" size={20} />
                    <div>
                        <h4 className="font-semibold text-blue-800">Feriados Nacionais</h4>
                        <p className="text-sm text-blue-600 mt-1">
                            A loja será sinalizada automaticamente como "Fechada" em feriados nacionais oficiais (com base no calendário brasileiro da BrasilAPI). Não é necessário desmarcar os dias da tabela durante os feriados.
                        </p>
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
