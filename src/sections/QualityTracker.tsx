"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Copy, Dice5, RefreshCcw, SkipBack, SkipForward } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import BirthdayConfetti from "@/components/BirthdayConfetti";
import BirthdayCountdown from "@/components/BirthdayCountdown";
import BirthdayGalleryModal from "@/components/BirthdayGalleryModal";
import BirthdaySecretModal from "@/components/BirthdaySecretModal";
import HistoryButton from "@/components/HistoryButton";
import { getDialogOwnershipVersion } from "@/components/JournalDialog";
import LoadingQuality from "@/components/LoadingQuality";
import NoQualityInPast from "@/components/NoQualityInPast";
import QualityCard from "@/components/QualityCard";
import StatusState from "@/components/StatusState";
import WaitingForBirthday from "@/components/WaitingForBirthday";
import WaitingForQuality from "@/components/WaitingForQuality";
import { useQualityContext } from "@/context/QualityContext";
import { useWeekNavigator } from "@/hooks/useWeekNavigator";
import {
  getCurrentWeekAndYear,
  getLandaBirthdayWeek,
  isLandaBirthday,
  isLandaBirthdayWeek,
} from "@/utils/dateFormatter";

const QualityTracker: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const { qualities, loading, error, refetch, lastUpdated } =
    useQualityContext();
  const { week: currentWeek, year: currentYear } = getCurrentWeekAndYear();
  const {
    week,
    year,
    direction,
    isCurrentWeek,
    goToCurrentWeek,
    goToWeek,
    goToPreviousWeek,
    goToNextWeek,
    goToRandomSavedWeek,
  } = useWeekNavigator(qualities);
  const [copyStatus, setCopyStatus] = useState<"idle" | "done" | "error">(
    "idle",
  );
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const galleryHandoffTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    return () => {
      if (galleryHandoffTimer.current !== null) {
        clearTimeout(galleryHandoffTimer.current);
        galleryHandoffTimer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (copyStatus === "idle") return;
    const timer = window.setTimeout(() => setCopyStatus("idle"), 2200);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  const isBirthdayWeek = isLandaBirthdayWeek(week, year);
  const isBirthdayToday = isLandaBirthday();
  const currentQuality =
    qualities.find((q) => q.week === week && q.year === year) || null;
  const isPast =
    year < currentYear || (year === currentYear && week < currentWeek);
  const birthdayWeek = getLandaBirthdayWeek(year);
  const isWeek43BeforeBirthday =
    week === birthdayWeek.week && year === birthdayWeek.year && !isBirthdayWeek;
  const canCopy =
    !loading &&
    !error &&
    !isWeek43BeforeBirthday &&
    Boolean(currentQuality?.message);

  const sortedAvailableWeeks = useMemo(
    () =>
      [...qualities]
        .sort((a, b) => (a.year === b.year ? a.week - b.week : a.year - b.year))
        .slice(-6),
    [qualities],
  );

  const handlePasswordSuccess = () => {
    if (galleryHandoffTimer.current !== null || showGalleryModal) return;
    const ownershipVersion = getDialogOwnershipVersion();
    setShowSecretModal(false);
    galleryHandoffTimer.current = setTimeout(() => {
      galleryHandoffTimer.current = null;
      // The user's newer surprise request wins; never cover it or reopen the
      // gallery after it has already been dismissed.
      if (getDialogOwnershipVersion() !== ownershipVersion) return;
      setShowGalleryModal(true);
    }, 280);
  };

  const handleSecretOpen = () => {
    // Closing the secret restores its hint before the gallery opens. Keep that
    // focus restoration, but don't allow a second modal during the handoff.
    if (galleryHandoffTimer.current !== null || showGalleryModal) return;
    setShowSecretModal(true);
  };

  const handleCopyMessage = async () => {
    if (!canCopy || !currentQuality) return;
    const content = `Semana ${week} / ${year}\n\n${currentQuality.message}`;
    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus("done");
    } catch {
      setCopyStatus("error");
    }
  };

  return (
    <motion.section
      className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col"
      initial={false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      aria-label="Seguimiento de cualidades por semana"
    >
      {(isBirthdayWeek || isBirthdayToday) && <BirthdayConfetti />}
      <div className="surface-card mb-4 flex flex-col gap-4 sm:mb-6 sm:gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="journal-eyebrow">Semana seleccionada</p>
            <span data-testid="week-context" aria-live="polite">
              Semana {week} / {year}
            </span>
          </div>
          <button
            type="button"
            onClick={goToCurrentWeek}
            disabled={isCurrentWeek}
            className="control-pill inline-flex items-center gap-2 border"
          >
            <RefreshCcw size={16} aria-hidden="true" />
            Volver al presente
          </button>
        </div>

        <div className="relative flex w-full items-center py-2">
          {loading ? (
            <LoadingQuality />
          ) : error ? (
            <StatusState
              icon=""
              title="No se pudieron cargar los mensajes"
              description={error}
              actionLabel="Reintentar"
              onAction={refetch}
              tone="danger"
            />
          ) : isWeek43BeforeBirthday ? (
            <WaitingForBirthday />
          ) : !currentQuality ? (
            isPast ? (
              <NoQualityInPast />
            ) : (
              <WaitingForQuality />
            )
          ) : (
            <motion.div
              key={`${week}-${year}`}
              initial={
                reduceMotion
                  ? false
                  : {
                      x: direction === 1 ? 12 : direction === -1 ? -12 : 0,
                      opacity: 1,
                    }
              }
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction === 1 ? -180 : 180, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="w-full"
            >
              <QualityCard
                entry={currentQuality}
                onSecretClick={handleSecretOpen}
              />
            </motion.div>
          )}
        </div>

        <nav
          aria-label="Navegar entre semanas"
          className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
        >
          <button
            type="button"
            onClick={goToPreviousWeek}
            className="control-pill inline-flex items-center gap-2 border"
            aria-label="Semana anterior"
          >
            <SkipBack size={18} aria-hidden="true" /> Semana anterior
          </button>
          <button
            type="button"
            onClick={goToNextWeek}
            className="control-pill inline-flex items-center gap-2 border"
            aria-label="Semana siguiente"
          >
            Semana siguiente <SkipForward size={18} aria-hidden="true" />
          </button>
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={goToRandomSavedWeek}
            disabled={loading || Boolean(error) || qualities.length === 0}
            className="control-pill inline-flex items-center gap-2 border"
          >
            <Dice5 size={16} aria-hidden="true" /> Semana aleatoria
          </button>
          <button
            type="button"
            onClick={handleCopyMessage}
            disabled={!canCopy}
            className="control-pill inline-flex items-center gap-2 border"
          >
            <Copy size={16} aria-hidden="true" /> Copiar mensaje
          </button>
          <HistoryButton />
        </div>
        <p
          role="status"
          aria-label="Estado de copia"
          aria-live="polite"
          aria-atomic="true"
          className="journal-copy-status"
        >
          {copyStatus === "done"
            ? "Mensaje copiado al portapapeles."
            : copyStatus === "error"
              ? "No se pudo copiar el mensaje. Inténtalo otra vez."
              : ""}
        </p>

        <details className="journal-details">
          <summary>Detalles de la semana</summary>
          <div className="flex flex-col items-start gap-4 py-4">
            <p className="text-sm text-dream-600">
              Semana {week} de {year}
            </p>
            {sortedAvailableWeeks.length > 0 && (
              <div>
                <p className="journal-eyebrow mb-2">
                  Últimos registros · Atajos guardados
                </p>
                <div className="flex flex-wrap gap-2">
                  {sortedAvailableWeeks.map((entry) => (
                    <button
                      type="button"
                      key={`${entry.year}-${entry.week}`}
                      onClick={() => goToWeek(entry.week, entry.year)}
                      className="control-pill border"
                      aria-label={`Semana ${entry.week} del ${entry.year}`}
                      title={entry.message}
                    >
                      {entry.week}/{entry.year}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={refetch}
              disabled={loading}
              className="control-pill inline-flex items-center gap-2 border"
            >
              <RefreshCcw size={16} aria-hidden="true" /> Recargar datos
            </button>
            <p className="text-xs text-dream-600">
              {lastUpdated
                ? `Actualizado: ${lastUpdated.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`
                : "Sincronizando datos..."}
            </p>
          </div>
        </details>
      </div>
      <BirthdayCountdown />
      <BirthdaySecretModal
        isOpen={showSecretModal}
        onClose={() => setShowSecretModal(false)}
        onSuccess={handlePasswordSuccess}
      />
      <BirthdayGalleryModal
        isOpen={showGalleryModal}
        onClose={() => setShowGalleryModal(false)}
      />
    </motion.section>
  );
};

export default QualityTracker;
