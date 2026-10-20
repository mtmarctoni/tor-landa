"use client";

import { ArrowDownAZ, Download, Search } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useQualityContext } from "@/context/QualityContext";
import type { QualityEntry } from "@/types/index";
import { format } from "@/utils/dateFormatter";

const MessageHistory: React.FC = () => {
  const { qualities, loading, error, refetch } = useQualityContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterYear, setFilterYear] = useState<number | "">("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const sortedQualities = [...qualities].sort(
    (a: QualityEntry, b: QualityEntry) => {
      if (a.year !== b.year)
        return sortOrder === "oldest" ? a.year - b.year : b.year - a.year;
      return sortOrder === "oldest" ? a.week - b.week : b.week - a.week;
    },
  );

  // Filter qualities based on search and year filter
  const filteredQualities = sortedQualities.filter((quality) => {
    const matchesSearch =
      searchQuery === "" ||
      quality.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesYear = filterYear === "" || quality.year === filterYear;
    return matchesSearch && matchesYear;
  });

  // Get unique years for filter dropdown
  const availableYears = Array.from(
    new Set(sortedQualities.map((q) => q.year)),
  ).sort((a, b) => b - a);

  // Get week date range (approximate)
  const getWeekDateRange = (week: number, year: number) => {
    const januaryFirst = new Date(year, 0, 1);
    const daysToFirstWeek = (7 - januaryFirst.getDay()) % 7;
    const firstWeek = new Date(year, 0, 1 + daysToFirstWeek);
    const weekStart = new Date(
      firstWeek.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000,
    );
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);

    return {
      start: format(weekStart),
      end: format(weekEnd),
    };
  };

  const exportAsJson = () => {
    const dataStr = JSON.stringify(filteredQualities, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    const exportFileDefaultName = "cualidades-historia.json";

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  const exportAsText = () => {
    const textData = filteredQualities
      .map((q) => {
        const dateRange = getWeekDateRange(q.week, q.year);
        return `Semana ${q.week}, ${q.year} (${dateRange.start} - ${dateRange.end})\n${q.message}\n\n---\n`;
      })
      .join("\n");

    const dataUri = `data:text/plain;charset=utf-8,${encodeURIComponent(textData)}`;
    const exportFileDefaultName = "cualidades-historia.txt";

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  if (!loading && error) {
    return (
      <div className="archive-state" role="alert">
        <h2>No se pudo cargar la historia</h2>
        <p>{error}</p>
        <button
          type="button"
          className="archive-button"
          onClick={() => void refetch()}
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!loading && sortedQualities.length === 0) {
    return (
      <div className="archive-state">
        <h2>Todavía no hay recuerdos</h2>
        <p>Este pequeño archipiélago espera su primera historia.</p>
        <button
          type="button"
          className="archive-button"
          onClick={() => void refetch()}
        >
          Volver a cargar
        </button>
      </div>
    );
  }

  return (
    <div className="archive-collection">
      <section className="archive-tools" aria-label="Explorar recuerdos">
        <div className="archive-tool-grid">
          <div className="archive-search">
            <label htmlFor="archive-search">Buscar en mensajes</label>
            <div className="archive-search-field">
              <Search aria-hidden="true" size={20} />
              <input
                disabled={loading}
                id="archive-search"
                type="text"
                placeholder="Una palabra, una pequeña puerta…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="archive-year">
            <label htmlFor="archive-year">Año</label>
            <select
              disabled={loading}
              id="archive-year"
              value={filterYear}
              onChange={(e) =>
                setFilterYear(
                  e.target.value === "" ? "" : parseInt(e.target.value, 10),
                )
              }
            >
              <option value="">Todos los años</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="archive-sort">
            <span aria-hidden="true">Orden del viaje</span>
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                setSortOrder((prev) =>
                  prev === "newest" ? "oldest" : "newest",
                )
              }
              className="archive-button"
              title="Cambiar orden"
            >
              <ArrowDownAZ aria-hidden="true" size={16} />
              {sortOrder === "newest" ? "Reciente" : "Antiguo"}
            </button>
          </div>
        </div>

        <div className="archive-tool-footer">
          <p
            className="archive-count"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {loading
              ? "Reuniendo recuerdos…"
              : `${filteredQualities.length} de ${sortedQualities.length} cualidades`}
            {searchQuery && (
              <span> · Filtrado por: &ldquo;{searchQuery}&rdquo;</span>
            )}
            {filterYear && <span> · Año: {filterYear}</span>}
          </p>
          {(searchQuery || filterYear) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setFilterYear("");
              }}
              className="archive-button"
            >
              Limpiar filtros
            </button>
          )}
          <fieldset
            className="archive-exports"
            aria-label="Guardar recuerdos filtrados"
          >
            <span>Llevar contigo</span>
            <button
              type="button"
              disabled={loading}
              onClick={exportAsJson}
              className="archive-button"
              title="Exportar como JSON"
            >
              <Download aria-hidden="true" size={16} />
              JSON
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={exportAsText}
              className="archive-button"
              title="Exportar como texto"
            >
              <Download aria-hidden="true" size={16} />
              TXT
            </button>
          </fieldset>
        </div>
      </section>

      {/* Message List */}
      <div className="archive-islands">
        {loading && (
          <div
            className="memory-island archive-loading-island"
            aria-hidden="true"
          >
            <span className="memory-moon" />
            <header className="memory-heading">
              <span className="memory-week">…</span>
              <div>
                <h2 className="archive-loading-line">&nbsp;</h2>
                <div className="memory-date archive-loading-line">&nbsp;</div>
              </div>
            </header>
            <p className="archive-loading-line">&nbsp;</p>
          </div>
        )}
        {!loading &&
          filteredQualities.map((quality) => {
            const dateRange = getWeekDateRange(quality.week, quality.year);

            return (
              <article
                key={`${quality.year}-${quality.week}`}
                aria-label={`Semana ${quality.week} del ${quality.year}`}
                className="memory-island"
              >
                <span className="memory-moon" aria-hidden="true" />
                <header className="memory-heading">
                  <span className="memory-week" aria-hidden="true">
                    {String(quality.week).padStart(2, "0")}
                  </span>
                  <div>
                    <h2>
                      Semana {quality.week}, {quality.year}
                    </h2>
                    <div className="memory-date">
                      {dateRange.start} - {dateRange.end}
                    </div>
                  </div>
                </header>
                <p>{quality.message}</p>
                <span className="memory-stair" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </article>
            );
          })}
      </div>

      {/* No results message */}
      {filteredQualities.length === 0 && (searchQuery || filterYear) && (
        <div className="archive-state">
          <h2>Ningún recuerdo coincide</h2>
          <p>
            Prueba otra palabra o usa «Limpiar filtros» para volver a todas las
            islas.
          </p>
        </div>
      )}
    </div>
  );
};

export default MessageHistory;
