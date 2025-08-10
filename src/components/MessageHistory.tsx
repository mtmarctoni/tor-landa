"use client"

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Calendar, User, Download } from 'lucide-react';

import { QualityEntry } from '@/types/index';
import { format } from '@/utils/dateFormatter';
import { useQualityContext } from '@/context/QualityContext';

const MessageHistory: React.FC = () => {
  const { qualities, loading, error } = useQualityContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState<number | ''>('');

  // Sort qualities by year and week ascending (oldest first for chronological order)
  const sortedQualities = [...qualities].sort((a: QualityEntry, b: QualityEntry) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.week - b.week;
  });

  // Filter qualities based on search and year filter
  const filteredQualities = sortedQualities.filter(quality => {
    const matchesSearch = searchQuery === '' ||
      quality.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesYear = filterYear === '' || quality.year === filterYear;
    return matchesSearch && matchesYear;
  });

  // Get unique years for filter dropdown
  const availableYears = Array.from(new Set(sortedQualities.map(q => q.year))).sort((a, b) => b - a);

  // Get week date range (approximate)
  const getWeekDateRange = (week: number, year: number) => {
    const januaryFirst = new Date(year, 0, 1);
    const daysToFirstWeek = (7 - januaryFirst.getDay()) % 7;
    const firstWeek = new Date(year, 0, 1 + daysToFirstWeek);
    const weekStart = new Date(firstWeek.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);

    return {
      start: format(weekStart),
      end: format(weekEnd)
    };
  };

  const exportAsJson = () => {
    const dataStr = JSON.stringify(filteredQualities, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = 'cualidades-historia.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const exportAsText = () => {
    const textData = filteredQualities.map(q => {
      const dateRange = getWeekDateRange(q.week, q.year);
      return `Semana ${q.week}, ${q.year} (${dateRange.start} - ${dateRange.end})\n${q.message}\n\n---\n`;
    }).join('\n');

    const dataUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(textData);
    const exportFileDefaultName = 'cualidades-historia.txt';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <motion.div
          className="text-dream-600 text-lg"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Cargando historia de cualidades...
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 text-lg mb-4">Error al cargar la historia</div>
        <div className="text-dream-600">{error}</div>
      </div>
    );
  }

  if (sortedQualities.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-dream-600 text-lg">No se encontraron cualidades en la historia.</div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="max-w-4xl mx-auto"
    >
      {/* Search and Filter Controls */}
      <div className="bg-dream-50/80 backdrop-blur-sm rounded-2xl p-6 mb-8 shadow-lg border border-dream-200">
        <div className="flex flex-col lg:flex-row gap-4 items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dream-400" size={20} />
            <input
              type="text"
              placeholder="Buscar en mensajes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/70 border border-dream-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-dream-400 focus:border-transparent"
            />
          </div>

          {/* Year Filter */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dream-400" size={20} />
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value === '' ? '' : parseInt(e.target.value))}
              className="pl-10 pr-8 py-3 bg-white/70 border border-dream-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-dream-400 focus:border-transparent"
            >
              <option value="">Todos los años</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-2">
            <button
              onClick={exportAsJson}
              className="flex items-center gap-2 px-4 py-3 bg-dream-200 text-dream-800 rounded-xl hover:bg-dream-300 transition-colors"
              title="Exportar como JSON"
            >
              <Download size={16} />
              JSON
            </button>
            <button
              onClick={exportAsText}
              className="flex items-center gap-2 px-4 py-3 bg-dream-200 text-dream-800 rounded-xl hover:bg-dream-300 transition-colors"
              title="Exportar como texto"
            >
              <Download size={16} />
              TXT
            </button>
          </div>
        </div>

        {/* Results count */}
        <div className="mt-4 text-sm text-dream-600">
          {filteredQualities.length} de {sortedQualities.length} cualidades
          {searchQuery && <span> · Filtrado por: &ldquo;{searchQuery}&rdquo;</span>}
          {filterYear && <span> · Año: {filterYear}</span>}
        </div>
      </div>

      {/* Message List */}
      <div className="space-y-6">
        {filteredQualities.map((quality, index) => {
          const dateRange = getWeekDateRange(quality.week, quality.year);

          return (
            <motion.div
              key={`${quality.year}-${quality.week}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-dream-200 hover:shadow-xl hover:scale-[1.01] transition-all duration-300"
            >
              {/* Message Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                <div className="flex items-center gap-3">
                  <div className="bg-dream-100 p-2 rounded-full">
                    <User className="text-dream-600" size={16} />
                  </div>
                  <div>
                    <div className="font-semibold text-dream-800">
                      Semana {quality.week}, {quality.year}
                    </div>
                    <div className="text-sm text-dream-600">
                      {dateRange.start} - {dateRange.end}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-dream-500">
                  Sistema
                </div>
              </div>

              {/* Message Content */}
              <div className="text-dream-700 leading-relaxed">
                {quality.message}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* No results message */}
      {filteredQualities.length === 0 && (searchQuery || filterYear) && (
        <div className="text-center py-12">
          <div className="text-dream-600 text-lg">
            No se encontraron cualidades con los filtros aplicados.
          </div>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterYear('');
            }}
            className="mt-4 px-6 py-2 bg-dream-200 text-dream-800 rounded-full hover:bg-dream-300 transition-colors"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default MessageHistory;