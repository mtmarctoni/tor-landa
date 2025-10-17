"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Star, Sparkles } from 'lucide-react';

const BirthdayConfetti: React.FC = () => {
    const confettiItems = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        Icon: [Heart, Star, Sparkles][i % 3],
        delay: Math.random() * 2,
        duration: 3 + Math.random() * 2,
        x: Math.random() * 100,
    }));

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
            {confettiItems.map(({ id, Icon, delay, duration, x }) => (
                <motion.div
                    key={id}
                    className="absolute"
                    initial={{ 
                        top: '-10%', 
                        left: `${x}%`,
                        opacity: 0,
                        rotate: 0,
                        scale: 0
                    }}
                    animate={{ 
                        top: '110%',
                        opacity: [0, 1, 1, 0],
                        rotate: 360,
                        scale: [0, 1, 1, 0.5]
                    }}
                    transition={{
                        duration,
                        delay,
                        repeat: Infinity,
                        ease: 'linear'
                    }}
                >
                    <Icon 
                        size={24} 
                        className="text-rose-400 drop-shadow-[0_0_8px_#f87171]"
                    />
                </motion.div>
            ))}
        </div>
    );
};

export default BirthdayConfetti;
