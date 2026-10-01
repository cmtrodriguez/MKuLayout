import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, Auth } from "firebase/auth";
import defaultFirebaseConfig from "../../firebase-applet-config.json";
import { Task, TeamMember, SheetMerge } from "../types";

export function getFirebaseConfig() {
  const saved = localStorage.getItem("custom_firebase_config");
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse custom firebase config", e);
    }
  }
  return defaultFirebaseConfig;
}

export function getFirebaseAuth(): Auth {
  const config = getFirebaseConfig();
  const appName = config.projectId || "default";
  
  let app;
  const existingApps = getApps();
  const existing = existingApps.find(a => a.name === appName);
  
  if (existing) {
    app = existing;
  } else {
    app = initializeApp(config, appName);
  }
  
  return getAuth(app);
}

const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/spreadsheets");
// Always show the Google account chooser so the editor can sync the Sheets
// account they intend (not whichever session the browser happens to hold).
provider.setCustomParameters({ prompt: "select_account" });

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) {
    console.warn("Sign in request already in progress.");
    return null;
  }
  try {
    isSigningIn = true;
    const auth = getFirebaseAuth();
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to get access token from Google OAuth");
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    if (
      error?.code === "auth/cancelled-popup-request" ||
      error?.code === "auth/popup-closed-by-user" ||
      error?.message?.includes("cancelled-popup-request") ||
      error?.message?.includes("popup-closed-by-user")
    ) {
      console.warn("Sign-in popup request cancelled or closed by user:", error.code || error.message);
      return null;
    }
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  const auth = getFirebaseAuth();
  await auth.signOut();
  cachedAccessToken = null;
};

// --- Google Sheets Operations ---

export interface SheetMetadata {
  title: string;
  sheetId?: number;
  gridProperties?: {
    rowCount: number;
    columnCount: number;
  };
  merges?: SheetMerge[];
}

export { type SheetMerge } from "../types";

export function getCellMergeInfo(rowIdx: number, colIdx: number, merges: SheetMerge[]) {
  if (!merges || merges.length === 0) {
    return { inMerge: false, isOrigin: true, rowSpan: 1, colSpan: 1, merge: null };
  }
  for (const m of merges) {
    if (
      rowIdx >= m.startRowIndex &&
      rowIdx < m.endRowIndex &&
      colIdx >= m.startColumnIndex &&
      colIdx < m.endColumnIndex
    ) {
      const isOrigin = rowIdx === m.startRowIndex && colIdx === m.startColumnIndex;
      return {
        inMerge: true,
        isOrigin,
        rowSpan: m.endRowIndex - m.startRowIndex,
        colSpan: m.endColumnIndex - m.startColumnIndex,
        merge: m
      };
    }
  }
  return { inMerge: false, isOrigin: true, rowSpan: 1, colSpan: 1, merge: null };
}

export function detectMergedSectionRows(cells: string[][]): SheetMerge[] {
  const merges: SheetMerge[] = [];
  if (!cells || cells.length <= 1) return merges;
  const numCols = cells[0]?.length || 10;
  
  for (let r = 1; r < cells.length; r++) {
    const row = cells[r];
    if (!row) continue;
    
    // Case 1: Col 1 has text, Col 0 is empty or number, and Cols 2..numCols-1 are all empty
    const col1 = String(row[1] || "").trim();
    const isRestEmpty = row.slice(2).every(c => !c || String(c).trim() === "");
    const isSectionBanner = 
      col1.toLowerCase().includes("section") || 
      col1.toLowerCase().includes("folio") || 
      col1.startsWith("★") || 
      col1.startsWith("---") ||
      (col1.length > 5 && isRestEmpty);

    if (col1 && isRestEmpty && isSectionBanner) {
      merges.push({
        startRowIndex: r,
        endRowIndex: r + 1,
        startColumnIndex: 1,
        endColumnIndex: numCols,
        label: col1.replace(/^★\s*/, "")
      });
      continue;
    }

    // Case 2: Col 0 has text and Cols 1..numCols-1 are all empty
    const col0 = String(row[0] || "").trim();
    const isAllRestEmpty = row.slice(1).every(c => !c || String(c).trim() === "");
    if (col0 && isAllRestEmpty && (col0.toLowerCase().includes("section") || col0.startsWith("★") || col0.startsWith("---") || col0.length > 8)) {
      merges.push({
        startRowIndex: r,
        endRowIndex: r + 1,
        startColumnIndex: 0,
        endColumnIndex: numCols,
        label: col0.replace(/^★\s*/, "")
      });
    }
  }
  return merges;
}

