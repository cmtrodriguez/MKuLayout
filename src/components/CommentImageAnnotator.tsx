import React, { useEffect, useRef, useState } from "react";
import { Check, Eraser, Expand, Pencil, X } from "lucide-react";
import { compressCommentImage } from "../lib/commentUtils";

const MARKER_COLORS = [
  { name: "Green", value: "#16a34a" },
  { name: "Red", value: "#dc2626" },
  { name: "Black", value: "#111827" },
  { name: "White", value: "#ffffff" },
  { name: "Blue", value: "#2563eb" },
];

interface CommentImageAnnotatorProps {
  image: string;
  onSave?: (image: string) => void;
  label?: string;
  allowAnnotation?: boolean;
}

export default function CommentImageAnnotator({ image, onSave, label, allowAnnotation = true }: CommentImageAnnotatorProps) {
  const buttonLabel = label || (allowAnnotation ? "Annotate picture" : "View picture");
  const [isOpen, setIsOpen] = useState(false);
  const [activeColor, setActiveColor] = useState(MARKER_COLORS[0].value);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<HTMLImageElement>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    const source = sourceRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !source || !context) return;

    const drawSource = () => {
      canvas.width = source.naturalWidth;
      canvas.height = source.naturalHeight;
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
    };

    if (source.complete && source.naturalWidth) drawSource();
    else source.onload = drawSource;
  }, [isOpen, image]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    if (!context) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.strokeStyle = activeColor;
    context.lineWidth = Math.max(5, Math.min(canvas.width, canvas.height) / 140);
    context.lineCap = "round";
    context.lineJoin = "round";
    isDrawingRef.current = true;
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    event.preventDefault();
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const point = getCanvasPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const stopDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    event.currentTarget.getContext("2d")?.closePath();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const clearMarks = () => {
    const canvas = canvasRef.current;
    const source = sourceRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && source && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
    }
  };

  const saveAnnotation = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsSaving(true);
    setSaveError("");
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Could not export this picture.")), "image/jpeg", 0.88);
      });
      const image = await compressCommentImage(new File([blob], "annotated-picture.jpg", { type: "image/jpeg" }));
      onSave?.(image);
      setIsOpen(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save this picture.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative block w-full h-full group cursor-pointer"
        aria-label={buttonLabel}
        title={buttonLabel}
      >
        <img src={image} alt="" className="w-full h-full object-cover" />
        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 group-focus-visible:bg-black/20 transition-colors" />
        <span className="absolute right-1 bottom-1 p-1 rounded-full bg-neutral-950/80 text-white shadow">
          {allowAnnotation ? <Pencil className="w-3.5 h-3.5" /> : <Expand className="w-3.5 h-3.5" />}
        </span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[80] bg-neutral-950/95 flex flex-col" role="dialog" aria-modal="true" aria-label={allowAnnotation ? "Draw on picture" : "View picture"}>
          <div className="h-14 sm:h-16 px-3 sm:px-5 flex items-center justify-between gap-3 border-b border-white/10 text-white shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {allowAnnotation ? <Pencil className="w-4 h-4 text-emerald-400 shrink-0" /> : <Expand className="w-4 h-4 text-emerald-400 shrink-0" />}
              <span className="text-sm font-semibold truncate">{allowAnnotation ? "Mark up picture" : "Picture"}</span>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-lg cursor-pointer" aria-label="Close annotation">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 min-h-0 p-2 sm:p-5 flex items-center justify-center overflow-hidden">
            {allowAnnotation ? (
              <div className="relative max-w-full max-h-full flex items-center justify-center">
                <img ref={sourceRef} src={image} alt="Picture being annotated" className="max-w-full max-h-[calc(100dvh-150px)] object-contain invisible" />
                <canvas
                  ref={canvasRef}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerCancel={stopDrawing}
                  onPointerLeave={stopDrawing}
                  className="absolute inset-0 w-full h-full object-contain touch-none cursor-crosshair"
                  aria-label="Picture drawing surface"
                />
              </div>
            ) : (
              <img src={image} alt="Full-size comment attachment" className="max-w-full max-h-full object-contain" />
            )}
          </div>

          {allowAnnotation && <div className="shrink-0 border-t border-white/10 bg-neutral-900/95 px-3 py-2.5 sm:px-5 sm:py-3 flex flex-wrap items-center justify-between gap-3">
            {saveError && <p role="alert" className="basis-full text-xs text-rose-300">{saveError}</p>}
            <div className="flex items-center gap-2" role="group" aria-label="Marker color">
              {MARKER_COLORS.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => setActiveColor(color.value)}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-pointer ${activeColor === color.value ? "border-emerald-400 ring-2 ring-emerald-400/30" : "border-white/35"}`}
                  style={{ backgroundColor: color.value }}
                  aria-label={`${color.name} marker`}
                  aria-pressed={activeColor === color.value}
                  title={`${color.name} marker`}
                >
                  {activeColor === color.value && <Check className={`w-4 h-4 ${color.name === "White" ? "text-neutral-900" : "text-white"}`} />}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button type="button" onClick={clearMarks} disabled={isSaving} className="px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                <Eraser className="w-4 h-4" /> Clear marks
              </button>
              <button type="button" onClick={saveAnnotation} disabled={isSaving} className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-wait">
                <Check className="w-4 h-4" /> {isSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>}
        </div>
      )}
    </>
  );
}