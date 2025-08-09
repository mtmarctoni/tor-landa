"use client"

import React from 'react';
import { Cloud, Moon, Star } from 'lucide-react';
import { motion } from 'framer-motion';

const Header: React.FC = () => {
    return (
        <header className="py-8 px-4 bg-gradient-to-r from-dream-900/10 to-dream-700/10 backdrop-blur-lg border-b border-dream-200 sticky top-0 z-10 overflow-hidden">
            <div className="container mx-auto flex items-center justify-center relative">
                <motion.div
                    className="absolute top-0 right-4 text-dream-400"
                    animate={{
                        y: [0, -10, 0],
                        rotate: [0, 5, 0]
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                >
                    <Moon size={24} />
                </motion.div>

                <motion.div
                    className="absolute bottom-0 left-8 text-dream-300"
                    animate={{
                        x: [0, 10, 0],
                        y: [0, 5, 0]
                    }}
                    transition={{
                        duration: 5,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                >
                    <Cloud size={20} />
                </motion.div>

                <motion.div
                    className="absolute top-2 left-4 text-dream-500"
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 1, 0.5]
                    }}
                    transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                >
                    <Star size={16} />
                </motion.div>

                <h1 className="text-4xl md:text-5xl font-serif text-dream-800 tracking-tight italic">
                    Cualidades de Landa
                </h1>
            </div>
        </header>
    );
};

export default Header;
