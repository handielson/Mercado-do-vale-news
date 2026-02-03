import React from 'react';
import { FileText } from 'lucide-react';

interface CustomerNotesSectionProps {
    notes: string;
    onNotesUpdate: (notes: string) => void;
}

export default function CustomerNotesSection({ notes, onNotesUpdate }: CustomerNotesSectionProps) {
    return (
        <div className="bg-amber-50 rounded-lg shadow-sm border border-amber-200 p-6">
            <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-amber-600" />
                <h2 className="text-lg font-semibold text-slate-900">Observações Internas</h2>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                    Apenas Admin
                </span>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Notas e Observações
                </label>
                <textarea
                    value={notes || ''}
                    onChange={(e) => onNotesUpdate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                    placeholder="Adicione observações internas sobre este cliente (visível apenas para administradores)..."
                    rows={4}
                />
                <p className="mt-1 text-xs text-slate-500">
                    💡 Estas informações são privadas e não serão compartilhadas com o cliente
                </p>
            </div>
        </div>
    );
}