async function getApiErrorMessage(res: Response, defaultMsg: string): Promise<string> {
  let detail = "";
  try {
    const data = await res.json();
    if (data?.error?.message) {
      detail = data.error.message;
    }
  } catch (e) {
    // Ignore JSON parsing errors
  }
  const statusText = detail || res.statusText || (res.status === 401 ? "Unauthorized / Token expired" : res.status === 403 ? "Access denied" : res.status === 404 ? "Spreadsheet not found" : "Unknown API error");
  return `${defaultMsg}: ${statusText}`.trim();
}

export async function fetchSpreadsheetMetadata(spreadsheetId: string, token: string): Promise<SheetMetadata[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errorMsg = await getApiErrorMessage(res, "Failed to fetch spreadsheet metadata");
    throw new Error(errorMsg);
  }
  const data = await res.json();
  return (data.sheets || []).map((s: any) => ({
    ...(s.properties || {}),
    merges: (s.merges || []).map((m: any) => ({
      sheetId: m.sheetId ?? s.properties?.sheetId ?? 0,
      startRowIndex: m.startRowIndex ?? 0,
      endRowIndex: m.endRowIndex ?? 1,
      startColumnIndex: m.startColumnIndex ?? 0,
      endColumnIndex: m.endColumnIndex ?? 1
    }))
  }));
}

