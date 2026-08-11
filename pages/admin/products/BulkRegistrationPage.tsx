import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Zap, Upload } from 'lucide-react';
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
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <button
                    onClick={() => navigate('/admin/products')}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors -ml-2"
                >
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div className="p-3 bg-blue-50 rounded-xl">
                    <Upload className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Cadastro em Massa</h1>
                    <p className="text-sm text-slate-500">Cadastre múltiplos produtos rapidamente via scanner ou Excel</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Menu Lateral */}
                <div className="w-full md:w-64 flex-shrink-0 bg-white border border-slate-200 rounded-2xl p-3 shadow-sm sticky top-24">
                    <nav className="flex flex-col gap-1.5">
                        <button
                            onClick={() => setActiveTab('quick')}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'quick'
                                    ? 'bg-blue-50 text-blue-800 shadow-sm border border-blue-200/60'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Zap className={`w-5 h-5 ${activeTab === 'quick' ? 'text-blue-600' : 'text-slate-400'}`} />
                                Scanner
                            </div>
                            {activeTab === 'quick' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                        </button>

                        <button
                            onClick={() => setActiveTab('upload')}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'upload'
                                    ? 'bg-blue-50 text-blue-800 shadow-sm border border-blue-200/60'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Upload className={`w-5 h-5 ${activeTab === 'upload' ? 'text-blue-600' : 'text-slate-400'}`} />
                                Excel
                            </div>
                            {activeTab === 'upload' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                        </button>

                        <button
                            onClick={() => navigate('/admin/products/photo-intake')}
                            className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent transition-all duration-200"
                        >
                            <div className="flex items-center gap-3">
                                <Camera className="w-5 h-5 text-slate-400" />
                                Por foto
                            </div>
                        </button>
                    </nav>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
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

                </div>

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
