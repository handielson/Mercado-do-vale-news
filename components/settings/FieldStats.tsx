import React from 'react';
import { FieldDefinition } from '../../config/field-dictionary';

interface FieldStatsProps {
    fields: [string, FieldDefinition][];
}

/**
 * FieldStats
 * Statistics cards showing field format distribution
 */
export function FieldStats({ fields }: FieldStatsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
                label="Total de Campos"
                value={fields.length}
                color="text-slate-800"
            />
            <StatCard
                label="Capitalize"
                value={fields.filter(([, def]) => def.format === 'capitalize').length}
                color="text-blue-600"
            />
            <StatCard
                label="Uppercase"
                value={fields.filter(([, def]) => def.format === 'uppercase').length}
                color="text-purple-600"
            />
            <StatCard
                label="Obrigatórios"
                value={fields.filter(([, def]) => def.required).length}
                color="text-red-600"
            />
        </div>
    );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="bg-white p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
    );
}
