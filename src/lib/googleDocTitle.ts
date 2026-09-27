import { extractHyperlinkDetails } from "./canvaTemplates";
import { getCachedDriveToken } from "./googleDriveShare";
import { getAccessToken } from "./googleSheets";

export interface DocTitleResult {
  title: string;
  url: string;
  success: boolean;
  isPrivate?: boolean;
  error?: string;
  source?: string;
}

/**
 * Extract URL and optional embedded title from user input
 * Handles raw URLs, =HYPERLINK("url", "title"), and markdown [title](url)
 */
export function extractDocInputDetails(input: string): { url: string; embeddedTitle?: string } {
  if (!input) return { url: "" };
  const trimmed = input.trim();

  // Check =HYPERLINK("url", "title")
  const hyperlinkMatch = trimmed.match(/=HYPERLINK\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/i);
  if (hyperlinkMatch) {
    const url = hyperlinkMatch[1].trim();
    const title = hyperlinkMatch[2].trim();
    return {
      url,
      embeddedTitle: title && !title.startsWith("http") ? title : undefined
    };
  }

  // Check Markdown [title](url)
  const mdMatch = trimmed.match(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/i);
  if (mdMatch) {
    const title = mdMatch[1].trim();
    const url = mdMatch[2].trim();
    return {
      url,
      embeddedTitle: title && !title.startsWith("http") ? title : undefined
    };
  }

  // Check standard extractHyperlinkDetails
  const ext = extractHyperlinkDetails(trimmed);
  if (ext.url && ext.label && ext.label !== ext.url && !ext.label.startsWith("http")) {
    return {
      url: ext.url,
      embeddedTitle: ext.label
    };
  }

  return { url: ext.url || trimmed };
}

/**
 * Fetch Google Doc title from server API or OAuth
 */
export async function fetchGoogleDocTitle(inputUrl: string): Promise<DocTitleResult> {
  const { url: cleanUrl, embeddedTitle } = extractDocInputDetails(inputUrl);

  // If title was already embedded in formula or markdown, return immediately
  if (embeddedTitle) {
    return {
      title: embeddedTitle,
      url: cleanUrl,
      success: true,
      source: "embedded_formula"
    };
  }

  if (!cleanUrl || (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://"))) {
    return {
      title: "",
      url: cleanUrl,
      success: false,
      error: "Please enter a valid Google Docs URL"
    };
  }

  try {
    // Check if we have a cached drive or sheets OAuth token
    const driveToken = getCachedDriveToken();
    const sheetsToken = await getAccessToken().catch(() => null);
    const token = driveToken || sheetsToken;

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const apiUrl = `/api/gdoc-title?url=${encodeURIComponent(cleanUrl)}${token ? `&token=${encodeURIComponent(token)}` : ""}`;
    const res = await fetch(apiUrl, { headers });

    if (!res.ok) {
      return {
        title: "",
        url: cleanUrl,
        success: false,
        error: `Server returned ${res.status}`
      };
    }

    const data = await res.json();
    if (data.title && typeof data.title === "string" && data.title.trim()) {
      return {
        title: data.title.trim(),
        url: cleanUrl,
        success: true,
        source: data.source || "server"
      };
    }

    return {
      title: "",
      url: cleanUrl,
      success: false,
      isPrivate: !!data.isPrivate,
      error: data.isPrivate 
        ? "Private document detected. Sign in with Google / connect Drive to auto-read private titles, or type the title below."
        : "Could not detect document title automatically"
    };
  } catch (err: any) {
    console.error("fetchGoogleDocTitle error:", err);
    return {
      title: "",
      url: cleanUrl,
      success: false,
      error: err?.message || "Network error fetching document title"
    };
  }
}
