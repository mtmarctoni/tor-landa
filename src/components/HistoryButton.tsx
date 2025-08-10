"use client"

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { History } from 'lucide-react';

const HistoryButton: React.FC = () => {
  return (
    <motion.div
      className="fixed bottom-6 right-6 z-50"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1, duration: 0.4 }}
    >
      <Link href="/history">
        <motion.button
          className="bg-dream-200 hover:bg-dream-300 text-dream-800 p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 border border-dream-300"
          whileHover={{ 
            scale: 1.1,
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
          }}
          whileTap={{ scale: 0.95 }}
          title="Ver historia completa de cualidades"
        >
          <History size={24} />
        </motion.button>
      </Link>
    </motion.div>
  );
};

export default HistoryButton;