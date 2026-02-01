import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Upload } from 'lucide-react';
import { QuickRegisterForm } from '../../../components/products/bulk/QuickRegisterForm';
import { BulkUploadForm } from '../../../components/products/bulk/BulkUploadForm';
import { BulkPreviewTable } from '../../../components/products/bulk/BulkPreviewTable';
import { BulkProgressModal } from '../../../components/products/bulk/BulkProgressModal';
import { bulkProductService } from '../../../services/bulk-products';
import { BulkProductPreview, BulkProductRow } from '../../../types/bulk-product';

type UploadStep = 'upload' | 'preview' | 'importing';

export function BulkRegistrationPage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'quick' | 'upload'>('quick');

    // Excel upload state
    const [uploadStep, setUploadStep] = useState<UploadStep>('upload');
    const [rows, setRows] = useState<BulkProductRow[]>([]);
    const [previews, setPreviews] = useState<BulkProductPreview[]>([]);
    const [isValidating, setIsValidating] = useState(false);

    // Import progress state
    const [showProgress, setShowProgress] = useState(false);
    const [importProgress, setImportProgress] = useState({
        total: 0,
        current: 0,
        success: 0,
        failed: 0,
        isComplete: false
    });

    const handleUploadComplete = async () => {
        // This will be called from BulkUploadForm when file is processed
        // We need to pass rows from the form
    };

    const handleFileProcessed = async (processedRows: BulkProductRow[]) => {
        setRows(processedRows);
        setIsValidating(true);

        try {
            const generatedPreviews = await bulkProductService.generatePreview(processedRows);
            setPreviews(generatedPreviews);
            setUploadStep('preview');
        } catch (error) {
            alert('Erro ao validar produtos');
        } finally {
            setIsValidating(false);
        }
    };

    const handleConfirmImport = async () => {
        setUploadStep('importing');
        setShowProgress(true);

        const validPreviews = previews.filter(p => p.validation.valid);

        setImportProgress({
            total: validPreviews.length,
            current: 0,
            success: 0,
            failed: 0,
            isComplete: false
        });

        // Import products one by one with progress updates
        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < validPreviews.length; i++) {
            const preview = validPreviews[i];

            try {
                await bulkProductService.createBulkProducts([preview]);
                successCount++;
            } catch (error) {
                failedCount++;
            }

            setImportProgress({
                total: validPreviews.length,
                current: i + 1,
                success: successCount,
                failed: failedCount,
                isComplete: i === validPreviews.length - 1
            });

            // Small delay to show progress
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    };

    const handleCloseProgress = () => {
        setShowProgress(false);
        setUploadStep('upload');
        setRows([]);
        setPreviews([]);
        setImportProgress({
            total: 0,
            current: 0,
            success: 0,
            failed: 0,
            isComplete: false
        });
    };

    const handleCancelPreview = () => {
        setUploadStep('upload');
        setPreviews([]);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => navigate('/admin/products')}
                        className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-4"
                    >
                        <ArrowLeft size={20} />
                        Voltar para Produtos
                    </button>
                    <h1 className="text-3xl font-bold text-slate-800">📦 Cadastro em Massa de Produtos</h1>
                    <p className="text-slate-600 mt-2">
                        Cadastre múltiplos produtos rapidamente usando scanner de código de barras ou upload de planilha
                    </p>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
                    <div className="flex border-b border-slate-200">
                        <button
                            onClick={() => setActiveTab('quick')}
                            className={`flex-1 px-6 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'quick'
                                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                                }`}
                        >
                            <Zap size={20} />
                            Cadastro Rápido (Scanner)
                        </button>
                        <button
                            onClick={() => setActiveTab('upload')}
                            className={`flex-1 px-6 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'upload'
                                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                                }`}
                        >
                            <Upload size={20} />
                            Upload Excel
                        </button>
                    </div>
                </div>

                {/* Tab Content */}
                {activeTab === 'quick' && <QuickRegisterForm />}

                {activeTab === 'upload' && (
                    <>
                        {uploadStep === 'upload' && (
                            <BulkUploadForm onUploadComplete={handleFileProcessed} />
                        )}

                        {uploadStep === 'preview' && (
                            <BulkPreviewTable
                                previews={previews}
                                onConfirm={handleConfirmImport}
                                onCancel={handleCancelPreview}
                            />
                        )}
                    </>
                )}

                {/* Progress Modal */}
                <BulkProgressModal
                    isOpen={showProgress}
                    total={importProgress.total}
                    current={importProgress.current}
                    success={importProgress.success}
                    failed={importProgress.failed}
                    isComplete={importProgress.isComplete}
                    onClose={handleCloseProgress}
                />
            </div>
        </div>
    );
}
