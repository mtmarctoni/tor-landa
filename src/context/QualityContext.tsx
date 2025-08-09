"use client"

import React, { createContext, useContext, ReactNode } from 'react';
import { QualityEntry } from '../types';

interface QualityContextType {
    qualities: QualityEntry[];
}

const QualityContext = createContext<QualityContextType | undefined>(undefined);

export const useQualityContext = () => {
    const context = useContext(QualityContext);
    if (context === undefined) {
        throw new Error('useQualityContext must be used within a QualityProvider');
    }
    return context;
};

interface QualityProviderProps {
    children: ReactNode;
}

export const QualityProvider: React.FC<QualityProviderProps> = ({ children }) => {
    // In a real application, you might fetch this from an API or local storage
    // For now, we're using sample data
    const qualities: QualityEntry[] = [];

    return (
        <QualityContext.Provider value={{ qualities }}>
            {children}
        </QualityContext.Provider>
    );
};
