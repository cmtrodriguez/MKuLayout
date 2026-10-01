import React, { useState, useEffect, useRef } from "react";
import { 
  FileSpreadsheet, RefreshCw, ExternalLink, Link, Save, 
  HelpCircle, LogOut, Layers, Sparkles, Database, Shield, AlertCircle,
  Plus, Edit, Trash2, Copy, Search, ArrowUpDown, ChevronLeft, ChevronRight,
  Check, Undo2, Redo2, Maximize, Minimize, ZoomIn, ZoomOut, CheckCircle, X, ListPlus, Edit3,
  Columns, Split, Table, Eye, Printer, FileText
} from "lucide-react";
import { Task, TeamMember, SheetMerge, normalizeEmail } from "../types";
import {
  initAuth,
  googleSignIn,
  logout,
  getSheetTabs,
  getSheetValues,
  updateSheetValues,
  parseScheduleRows,
  formatScheduleToRows,
  formatRosterToRows,
  fetchSpreadsheetMetadata,
  renameSheetTab,
  duplicateSheetTab,
  deleteSheetTab,
  createSheetTab,
  getSheetMerges,
  mergeSheetCells,
  unmergeSheetCells,
  getCellMergeInfo,
  detectMergedSectionRows
} from "../lib/googleSheets";
import { extractHyperlinkDetails } from "../lib/canvaTemplates";

const getFirstName = (fullName: string): string => {
  if (!fullName) return "";
  if (fullName.includes(",")) {
    const parts = fullName.split(",");
    const firstNamePart = parts[1].trim();
    return firstNamePart.split(" ")[0];
  }
  return fullName.split(" ")[0];
};

// Helper to parse hyperlink formula or URL string
export function parseHyperlinkCell(cellValue: any): { url: string; title: string } {
  if (cellValue === null || cellValue === undefined) return { url: "", title: "" };
  const trimmed = String(cellValue).trim();
  const hyperMatch = trimmed.match(/^=HYPERLINK\(\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?\s*\)$/i);
  if (hyperMatch) {
    return {
      url: hyperMatch[1] || "",
      title: hyperMatch[2] || hyperMatch[1] || ""
    };
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return { url: trimmed, title: "" };
  }
  return { url: "", title: trimmed };
}

// True when a URL points at a Google Docs document (the ArtX / writeup link).
export const isGoogleDocsLink = (url: string | undefined | null): boolean =>
  !!url && /docs\.google\.com\/document|docs\.google\.com/i.test(url);

// Shows a cell's display label instead of a raw =HYPERLINK(...) formula, so
// modal inputs read cleanly while the underlying link stays in state.
const cellDisplayValue = (v: any): string => {
  const s = String(v ?? "");
  const m = s.match(/^=HYPERLINK\(\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?\s*\)$/i);
  return m ? m[2] || m[1] : s;
};

// Renders a sheet cell hyperlink. Google Docs (ArtX) links get a distinct
// document icon and colour so they stand out from generic external links.
function CellLink({ url, label, stopPropagation }: { url: string; label: string; stopPropagation?: boolean }) {
  const isDocs = isGoogleDocsLink(url);
  const Icon = isDocs ? FileText : ExternalLink;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
      className={`inline-flex items-center gap-1 max-w-full truncate underline font-semibold ${
        isDocs ? "text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300" : "text-brand-maroon hover:text-red-800"
      }`}
      title={isDocs ? `Google Docs ArtX link: ${url}` : `Open link: ${url}`}
    >
      <Icon className="w-3 h-3 shrink-0" />
      <span className="truncate">{label}</span>
      {isDocs && (
        <span className="shrink-0 px-1 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 text-[9px] font-bold no-underline">
          ArtX
        </span>
      )}
    </a>
  );
}

interface SheetsSyncProps {
  tasks: Task[];
  members: TeamMember[];
  layoutArtistOptions?: { value: string; label: string; email?: string }[];
  speechEnabled: boolean;
  currentUserRole: string;
  onUpdateTasks: (tasks: Task[]) => void;
  onUpdateMembers: (members: TeamMember[]) => void;
  googleSheetsLink: string;
  onUpdateGoogleSheetsLink: (link: string) => void;
}

