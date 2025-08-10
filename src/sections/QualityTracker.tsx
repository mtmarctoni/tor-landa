"use client";

import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

import QualityCard from '@/components/QualityCard';
import WaitingForQuality from '@/components/WaitingForQuality';
import LoadingQuality from '@/components/LoadingQuality';
import NoQualityInPast from '@/components/NoQualityInPast';
import { getCurrentWeekAndYear } from '@/utils/dateFormatter';
import { useQualityContext } from '@/context/QualityContext';

const QualityTracker: React.FC = () => {
    const { qualities, loading, error } = useQualityContext();
    const { week: currentWeek, year: currentYear } = getCurrentWeekAndYear();
    const [week, setWeek] = useState(currentWeek);
    const [year, setYear] = useState(currentYear);
    const [direction, setDirection] = useState(0); // -1 for prev, 1 for next
    const cardRef = useRef<HTMLDivElement>(null);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'ArrowRight') handleNext();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    });

    const handlePrev = () => {
        setDirection(-1);
        if (week > 1) {
            setWeek(week - 1);
        } else {
            setYear(year - 1);
            setWeek(52); // or 53, but 52 is safer for most years
        }
    };

    const handleNext = () => {
        setDirection(1);
        if (week < 53) {
            setWeek(week + 1);
        } else {
            setYear(year + 1);
            setWeek(1);
        }
    };

    const currentQuality = qualities.find(q => q.week === week && q.year === year) || null;
    const isPast = year < currentYear || (year === currentYear && week < currentWeek);

    // Progress bar for the year
    const progress = Math.min(week / 52, 1);

    return (
        <motion.div
            className="max-w-3xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
        >
            <div className="flex flex-col gap-2 mb-6">
                <div className="flex justify-between items-center">
                    <button
                        onClick={handlePrev}
                        className="px-4 py-2 bg-dream-200 text-dream-800 rounded-full shadow hover:bg-dream-300 transition-colors"
                    >
                        ← Semana anterior
                    </button>
                    <span className="text-lg text-dream-700 font-semibold">Semana {week} / {year}</span>
                    <button
                        onClick={handleNext}
                        className="px-4 py-2 bg-dream-200 text-dream-800 rounded-full shadow hover:bg-dream-300 transition-colors"
                    >
                        Siguiente semana →
                    </button>
                </div>
                {/* Progress bar */}
                <div className="w-full h-3 bg-dream-100 rounded-full overflow-hidden shadow-inner">
                    <motion.div
                        className="h-full bg-gradient-to-r from-dream-400 via-dream-200 to-dream-600"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress * 100}%` }}
                        transition={{ duration: 0.5 }}
                    />
                </div>
                <div className="flex justify-between text-xs text-dream-400 px-1">
                    <span>Inicio</span>
                    <span>Fin</span>
                </div>
            </div>
            <div className="relative min-h-[350px] flex items-center justify-center">
                {loading && <LoadingQuality />}
                {error && <div className="text-center text-red-500 py-8">{error}</div>}
                {!loading && !error && !currentQuality && isPast && <NoQualityInPast />}
                {!loading && !error && !currentQuality && !isPast && <WaitingForQuality />}
                {!loading && !error && currentQuality && (
                    <motion.div
                        key={`${week}-${year}`}
                        ref={cardRef}
                        initial={{ x: direction === 1 ? 200 : direction === -1 ? -200 : 0, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: direction === 1 ? -200 : 200, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="w-full"
                    >
                        <QualityCard entry={currentQuality} isLatest={true} />
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
};

export default QualityTracker;
