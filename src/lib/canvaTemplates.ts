export interface CanvaTemplate {
  id: string;
  name: string;
  category: "Branding & Gen" | "Editorial" | "Visuals & Layouts";
  defaultLink: string;
  isCustom?: boolean;
}

export const DEFAULT_CANVA_TEMPLATES: CanvaTemplate[] = [
  { id: "logo", name: "Logo", category: "Branding & Gen", defaultLink: "https://canva.link/l3llvrp9kwrgg3m" },
  { id: "cover-photo", name: "Cover Photo", category: "Branding & Gen", defaultLink: "https://canva.link/6mquv2ahy9tvuux" },
  { id: "header", name: "Header", category: "Branding & Gen", defaultLink: "https://canva.link/3tafgcpim4bufdk" },
  { id: "press-id", name: "Press ID", category: "Branding & Gen", defaultLink: "https://canva.link/press-id" },
  { id: "editorial-board", name: "Editorial Board", category: "Branding & Gen", defaultLink: "https://canva.link/editorial-board" },
  
  { id: "news", name: "News", category: "Editorial", defaultLink: "https://canva.link/wivqojjmn675ek9" },
  { id: "opinion", name: "Opinion", category: "Editorial", defaultLink: "https://canva.link/m4fmpvw4jhqu63s" },
  { id: "editorial", name: "Editorial", category: "Editorial", defaultLink: "https://canva.link/k6wnamj4r2p7n04" },
  { id: "medium", name: "Medium", category: "Editorial", defaultLink: "https://canva.link/5yuv72zezab85he" },
  { id: "features", name: "Features", category: "Editorial", defaultLink: "https://canva.link/njge9atp9633hpf" },
  { id: "culture", name: "Culture", category: "Editorial", defaultLink: "https://canva.link/s0vxxbc10zgoajg" },
  { id: "fta", name: "FTA", category: "Editorial", defaultLink: "https://canva.link/d04jojiynnkfhkl" },
  { id: "kultorepaso", name: "Kultorepaso", category: "Editorial", defaultLink: "https://canva.link/frvsal372oghuq1" },
  { id: "jst", name: "JST", category: "Editorial", defaultLink: "https://canva.link/jst" },
  
  { id: "advisories", name: "Advisories", category: "Visuals & Layouts", defaultLink: "https://canva.link/fkmevv8z959kpbs" },
  { id: "standalone-illus", name: "Standalone Illus", category: "Visuals & Layouts", defaultLink: "https://canva.link/exxhxuypbjzbj7k" },
  { id: "photo-essay", name: "Photo Essay", category: "Visuals & Layouts", defaultLink: "https://canva.link/photo-essay" },
  { id: "multiple-page-pubs", name: "Multiple Page Pubs", category: "Visuals & Layouts", defaultLink: "https://canva.link/zh2imiqoh8uu0qs" },
  { id: "donation-pubmat", name: "Donation Pubmat", category: "Visuals & Layouts", defaultLink: "https://canva.link/donation-pubmat" },
];

export const MEDIUM_CANVA_LINK = "https://canva.link/5yuv72zezab85he";

export function normalizeContentCategory(category: string | undefined): string {
  const value = (category || "").trim();
  return /^(?:cult|culture|cult\/culture)$/i.test(value) ? "Culture" : value;
}

export function isOnlinePubmatTask(typeOfRelease: string | undefined, title: string | undefined): boolean {
  return Boolean(typeOfRelease?.toLowerCase().includes("online") || /\(online pubmat\)$/i.test(title || ""));
}

export function getCanvaLinkForContent(category: string | undefined): string {
  const normalized = normalizeContentCategory(category).toLowerCase();
  if (!normalized) return "";
  return getPubmatCanvaTemplates().find((template) =>
    template.name.toLowerCase() === normalized || template.id.toLowerCase() === normalized
  )?.currentLink || "";
}

export function getAllCanvaTemplates(): (CanvaTemplate & { currentLink: string })[] {
  let customTemplates: CanvaTemplate[] = [];
  let links: Record<string, string> = {};

  try {
    const storedCustom = localStorage.getItem("mku_custom_canva_templates");
    if (storedCustom) customTemplates = JSON.parse(storedCustom);
  } catch (e) {
    // ignore
  }

  try {
    const storedLinks = localStorage.getItem("mku_canva_template_links_v2");
    if (storedLinks) links = JSON.parse(storedLinks);
  } catch (e) {
    // ignore
  }

  const all = [...DEFAULT_CANVA_TEMPLATES, ...customTemplates];
  return all.map(t => ({
    ...t,
    currentLink: links[t.id] || t.defaultLink
  }));
}

// Internal branding assets and multi-page pubs are not assignable content
// categories, so they stay out of the assignment category picker.
const PUBMAT_PICKER_EXCLUDED_IDS = new Set(["header", "press-id", "editorial-board", "jst", "multiple-page-pubs"]);

export function getPubmatCanvaTemplates(): (CanvaTemplate & { currentLink: string })[] {
  return getAllCanvaTemplates().filter((t) => !PUBMAT_PICKER_EXCLUDED_IDS.has(t.id));
}

export function extractHyperlinkDetails(input: string | undefined | null): { url: string; label: string } {
  if (!input) return { url: "", label: "" };
  const str = input.trim();
  if (!str) return { url: "", label: "" };

  const hyperlinkMatch = str.match(/=HYPERLINK\(\s*["']([^"']+)["']\s*(?:,\s*["']([^"']+)["'])?\s*\)/i);
  if (hyperlinkMatch) {
    const url = hyperlinkMatch[1].trim();
    const label = hyperlinkMatch[2]?.trim() || url;
    return { url, label };
  }

  const markdownMatch = str.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i);
  if (markdownMatch) {
    return { url: markdownMatch[2].trim(), label: markdownMatch[1].trim() };
  }

  const urlMatch = str.match(/(https?:\/\/[^\s"']+)/i);
  if (urlMatch) {
    return { url: urlMatch[1].trim(), label: str !== urlMatch[1] ? str : urlMatch[1] };
  }

  return { url: "", label: str };
}
