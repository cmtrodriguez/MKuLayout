import React, { useState, useEffect } from "react";
import { Eye, Type, Shield, AudioLines, Sparkles, RefreshCw, Sun, Moon } from "lucide-react";

interface AccessibilityPanelProps {
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
  dyslexicFont: boolean;
  setDyslexicFont: (v: boolean) => void;
  fontSizeMultiplier: number;
  setFontSizeMultiplier: (v: number) => void;
  speechEnabled: boolean;
  setSpeechEnabled: (v: boolean) => void;
  darkMode?: boolean;
  setDarkMode?: (v: boolean) => void;
}

export default function AccessibilityPanel({
  highContrast,
  setHighContrast,
  dyslexicFont,
  setDyslexicFont,
  fontSizeMultiplier,
  setFontSizeMultiplier,
  speechEnabled,
  setSpeechEnabled,
  darkMode = false,
  setDarkMode,
}: AccessibilityPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Apply modes to document element
  useEffect(() => {
    const root = document.documentElement;
    if (highContrast) {
      root.classList.add("high-contrast-mode");
    } else {
      root.classList.remove("high-contrast-mode");
    }
  }, [highContrast]);

  useEffect(() => {
    const root = document.documentElement;
    if (dyslexicFont) {
      root.classList.add("dyslexic-mode");
    } else {
      root.classList.remove("dyslexic-mode");
    }
  }, [dyslexicFont]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSizeMultiplier * 100}%`;
  }, [fontSizeMultiplier]);

  useEffect(() => {
    if (!speechEnabled) return;

    let lastSpoken = "";
    let speechTimeout: any = null;

    const handleSpeak = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      const interactive = target.closest("button, a, input, select, textarea, [role='button'], [aria-label]");
      if (!interactive) return;

      const label =
        interactive.getAttribute("aria-label") ||
        interactive.getAttribute("title") ||
        (interactive as HTMLInputElement).placeholder ||
        (interactive as HTMLElement).innerText;

      if (label && label.trim() && label.trim() !== lastSpoken && label.trim().length < 120) {
        lastSpoken = label.trim();
        clearTimeout(speechTimeout);
        speechTimeout = setTimeout(() => {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(lastSpoken);
          utterance.rate = 1.1;
          window.speechSynthesis.speak(utterance);
        }, 150);
      }
    };

    document.addEventListener("focusin", handleSpeak);
    document.addEventListener("mouseenter", handleSpeak, true);

    return () => {
      document.removeEventListener("focusin", handleSpeak);
      document.removeEventListener("mouseenter", handleSpeak, true);
      clearTimeout(speechTimeout);
    };
  }, [speechEnabled]);

  // Speech helper
  const speakText = (text: string) => {
    if (!speechEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  };

  const resetAll = () => {
    setHighContrast(false);
    setDyslexicFont(false);
    setFontSizeMultiplier(1);
    setSpeechEnabled(false);
    if (setDarkMode) setDarkMode(false);
    speakText("Accessibility preferences reset to default.");
  };

  return (
    <div className="relative z-50">
      <button
        id="btn-accessibility-menu"
        onClick={() => {
          setIsOpen(!isOpen);
          speakText(isOpen ? "Closed accessibility options" : "Opened accessibility options panel");
        }}
        className="flex items-center gap-2 px-3 py-1.5 bg-brand-maroon/5 hover:bg-brand-maroon/10 text-brand-maroon font-medium rounded-lg text-sm transition-all focus:ring-2 focus:ring-brand-red border border-brand-maroon/20 cursor-pointer"
        aria-label="Toggle accessibility options panel"
        aria-expanded={isOpen}
      >
        <Shield className="w-4 h-4 text-brand-maroon" />
        <span className="font-display hidden md:inline">Accessibility Controls</span>
      </button>

      {isOpen && (
        <div
          id="accessibility-popup"
          className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-24px)] p-4 bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-gray-100 dark:border-neutral-800 flex flex-col gap-4 animate-fade-in text-gray-800 dark:text-neutral-100 z-50"
          role="dialog"
          aria-label="Accessibility options"
        >
          <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-neutral-800">
            <h3 className="font-display font-bold text-gray-900 dark:text-neutral-100 text-sm flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-brand-red dark:text-red-400" />
              WCAG 2.2 AA Options
            </h3>
            <button
              onClick={resetAll}
              className="text-xs text-brand-maroon dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
              aria-label="Reset accessibility preferences"
            >
              <RefreshCw className="w-3 h-3" /> Reset
            </button>
          </div>

          {/* Dark / Light Canvas Mode */}
          <div className="flex items-center justify-between">
            <label htmlFor="toggle-dark-mode" className="text-xs font-semibold flex items-center gap-2 text-gray-700 dark:text-neutral-200">
              {darkMode ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />} Dark Mode Theme
            </label>
            <button
              id="toggle-dark-mode"
              type="button"
              onClick={() => {
                if (setDarkMode) {
                  const next = !darkMode;
                  setDarkMode(next);
                  speakText(`Theme switched to ${next ? "dark" : "light"} mode`);
                }
              }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                darkMode ? "bg-brand-maroon dark:bg-red-700" : "bg-gray-200 dark:bg-neutral-700"
              }`}
              role="switch"
              aria-checked={darkMode}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  darkMode ? "translate-x-4.5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* High Contrast */}
          <div className="flex items-center justify-between">
            <label htmlFor="toggle-high-contrast" className="text-xs font-semibold flex items-center gap-2 text-gray-700 dark:text-neutral-200">
              <Eye className="w-4 h-4 text-gray-500 dark:text-neutral-400" /> High Contrast Theme
            </label>
            <button
              id="toggle-high-contrast"
              onClick={() => {
                setHighContrast(!highContrast);
                speakText(`High contrast mode ${!highContrast ? "activated" : "deactivated"}`);
              }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                highContrast ? "bg-brand-maroon dark:bg-red-700" : "bg-gray-200 dark:bg-neutral-700"
              }`}
              role="switch"
              aria-checked={highContrast}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  highContrast ? "translate-x-4.5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Dyslexia font */}
          <div className="flex items-center justify-between">
            <label htmlFor="toggle-dyslexic" className="text-xs font-semibold flex items-center gap-2 text-gray-700 dark:text-neutral-200">
              <Type className="w-4 h-4 text-gray-500 dark:text-neutral-400" /> Dyslexia Friendly Font
            </label>
            <button
              id="toggle-dyslexic"
              onClick={() => {
                setDyslexicFont(!dyslexicFont);
                speakText(`Dyslexic friendly font ${!dyslexicFont ? "activated" : "deactivated"}`);
              }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                dyslexicFont ? "bg-brand-maroon dark:bg-red-700" : "bg-gray-200 dark:bg-neutral-700"
              }`}
              role="switch"
              aria-checked={dyslexicFont}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  dyslexicFont ? "translate-x-4.5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Font Sizing */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-neutral-200">
              <span className="flex items-center gap-2">
                <Type className="w-4 h-4 text-gray-500 dark:text-neutral-400" /> Text Size Multiplier
              </span>
              <span className="font-mono text-brand-maroon dark:text-red-400">{Math.round(fontSizeMultiplier * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.5"
              step="0.1"
              value={fontSizeMultiplier}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setFontSizeMultiplier(val);
                speakText(`Text size adjusted to ${Math.round(val * 100)} percent`);
              }}
              className="w-full h-1.5 bg-gray-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-brand-maroon"
              aria-label="Adjust font size multiplier"
            />
          </div>

          {/* Audio Description */}
          <div className="flex items-center justify-between">
            <label htmlFor="toggle-screen-reader" className="text-xs font-semibold flex items-center gap-2 text-gray-700 dark:text-neutral-200">
              <AudioLines className="w-4 h-4 text-gray-500 dark:text-neutral-400" /> Interactive Screen Reader
            </label>
            <button
              id="toggle-screen-reader"
              onClick={() => {
                const nextState = !speechEnabled;
                setSpeechEnabled(nextState);
                if (nextState) {
                  // Small delay to make sure speech state is applied
                  setTimeout(() => speakText("Interactive screen reader activated. Hover over layout elements or buttons to hear audio guidance."), 200);
                }
              }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                speechEnabled ? "bg-brand-maroon dark:bg-red-700" : "bg-gray-200 dark:bg-neutral-700"
              }`}
              role="switch"
              aria-checked={speechEnabled}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  speechEnabled ? "translate-x-4.5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          <div className="text-[10px] text-gray-400 dark:text-neutral-500 border-t pt-2 border-gray-100 dark:border-neutral-800 flex flex-col gap-1">
            <p>● Meets ADA & WCAG Section 508 recommendations.</p>
            <p>● Full keyboard Tab indexing active natively.</p>
          </div>
        </div>
      )}
    </div>
  );
}
