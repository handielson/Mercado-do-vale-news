import React, { useState } from 'react';
import { FieldFormat, applyFieldFormat } from '../../config/field-dictionary';

interface FormatTesterProps {
    formatOptions: { value: FieldFormat; label: string; color: string }[];
}

/**
 * FormatTester
 * Interactive tool to test field formats in real-time
 */
export function FormatTester({ formatOptions }: FormatTesterProps) {
    const [testText, setTestText] = useState('');

    return (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🧪</span>
                <div>
                    <h3 className="text-lg font-bold text-purple-900">Testador de Formatações</h3>
                    <p className="text-sm text-purple-700">Digite um texto e veja como cada formatação transforma em tempo real!</p>
                </div>
            </div>

            <div className="space-y-4">
                {/* Test Input */}
                <div>
                    <label className="block text-sm font-medium text-purple-900 mb-2">
                        Digite seu texto de teste:
                    </label>
                    <input
                        type="text"
                        value={testText}
                        onChange={(e) => setTestText(e.target.value)}
                        placeholder="Ex: iPhone 14 PRO max, 11987654321, email@EXAMPLE.com"
                        className="w-full px-4 py-3 border-2 border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base"
                    />
                </div>

                {/* Live Preview Grid */}
                {testText && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {formatOptions.filter(opt => opt.value !== 'none').map(option => (
                            <div key={option.value} className="bg-white rounded-lg border-2 border-purple-200 p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${option.color}`}>
                                        {option.label}
                                    </span>
                                </div>
                                <code className="block px-3 py-2 bg-purple-50 rounded border border-purple-200 text-sm font-mono text-purple-900 break-all">
                                    {applyFieldFormat(testText, option.value)}
                                </code>
                            </div>
                        ))}
                    </div>
                )}

                {!testText && (
                    <div className="text-center py-8 text-purple-400">
                        <p className="text-sm">👆 Digite algo acima para ver as formatações em ação!</p>
                    </div>
                )}
            </div>
        </div>
    );
}
