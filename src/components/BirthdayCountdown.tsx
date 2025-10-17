"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Cake } from 'lucide-react';
import { getDaysUntilLandaBirthday, isLandaBirthday } from '@/utils/dateFormatter';

const BirthdayCountdown: React.FC = () => {
    const daysUntil = getDaysUntilLandaBirthday();
    const isToday = isLandaBirthday();

    if (daysUntil > 30 && !isToday) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-4"
        >
            <motion.div
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-100 via-pink-100 to-amber-100 
                           rounded-full shadow-lg border-2 border-rose-300"
                animate={{
                    scale: isToday ? [1, 1.05, 1] : 1,
                }}
                transition={{
                    duration: 1,
                    repeat: isToday ? Infinity : 0,
                }}
            >
                <Cake className="text-rose-500" size={20} />
                <span className="text-sm font-semibold text-rose-700">
                    {isToday 
                        ? "🎉 ¡Hoy es el cumpleaños de Landa! 🎉"
                        : `${daysUntil} ${daysUntil === 1 ? 'día' : 'días'} para el cumpleaños de Landa`
                    }
                </span>
            </motion.div>
        </motion.div>
    );
};

export default BirthdayCountdown;
