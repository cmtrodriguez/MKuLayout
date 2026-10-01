import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { 
  LayoutGrid, FileSpreadsheet, Kanban, GraduationCap, Calendar, 
  HelpCircle, Bot, Users, Bell, AlertOctagon, Plus, X, Shield, 
  Sparkles, ShieldCheck, HeartPulse, CheckSquare, RefreshCw, BookOpen,
  Menu, LogOut, Link2, Sun, Moon, FileText, CheckCircle2, ExternalLink, Loader2, User, ArrowRight
} from "lucide-react";

// Sub Components
import DashboardOverview from "./components/DashboardOverview";
import AssignmentsList from "./components/AssignmentsList";
import MeetingPolls from "./components/MeetingPolls";
import TeamDirectory from "./components/TeamDirectory";
import CalendarView from "./components/CalendarView";
import TaskDetailsModal from "./components/TaskDetailsModal";
import LoginPage from "./components/LoginPage";
import QuickAccessHub from "./components/QuickAccessHub";
import ProfileSettings from "./components/ProfileSettings";
import { LayoutStaffDashboard, EicDashboard } from "./components/RoleDashboards";
import { CanvaDirectory } from "./components/CanvaDirectory";
import SheetsSync from "./components/SheetsSync";
import { OFFICIAL_MEMBERS_MAP, getPreferredFirstName, resolveLayoutAssignee, resolveMemberEmail, getEditorDeputyEmails } from "./lib/memberUtils";
import { AccentTheme, applyAccentCssVars } from "./lib/accentTheme";
import { seededUuid } from "./lib/seededUuid";
import { getPubmatCanvaTemplates } from "./lib/canvaTemplates";
import { supabase, fetchUserProfileByEmail, fetchTasks, fetchMembers, fetchComments, fetchCalendarEvents, fetchPolls, fetchAnnouncements, fetchNotifications, fetchIssueSheets, upsertTask, deleteTask, upsertMember, createComment, upsertCalendarEvent, deleteCalendarEvent, createPoll, updatePollOptionVotes, deletePoll, createNotification, markNotificationRead, createAnnouncement, saveIssueSheets, fetchConfig, saveConfig, subscribeToLayoutRealtime } from "./lib/supabase";
import mkuleImg from "./mkule.png";

