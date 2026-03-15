"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, Copy, Dice5, RefreshCcw, SkipBack, SkipForward } from "lucide-react";

import QualityCard from "@/components/QualityCard";
import WaitingForQuality from "@/components/WaitingForQuality";
import WaitingForBirthday from "@/components/WaitingForBirthday";
import LoadingQuality from "@/components/LoadingQuality";
import NoQualityInPast from "@/components/NoQualityInPast";
import BirthdayCountdown from "@/components/BirthdayCountdown";
import BirthdayConfetti from "@/components/BirthdayConfetti";
import BirthdaySecretModal from "@/components/BirthdaySecretModal";
import BirthdayGalleryModal from "@/components/BirthdayGalleryModal";
import {
  getCurrentWeekAndYear,
  getLandaBirthdayWeek,
  isLandaBirthday,
  isLandaBirthdayWeek,
} from "@/utils/dateFormatter";
import { useQualityContext } from "@/context/QualityContext";
import { useWeekNavigator } from "@/hooks/useWeekNavigator";

const QualityTracker: React.FC = () => {
  const { qualities, loading, error, refetch, lastUpdated } = useQualityContext();
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

  const [copyStatus, setCopyStatus] = useState<"idle" | "done" | "error">("idle");

  const [showSecretModal, setShowSecretModal] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);

  const isBirthdayWeek = isLandaBirthdayWeek(week, year);
  const isBirthdayToday = isLandaBirthday();

  const currentQuality = qualities.find((q) => q.week === week && q.year === year) || null;
  const isPast = year < currentYear || (year === currentYear && week < currentWeek);

  const birthdayWeek = getLandaBirthdayWeek(year);
  const isWeek43BeforeBirthday =
    week === birthdayWeek.week && year === birthdayWeek.year && !isBirthdayWeek;

  const progress = Math.min(week / 52, 1);

  const sortedAvailableWeeks = useMemo(
    () =>
      [...qualities]
        .sort((a, b) => (a.year === b.year ? a.week - b.week : a.year - b.year))
        .slice(-6),
    [qualities]
  );

  const handleSecretClick = () => {
    setShowSecretModal(true);
  };

  const handlePasswordSuccess = () => {
    setShowSecretModal(false);
    setTimeout(() => {
      setShowGalleryModal(true);
    }, 280);
  };

  const handleCopyMessage = async () => {
    if (!currentQuality?.message) return;

    const content = `Semana ${week} / ${year}\n\n${currentQuality.message}`;

    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus("done");
    } catch {
      setCopyStatus("error");
    }

    window.setTimeout(() => setCopyStatus("idle"), 2200);
  };

  return (
    <motion.section
      className="relative mx-auto w-full max-w-4xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      aria-label="Seguimiento de cualidades por semana"
    >
      {(isBirthdayWeek || isBirthdayToday) && <BirthdayConfetti />}

      <BirthdayCountdown />

      <div className="surface-card mb-6 flex flex-col gap-4 px-4 py-4 sm:px-6" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={goToPreviousWeek}
              className={`control-pill inline-flex items-center gap-2 font-semibold rounded-full border px-5 py-2
                ${isBirthdayWeek
                  ? "bg-rose-200 text-rose-800 border-rose-300 hover:bg-rose-300 focus:ring-2 focus:ring-rose-400"
                  : "bg-dream-200 text-dream-800 border-dream-300 hover:bg-dream-300 focus:ring-2 focus:ring-dream-400"
                }
                shadow-sm transition-all duration-150 active:scale-95 focus:outline-none focus:ring-offset-1`}
              aria-label="Ir a la semana anterior"
            >
              <SkipBack size={18} aria-hidden="true" />
              Semana anterior
            </button>
            <button
              onClick={goToNextWeek}
              className={`control-pill inline-flex items-center gap-2 font-semibold rounded-full border px-5 py-2
                ${isBirthdayWeek
                  ? "bg-rose-200 text-rose-800 border-rose-300 hover:bg-rose-300 focus:ring-2 focus:ring-rose-400"
                  : "bg-dream-200 text-dream-800 border-dream-300 hover:bg-dream-300 focus:ring-2 focus:ring-dream-400"
                }
                shadow-sm transition-all duration-150 active:scale-95 focus:outline-none focus:ring-offset-1`}
              aria-label="Ir a la semana siguiente"
            >
              Siguiente semana
              <SkipForward size={18} aria-hidden="true" />
            </button>
          </div>

          <span
            className={`rounded-full px-4 py-2 text-sm font-semibold sm:text-base ${
              isBirthdayWeek ? "bg-rose-100 text-rose-700" : "bg-dream-100 text-dream-700"
            }`}
          >
            Semana {week} / {year}
          </span>
        </div>

        <div className="w-full overflow-hidden rounded-full bg-dream-100 shadow-inner" aria-hidden="true">
          <motion.div
            className={`h-2.5 ${
              isBirthdayWeek
                ? "bg-gradient-to-r from-rose-400 via-pink-300 to-amber-400"
                : "bg-gradient-to-r from-dream-400 via-dream-200 to-dream-600"
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.35 }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
<button
             onClick={goToCurrentWeek}
             disabled={isCurrentWeek}
             className="control-pill inline-flex items-center gap-2 font-semibold rounded-full border border-dream-100 bg-dream-50 text-dream-700 hover:bg-dream-100 focus:ring-2 focus:ring-dream-300 focus:outline-none shadow-sm transition-all duration-150 active:scale-95 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 px-5 py-2"
           >
             <RefreshCcw size={16} aria-hidden="true" />
             Ir al presente
           </button>
<button
             onClick={goToRandomSavedWeek}
             disabled={qualities.length === 0}
             className="control-pill inline-flex items-center gap-2 font-semibold rounded-full border border-dream-100 bg-dream-50 text-dream-700 hover:bg-dream-100 focus:ring-2 focus:ring-dream-300 focus:outline-none shadow-sm transition-all duration-150 active:scale-95 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 px-5 py-2"
           >
             <Dice5 size={16} aria-hidden="true" />
             Semana aleatoria
           </button>
<button
             onClick={refetch}
             className="control-pill inline-flex items-center gap-2 font-semibold rounded-full border border-dream-100 bg-dream-50 text-dream-700 hover:bg-dream-100 focus:ring-2 focus:ring-dream-300 focus:outline-none shadow-sm transition-all duration-150 active:scale-95 focus:ring-offset-1 px-5 py-2"
           >
             <RefreshCcw size={16} aria-hidden="true" />
             Recargar datos
           </button>
          {currentQuality && (
<button
               onClick={handleCopyMessage}
               className="control-pill inline-flex items-center gap-2 font-semibold rounded-full border border-dream-100 bg-dream-50 text-dream-700 hover:bg-dream-100 focus:ring-2 focus:ring-dream-300 focus:outline-none shadow-sm transition-all duration-150 active:scale-95 focus:ring-offset-1 px-5 py-2"
             >
               <Copy size={16} aria-hidden="true" />
               Copiar mensaje
             </button>
          )}
        </div>

        {copyStatus === "done" && (
          <p className="text-sm text-dream-700">Mensaje copiado al portapapeles.</p>
        )}
        {copyStatus === "error" && (
          <p className="text-sm text-rose-700">No se pudo copiar el mensaje. Intentalo otra vez.</p>
        )}

        {sortedAvailableWeeks.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-dream-600">
              <Bookmark size={14} aria-hidden="true" />
              Ultimos registros
            </span>
            {sortedAvailableWeeks.map((entry) => (
              <button
                key={`${entry.year}-${entry.week}`}
                onClick={() => goToWeek(entry.week, entry.year)}
                className="rounded-full border border-dream-200 bg-dream-50 px-4 py-1.5 text-sm font-semibold text-dream-700 hover:bg-dream-100 focus:ring-2 focus:ring-dream-300 focus:outline-none shadow-sm transition-all duration-150 active:scale-95 focus:ring-offset-1"
                aria-label={`Semana ${entry.week} del ${entry.year}`}
                title={entry.message}
              >
                {entry.week}/{entry.year}
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-dream-600">
          {lastUpdated
            ? `Actualizado: ${lastUpdated.toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : "Sincronizando datos..."}
        </p>
      </div>

      <div className="relative flex min-h-[360px] items-center justify-center">
        {loading && <LoadingQuality />}

        {error && !loading && (
          <div className="surface-card w-full max-w-2xl px-6 py-8 text-center">
            <h2 className="mb-2 text-2xl font-semibold text-rose-900">No se pudieron cargar los mensajes</h2>
            <p className="mb-6 text-rose-800">{error}</p>
            <button onClick={refetch} className="control-pill font-semibold rounded-full border bg-rose-200 text-rose-900 border-rose-300 hover:bg-rose-300 focus:ring-2 focus:ring-rose-400 shadow-sm transition-all duration-150 active:scale-95 focus:outline-none focus:ring-offset-1 px-5 py-2">
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && isWeek43BeforeBirthday && <WaitingForBirthday />}
        {!loading && !error && !isWeek43BeforeBirthday && !currentQuality && isPast && <NoQualityInPast />}
        {!loading && !error && !isWeek43BeforeBirthday && !currentQuality && !isPast && <WaitingForQuality />}

        {!loading && !error && !isWeek43BeforeBirthday && currentQuality && (
          <motion.div
            key={`${week}-${year}`}
            initial={{ x: direction === 1 ? 180 : direction === -1 ? -180 : 0, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction === 1 ? -180 : 180, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="w-full"
          >
            <QualityCard entry={currentQuality} onSecretClick={handleSecretClick} />
          </motion.div>
        )}
      </div>

      <BirthdaySecretModal
        isOpen={showSecretModal}
        onClose={() => setShowSecretModal(false)}
        onSuccess={handlePasswordSuccess}
      />

      <BirthdayGalleryModal isOpen={showGalleryModal} onClose={() => setShowGalleryModal(false)} />
    </motion.section>
  );
};

export default QualityTracker;
