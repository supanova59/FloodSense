"use client";
import { useEffect, useRef, useState } from "react";
import { X, Plus } from "lucide-react";
import { ZONES } from "../lib/demo";
import { validateReport, type ReportInput } from "../lib/reports";

export default function ReportDialog({
  onClose,
  onSubmit,
  mode,
}: {
  onClose: () => void;
  onSubmit: (input: ReportInput) => Promise<void>;
  mode: "session" | "api";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [zone, setZone] = useState("bellandur"),
    [depth, setDepth] = useState("25"),
    [blocked, setBlocked] = useState(false),
    [note, setNote] = useState(""),
    [image, setImage] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const node = dialog.current,
      previous = document.activeElement as HTMLElement | null;
    node?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      node?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    if (!image) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);
  return (
    <dialog
      ref={dialog}
      className="report-dialog"
      aria-labelledby="report-title"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), select:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
          ),
        );
        const first = controls[0],
          last = controls[controls.length - 1];
        if (!first) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(e) => {
        if (busy) {
          e.preventDefault();
          return;
        }
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          const box = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < box.left ||
            e.clientX > box.right ||
            e.clientY < box.top ||
            e.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="label-kicker">COMMUNITY CONTRIBUTION</p>
          <h2 id="report-title" className="mt-2 text-[23px] font-extrabold">
            Report waterlogging
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {mode === "session"
              ? "Saved in this browser tab only."
              : "Submit an unverified observation."}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          aria-label="Close report"
          className="rounded-lg p-2 hover:bg-slate-100"
        >
          <X size={20} />
        </button>
      </div>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            const input = validateReport({
              zone,
              cm: Number(depth),
              blocked,
              note,
            });
            setBusy(true);
            await onSubmit(input);
            onClose();
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Could not save your report.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <label htmlFor="report-zone" className="field-label">
            Location
          </label>
          <select
            autoFocus
            id="report-zone"
            className="field"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
          >
            {ZONES.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="report-depth" className="field-label">
            Estimated water depth
          </label>
          <select
            id="report-depth"
            className="field"
            value={depth}
            onChange={(e) => setDepth(e.target.value)}
          >
            <option value="10">About 10 cm</option>
            <option value="25">About 25 cm</option>
            <option value="50">About 50 cm</option>
          </select>
        </div>
        <div>
          <label htmlFor="report-photo" className="field-label">
            Optional image · local preview only
          </label>
          <input
            id="report-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="field"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setError("");
              if (!file) {
                setImage(null);
                return;
              }
              if (
                !["image/jpeg", "image/png", "image/webp"].includes(
                  file.type,
                ) ||
                file.size > 5 * 1024 * 1024
              ) {
                setImage(null);
                e.target.value = "";
                setError("Choose a JPG, PNG or WebP image under 5 MB.");
                return;
              }
              setImage(file);
            }}
          />
          {preview && (
            <figure className="mt-3">
              <img
                src={preview}
                alt="Selected waterlogging observation"
                className="max-h-40 w-full rounded-xl object-contain bg-slate-50"
              />
              <figcaption className="mt-1 text-xs text-slate-500">
                {image?.name} · not uploaded or saved with the report
              </figcaption>
            </figure>
          )}
        </div>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={blocked}
            onChange={(e) => setBlocked(e.target.checked)}
          />{" "}
          Storm drain appears blocked
        </label>
        <div>
          <label htmlFor="report-note" className="field-label">
            Observations
          </label>
          <textarea
            id="report-note"
            className="field min-h-24"
            maxLength={400}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Describe what you observed without sharing personal information."
          />
          <p className="mt-1 text-right text-xs text-slate-500">
            {note.length}/400
          </p>
        </div>
        <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          Reports are unverified and are not sent to emergency services. Only
          observe from a safe location.
        </p>
        {error && (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            disabled={busy}
            className="btn-secondary flex-1"
            onClick={onClose}
          >
            Cancel
          </button>
          <button disabled={busy} className="btn-primary flex-1">
            <Plus size={16} />
            {busy ? "Saving…" : "Save report"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