export default function SheetsSync({
  tasks,
  members,
  layoutArtistOptions = [],
  speechEnabled,
  currentUserRole,
  onUpdateTasks,
  onUpdateMembers,
  googleSheetsLink,
  onUpdateGoogleSheetsLink,
}: SheetsSyncProps) {
  // Subsections toggle
  const [activeSubTab, setActiveSubTab] = useState<"editor" | "viewer">("editor");

  // Layout/Online assignee dropdown names — mirror the Online Pubmat modal.
  // Prefer the role-filtered layoutArtistOptions from App; fall back to raw members.
  const artistNameOptions = Array.from(
    new Set(
      (layoutArtistOptions.length
        ? layoutArtistOptions.map((o) => o.label)
        : members.map((m) => getFirstName(m.name))
      ).filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  const [syncStatus, setSyncStatus] = useState<"idle" | "authenticating" | "downloading" | "merging" | "success">("idle");
  const [linkInput, setLinkInput] = useState(googleSheetsLink);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Real Google Sheets Sync states
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncDirection, setSyncDirection] = useState<"pull" | "push" | null>(null);

  // Sheets Pages state (Tabs list)
  const [sheetsList, setSheetsList] = useState<{ title: string; sheetId: number }[]>([]);
  const [activeSheetGid, setActiveSheetGid] = useState<number>(0);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);

  // Sync polling countdown state (10-15s requirement: we use 12 seconds)
  const [secondsUntilSync, setSecondsUntilSync] = useState(12);

  // Spreadsheet Editor Grid States
  const [sheetCells, setSheetCells] = useState<string[][]>([]);
  const [isLoadingSheetData, setIsLoadingSheetData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<Date | null>(null);

  // Undo / Redo history stacks
  const [undoStack, setUndoStack] = useState<string[][][]>([]);
  const [redoStack, setRedoStack] = useState<string[][][]>([]);

  // Search & Filter & Sort state inside spreadsheet editor
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCol, setFilterCol] = useState<number>(-1);
  const [filterVal, setFilterVal] = useState("");
  const [sortCol, setSortCol] = useState<number>(-1);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Selection & Inline Editor
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editingValue, setEditingValue] = useState("");

  // Pagination inside editor
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 12;

  // Iframe & Grid Viewer Controls
  const [zoomScale, setZoomScale] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [viewerMode, setViewerMode] = useState<"grid" | "iframe">("grid");
  const [viewerSearch, setViewerSearch] = useState("");

  // Merged cells state
  const [sheetMerges, setSheetMerges] = useState<SheetMerge[]>([]);
  const [highlightMerges, setHighlightMerges] = useState(true);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeFormStartRow, setMergeFormStartRow] = useState(2);
  const [mergeFormEndRow, setMergeFormEndRow] = useState(2);
  const [mergeFormStartCol, setMergeFormStartCol] = useState(1);
  const [mergeFormEndCol, setMergeFormEndCol] = useState(9);
  const [mergeFormLabel, setMergeFormLabel] = useState("");

  // Worksheet Operation Modals
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [addRowValues, setAddRowValues] = useState<string[]>([]);
  const [editingRowIdx, setEditingRowIdx] = useState<number | null>(null);
  const [artxDocTitle, setArtxDocTitle] = useState("");
  const [artxDocUrl, setArtxDocUrl] = useState("");
  const [isFetchingDocTitle, setIsFetchingDocTitle] = useState(false);
  
  const [showCreateSheetModal, setShowCreateSheetModal] = useState(false);
  const [newSheetTitle, setNewSheetTitle] = useState("");
  const [useTemplateOption, setUseTemplateOption] = useState(true);

  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameSheetId, setRenameSheetId] = useState<number | null>(null);
  const [renameSheetOldTitle, setRenameSheetOldTitle] = useState("");
  const [renameSheetNewTitle, setRenameSheetNewTitle] = useState("");

  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateSheetId, setDuplicateSheetId] = useState<number | null>(null);
  const [duplicateSheetTitle, setDuplicateSheetTitle] = useState("");
  const [duplicateSheetNewTitle, setDuplicateSheetNewTitle] = useState("");

  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteSheetId, setDeleteSheetId] = useState<number | null>(null);
  const [deleteSheetTitle, setDeleteSheetTitle] = useState("");

  // Developer credentials setup states
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [useCustomConfig, setUseCustomConfig] = useState(!!localStorage.getItem("custom_firebase_config"));
  const [customConfigInput, setCustomConfigInput] = useState(() => {
    const saved = localStorage.getItem("custom_firebase_config");
    if (saved) {
      try {
        return JSON.stringify(JSON.parse(saved), null, 2);
      } catch (e) {
        return saved;
      }
    }
    return "";
  });
  const [configSaveSuccess, setConfigSaveSuccess] = useState(false);
  const [configError, setConfigError] = useState("");

  const lastPushedTasksRef = useRef<string>("");

  const speakText = (text: string) => {
    if (!speechEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  };

  const extractSpreadsheetId = (url: string) => {
    try {
      if (!url) return null;
      const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        return match[1];
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  const spreadsheetId = extractSpreadsheetId(googleSheetsLink || linkInput);

  // Editable URL representation for Google Sheets inside frame
  const activeSheetObj = sheetsList.find(s => s.sheetId === activeSheetGid) || sheetsList[0];
  const activeSheetTitle = activeSheetObj?.title || "Schedule";

  const editableUrl = spreadsheetId 
    ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?gid=${activeSheetGid}&rm=minimal`
    : null;

  // Initial Auth hook
  useEffect(() => {
    if (!googleSheetsLink && !linkInput) {
      const defaultLink = "https://docs.google.com/spreadsheets/d/1eAlGgxi6xQ1bz9HbfAIQaRD0MfyRIpE1yVQGtr6UqwY/edit?usp=sharing";
      setLinkInput(defaultLink);
      onUpdateGoogleSheetsLink(defaultLink);
    }

    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        setSyncError(null);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Sync inputs
  useEffect(() => {
    if (googleSheetsLink) {
      setLinkInput(googleSheetsLink);
    }
  }, [googleSheetsLink]);

  // Load sheets structure metadata
  const loadOfflineSheetsList = () => {
    const cacheKey = `cached_sheets_list_${spreadsheetId || "default"}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const list = JSON.parse(cached);
        const filtered = list.filter((s: any) => s.title.toLowerCase() !== "roster" && !s.title.toLowerCase().includes("roster"));
        if (filtered.length > 0) {
          setSheetsList(filtered);
          if (!filtered.some((s: any) => s.sheetId === activeSheetGid)) {
            setActiveSheetGid(filtered[0].sheetId);
          }
          return;
        }
      } catch (e) {
        console.error("Failed to parse cached sheets list", e);
      }
    }

    const fallbackList = [
      { title: "Schedule", sheetId: 101 },
      { title: "Online Pubmat", sheetId: 103 },
      { title: "Layout Tasks", sheetId: 104 }
    ];
    setSheetsList(fallbackList);
    if (!fallbackList.some(s => s.sheetId === activeSheetGid)) {
      setActiveSheetGid(101);
    }
  };

  const loadSheetsMetadata = async () => {
    if (!spreadsheetId || !googleToken) {
      loadOfflineSheetsList();
      return;
    }
    try {
      setIsLoadingSheets(true);
      const metadata = await fetchSpreadsheetMetadata(spreadsheetId, googleToken);
      // Filter out any sheets named "Roster" (remove the roster section)
      const list = metadata
        .map(sheet => ({
          title: sheet.title,
          sheetId: (sheet as any).sheetId ?? 0
        }))
        .filter(sheet => sheet.title.toLowerCase() !== "roster" && !sheet.title.toLowerCase().includes("roster"));

      setSheetsList(list);

      // Cache the fetched worksheets in localStorage
      localStorage.setItem(`cached_sheets_list_${spreadsheetId}`, JSON.stringify(list));

      if (list.length > 0) {
        if (!list.some(s => s.sheetId === activeSheetGid)) {
          setActiveSheetGid(list[0].sheetId);
        }
      }
    } catch (err: any) {
      console.warn("Error fetching spreadsheet tab lists, loading offline tabs:", err);
      loadOfflineSheetsList();
    } finally {
      setIsLoadingSheets(false);
    }
  };

  useEffect(() => {
    loadSheetsMetadata();
  }, [spreadsheetId, googleToken]);

  // Load cell values for active sheet tab
  const loadSheetData = async (sheetTitle: string) => {
    if (!spreadsheetId) return;

    setIsLoadingSheetData(true);
    setSyncError(null);

    if (googleToken) {
      try {
        const range = `${sheetTitle}!A1:Z150`;
        const rows = await getSheetValues(spreadsheetId, range, googleToken);
        let currentGrid: string[][] = [];
        if (rows && rows.length > 0) {
          const padded = padSheetData(rows);
          setSheetCells(padded);
          setUndoStack([padded]);
          setRedoStack([]);
          currentGrid = padded;
          localStorage.setItem(`cache_vals_${spreadsheetId}_${sheetTitle}`, JSON.stringify(padded));

          // Pick up rows added or edited directly in the live Sheet so they surface
          // as tasks. Row signatures are persisted so a reload only dispatches real
          // deltas. On the very first connect there is no baseline yet, so we only
          // record signatures here and DO NOT dispatch — merely loading the embedded
          // sheet ("website") into the Issue Pages / Online Pubmat sections must not
          // spawn request confirmations. Confirmations begin only once a row is
          // actually edited (in-app edits dispatch directly; remote edits are caught
          // by the signature diff on subsequent polls).
          try {
            const sigKey = `row_sigs_${spreadsheetId}_${sheetTitle}`;
            let prevSigs: Record<string, string> = {};
            try { prevSigs = JSON.parse(localStorage.getItem(sigKey) || "{}"); } catch { prevSigs = {}; }
            const hadBaseline = Object.keys(prevSigs).length > 0;
            const headers = padded[0] || [];
            const tIdx = headers.findIndex(h => {
              const s = (h || "").toLowerCase();
              return s.includes("title") || s.includes("summary") || s.includes("artx") || s.includes("assignment");
            });
            if (tIdx !== -1) {
              const nextSigs: Record<string, string> = {};
              const changedRows: string[][] = [];
              for (let r = 1; r < padded.length; r++) {
                const row = padded[r];
                const rowTitle = String(row[tIdx] || "").trim();
                if (!rowTitle) continue;
                const sig = JSON.stringify(row);
                nextSigs[rowTitle] = sig;
                if (prevSigs[rowTitle] !== sig) changedRows.push(row);
              }
              localStorage.setItem(sigKey, JSON.stringify(nextSigs));
              if (hadBaseline && changedRows.length > 0) dispatchRowsToOnlinePubmat(changedRows, headers);
            }
          } catch (ingestErr) {
            console.warn("Row ingest skipped:", ingestErr);
          }
        } else {
          const emptyGrid = createBlankGrid(25, 10);
          setSheetCells(emptyGrid);
          setUndoStack([emptyGrid]);
          setRedoStack([]);
          currentGrid = emptyGrid;
        }

        // Also fetch sheet merges from Google API
        const activeObj = sheetsList.find(s => s.title === sheetTitle);
        const targetSheetId = activeObj?.sheetId ?? activeSheetGid ?? 0;
        const mergesFromApi = await getSheetMerges(spreadsheetId, targetSheetId, googleToken);
        if (mergesFromApi && mergesFromApi.length > 0) {
          setSheetMerges(mergesFromApi);
          localStorage.setItem(`cache_merges_${spreadsheetId}_${sheetTitle}`, JSON.stringify(mergesFromApi));
        } else {
          loadMergesFallback(sheetTitle, currentGrid);
        }

        setLastSyncedTime(new Date());
      } catch (err: any) {
        console.warn("Failed to load cell values from Google API, using offline fallback:", err);
        loadOfflineFallback(sheetTitle);
      } finally {
        setIsLoadingSheetData(false);
      }
    } else {
      loadOfflineFallback(sheetTitle);
      setIsLoadingSheetData(false);
    }
  };

  const loadMergesFallback = (sheetTitle: string, currentCells?: string[][]) => {
    const cacheKey = `cache_merges_${spreadsheetId || 'default'}_${sheetTitle}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSheetMerges(parsed);
          return;
        }
      } catch (e) {
        console.error("Failed to parse cached merges", e);
      }
    }

    const cellsToCheck = currentCells || sheetCells;
    const detected = detectMergedSectionRows(cellsToCheck);
    if (detected.length > 0) {
      setSheetMerges(detected);
      localStorage.setItem(cacheKey, JSON.stringify(detected));
      return;
    }

    setSheetMerges([]);
  };

  const handleAddMerge = async (merge: SheetMerge) => {
    const newMerges = [
      ...sheetMerges.filter(
        (m) =>
          !(
            m.startRowIndex === merge.startRowIndex &&
            m.startColumnIndex === merge.startColumnIndex
          )
      ),
      merge
    ];
    setSheetMerges(newMerges);
    const cacheKey = `cache_merges_${spreadsheetId || 'default'}_${activeSheetTitle}`;
    localStorage.setItem(cacheKey, JSON.stringify(newMerges));

    if (spreadsheetId && googleToken) {
      try {
        await mergeSheetCells(spreadsheetId, activeSheetGid, merge, googleToken);
      } catch (err) {
        console.warn("Could not sync merge to Google API immediately:", err);
      }
    }
    speakText(`Merged cells from row ${merge.startRowIndex + 1}`);
  };

  const handleRemoveMerge = async (mergeIndex: number) => {
    const target = sheetMerges[mergeIndex];
    const newMerges = sheetMerges.filter((_, idx) => idx !== mergeIndex);
    setSheetMerges(newMerges);
    const cacheKey = `cache_merges_${spreadsheetId || 'default'}_${activeSheetTitle}`;
    localStorage.setItem(cacheKey, JSON.stringify(newMerges));

    if (target && spreadsheetId && googleToken) {
      try {
        await unmergeSheetCells(spreadsheetId, activeSheetGid, target, googleToken);
      } catch (err) {
        console.warn("Could not sync unmerge to Google API immediately:", err);
      }
    }
    speakText("Unmerged cells");
  };

  const loadOfflineFallback = (sheetTitle: string) => {
    const cacheKey = `cache_vals_${spreadsheetId || 'default'}_${sheetTitle}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setSheetCells(parsed);
        setUndoStack([parsed]);
        setRedoStack([]);
        loadMergesFallback(sheetTitle, parsed);
        return;
      } catch (e) {
        console.error(e);
      }
    }

    let initial: string[][] = [];
    if (sheetTitle.toLowerCase().includes("schedule") || sheetTitle.toLowerCase().includes("issue") || sheetTitle === "Schedule") {
      const scheduleFromTasks = formatScheduleToRows(tasks);
      if (scheduleFromTasks.length <= 1) {
        initial = [
          ["Na", "Section or Content", "Title or summary of artx", "Writer", "Graphics/Illus", "Layout", "Online", "Progress", "Draft Link", "Added final artx to layout?"]
        ];
      } else {
        initial = scheduleFromTasks;
      }
    } else if (sheetTitle.toLowerCase().includes("roster") || sheetTitle.toLowerCase().includes("member") || sheetTitle.toLowerCase().includes("team") || sheetTitle === "Roster") {
      initial = formatRosterToRows(members);
    } else {
      initial = [
        ["Na", "Section or Content", "Title or summary of artx", "Writer", "Graphics/Illus", "Layout", "Online", "Progress", "Draft Link", "Added final artx to layout?"]
      ];
    }
    const padded = padSheetData(initial);
    setSheetCells(padded);
    setUndoStack([padded]);
    setRedoStack([]);
    loadMergesFallback(sheetTitle, padded);
  };

  useEffect(() => {
    if (sheetsList.length > 0) {
      loadSheetData(activeSheetTitle);
    }
  }, [activeSheetGid, googleToken, spreadsheetId]);

  // Pad sheet values for editor screen layout
  const padSheetData = (rows: string[][]) => {
    const maxCols = Math.max(10, ...rows.map(r => r.length));
    const result = rows.map(row => {
      const newRow = [...row];
      while (newRow.length < maxCols) {
        newRow.push("");
      }
      return newRow;
    });
    while (result.length < 35) {
      result.push(Array(maxCols).fill(""));
    }
    return result;
  };

  const createBlankGrid = (rowsCount: number, colsCount: number) => {
    return Array(rowsCount).fill(null).map(() => Array(colsCount).fill(""));
  };

  // Synchronize spreadsheet grid data back to Google Sheets
  const saveSheetData = async (cellsToSave = sheetCells) => {
    const activeObj = sheetsList.find(s => s.sheetId === activeSheetGid) || sheetsList[0];
    const sheetTitle = activeObj?.title || "Schedule";

    // Save locally
    localStorage.setItem(`cache_vals_${spreadsheetId || 'default'}_${sheetTitle}`, JSON.stringify(cellsToSave));
    localStorage.setItem(`cache_merges_${spreadsheetId || 'default'}_${sheetTitle}`, JSON.stringify(sheetMerges));

    if (!spreadsheetId || !googleToken) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      return;
    }

    try {
      setIsSaving(true);
      setSyncStatus("merging");
      const trimmed = trimSheetData(cellsToSave);

      const range = `${sheetTitle}!A1:Z${trimmed.length}`;
      await updateSheetValues(spreadsheetId, range, trimmed, googleToken);
      
      setLastSyncedTime(new Date());
      setSaveSuccess(true);
      setSyncError(null);
      setSyncStatus("success");
      setTimeout(() => {
        setSaveSuccess(false);
        setSyncStatus("idle");
      }, 2000);
      speakText("Spreadsheet saved and synchronized with Google Drive.");
    } catch (err: any) {
      console.warn("Failed to save values to sheet via API:", err);
      setSyncError("Saved locally. Direct Google Sheets sync requires re-authentication: " + err.message);
      setSaveSuccess(true);
      setSyncStatus("idle");
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const trimSheetData = (cells: any[][]) => {
    let endRow = cells.length;
    while (endRow > 0 && cells[endRow - 1].every(cell => !cell || String(cell).trim() === "")) {
      endRow--;
    }
    const sliced = cells.slice(0, Math.max(1, endRow));
    
    let maxCol = 1;
    sliced.forEach(row => {
      let rowLen = row.length;
      while (rowLen > 0 && (!row[rowLen - 1] || String(row[rowLen - 1]).trim() === "")) {
        rowLen--;
      }
      if (rowLen > maxCol) {
        maxCol = rowLen;
      }
    });
    
    return sliced.map(row => row.slice(0, maxCol));
  };

  // Online Pubmat Integration: automatically dispatch new or edited rows as pending publication requests
  const dispatchRowsToOnlinePubmat = (rowList: string[][], headers: string[]) => {
    if (!rowList || rowList.length === 0 || !headers || headers.length === 0) return;

    const titleIdx = headers.findIndex(h => {
      const s = h?.toLowerCase() || "";
      return s.includes("title") || s.includes("summary") || s.includes("artx") || s.includes("assignment");
    });

    if (titleIdx === -1) return; // No title column

    const catIdx = headers.findIndex(h => {
      const s = h?.toLowerCase() || "";
      return s.includes("section") || s.includes("content") || s.includes("category") || s.includes("type");
    });
    const writerIdx = headers.findIndex(h => {
      const s = h?.toLowerCase() || "";
      return s.includes("writer") || s.includes("author");
    });
    const graphicsIdx = headers.findIndex(h => {
      const s = h?.toLowerCase() || "";
      return s.includes("graphics") || s.includes("illus");
    });
    const layoutIdx = headers.findIndex(h => {
      const s = h?.toLowerCase() || "";
      return s.includes("layout") || s.includes("artist");
    });
    const onlineIdx = headers.findIndex(h => {
      const s = h?.toLowerCase() || "";
      return s.includes("online");
    });
    const draftIdx = headers.findIndex(h => {
      const s = h?.toLowerCase() || "";
      return s.includes("draft") || s.includes("link") || s.includes("writeup");
    });
    const addedIdx = headers.findIndex(h => {
      const s = h?.toLowerCase() || "";
      return s.includes("added") || s.includes("final") || s.includes("layout?");
    });

    const updatedTasksList = [...tasks];
    let changed = false;

    rowList.forEach((rowValues, rowIdx) => {
      if (!rowValues || rowValues.length === 0) return;
      const title = String(rowValues[titleIdx] || "").trim();
      if (!title) return; // Empty title row

      const typeOfContent = (catIdx !== -1 ? rowValues[catIdx] : "feats artx") || "feats artx";
      const writer = (writerIdx !== -1 ? rowValues[writerIdx] : "Unknown Writer") || "Unknown Writer";
      const illusLayout = (layoutIdx !== -1 ? rowValues[layoutIdx] : "Unassigned") || "Unassigned";
      const graphicsIllus = (graphicsIdx !== -1 ? rowValues[graphicsIdx] : "") || "";
      const onlineHandler = (onlineIdx !== -1 ? rowValues[onlineIdx] : "") || "";
      const draftLink = (draftIdx !== -1 ? rowValues[draftIdx] : "") || "";
      const addedToLayout = (addedIdx !== -1 ? rowValues[addedIdx] : "") || "No";
      const sourceIssueRowId = `sheet-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || Date.now()}`;

      const existingIndex = updatedTasksList.findIndex(t =>
        t.isPendingConfirmation && (
          t.sourceIssueRowId === sourceIssueRowId ||
          t.title.replace(/\s*\(Online Pubmat\)$/i, "").trim().toLowerCase() === title.toLowerCase()
        )
      );

      if (existingIndex !== -1) {
        // Row was EDITED: Sync attributes and trigger pending publication request in Online Pubmat
        const ext = updatedTasksList[existingIndex];
        updatedTasksList[existingIndex] = {
          ...ext,
          title,
          typeOfContent,
          writer,
          illusLayout,
          graphicsIllus: graphicsIllus || ext.graphicsIllus,
          graphics: graphicsIllus || ext.graphics,
          onlineHandler: onlineHandler || ext.onlineHandler,
          progress: "Pending" as any,
          isPendingConfirmation: true, // Dispatch request to Online Pubmat on edit!
          draftLink: draftLink || ext.draftLink,
          writeup: draftLink || ext.writeup,
          addedToLayout: addedToLayout || ext.addedToLayout,
          sourceIssueRowId: ext.sourceIssueRowId || sourceIssueRowId,
          lastUpdated: new Date().toISOString()
        };
      } else {
        // Completely NEW row added: Trigger pending Online Pubmat Entry
        const newTask: Task = {
          id: `sheet-t-${Date.now()}-${rowIdx}`,
          title,
          typeOfRelease: "Issue Article",
          typeOfContent,
          writer,
          illusLayout,
          graphicsIllus,
          graphics: graphicsIllus,
          onlineHandler,
          progress: "Pending" as any,
          priority: "Medium",
          draftLink,
          writeup: draftLink,
          addedToLayout,
          isPendingConfirmation: true, // Dispatches request to Online Pubmat!
          sourceIssueRowId,
          files: [],
          commentsCount: 0,
          revisionCount: 0,
          lastUpdated: new Date().toISOString(),
          releaseDate: "JULY 15"
        };
        updatedTasksList.push(newTask);
      }
      changed = true;
    });

    if (changed) onUpdateTasks(updatedTasksList);
  };

  const dispatchSingleRowToOnlinePubmat = (rowValues: string[], headers: string[]) => {
    dispatchRowsToOnlinePubmat([rowValues], headers);
  };

  // Google Login / Logout
  const handleGoogleLogin = async () => {
    try {
      setSyncStatus("authenticating");
      speakText("Connecting with Google Account...");
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
        setSyncError(null);
        speakText("Connected Google Sheets successfully.");
        await loadSheetsMetadata();
      } else {
        setSyncStatus("idle");
      }
    } catch (err: any) {
      console.warn("Google sign-in issue:", err);
      if (
        err?.code === "auth/cancelled-popup-request" ||
        err?.code === "auth/popup-closed-by-user" ||
        err?.message?.includes("cancelled-popup-request") ||
        err?.message?.includes("popup-closed-by-user")
      ) {
        setSyncError(null);
      } else {
        setSyncError("OAuth failed. Please verify popup blocker.");
      }
    } finally {
      setSyncStatus("idle");
    }
  };

  const handleGoogleLogout = async () => {
    await logout();
    setGoogleUser(null);
    setGoogleToken(null);
    setSheetsList([
      { title: "Schedule", sheetId: 101 },
      { title: "Online Pubmat", sheetId: 103 },
      { title: "Layout Tasks", sheetId: 104 }
    ]);
    setActiveSheetGid(101);
    speakText("Disconnected Google Account.");
  };

  // Auto poll for remote Google Sheets updates (Every 12 seconds)
  useEffect(() => {
    if (!autoSync || !googleToken || syncStatus !== "idle" || activeSubTab !== "editor") {
      setSecondsUntilSync(12);
      return;
    }

    const interval = setInterval(() => {
      setSecondsUntilSync(prev => {
        if (prev <= 1) {
          loadSheetData(activeSheetTitle);
          return 12;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoSync, googleToken, syncStatus, activeSheetTitle, activeSubTab]);

  const handleSaveSheetsLink = () => {
    const trimmed = linkInput.trim();
    onUpdateGoogleSheetsLink(trimmed);
    setSaveSuccess(true);
    speakText("Google Sheets master link updated.");
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Undo / Redo history push
  const pushToUndoStack = (newCells: string[][]) => {
    const updated = [...undoStack, newCells];
    if (updated.length > 30) updated.shift();
    setUndoStack(updated);
    setRedoStack([]);
  };

  const handleCellSelect = (rIdx: number, cIdx: number) => {
    setSelectedCell({ row: rIdx, col: cIdx });
  };

  const handleCellDoubleClick = (rIdx: number, cIdx: number) => {
    // Cell pressing is read-only; editing is only allowed via the Edit button per row
    setSelectedCell({ row: rIdx, col: cIdx });
  };

  const handleCellSave = () => {
    if (!editingCell) return;
    const { row, col } = editingCell;
    const currentVal = sheetCells[row]?.[col] || "";
    if (editingValue !== currentVal) {
      const updated = sheetCells.map((r, rIdx) => {
        if (rIdx === row) {
          return r.map((c, cIdx) => cIdx === col ? editingValue : c);
        }
        return r;
      });
      setSheetCells(updated);
      pushToUndoStack(updated);
      const activeObj = sheetsList.find(s => s.sheetId === activeSheetGid) || sheetsList[0];
      if (activeObj) {
        localStorage.setItem(`cache_vals_${spreadsheetId || 'default'}_${activeObj.title}`, JSON.stringify(updated));
      }
      if (row > 0) {
        dispatchSingleRowToOnlinePubmat(updated[row], sheetCells[0] || []);
      }
      if (autoSync && googleToken) {
        saveSheetData(updated);
      }
    }
    setEditingCell(null);
  };

  const handleUndo = () => {
    if (undoStack.length <= 1) return;
    const previous = undoStack[undoStack.length - 2];
    const current = undoStack[undoStack.length - 1];
    setUndoStack(undoStack.slice(0, undoStack.length - 1));
    setRedoStack([...redoStack, current]);
    setSheetCells(previous);
    speakText("Undo completed");
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(redoStack.slice(0, redoStack.length - 1));
    setUndoStack([...undoStack, next]);
    setSheetCells(next);
    speakText("Redo completed");
  };

  const handleCopyCell = () => {
    if (!selectedCell) return;
    const val = sheetCells[selectedCell.row]?.[selectedCell.col] || "";
    navigator.clipboard.writeText(val);
    speakText("Copied");
  };

  const handlePasteCell = async () => {
    if (!selectedCell) return;
    try {
      const text = await navigator.clipboard.readText();
      const updated = sheetCells.map((row, rIdx) => {
        if (rIdx === selectedCell.row) {
          return row.map((col, cIdx) => cIdx === selectedCell.col ? text : col);
        }
        return row;
      });
      setSheetCells(updated);
      pushToUndoStack(updated);
      speakText("Pasted");
      if (selectedCell.row > 0) {
        dispatchSingleRowToOnlinePubmat(updated[selectedCell.row], sheetCells[0] || []);
      }
      if (autoSync && googleToken) saveSheetData(updated);
    } catch (e) {
      console.error(e);
    }
  };

  // Row Manipulation
  const handleDuplicateRow = (rIndex: number) => {
    const target = sheetCells[rIndex];
    if (!target) return;
    const updated = [...sheetCells];
    updated.splice(rIndex + 1, 0, [...target]);
    setSheetCells(updated);
    pushToUndoStack(updated);
    speakText("Row duplicated");
    if (rIndex > 0) {
      dispatchSingleRowToOnlinePubmat(target, sheetCells[0] || []);
    }
    saveSheetData(updated);
  };

  const handleDeleteRow = (rIndex: number) => {
    if (sheetCells.length <= 2) {
      alert("Cannot delete final rows. The sheet requires at least a header and one data row.");
      return;
    }
    const updated = sheetCells.filter((_, idx) => idx !== rIndex);
    while (updated.length < 35) {
      updated.push(Array(sheetCells[0]?.length || 10).fill(""));
    }
    setSheetCells(updated);
    pushToUndoStack(updated);
    speakText("Row removed");
    saveSheetData(updated);
  };

  // Adding/Editing Row workflow
  const handleAddRowClick = () => {
    setEditingRowIdx(null);
    setArtxDocTitle("");
    setArtxDocUrl("");
    const colCount = sheetCells[0]?.length || 10;
    const initialValues = Array(colCount).fill("");
    // Find progress column and set it to "drafting" by default
    const headers = sheetCells[0] || [];
    const progressIdx = headers.findIndex(h => {
      const s = h?.toLowerCase() || "";
      return s.includes("progress") || s.includes("status");
    });
    const addedToLayoutIdx = headers.findIndex(h => {
      const s = h?.toLowerCase() || "";
      return s.includes("added final") || s.includes("artx to layout") || s.includes("final artx") || s.includes("layout to artx");
    });
    if (progressIdx !== -1) {
      initialValues[progressIdx] = "drafting";
    }
    if (addedToLayoutIdx !== -1) {
      initialValues[addedToLayoutIdx] = "No";
    }
    setAddRowValues(initialValues);
    setShowAddRowModal(true);
  };

  const handleEditRowClick = (originalIndex: number) => {
    setEditingRowIdx(originalIndex);
    // Copy the existing row values
    const currentValues = [...sheetCells[originalIndex]];
    setAddRowValues(currentValues);

    const headers = sheetCells[0] || [];
    const draftLinkIdx = headers.findIndex(h => {
      const s = h?.toLowerCase() || "";
      return s.includes("draft link") || s.includes("draft") || s.includes("writeup") || s.includes("artx doc") || s.includes("document link") || s.includes("link");
    });
    const titleIdx = headers.findIndex(h => {
      const s = h?.toLowerCase() || "";
      return s.includes("title") || s.includes("summary") || s.includes("artx") || s.includes("assignment");
    });

    const draftCellVal = draftLinkIdx !== -1 ? currentValues[draftLinkIdx] : "";
    const rowTitle = titleIdx !== -1 ? currentValues[titleIdx] : "";
    const details = extractHyperlinkDetails(draftCellVal);

    const cleanTitleCandidate = (titleStr: string) => {
      if (!titleStr) return "";
      const d = extractHyperlinkDetails(titleStr);
      if (d.label && !d.label.startsWith("=HYPERLINK") && !d.label.startsWith("http://") && !d.label.startsWith("https://")) {
        return d.label;
      }
      if (!titleStr.startsWith("=HYPERLINK") && !titleStr.startsWith("http://") && !titleStr.startsWith("https://")) {
        return titleStr;
      }
      return "";
    };

    let validUrl = details.url && (details.url.startsWith("http://") || details.url.startsWith("https://")) ? details.url : "";
    let validTitle = cleanTitleCandidate(details.label) || cleanTitleCandidate(draftCellVal);

    // 0. The title cell (or any other cell) may itself be a hyperlink to the ArtX
    //    Google Doc. Prefer the title cell's own link, then any docs link in the
    //    row, so the ArtX URL field auto-fills from whatever link the title carries.
    const findDocsLink = (idxList: number[]) => {
      for (const i of idxList) {
        const c = currentValues[i];
        if (c && typeof c === "string") {
          const d = extractHyperlinkDetails(c);
          if (isGoogleDocsLink(d.url)) return d;
        }
      }
      return null;
    };
    const docsHit =
      (titleIdx !== -1 ? findDocsLink([titleIdx]) : null) ||
      findDocsLink(currentValues.map((_, i) => i));
    if (docsHit) {
      validUrl = docsHit.url;
      if (!validTitle) validTitle = cleanTitleCandidate(docsHit.label);
    }

    // 1. Check all other cells in this row for a valid HTTP/HTTPS URL if draft link cell has none
    if (!validUrl) {
      for (const cell of currentValues) {
        if (cell && typeof cell === "string") {
          const d = extractHyperlinkDetails(cell);
          if (d.url && (d.url.startsWith("http://") || d.url.startsWith("https://"))) {
            validUrl = d.url;
            if (!validTitle) {
              validTitle = cleanTitleCandidate(d.label);
            }
            break;
          }
        }
      }
    }

    // 2. Cross-reference matching task from tasks list if still no valid URL
    if (!validUrl) {
      const matchingTask = tasks.find(t => {
        if (!t) return false;
        const tTitle = (t.title || "").toLowerCase().trim();
        const tWriteup = (t.writeup || "").toLowerCase().trim();
        const rTitle = (rowTitle || "").toLowerCase().trim();
        const dVal = (draftCellVal || "").toLowerCase().trim();
        return (
          (rTitle && tTitle === rTitle) ||
          (dVal && tTitle === dVal) ||
          (dVal && tWriteup === dVal) ||
          (t.draftLink && dVal && t.draftLink.toLowerCase().includes(dVal))
        );
      });

      if (matchingTask) {
        const candidateLink = matchingTask.draftLink || matchingTask.pubmatLink || matchingTask.addedToLayout || "";
        const d = extractHyperlinkDetails(candidateLink);
        if (d.url && (d.url.startsWith("http://") || d.url.startsWith("https://"))) {
          validUrl = d.url;
          if (!validTitle) {
            validTitle = cleanTitleCandidate(matchingTask.writeup) || cleanTitleCandidate(matchingTask.title) || cleanTitleCandidate(d.label);
          }
        }
      }
    }

    setArtxDocTitle(cleanTitleCandidate(validTitle));
    setArtxDocUrl(validUrl);

    setShowAddRowModal(true);
  };

  const handleAddRowConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const headers = sheetCells[0] || [];
    
    const titleIdx = headers.findIndex(h => {
      const s = h?.toLowerCase() || "";
      return s.includes("title") || s.includes("summary") || s.includes("artx") || s.includes("assignment");
    });
    const catIdx = headers.findIndex(h => {
      const s = h?.toLowerCase() || "";
      return s.includes("section") || s.includes("content") || s.includes("category") || s.includes("type");
    });
    const writerIdx = headers.findIndex(h => {
      const s = h?.toLowerCase() || "";
      return s.includes("writer") || s.includes("author");
    });
    const progressIdx = headers.findIndex(h => {
      const s = h?.toLowerCase() || "";
      return s.includes("progress") || s.includes("status");
    });

    if (titleIdx !== -1) {
      if (!String(addRowValues[titleIdx] || "").trim()) {
        alert("The Title field is required!");
        return;
      }
      if (catIdx !== -1 && !String(addRowValues[catIdx] || "").trim()) {
        alert("The Section field is required!");
        return;
      }
      if (writerIdx !== -1 && !String(addRowValues[writerIdx] || "").trim()) {
        alert("The Writer field is required!");
        return;
      }
    } else {
      const hasAny = addRowValues.some(v => v !== null && v !== undefined && String(v).trim() !== "");
      if (!hasAny) {
        alert("Please enter at least one cell value!");
        return;
      }
    }

    const finalValues = [...addRowValues];
    if (editingRowIdx === null && progressIdx !== -1) {
      finalValues[progressIdx] = "drafting";
    }

    // Format Draft Link (ArtX document) cell with hyperlink if title or URL provided
    const draftLinkIdx = headers.findIndex(h => {
      const s = h?.toLowerCase() || "";
      return s.includes("draft link") || s.includes("draft") || s.includes("writeup") || s.includes("artx doc") || s.includes("document link");
    });
    const addedToLayoutIdx = headers.findIndex(h => {
      const s = h?.toLowerCase() || "";
      return s.includes("added final") || s.includes("artx to layout") || s.includes("final artx");
    });

    const cleanUrl = artxDocUrl.trim();
    const cleanTitle = artxDocTitle.trim();
    const isCleanUrlValid = cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://");

    if (draftLinkIdx !== -1) {
      if (isCleanUrlValid && cleanTitle) {
        finalValues[draftLinkIdx] = `=HYPERLINK("${cleanUrl}", "${cleanTitle}")`;
      } else if (isCleanUrlValid) {
        finalValues[draftLinkIdx] = `=HYPERLINK("${cleanUrl}", "${cleanUrl}")`;
      } else if (cleanTitle) {
        finalValues[draftLinkIdx] = cleanTitle;
      } else {
        finalValues[draftLinkIdx] = "";
      }
    }

    if (addedToLayoutIdx !== -1) {
      if (editingRowIdx === null) {
        finalValues[addedToLayoutIdx] = "No";
      } else if (!finalValues[addedToLayoutIdx] || !String(finalValues[addedToLayoutIdx]).trim()) {
        finalValues[addedToLayoutIdx] = "No";
      }
    }

    const updated = [...sheetCells];

    if (editingRowIdx !== null) {
      updated[editingRowIdx] = [...finalValues];
    } else {
      let insertIndex = 1;
      while (insertIndex < updated.length && updated[insertIndex].some(v => v !== null && v !== undefined && String(v).trim() !== "")) {
        insertIndex++;
      }

      if (insertIndex < updated.length) {
        updated[insertIndex] = [...finalValues];
      } else {
        updated.push([...finalValues]);
      }
    }

    // Renumber index if "Na" column exists
    if (headers[0]?.toLowerCase() === "na") {
      let counter = 1;
      for (let i = 1; i < updated.length; i++) {
        if (updated[i].slice(1).some(v => v !== null && v !== undefined && String(v).trim() !== "")) {
          updated[i][0] = counter.toString();
          counter++;
        } else {
          updated[i][0] = "";
        }
      }
    }

    setSheetCells(updated);
    pushToUndoStack(updated);
    setShowAddRowModal(false);
    
    // Dispatch ONLY this edited/new row to Online Pubmat as a publication request
    dispatchSingleRowToOnlinePubmat(finalValues, headers);

    if (editingRowIdx !== null) {
      speakText("Row details updated and dispatched.");
      setEditingRowIdx(null);
    } else {
      speakText("New row added and dispatched.");
    }
    saveSheetData(updated);
  };

  // Sheet operations (Navigation actions)
  const handleCreateSheetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSheetTitle.trim()) return;

    const title = newSheetTitle.trim();
    setShowCreateSheetModal(false);
    setNewSheetTitle("");

    if (!googleToken || !spreadsheetId) {
      const mockId = Date.now();
      const newSheet = { title, sheetId: mockId };
      setSheetsList([...sheetsList, newSheet]);
      setActiveSheetGid(mockId);

      const templateGrid = useTemplateOption
        ? padSheetData([
            ["Na", "Section or Content", "Title or summary of artx", "Writer", "Graphics/Illus", "Layout", "Online", "Progress", "Draft Link", "Added final artx to layout?"],
            ["1", "feats artx", "Standard Feature Article", "Author Name", "", "Unassigned", "", "Not Started", "", ""]
          ])
        : createBlankGrid(25, 10);

      setSheetCells(templateGrid);
      localStorage.setItem(`cache_vals_default_${title}`, JSON.stringify(templateGrid));
      speakText(`Created worksheet ${title}`);
      return;
    }

    try {
      setIsLoadingSheets(true);
      await createSheetTab(spreadsheetId, title, googleToken);
      
      if (useTemplateOption) {
        setTimeout(async () => {
          const templateGrid = [
            ["Na", "Section or Content", "Title or summary of artx", "Writer", "Graphics/Illus", "Layout", "Online", "Progress", "Draft Link", "Added final artx to layout?"],
            ["1", "feats artx", "Template Sample Article", "Author Name", "", "Unassigned", "", "Not Started", "", ""]
          ];
          await updateSheetValues(spreadsheetId, `${title}!A1:J2`, templateGrid, googleToken);
          await loadSheetsMetadata();
        }, 1200);
      } else {
        await loadSheetsMetadata();
      }
      speakText(`Created worksheet ${title} in Google Sheets`);
    } catch (err: any) {
      setSyncError("Failed to create worksheet: " + err.message);
    } finally {
      setIsLoadingSheets(false);
    }
  };

  const handleRenameSheetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameSheetNewTitle.trim() || renameSheetId === null) return;

    const newTitle = renameSheetNewTitle.trim();
    const oldTitle = renameSheetOldTitle;
    const sId = renameSheetId;

    setShowRenameModal(false);
    setRenameSheetNewTitle("");

    if (!googleToken || !spreadsheetId) {
      const updated = sheetsList.map(s => s.sheetId === sId ? { ...s, title: newTitle } : s);
      setSheetsList(updated);
      const cached = localStorage.getItem(`cache_vals_default_${oldTitle}`);
      if (cached) {
        localStorage.setItem(`cache_vals_default_${newTitle}`, cached);
        localStorage.removeItem(`cache_vals_default_${oldTitle}`);
      }
      speakText(`Renamed sheet to ${newTitle}`);
      return;
    }

    try {
      setIsLoadingSheets(true);
      await renameSheetTab(spreadsheetId, sId, newTitle, googleToken);
      await loadSheetsMetadata();
      speakText(`Renamed sheet to ${newTitle}`);
    } catch (err: any) {
      setSyncError("Rename failed: " + err.message);
    } finally {
      setIsLoadingSheets(false);
    }
  };

  const handleDuplicateSheetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!duplicateSheetNewTitle.trim() || duplicateSheetId === null) return;

    const newTitle = duplicateSheetNewTitle.trim();
    const sourceTitle = duplicateSheetTitle;
    const sId = duplicateSheetId;

    setShowDuplicateModal(false);
    setDuplicateSheetNewTitle("");

    if (!googleToken || !spreadsheetId) {
      const mockId = Date.now();
      const updated = [...sheetsList, { title: newTitle, sheetId: mockId }];
      setSheetsList(updated);
      setActiveSheetGid(mockId);
      const cached = localStorage.getItem(`cache_vals_default_${sourceTitle}`);
      if (cached) {
        localStorage.setItem(`cache_vals_default_${newTitle}`, cached);
      }
      speakText(`Duplicated worksheet to ${newTitle}`);
      return;
    }

    try {
      setIsLoadingSheets(true);
      await duplicateSheetTab(spreadsheetId, sId, newTitle, googleToken);
      await loadSheetsMetadata();
      speakText(`Duplicated sheet to ${newTitle}`);
    } catch (err: any) {
      setSyncError("Duplicate failed: " + err.message);
    } finally {
      setIsLoadingSheets(false);
    }
  };

  const handleDeleteSheetConfirm = async () => {
    if (deleteSheetId === null) return;
    const sId = deleteSheetId;
    const title = deleteSheetTitle;

    setShowDeleteConfirmModal(false);

    if (sheetsList.length <= 1) {
      alert("Cannot delete the only sheet in your spreadsheet tracker.");
      return;
    }

    if (!googleToken || !spreadsheetId) {
      const updated = sheetsList.filter(s => s.sheetId !== sId);
      setSheetsList(updated);
      localStorage.removeItem(`cache_vals_default_${title}`);
      if (activeSheetGid === sId) {
        setActiveSheetGid(updated[0].sheetId);
      }
      speakText(`Deleted sheet ${title}`);
      return;
    }

    try {
      setIsLoadingSheets(true);
      await deleteSheetTab(spreadsheetId, sId, googleToken);
      const metadata = await fetchSpreadsheetMetadata(spreadsheetId, googleToken);
      const list = metadata.map(sheet => ({
        title: sheet.title,
        sheetId: (sheet as any).sheetId ?? 0
      }));
      setSheetsList(list);
      if (activeSheetGid === sId && list.length > 0) {
        setActiveSheetGid(list[0].sheetId);
      }
      speakText(`Deleted worksheet ${title}`);
    } catch (err: any) {
      setSyncError("Delete failed: " + err.message);
    } finally {
      setIsLoadingSheets(false);
    }
  };

  // Search, sorting, and filtering logic
  const getFilteredAndSortedRows = () => {
    if (sheetCells.length <= 1) return [];
    
    let rows = sheetCells.slice(1).map((row, index) => ({ row, originalIndex: index + 1 }));
    
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(item => 
        item.row.some(cell => cell?.toLowerCase().includes(q))
      );
    }
    
    if (filterCol !== -1 && filterVal !== "") {
      rows = rows.filter(item => 
        item.row[filterCol]?.toLowerCase() === filterVal.toLowerCase()
      );
    }
    
    if (sortCol !== -1) {
      rows.sort((a, b) => {
        const valA = a.row[sortCol] || "";
        const valB = b.row[sortCol] || "";
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortDir === "asc" ? numA - numB : numB - numA;
        }
        return sortDir === "asc" 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      });
    }
    
    return rows;
  };

  const filteredSortedRows = getFilteredAndSortedRows();
  const renderedItems = filteredSortedRows;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const totalPages = Math.max(1, Math.ceil(renderedItems.length / rowsPerPage));
  const paginatedRows = renderedItems.slice(startIndex, currentPage * rowsPerPage);

  const getColLetter = (index: number) => {
    return String.fromCharCode(65 + index);
  };

  const handleSaveCustomConfig = () => {
    setConfigError("");
    setConfigSaveSuccess(false);

    if (!useCustomConfig) {
      localStorage.removeItem("custom_firebase_config");
      setConfigSaveSuccess(true);
      speakText("Reset credentials.");
      setTimeout(() => window.location.reload(), 1000);
      return;
    }

    try {
      const parsed = JSON.parse(customConfigInput);
      if (!parsed.apiKey || !parsed.authDomain || !parsed.projectId) {
        throw new Error("Missing required fields (apiKey, authDomain, projectId)");
      }
      localStorage.setItem("custom_firebase_config", JSON.stringify(parsed));
      setConfigSaveSuccess(true);
      speakText("Custom credentials saved.");
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      setConfigError("Invalid JSON snippet: " + err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
      
      {/* Dynamic Sheets/Pages Navigator */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-neutral-200 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-neutral-500 text-xs font-bold font-mono uppercase tracking-wider mr-2">
            <Layers className="w-3.5 h-3.5 text-neutral-400" />
            <span>Worksheets:</span>
          </div>

          {isLoadingSheets ? (
            <div className="text-[11px] text-neutral-500 font-medium flex items-center gap-2 bg-neutral-100 px-3 py-1.5 rounded-xl">
              <RefreshCw className="w-3 h-3 animate-spin text-brand-maroon" />
              <span>Fetching sheets metadata...</span>
            </div>
          ) : sheetsList.length > 0 ? (
            sheetsList.map((sheet) => {
              const isActive = activeSheetGid === sheet.sheetId;
              return (
                <div key={sheet.sheetId} className="flex items-center">
                  <button
                    onClick={() => {
                      setActiveSheetGid(sheet.sheetId);
                      setCurrentPage(1);
                      setSelectedCell(null);
                      setEditingCell(null);
                      speakText(`Switched page view to ${sheet.title}`);
                    }}
                    className={`px-3.5 py-1.5 rounded-l-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                      isActive
                        ? "bg-brand-maroon text-white border-brand-maroon shadow-sm"
                        : "bg-white hover:bg-neutral-50 text-neutral-700 border-neutral-200 hover:text-neutral-900"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-white" : "bg-neutral-300"}`} />
                    {sheet.title}
                  </button>

                  {/* Sheet actions dropdown / icons (only for admins) */}
                  <div className={`flex border-y border-r rounded-r-xl overflow-hidden bg-white ${isActive ? "border-brand-maroon/40" : "border-neutral-200"}`}>
                    <button
                      onClick={() => {
                        setRenameSheetId(sheet.sheetId);
                        setRenameSheetOldTitle(sheet.title);
                        setRenameSheetNewTitle(sheet.title);
                        setShowRenameModal(true);
                      }}
                      title="Rename Sheet"
                      className="p-1 px-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 border-r border-neutral-100 cursor-pointer"
                    >
                      <Edit className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        setDuplicateSheetId(sheet.sheetId);
                        setDuplicateSheetTitle(sheet.title);
                        setDuplicateSheetNewTitle(`${sheet.title} (Copy)`);
                        setShowDuplicateModal(true);
                      }}
                      title="Duplicate Sheet"
                      className="p-1 px-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 border-r border-neutral-100 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        setDeleteSheetId(sheet.sheetId);
                        setDeleteSheetTitle(sheet.title);
                        setShowDeleteConfirmModal(true);
                      }}
                      title="Delete Sheet"
                      className="p-1 px-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-[11px] text-neutral-400 italic">No worksheets loaded</div>
          )}

          {/* Add Sheet Trigger Button */}
          <button
            onClick={() => setShowCreateSheetModal(true)}
            className="p-2 border border-dashed border-neutral-300 hover:border-brand-maroon text-neutral-600 hover:text-brand-maroon hover:bg-neutral-50 rounded-xl cursor-pointer ml-1"
            title="Create New Worksheet"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Subsection Switch Tabs */}
        <div className="flex bg-neutral-100/80 p-1 rounded-xl self-start lg:self-auto border border-neutral-200/50">
          <button
            onClick={() => setActiveSubTab("editor")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === "editor" 
                ? "bg-white text-gray-900 shadow-xs border border-neutral-200" 
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Interactive Editor</span>
          </button>
          <button
            onClick={() => setActiveSubTab("viewer")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === "viewer" 
                ? "bg-white text-gray-900 shadow-xs border border-neutral-200" 
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Maximize className="w-3.5 h-3.5" />
            <span>Sheets Viewer</span>
            {sheetMerges.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 font-mono text-[10px] font-bold">
                {sheetMerges.length} merges
              </span>
            )}
          </button>
        </div>
      </div>

      {/* SUBSECTION 1: SPREADSHEET EDITOR GRID */}
      {activeSubTab === "editor" && (
        <div className="bg-white rounded-3xl border border-neutral-150 shadow-xs p-5 space-y-4 text-left">
          
          {/* Controls bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            
            {/* Search, Filter, Sort Row */}
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search values in cells..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 pr-4 py-2 w-full border border-neutral-200 bg-white rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-maroon"
                />
              </div>

              {/* Dynamic Column Selector for Filter */}
              {sheetCells[0] && (
                <div className="flex items-center gap-2">
                  <select
                    value={filterCol}
                    onChange={(e) => {
                      setFilterCol(parseInt(e.target.value));
                      setFilterVal("");
                      setCurrentPage(1);
                    }}
                    className="p-2 border border-neutral-200 rounded-xl text-xs bg-white text-neutral-700"
                  >
                    <option value="-1">All Columns</option>
                    {sheetCells[0].map((h, idx) => (
                      h ? <option key={idx} value={idx}>{h}</option> : null
                    ))}
                  </select>

                  {filterCol !== -1 && (
                    <input
                      type="text"
                      placeholder="Filter match..."
                      value={filterVal}
                      onChange={(e) => {
                        setFilterVal(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="px-3 py-1.5 border border-neutral-200 rounded-xl text-xs bg-white text-neutral-800 outline-none focus:ring-1 focus:ring-brand-maroon"
                    />
                  )}
                </div>
              )}

              {/* Column Sort Selector */}
              {sheetCells[0] && (
                <div className="flex items-center gap-1">
                  <select
                    value={sortCol}
                    onChange={(e) => setSortCol(parseInt(e.target.value))}
                    className="p-2 border border-neutral-200 rounded-xl text-xs bg-white text-neutral-700"
                  >
                    <option value="-1">No Sort</option>
                    {sheetCells[0].map((h, idx) => (
                      h ? <option key={idx} value={idx}>Sort by: {h}</option> : null
                    ))}
                  </select>
                  {sortCol !== -1 && (
                    <button
                      onClick={() => setSortDir(prev => prev === "asc" ? "desc" : "asc")}
                      className="p-2 border border-neutral-200 hover:bg-neutral-50 rounded-xl cursor-pointer"
                      title="Toggle Direction"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Quick Actions Panel: Undo/Redo, Copy/Paste, Add Row, Save */}
            <div className="flex flex-wrap items-center justify-end gap-2.5 shrink-0">
              <div className="flex items-center gap-1 border-r pr-3 border-neutral-200">
                <button
                  onClick={handleUndo}
                  disabled={undoStack.length <= 1}
                  className="p-2 border border-neutral-250 bg-white hover:bg-neutral-50 rounded-xl text-neutral-600 hover:text-neutral-900 disabled:opacity-40 cursor-pointer"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className="p-2 border border-neutral-250 bg-white hover:bg-neutral-50 rounded-xl text-neutral-600 hover:text-neutral-900 disabled:opacity-40 cursor-pointer"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1 border-r pr-3 border-neutral-200">
                <button
                  onClick={handleCopyCell}
                  disabled={!selectedCell}
                  className="p-2 border border-neutral-250 bg-white hover:bg-neutral-50 rounded-xl text-neutral-600 hover:text-neutral-900 disabled:opacity-40 cursor-pointer"
                  title="Copy Selected Cell"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handlePasteCell}
                  disabled={!selectedCell}
                  className="p-2 border border-neutral-250 bg-white hover:bg-neutral-50 rounded-xl text-neutral-600 hover:text-neutral-900 disabled:opacity-40 cursor-pointer"
                  title="Paste Clipboard Content"
                >
                  <ListPlus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Merged Cells Management Button & Highlight Toggle */}
              <div className="flex items-center gap-1.5 border-r pr-3 border-neutral-200">
                <button
                  onClick={() => {
                    if (selectedCell) {
                      setMergeFormStartRow(selectedCell.row + 1);
                      setMergeFormEndRow(selectedCell.row + 1);
                      setMergeFormStartCol(selectedCell.col);
                      setMergeFormEndCol(Math.min((sheetCells[0]?.length || 10) - 1, selectedCell.col + 1));
                    }
                    setShowMergeModal(true);
                  }}
                  className="px-3 py-2 border border-neutral-250 bg-white hover:bg-neutral-50 rounded-xl text-neutral-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  title="Manage Merged Cells & Folio Section Banners"
                >
                  <Layers className="w-3.5 h-3.5 text-brand-maroon" />
                  <span>Merges ({sheetMerges.length})</span>
                </button>
                <button
                  onClick={() => setHighlightMerges(prev => !prev)}
                  className={`p-2 border rounded-xl cursor-pointer text-xs font-bold flex items-center gap-1 transition-colors ${
                    highlightMerges ? "bg-amber-100/80 border-amber-300 text-amber-900" : "bg-white border-neutral-250 text-neutral-600 hover:bg-neutral-50"
                  }`}
                  title="Toggle Highlighting of Merged Cells"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={handleAddRowClick}
                className="px-3 py-2 bg-neutral-900 text-white text-xs font-bold rounded-xl hover:bg-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Row</span>
              </button>

              <button
                onClick={() => saveSheetData()}
                disabled={isSaving}
                className="px-4 py-2 bg-brand-maroon text-white text-xs font-bold rounded-xl hover:bg-brand-maroon-dark transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? "Saving..." : "Save Changes"}</span>
              </button>
            </div>
          </div>

          {/* Grid / Table Layout */}
          <div className="overflow-x-auto border border-neutral-200 rounded-2xl shadow-inner bg-neutral-50">
            {isLoadingSheetData ? (
              <div className="py-24 text-center text-neutral-500 font-medium flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 text-brand-maroon animate-spin" />
                <span className="text-xs">Loading worksheet cell coordinates from database...</span>
              </div>
            ) : sheetCells.length === 0 ? (
              <div className="py-24 text-center text-neutral-400 italic">No columns or values parsed. Try refreshing.</div>
            ) : (
              <table className="w-full border-collapse text-[11px] table-fixed">
                <thead>
                  {/* Top Header representing Excel style columns A, B, C, D */}
                  <tr className="bg-neutral-100 divide-x divide-neutral-250 border-b border-neutral-250">
                    <th className="w-12 bg-neutral-100 text-neutral-500 font-mono text-center py-1.5 select-none font-bold">#</th>
                    {sheetCells[0].map((_, index) => (
                      <th key={index} className="min-w-[135px] text-neutral-500 font-mono text-center select-none py-1.5 font-bold uppercase tracking-wider">
                        {getColLetter(index)}
                      </th>
                    ))}
                    <th className="w-24 bg-neutral-100 text-neutral-500 font-mono text-center py-1.5 select-none font-bold">Actions</th>
                  </tr>

                  {/* Spreadsheet Header labels (Row 1 of cells) */}
                  <tr className="bg-neutral-100/70 text-gray-950 font-black divide-x divide-neutral-250 border-b border-neutral-200">
                    <td className="text-center font-mono py-2 font-bold select-none bg-neutral-100 text-neutral-400">1</td>
                    {sheetCells[0].map((cell, index) => {
                      const isSelected = selectedCell?.row === 0 && selectedCell?.col === index;

                      return (
                        <td
                          key={index}
                          onClick={() => handleCellSelect(0, index)}
                          className={`px-3 py-2 select-text truncate text-center font-display font-extrabold cursor-pointer transition-all ${
                            isSelected ? "outline outline-2 outline-brand-maroon outline-offset-[-2px] bg-brand-maroon/5 text-gray-950" : "hover:bg-neutral-50"
                          }`}
                        >
                          {cell || <span className="text-gray-300 italic">Header</span>}
                        </td>
                      );
                    })}
                    <td className="bg-neutral-100 text-center text-gray-400 select-none font-semibold">-</td>
                  </tr>
                </thead>

                <tbody className="divide-y divide-neutral-200">
                  {paginatedRows.map(({ row, originalIndex }) => (
                    <tr 
                      key={originalIndex} 
                      className={`divide-x divide-neutral-200 hover:bg-neutral-50/50 transition-colors ${
                        originalIndex % 2 === 0 ? "bg-white" : "bg-neutral-50/20"
                      }`}
                    >
                      {/* Row Label (numbered column on the left) */}
                      <td className="text-center font-mono py-2 text-neutral-400 bg-neutral-100 font-medium select-none w-12 border-r border-neutral-200">
                        {originalIndex + 1}
                      </td>

                      {/* Spreadsheet Cell items */}
                      {row.map((cell, cIdx) => {
                        const mergeInfo = getCellMergeInfo(originalIndex, cIdx, sheetMerges);
                        if (mergeInfo.inMerge && !mergeInfo.isOrigin) {
                          return null;
                        }
                        const isSelected = selectedCell?.row === originalIndex && selectedCell?.col === cIdx;
                        const isMergedOrigin = mergeInfo.inMerge && mergeInfo.isOrigin;
                        const isSectionBanner = isMergedOrigin && mergeInfo.colSpan >= 3;

                        return (
                          <td
                            key={cIdx}
                            colSpan={mergeInfo.colSpan}
                            rowSpan={mergeInfo.rowSpan}
                            onClick={() => handleCellSelect(originalIndex, cIdx)}
                            className={`px-3 py-2 truncate relative cursor-pointer font-medium text-neutral-800 transition-all ${
                              isSelected ? "outline outline-2 outline-brand-maroon outline-offset-[-2px] bg-brand-maroon/5 font-semibold text-gray-950" : ""
                            } ${
                              isSectionBanner
                                ? "bg-red-50/70 font-bold text-neutral-900 border-y border-brand-maroon/20"
                                : isMergedOrigin && highlightMerges
                                ? "bg-amber-50/70 border border-amber-200"
                                : ""
                            }`}
                          >
                            {isMergedOrigin && highlightMerges && (
                              <span className="absolute top-1 right-1.5 px-1.5 py-0.2 rounded bg-amber-200/90 text-amber-900 text-[9px] font-mono font-bold shadow-2xs pointer-events-none">
                                {mergeInfo.colSpan > 1 ? `⇄ ${mergeInfo.colSpan} cols` : `⇅ ${mergeInfo.rowSpan} rows`}
                              </span>
                            )}
                            {(() => {
                              if (cell === null || cell === undefined || cell === "") return <span className="text-gray-300 italic font-normal">-</span>;
                              const trimmed = String(cell).trim();
                              if (!trimmed) return <span className="text-gray-300 italic font-normal">-</span>;
                              const hyperMatch = trimmed.match(/^=HYPERLINK\(\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?\s*\)$/i);
                              if (hyperMatch) {
                                return <CellLink url={hyperMatch[1]} label={hyperMatch[2] || hyperMatch[1]} stopPropagation />;
                              }
                              if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
                                return <CellLink url={trimmed} label={trimmed} stopPropagation />;
                              }
                              return cell;
                            })()}
                          </td>
                        );
                      })}

                      {/* Action trigger columns */}
                      <td className="px-2 py-1.5 text-center flex items-center justify-center gap-1.5 min-w-[130px] border-l border-neutral-200 bg-neutral-50/40">
                        <button
                          onClick={() => handleEditRowClick(originalIndex)}
                          title="Edit Row Details"
                          className="px-2.5 py-1 bg-brand-maroon/10 hover:bg-brand-maroon text-brand-maroon hover:text-white font-bold rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDuplicateRow(originalIndex)}
                          title="Duplicate Row"
                          className="p-1 hover:bg-neutral-250 text-neutral-500 hover:text-neutral-900 rounded cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRow(originalIndex)}
                          title="Delete Row"
                          className="p-1 hover:bg-red-50 text-neutral-500 hover:text-red-600 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Grid Footer Pagination */}
          {!isLoadingSheetData && sheetCells.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-neutral-100 text-xs">
              <span className="text-neutral-500 font-medium">
                Showing {startIndex + 1} to {Math.min(startIndex + rowsPerPage, renderedItems.length)} of {renderedItems.length} spreadsheet rows
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-neutral-200 bg-white hover:bg-neutral-50 rounded-xl text-neutral-500 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-bold text-neutral-800">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-neutral-200 bg-white hover:bg-neutral-50 rounded-xl text-neutral-500 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Spreadsheet instructions */}
          <div className="text-[11px] text-neutral-400 font-medium bg-neutral-50 p-3 rounded-xl border border-neutral-100 flex items-start gap-2 leading-relaxed">
            <HelpCircle className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-neutral-700">How to Edit Rows:</span> Click the <span className="font-bold text-brand-maroon">Edit</span> button on any row to update fields. Direct cell pressing on the grid is disabled to prevent accidental field modifications. Every edited or added row automatically dispatches a pending publication request to the <span className="font-bold text-neutral-800">Online Pubmat</span> section for layout assignment reviews.
            </div>
          </div>
        </div>
      )}

      {/* SUBSECTION 2: SHEETS VIEWER WITH MERGED CELLS */}
      {activeSubTab === "viewer" && (
        <div className={`bg-white rounded-3xl border border-neutral-150 shadow-xs p-5 space-y-4 relative flex flex-col text-left transition-all ${
          isFullscreen ? "fixed inset-0 z-50 rounded-none overflow-auto p-6 bg-white" : ""
        }`}>
          
          {/* Enhanced Viewer Action Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 border-b pb-3 border-neutral-100">
            
            {/* Sheet indicator stats details & Mode Switcher */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="p-2.5 bg-red-50 text-brand-maroon rounded-xl">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-black text-neutral-900 text-sm">
                    Sheets Viewer Screen
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-maroon/10 text-brand-maroon border border-brand-maroon/20">
                    Merged Cells Enabled
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 font-medium">
                  {viewerMode === "grid" 
                    ? "Read-only presentation mode reflecting all column spans, section banners & merged cells."
                    : "Direct Google Drive embedded presentation iframe."}
                </p>
              </div>

              {/* View Mode Switcher Toggle */}
              <div className="flex items-center bg-neutral-100 p-1 rounded-xl border border-neutral-200 text-xs font-bold ml-0 sm:ml-2">
                <button
                  onClick={() => setViewerMode("grid")}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewerMode === "grid"
                      ? "bg-white text-gray-900 shadow-xs border border-neutral-200"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                  title="Spreadsheet table view with merged cells & folio banners"
                >
                  <Table className="w-3.5 h-3.5 text-brand-maroon" />
                  <span>Sheet Grid View</span>
                </button>
                <button
                  onClick={() => setViewerMode("iframe")}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewerMode === "iframe"
                      ? "bg-white text-gray-900 shadow-xs border border-neutral-200"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                  title="Google Drive native iframe viewer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                  <span>Drive Iframe</span>
                </button>
              </div>
            </div>

            {/* Viewer Controls: Search, Highlight Merges, Manage, Zoom, Print, Fullscreen */}
            <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
              {viewerMode === "grid" && (
                <>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search viewer cells..."
                      value={viewerSearch}
                      onChange={(e) => setViewerSearch(e.target.value)}
                      className="pl-8 pr-7 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs w-36 sm:w-44 focus:w-56 transition-all focus:bg-white focus:ring-1 focus:ring-brand-maroon outline-none"
                    />
                    {viewerSearch && (
                      <button
                        onClick={() => setViewerSearch("")}
                        className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setHighlightMerges(prev => !prev)}
                    className={`px-3 py-1.5 border rounded-xl cursor-pointer text-xs font-bold flex items-center gap-1.5 transition-colors ${
                      highlightMerges 
                        ? "bg-amber-100 border-amber-300 text-amber-900" 
                        : "bg-white border-neutral-250 text-neutral-600 hover:bg-neutral-50"
                    }`}
                    title="Toggle visual highlights and span badges on merged cells"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Merges ({sheetMerges.length})</span>
                  </button>

                  <button
                    onClick={() => setShowMergeModal(true)}
                    className="px-3 py-1.5 border border-neutral-250 bg-white hover:bg-neutral-50 text-neutral-700 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                    title="Manage & Configure Merged Cell Ranges"
                  >
                    <Layers className="w-3.5 h-3.5 text-brand-maroon" />
                    <span>Manage Merges</span>
                  </button>

                  <button
                    onClick={() => window.print()}
                    className="p-2 border border-neutral-250 bg-white hover:bg-neutral-50 rounded-xl text-neutral-600 hover:text-neutral-900 cursor-pointer"
                    title="Print / Save as PDF"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                </>
              )}

              {viewerMode === "iframe" && (
                <button
                  onClick={() => setIframeKey(prev => prev + 1)}
                  title="Force Reload Embedded Frame"
                  className="p-2 border border-neutral-250 hover:bg-neutral-50 rounded-xl text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}

              <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-200 px-2.5 py-1.5 rounded-xl text-xs">
                <span className="text-[10px] font-bold text-neutral-500 uppercase font-mono mr-1">Zoom:</span>
                <button
                  onClick={() => setZoomScale(prev => Math.max(50, prev - 10))}
                  title="Zoom Out"
                  className="p-0.5 hover:bg-neutral-200 rounded text-neutral-600"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono font-bold w-9 text-center">{zoomScale}%</span>
                <button
                  onClick={() => setZoomScale(prev => Math.min(150, prev + 10))}
                  title="Zoom In"
                  className="p-0.5 hover:bg-neutral-200 rounded text-neutral-600"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoomScale(100)}
                  className="text-[9px] font-bold text-brand-maroon hover:underline ml-1"
                >
                  Reset
                </button>
              </div>

              <button
                onClick={() => setIsFullscreen(prev => !prev)}
                className="px-3 py-1.5 border border-neutral-250 text-neutral-700 hover:text-neutral-950 font-bold rounded-xl flex items-center gap-1 cursor-pointer hover:bg-neutral-50 text-xs transition-all"
              >
                {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                <span>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
              </button>
            </div>
          </div>

          {/* Connected Spreadsheet Indicators (Current Sheet Info panel) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-neutral-50/80 rounded-2xl border border-neutral-200/60 text-xs text-left">
            <div>
              <span className="text-gray-400 font-semibold block text-[9px] uppercase">Spreadsheet Tracker</span>
              <span className="font-bold text-gray-950 flex items-center gap-1.5 truncate">
                <FileSpreadsheet className="w-3.5 h-3.5 text-brand-maroon shrink-0" />
                Publication Tracker
              </span>
            </div>
            <div>
              <span className="text-gray-400 font-semibold block text-[9px] uppercase">Worksheet Tab</span>
              <span className="font-bold text-neutral-800 truncate block">
                {activeSheetTitle}
              </span>
            </div>
            <div>
              <span className="text-gray-400 font-semibold block text-[9px] uppercase">Active Merged Ranges</span>
              <span className="font-bold text-neutral-800 flex items-center gap-1">
                <Layers className="w-3 h-3 text-brand-maroon" />
                {sheetMerges.length > 0 ? (
                  <span className="truncate">
                    {sheetMerges.length} ranges ({sheetMerges.map(m => `${getColLetter(m.startColumnIndex)}${m.startRowIndex + 1}:${getColLetter(m.endColumnIndex - 1)}${m.endRowIndex}`).slice(0, 3).join(", ")}{sheetMerges.length > 3 ? "…" : ""})
                  </span>
                ) : (
                  <span className="text-neutral-400 font-normal">None configured</span>
                )}
              </span>
            </div>
            <div>
              <span className="text-gray-400 font-semibold block text-[9px] uppercase">Status</span>
              <span className="flex items-center gap-1.5 font-bold text-green-700">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {googleToken ? "Live Connected" : "Local Database Mode"}
              </span>
            </div>
          </div>

          {/* SPREADSHEET GRID VIEWER WITH MERGED CELLS (Default) */}
          {viewerMode === "grid" && (
            <div className="flex-grow flex flex-col space-y-3">
              {isLoadingSheetData ? (
                <div className="py-24 text-center text-neutral-500 font-medium flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-8 h-8 text-brand-maroon animate-spin" />
                  <span className="text-xs">Loading sheet data and merge matrix...</span>
                </div>
              ) : (
                <div 
                  className="overflow-x-auto border border-neutral-200 rounded-2xl shadow-inner bg-neutral-50/50 max-h-[720px]"
                >
                  <div 
                    style={{
                      transform: zoomScale !== 100 ? `scale(${zoomScale / 100})` : undefined,
                      transformOrigin: "top left",
                      minWidth: "100%",
                      width: zoomScale < 100 ? `${(100 / zoomScale) * 100}%` : undefined
                    }}
                  >
                    <table className="w-full text-xs text-left border-collapse bg-white">
                      {/* Column Header Row */}
                      <thead className="bg-neutral-100 text-neutral-600 uppercase text-[10px] tracking-wider border-b border-neutral-200 sticky top-0 z-10 select-none shadow-2xs">
                        <tr className="divide-x divide-neutral-200">
                          <th className="py-2.5 px-3 text-center font-mono w-12 bg-neutral-200/80 font-bold text-neutral-700">
                            #
                          </th>
                          {(sheetCells[0] || []).map((header, cIdx) => (
                            <th key={cIdx} className="py-2.5 px-3 min-w-[130px] font-bold text-neutral-700">
                              <div className="flex items-center justify-between gap-1">
                                <span className="truncate">{header || `Col ${getColLetter(cIdx)}`}</span>
                                <span className="font-mono text-[9px] text-neutral-400 font-normal">
                                  {getColLetter(cIdx)}
                                </span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>

                      {/* Sheet Data Rows with Merged Cells Support */}
                      <tbody className="divide-y divide-neutral-200 font-sans">
                        {sheetCells.slice(1).map((row, rIdx) => {
                          const originalRowIndex = rIdx + 1; // 1-based indexing for row data (0 is header)
                          
                          // Check if row matches search filter if search is active
                          const matchesSearch = !viewerSearch || row.some(c => 
                            String(c || "").toLowerCase().includes(viewerSearch.toLowerCase())
                          );

                          if (!matchesSearch) return null;

                          return (
                            <tr
                              key={originalRowIndex}
                              className={`divide-x divide-neutral-200 hover:bg-neutral-50/60 transition-colors ${
                                originalRowIndex % 2 === 0 ? "bg-white" : "bg-neutral-50/20"
                              }`}
                            >
                              {/* Row Number Left Header */}
                              <td className="text-center font-mono py-2 text-neutral-400 bg-neutral-100 font-medium select-none w-12 border-r border-neutral-200">
                                {originalRowIndex + 1}
                              </td>

                              {/* Sheet Cells with Merged Cell Handling */}
                              {row.map((cell, cIdx) => {
                                const mergeInfo = getCellMergeInfo(originalRowIndex, cIdx, sheetMerges);

                                // If cell is inside a merged range but NOT the top-left origin, SKIP IT
                                if (mergeInfo.inMerge && !mergeInfo.isOrigin) {
                                  return null;
                                }

                                const isMergedOrigin = mergeInfo.inMerge && mergeInfo.isOrigin;
                                const isSectionBanner = isMergedOrigin && mergeInfo.colSpan >= 3;
                                const trimmed = String(cell || "").trim();
                                const isSearchMatched = viewerSearch && trimmed.toLowerCase().includes(viewerSearch.toLowerCase());

                                // Render Section Banner (Folio Header)
                                if (isSectionBanner) {
                                  return (
                                    <td
                                      key={cIdx}
                                      colSpan={mergeInfo.colSpan}
                                      rowSpan={mergeInfo.rowSpan}
                                      className={`px-4 py-3 bg-gradient-to-r from-red-50 via-rose-50/40 to-neutral-50 border-y-2 border-brand-maroon/30 text-brand-maroon font-display font-extrabold text-xs tracking-wide shadow-2xs relative ${
                                        isSearchMatched ? "ring-2 ring-amber-400 bg-amber-50" : ""
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full bg-brand-maroon shrink-0" />
                                          <span className="text-neutral-900 font-black text-sm uppercase tracking-wide">
                                            {trimmed || mergeInfo.merge?.label || "SECTION BANNER"}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="px-2 py-0.5 rounded-full bg-brand-maroon/10 text-brand-maroon text-[10px] font-mono font-bold">
                                            Merged Folio Banner • {mergeInfo.colSpan} Columns [{getColLetter(cIdx)}{originalRowIndex + 1}:{getColLetter(cIdx + mergeInfo.colSpan - 1)}{originalRowIndex + mergeInfo.rowSpan}]
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                  );
                                }

                                // Render Merged Origin Cell (non-banner) or Standard Cell
                                return (
                                  <td
                                    key={cIdx}
                                    colSpan={mergeInfo.colSpan}
                                    rowSpan={mergeInfo.rowSpan}
                                    className={`px-3 py-2 truncate relative font-medium text-neutral-800 transition-all ${
                                      isMergedOrigin && highlightMerges
                                        ? "bg-amber-50/80 border-2 border-amber-300 font-semibold"
                                        : isMergedOrigin
                                        ? "bg-amber-50/30 border border-amber-200"
                                        : ""
                                    } ${
                                      isSearchMatched ? "bg-amber-100/90 text-neutral-950 font-bold" : ""
                                    }`}
                                  >
                                    {isMergedOrigin && highlightMerges && (
                                      <span className="absolute top-1 right-1.5 px-1.5 py-0.2 rounded bg-amber-200/90 text-amber-900 text-[9px] font-mono font-bold shadow-2xs pointer-events-none">
                                        {mergeInfo.colSpan > 1 ? `⇄ ${mergeInfo.colSpan} cols` : `⇅ ${mergeInfo.rowSpan} rows`}
                                      </span>
                                    )}

                                    {/* Cell Value Renderer */}
                                    {(() => {
                                      if (!trimmed) return <span className="text-gray-300 italic font-normal">-</span>;
                                      
                                      const hyperMatch = trimmed.match(/^=HYPERLINK\(\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?\s*\)$/i);
                                      if (hyperMatch) {
                                        return <CellLink url={hyperMatch[1]} label={hyperMatch[2] || hyperMatch[1]} />;
                                      }

                                      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
                                        return <CellLink url={trimmed} label={trimmed} />;
                                      }

                                      // Tag badges for common publication statuses
                                      if (["Done", "Ready for Layout", "Completed", "Published"].includes(trimmed)) {
                                        return (
                                          <span className="px-2 py-0.5 rounded-md bg-green-100 text-green-800 font-bold text-[11px] inline-flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" />
                                            {trimmed}
                                          </span>
                                        );
                                      }

                                      if (["In Progress", "Drafting", "Assigned", "Ongoing"].includes(trimmed)) {
                                        return (
                                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[11px]">
                                            {trimmed}
                                          </span>
                                        );
                                      }

                                      if (["Pending", "Not Started", "Pending ArtX"].includes(trimmed)) {
                                        return (
                                          <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 font-medium text-[11px]">
                                            {trimmed}
                                          </span>
                                        );
                                      }

                                      return cell;
                                    })()}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Viewer Footnote Info */}
              <div className="text-[11px] text-neutral-400 font-medium bg-neutral-50 p-3 rounded-xl border border-neutral-100 flex items-start justify-between gap-3 leading-relaxed">
                <div className="flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-neutral-700">Merged Cells Presentation:</span> This Sheets Viewer automatically detects and renders merged ranges across columns and rows, including editorial folio headers and section titles. Use the <span className="font-bold text-brand-maroon">Manage Merges</span> button or <span className="font-bold text-neutral-800">Interactive Editor</span> to adjust or add new merged ranges.
                  </div>
                </div>
                <button
                  onClick={() => setActiveSubTab("editor")}
                  className="shrink-0 px-3 py-1 bg-brand-maroon/10 hover:bg-brand-maroon text-brand-maroon hover:text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Switch to Editor
                </button>
              </div>
            </div>
          )}

          {/* EMBEDDED GOOGLE DRIVE IFRAME (Optional Mode) */}
          {viewerMode === "iframe" && (
            editableUrl ? (
              <div className="flex-grow flex flex-col space-y-4">
                <div className="flex-grow relative h-[650px] bg-neutral-100 rounded-2xl border border-neutral-200 shadow-inner overflow-auto">
                  <div
                    style={{
                      transform: `scale(${zoomScale / 100})`,
                      transformOrigin: "top left",
                      width: `${100 * (100 / zoomScale)}%`,
                      height: `${100 * (100 / zoomScale)}%`,
                      position: "absolute",
                      top: 0,
                      left: 0
                    }}
                  >
                    <iframe
                      key={iframeKey}
                      title="Google Sheets Live Edit Screen"
                      src={`${editableUrl}&widget=true&headers=false`}
                      className="w-full h-full bg-white border-0"
                      allowFullScreen
                    />
                  </div>
                </div>

                <div className="text-[11px] text-neutral-400 font-medium bg-neutral-50 p-3 rounded-xl border border-neutral-100 flex items-start gap-2 leading-relaxed">
                  <HelpCircle className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-neutral-700">Google Drive Live View:</span> Embedded directly from Google Sheets. Switch to <span className="font-bold text-neutral-800">Sheet Grid View</span> above to see custom rendered merged cells and local customizations.
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-24 text-center text-neutral-500 space-y-3">
                <FileSpreadsheet className="w-8 h-8 text-neutral-300 mx-auto animate-bounce" />
                <h3 className="font-bold text-neutral-800 text-sm">No Active URL Configured</h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  Insert a Google Sheets URL in the workspace settings below to activate Google Drive iframe viewing, or switch to <strong className="text-neutral-800">Sheet Grid View</strong> above.
                </p>
                <button
                  onClick={() => setViewerMode("grid")}
                  className="px-4 py-2 bg-brand-maroon text-white font-bold rounded-xl text-xs hover:bg-brand-maroon-dark transition-colors cursor-pointer"
                >
                  Switch to Sheet Grid View
                </button>
              </div>
            )
          )}
        </div>
      )}

      {/* --- WORKSPACE CONFIGURATION HEADER PANEL --- */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-neutral-100 shadow-sm space-y-6 text-left">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-50 text-brand-maroon rounded-2xl">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-display font-black text-neutral-900 tracking-tight flex items-center gap-2">
                  Newspaper Issue Workspace
                  <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2.5 py-0.5 rounded-full border border-green-200">
                    {googleToken ? "Sheets Link Connected" : "Local Database Mode"}
                  </span>
                </h1>
                <p className="text-xs md:text-sm text-neutral-500">
                  Manage the MKule Layout Desk newspaper issue database directly connected to Google Sheets.
                </p>
              </div>
            </div>
          </div>

          {/* Connection & Manual synchronization triggers */}
          <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {googleUser ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3 flex items-center gap-2.5 text-left">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                  <div className="text-[11px] leading-tight">
                    <div className="font-bold text-neutral-700">Google Connected</div>
                    <div className="text-neutral-500 font-mono text-[10px] truncate max-w-[150px]">
                      {normalizeEmail(googleUser?.email)}
                    </div>
                  </div>
                  <button
                    onClick={handleGoogleLogout}
                    title="Disconnect Google Account"
                    className="ml-2 p-1.5 hover:bg-neutral-200 text-neutral-500 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => saveSheetData()}
                  disabled={syncStatus !== "idle"}
                  className={`px-5 py-3 rounded-2xl text-xs font-bold font-sans flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer ${
                    syncStatus === "success" 
                      ? "bg-green-600 hover:bg-green-700 text-white" 
                      : "bg-brand-maroon hover:bg-brand-maroon-dark text-white disabled:bg-neutral-400"
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${syncStatus !== "idle" && syncStatus !== "success" ? "animate-spin" : ""}`} />
                  {syncStatus === "idle" && "Sync Database"}
                  {syncStatus === "downloading" && "Downloading..."}
                  {syncStatus === "merging" && "Uploading..."}
                  {syncStatus === "success" && "Synced Successfully!"}
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleLogin}
                className="px-5 py-3 bg-brand-maroon hover:bg-brand-maroon-dark text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Connect Google Account to Sync
              </button>
            )}
          </div>
        </div>

        {/* Sync polling indicator & controls */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => {
                  setAutoSync(e.target.checked);
                  speakText(e.target.checked ? "Auto sync enabled" : "Auto sync disabled");
                }}
                className="w-4 h-4 rounded border-neutral-300 text-brand-maroon focus:ring-brand-maroon cursor-pointer"
              />
              <div className="text-left">
                <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                  ⚡ Auto-Sync Live Mode
                  {autoSync && googleToken && (
                    <span className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.2 rounded border border-green-200">
                      Live
                    </span>
                  )}
                </span>
                <p className="text-[10px] text-neutral-500">
                  Captures changes made in Google Sheets and updates local database automatically.
                </p>
              </div>
            </label>

            {/* Countdown layout */}
            {autoSync && googleToken && (
              <div className="flex items-center gap-3 bg-white border border-neutral-200 rounded-xl px-3 py-1.5 self-start sm:self-auto shadow-sm">
                <div className="relative flex items-center justify-center w-6 h-6">
                  <svg className="absolute w-full h-full transform -rotate-90">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      stroke="#f3f4f6"
                      strokeWidth="2"
                      fill="transparent"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      stroke="var(--color-brand-maroon)"
                      strokeWidth="2.5"
                      fill="transparent"
                      strokeDasharray={56.5}
                      strokeDashoffset={56.5 - (56.5 * secondsUntilSync) / 12}
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                  <span className="text-[9px] font-mono font-black text-neutral-800 z-10">
                    {secondsUntilSync}
                  </span>
                </div>
                <div className="text-left">
                  <div className="text-[9px] font-extrabold uppercase tracking-widest text-brand-maroon flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" /> Next Auto-Sync
                  </div>
                  <div className="text-[9px] text-neutral-400 font-mono">
                    Polling sheet data in background
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sync status bar */}
          {syncError ? (
            <div className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-4 py-2 rounded-xl text-left flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{syncError}</span>
            </div>
          ) : syncStatus !== "idle" ? (
            <div className="text-[11px] font-bold text-neutral-600 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-maroon animate-ping" />
              {syncDirection === "pull" ? "📥 Auto-pulling spreadsheet edits..." : "📤 Auto-pushing local changes..."}
            </div>
          ) : googleToken ? (
            <div className="text-[11px] font-semibold text-neutral-500 flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-neutral-150 shadow-xs">
              <Database className="w-3.5 h-3.5 text-green-600 animate-pulse" />
              <span>Local Database is synchronized with Google Drive.</span>
            </div>
          ) : (
            <div className="text-[11px] text-neutral-500 font-medium">
              Offline mode. Connect Google Account to activate real-time background auto-sync.
            </div>
          )}
        </div>

        {/* Google Sheets Link Box */}
        <div className="p-5 bg-neutral-50/75 border border-neutral-200 rounded-2xl flex flex-col sm:flex-row items-center gap-4 text-xs">
          <div className="flex items-center gap-2 text-neutral-600 font-bold whitespace-nowrap">
            <Link className="w-4 h-4 text-neutral-400" />
            <span>Google Sheets Master Link:</span>
          </div>
          <div className="flex-1 w-full flex gap-2">
            <input
              type="text"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="Paste your shared Google Sheets URL..."
              className="flex-1 px-4 py-2 bg-white border border-neutral-200 rounded-xl outline-none focus:ring-1 focus:ring-brand-maroon font-mono text-[11px]"
            />
            <button
              onClick={handleSaveSheetsLink}
              className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              {saveSuccess ? "Saved!" : "Save"}
            </button>
          </div>
        </div>

        {/* Collapsible Developer Console Settings */}
        <div className="border border-neutral-200 rounded-2xl overflow-hidden bg-white text-xs">
          <button
            onClick={() => {
              setShowDevPanel(!showDevPanel);
              speakText(showDevPanel ? "Closed developer settings" : "Opened developer settings");
            }}
            className="w-full px-5 py-4 flex items-center justify-between font-bold text-neutral-700 bg-neutral-50/50 hover:bg-neutral-100/50 transition-colors cursor-pointer select-none"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-neutral-500" />
              <span className="font-sans">Google Cloud & Firebase Developer Credentials (Fix 403 Access Denied)</span>
            </div>
            <span className="text-neutral-400 font-mono text-[10px]">
              {showDevPanel ? "▲ Close Panel" : "▼ Open Config & Guide"}
            </span>
          </button>

          {showDevPanel && (
            <div className="p-6 border-t border-neutral-200 flex flex-col gap-6 text-left">
              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 text-amber-900 leading-relaxed">
                <h4 className="font-black text-[13px] mb-2 flex items-center gap-1.5 text-amber-950">
                  🛡️ Bypassing the "Google has not completed verification (Error 403)" Block
                </h4>
                <p className="mb-2 text-amber-900">
                  When creating a new Google Cloud Console integration, Google sets its OAuth status to <strong>"Testing"</strong>. Only listed <strong>"Test Users"</strong> can log in unless you set the status to <strong>"In Production"</strong>.
                </p>
                <p className="text-amber-900">
                  To make the integration fully functional, you can either <strong>add your Google Account as a Test User</strong> in your GCP Console, <strong>or configure your own custom Firebase credentials</strong> below.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Custom Firebase Form */}
                <div className="flex flex-col gap-4 border-r border-neutral-100 pr-0 lg:pr-6">
                  <h5 className="font-black text-neutral-800 text-[12px] uppercase tracking-wider">
                    ⚙️ Configure Custom Project Credentials
                  </h5>

                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={useCustomConfig}
                      onChange={(e) => setUseCustomConfig(e.target.checked)}
                      className="w-4 h-4 rounded border-neutral-300 text-brand-maroon focus:ring-brand-maroon cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-neutral-700">Use Custom Firebase Project Credentials</span>
                      <p className="text-[10px] text-neutral-400 font-normal">
                        Enable this to override the default applet project sandbox with your own.
                      </p>
                    </div>
                  </label>

                  {useCustomConfig && (
                    <div className="flex flex-col gap-2">
                      <span className="font-bold text-neutral-600">Paste your Firebase Web SDK config snippet (JSON):</span>
                      <textarea
                        rows={8}
                        value={customConfigInput}
                        onChange={(e) => setCustomConfigInput(e.target.value)}
                        placeholder={`{\n  "apiKey": "YOUR_API_KEY",\n  "authDomain": "YOUR_PROJECT.firebaseapp.com",\n  "projectId": "YOUR_PROJECT_ID",\n  "storageBucket": "YOUR_PROJECT.firebasestorage.app",\n  "messagingSenderId": "YOUR_SENDER_ID",\n  "appId": "YOUR_APP_ID"\n}`}
                        className="w-full p-3 font-mono text-[10px] bg-neutral-900 text-neutral-100 border border-neutral-800 rounded-xl outline-none focus:ring-1 focus:ring-brand-maroon leading-normal"
                      />
                    </div>
                  )}

                  {configError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 font-bold font-mono text-[10px]">
                      Error: {configError}
                    </div>
                  )}

                  {configSaveSuccess && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 font-bold font-mono text-[10px]">
                      ✓ Settings successfully saved! Reloading session...
                    </div>
                  )}

                  <button
                    onClick={handleSaveCustomConfig}
                    className="px-5 py-2.5 bg-neutral-900 hover:bg-black text-white font-bold rounded-xl transition-colors cursor-pointer self-start"
                  >
                    Apply & Save Custom Configuration
                  </button>
                </div>

                {/* Google Cloud Step-By-Step Setup Guide */}
                <div className="flex flex-col gap-4">
                  <h5 className="font-black text-neutral-800 text-[12px] uppercase tracking-wider">
                    🚀 Google Cloud Console Walkthrough
                  </h5>

                  <div className="flex flex-col gap-3 font-sans text-neutral-600 leading-normal">
                    <div className="flex gap-2">
                      <span className="font-bold text-brand-maroon font-mono">1.</span>
                      <div>
                        <strong>Create a Firebase Project:</strong> Go to the <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-brand-maroon font-bold underline">Firebase Console</a>, enable <strong>Authentication</strong>, and enable the <strong>Google Provider</strong>.
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <span className="font-bold text-brand-maroon font-mono">2.</span>
                      <div>
                        <strong>Add OAuth Redirect URIs:</strong> In Firebase Auth under Google provider setup, you'll see a redirect URI like <code>https://your-project.firebaseapp.com/__/auth/handler</code>. This will be automatically populated in Google Cloud Console.
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <span className="font-bold text-brand-maroon font-mono">3.</span>
                      <div>
                        <strong>Configure JavaScript Origins:</strong> In the <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-brand-maroon font-bold underline">Google Cloud Console</a>, navigate to <strong>APIs & Services &gt; Credentials &gt; OAuth 2.0 Client IDs &gt; Web client</strong> and add the following as Authorized JavaScript Origins:
                        <div className="bg-neutral-50 p-2 border border-neutral-200 rounded-lg mt-1 font-mono text-[9px] text-neutral-600 select-all leading-relaxed">
                          {window.location.origin}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <span className="font-bold text-brand-maroon font-mono">4.</span>
                      <div>
                        <strong>Avoid 403 Access Denied:</strong> In Cloud Console, go to <strong>APIs & Services &gt; OAuth consent screen</strong>:
                        <ul className="list-disc pl-4 mt-1 flex flex-col gap-1">
                          <li>Either click <strong>"Publish App"</strong> to change Publishing Status from "Testing" to "In Production" (no verification needed for personal use!).</li>
                          <li>Or go to the <strong>Test users</strong> section, click <strong>Add Users</strong>, and add your test accounts.</li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <span className="font-bold text-brand-maroon font-mono">5.</span>
                      <div>
                        <strong>Enable Google Sheets API:</strong> In Google Cloud Console, search for "Google Sheets API" and click <strong>Enable</strong> so the app is allowed to call Sheets endpoints.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- LIVE VIEWER FULLSCREEN PORTAL MODAL --- */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-neutral-950 z-50 flex flex-col animate-fade-in">
          {/* Header */}
          <div className="bg-neutral-900 border-b border-neutral-800 px-6 py-3.5 flex items-center justify-between text-white text-xs">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-brand-maroon" />
              <div>
                <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest block">Fullscreen Presenter</span>
                <span className="font-bold text-neutral-100">{activeSheetTitle}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-neutral-800 border border-neutral-700 px-3 py-1.5 rounded-xl">
                <button
                  onClick={() => setZoomScale(p => Math.max(50, p - 10))}
                  className="p-0.5 hover:bg-neutral-700 rounded text-neutral-300 cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono font-bold w-12 text-center">{zoomScale}%</span>
                <button
                  onClick={() => setZoomScale(p => Math.min(150, p + 10))}
                  className="p-0.5 hover:bg-neutral-700 rounded text-neutral-300 cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => setIsFullscreen(false)}
                className="px-4 py-2 bg-brand-maroon text-white font-bold rounded-xl hover:bg-brand-maroon-dark transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Minimize className="w-4 h-4" />
                <span>Exit Fullscreen</span>
              </button>
            </div>
          </div>

          {/* Iframe Viewport */}
          <div className="flex-grow bg-neutral-900 p-4 relative overflow-auto">
            <div
              style={{
                transform: `scale(${zoomScale / 100})`,
                transformOrigin: "top left",
                width: `${100 * (100 / zoomScale)}%`,
                height: `${100 * (100 / zoomScale)}%`,
                position: "absolute",
                top: "16px",
                left: "16px"
              }}
            >
              <iframe
                title="Google Sheets Fullscreen View"
                src={`${editableUrl}&widget=true&headers=false`}
                className="w-full h-full bg-white border-0 rounded-xl"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {/* --- ADD ROW POPUP DIALOG MODAL --- */}
      {showAddRowModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-neutral-100 dark:border-neutral-800 text-left animate-fade-in text-xs space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-neutral-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-brand-maroon/10 text-brand-maroon dark:text-brand-maroon-light rounded-lg">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-black text-neutral-950 dark:text-neutral-100 text-sm flex items-center gap-1.5">
                    {editingRowIdx !== null ? "Edit Spreadsheet Row" : "Add Spreadsheet Row"}
                  </h3>
                  <span className="text-[10px] text-brand-maroon dark:text-brand-maroon-light font-semibold">
                    Google Sheets Row Editor
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddRowModal(false);
                  setEditingRowIdx(null);
                }}
                className="p-1 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-750 rounded-full text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddRowConfirm} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                {sheetCells[0]?.map((colName, idx) => {
                  if (colName?.toLowerCase() === "na") return null; // Skip sequence counters

                  // Detect type for dropdown validation if available
                  const isSection = colName?.toLowerCase().includes("section") || colName?.toLowerCase().includes("content");
                  const isProgress = colName?.toLowerCase().includes("progress") || colName?.toLowerCase().includes("status");
                  const isLayout = colName?.toLowerCase().includes("layout") && !colName?.toLowerCase().includes("added");
                  const isOnline = colName?.toLowerCase().includes("online");
                  const isAddedFinalArtx = colName?.toLowerCase().includes("added final") || colName?.toLowerCase().includes("artx to layout") || colName?.toLowerCase().includes("final artx");
                  const isDraftLink = colName?.toLowerCase().includes("draft link") || colName?.toLowerCase().includes("draft") || colName?.toLowerCase().includes("writeup");

                  if (isProgress || isAddedFinalArtx) return null; // Hide progress and added final artx to layout fields from modal

                  const sectionCategories = [
                    "News",
                    "Features",
                    "Cult",
                    "Opinion",
                    "Editorial",
                    "Front",
                    "MM",
                    "Opinion w/ Lola P",
                    "Graphics",
                    "News Feats",
                    "OP Persona"
                  ];

                  if (isDraftLink) {
                    return (
                      <div key={idx} className="col-span-2 bg-brand-cream/35 dark:bg-neutral-800/60 p-3 rounded-2xl border border-brand-maroon/20 dark:border-brand-maroon/30 space-y-2">
                        <label className="text-gray-900 dark:text-neutral-100 font-bold flex items-center gap-1.5 text-xs">
                          <FileText className="w-4 h-4 text-brand-maroon dark:text-brand-maroon-light" />
                          <span>Document Link (ArtX / Writeup)</span>
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-neutral-600 dark:text-neutral-300 font-semibold block text-xs">
                              ArtX Document Text Title (Draft)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Kulto Feature Final Article"
                              value={artxDocTitle}
                              onChange={(e) => setArtxDocTitle(e.target.value)}
                              className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-1 focus:ring-red-600 outline-none bg-white dark:bg-neutral-800 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-neutral-600 dark:text-neutral-300 font-semibold block text-xs flex items-center justify-between">
                              <span>ArtX Document Hyperlink (URL)</span>
                              {isFetchingDocTitle && (
                                <span className="text-[10px] text-brand-maroon animate-pulse font-semibold">Auto-fetching title...</span>
                              )}
                            </label>
                            <input
                              type="url"
                              placeholder="e.g. https://docs.google.com/document/d/..."
                              value={artxDocUrl}
                              onChange={async (e) => {
                                const urlVal = e.target.value;
                                setArtxDocUrl(urlVal);

                                // Extract hyperlink details if pasted formula or markdown
                                const extracted = extractHyperlinkDetails(urlVal);
                                if (extracted.label && extracted.label !== extracted.url) {
                                  setArtxDocTitle(extracted.label);
                                  if (extracted.url !== urlVal) setArtxDocUrl(extracted.url);
                                  return;
                                }

                                // Auto-fetch Google Docs title if text title is empty or matching url
                                if ((urlVal.startsWith("http://") || urlVal.startsWith("https://")) && (!artxDocTitle || artxDocTitle === artxDocUrl)) {
                                  setIsFetchingDocTitle(true);
                                  try {
                                    const res = await fetch(`/api/gdoc-title?url=${encodeURIComponent(urlVal)}`);
                                    const data = await res.json();
                                    if (data.title) {
                                      setArtxDocTitle(data.title);
                                    }
                                  } catch (err) {
                                    console.error("Doc title fetch error:", err);
                                  } finally {
                                    setIsFetchingDocTitle(false);
                                  }
                                }
                              }}
                              className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-1 focus:ring-red-600 outline-none bg-white dark:bg-neutral-800 font-mono text-[11px]"
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-neutral-400 font-medium">
                          Paste any shared document or reference link to keep the assignment organized.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div key={idx}>
                      <label className="text-neutral-600 dark:text-neutral-300 font-semibold block mb-1 capitalize">
                        {colName || `Column ${getColLetter(idx)}`}
                        {colName?.toLowerCase().includes("title") && <span className="text-red-600 ml-0.5">*</span>}
                      </label>

                      {isSection ? (() => {
                        const currentVal = addRowValues[idx] || "";
                        const matchedCat = sectionCategories.find(c => c.toLowerCase() === currentVal.toLowerCase());
                        const selectVal = matchedCat || currentVal;

                        return (
                          <select
                            value={selectVal}
                            onChange={(e) => {
                              const updated = [...addRowValues];
                              updated[idx] = e.target.value;
                              setAddRowValues(updated);
                            }}
                            className="w-full px-2.5 py-2 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800 outline-none cursor-pointer"
                          >
                            <option value="">Select Category</option>
                            {!matchedCat && currentVal && (
                              <option value={currentVal}>{currentVal}</option>
                            )}
                            {sectionCategories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        );
                      })() : isLayout ? (
                        <select
                          value={addRowValues[idx] || ""}
                          onChange={(e) => {
                            const updated = [...addRowValues];
                            updated[idx] = e.target.value;
                            // Set online value by default to be the same as layout
                            const onlineIndex = sheetCells[0]?.findIndex(h => h?.toLowerCase().includes("online")) ?? -1;
                            if (onlineIndex !== -1) {
                              updated[onlineIndex] = e.target.value;
                            }
                            setAddRowValues(updated);
                          }}
                          className="w-full px-2.5 py-2 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800 outline-none cursor-pointer"
                        >
                          <option value="">Unassigned</option>
                          {artistNameOptions.map((firstName) => (
                            <option key={firstName} value={firstName}>{firstName}</option>
                          ))}
                        </select>
                      ) : isOnline ? (
                        <select
                          value={addRowValues[idx] || ""}
                          onChange={(e) => {
                            const updated = [...addRowValues];
                            updated[idx] = e.target.value;
                            setAddRowValues(updated);
                          }}
                          className="w-full px-2.5 py-2 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800 outline-none cursor-pointer"
                        >
                          <option value="">Unassigned</option>
                          {artistNameOptions.map((firstName) => (
                            <option key={firstName} value={firstName}>{firstName}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={cellDisplayValue(addRowValues[idx])}
                          placeholder={`Enter cell value...`}
                          onChange={(e) => {
                            const updated = [...addRowValues];
                            updated[idx] = e.target.value;
                            setAddRowValues(updated);
                          }}
                          className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-1 focus:ring-red-600 outline-none bg-white dark:bg-neutral-800"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-brand-maroon to-brand-maroon-dark hover:opacity-95 text-white font-bold rounded-xl cursor-pointer transition-all shadow-[var(--brand-shadow-med)]"
              >
                {editingRowIdx !== null ? "Confirm & Update Row" : "Confirm & Sync Row"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- CREATE WORKSHEET POPUP MODAL --- */}
      {showCreateSheetModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-neutral-100 text-left animate-fade-in text-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-2.5">
              <h3 className="font-display font-black text-neutral-950 text-sm flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-brand-maroon" /> Create Worksheet Tab
              </h3>
              <button onClick={() => setShowCreateSheetModal(false)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSheetConfirm} className="space-y-4">
              <div className="space-y-1">
                <label className="font-bold text-neutral-800">Worksheet Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Volume 52 Issue 4"
                  value={newSheetTitle}
                  onChange={(e) => setNewSheetTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-250 bg-white rounded-xl focus:ring-1 focus:ring-brand-maroon outline-none"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useTemplateOption}
                  onChange={(e) => setUseTemplateOption(e.target.checked)}
                  className="w-4 h-4 rounded border-neutral-300 text-brand-maroon focus:ring-brand-maroon cursor-pointer"
                />
                <div>
                  <span className="font-bold text-neutral-700">Pre-populate Newspaper Columns</span>
                  <p className="text-[10px] text-neutral-400 font-normal">
                    Initializes sheet with standard issue tracker headers (Na, Title, Section, Writer...).
                  </p>
                </div>
              </label>

              <div className="pt-2 border-t border-neutral-100 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowCreateSheetModal(false)}
                  className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl hover:bg-neutral-50 cursor-pointer font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-maroon text-white font-bold rounded-xl hover:bg-brand-maroon-dark cursor-pointer flex items-center gap-1 shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Create Sheet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- RENAME WORKSHEET POPUP MODAL --- */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-neutral-100 text-left animate-fade-in text-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-2.5">
              <h3 className="font-display font-black text-neutral-950 text-sm flex items-center gap-1.5">
                <Edit className="w-4 h-4 text-brand-maroon" /> Rename Worksheet
              </h3>
              <button onClick={() => setShowRenameModal(false)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenameSheetConfirm} className="space-y-4">
              <div className="space-y-1">
                <label className="font-bold text-neutral-500">Current Name</label>
                <div className="p-2.5 bg-neutral-50 border rounded-xl text-neutral-700 font-bold font-mono">
                  {renameSheetOldTitle}
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-800">New Worksheet Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Issue 5 Roster"
                  value={renameSheetNewTitle}
                  onChange={(e) => setRenameSheetNewTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-250 bg-white rounded-xl focus:ring-1 focus:ring-brand-maroon outline-none font-bold"
                />
              </div>

              <div className="pt-2 border-t border-neutral-100 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowRenameModal(false)}
                  className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl hover:bg-neutral-50 cursor-pointer font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-maroon text-white font-bold rounded-xl hover:bg-brand-maroon-dark cursor-pointer flex items-center gap-1 shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save New Name</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DUPLICATE WORKSHEET POPUP MODAL --- */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-neutral-100 text-left animate-fade-in text-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-2.5">
              <h3 className="font-display font-black text-neutral-950 text-sm flex items-center gap-1.5">
                <Copy className="w-4 h-4 text-brand-maroon" /> Duplicate Worksheet Tab
              </h3>
              <button onClick={() => setShowDuplicateModal(false)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDuplicateSheetConfirm} className="space-y-4">
              <div className="space-y-1">
                <label className="font-bold text-neutral-500">Source Worksheet</label>
                <div className="p-2.5 bg-neutral-50 border rounded-xl text-neutral-700 font-bold font-mono">
                  {duplicateSheetTitle}
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-800">Duplicate Worksheet Title</label>
                <input
                  type="text"
                  required
                  value={duplicateSheetNewTitle}
                  onChange={(e) => setDuplicateSheetNewTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-250 bg-white rounded-xl focus:ring-1 focus:ring-brand-maroon outline-none font-bold"
                />
              </div>

              <div className="pt-2 border-t border-neutral-100 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowDuplicateModal(false)}
                  className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl hover:bg-neutral-50 cursor-pointer font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-maroon text-white font-bold rounded-xl hover:bg-brand-maroon-dark cursor-pointer flex items-center gap-1 shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Duplicate Tab</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DELETE WORKSHEET CONFIRMATION DIALOG --- */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-neutral-100 text-left animate-fade-in text-xs space-y-4">
            <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>Confirm Worksheet Deletion</span>
            </div>

            <p className="text-neutral-500 leading-normal text-xs">
              Are you sure you want to permanently delete the worksheet tab <strong className="text-neutral-900 font-bold">"{deleteSheetTitle}"</strong> from your spreadsheet database? This operation is irreversible and will delete all stored cell values inside.
            </p>

            <div className="pt-2 border-t border-neutral-100 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(false)}
                className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl hover:bg-neutral-50 cursor-pointer font-bold"
              >
                Keep Worksheet
              </button>
              <button
                type="button"
                onClick={handleDeleteSheetConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl cursor-pointer shadow-sm flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Worksheet</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MANAGE MERGED CELLS POPUP MODAL --- */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-neutral-100 text-left animate-fade-in text-xs space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-50 text-brand-maroon rounded-xl">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-black text-neutral-950 text-sm">
                    Manage Merged Cells & Folios
                  </h3>
                  <p className="text-[11px] text-neutral-500 font-medium">
                    Configure merged cell spans for worksheet: <strong className="text-neutral-800">{activeSheetTitle}</strong>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowMergeModal(false)} 
                className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Existing Merges List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-neutral-700 uppercase text-[10px] tracking-wider">
                    Active Merged Ranges ({sheetMerges.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const detected = detectMergedSectionRows(sheetCells);
                      if (detected.length > 0) {
                        setSheetMerges(detected);
                        localStorage.setItem(`cache_merges_${spreadsheetId || 'default'}_${activeSheetTitle}`, JSON.stringify(detected));
                      }
                    }}
                    className="text-[10px] font-bold text-brand-maroon hover:underline flex items-center gap-1 cursor-pointer"
                    title="Auto-scan sheet cells for section title rows and folio headers"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Auto-Detect Sections</span>
                  </button>
                </div>

                {sheetMerges.length === 0 ? (
                  <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 text-center text-neutral-400">
                    No merged cell ranges configured for this worksheet yet.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {sheetMerges.map((merge, mIdx) => (
                      <div
                        key={mIdx}
                        className="flex items-center justify-between p-2.5 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-200 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-brand-maroon/10 text-brand-maroon font-mono font-bold text-[10px] rounded-md">
                            {getColLetter(merge.startColumnIndex)}{merge.startRowIndex + 1}:{getColLetter(merge.endColumnIndex - 1)}{merge.endRowIndex}
                          </span>
                          <div>
                            <div className="font-bold text-neutral-800">
                              {merge.label || `Merged Range ${mIdx + 1}`}
                            </div>
                            <div className="text-[10px] text-neutral-500 font-mono">
                              Rows {merge.startRowIndex + 1}–{merge.endRowIndex} • Cols {getColLetter(merge.startColumnIndex)}–{getColLetter(merge.endColumnIndex - 1)} ({merge.endColumnIndex - merge.startColumnIndex} columns)
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveMerge(mIdx)}
                          className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Remove this merge"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Merged Range Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const startR = Math.max(1, mergeFormStartRow);
                  const endR = Math.max(startR, mergeFormEndRow);
                  const startC = Math.min(mergeFormStartCol, mergeFormEndCol);
                  const endC = Math.max(mergeFormStartCol, mergeFormEndCol);
                  handleAddMerge({
                    startRowIndex: startR - 1,
                    endRowIndex: endR,
                    startColumnIndex: startC,
                    endColumnIndex: endC + 1,
                    sheetId: activeSheetGid,
                    label: mergeFormLabel.trim() || undefined
                  });
                  setMergeFormLabel("");
                }}
                className="p-3.5 bg-neutral-50/80 rounded-2xl border border-neutral-200 space-y-3"
              >
                <div className="font-bold text-neutral-800 text-xs flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-brand-maroon" />
                  <span>Define New Merged Range</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-neutral-600 block text-[11px]">Start Row (#)</label>
                    <input
                      type="number"
                      min={1}
                      max={sheetCells.length || 100}
                      value={mergeFormStartRow}
                      onChange={(e) => setMergeFormStartRow(parseInt(e.target.value) || 1)}
                      className="w-full px-2.5 py-1.5 bg-white border border-neutral-250 rounded-xl font-mono text-xs focus:ring-1 focus:ring-brand-maroon outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-neutral-600 block text-[11px]">End Row (#)</label>
                    <input
                      type="number"
                      min={1}
                      max={sheetCells.length || 100}
                      value={mergeFormEndRow}
                      onChange={(e) => setMergeFormEndRow(parseInt(e.target.value) || 1)}
                      className="w-full px-2.5 py-1.5 bg-white border border-neutral-250 rounded-xl font-mono text-xs focus:ring-1 focus:ring-brand-maroon outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-neutral-600 block text-[11px]">Start Column</label>
                    <select
                      value={mergeFormStartCol}
                      onChange={(e) => setMergeFormStartCol(parseInt(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-white border border-neutral-250 rounded-xl font-mono text-xs focus:ring-1 focus:ring-brand-maroon outline-none"
                    >
                      {(sheetCells[0] || Array(10).fill("")).map((_, idx) => (
                        <option key={idx} value={idx}>
                          {getColLetter(idx)}: {sheetCells[0]?.[idx] || `Column ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-neutral-600 block text-[11px]">End Column</label>
                    <select
                      value={mergeFormEndCol}
                      onChange={(e) => setMergeFormEndCol(parseInt(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-white border border-neutral-250 rounded-xl font-mono text-xs focus:ring-1 focus:ring-brand-maroon outline-none"
                    >
                      {(sheetCells[0] || Array(10).fill("")).map((_, idx) => (
                        <option key={idx} value={idx}>
                          {getColLetter(idx)}: {sheetCells[0]?.[idx] || `Column ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-neutral-600 block text-[11px]">Section Label / Folio Title (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. ★ NEWS & CURRENT AFFAIRS SECTION"
                    value={mergeFormLabel}
                    onChange={(e) => setMergeFormLabel(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-neutral-250 rounded-xl text-xs focus:ring-1 focus:ring-brand-maroon outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-neutral-900 hover:bg-black text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Add Merged Cell Range</span>
                </button>
              </form>
            </div>

            <div className="pt-3 border-t border-neutral-100 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowMergeModal(false)}
                className="px-4 py-2 bg-brand-maroon text-white font-bold rounded-xl hover:bg-brand-maroon-dark transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
