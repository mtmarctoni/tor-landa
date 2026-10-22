"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  browserRecorderDependencies,
  createVoiceRecorder,
  type RecorderSnapshot,
  type VoiceRecorderController,
} from "@/features/shoebox/client/recorder";

const IDLE: RecorderSnapshot = { state: "idle" };
const noSubscription = () => () => {};
const idleSnapshot = () => IDLE;

const ACTIVE = new Set<RecorderSnapshot["state"]>([
  "requesting",
  "recording",
  "stopping",
]);

/**
 * React adapter for the recorder controller. The controller is created after
 * mount (never during render or on the server) and disposed on unmount, which
 * stops any capture and revokes the preview URL. No network or saving here.
 */
export function useVoiceRecorder({
  onActiveChange,
}: {
  onActiveChange?: (active: boolean) => void;
} = {}) {
  const [controller, setController] = useState<VoiceRecorderController | null>(
    null,
  );

  useEffect(() => {
    const created = createVoiceRecorder(browserRecorderDependencies());
    setController(created);
    return () => created.dispose();
  }, []);

  const snapshot = useSyncExternalStore(
    controller ? controller.subscribe : noSubscription,
    controller ? controller.getSnapshot : idleSnapshot,
    idleSnapshot,
  );

  const active = ACTIVE.has(snapshot.state);
  const callback = useRef(onActiveChange);
  useEffect(() => {
    callback.current = onActiveChange;
  });
  useEffect(() => {
    callback.current?.(active);
  }, [active]);
  useEffect(() => () => callback.current?.(false), []);

  return {
    snapshot,
    ready: controller !== null,
    start: () => controller?.start() ?? Promise.resolve(),
    stop: () => controller?.stop() ?? Promise.resolve(),
    discard: () => controller?.discard(),
  };
}
