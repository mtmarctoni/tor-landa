import React from 'react';
import { motion } from 'framer-motion';
import { Gift, Sparkles, Calendar } from 'lucide-react';

const WaitingForBirthday: React.FC = () => {
    return (
        <motion.div
            className="flex flex-col items-center justify-center py-16 px-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7 }}
        >
            <motion.div
                animate={{ 
                    rotate: [0, -10, 10, -10, 0],
                    scale: [1, 1.1, 1, 1.1, 1]
                }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                className="mb-6"
            >
                <Gift className="w-24 h-24 text-rose-500" strokeWidth={1.5} />
            </motion.div>

            <h2 className="text-3xl font-bold text-rose-700 mb-4 text-center flex items-center gap-2">
                <Sparkles className="w-8 h-8 text-amber-400" />
                Algo especial se acerca...
                <Sparkles className="w-8 h-8 text-amber-400" />
            </h2>

            <motion.div
                className="flex items-center gap-2 bg-gradient-to-r from-rose-100 to-pink-100 px-6 py-3 rounded-full shadow-lg"
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            >
                <Calendar className="w-5 h-5 text-rose-600" />
                <span className="text-rose-700 font-semibold">
                    Vuelve el 23 de octubre
                </span>
            </motion.div>

            <motion.div
                className="mt-8 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 1 }}
            >
                <p className="text-sm text-dream-500 italic">
                    Puede que los mensajes perdidos vuelvan este día...
                </p>
            </motion.div>
        </motion.div>
    );
};

export default WaitingForBirthday;
