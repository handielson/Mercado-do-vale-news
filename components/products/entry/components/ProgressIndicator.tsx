/**
 * PROGRESS INDICATOR Component
 * 
 * Technical: Shows wizard progress (Step 1/3, 2/3, 3/3)
 */

import React from 'react';
import { Check } from 'lucide-react';

interface Step {
    id: string;
    title: string;
    icon: string;
}

interface ProgressIndicatorProps {
    steps: Step[];
    currentStep: number; // 0-indexed
}

export function ProgressIndicator({ steps, currentStep }: ProgressIndicatorProps) {
    return (
        <div className="flex items-center justify-between">
            {steps.map((step, index) => (
                <React.Fragment key={step.id}>
                    {/* Technical: Step circle */}
                    <div className="flex flex-col items-center flex-1">
                        <div
                            className={`
                                w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium
                                ${index < currentStep ? 'bg-green-500 text-white' : ''}
                                ${index === currentStep ? 'bg-blue-500 text-white' : ''}
                                ${index > currentStep ? 'bg-slate-200 text-slate-500' : ''}
                            `}
                        >
                            {index < currentStep ? (
                                <Check size={24} />
                            ) : (
                                <span>{step.icon}</span>
                            )}
                        </div>
                        <span className={`
                            mt-2 text-sm font-medium
                            ${index === currentStep ? 'text-blue-600' : 'text-slate-600'}
                        `}>
                            {step.title}
                        </span>
                    </div>

                    {/* Technical: Connector line */}
                    {index < steps.length - 1 && (
                        <div className={`
                            flex-1 h-1 mx-4
                            ${index < currentStep ? 'bg-green-500' : 'bg-slate-200'}
                        `} />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
}