export async function getSheetMerges(spreadsheetId: string, sheetId: number, token: string): Promise<SheetMerge[]> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title),merges)`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const sheet = data.sheets?.find((s: any) => s.properties?.sheetId === sheetId);
    if (!sheet || !sheet.merges) return [];
    return sheet.merges.map((m: any) => ({
      sheetId: m.sheetId ?? sheetId,
      startRowIndex: m.startRowIndex ?? 0,
      endRowIndex: m.endRowIndex ?? 1,
      startColumnIndex: m.startColumnIndex ?? 0,
      endColumnIndex: m.endColumnIndex ?? 1,
    }));
  } catch (err) {
    console.warn("Failed to fetch sheet merges:", err);
    return [];
  }
}

export async function mergeSheetCells(
  spreadsheetId: string,
  sheetId: number,
  merge: SheetMerge,
  token: string
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          mergeCells: {
            range: {
              sheetId: sheetId,
              startRowIndex: merge.startRowIndex,
              endRowIndex: merge.endRowIndex,
              startColumnIndex: merge.startColumnIndex,
              endColumnIndex: merge.endColumnIndex,
            },
            mergeType: "MERGE_ALL",
          },
        },
      ],
    }),
  });
  if (!res.ok) {
    const err = await getApiErrorMessage(res, "Failed to merge cells in Google Sheets");
    throw new Error(err);
  }
}

export async function unmergeSheetCells(
  spreadsheetId: string,
  sheetId: number,
  range: { startRowIndex: number; endRowIndex: number; startColumnIndex: number; endColumnIndex: number },
  token: string
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          unmergeCells: {
            range: {
              sheetId: sheetId,
              startRowIndex: range.startRowIndex,
              endRowIndex: range.endRowIndex,
              startColumnIndex: range.startColumnIndex,
              endColumnIndex: range.endColumnIndex,
            },
          },
        },
      ],
    }),
  });
  if (!res.ok) {
    const err = await getApiErrorMessage(res, "Failed to unmerge cells in Google Sheets");
    throw new Error(err);
  }
}

// Map spreadsheet tabs dynamically or return fallbacks
export async function getSheetTabs(spreadsheetId: string, token: string) {
  try {
    const sheets = await fetchSpreadsheetMetadata(spreadsheetId, token);
    const scheduleTab = sheets.find(s => s.title.toLowerCase().includes("schedule") || s.title.toLowerCase().includes("issue") || s.title.toLowerCase().includes("task"))?.title || sheets[0]?.title || "Schedule";
    const foundRoster = sheets.find(s => s.title.toLowerCase().includes("roster") || s.title.toLowerCase().includes("member") || s.title.toLowerCase().includes("team"));
    const rosterTab = foundRoster?.title || "Roster";
    const rosterExists = !!foundRoster;
    return { scheduleTab, rosterTab, rosterExists };
  } catch (err) {
    console.warn("Could not retrieve sheets metadata, using defaults", err);
    return { scheduleTab: "Schedule", rosterTab: "Roster", rosterExists: false };
  }
}

// Create a new sheet tab in the spreadsheet
export async function createSheetTab(spreadsheetId: string, title: string, token: string): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title: title
            }
          }
        }
      ]
    })
  });
  if (!res.ok) {
    throw new Error(`Failed to create sheet tab "${title}": ${res.statusText}`);
  }
}

// Rename a sheet tab in the spreadsheet
export async function renameSheetTab(spreadsheetId: string, sheetId: number, newTitle: string, token: string): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId: sheetId,
              title: newTitle
            },
            fields: "title"
          }
        }
      ]
    })
  });
  if (!res.ok) {
    throw new Error(`Failed to rename sheet: ${res.statusText}`);
  }
}

// Duplicate a sheet tab in the spreadsheet
export async function duplicateSheetTab(spreadsheetId: string, sheetId: number, newTitle: string, token: string): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          duplicateSheet: {
            sourceSheetId: sheetId,
            newSheetName: newTitle
          }
        }
      ]
    })
  });
  if (!res.ok) {
    throw new Error(`Failed to duplicate sheet: ${res.statusText}`);
  }
}

// Delete a sheet tab in the spreadsheet
export async function deleteSheetTab(spreadsheetId: string, sheetId: number, token: string): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          deleteSheet: {
            sheetId: sheetId
          }
        }
      ]
    })
  });
  if (!res.ok) {
    throw new Error(`Failed to delete sheet: ${res.statusText}`);
  }
}

// Fetch values from a range (extracting cell hyperlinks & rich text links if available)
export async function getSheetValues(spreadsheetId: string, range: string, token: string): Promise<string[][]> {
  // 1. Attempt grid data fetch to retrieve underlying cell hyperlinks (formula links & rich text links)
  try {
    const gridUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?ranges=${encodeURIComponent(range)}&includeGridData=true&fields=sheets.data.rowData.values(formattedValue,userEnteredValue,hyperlink,textFormatRuns)`;
    const gridRes = await fetch(gridUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (gridRes.ok) {
      const gridData = await gridRes.json();
      const rowData = gridData.sheets?.[0]?.data?.[0]?.rowData;
      if (rowData && Array.isArray(rowData)) {
        const matrix: string[][] = rowData.map((row: any) => {
          if (!row.values || !Array.isArray(row.values)) return [];
          return row.values.map((cell: any) => {
            if (!cell) return "";
            
            // If formula is already an explicit =HYPERLINK(...), return it directly
            const formula = cell.userEnteredValue?.formulaValue;
            if (formula && typeof formula === "string" && formula.toUpperCase().startsWith("=HYPERLINK")) {
              return formula;
            }

            // Check if cell has explicit hyperlink property
            let linkUrl = cell.hyperlink;

            // Check if cell has textFormatRuns with link.uri
            if (!linkUrl && cell.textFormatRuns && Array.isArray(cell.textFormatRuns)) {
              for (const run of cell.textFormatRuns) {
                if (run.format?.link?.uri) {
                  linkUrl = run.format.link.uri;
                  break;
                }
              }
            }

            const formattedVal = cell.formattedValue || cell.userEnteredValue?.stringValue || "";

            // If hyperlink URL found, format as =HYPERLINK formula string
            if (linkUrl && (linkUrl.startsWith("http://") || linkUrl.startsWith("https://"))) {
              const label = formattedVal || linkUrl;
              return `=HYPERLINK("${linkUrl}", "${label}")`;
            }

            return formattedVal || (formula ? String(formula) : "");
          });
        });

        if (matrix.length > 0) {
          return matrix;
        }
      }
    }
  } catch (err) {
    console.warn("Grid data fetch failed, falling back to values endpoint:", err);
  }

  // 2. Fallback to values.get endpoint
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMULA`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 404) {
      return [];
    }
    const errorMsg = await getApiErrorMessage(res, "Failed to fetch values");
    throw new Error(errorMsg);
  }
  const data = await res.json();
  return data.values || [];
}

// Update values in a range
export async function updateSheetValues(spreadsheetId: string, range: string, values: string[][], token: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    const errorMsg = await getApiErrorMessage(res, "Failed to update sheet values");
    throw new Error(errorMsg);
  }
  return await res.json();
}

// Clear values in a range
export async function clearSheetValues(spreadsheetId: string, range: string, token: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to clear sheet values: ${res.statusText}`);
  }
  return await res.json();
}

