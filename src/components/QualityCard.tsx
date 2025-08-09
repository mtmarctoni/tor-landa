"use client"

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { QualityEntry } from '../types';
import { Star } from 'lucide-react';

import { qualityColorCombos } from '@/utils/qualityColorCombos';

interface QualityCardProps {
    entry: QualityEntry;
    isLatest: boolean;
}

const QualityCard: React.FC<QualityCardProps> = ({ entry }) => {
    const [isHovered, setIsHovered] = useState(false);

    // Deterministic random color based on week/year
    const colorIndex = ((entry.week ?? 0) + (entry.year ?? 0)) % qualityColorCombos.length;
    const color = qualityColorCombos[colorIndex];


    return (
        <motion.div
            className={`relative flex flex-col items-center justify-center overflow-hidden border-2 transition-all duration-500 animate-blob-morph
            ${color.border} ${color.shadow} ${color.bg} rounded-[60%_40%_30%_70%/60%_30%_70%_40%]`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.05 }}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            style={{ minHeight: '320px', minWidth: '320px', boxShadow: '0 0 64px 0 #a78bfa55, 0 8px 32px 0 #38bdf855' }}
        >
            <div className="p-8 relative z-10 flex flex-col items-center justify-center">
                {isHovered && (
                    <motion.div
                        className="absolute inset-0 pointer-events-none z-30"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <motion.div
                            className="absolute top-4 right-4 text-dream-200 z-40"
                            animate={{
                                rotate: [0, 360],
                                scale: [1, 1.2, 1]
                            }}
                            transition={{
                                duration: 20,
                                repeat: Infinity,
                                ease: "linear"
                            }}
                        >
                            <Star size={40} />
                        </motion.div>
                        <motion.div
                            className="absolute bottom-4 left-4 text-dream-800 z-40"
                            animate={{
                                rotate: [0, 360],
                                scale: [1, 1.2, 1]
                            }}
                            transition={{
                                duration: 20,
                                repeat: Infinity,
                                ease: "linear"
                            }}
                        >
                            <Star size={40} />
                        </motion.div>
                    </motion.div>
                )}

                <div className="mb-6 relative">
                    <h2 className="text-3xl text-center font-serif text-dream-700 italic drop-shadow-[0_2px_8px_#38bdf8cc]">
                        Semana {entry.week} / {entry.year}
                    </h2>
                    <div className="h-0.5 w-80 bg-gradient-to-r from-dream-400 via-dream-200 to-dream-600 rounded mt-2 mx-auto"></div>
                </div>

                <motion.div
                    className="flex flex-col items-center justify-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <span className="text-dream-800 text-xl leading-relaxed drop-shadow-[0_1px_4px_#0ea5e955] text-center">
                        {entry.message}
                    </span>
                </motion.div>
            </div>
        </motion.div>
    );
};

export default QualityCard;