// Domain Models
import { Task, TeamMember, CalendarEvent, Poll, Notification, TaskComment, UserRole, normalizeEmail } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  
  // Data State
  const [tasks, setTasks] = useState<Task[]>([]);
  // Mirror of `tasks` kept in sync so commitTasks can compute the next list from the
  // latest value even when several mutations land in the same render batch.
  const tasksRef = useRef<Task[]>(tasks);
  tasksRef.current = tasks;
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // User Authentication & Role States
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>("Layout Staff Member");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");

  const issueSheetTemplate = [
    { id: "issue-row-1", page: "1", section: "Front", title: "MM Front Cover", writer: "", graphics: "", layout: "Xtian", online: "", progress: "In Progress" },
    { id: "issue-row-2", page: "2", section: "Editorial", title: "", writer: "Con & Christian", graphics: "", layout: "Christian", online: "", progress: "" },
    { id: "issue-row-3", page: "3", section: "News", title: "Climate Disinformation in Agriculture", writer: "", graphics: "", layout: "Christian", online: "Issa", progress: "" },
    { id: "issue-row-4", page: "4-5", section: "Features", title: "Kababaihan sa LR", writer: "", graphics: "", layout: "Zoe", online: "Zoe", progress: "" },
    { id: "issue-row-5", page: "6", section: "Cult", title: "Porma ng Pagtatanim", writer: "", graphics: "", layout: "Iris", online: "Eve", progress: "" },
    { id: "issue-row-6", page: "", section: "Opinion", title: "Career Fatigue", writer: "Cath", graphics: "", layout: "Ronz", online: "", progress: "" },
    { id: "issue-row-7", page: "7", section: "Opinion", title: "", writer: "Nell", graphics: "", layout: "Xtian", online: "Eve", progress: "" },
    { id: "issue-row-8", page: "8", section: "Cult", title: "Farmer Tula about Kanin", writer: "Jhe", graphics: "", layout: "Jhe", online: "", progress: "" }
  ];

  const [issueSheets, setIssueSheets] = useState<Array<{ id: string; title: string; rows: Array<{ id: string; page: string; section: string; title: string; writer: string; graphics: string; layout: string; online: string; progress: string }> }>>(() => {
    // Issue sheets are shared team data, so the backend copy (loaded in the
    // fetch effect below) is authoritative. Local storage is only a seed cache
    // so the first paint is not empty before the network round-trip.
    try {
      const saved = localStorage.getItem("mkule_issue_publication_sheets");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore malformed local storage values
    }
    return [{ id: "issue-sheet-1", title: "Issue Pages Sheet", rows: issueSheetTemplate }];
  });
  const issueSheetsRef = useRef(issueSheets);
  issueSheetsRef.current = issueSheets;

  // Persist issue sheets to the shared backend so every account sees the same rows.
  const persistIssueSheets = (sheets: typeof issueSheets) => {
    setIssueSheets(sheets);
    issueSheetsRef.current = sheets;
    localStorage.setItem("mkule_issue_publication_sheets", JSON.stringify(sheets));
    saveIssueSheets(sheets).catch(() => {
      // Fallback: also try the legacy /api/state endpoint
      pushStateToBackend({ issueSheets: sheets });
    });
  };

  // Functional-updater form that always computes from the freshest ref and persists.
  const updateIssueSheets = (updater: (prev: typeof issueSheets) => typeof issueSheets) => {
    persistIssueSheets(updater(issueSheetsRef.current));
  };
  const [currentIssueSheetId, setCurrentIssueSheetId] = useState(() => {
    try {
      const saved = localStorage.getItem("mkule_issue_publication_current_sheet");
      if (saved) return saved;
    } catch {
      // ignore malformed local storage values
    }
    return "issue-sheet-1";
  });

  const currentIssueSheet = issueSheets.find((sheet) => sheet.id === currentIssueSheetId) ?? issueSheets[0];
  const issueRows = currentIssueSheet?.rows ?? [];
  const issueSheetTitle = currentIssueSheet?.title ?? "Issue Pages Sheet";
  const issueTaskCards = tasks.filter((task) => {
    const isIssueTask = task.typeOfRelease === "Issue Article" || (task as any).sourceIssueRowId;
    const isOnlineOnlyCompanion = task.title.includes("(Online Pubmat)") || task.typeOfRelease === "Online Article";
    return isIssueTask && !isOnlineOnlyCompanion;
  });

  // Master Google Sheets link backing the Issue Pages live viewer/editor. Shared
  // across every account via app_state so the whole desk edits the same spreadsheet.
  const [googleSheetsLink, setGoogleSheetsLink] = useState<string>(() => {
    try {
      return localStorage.getItem("mkule_google_sheets_link") || "";
    } catch {
      return "";
    }
  });
  const updateGoogleSheetsLink = (link: string) => {
    setGoogleSheetsLink(link);
    try { localStorage.setItem("mkule_google_sheets_link", link); } catch { /* ignore */ }
    saveConfig({ googleSheetsLink: link }).catch(() => {});
  };

  // Accessibility State (Passed to Panel)
  const [highContrast, setHighContrast] = useState(false);
  const [dyslexicFont, setDyslexicFont] = useState(false);
  const [fontSizeMultiplier, setFontSizeMultiplier] = useState(1);
  const [speechEnabled, setSpeechEnabled] = useState(false);

  // Theme & Appearance State (persisted per-account, defaults to light)
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [accentTheme, setAccentTheme] = useState<AccentTheme>(() => {
    return (localStorage.getItem("mkule_accent") as AccentTheme) || "maroon";
  });

  // Guards the persist effect so loading a saved theme (or switching accounts)
  // never writes the previous account's value onto the new account's key.
  const themeSkipPersist = useRef(false);
  const wasAuthenticatedRef = useRef(false);
  const themeKeyFor = (email: string) => `mkule_theme_${email.toLowerCase()}`;

  // Load the signed-in account's own theme preference; light when unset.
  useEffect(() => {
    themeSkipPersist.current = true;
    if (!userEmail) {
      setDarkMode(false);
      return;
    }
    setDarkMode(localStorage.getItem(themeKeyFor(userEmail)) === "dark");
  }, [userEmail]);

  // Apply the dark class and persist the choice against the current account.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    if (themeSkipPersist.current) {
      themeSkipPersist.current = false;
      return;
    }
    if (!userEmail) return;
    localStorage.setItem(themeKeyFor(userEmail), darkMode ? "dark" : "light");
  }, [darkMode, userEmail]);

  const applyAccentTheme = (color: AccentTheme) => {
    setAccentTheme(color);
    localStorage.setItem("mkule_accent", color);
    applyAccentCssVars(color);
  };

  useEffect(() => {
    applyAccentCssVars(accentTheme);
  }, [accentTheme]);

  // Tasks persisted from issue-sheet rows carry deterministic ids; re-attach the
  // source row id after a fetch so sheet edits can still find and replace them.
  const tagTasksWithSourceRows = (list: Task[], sheets: typeof issueSheets): Task[] => {
    const rowIdByTaskId = new Map<string, string>();
    sheets.forEach((sheet) => sheet.rows.forEach((row) => {
      rowIdByTaskId.set(seededUuid(`issue-task-${row.id}`), row.id);
      rowIdByTaskId.set(seededUuid(`online-task-${row.id}`), row.id);
      rowIdByTaskId.set(seededUuid(`issue-pending-${row.id}`), row.id);
    }));
    return list.map((t) => {
      if (t.sourceIssueRowId) return t;
      const rowId = rowIdByTaskId.get(t.id);
      return rowId ? { ...t, sourceIssueRowId: rowId } : t;
    });
  };

  // Modals Visibility
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [editingIssueRowId, setEditingIssueRowId] = useState<string | null>(null);
  const [issueRowDraft, setIssueRowDraft] = useState<any | null>(null);
  const [confirmDeleteRowId, setConfirmDeleteRowId] = useState<string | null>(null);

  // Form Inputs
  const [formTitle, setFormTitle] = useState("");
  const [formDocLink, setFormDocLink] = useState("");
  const [taskFormOrigin, setTaskFormOrigin] = useState<string>("general");
  const [formReleaseType, setFormReleaseType] = useState("Online Article");
  const [formContentType, setFormContentType] = useState("News");
  const [formWriter, setFormWriter] = useState("");
  const [formArtist, setFormArtist] = useState("Unassigned");
  const [formPriority, setFormPriority] = useState<"Low" | "Medium" | "High" | "Urgent">("Medium");
  const [formReleaseDate, setFormReleaseDate] = useState("");
  const [formWriteup, setFormWriteup] = useState("");
  const [formPubmatLink, setFormPubmatLink] = useState("");

  const layoutArtistOptions = Array.from(
    new Map(
      [...Object.values(OFFICIAL_MEMBERS_MAP), ...members]
        .filter((member: any) => {
          const role = (member?.role || "").toLowerCase();
          const type = (member?.type || "").toLowerCase();
          const isLayoutMember = type === "layout" || role.includes("layout") || role.includes("deputy") || role.includes("staffer") || role.includes("probi");
          if (!isLayoutMember) return false;

          if (userRole === "Layout Editor") {
            return role.includes("deputy") || role.includes("staffer") || role.includes("probi");
          }

          if (userRole === "Layout Deputy") {
            return role.includes("editor") || role.includes("staffer") || role.includes("probi");
          }

          return false;
        })
        .map((member: any) => {
          const name = getPreferredFirstName(member?.name, member?.email);
          const key = (member?.email || name || member?.name || "").toLowerCase();
          return [key, { value: name, label: name, email: member?.email || "" }];
        })
    ).values()
  ).sort((a, b) => a.label.localeCompare(b.label));

  const allLayoutMemberFirstNames = Array.from(
    new Set(
      [...Object.values(OFFICIAL_MEMBERS_MAP), ...members]
        .filter((member: any) => {
          const role = (member?.role || "").toLowerCase();
          const type = (member?.type || "").toLowerCase();
          return type === "layout" || role.includes("layout") || role.includes("deputy") || role.includes("staffer") || role.includes("probi") || role.includes("editor");
        })
        .map((member: any) => getPreferredFirstName(member?.name, member?.email))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  const resolvedFormArtist = layoutArtistOptions.some((option) => option.value === formArtist)
    ? formArtist
    : "Unassigned";

  // Fetch all app data from Supabase and initialise local state
  const fetchAllState = async () => {
    try {
      const [sbTasks, sbMembers, sbComments, sbEvents, sbPolls, sbAnnouncements, sbNotifications, sbIssueSheets, sbConfig] = await Promise.all([
        fetchTasks(),
        fetchMembers(),
        fetchComments(),
        fetchCalendarEvents(),
        fetchPolls(),
        fetchAnnouncements(),
        fetchNotifications(),
        fetchIssueSheets(),
        fetchConfig()
      ]);

      setTasks(tagTasksWithSourceRows(sbTasks, (sbIssueSheets && sbIssueSheets.length > 0) ? sbIssueSheets : issueSheetsRef.current));
      setMembers(sbMembers);
      setComments(sbComments);
      setEvents(sbEvents);
      setPolls(sbPolls);
      setAnnouncements(sbAnnouncements);
      setNotifications(sbNotifications);

      if (sbIssueSheets && sbIssueSheets.length > 0) {
        setIssueSheets(sbIssueSheets);
        issueSheetsRef.current = sbIssueSheets;
        localStorage.setItem("mkule_issue_publication_sheets", JSON.stringify(sbIssueSheets));
      }

      if (sbConfig && typeof sbConfig.googleSheetsLink === "string" && sbConfig.googleSheetsLink) {
        setGoogleSheetsLink(sbConfig.googleSheetsLink);
        localStorage.setItem("mkule_google_sheets_link", sbConfig.googleSheetsLink);
      }
    } catch (err) {
      // Fall back to legacy /api/state if Supabase not available
      try {
        const response = await fetch("/api/state");
        if (response.ok) {
          const data = await response.json();
          setTasks(data.tasks || []);
          setMembers(data.members || []);
          setEvents(data.events || []);
          setPolls(data.polls || []);
          setComments(data.comments || []);
          setAnnouncements(data.announcements || []);
          setNotifications(data.notifications || []);
          if (Array.isArray(data.issueSheets) && data.issueSheets.length > 0) {
            setIssueSheets(data.issueSheets);
            localStorage.setItem("mkule_issue_publication_sheets", JSON.stringify(data.issueSheets));
          }
        }
      } catch (fallbackErr) {
        console.error("Failed to load initial layout state", fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllState();

    // Subscribe to realtime updates — no polling needed
    const unsubscribe = subscribeToLayoutRealtime({
      onTasksChange: async () => { setTasks(tagTasksWithSourceRows(await fetchTasks(), issueSheetsRef.current)); },
      onCommentsChange: async () => { setComments(await fetchComments()); },
      onCalendarChange: async () => { setEvents(await fetchCalendarEvents()); },
      onPollsChange: async () => { setPolls(await fetchPolls()); },
      onNotificationsChange: async () => { setNotifications(await fetchNotifications()); },
      onAnnouncementsChange: async () => { setAnnouncements(await fetchAnnouncements()); },
      onMembersChange: async () => { setMembers(await fetchMembers()); },
      onIssueSheetsChange: (data) => {
        if (Array.isArray(data) && data.length > 0) {
          setIssueSheets(data);
          issueSheetsRef.current = data;
          localStorage.setItem("mkule_issue_publication_sheets", JSON.stringify(data));
        }
      },
      onConfigChange: (data) => {
        if (data && typeof data.googleSheetsLink === "string") {
          setGoogleSheetsLink(data.googleSheetsLink);
          localStorage.setItem("mkule_google_sheets_link", data.googleSheetsLink);
        }
      }
    });

    return () => { unsubscribe(); };
  }, []);

  // Legacy helper — still used by issueSheets, but Supabase-first
  const pushStateToBackend = async (updates: {
    tasks?: Task[];
    members?: TeamMember[];
    events?: CalendarEvent[];
    polls?: Poll[];
    comments?: TaskComment[];
    notifications?: Notification[];
    announcements?: any[];
    issueSheets?: typeof issueSheets;
  }) => {
    // Issue sheets are stored in app_state via Supabase
    if (updates.issueSheets) {
      saveIssueSheets(updates.issueSheets).catch(() => {});
    }
    // Other mutations are handled via direct Supabase calls in each handler
  };

  const handleUpdateTasks = (newTasks: Task[]) => {
    const prevTasks = tasksRef.current;
    tasksRef.current = newTasks;
    setTasks(newTasks);
    persistTaskDiff(prevTasks, newTasks);

    // Deadline-change alert: notify the assignee when a leader edits the due date.
    // Only real dates count — issue-sheet tasks store a page number in releaseDate.
    prevTasks.forEach((prev) => {
      const next = newTasks.find((t) => t.id === prev.id);
      if (!next) return;
      const oldDate = (prev.releaseDate || "").trim();
      const newDate = (next.releaseDate || "").trim();
      const looksLikeDate = /(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)/i.test(newDate) || /^\d{4}-\d{2}-\d{2}$/.test(newDate);
      if (oldDate && newDate && oldDate !== newDate && looksLikeDate && next.illusLayout && next.illusLayout !== "Unassigned") {
        const assigneeEmail = resolveMemberEmail(next.illusLayout);
        if (assigneeEmail && assigneeEmail.toLowerCase() !== userEmail.toLowerCase()) {
          handleAddNotification(
            "Deadline Updated",
            `The deadline for '${next.title}' was moved from ${oldDate} to ${newDate}.`,
            "deadline",
            [assigneeEmail]
          );
        }
      }
    });
  };

  // Writes created/edited rows and deletes removed ones so every task with a real
  // DB (UUID) id survives a refresh and stays in sync across devices.
  const isDbId = (id?: string) =>
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const persistTaskDiff = (prevTasks: Task[], nextTasks: Task[]) => {
    const prevById = new Map(prevTasks.filter((t) => isDbId(t.id)).map((t) => [t.id, t]));
    const newById = new Map(nextTasks.filter((t) => isDbId(t.id)).map((t) => [t.id, t]));

    prevById.forEach((_, id) => {
      if (!newById.has(id)) void deleteTask(id);
    });
    newById.forEach((task, id) => {
      const prev = prevById.get(id);
      if (!prev || JSON.stringify(prev) !== JSON.stringify(task)) {
        void upsertTask(task);
      }
    });
  };

  // Compute the next task list from current state and persist it to the backend.
  // Used by every mutation path so no task change is lost on refresh.
  const commitTasks = (updater: Task[] | ((prev: Task[]) => Task[])) => {
    const prevTasks = tasksRef.current;
    const nextTasks = typeof updater === "function"
      ? (updater as (prev: Task[]) => Task[])(prevTasks)
      : updater;
    tasksRef.current = nextTasks;
    setTasks(nextTasks);
    persistTaskDiff(prevTasks, nextTasks);
    // Realtime will reflect the change across all sessions
  };

  const handleUpdateMembers = (newMembers: TeamMember[]) => {
    setMembers(newMembers);
    newMembers.forEach(m => upsertMember(m).catch(() => {}));
  };

  // SheetsSync emits pending tasks with lightweight ids (e.g. `sheet-t-<ts>`) that
  // are not DB UUIDs, so persistTaskDiff would skip them: they'd vanish on refresh
  // and never reach other accounts. Re-key them to a deterministic UUID derived
  // from the source row so they persist and sync like every other task.
  const handleSheetsSyncTasks = (nextTasks: Task[]) => {
    const normalized = nextTasks.map((t) => {
      if (isDbId(t.id)) return t;
      const basis = t.sourceIssueRowId || t.title || t.id;
      return { ...t, id: seededUuid(`sheet-pending-${basis}`) };
    });
    handleUpdateTasks(normalized);
  };

  const handleUpdateEvents = (newEvents: CalendarEvent[]) => {
    setEvents(newEvents);
    // Individual event mutations handled via upsertCalendarEvent/deleteCalendarEvent
  };

  const handleUpdatePolls = (newPolls: Poll[]) => {
    const prevPolls = polls;
    setPolls(newPolls);

    const prevById = new Map(prevPolls.map(p => [p.id, p]));
    const seenIds = new Set<string>();

    newPolls.forEach((poll) => {
      seenIds.add(poll.id);
      const prev = prevById.get(poll.id);
      if (!prev) {
        void createPoll(poll);
        return;
      }
      poll.options.forEach((opt) => {
        const prevOpt = prev.options.find(o => o.id === opt.id);
        if (!prevOpt || prevOpt.votes.join("|") !== opt.votes.join("|")) {
          void updatePollOptionVotes(opt.id, opt.votes);
        }
      });
    });

    prevById.forEach((_, id) => {
      if (!seenIds.has(id)) void deletePoll(id);
    });
  };

  const handleAddComment = (newComment: TaskComment) => {
    const updated = [...comments, newComment];
    setComments(updated);
    createComment(newComment).catch(() => {});
  };

  const AUTH_SESSION_KEY = "mkule_auth_session";
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

  const clearStoredSession = () => {
    try {
      localStorage.removeItem(AUTH_SESSION_KEY);
    } catch {
      // ignore storage errors
    }
  };

  const persistSessionState = (email: string, role: UserRole, name: string) => {
    try {
      const payload = {
        email: normalizeEmail(email),
        role,
        name,
        lastActivityAt: Date.now(),
      };
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }
  };

  const restoreStoredSession = () => {
    try {
      const raw = localStorage.getItem(AUTH_SESSION_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as {
        email?: string;
        role?: UserRole;
        name?: string;
        lastActivityAt?: number;
      };

      if (!parsed.email || !parsed.role || !parsed.name) {
        clearStoredSession();
        return null;
      }

      const elapsed = Date.now() - (parsed.lastActivityAt ?? Date.now());
      if (elapsed > SIX_HOURS_MS) {
        clearStoredSession();
        return null;
      }

      return parsed;
    } catch {
      clearStoredSession();
      return null;
    }
  };

  // Authoritative role resolution. The official section registry is the source of truth
  // for the fixed Layout roles, so a refresh / token-refresh can never downgrade an
  // Editor or Deputy to "Layout Staff Member" just because the DB profile role is empty.
  const resolveRoleForEmail = (
    email: string,
    profileRole?: string | null,
    storedRole?: UserRole,
    fallbackRole: UserRole = "Layout Staff Member"
  ): UserRole => {
    const normalized = normalizeEmail(email || "").toLowerCase();
    const registryRole = OFFICIAL_MEMBERS_MAP[normalized]?.role;
    return (registryRole ?? (profileRole as UserRole | undefined) ?? storedRole ?? fallbackRole) as UserRole;
  };

  // The official registry name wins so restored sessions drop stale name formats
  // (e.g. the old "LAST - First" prefix) without needing a fresh login.
  const resolveDisplayName = (email: string, storedName?: string) =>
    OFFICIAL_MEMBERS_MAP[normalizeEmail(email || "").toLowerCase()]?.displayName || storedName || "";

  const applyAuthenticatedUser = async (email: string, fallbackRole: UserRole, fallbackName: string) => {
    const normalizedEmail = normalizeEmail(email);
    const profile = await fetchUserProfileByEmail(normalizedEmail);

    // Preserve the role the user actually logged in with. Auth events such as
    // TOKEN_REFRESHED (fired when a background tab regains focus) re-run this with a
    // generic fallback role, so without this the account would silently downgrade.
    const stored = restoreStoredSession();
    const storedRole =
      stored && normalizeEmail(stored.email ?? "").toLowerCase() === normalizedEmail.toLowerCase()
        ? (stored.role as UserRole | undefined)
        : undefined;

    const resolvedRole = resolveRoleForEmail(normalizedEmail, profile?.role, storedRole, fallbackRole);
    // The official registry name matches what the login screen shows, so a refresh or
    // token-refresh in a background tab can never swap the display name for the email.
    const storedName =
      stored && normalizeEmail(stored.email ?? "").toLowerCase() === normalizedEmail.toLowerCase()
        ? stored.name
        : undefined;
    const resolvedName =
      resolveDisplayName(normalizedEmail, storedName) ||
      profile?.full_name ||
      fallbackName ||
      normalizedEmail;

    setUserRole(resolvedRole);
    setUserName(resolvedName);
    setUserEmail(normalizedEmail);
    setIsAuthenticated(true);
    // Only land on the dashboard for a fresh sign-in. Background auth events
    // (token refresh after inactivity) re-run this and would otherwise yank the
    // user back from whatever tab they were on.
    if (!wasAuthenticatedRef.current) setActiveTab("dashboard");
    wasAuthenticatedRef.current = true;
    persistSessionState(normalizedEmail, resolvedRole, resolvedName);
  };

  const handleLogin = async (role: UserRole, name: string, email: string) => {
    await applyAuthenticatedUser(email, role, name);
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    clearStoredSession();
    wasAuthenticatedRef.current = false;
    setIsAuthenticated(false);
    setUserRole("Layout Staff Member");
    setUserEmail("");
    setUserName("");
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const updateLastActivity = () => {
      const currentSession = restoreStoredSession();
      if (!currentSession) {
        void handleLogout();
        return;
      }

      const updated = {
        ...currentSession,
        lastActivityAt: Date.now(),
      };
      try {
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
    };

    const checkSessionExpiry = () => {
      const currentSession = restoreStoredSession();
      if (!currentSession) {
        void handleLogout();
        return;
      }

      if (Date.now() - (currentSession.lastActivityAt ?? Date.now()) > SIX_HOURS_MS) {
        void handleLogout();
      }
    };

    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "click", "touchstart", "scroll", "mousemove"];
    events.forEach((eventName) => {
      window.addEventListener(eventName, updateLastActivity);
    });

    const timer = window.setInterval(checkSessionExpiry, 60000);
    updateLastActivity();

    return () => {
      window.clearInterval(timer);
      events.forEach((eventName) => {
        window.removeEventListener(eventName, updateLastActivity);
      });
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!supabase) {
      const storedSession = restoreStoredSession();
      if (storedSession) {
        setUserRole(resolveRoleForEmail(storedSession.email ?? "", null, storedSession.role as UserRole));
        setUserName(resolveDisplayName(storedSession.email ?? "", storedSession.name));
        setUserEmail(storedSession.email ?? "");
        setIsAuthenticated(true);
        setActiveTab("dashboard");
      }
      return;
    }

    let active = true;

    const restoreSupabaseSession = async () => {
      const { data } = await supabase.auth.getSession();
      const storedSession = restoreStoredSession();

      if (!active) return;

      if (storedSession) {
        setUserRole(resolveRoleForEmail(storedSession.email ?? "", null, storedSession.role as UserRole));
        setUserName(resolveDisplayName(storedSession.email ?? "", storedSession.name));
        setUserEmail(storedSession.email ?? "");
        setIsAuthenticated(true);
        setActiveTab("dashboard");
        return;
      }

      if (!data.session?.user?.email) return;
      await applyAuthenticatedUser(
        data.session.user.email,
        "Layout Staff Member",
        data.session.user.user_metadata?.full_name || data.session.user.email,
      );
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;

      if (session?.user?.email) {
        await applyAuthenticatedUser(
          session.user.email,
          "Layout Staff Member",
          session.user.user_metadata?.full_name || session.user.email,
        );
        return;
      }

      // Only an explicit sign-out should clear the local session. Transient events with a
      // null session (e.g. a TOKEN_REFRESHED race on tab focus) must not log the user out
      // or downgrade their role — the restored localStorage session stays authoritative.
      if (event === "SIGNED_OUT") {
        clearStoredSession();
        setIsAuthenticated(false);
        setUserRole("Layout Staff Member");
        setUserEmail("");
        setUserName("");
      }
    });

    void restoreSupabaseSession();

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleAddCommentSimple = (commentText: string, taskId: string) => {
    const newComment: TaskComment = {
      id: `comment-${Date.now()}`,
      taskId,
      authorName: userName,
      authorEmail: userEmail,
      text: commentText,
      timestamp: new Date().toISOString()
    };
    const updated = [...comments, newComment];
    setComments(updated);
    createComment(newComment).catch(() => {});

    // Alert only the people this comment concerns: the assigned artist when a
    // leader reviews, or the editor/deputy desk when a staffer replies.
    const task = tasksRef.current.find(t => t.id === taskId);
    if (task) {
      const isLeader = userRole === "Layout Editor" || userRole === "Layout Deputy" || userRole === "Online Layout Head";
      const assigneeEmail = task.assigneeEmail || resolveMemberEmail(task.illusLayout);
      if (isLeader) {
        if (assigneeEmail && assigneeEmail.toLowerCase() !== userEmail.toLowerCase()) {
          handleAddNotification(
            "New Comment",
            `The ${userRole === "Layout Deputy" ? "layout deputy" : "layout editor"} commented on '${task.title}'. Kindly check 'My Assignments'.`,
            "info",
            [assigneeEmail]
          );
        }
      } else {
        handleAddNotification(
          "New Comment",
          `${getPreferredFirstName(userName, userEmail)} commented on '${task.title}'.`,
          "info",
          getEditorDeputyEmails()
        );
      }
    }
  };

  const handleAddNotification = (
    title: string,
    message: string,
    type: 'info' | 'assignment' | 'deadline' | 'revision' | 'poll' | 'birthday',
    targetEmails?: string[]
  ) => {
    const targets = Array.from(new Set(
      (targetEmails && targetEmails.length ? targetEmails : [userEmail]).filter(Boolean)
    ));
    const timestamp = new Date().toISOString();
    targets.forEach((email, idx) => {
      const notif: Notification = {
        id: `notif-${Date.now()}-${idx}`,
        title,
        message,
        type,
        timestamp,
        readBy: [],
        targetEmails: [email]
      };
      if (email.toLowerCase() === userEmail.toLowerCase()) {
        setNotifications(prev => [notif, ...prev]);
      }
      createNotification(notif).catch(() => {});
    });
  };

  // The bell feed only ever shows alerts addressed to the signed-in account.
  const myNotifications = notifications.filter(n =>
    (n.targetEmails || []).some(email => email.toLowerCase() === userEmail.toLowerCase())
  );

  const updateIssueRow = (id: string, field: "page" | "section" | "title" | "writer" | "graphics" | "layout" | "online" | "progress", value: string) => {
    updateIssueSheets((prev) => prev.map((sheet) => {
      if (sheet.id !== currentIssueSheetId) return sheet;
      return {
        ...sheet,
        rows: sheet.rows.map((row) => row.id === id ? { ...row, [field]: value } : row)
      };
    }));
  };

  const syncIssueRowTask = (row: { id: string; page: string; section: string; title: string; writer: string; graphics: string; layout: string; online: string; progress: string }) => {
    const rowTitle = row.title?.trim() || `${row.section || "Issue"}${row.page ? ` ${row.page}` : ""}`.trim() || `Issue Row ${row.id}`;
    if (!row.layout && !row.online && !row.title && !row.writer) {
      commitTasks((prev) => prev.filter((task: any) => task.sourceIssueRowId !== row.id));
      return;
    }

    const assignee = row.layout?.trim() || "Unassigned";
    const isDone = row.progress === "Completed";
    const taskProgress = isDone ? "Completed" : assignee === "Unassigned" ? "Not Started" : "Assigned";

    const newTask: Task = {
      id: `issue-task-${row.id}`,
      title: rowTitle,
      typeOfRelease: "Issue Article",
      typeOfContent: row.section || "News",
      writer: row.writer || "Unspecified Writer",
      illusLayout: assignee,
      progress: taskProgress,
      writeup: rowTitle,
      priority: "Medium",
      releaseDate: row.page || "Issue Board",
      files: [],
      commentsCount: 0,
      revisionCount: 0,
      lastUpdated: new Date().toISOString(),
      canvaLink: "",
      pubmatLink: "",
      draftLink: "",
      addedToLayout: "",
      onlineHandler: row.online || "",
      ...(row.online ? { graphics: row.online } : {}),
      sourceIssueRowId: row.id,
    } as Task & { sourceIssueRowId?: string };

    commitTasks((prev) => {
      const filtered = prev.filter((task: any) => task.sourceIssueRowId !== row.id);
      return [newTask, ...filtered];
    });
  };

  const addIssueRow = () => {
    const nextRow = {
      id: `issue-row-${Date.now()}`,
      page: "",
      section: "Front",
      title: "",
      writer: "",
      graphics: "",
      layout: "",
      online: "",
      progress: "Pending"
    };

    updateIssueSheets((prev) => prev.map((sheet) => {
      if (sheet.id !== currentIssueSheetId) return sheet;
      return { ...sheet, rows: [...sheet.rows, nextRow] };
    }));
  };

  const openIssueRowEditor = (row: any) => {
    setEditingIssueRowId(row.id);
    setIssueRowDraft({ ...row });
  };

  const saveIssueRowEditor = () => {
    if (!editingIssueRowId || !issueRowDraft) return;

    const nextSheets = issueSheetsRef.current.map((sheet) => {
      if (sheet.id !== currentIssueSheetId) return sheet;
      return {
        ...sheet,
        rows: sheet.rows.map((row) => row.id === editingIssueRowId ? { ...issueRowDraft } : row)
      };
    });
    persistIssueSheets(nextSheets);

    const rowTitle = issueRowDraft.title?.trim() || `${issueRowDraft.section || "Issue"}${issueRowDraft.page ? ` ${issueRowDraft.page}` : ""}`.trim() || `Issue Row ${issueRowDraft.id}`;
    const layoutAssignee = issueRowDraft.layout?.trim() || "Unassigned";
    const resolved = resolveLayoutAssignee(layoutAssignee, members);
    const pendingId = seededUuid(`issue-pending-${issueRowDraft.id}`);
    const newPendingTask: Task = {
      id: pendingId,
      title: rowTitle,
      typeOfRelease: "Online Article",
      typeOfContent: issueRowDraft.section || "News",
      writer: issueRowDraft.writer || "Unspecified Writer",
      illusLayout: resolved.name,
      assigneeEmail: resolved.email,
      assigneeName: resolved.name,
      graphics: issueRowDraft.graphics || "",
      graphicsIllus: issueRowDraft.graphics || "",
      progress: "Assigned",
      writeup: rowTitle,
      priority: "Medium",
      releaseDate: issueRowDraft.page || "Issue Board",
      files: [],
      commentsCount: 0,
      revisionCount: 0,
      lastUpdated: new Date().toISOString(),
      canvaLink: "",
      pubmatLink: "",
      draftLink: "",
      addedToLayout: "",
      onlineHandler: issueRowDraft.online || resolved.name,
      isPendingConfirmation: true,
      sourceIssueRowId: issueRowDraft.id,
    };

    commitTasks((prev) => {
      const filtered = prev.filter((task) =>
        task.id !== seededUuid(`issue-pending-${issueRowDraft.id}`) &&
        task.id !== seededUuid(`issue-task-${issueRowDraft.id}`) &&
        task.id !== seededUuid(`online-task-${issueRowDraft.id}`) &&
        task.sourceIssueRowId !== issueRowDraft.id
      );
      return [newPendingTask, ...filtered];
    });

    setEditingIssueRowId(null);
    setIssueRowDraft(null);
  };

  const deleteIssueRow = (rowId: string) => {
    updateIssueSheets((prev) => prev.map((sheet) => {
      if (sheet.id !== currentIssueSheetId) return sheet;
      return { ...sheet, rows: sheet.rows.filter((row) => row.id !== rowId) };
    }));

    commitTasks((prev) => prev.filter((task: any) => task.sourceIssueRowId !== rowId));
    if (editingIssueRowId === rowId) {
      setEditingIssueRowId(null);
      setIssueRowDraft(null);
    }
  };

  const addIssueSheet = () => {
    const nextId = `issue-sheet-${Date.now()}`;
    const nextSheet = {
      id: nextId,
      title: `Issue Pages Sheet ${issueSheets.length + 1}`,
      rows: []
    };
    updateIssueSheets((prev) => [...prev, nextSheet]);
    setCurrentIssueSheetId(nextId);
  };

  const deleteIssueSheet = (sheetId: string) => {
    updateIssueSheets((prev) => {
      if (prev.length <= 1) return prev;
      const remaining = prev.filter((sheet) => sheet.id !== sheetId);
      if (remaining.length > 0) {
        setCurrentIssueSheetId(remaining[0].id);
      }
      return remaining;
    });
  };

  const removeIssueRow = (id: string) => {
    updateIssueSheets((prev) => prev.map((sheet) => {
      if (sheet.id !== currentIssueSheetId) return sheet;
      return { ...sheet, rows: sheet.rows.filter((row) => row.id !== id) };
    }));
  };

  useEffect(() => {
    localStorage.setItem("mkule_issue_publication_sheets", JSON.stringify(issueSheets));
    if (currentIssueSheetId) {
      localStorage.setItem("mkule_issue_publication_current_sheet", currentIssueSheetId);
    }
  }, [issueSheets, currentIssueSheetId]);

  const handleTriggerCritiqueTab = (task: Task) => {
    setSelectedTask(null);
    setActiveTab("shortcuts");
  };

  const getTabsForRole = () => {
    switch (userRole) {
      case "Layout Editor":
        return [
          { id: "dashboard", label: "Home", icon: LayoutGrid },
          { id: "issue-publication", label: "Issue Pages", icon: BookOpen },
          { id: "online-pubmat", label: "Online Pubmat", icon: Kanban },
          { id: "review-submissions", label: "Review Submissions", icon: ShieldCheck },
          { id: "canva-directory", label: "Canva Template Directory", icon: Link2 },
          { id: "directory", label: "Layout Member Directory", icon: Users },
          { id: "settings", label: "Profile & Settings", icon: Shield }
        ];
      case "Layout Deputy":
      case "Online Layout Head":
        return [
          { id: "dashboard", label: "Home", icon: LayoutGrid },
          { id: "my-assignments", label: "My Assignments", icon: Kanban },
          { id: "online-pubmat", label: "Online Pubmat", icon: Kanban },
          { id: "review-submissions", label: "Review Submissions", icon: ShieldCheck },
          { id: "canva-directory", label: "Canva Template Directory", icon: Link2 },
          { id: "directory", label: "Layout Member Directory", icon: Users },
          { id: "settings", label: "Profile & Settings", icon: Shield }
        ];
      case "Layout Staffer":
      case "Layout Probi":
      case "Layout Staff Member":
        return [
          { id: "dashboard", label: "Home", icon: LayoutGrid },
          { id: "canva-directory", label: "Canva Template Directory", icon: Link2 },
          { id: "my-assignments", label: "My Assignments", icon: Kanban },
          { id: "directory", label: "Layout Member Directory", icon: Users },
          { id: "settings", label: "Profile & Settings", icon: Shield }
        ];
      case "Publication Editor-in-Chief":
        return [
          { id: "dashboard", label: "Home", icon: LayoutGrid },
          { id: "online-pubmat", label: "Online Pubmat", icon: Kanban },
          { id: "review-submissions", label: "Review Submissions", icon: ShieldCheck },
          { id: "canva-directory", label: "Canva Template Directory", icon: Link2 },
          { id: "directory", label: "Layout Member Directory", icon: Users },
          { id: "settings", label: "Profile & Settings", icon: Shield }
        ];
      default:
        return [
          { id: "dashboard", label: "Home", icon: LayoutGrid },
          { id: "canva-directory", label: "Canva Template Directory", icon: Link2 },
          { id: "settings", label: "Profile & Settings", icon: Shield }
        ];
    }
  };

  const assignableMembers = members.filter((member) => {
    const role = member.role || "";
    if (userRole === "Layout Editor") {
      return role === "Layout Deputy" || role === "Layout Staffer" || role === "Layout Probi";
    }
    if (userRole === "Layout Deputy") {
      return role === "Layout Editor" || role === "Layout Staffer" || role === "Layout Probi";
    }
    return false;
  });

  const canAssignOnlineOnly = userRole === "Layout Deputy";

  useEffect(() => {
    const validTabs = getTabsForRole().map(t => t.id);
    if (!validTabs.includes(activeTab)) {
      setActiveTab("dashboard");
    }
  }, [userRole, activeTab]);

  const executeCreateAssignment = () => {
    if (!formTitle.trim()) return;

    const finalAddedToLayout = formDocLink
      ? `=HYPERLINK("${formDocLink}", "${formTitle}")`
      : "";

    const selectedArtist = layoutArtistOptions.find((option) => option.value === formArtist);
    const resolvedAssignee = resolveLayoutAssignee(resolvedFormArtist, members);
    // Category names are unique across the directory, so the first name/id
    // match is the template whose link gets attached to the new task.
    const autoCanvaLink = getPubmatCanvaTemplates().find(
      (t) => t.name.toLowerCase() === formContentType.toLowerCase() || t.id === formContentType
    )?.currentLink || "";
    const created: Task = {
      id: crypto.randomUUID(),
      title: formTitle,
      typeOfRelease: formReleaseType,
      typeOfContent: formContentType,
      writer: formWriter || "Unspecified Writer",
      illusLayout: resolvedFormArtist,
      assigneeEmail: selectedArtist?.email || resolvedAssignee.email || "",
      assigneeName: selectedArtist?.label || resolvedAssignee.name || resolvedFormArtist,
      progress: resolvedFormArtist === "Unassigned" ? "Not Started" : "Assigned",
      writeup: formWriteup || formTitle || "drafting",
      priority: formPriority,
      releaseDate: formReleaseDate,
      files: [],
      commentsCount: 0,
      revisionCount: 0,
      lastUpdated: new Date().toISOString(),
      canvaLink: autoCanvaLink,
      pubmatLink: formPubmatLink || "",
      draftLink: formDocLink || "",
      addedToLayout: finalAddedToLayout,
      onlineHandler: formReleaseType === "Online Article" && resolvedFormArtist !== "Unassigned" ? resolvedFormArtist : ""
    };

    let nextTasks = [created, ...tasks];

    // Whenever assigning for an Issue Layout, also automatically give the assigned person the companion Online Pubmat assignment
    if (formReleaseType === "Issue Article") {
      const onlineCompanion: Task = {
        ...created,
        id: crypto.randomUUID(),
        title: `${formTitle} (Online Pubmat)`,
        typeOfRelease: "Online Article",
        isPendingConfirmation: false
      };
      nextTasks = [onlineCompanion, ...nextTasks];
    }

    commitTasks(() => nextTasks);

    // Push Notification — targeted only at the assigned account, kept short.
    const assigneeEmail = created.assigneeEmail;
    if (formArtist !== "Unassigned" && assigneeEmail) {
      handleAddNotification(
        "New Assignment",
        `You've been assigned '${formTitle}' (due ${formReleaseDate || "TBD"}). Check 'My Assignments'.`,
        "assignment",
        [assigneeEmail]
      );
    }

    // Reset Form
    setFormTitle("");
    setFormDocLink("");
    setFormWriter("");
    setFormWriteup("");
    setFormPubmatLink("");
    setShowTaskForm(false);
  };

  // Create Assignment Trigger
  const handleCreateAssignment = () => {
    if (!formTitle.trim()) return;
    if (canAssignOnlineOnly && formReleaseType !== "Online Article") {
      setFormReleaseType("Online Article");
    }
    executeCreateAssignment();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-cream/40 flex flex-col items-center justify-center p-6 space-y-4 font-sans text-gray-800">
        <RefreshCw className="w-8 h-8 text-brand-maroon animate-spin" />
        <p className="font-display font-bold text-sm tracking-wide">
          Booting publication layout desk...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginPage
        members={members}
        onLogin={handleLogin}
        speechEnabled={speechEnabled}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
      />
    );
  }

  const roleTabs = getTabsForRole();

  return (
    <div
      className="min-h-screen bg-[#faf9f6] dark:bg-neutral-950 grid-lines-bg flex flex-col md:flex-row text-neutral-900 dark:text-neutral-100 transition-colors"
      style={{ fontSize: `${fontSizeMultiplier}rem` }}
    >
      {/* --- DESKTOP LEFT SIDEBAR (Premium Maroon Gradient Design) --- */}
      <aside className="w-72 shrink-0 bg-neutral-950 text-white rounded-[28px] p-6 m-4 hidden md:flex flex-col justify-between border border-neutral-900 shadow-xl h-[calc(100vh-2rem)] sticky top-4 z-30">

        <div className="space-y-6 flex flex-col h-full overflow-hidden">
          {/* Logo Title Block */}
          <div className="flex items-center gap-3.5 pb-5 border-b border-neutral-900">
            <img
              src={mkuleImg}
              alt="MKule Logo"
              className="w-14 h-14 object-contain shrink-0 rounded-2xl p-1 bg-neutral-900 border border-neutral-800 shadow-md"
            />
            <div className="text-left min-w-0 flex flex-col justify-center">
              <h1 className="font-sans font-black text-lg tracking-tight text-white leading-tight">
                MKuLayout
              </h1>
            </div>
          </div>

          {/* Navigation Items (Concise & Elegant) */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-1">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-3 block mb-2 font-sans">
              Workspace Desk
            </span>
            {roleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (speechEnabled) {
                      window.speechSynthesis.cancel();
                      const utterance = new SpeechSynthesisUtterance(`Opened ${tab.label}`);
                      window.speechSynthesis.speak(utterance);
                    }
                  }}
                  className={`w-full px-4 py-3 rounded-2xl text-xs font-bold tracking-wide flex items-center gap-3 transition-all cursor-pointer text-left ${
                    isActive
                      ? "bg-gradient-to-r from-brand-maroon to-brand-maroon-dark text-white font-black shadow-lg shadow-red-950/40 border-l-4 border-white"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-900/80"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* User Signature badge at the bottom of the sidebar */}
        <div className="pt-4 border-t border-neutral-900 flex items-center gap-2.5 text-left mt-4 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-maroon to-brand-maroon-dark border border-red-500/20 flex items-center justify-center text-xs font-bold text-white uppercase font-sans shrink-0">
            {userName.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate">{userName}</p>
            <p className="text-[10px] text-neutral-400 truncate font-sans">{userRole}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-[10px] text-red-400 hover:text-red-300 font-bold font-sans uppercase bg-neutral-900 px-2.5 py-1 rounded-lg border border-neutral-800 shrink-0 cursor-pointer"
            title="Log out of session"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* --- MOBILE RESPONSIVE TOP HEADER --- */}
      <header className="md:hidden flex justify-between items-center px-4 py-3 bg-neutral-950 text-white sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMobileSidebar(!showMobileSidebar)}
            className="p-1.5 hover:bg-neutral-900 rounded-lg text-white cursor-pointer"
            aria-label="Toggle mobile menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <img src={mkuleImg} alt="MKule Logo" className="w-7 h-7 object-contain shrink-0" />
          <span className="font-sans font-black text-sm text-white tracking-tight">MKuLayout</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Dark / Light Mode Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !darkMode;
              setDarkMode(next);
              if (speechEnabled) {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(`Switched to ${next ? "dark" : "light"} mode`);
                window.speechSynthesis.speak(utterance);
              }
            }}
            className="p-1.5 text-neutral-300 hover:text-white rounded-lg cursor-pointer bg-neutral-900 border border-neutral-800 flex items-center justify-center"
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle Dark or Light Mode"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-300" />}
          </button>

          <button
            onClick={handleLogout}
            className="p-1.5 text-neutral-400 hover:text-red-400 rounded-lg cursor-pointer"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* --- MOBILE DROPDOWN NAVIGATION MENU --- */}
      <AnimatePresence>
        {showMobileSidebar && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileSidebar(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
            />
            {/* Mobile Dropdown from Top Header */}
            <motion.div
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="fixed top-12 left-0 right-0 bg-neutral-950 text-white z-50 md:hidden border-b border-neutral-800 shadow-2xl p-4 max-h-[85vh] overflow-y-auto space-y-4"
            >
              <div className="flex justify-between items-center pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <img src={mkuleImg} alt="MKule Logo" className="w-7 h-7 object-contain shrink-0" />
                  <span className="font-sans font-black text-sm text-white tracking-tight">MKuLayout</span>
                </div>
                <button
                  onClick={() => setShowMobileSidebar(false)}
                  className="p-1.5 hover:bg-neutral-900 rounded-lg text-neutral-400 hover:text-white"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                {roleTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setShowMobileSidebar(false);
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold tracking-wide flex items-center gap-3 transition-all text-left cursor-pointer ${
                        isActive
                          ? "bg-gradient-to-r from-brand-maroon to-brand-maroon-dark text-white shadow-sm"
                          : "text-neutral-300 hover:text-white hover:bg-neutral-900"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0 text-red-500" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">{userName}</p>
                  <p className="text-[10px] text-neutral-400 font-sans">{userRole}</p>
                </div>
                <button
                  onClick={() => {
                    setShowMobileSidebar(false);
                    handleLogout();
                  }}
                  className="px-3 py-1.5 bg-neutral-900 hover:bg-red-950 text-red-400 text-xs font-bold font-sans uppercase rounded-lg border border-neutral-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* --- RIGHT COLUMN CONTAINER (Jobie mockup style main hub) --- */}
      <div className="flex-1 flex flex-col min-w-0 md:h-screen md:overflow-y-auto p-2.5 sm:p-3 md:p-5 space-y-3 sm:space-y-3 md:space-y-4">

        {/* RIGHT TOP CONTROL BAR (Minimalist, Accessible) */}
        <div className="flex flex-col sm:flex-row items-center justify-between bg-white dark:bg-neutral-900 border border-neutral-150 dark:border-neutral-800 rounded-xl sm:rounded-2xl px-3 sm:px-5 py-2 sm:py-3 shadow-sm gap-2 sm:gap-3 shrink-0">

          {/* Left info status indicator */}
          <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-600 animate-pulse shrink-0" />
            <div className="text-left">
              <p className="text-[10px] sm:text-[11px] font-bold text-neutral-800 dark:text-neutral-100 uppercase tracking-wide font-mono">
                DESK ACTIVE CONSOLE
              </p>
            </div>
          </div>

          {/* Right actions: Theme toggle, Accessibility controls & Alerts dropdown */}
          <div className="flex items-center gap-1.5 sm:gap-3 w-full sm:w-auto justify-end">

            {/* Direct Theme Toggle Button */}
            <button
              type="button"
              onClick={() => {
                const next = !darkMode;
                setDarkMode(next);
                if (speechEnabled) {
                  window.speechSynthesis.cancel();
                  const utterance = new SpeechSynthesisUtterance(`Switched to ${next ? "dark" : "light"} mode`);
                  window.speechSynthesis.speak(utterance);
                }
              }}
              className="px-2.5 py-1.5 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-xl text-neutral-600 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 transition-all flex items-center gap-1.5 cursor-pointer text-xs font-semibold shadow-xs"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle Light and Dark mode"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />}
              <span className="hidden sm:inline font-mono text-[11px]">{darkMode ? "Light" : "Dark"}</span>
            </button>

            {/* Realtime Alert Feed Bell dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotificationsDropdown(!showNotificationsDropdown);
                }}
                className="p-2 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-xl text-neutral-600 dark:text-neutral-200 hover:text-neutral-900 border border-neutral-200 dark:border-neutral-700 transition-all relative cursor-pointer shadow-xs"
                aria-label="Notification center"
              >
                <Bell className="w-4 h-4" />
                {myNotifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-600 rounded-full animate-ping" />
                )}
              </button>

              {showNotificationsDropdown && (
                <div
                  id="notifications-popup"
                  className="absolute right-0 mt-2 w-72 bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-100 dark:border-neutral-800 p-4 space-y-3 z-50 text-left text-xs"
                >
                  <div className="flex items-center justify-between border-b pb-1.5 border-neutral-100 dark:border-neutral-800">
                    <h3 className="font-bold text-neutral-900 dark:text-neutral-100 font-display">Alert Feed</h3>
                    <button
                      onClick={() => setNotifications(prev => prev.filter(n => !(n.targetEmails || []).some(email => email.toLowerCase() === userEmail.toLowerCase())))}
                      className="text-[10px] text-red-700 dark:text-red-400 hover:underline font-bold cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {myNotifications.length === 0 ? (
                      <p className="text-neutral-400 dark:text-neutral-500 py-4 text-center">No recent alerts.</p>
                    ) : (
                      myNotifications.slice(0, 4).map((n) => (
                        <div key={n.id} className="p-2 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-100 dark:border-neutral-700">
                          <h4 className="font-semibold text-neutral-800 dark:text-neutral-200">{n.title}</h4>
                          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-normal">{n.message}</p>
                          <span className="text-[8px] text-neutral-400 block mt-1 font-mono">
                            {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Tab Render panel (Curved, spacious container block) */}
        <main className="flex-grow flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="flex-grow flex flex-col"
            >
            {activeTab === "dashboard" && (
              <DashboardOverview
                tasks={tasks}
                members={members}
                events={events}
                announcements={announcements}
                speechEnabled={speechEnabled}
                onNavigate={setActiveTab}
                onAddTask={() => setShowTaskForm(true)}
                currentUserName={userName}
                currentUserEmail={userEmail}
                currentUserRole={userRole}
                onUpdateEvents={handleUpdateEvents}
                polls={polls}
                onUpdatePolls={handleUpdatePolls}
                onUpdateAnnouncements={(newAnnouncements) => {
                  setAnnouncements(newAnnouncements);
                  pushStateToBackend({ announcements: newAnnouncements });
                }}
              />
            )}

            {activeTab === "my-assignments" && (
              <LayoutStaffDashboard
                tasks={tasks}
                currentUserEmail={userEmail}
                currentUserName={userName}
                speechEnabled={speechEnabled}
                onUpdateTask={(updatedTask) => {
                  const updatedList = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
                  handleUpdateTasks(updatedList);
                }}
                onAddComment={handleAddCommentSimple}
                comments={comments}
                onAddNotification={handleAddNotification}
              />
            )}

            {activeTab === "review-submissions" && (
              <EicDashboard
                tasks={tasks}
                speechEnabled={speechEnabled}
                onUpdateTask={(updatedTask) => {
                  const updatedList = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
                  handleUpdateTasks(updatedList);
                }}
                onAddComment={handleAddCommentSimple}
                comments={comments}
                onAddNotification={handleAddNotification}
                currentUserRole={userRole}
                currentUserName={userName}
                currentUserEmail={userEmail}
              />
            )}

            {activeTab === "issue-publication" && userRole === "Layout Editor" && (
              <SheetsSync
                tasks={tasks}
                members={members}
                speechEnabled={speechEnabled}
                currentUserRole={userRole}
                onUpdateTasks={handleSheetsSyncTasks}
                onUpdateMembers={handleUpdateMembers}
                googleSheetsLink={googleSheetsLink}
                onUpdateGoogleSheetsLink={updateGoogleSheetsLink}
              />
            )}

            {activeTab === "online-pubmat" && (
              <AssignmentsList
                tasks={tasks}
                members={members}
                speechEnabled={speechEnabled}
                currentUserRole={userRole}
                onUpdateTasks={handleUpdateTasks}
                onOpenTaskDetails={setSelectedTask}
                onAddTask={() => {
                  setFormReleaseType("Online Article");
                  setTaskFormOrigin("online-pubmat");
                  setShowTaskForm(true);
                }}
              />
            )}

            {activeTab === "shortcuts" && (
              <QuickAccessHub
                speechEnabled={speechEnabled}
                currentUserRole={userRole}
              />
            )}

            {activeTab === "calendar" && (
              <CalendarView
                events={events}
                tasks={tasks}
                speechEnabled={speechEnabled}
                currentUserRole={userRole}
                onUpdateEvents={handleUpdateEvents}
              />
            )}

            {activeTab === "polls" && (
              <MeetingPolls
                polls={polls}
                members={members}
                speechEnabled={speechEnabled}
                currentUserEmail={userEmail}
                currentUserRole={userRole}
                onUpdatePolls={handleUpdatePolls}
              />
            )}

            {activeTab === "directory" && (
              <TeamDirectory
                members={members}
                speechEnabled={speechEnabled}
                currentUserRole={userRole}
                currentUserEmail={userEmail}
                currentUserName={userName}
                tasks={tasks}
                onUpdateMembers={handleUpdateMembers}
              />
            )}

            {activeTab === "settings" && (
              <ProfileSettings
                currentUserRole={userRole}
                currentUserName={userName}
                currentUserEmail={userEmail}
                members={members}
                tasks={tasks}
                speechEnabled={speechEnabled}
                setSpeechEnabled={setSpeechEnabled}
                fontSizeMultiplier={fontSizeMultiplier}
                setFontSizeMultiplier={setFontSizeMultiplier}
                highContrast={highContrast}
                setHighContrast={setHighContrast}
                darkMode={darkMode}
                setDarkMode={setDarkMode}
                accentTheme={accentTheme}
                setAccentTheme={applyAccentTheme}
                dyslexicFont={dyslexicFont}
                setDyslexicFont={setDyslexicFont}
                onLogout={handleLogout}
              />
            )}

            {activeTab === "canva-directory" && (
              <CanvaDirectory currentUserRole={userRole} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

    </div>

    {editingIssueRowId && issueRowDraft && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-2xl p-5 shadow-2xl border border-neutral-200 dark:border-neutral-700 text-left animate-fade-in">
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 pb-3 mb-4">
            <div>
              <h3 className="font-display font-black text-neutral-900 dark:text-neutral-100 text-base">Edit Issue Row</h3>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400">The saved row updates the issue task pipeline and workload tracker when marked completed.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingIssueRowId(null);
                setIssueRowDraft(null);
              }}
              className="p-1.5 rounded-full text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-neutral-600 dark:text-neutral-300 font-semibold mb-1">Page</label>
              <input value={issueRowDraft.page || ""} onChange={(e) => setIssueRowDraft({ ...issueRowDraft, page: e.target.value })} className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800 outline-none" />
            </div>
            <div>
              <label className="block text-neutral-600 dark:text-neutral-300 font-semibold mb-1">Section</label>
              <select value={issueRowDraft.section || "Front"} onChange={(e) => setIssueRowDraft({ ...issueRowDraft, section: e.target.value })} className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800 outline-none">
                <option value="Front">Front</option>
                <option value="News">News</option>
                <option value="Features">Features</option>
                <option value="Cult">Cult</option>
                <option value="Opinion">Opinion</option>
                <option value="Editorial">Editorial</option>
                <option value="MM">MM</option>
                <option value="Graphics">Graphics</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-neutral-600 dark:text-neutral-300 font-semibold mb-1">Title or summary</label>
              <input value={issueRowDraft.title || ""} onChange={(e) => setIssueRowDraft({ ...issueRowDraft, title: e.target.value })} className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800 outline-none" />
            </div>
            <div>
              <label className="block text-neutral-600 dark:text-neutral-300 font-semibold mb-1">Writer</label>
              <input value={issueRowDraft.writer || ""} onChange={(e) => setIssueRowDraft({ ...issueRowDraft, writer: e.target.value })} className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800 outline-none" />
            </div>
            <div>
              <label className="block text-neutral-600 dark:text-neutral-300 font-semibold mb-1">Graphics</label>
              <input value={issueRowDraft.graphics || ""} onChange={(e) => setIssueRowDraft({ ...issueRowDraft, graphics: e.target.value })} placeholder="e.g. illustrator or graphic artist name" className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800 outline-none" />
            </div>
            <div>
              <label className="block text-neutral-600 dark:text-neutral-300 font-semibold mb-1">Layout</label>
              <select value={issueRowDraft.layout || ""} onChange={(e) => setIssueRowDraft({ ...issueRowDraft, layout: e.target.value })} className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800 outline-none">
                <option value="">-</option>
                {allLayoutMemberFirstNames.map((name) => (<option key={name} value={name}>{name}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-neutral-600 dark:text-neutral-300 font-semibold mb-1">Online</label>
              <select value={issueRowDraft.online || ""} onChange={(e) => setIssueRowDraft({ ...issueRowDraft, online: e.target.value })} className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800 outline-none">
                <option value="">-</option>
                {allLayoutMemberFirstNames.map((name) => (<option key={name} value={name}>{name}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-neutral-600 dark:text-neutral-300 font-semibold mb-1">Progress</label>
              <select value={issueRowDraft.progress || "Pending"} onChange={(e) => setIssueRowDraft({ ...issueRowDraft, progress: e.target.value })} className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800 outline-none">
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="For Review">For Review</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <button type="button" onClick={() => { setEditingIssueRowId(null); setIssueRowDraft(null); }} className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 font-semibold cursor-pointer">Cancel</button>
            <button type="button" onClick={saveIssueRowEditor} className="px-3 py-2 rounded-xl bg-brand-maroon text-white font-bold cursor-pointer">Save Row</button>
          </div>
        </div>
      </div>
    )}

    {/* --- MODAL A: ADD NEW TASK ASSIGNMENT --- */}
    {showTaskForm && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-neutral-100 dark:border-neutral-800 text-left animate-fade-in text-xs space-y-4 max-h-[90vh] overflow-y-auto">
          
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-neutral-800 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-brand-maroon/10 text-brand-maroon dark:text-brand-maroon-light rounded-lg">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-display font-black text-neutral-950 dark:text-neutral-100 text-sm flex items-center gap-1.5">
                  {taskFormOrigin === "online-pubmat" ? "Assign Online Pubmat Task" : "Assign Design Task"}
                </h3>
                {taskFormOrigin === "online-pubmat" && (
                  <span className="text-[10px] text-brand-maroon dark:text-brand-maroon-light font-semibold">
                    Online Pubmat Workflow
                  </span>
                )}
              </div>
            </div>
            <button 
              onClick={() => {
                setShowTaskForm(false);
                setTaskFormOrigin("general");
              }}
              className="p-1 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-750 rounded-full text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3.5">
            {/* 2. Layout Title / Keyword */}
            <div>
              <label className="text-neutral-700 dark:text-neutral-300 font-bold block mb-1">Layout Title / Keyword</label>
              <input
                type="text"
                placeholder="e.g. Faura Hall Enrollment Photo Essay"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-1 focus:ring-red-600 outline-none bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
              />
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block mt-0.5 font-medium">
                ✓ Keep the document title clear and easy to identify for the assigned staffer.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-neutral-600 font-semibold block mb-1">Release Format</label>
                <select
                  value={canAssignOnlineOnly ? "Online Article" : formReleaseType}
                  onChange={(e) => setFormReleaseType(e.target.value)}
                  disabled={canAssignOnlineOnly}
                  className="w-full px-2.5 py-2 border border-neutral-200 rounded-xl bg-neutral-50 outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="Online Article">Online Article</option>
                  {!canAssignOnlineOnly && <option value="Issue Article">Issue Article</option>}
                  {!canAssignOnlineOnly && <option value="Multimedia">Multimedia</option>}
                  {!canAssignOnlineOnly && <option value="From the Archives">From the Archives</option>}
                </select>
              </div>

              <div>
                <label className="text-neutral-600 font-semibold block mb-1">Content Category / Section</label>
                <select
                  value={formContentType}
                  onChange={(e) => setFormContentType(e.target.value)}
                  className="w-full px-2.5 py-2 border border-neutral-200 rounded-xl bg-neutral-50 outline-none cursor-pointer"
                >
                  {["Branding & Gen", "Editorial", "Visuals & Layouts"].map((category) => {
                    const categoryTemplates = getPubmatCanvaTemplates().filter((t) => t.category === category);
                    if (categoryTemplates.length === 0) return null;
                    return (
                      <optgroup key={category} label={`--- ${category} ---`}>
                        {categoryTemplates.map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-neutral-600 font-semibold block mb-1">Article Writer</label>
                <input
                  type="text"
                  placeholder="e.g. Moy, Bryle"
                  value={formWriter}
                  onChange={(e) => setFormWriter(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-red-600 outline-none"
                />
              </div>

              <div>
                <label className="text-neutral-600 font-semibold block mb-1">Assign Layout Artist</label>
                <select
                  value={resolvedFormArtist}
                  onChange={(e) => setFormArtist(e.target.value)}
                  className="w-full px-2.5 py-2 border border-neutral-200 rounded-xl bg-neutral-50 outline-none cursor-pointer text-xs font-medium"
                >
                  <option value="Unassigned">Unassigned / Open</option>
                  {layoutArtistOptions.map((option) => (
                    <option key={option.email || option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-neutral-600 font-semibold block mb-1">Priority</label>
                <select
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value as any)}
                  className="w-full px-2.5 py-2 border border-neutral-200 rounded-xl bg-neutral-50 outline-none cursor-pointer"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="text-neutral-600 dark:text-neutral-300 font-semibold block mb-1 flex items-center justify-between">
                  <span>Release Target Date</span>
                  {formReleaseDate && (
                    <span className="text-[10px] font-mono text-brand-maroon dark:text-brand-maroon-light font-bold truncate max-w-[120px]">
                      {formReleaseDate}
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  value={formReleaseDate ? new Date(formReleaseDate).toISOString().split("T")[0] : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      const parts = val.split("-");
                      if (parts.length === 3) {
                        const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                        const formatted = dateObj.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase();
                        setFormReleaseDate(formatted);
                      }
                    } else {
                      setFormReleaseDate("");
                    }
                  }}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-red-600 outline-none font-sans text-xs bg-neutral-50 cursor-pointer"
                />
              </div>
            </div>

            <div className="bg-brand-cream/35 dark:bg-neutral-800/60 p-3 rounded-2xl border border-brand-maroon/20 dark:border-brand-maroon/30 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-gray-900 dark:text-neutral-100 font-bold flex items-center gap-1.5 text-xs">
                  <FileText className="w-4 h-4 text-brand-maroon dark:text-brand-maroon-light" />
                  <span>Document Link (ArtX / Writeup)</span>
                </label>
              </div>

              <input
                type="text"
                placeholder="Paste document or reference link"
                value={formDocLink}
                onChange={(e) => setFormDocLink(e.target.value)}
                className="w-full pl-3 pr-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-brand-maroon outline-none font-mono text-[11px] bg-white dark:bg-neutral-850 text-gray-900 dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500 shadow-xs"
              />

              <p className="text-[10px] text-gray-500 dark:text-neutral-400 font-medium">
                Paste any shared document or reference link to keep the assignment organized.
              </p>
            </div>

            <div>
              <label className="text-neutral-600 font-semibold block mb-1">Graphics/Illustration Link (Optional)</label>
              <input
                type="text"
                placeholder="e.g. shared folder or reference link"
                value={formPubmatLink}
                onChange={(e) => setFormPubmatLink(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-red-600 outline-none font-mono"
              />
            </div>
          </div>

          <button
            onClick={handleCreateAssignment}
            className="w-full py-2.5 bg-gradient-to-r from-brand-maroon to-brand-maroon-dark hover:opacity-95 text-white font-bold rounded-xl cursor-pointer transition-all shadow-[var(--brand-shadow-med)]"
          >
            Issue Layout Assignment Card
          </button>
        </div>
      </div>
    )}

    {/* --- MODAL B: DETAILED CARD WORKSPACE --- */}
    {selectedTask && (
      <TaskDetailsModal
        task={selectedTask}
        members={members}
        comments={comments}
        speechEnabled={speechEnabled}
        currentUserEmail={userEmail}
        currentUserName={userName}
        currentUserRole={userRole}
        onClose={() => setSelectedTask(null)}
        onDeleteTask={(taskToDelete) => {
          commitTasks((prev) => prev.filter((t) => t.id !== taskToDelete.id));
          setSelectedTask(null);
        }}
        onUpdateTask={(updatedTask) => {
          setSelectedTask(updatedTask);
          let updatedList = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);

          // Keep an Issue Article and its Online Pubmat companion in sync. Companions
          // are matched by base title + type (ids are now UUIDs, not derivable suffixes).
          const stripPubmat = (t: string) => t.replace(/\s*\(Online Pubmat\)$/i, "").trim();
          const updatedBase = stripPubmat(updatedTask.title);
          const updatedIsOnline =
            updatedTask.typeOfRelease === "Online Article" || updatedTask.title.includes("(Online Pubmat)");

          if (updatedTask.typeOfRelease === "Issue Article" || updatedIsOnline) {
            const companionIndex = updatedList.findIndex(
              t => t.id !== updatedTask.id &&
                t.typeOfRelease === (updatedIsOnline ? "Issue Article" : "Online Article") &&
                stripPubmat(t.title) === updatedBase
            );

            if (companionIndex !== -1) {
              updatedList[companionIndex] = {
                ...updatedList[companionIndex],
                illusLayout: updatedTask.illusLayout,
                writer: updatedTask.writer || updatedList[companionIndex].writer,
                draftLink: updatedTask.draftLink || updatedList[companionIndex].draftLink,
                addedToLayout: updatedTask.addedToLayout || updatedList[companionIndex].addedToLayout,
                pubmatLink: updatedTask.pubmatLink || updatedList[companionIndex].pubmatLink,
                canvaLink: updatedTask.canvaLink || updatedList[companionIndex].canvaLink,
                writeup: updatedTask.writeup || updatedList[companionIndex].writeup,
                lastUpdated: new Date().toISOString()
              };
            } else if (updatedTask.typeOfRelease === "Issue Article" && updatedTask.illusLayout && updatedTask.illusLayout !== "Unassigned") {
              // Create online companion if missing
              const onlineTask: Task = {
                ...updatedTask,
                id: crypto.randomUUID(),
                title: `${updatedBase} (Online Pubmat)`,
                typeOfRelease: "Online Article",
                isPendingConfirmation: false
              };
              updatedList = [onlineTask, ...updatedList];
            }
          }

          handleUpdateTasks(updatedList);
        }}
        onAddComment={handleAddComment}
        onTriggerCritiqueTab={handleTriggerCritiqueTab}
      />
    )}

  </div>
  );
}