// Pull (Import) Schedule from Google Sheets
export function parseScheduleRows(rows: string[][], currentTasks: Task[]): Task[] {
  if (rows.length <= 1) return currentTasks; // Only headers or empty
  
  const headers = rows[0].map(h => h.trim().toLowerCase());
  
  // Find column indices
  const dateIdx = headers.findIndex(h => h.includes("date") || h.includes("release"));
  const catIdx = headers.findIndex(h => h.includes("category") || h.includes("content") || h.includes("type") || h.includes("section"));
  const titleIdx = headers.findIndex(h => h.includes("title") || h.includes("summary") || h.includes("artx") || h.includes("assignment"));
  const writerIdx = headers.findIndex(h => h.includes("writer") || h.includes("author"));
  const artistIdx = headers.findIndex(h => h.includes("artist") || h.includes("assignee") || h.includes("layout") || h === "layout");
  const writeupIdx = headers.findIndex(h => h.includes("writeup") || h.includes("id") || h.includes("link") || h.includes("draft"));
  const priorityIdx = headers.findIndex(h => h.includes("priority"));
  const statusIdx = headers.findIndex(h => h.includes("status") || h.includes("progress"));

  // Extra headers for 10-column layout
  const graphicsIdx = headers.findIndex(h => h.includes("graphics") || h.includes("illus"));
  const onlineIdx = headers.findIndex(h => h.includes("online"));
  const draftIdx = headers.findIndex(h => h.includes("draft"));
  const addedIdx = headers.findIndex(h => h.includes("added") || h.includes("final") || h.includes("layout?"));

  // Keep other tasks (non-Newspaper Issue types unless they were imported from sheets)
  const nonNewspaperTasks = currentTasks.filter(t => t.typeOfRelease !== "Issue Article" && !t.id.startsWith("sheet-t-"));

  const importedTasks: Task[] = rows.slice(1).map((row, i): Task | null => {
    const title = (titleIdx !== -1 ? row[titleIdx] : "")?.trim();
    if (!title) return null; // Skip blank or incomplete rows

    const typeOfContent = (catIdx !== -1 ? row[catIdx] : "feats artx") || "feats artx";
    const writer = (writerIdx !== -1 ? row[writerIdx] : "Unknown Writer") || "Unknown Writer";
    const illusLayout = (artistIdx !== -1 ? row[artistIdx] : "Unassigned") || "Unassigned";
    const writeup = (writeupIdx !== -1 ? row[writeupIdx] : "") || "";
    const priority = (priorityIdx !== -1 ? row[priorityIdx] : "Medium") as any || "Medium";
    const progress = (statusIdx !== -1 ? row[statusIdx] : "Not Started") as any || "Not Started";
    const releaseDate = (dateIdx !== -1 ? row[dateIdx] : "JULY 15") || "JULY 15";

    // Extra fields
    const graphicsIllus = (graphicsIdx !== -1 ? row[graphicsIdx] : "") || "";
    const onlineHandler = (onlineIdx !== -1 ? row[onlineIdx] : "") || "";
    const draftLink = (draftIdx !== -1 ? row[draftIdx] : "") || "";
    const addedToLayout = (addedIdx !== -1 ? row[addedIdx] : "") || "";

    // Try to find if we already have this task by matching title to keep comments/revisions
    const existing = currentTasks.find(t => t.title.toLowerCase() === title.toLowerCase());

    return {
      id: existing?.id || `sheet-t-${i}-${Date.now()}`,
      title,
      typeOfRelease: "Issue Article",
      typeOfContent,
      writer,
      illusLayout,
      progress: progress === "Working" ? "In Progress" : progress === "Review" ? "For Review" : progress,
      writeup: draftLink || writeup,
      priority,
      releaseDate,
      files: existing?.files || [],
      commentsCount: existing?.commentsCount || 0,
      revisionCount: existing?.revisionCount || 0,
      lastUpdated: new Date().toISOString(),
      pubmatLink: existing?.pubmatLink || "",
      isPendingConfirmation: existing ? (existing.isPendingConfirmation ?? false) : false,
      draftLink: draftLink || existing?.draftLink,
      addedToLayout: addedToLayout || existing?.addedToLayout,
      graphicsIllus: graphicsIllus || existing?.graphicsIllus,
      onlineHandler: onlineHandler || existing?.onlineHandler,
      graphics: graphicsIllus || existing?.graphics
    };
  }).filter((t): t is Task => t !== null);

  return [...nonNewspaperTasks, ...importedTasks];
}

