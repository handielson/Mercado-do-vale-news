/**
 * CompanyAdditionalInfoSection Component
 * 
 * Handles company additional information (hours, description, notes)
 * 
 * Route: Settings → Company Data → Additional Info Section
 */

import React from 'react';
import { Info, Clock, ShieldAlert, KeyRound } from 'lucide-react';
import { Company } from '../../types/company';

interface CompanyAdditionalInfoSectionProps {
    form: Company;
    onChange: (updates: Partial<Company>) => void;
}

export const CompanyAdditionalInfoSection: React.FC<CompanyAdditionalInfoSectionProps> = ({
    form,
    onChange
}) => {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="flex items-center gap-2 font-bold text-slate-800 text-lg mb-6 pb-3 border-b">
                <Info size={22} className="text-blue-600" />
                Informações Adicionais
            </h2>

            <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                    <Clock size={16} />
                    Horário de Funcionamento
                </label>
                <input
                    type="text"
                    value={form.businessHours || ''}
                    onChange={(e) => onChange({ businessHours: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Ex: Seg-Sex: 8h-18h | Sáb: 8h-12h"
                />
            </div>

            <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Descrição da Empresa
                </label>
                <textarea
                    value={form.description || ''}
                    onChange={(e) => onChange({ description: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    placeholder="Descreva sua empresa, produtos e serviços..."
                    rows={4}
                />
            </div>

            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Observações Internas
                </label>
                <textarea
                    value={form.internalNotes || ''}
                    onChange={(e) => onChange({ internalNotes: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    placeholder="Anotações internas (não visíveis para clientes)..."
                    rows={3}
                />
                <p className="text-xs text-slate-500 mt-1">
                    Estas observações são apenas para uso interno
                </p>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Rodapé do Catálogo Público
                </label>
                <p className="text-xs text-slate-500 mb-2">
                    Texto exibido no rodapé da página do catálogo para todos os clientes.
                </p>
                <textarea
                    value={form.catalogFooterText || ''}
                    onChange={(e) => onChange({ catalogFooterText: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    placeholder="Ex: © 2026 Mercado do Vale. Todos os direitos reservados."
                    rows={2}
                />
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100">
                <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                    URL Base de Vídeos (Servidor Próprio / NAS)
                </label>
                <p className="text-xs text-slate-500 mb-2">
                    Se preenchido, o site tentará carregar automaticamente os vídeos dos produtos procurando pelo arquivo <strong>SKU.mp4</strong> neste endereço. (Ex: <em>http://192.168.1.X/videos/</em>)
                </p>
                <input
                    type="url"
                    value={form.synologyVideoBaseUrl || ''}
                    onChange={(e) => onChange({ synologyVideoBaseUrl: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
                    placeholder="Ex: http://seu-ddns.synology.me/videos/"
                />
            </div>

            {/* SEÇÃO DE MANUTENÇÃO */}
            <div className="mt-8 pt-6 border-t border-red-100 bg-red-50/50 -mx-6 px-6 pb-6 rounded-b-2xl">
                <h2 className="flex items-center gap-2 font-bold text-red-700 text-lg mb-4">
                    <ShieldAlert size={22} className="text-red-600" />
                    Operação Segura (Modo Manutenção)
                </h2>
                <p className="text-sm text-red-600/80 mb-6 font-medium">
                    Restrinja o acesso à Loja Pública (Catálogo) durante grandes atualizações ou integrações.
                </p>

                <div className="space-y-5">
                    {/* Toggle Ligar/Desligar */}
                    <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-red-100 shadow-sm">
                        <div>
                            <span className="block font-bold text-slate-800">Status da Loja Pública</span>
                            <span className="text-sm text-slate-500">
                                {form.maintenanceMode ? 'Loja invisível para clientes. Apenas acessível via link VIP.' : 'Loja operando normalmente. Visível para o mundo ativo.'}
                            </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={form.maintenanceMode || false}
                                onChange={(e) => onChange({ maintenanceMode: e.target.checked })}
                            />
                            <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-500 shadow-inner"></div>
                        </label>
                    </div>

                    {form.maintenanceMode && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            {/* Mensagem Pública */}
                            <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm flex flex-col">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Mensagem para Clientes
                                </label>
                                <textarea
                                    value={form.maintenanceMessage || ''}
                                    onChange={(e) => onChange({ maintenanceMessage: e.target.value })}
                                    className="w-full flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
                                    placeholder="Ex: Voltamos logo! Estamos realizando melhorias no sistema."
                                />
                            </div>

                            {/* Link de Bypass Secreto */}
                            <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm flex flex-col">
                                <label className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                                    <KeyRound size={16} className="text-amber-500" />
                                    Chave Secreta (Acesso VIP)
                                </label>
                                <div className="flex flex-col gap-2">
                                    <input
                                        type="text"
                                        value={form.maintenanceBypassKey || ''}
                                        onChange={(e) => onChange({ maintenanceBypassKey: e.target.value })}
                                        className="w-full font-mono text-amber-700 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none bg-amber-50"
                                        placeholder="Ex: liberapromocao"
                                    />
                                    <p className="text-[11px] text-slate-500 leading-tight">
                                        Use a URL <strong className="text-slate-700 select-all">?admin={form.maintenanceBypassKey || 'liberapromocao'}</strong> no seu navegador para ver a loja na aba anônima e testar catalogos!
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
