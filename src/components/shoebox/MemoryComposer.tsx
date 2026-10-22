"use client";

import { Save, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import AudioPicker, { useAudioUpload } from "@/components/shoebox/AudioPicker";
import { PhaseNotice, ReauthPanel } from "@/components/shoebox/ComposerPanels";
import {
  CaptionDateFields,
  localToday,
  MemoryTextField,
  validDate,
} from "@/components/shoebox/MemoryFields";
import PhotoPicker, { usePhotoDraft } from "@/components/shoebox/PhotoPicker";
import JournalDialog from "@/components/shoebox/ShoeboxDialog";
import type { RecordedAudio } from "@/components/shoebox/VoiceRecorder";
import type { SaveDraft } from "@/features/shoebox/client/api";
import { useComposerSave } from "@/features/shoebox/client/useComposerSave";
import {
  MAX_CAPTION_CHARACTERS,
  MAX_TEXT_CHARACTERS,
} from "@/features/shoebox/limits";
import { codePointLength } from "@/features/shoebox/validation";
import type { MemoryKind, MemorySummary } from "@/types/shoebox";

export type MemoryComposerProps = {
  open: boolean;
  sessionValid: boolean;
  onSaved(memory: MemorySummary): boolean | undefined;
  onClose(): void;
  /** A 401 while saving: the session owner ends the session for the page. */
  onUnauthorized(): void;
  onReauthenticate(expiresAt: number): void;
  onRecordingChange?(active: boolean): void;
};

const KINDS: { kind: MemoryKind; label: string }[] = [
  { kind: "photo", label: "Foto" },
  { kind: "audio", label: "Audio" },
  { kind: "text", label: "Texto" },
];
const EXTENSIONS: Record<string, string> = {
  "audio/mp4": "m4a",
  "audio/webm": "weba",
  "audio/ogg": "ogg",
};

/**
 * The one composer dialog. Native labelled inputs, local previews, explicit
 * Save. Discard and reauthentication are inline panels inside the same
 * dialog. The draft lives only in memory: closing it needs confirmation, and
 * nothing is written to browser storage.
 */
export default function MemoryComposer(props: MemoryComposerProps) {
  if (!props.open) return null;
  return <ComposerDialog {...props} />;
}

function ComposerDialog({
  sessionValid,
  onSaved,
  onClose,
  onUnauthorized,
  onReauthenticate,
  onRecordingChange,
}: MemoryComposerProps) {
  const [kind, setKind] = useState<MemoryKind | null>(null);
  const [text, setText] = useState("");
  const [caption, setCaption] = useState("");
  const [memoryDate, setMemoryDate] = useState(localToday);
  const [panel, setPanel] = useState<"discard" | null>(null);
  const [recorded, setRecorded] = useState<RecordedAudio | null>(null);
  const [recording, setRecording] = useState(false);
  const [audioMounted, setAudioMounted] = useState(false);

  const save = useComposerSave({ onSaved, onUnauthorized, sessionValid });
  const photoDraft = usePhotoDraft();
  const audioUpload = useAudioUpload();
  const { phase, locked } = save;
  const { photo } = photoDraft;
  const { upload } = audioUpload;

  const firstKindRef = useRef<HTMLInputElement>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const showReauth = !sessionValid;
  const dirty =
    text !== "" ||
    caption !== "" ||
    photo !== null ||
    upload !== null ||
    recorded !== null ||
    recording ||
    photoDraft.busy ||
    audioUpload.busy ||
    phase.name !== "editing";

  const recordingCallback = useRef(onRecordingChange);
  useEffect(() => {
    recordingCallback.current = onRecordingChange;
  });
  useEffect(() => {
    recordingCallback.current?.(recording);
  }, [recording]);
  useEffect(() => () => recordingCallback.current?.(false), []);

  // Best effort only: mobile browsers may not show this.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (panel === "discard") keepEditingRef.current?.focus();
  }, [panel]);
  const wasReauth = useRef(false);
  useEffect(() => {
    if (showReauth && panel === null) passwordRef.current?.focus();
    // Back from reauthentication: the form is visible again.
    if (wasReauth.current && !showReauth) firstKindRef.current?.focus();
    wasReauth.current = showReauth;
  }, [showReauth, panel]);

  const changed = save.changed;

  function buildDraft(id: string): SaveDraft | null {
    const fields = { caption, memoryDate };
    if (kind === "text")
      return { requestId: id, fields: { kind, text, ...fields } };
    if (kind === "photo" && photo) {
      return { requestId: id, fields: { kind, ...fields }, file: photo.file };
    }
    if (kind === "audio" && recorded) {
      const base = recorded.mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
      const file = new File(
        [recorded.blob],
        `grabacion.${EXTENSIONS[base] ?? "audio"}`,
        {
          type: recorded.mimeType,
        },
      );
      return { requestId: id, fields: { kind, ...fields }, file };
    }
    if (kind === "audio" && upload) {
      return { requestId: id, fields: { kind, ...fields }, file: upload.file };
    }
    return null;
  }

  const send = (mode: "save" | "retry" | "new") =>
    void save.send(mode, buildDraft);

  function requestClose() {
    if (panel === "discard") {
      setPanel(null);
      return;
    }
    if (!dirty && !showReauth) {
      onClose();
      return;
    }
    setPanel("discard");
  }

  function discard() {
    save.cancel();
    onClose();
  }

  const textLength = codePointLength(text);
  const contentReady =
    kind === "text"
      ? text.trim() !== "" && textLength <= MAX_TEXT_CHARACTERS
      : kind === "photo"
        ? photo !== null && !photoDraft.busy
        : kind === "audio"
          ? (recorded !== null || upload !== null) &&
            !audioUpload.busy &&
            !recording
          : false;
  const canSave =
    contentReady &&
    codePointLength(caption) <= MAX_CAPTION_CHARACTERS &&
    validDate(memoryDate) &&
    !locked &&
    phase.name !== "conflict" &&
    !showReauth;

  return (
    <JournalDialog
      isOpen
      onClose={requestClose}
      title="Algo nuevo para la caja"
      initialFocusRef={firstKindRef}
      className="shoebox-composer"
    >
      <div className="grid gap-5 px-6 pt-5 pb-2 sm:px-8">
        {panel === "discard" && (
          <section
            aria-labelledby="composer-discard-title"
            className="grid gap-3"
          >
            <h3 id="composer-discard-title" className="text-xl font-semibold">
              ¿Tirar este borrador?
            </h3>
            <p>
              {save.pendingWrite
                ? "Puede que la caja termine de guardarlo aunque lo tires aquí. Tirarlo no deshace nada en el servidor."
                : "Lo que has preparado aquí se perderá. Nada se ha guardado todavía."}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                ref={keepEditingRef}
                type="button"
                className="archive-button"
                onClick={() => setPanel(null)}
              >
                Seguir editando
              </button>
              <button
                type="button"
                className="archive-button"
                onClick={discard}
              >
                <Trash2 aria-hidden="true" size={16} />
                Tirar el borrador
              </button>
            </div>
          </section>
        )}

        {panel === null && showReauth && (
          <ReauthPanel
            passwordRef={passwordRef}
            onDone={(expiresAt) => {
              if (phase.name === "editing") {
                save.setPhase({
                  name: "editing",
                  notice:
                    "La caja está abierta otra vez. Tu borrador sigue aquí; pulsa Guardar cuando quieras.",
                });
              }
              onReauthenticate(expiresAt);
            }}
          />
        )}

        <form
          hidden={panel !== null || showReauth}
          className="grid gap-5"
          noValidate
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            if (canSave) send("save");
          }}
        >
          <fieldset disabled={locked} className="grid gap-4">
            <fieldset disabled={recording} className="flex flex-wrap gap-2">
              <legend className="mb-2 text-sm font-semibold text-[var(--journal-muted)]">
                ¿Qué metemos?
              </legend>
              {KINDS.map((option, index) => (
                <label
                  key={option.kind}
                  className="archive-button cursor-pointer"
                  // Inline: the global .archive-button background outranks
                  // layered utilities.
                  style={
                    kind === option.kind
                      ? {
                          background: "var(--journal-accent)",
                          color: "var(--dream-cloud)",
                        }
                      : undefined
                  }
                >
                  <input
                    ref={index === 0 ? firstKindRef : undefined}
                    type="radio"
                    name="memory-kind"
                    value={option.kind}
                    checked={kind === option.kind}
                    onChange={() => {
                      changed();
                      setKind(option.kind);
                      if (option.kind === "audio") setAudioMounted(true);
                    }}
                    className="h-4 w-4"
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>

            {kind === "text" && (
              <MemoryTextField
                idPrefix="composer"
                value={text}
                onChange={(value) => {
                  changed();
                  setText(value);
                }}
              />
            )}

            {kind === "photo" && (
              <PhotoPicker
                draft={photoDraft}
                locked={locked}
                onEdit={changed}
              />
            )}

            {audioMounted && (
              <AudioPicker
                hidden={kind !== "audio"}
                draft={audioUpload}
                locked={locked}
                recorded={recorded}
                recording={recording}
                suspended={!sessionValid}
                onRecorded={setRecorded}
                onRecordingChange={setRecording}
                onEdit={changed}
              />
            )}

            {kind !== null && (
              <CaptionDateFields
                idPrefix="composer"
                kind={kind}
                caption={caption}
                memoryDate={memoryDate}
                onCaption={(value) => {
                  changed();
                  setCaption(value);
                }}
                onDate={(value) => {
                  changed();
                  setMemoryDate(value);
                }}
              />
            )}
          </fieldset>

          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--journal-rule)] pt-4">
            <button
              type="submit"
              className="archive-button"
              disabled={!canSave}
            >
              <Save aria-hidden="true" size={18} />
              Guardar en la caja
            </button>
          </div>

          {/* Below the Save button, so a fast second tap never lands on a
              new control such as "Cancelar envío". */}
          <PhaseNotice
            phase={phase}
            onCancel={save.cancel}
            onCheck={() => void save.checkAgain()}
            onRetry={() => send(phase.name === "uncertain" ? "retry" : "save")}
            onSaveAsNew={() => send("new")}
          />
        </form>
      </div>
    </JournalDialog>
  );
}