// Push (Export) Schedule to Google Sheets format
export function formatScheduleToRows(tasks: Task[]): string[][] {
  const headers = [
    "Na",
    "Section or Content",
    "Title or summary of artx",
    "Writer",
    "Graphics/Illus",
    "Layout",
    "Online",
    "Progress",
    "Draft Link",
    "Added final artx to layout?"
  ];

  const newspaperTasks = tasks.filter(t => t.typeOfRelease === "Issue Article" || t.id.startsWith("sheet-t-"));
  const dataRows = newspaperTasks.map((t, idx) => [
    (idx + 1).toString(),
    t.typeOfContent,
    t.title,
    t.writer,
    t.graphicsIllus || t.graphics || "",
    t.illusLayout,
    t.onlineHandler || "",
    t.progress === "In Progress" ? "Working" : t.progress === "For Review" ? "Review" : t.progress,
    t.draftLink || t.writeup || "",
    t.addedToLayout || ""
  ]);

  return [headers, ...dataRows];
}

// Pull (Import) Roster from Google Sheets
export function parseRosterRows(rows: string[][], currentMembers: TeamMember[]): TeamMember[] {
  if (rows.length <= 1) return currentMembers;

  const headers = rows[0].map(h => h.trim().toLowerCase());
  
  const nameIdx = headers.findIndex(h => h.includes("name"));
  const collegeIdx = headers.findIndex(h => h.includes("college"));
  const emailIdx = headers.findIndex(h => h.includes("mail") || h.includes("email"));
  const contactIdx = headers.findIndex(h => h.includes("contact") || h.includes("phone"));
  const status1Idx = headers.findIndex(h => h.includes("1st") || h.includes("sem1"));
  const status2Idx = headers.findIndex(h => h.includes("2nd") || h.includes("sem2"));
  const roleIdx = headers.findIndex(h => h.includes("role"));
  const typeIdx = headers.findIndex(h => h.includes("type"));
  const xpIdx = headers.findIndex(h => h.includes("xp"));
  const levelIdx = headers.findIndex(h => h.includes("level"));

  const importedMembers: TeamMember[] = rows.slice(1).map((row, i) => {
    const name = row[nameIdx] || `Artist ${i + 1}`;
    const college = row[collegeIdx] || "CAS";
    const email = row[emailIdx] || "";
    const contact = row[contactIdx] || "";
    const statusSem1 = (row[status1Idx] || "Active") as any;
    const statusSem2 = (row[status2Idx] || "Active") as any;
    const role = (row[roleIdx] || "Layout Staff Member") as any;
    const type = (row[typeIdx] || "layout") as any;
    const xp = parseInt(row[xpIdx] || "0", 10) || 0;
    const level = parseInt(row[levelIdx] || "1", 10) || 1;

    const existing = currentMembers.find(m => m.email.toLowerCase() === email.toLowerCase());

    return {
      id: existing?.id || `sheet-m-${i}-${Date.now()}`,
      name,
      role,
      college,
      email,
      contact,
      statusSem1,
      statusSem2,
      type,
      xp,
      level,
      completedTasks: existing?.completedTasks || 0
    };
  });

  return importedMembers;
}

// Push (Export) Roster to Google Sheets format
export function formatRosterToRows(members: TeamMember[]): string[][] {
  const headers = [
    "Name",
    "College",
    "UP Mail",
    "Contact No",
    "1st Sem Status",
    "2nd Sem Status",
    "Role",
    "Type",
    "XP",
    "Level"
  ];

  const dataRows = members.map(m => [
    m.name,
    m.college,
    m.email,
    m.contact,
    m.statusSem1,
    m.statusSem2,
    m.role,
    m.type,
    m.xp.toString(),
    m.level.toString()
  ]);

  return [headers, ...dataRows];
}
