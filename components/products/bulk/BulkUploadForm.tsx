import React, { useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { AlertCircle, Download, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { bulkProductService } from '../../../services/bulk-products';
import { categoryService } from '../../../services/categories';
import { writeExcelRows } from '../../../utils/excel';
import { BulkProductRow } from '../../../types/bulk-product';
import { Category } from '../../../types/category';

interface BulkUploadFormProps {
    onUploadComplete?: (rows: BulkProductRow[]) => void;
}

function templateFileName(category?: Category | null): string {
    const suffix = (category?.slug || category?.name || 'geral')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return `template_importacao_${suffix || 'geral'}.xlsx`;
}

function getSpecValue(row: BulkProductRow, key: string): string {
    return String(row.specs?.[key] || (row as any)[key] || '');
}

export function BulkUploadForm({ onUploadComplete }: BulkUploadFormProps) {
    const [file, setFile] = useState<File | null>(null);
    const [rows, setRows] = useState<BulkProductRow[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [templateError, setTemplateError] = useState<string | null>(null);

    const selectedCategory = useMemo(
        () => categories.find(category => category.id === selectedCategoryId) || null,
        [categories, selectedCategoryId]
    );

    const templateHeaders = useMemo(
        () => bulkProductService.buildTemplateHeaders(selectedCategory?.config || {}),
        [selectedCategory]
    );

    useEffect(() => {
        let active = true;
        categoryService.list()
            .then(loadedCategories => {
                if (!active) return;
                setCategories(loadedCategories);
            })
            .catch(() => {
                if (!active) return;
                setTemplateError('Nao foi possivel carregar as categorias para gerar o modelo.');
            });
        return () => {
            active = false;
        };
    }, []);

    const handleDownloadTemplate = async () => {
        setTemplateError(null);
        setIsDownloadingTemplate(true);

        try {
            const exampleRows = bulkProductService.buildTemplateExampleRows(selectedCategory || undefined);
            await writeExcelRows(templateFileName(selectedCategory), exampleRows, templateHeaders);
        } catch (err) {
            setTemplateError(err instanceof Error ? err.message : 'Erro ao gerar modelo da planilha.');
        } finally {
            setIsDownloadingTemplate(false);
        }
    };

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
        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
                <h2 className="mb-2 text-xl font-semibold text-slate-800">Upload de Planilha Excel/CSV</h2>
                <p className="text-sm text-slate-600">
                    Baixe um modelo por categoria, substitua os dados de exemplo e envie a planilha preenchida.
                </p>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end">
                    <label className="flex-1">
                        <span className="mb-1 block text-sm font-medium text-blue-900">Categoria do modelo</span>
                        <select
                            value={selectedCategoryId}
                            onChange={(event) => setSelectedCategoryId(event.target.value)}
                            className="h-11 w-full rounded-lg border border-blue-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="">Modelo geral</option>
                            {categories.map(category => (
                                <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                        </select>
                    </label>

                    <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        disabled={isDownloadingTemplate}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {isDownloadingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        Baixar modelo
                    </button>
                </div>

                <p className="mb-3 text-sm text-blue-800">
                    O arquivo inclui uma linha de exemplo e os campos exigidos pela categoria selecionada.
                </p>

                <div className="rounded border border-blue-200 bg-white p-3 font-mono text-xs text-slate-600">
                    <div className="flex flex-wrap gap-2">
                        {templateHeaders.slice(0, 14).map(header => (
                            <span key={header} className="rounded bg-slate-100 px-2 py-1">{header}</span>
                        ))}
                        {templateHeaders.length > 14 && (
                            <span className="rounded bg-slate-100 px-2 py-1">+{templateHeaders.length - 14} campos</span>
                        )}
                    </div>
                </div>

                {templateError && (
                    <p className="mt-3 text-sm text-red-700">{templateError}</p>
                )}
            </div>

            {!file && (
                <div
                    {...getRootProps()}
                    className={`cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors ${isDragActive
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                        }`}
                >
                    <input {...getInputProps()} />
                    <Upload className="mx-auto mb-4 text-slate-400" size={48} />
                    <p className="mb-2 text-lg font-medium text-slate-700">
                        {isDragActive ? 'Solte o arquivo aqui' : 'Arraste um arquivo ou clique para selecionar'}
                    </p>
                    <p className="text-sm text-slate-500">Formatos aceitos: .xlsx, .xls, .csv</p>
                </div>
            )}

            {file && !isProcessing && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FileSpreadsheet className="text-green-600" size={24} />
                            <div>
                                <p className="font-medium text-green-800">{file.name}</p>
                                <p className="text-sm text-green-600">{rows.length} linha(s) encontrada(s)</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={removeFile}
                            className="p-1 text-red-600 hover:text-red-700"
                            aria-label="Remover arquivo"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}

            {isProcessing && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
                    <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-blue-600" />
                    <p className="text-sm text-blue-700">Processando arquivo...</p>
                </div>
            )}

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="flex-shrink-0 text-red-600" size={20} />
                        <div>
                            <p className="font-medium text-red-800">Erro ao processar arquivo</p>
                            <p className="mt-1 text-sm text-red-600">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {rows.length > 0 && (
                <div>
                    <p className="mb-3 text-sm font-medium text-slate-700">Previa das primeiras 5 linhas:</p>
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-100">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-semibold text-slate-700">#</th>
                                        <th className="px-4 py-2 text-left font-semibold text-slate-700">SKU</th>
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
                                            <td className="px-4 py-2 font-mono text-slate-800">{row.sku || '-'}</td>
                                            <td className="px-4 py-2 font-mono text-slate-800">{row.ean || '-'}</td>
                                            <td className="px-4 py-2 text-slate-800">{getSpecValue(row, 'serial') || '-'}</td>
                                            <td className="px-4 py-2 font-mono text-xs text-slate-800">{getSpecValue(row, 'imei1') || '-'}</td>
                                            <td className="px-4 py-2 font-mono text-xs text-slate-800">{getSpecValue(row, 'imei2') || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    {rows.length > 5 && (
                        <p className="mt-2 text-center text-xs text-slate-500">... e mais {rows.length - 5} linha(s)</p>
                    )}
                </div>
            )}

            {rows.length > 0 && (
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={removeFile}
                        className="flex-1 rounded-lg bg-slate-100 px-4 py-3 text-slate-700 transition-colors hover:bg-slate-200"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleNext}
                        className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700"
                    >
                        Continuar para validacao ({rows.length} produtos)
                    </button>
                </div>
            )}
        </div>
    );
}
