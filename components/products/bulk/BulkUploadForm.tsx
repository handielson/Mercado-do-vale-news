import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, X, AlertCircle } from 'lucide-react';
import { bulkProductService } from '../../../services/bulk-products';
import { BulkProductRow } from '../../../types/bulk-product';

interface BulkUploadFormProps {
    onUploadComplete?: (rows: BulkProductRow[]) => void;
}

export function BulkUploadForm({ onUploadComplete }: BulkUploadFormProps) {
    const [file, setFile] = useState<File | null>(null);
    const [rows, setRows] = useState<BulkProductRow[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
            'text/csv': ['.csv']
        },
        maxFiles: 1,
        onDrop: async (acceptedFiles) => {
            if (acceptedFiles.length === 0) return;

            const uploadedFile = acceptedFiles[0];
            setFile(uploadedFile);
            setError(null);
            setIsProcessing(true);

            try {
                const parsedRows = await bulkProductService.parseExcelFile(uploadedFile);
                setRows(parsedRows);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Erro ao processar arquivo');
                setRows([]);
            } finally {
                setIsProcessing(false);
            }
        }
    });

    const removeFile = () => {
        setFile(null);
        setRows([]);
        setError(null);
    };

    const handleNext = () => {
        if (rows.length > 0 && onUploadComplete) {
            onUploadComplete(rows);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-slate-800 mb-2">📊 Upload de Planilha Excel/CSV</h2>
                <p className="text-sm text-slate-600">
                    Faça upload de uma planilha com múltiplos produtos para cadastro em lote
                </p>
            </div>

            {/* Template Download */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-800 mb-2">📋 Formato da Planilha</p>
                <p className="text-sm text-blue-700 mb-3">
                    A planilha deve conter as seguintes colunas:
                </p>
                <div className="bg-white rounded border border-blue-200 p-3 font-mono text-xs">
                    <div className="grid grid-cols-4 gap-2 text-slate-600">
                        <div className="font-semibold">EAN</div>
                        <div className="font-semibold">Serial</div>
                        <div className="font-semibold">IMEI1</div>
                        <div className="font-semibold">IMEI2</div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-slate-500 mt-2">
                        <div>7891234567890</div>
                        <div>ABC123</div>
                        <div>123456789012345</div>
                        <div>987654321098765</div>
                    </div>
                </div>
            </div>

            {/* Upload Area */}
            {!file && (
                <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${isDragActive
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                        }`}
                >
                    <input {...getInputProps()} />
                    <Upload className="mx-auto mb-4 text-slate-400" size={48} />
                    <p className="text-lg font-medium text-slate-700 mb-2">
                        {isDragActive ? 'Solte o arquivo aqui' : 'Arraste um arquivo ou clique para selecionar'}
                    </p>
                    <p className="text-sm text-slate-500">
                        Formatos aceitos: .xlsx, .xls, .csv
                    </p>
                </div>
            )}

            {/* File Info */}
            {file && !isProcessing && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FileSpreadsheet className="text-green-600" size={24} />
                            <div>
                                <p className="font-medium text-green-800">{file.name}</p>
                                <p className="text-sm text-green-600">
                                    {rows.length} linha(s) encontrada(s)
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={removeFile}
                            className="text-red-600 hover:text-red-700 p-1"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}

            {/* Processing */}
            {isProcessing && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <div className="animate-spin mx-auto mb-2 text-blue-600">
                        <Upload size={24} />
                    </div>
                    <p className="text-sm text-blue-700">Processando arquivo...</p>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
                        <div>
                            <p className="font-medium text-red-800">Erro ao processar arquivo</p>
                            <p className="text-sm text-red-600 mt-1">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Sample */}
            {rows.length > 0 && (
                <div>
                    <p className="text-sm font-medium text-slate-700 mb-3">
                        📋 Prévia (primeiras 5 linhas):
                    </p>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-100">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-semibold text-slate-700">#</th>
                                        <th className="px-4 py-2 text-left font-semibold text-slate-700">EAN</th>
                                        <th className="px-4 py-2 text-left font-semibold text-slate-700">Serial</th>
                                        <th className="px-4 py-2 text-left font-semibold text-slate-700">IMEI 1</th>
                                        <th className="px-4 py-2 text-left font-semibold text-slate-700">IMEI 2</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.slice(0, 5).map((row, index) => (
                                        <tr key={index} className="border-t border-slate-200">
                                            <td className="px-4 py-2 text-slate-600">{index + 1}</td>
                                            <td className="px-4 py-2 text-slate-800 font-mono">{row.ean}</td>
                                            <td className="px-4 py-2 text-slate-800">{row.serial}</td>
                                            <td className="px-4 py-2 text-slate-800 font-mono text-xs">{row.imei1 || '-'}</td>
                                            <td className="px-4 py-2 text-slate-800 font-mono text-xs">{row.imei2 || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    {rows.length > 5 && (
                        <p className="text-xs text-slate-500 mt-2 text-center">
                            ... e mais {rows.length - 5} linha(s)
                        </p>
                    )}
                </div>
            )}

            {/* Actions */}
            {rows.length > 0 && (
                <div className="flex gap-3">
                    <button
                        onClick={removeFile}
                        className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleNext}
                        className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                        Continuar para Validação ({rows.length} produtos)
                    </button>
                </div>
            )}
        </div>
    );
}
