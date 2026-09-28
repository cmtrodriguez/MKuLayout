export type AccentTheme = "maroon" | "navy" | "forest" | "grape" | "pink" | "beige" | "grey";

export const ACCENT_PALETTES: Record<AccentTheme, { primary: string; light: string; dark: string; label: string }> = {
  maroon: { primary: "#bc1700", light: "#e61c00", dark: "#660000", label: "UP Maroon" },
  navy: { primary: "#1E3A8A", light: "#3B82F6", dark: "#172554", label: "Royal Navy" },
  forest: { primary: "#065F46", light: "#10B981", dark: "#064E3B", label: "Forest Green" },
  grape: { primary: "#581C87", light: "#8B5CF6", dark: "#3B0764", label: "Grape Purple" },
  pink: { primary: "#db2777", light: "#f472b6", dark: "#9d174d", label: "Pink" },
  beige: { primary: "#c2a878", light: "#e0c9a0", dark: "#7a5c3a", label: "Beige" },
  grey: { primary: "#6b7280", light: "#9ca3af", dark: "#374151", label: "Grey" },
};

export const ACCENT_OPTIONS = (Object.keys(ACCENT_PALETTES) as AccentTheme[]).map((id) => ({
  id,
  label: ACCENT_PALETTES[id].label,
  color: ACCENT_PALETTES[id].primary,
}));

export function applyAccentCssVars(color: AccentTheme) {
  const palette = ACCENT_PALETTES[color] || ACCENT_PALETTES.maroon;
  const root = document.documentElement;
  root.style.setProperty("--color-brand-maroon", palette.primary);
  root.style.setProperty("--color-brand-maroon-light", palette.light);
  root.style.setProperty("--color-brand-maroon-dark", palette.dark);
  root.style.setProperty("--color-brand-red", palette.primary);
  
  // Add gradient versions
  root.style.setProperty("--color-brand-gradient", `linear-gradient(135deg, ${palette.primary} 0%, ${palette.dark} 100%)`);
  root.style.setProperty("--color-brand-gradient-light", `linear-gradient(135deg, ${palette.light} 0%, ${palette.primary} 100%)`);
}
