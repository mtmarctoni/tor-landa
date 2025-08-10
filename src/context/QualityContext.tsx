"use client"

import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { QualityEntry } from '../types';

interface QualityContextType {
    qualities: QualityEntry[];
    loading: boolean;
    error: string | null;
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
    const [qualities, setQualities] = useState<QualityEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAllQualities = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch('/api/quality');
                if (!res.ok) {
                    throw new Error('Failed to fetch quality messages.');
                }
                const data = await res.json();
                setQualities(data.qualities || []);

                // eslint-disable-next-line
            } catch (error: any) {
                setError(error.message || 'Failed to fetch quality messages.');
            } finally {
                setLoading(false);
            }
        };
        fetchAllQualities();
    }, []);

    return (
        <QualityContext.Provider value={{ qualities, loading, error }}>
            {children}
        </QualityContext.Provider>
    );
};
