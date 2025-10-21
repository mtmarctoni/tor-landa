"use client"

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { QualityEntry } from '../types';
import { Star, Heart } from 'lucide-react';
import { isLandaBirthdayWeek } from '@/utils/dateFormatter';

import { qualityColorCombos, birthdayColorCombo } from '@/utils/qualityColorCombos';

interface QualityCardProps {
    entry: QualityEntry;
    isLatest: boolean;
    onSecretClick?: () => void;
}

const QualityCard: React.FC<QualityCardProps> = ({ entry, onSecretClick }) => {
    const [isHovered, setIsHovered] = useState(false);
    
    // Check if this is Landa's birthday week
    const isBirthdayWeek = isLandaBirthdayWeek(entry.week, entry.year);

    // Use birthday colors if it's birthday week, otherwise use deterministic random color
    const colorIndex = ((entry.week ?? 0) + (entry.year ?? 0)) % qualityColorCombos.length;
    const color = isBirthdayWeek ? birthdayColorCombo : qualityColorCombos[colorIndex];

    const handleSecretClick = () => {
        if (onSecretClick) {
            onSecretClick();
        }
    };

    // Function to render message with clickable hints
    const renderMessage = (message: string) => {
        if (!isBirthdayWeek) {
            return message;
        }

        // Split by both Berlín and nuestros cuatro números
        const regex = /(Berlín|nuestros cuatro números)/g;
        const parts = message.split(regex);
        
        return parts.map((part, index) => {
            if (part === 'Berlín' || part === 'nuestros cuatro números') {
                return (
                    <motion.span
                        key={index}
                        onClick={handleSecretClick}
                        className="font-bold cursor-pointer relative inline-block"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        style={{
                            background: 'linear-gradient(120deg, #fbbf24 0%, #f59e0b 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            textShadow: '0 0 20px rgba(251, 191, 36, 0.5)',
                        }}
                    >
                        {part}
                        <motion.span
                            className="absolute -top-1 -right-1 text-xs"
                            animate={{
                                rotate: [0, 360],
                                scale: [1, 1.2, 1]
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                            }}
                        >
                            ✨
                        </motion.span>
                    </motion.span>
                );
            }
            return part;
        });
    };


    return (
        <motion.div
            className={`relative flex flex-col items-center justify-center overflow-hidden border-2 transition-all duration-500 animate-blob-morph
            ${color.border} ${color.shadow} ${color.bg} rounded-[60%_40%_30%_70%/60%_30%_70%_40%]`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.05 }}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            style={{ minHeight: '320px', minWidth: '320px', boxShadow: isBirthdayWeek 
                ? '0 0 64px 0 #f8717155, 0 8px 32px 0 #fbbf2455' 
                : '0 0 64px 0 #a78bfa55, 0 8px 32px 0 #38bdf855' 
            }}
        >
            {isBirthdayWeek && (
                <motion.div
                    className="absolute inset-0 pointer-events-none z-20"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    {[...Array(12)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="absolute text-rose-300"
                            style={{
                                left: `${10 + (i * 7)}%`,
                                top: `${5 + (i % 3) * 30}%`,
                            }}
                            animate={{
                                y: [0, -10, 0],
                                rotate: [0, 360],
                                scale: [1, 1.2, 1]
                            }}
                            transition={{
                                duration: 3 + (i * 0.2),
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: i * 0.1
                            }}
                        >
                            {i % 2 === 0 ? <Heart size={20} /> : <Star size={18} />}
                        </motion.div>
                    ))}
                </motion.div>
            )}

            <div className="p-8 relative z-10 flex flex-col items-center justify-center">
                {isHovered && !isBirthdayWeek && (
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
                    {isBirthdayWeek && (
                        <motion.div
                            className="text-4xl mb-2 text-center"
                            animate={{
                                scale: [1, 1.1, 1],
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                            }}
                        >
                            🎂✨🎉
                        </motion.div>
                    )}
                    <h2 className={`text-3xl text-center font-serif ${isBirthdayWeek ? 'text-rose-700' : 'text-dream-700'} italic drop-shadow-[0_2px_8px_#38bdf8cc]`}>
                        {isBirthdayWeek ? '¡Feliz Cumpleaños, Landa!' : `Semana ${entry.week} / ${entry.year}`}
                    </h2>
                    <div className={`h-0.5 w-80 bg-gradient-to-r ${isBirthdayWeek 
                        ? 'from-rose-400 via-pink-300 to-amber-400' 
                        : 'from-dream-400 via-dream-200 to-dream-600'} rounded mt-2 mx-auto`}></div>
                </div>

                <motion.div
                    className="flex flex-col items-center justify-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <span className={`${isBirthdayWeek ? 'text-rose-800' : 'text-dream-800'} text-xl leading-relaxed drop-shadow-[0_1px_4px_#0ea5e955] text-center`}>
                        {renderMessage(entry.message)}
                    </span>
                </motion.div>
            </div>
        </motion.div>
    );
};

export default QualityCard;
