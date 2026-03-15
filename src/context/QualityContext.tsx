"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { QualityEntry } from "../types";

interface QualityContextType {
  qualities: QualityEntry[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastUpdated: Date | null;
}

const QualityContext = createContext<QualityContextType | undefined>(undefined);

export const useQualityContext = () => {
  const context = useContext(QualityContext);
  if (context === undefined) {
    throw new Error("useQualityContext must be used within a QualityProvider");
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/quality", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("No se pudieron cargar los mensajes de cualidades.");
      }

      const data: { qualities?: QualityEntry[] } = await response.json();
      setQualities(data.qualities ?? []);
      setLastUpdated(new Date());
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "No se pudieron cargar los mensajes de cualidades.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const value = useMemo(
    () => ({ qualities, loading, error, refetch, lastUpdated }),
    [qualities, loading, error, refetch, lastUpdated]
  );

  return <QualityContext.Provider value={value}>{children}</QualityContext.Provider>;
};
