import React from 'react';

/**
 * SurrealistContainer - a reusable container for surrealist, dreamy UI.
 * Usage: Wrap your content/components with <SurrealistContainer> ... </SurrealistContainer>
 */
import { ReactNode } from 'react';
import type { BaseComponentProps } from '@/types/components';

const SurrealistContainer = ({ children, className = '' }: BaseComponentProps) => (
    <div
        className={`relative overflow-hidden p-8 md:p-12 bg-surreal-gradient shadow-surreal backdrop-blur-md border border-white/20 animate-blob-morph rounded-[60%_40%_30%_70%/60%_30%_70%_40%] ${className}`}
        style={{ minHeight: '320px', minWidth: '320px' }}
    >
        {/* Floating blobs for extra surrealism */}
        <div className="absolute top-[-60px] left-[-60px] w-48 h-48 bg-blob-blue opacity-60 blur-2xl animate-drift rounded-[30%_60%_70%_40%/50%_60%_30%_60%] z-0" />
        <div className="absolute bottom-[-40px] right-[-40px] w-40 h-40 bg-blob-cyan opacity-50 blur-2xl animate-float rounded-[50%_50%_70%_30%/60%_40%_60%_40%] z-0" />
        <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-blob-purple opacity-40 blur-2xl animate-spin-slow rounded-full z-0" style={{ transform: 'translate(-50%, -50%)' }} />
        <div className="relative z-10">
            {children}
        </div>
    </div>
);

export default SurrealistContainer;
