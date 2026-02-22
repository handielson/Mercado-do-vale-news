import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

interface Step {
    label: string;
    path: string;
    done?: boolean;
}

interface NextStepBannerProps {
    /** Passos do fluxo completo — use done=true para os já concluídos */
    steps: Step[];
    /** Índice do passo atual (0-based) */
    currentStep: number;
    /** Texto personalizado antes do botão. Padrão: "Tudo certo aqui?" */
    message?: string;
}

/**
 * Banner de navegação do fluxo de cadastro.
 * Exibe o progresso visual do fluxo e um botão para ir ao próximo passo.
 *
 * Fluxo padrão:  Categoria → Marca → Modelo → Produto
 */
export function NextStepBanner({ steps, currentStep, message }: NextStepBannerProps) {
    const navigate = useNavigate();
    const next = steps[currentStep + 1];

    if (!next) return null;

    return (
        <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
            {/* Linha de progresso */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
                {steps.map((step, i) => {
                    const isCompleted = i < currentStep || step.done;
                    const isCurrent = i === currentStep;
                    const isNext = i === currentStep + 1;
                    const isFuture = i > currentStep + 1;

                    return (
                        <React.Fragment key={step.path}>
                            {/* Step pill */}
                            <button
                                type="button"
                                onClick={() => !isFuture && navigate(step.path)}
                                disabled={isFuture}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all
                                    ${isCompleted
                                        ? 'bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer'
                                        : isCurrent
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : isNext
                                                ? 'bg-white border border-blue-300 text-blue-600 hover:bg-blue-50 cursor-pointer'
                                                : 'bg-slate-100 text-slate-400 cursor-default'
                                    }`}
                            >
                                {isCompleted && <CheckCircle2 size={12} />}
                                {step.label}
                            </button>

                            {/* Seta separadora */}
                            {i < steps.length - 1 && (
                                <ArrowRight size={14} className="text-slate-300 shrink-0" />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Ação */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm text-slate-600">
                    {message ?? 'Tudo certo aqui?'}{' '}
                    <span className="font-medium text-slate-800">
                        Próximo passo: {next.label}
                    </span>
                </p>
                <button
                    type="button"
                    onClick={() => navigate(next.path)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm shrink-0"
                >
                    Ir para {next.label}
                    <ArrowRight size={16} />
                </button>
            </div>
        </div>
    );
}
