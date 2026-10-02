import React from "react";
import { TaskComment } from "../types";

export const MAX_COMMENT_IMAGES = 5;
const MAX_COMMENT_IMAGE_BYTES = 120 * 1024;
const MAX_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024;

export async function compressCommentImage(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error(`${file.name}: choose a JPG, PNG, or WebP image.`);
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error(`${file.name}: image must be 12 MB or smaller.`);
  }

  const bitmap = await createImageBitmap(file);
  try {
    let scale = Math.min(1, 1280 / bitmap.width, 1280 / bitmap.height);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not process this image.");

    const renderJpeg = (quality: number) => new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not compress this image.")), "image/jpeg", quality);
    });
    let blob: Blob;
    do {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      let quality = 0.82;
      blob = await renderJpeg(quality);
      while (blob.size > MAX_COMMENT_IMAGE_BYTES && quality > 0.5) {
        quality = Math.max(0.5, quality - 0.08);
        blob = await renderJpeg(quality);
      }
      if (blob.size > MAX_COMMENT_IMAGE_BYTES) scale *= 0.8;
    } while (blob.size > MAX_COMMENT_IMAGE_BYTES && scale >= 0.35);

    if (blob.size > MAX_COMMENT_IMAGE_BYTES) {
      throw new Error(`${file.name}: image could not be compressed enough. Try a smaller image.`);
    }

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read this image."));
      reader.onerror = () => reject(new Error("Could not read this image."));
      reader.readAsDataURL(blob);
    });
  } finally {
    bitmap.close();
  }
}

export function formatCommentDetails(c: { authorName: string; text: string; authorEmail?: string }, defaultRole?: string) {
  let text = c.text || "";

  // Strip unwanted uppercase prefix headers
  let cleanedText = text
    .replace(/^LAYOUT EDITOR REVISION REQUESTED:\s*/i, "")
    .replace(/^EIC REVISION REQUESTED:\s*/i, "")
    .replace(/^LAYOUT EDITOR APPROVED:\s*/i, "")
    .replace(/^EIC REVIEW APPROVED:\s*/i, "")
    .replace(/^REVISION REQUESTED:\s*/i, "")
    .replace(/^\[REVIEW COMMENT\]:\s*/i, "")
    .replace(/^\[Pubmat Drive Link Update\]:\s*/i, "")
    .trim();

  if (!cleanedText && text) {
    cleanedText = text;
  }

  const authorLower = (c.authorName || "").toLowerCase();
  const textLower = (c.text || "").toLowerCase();

  let roleLabel = defaultRole || "Layout Staff";
  let badgeStyle = "bg-neutral-100 text-neutral-700 border-neutral-200";

  if (authorLower.includes("layout editor") || textLower.includes("layout editor")) {
    roleLabel = "Layout Editor";
    badgeStyle = "bg-amber-100 text-amber-900 border-amber-200/90";
  } else if (authorLower.includes("editor-in-chief") || authorLower.includes("eic") || textLower.includes("eic")) {
    roleLabel = "Editor-in-Chief";
    badgeStyle = "bg-red-100 text-red-900 border-red-200/90";
  } else if (authorLower.includes("online layout head") || authorLower.includes("online head")) {
    roleLabel = "Online Layout Head";
    badgeStyle = "bg-blue-100 text-blue-900 border-blue-200/90";
  } else if (authorLower.includes("editor")) {
    roleLabel = "Editor";
    badgeStyle = "bg-amber-100 text-amber-900 border-amber-200/90";
  } else if (authorLower.includes("layout staff") || authorLower.includes("artist") || authorLower.includes("illustrator")) {
    roleLabel = "Layout Staff";
    badgeStyle = "bg-neutral-100 text-neutral-700 border-neutral-200";
  }

  const parts = c.authorName ? c.authorName.trim().split(" ") : ["U"];
  const initials = parts.length > 1 
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0][0]?.toUpperCase() || "U";

  return {
    cleanedText,
    roleLabel,
    badgeStyle,
    initials
  };
}

/**
 * Smart bullet point & multiline key handler for comment textareas.
 * - Enter key on a bullet line automatically adds a new bullet line ('- ').
 * - Enter key on an empty bullet line removes the bullet.
 * - Ctrl+Enter / Cmd+Enter triggers submit.
 */
export function handleBulletKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  val: string,
  onChange: (newVal: string) => void,
  onSubmit?: () => void
) {
  if (e.key === 'Enter') {
    // Ctrl+Enter or Cmd+Enter submits
    if ((e.ctrlKey || e.metaKey) && onSubmit) {
      e.preventDefault();
      onSubmit();
      return;
    }

    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // Find the current line before cursor
    const textBeforeCursor = val.substring(0, start);
    const lastNewline = textBeforeCursor.lastIndexOf('\n');
    const currentLine = textBeforeCursor.substring(lastNewline + 1);

    // Check if current line is a bullet line (starts with '- ' or '• ')
    const bulletMatch = currentLine.match(/^(\s*)([-•*])\s+/);

    if (bulletMatch) {
      e.preventDefault();
      const bulletSymbol = bulletMatch[2]; // e.g. '-'
      const prefix = bulletMatch[1] + bulletSymbol + ' ';
      
      // If current line is JUST the bullet symbol and whitespace
      if (currentLine.trim() === bulletSymbol) {
        // Clear bullet on current line
        const newVal = val.substring(0, lastNewline + 1) + val.substring(start);
        onChange(newVal);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = lastNewline + 1;
        }, 0);
      } else {
        // Add newline and new bullet
        const insertion = '\n' + prefix;
        const newVal = val.substring(0, start) + insertion + val.substring(end);
        onChange(newVal);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + insertion.length;
        }, 0);
      }
    }
  }
}

/**
 * Component to render formatted multi-line comments with bullet list support.
 */
export function RenderFormattedComment({ text, isEditorRole }: { text: string; isEditorRole?: boolean }) {
  if (!text) return null;

  const lines = text.split("\n");
  const blocks: Array<{ type: "paragraph" | "bullet"; items: string[] }> = [];

  let currentBullets: string[] = [];

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") || trimmed.startsWith("• ") || trimmed.startsWith("* ")) {
      const content = trimmed.replace(/^[-•*]\s+/, "");
      currentBullets.push(content);
    } else {
      if (currentBullets.length > 0) {
        blocks.push({ type: "bullet", items: [...currentBullets] });
        currentBullets = [];
      }
      if (trimmed.length > 0) {
        blocks.push({ type: "paragraph", items: [line] });
      }
    }
  });

  if (currentBullets.length > 0) {
    blocks.push({ type: "bullet", items: [...currentBullets] });
  }

  return (
    <div className="space-y-1.5 leading-relaxed text-left">
      {blocks.map((block, idx) => {
        if (block.type === "bullet") {
          return (
            <ul key={idx} className="space-y-1 my-1 pl-1">
              {block.items.map((item, bIdx) => (
                <li key={bIdx} className="flex items-start gap-2 text-xs font-medium text-gray-800">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                    isEditorRole ? "bg-amber-700" : "bg-neutral-700"
                  }`} />
                  <span className="flex-1">{item}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={idx} className="whitespace-pre-wrap font-medium text-xs text-gray-800 leading-relaxed">
            {block.items[0]}
          </p>
        );
      })}
    </div>
  );
}
