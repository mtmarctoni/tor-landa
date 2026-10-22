"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { shoeboxFetch } from "@/features/shoebox/client/api";
import {
  type ArchiveSnapshot,
  createMemoryArchive,
  type MemoryArchive,
} from "@/features/shoebox/client/archive-state";

/**
 * React adapter for the single-batch archive controller. It does nothing until
 * asked and is cleared on unmount; nothing about the list is written to
 * browser storage.
 * The host decides when to load (only once the session gate is open).
 */
export function useMemoryArchive({
  onUnauthorized,
}: {
  onUnauthorized(): void;
}): ArchiveSnapshot & Omit<MemoryArchive, "getSnapshot" | "subscribe"> {
  const callback = useRef(onUnauthorized);
  useEffect(() => {
    callback.current = onUnauthorized;
  });
  const [archive] = useState(() =>
    createMemoryArchive({
      fetchJson: (path, signal) => shoeboxFetch(path, { signal }),
      onUnauthorized: () => callback.current(),
    }),
  );
  // Cleared on unmount. Deferred by a tick so React's development
  // double-mount does not abort and repeat the first load.
  const pendingClear = useRef(0);
  useEffect(() => {
    window.clearTimeout(pendingClear.current);
    return () => {
      pendingClear.current = window.setTimeout(archive.clear, 0);
    };
  }, [archive]);

  const snapshot = useSyncExternalStore(
    archive.subscribe,
    archive.getSnapshot,
    archive.getSnapshot,
  );

  return {
    ...snapshot,
    start: archive.start,
    older: archive.older,
    previous: archive.previous,
    refresh: archive.refresh,
    getOne: archive.getOne,
    onSaved: archive.onSaved,
    onCorrected: archive.onCorrected,
    onRemoved: archive.onRemoved,
    clear: archive.clear,
  };
}
