import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { 
  LayoutGrid, FileSpreadsheet, Kanban, GraduationCap, Calendar, 
  HelpCircle, Bot, Users, Bell, AlertOctagon, Plus, X, Shield, 
  Sparkles, ShieldCheck, HeartPulse, CheckSquare, RefreshCw, BookOpen,
  Menu, LogOut, Link2, Sun, Moon, FileText, CheckCircle2, ExternalLink, Loader2
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
import { OFFICIAL_MEMBERS_MAP, getPreferredFirstName } from "./lib/memberUtils";
import mkuleImg from "./mkule.png";

// Domain Models
import { Task, TeamMember, CalendarEvent, Poll, Notification, TaskComment, UserRole, normalizeEmail } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  
  // Data State
  const [tasks, setTasks] = useState<Task[]>([]);
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
    try {
      const saved = localStorage.getItem("mkule_issue_publication_sheets");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore malformed local storage values
    }
    return [{ id: "issue-sheet-1", title: "Issue Publication Sheet", rows: issueSheetTemplate }];
  });
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
  const issueSheetTitle = currentIssueSheet?.title ?? "Issue Publication Sheet";
  const issueTaskCards = tasks.filter((task) => {
    const isIssueTask = task.typeOfRelease === "Issue Article" || (task as any).sourceIssueRowId;
    const isOnlineOnlyCompanion = task.title.includes("(Online Pubmat)") || task.typeOfRelease === "Online Article";
    return isIssueTask && !isOnlineOnlyCompanion;
  });

  // Accessibility State (Passed to Panel)
  const [highContrast, setHighContrast] = useState(false);
  const [dyslexicFont, setDyslexicFont] = useState(false);
  const [fontSizeMultiplier, setFontSizeMultiplier] = useState(1);
  const [speechEnabled, setSpeechEnabled] = useState(false);

  // Theme & Appearance State (Persisted across sessions)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("mkule_theme") === "dark";
  });
  const [accentTheme, setAccentTheme] = useState<"maroon" | "navy" | "forest" | "grape">(() => {
    return (localStorage.getItem("mkule_accent") as any) || "maroon";
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("mkule_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("mkule_theme", "light");
    }
  }, [darkMode]);

  const applyAccentTheme = (color: "maroon" | "navy" | "forest" | "grape") => {
    setAccentTheme(color);
    localStorage.setItem("mkule_accent", color);
    const colors = {
      maroon: { primary: "#bc1700", light: "#d32f2f", dark: "#8b0000" },
      navy: { primary: "#1E3A8A", light: "#3B82F6", dark: "#172554" },
      forest: { primary: "#065F46", light: "#10B981", dark: "#064E3B" },
      grape: { primary: "#581C87", light: "#8B5CF6", dark: "#3B0764" }
    };
    const root = document.documentElement;
    root.style.setProperty("--color-brand-maroon", colors[color].primary);
    root.style.setProperty("--color-brand-maroon-light", colors[color].light);
    root.style.setProperty("--color-brand-maroon-dark", colors[color].dark);
  };

  // Modals Visibility
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [editingIssueRowId, setEditingIssueRowId] = useState<string | null>(null);
  const [issueRowDraft, setIssueRowDraft] = useState<any | null>(null);

  // Form Inputs
  const [formTitle, setFormTitle] = useState("");
  const [formDocLink, setFormDocLink] = useState("");
  const [taskFormOrigin, setTaskFormOrigin] = useState<string>("general");
  const [formReleaseType, setFormReleaseType] = useState("Online Article");
  const [formContentType, setFormContentType] = useState("feats artx");
  const [formWriter, setFormWriter] = useState("");
  const [formArtist, setFormArtist] = useState("Unassigned");
  const [formPriority, setFormPriority] = useState<"Low" | "Medium" | "High" | "Urgent">("Medium");
  const [formReleaseDate, setFormReleaseDate] = useState("");
  const [formWriteup, setFormWriteup] = useState("");
  const [formCanvaLink, setFormCanvaLink] = useState("");
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

  // Fetch initial backend state
  useEffect(() => {
    const fetchState = async () => {
      try {
        const response = await fetch("/api/state");
        const data = await response.json();
        setTasks(data.tasks || []);
        setMembers(data.members || []);
        setEvents(data.events || []);
        setPolls(data.polls || []);
        setComments(data.comments || []);
        setAnnouncements(data.announcements || []);
        setNotifications(data.notifications || []);
      } catch (err) {
        console.error("Failed to load initial layout state", err);
      } finally {
        setLoading(false);
      }
    };
    fetchState();
  }, []);

  // Save changes to backend
  const pushStateToBackend = async (updates: {
    tasks?: Task[];
    members?: TeamMember[];
    events?: CalendarEvent[];
    polls?: Poll[];
    comments?: TaskComment[];
    notifications?: Notification[];
    announcements?: any[];
  }) => {
    const nextTasks = updates.tasks !== undefined ? updates.tasks : tasks;
    const nextMembers = updates.members !== undefined ? updates.members : members;
    const nextEvents = updates.events !== undefined ? updates.events : events;
    const nextPolls = updates.polls !== undefined ? updates.polls : polls;
    const nextComments = updates.comments !== undefined ? updates.comments : comments;
    const nextNotifications = updates.notifications !== undefined ? updates.notifications : notifications;
    const nextAnnouncements = updates.announcements !== undefined ? updates.announcements : announcements;

    try {
      await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          members: nextMembers,
          tasks: nextTasks,
          events: nextEvents,
          polls: nextPolls,
          comments: nextComments,
          notifications: nextNotifications,
          announcements: nextAnnouncements
        })
      });
    } catch (err) {
      console.error("Error writing backend state changes", err);
    }
  };

  const handleUpdateTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
    pushStateToBackend({ tasks: newTasks });
  };

  const handleUpdateMembers = (newMembers: TeamMember[]) => {
    setMembers(newMembers);
    pushStateToBackend({ members: newMembers });
  };

  const handleUpdateEvents = (newEvents: CalendarEvent[]) => {
    setEvents(newEvents);
    pushStateToBackend({ events: newEvents });
  };

  const handleUpdatePolls = (newPolls: Poll[]) => {
    setPolls(newPolls);
    pushStateToBackend({ polls: newPolls });
  };

  const handleAddComment = (newComment: TaskComment) => {
    const updated = [...comments, newComment];
    setComments(updated);
    pushStateToBackend({ comments: updated });
  };

  const handleLogin = (role: UserRole, name: string, email: string) => {
    setUserRole(role);
    setUserName(name);
    setUserEmail(normalizeEmail(email));
    setIsAuthenticated(true);
    setActiveTab("dashboard");
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

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
    pushStateToBackend({ comments: updated });
  };

  const handleAddNotification = (title: string, message: string, type: 'info' | 'assignment' | 'deadline' | 'revision' | 'poll' | 'birthday') => {
    const notif: Notification = {
      id: `notif-${Date.now()}`,
      title,
      message,
      type,
      timestamp: new Date().toISOString(),
      readBy: []
    };
    const nextNotifs = [notif, ...notifications];
    setNotifications(nextNotifs);
    pushStateToBackend({ notifications: nextNotifs });
  };

  const updateIssueRow = (id: string, field: "page" | "section" | "title" | "writer" | "graphics" | "layout" | "online" | "progress", value: string) => {
    setIssueSheets((prev) => prev.map((sheet) => {
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
      setTasks((prev) => prev.filter((task: any) => task.sourceIssueRowId !== row.id));
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

    setTasks((prev) => {
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

    setIssueSheets((prev) => prev.map((sheet) => {
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

    setIssueSheets((prev) => prev.map((sheet) => {
      if (sheet.id !== currentIssueSheetId) return sheet;
      return {
        ...sheet,
        rows: sheet.rows.map((row) => row.id === editingIssueRowId ? { ...issueRowDraft } : row)
      };
    }));

    const rowTitle = issueRowDraft.title?.trim() || `${issueRowDraft.section || "Issue"}${issueRowDraft.page ? ` ${issueRowDraft.page}` : ""}`.trim() || `Issue Row ${issueRowDraft.id}`;
    const assignee = issueRowDraft.online?.trim() || issueRowDraft.layout?.trim() || "Unassigned";
    const newPendingTask: Task & { sourceIssueRowId?: string } = {
      id: `issue-pending-${issueRowDraft.id}`,
      title: rowTitle,
      typeOfRelease: "Online Article",
      typeOfContent: issueRowDraft.section || "News",
      writer: issueRowDraft.writer || "Unspecified Writer",
      illusLayout: assignee,
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
      onlineHandler: assignee,
      isPendingConfirmation: true,
      sourceIssueRowId: issueRowDraft.id,
    };

    setTasks((prev) => {
      const filtered = prev.filter((task: any) => task.sourceIssueRowId !== issueRowDraft.id && task.id !== `issue-pending-${issueRowDraft.id}`);
      return [newPendingTask, ...filtered];
    });

    setEditingIssueRowId(null);
    setIssueRowDraft(null);
  };

  const deleteIssueRow = (rowId: string) => {
    setIssueSheets((prev) => prev.map((sheet) => {
      if (sheet.id !== currentIssueSheetId) return sheet;
      return { ...sheet, rows: sheet.rows.filter((row) => row.id !== rowId) };
    }));

    setTasks((prev) => prev.filter((task: any) => task.sourceIssueRowId !== rowId));
    if (editingIssueRowId === rowId) {
      setEditingIssueRowId(null);
      setIssueRowDraft(null);
    }
  };

  const addIssueSheet = () => {
    const nextId = `issue-sheet-${Date.now()}`;
    const nextSheet = {
      id: nextId,
      title: `Issue Publication Sheet ${issueSheets.length + 1}`,
      rows: []
    };
    setIssueSheets((prev) => [...prev, nextSheet]);
    setCurrentIssueSheetId(nextId);
  };

  const deleteIssueSheet = (sheetId: string) => {
    setIssueSheets((prev) => {
      if (prev.length <= 1) return prev;
      const remaining = prev.filter((sheet) => sheet.id !== sheetId);
      if (remaining.length > 0) {
        setCurrentIssueSheetId(remaining[0].id);
      }
      return remaining;
    });
  };

  const removeIssueRow = (id: string) => {
    setIssueSheets((prev) => prev.map((sheet) => {
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
          { id: "issue-publication", label: "Publication Issue", icon: BookOpen },
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

    const created: Task = {
      id: `task-${Date.now()}`,
      title: formTitle,
      typeOfRelease: formReleaseType,
      typeOfContent: formContentType,
      writer: formWriter || "Unspecified Writer",
      illusLayout: resolvedFormArtist,
      progress: resolvedFormArtist === "Unassigned" ? "Not Started" : "Assigned",
      writeup: formWriteup || formTitle || "drafting",
      priority: formPriority,
      releaseDate: formReleaseDate,
      files: [],
      commentsCount: 0,
      revisionCount: 0,
      lastUpdated: new Date().toISOString(),
      canvaLink: formCanvaLink || "",
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
        id: `task-${Date.now()}-online`,
        title: `${formTitle} (Online Pubmat)`,
        typeOfRelease: "Online Article",
        isPendingConfirmation: false
      };
      nextTasks = [onlineCompanion, ...nextTasks];
    }

    setTasks(nextTasks);

    // Push Notification
    if (formArtist !== "Unassigned") {
      const notif: Notification = {
        id: `notif-${Date.now()}`,
        title: "New Layout Assignment",
        message: `You have been assigned to layout '${formTitle}' targeting ${formReleaseDate}.` + (formCanvaLink ? ` Canva link: ${formCanvaLink}` : ''),
        type: "assignment",
        timestamp: new Date().toISOString(),
        readBy: []
      };
      const nextNotifs = [notif, ...notifications];
      setNotifications(nextNotifs);
      pushStateToBackend({ tasks: nextTasks, notifications: nextNotifs });
    } else {
      pushStateToBackend({ tasks: nextTasks });
    }

    // Reset Form
    setFormTitle("");
    setFormDocLink("");
    setFormWriter("");
    setFormWriteup("");
    setFormCanvaLink("");
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
                      ? "bg-gradient-to-r from-[#bc1700] to-[#660000] text-white font-black shadow-lg shadow-red-950/40 border-l-4 border-white" 
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
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#bc1700] to-[#660000] border border-red-500/20 flex items-center justify-center text-xs font-bold text-white uppercase font-sans shrink-0">
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
                          ? "bg-gradient-to-r from-[#bc1700] to-[#660000] text-white shadow-sm" 
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
      <div className="flex-1 flex flex-col min-w-0 md:h-screen md:overflow-y-auto p-1.5 sm:p-3 md:p-5 space-y-2 sm:space-y-3 md:space-y-4">
        
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
                {notifications.length > 0 && (
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
                      onClick={() => setNotifications([])}
                      className="text-[10px] text-red-700 dark:text-red-400 hover:underline font-bold cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-neutral-400 dark:text-neutral-500 py-4 text-center">No recent alerts.</p>
                    ) : (
                      notifications.slice(0, 4).map((n) => (
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
              <div className="bg-white dark:bg-neutral-900 rounded-[28px] p-3 sm:p-4 md:p-5 border border-neutral-200/60 dark:border-neutral-800 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                  <div>
                    <h3 className="font-sans font-black text-neutral-900 dark:text-neutral-100 text-base sm:text-lg flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#bc1700]" />
                      Publication Issue
                    </h3>
                    <p className="text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400">
                      Manual publication planning sheet for issue assignment and tracking.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={addIssueSheet}
                      className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-700 text-white text-[10px] sm:text-xs font-bold rounded-xl cursor-pointer"
                    >
                      + Add Another Sheet
                    </button>
                    <button
                      type="button"
                      onClick={addIssueRow}
                      className="px-3 py-1.5 bg-[#bc1700] hover:bg-[#8e1200] text-white text-[10px] sm:text-xs font-bold rounded-xl cursor-pointer"
                    >
                      + Add Row
                    </button>
                  </div>
                </div>

                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {issueSheets.map((sheet) => (
                      <div key={sheet.id} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setCurrentIssueSheetId(sheet.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                            sheet.id === currentIssueSheetId
                              ? "bg-[#bc1700] text-white border-[#bc1700]"
                              : "bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                          }`}
                        >
                          {sheet.title}
                        </button>
                        {issueSheets.length > 1 && (
                          <button
                            type="button"
                            onClick={() => deleteIssueSheet(sheet.id)}
                            className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-200 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-600 text-[10px] font-bold cursor-pointer"
                            aria-label={`Delete sheet ${sheet.title}`}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400 mb-1">
                    Sheet title
                  </label>
                  <input
                    type="text"
                    value={issueSheetTitle}
                    onChange={(e) => setIssueSheets((prev) => prev.map((sheet) => (
                      sheet.id === currentIssueSheetId ? { ...sheet, title: e.target.value } : sheet
                    )))}
                    className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs outline-none"
                  />
                </div>

                <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
                  <div className="min-w-[920px]">
                    <div className="grid grid-cols-[0.8fr_1.6fr_2.3fr_1.3fr_1.1fr_1.1fr_1.1fr_1.1fr] bg-[#bc1700] text-white text-[10px] font-black uppercase tracking-[0.12em]">
                      <div className="px-2 py-2 border-r border-red-900/60">Page</div>
                      <div className="px-2 py-2 border-r border-red-900/60">Section or Content</div>
                      <div className="px-2 py-2 border-r border-red-900/60">Title or Summary</div>
                      <div className="px-2 py-2 border-r border-red-900/60">Writer</div>
                      <div className="px-2 py-2 border-r border-red-900/60">Graphics</div>
                      <div className="px-2 py-2 border-r border-red-900/60">Layout</div>
                      <div className="px-2 py-2 border-r border-red-900/60">Online</div>
                      <div className="px-2 py-2 text-center">Progress</div>
                    </div>

                    {issueRows.length === 0 ? (
                      <div className="p-5 text-center text-[11px] text-neutral-400 dark:text-neutral-500 bg-white dark:bg-neutral-900">
                        No publication rows yet.
                      </div>
                    ) : (
                      issueRows.map((row) => (
                        <div key={row.id} className="grid grid-cols-[0.8fr_1.6fr_2.3fr_1.3fr_1.1fr_1.1fr_1.1fr_1.1fr] border-b last:border-b-0 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[11px]">
                          <button
                            type="button"
                            onClick={() => openIssueRowEditor(row)}
                            className="w-full px-2 py-2 border-r border-neutral-200 dark:border-neutral-700 bg-transparent text-left font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800"
                          >
                            {row.page || "—"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openIssueRowEditor(row)}
                            className="w-full px-2 py-2 border-r border-neutral-200 dark:border-neutral-700 bg-transparent text-left font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800"
                          >
                            {row.section || "—"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openIssueRowEditor(row)}
                            className="w-full px-2 py-2 border-r border-neutral-200 dark:border-neutral-700 bg-transparent text-left font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800"
                          >
                            {row.title || "—"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openIssueRowEditor(row)}
                            className="w-full px-2 py-2 border-r border-neutral-200 dark:border-neutral-700 bg-transparent text-left font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800"
                          >
                            {row.writer || "—"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openIssueRowEditor(row)}
                            className="w-full px-2 py-2 border-r border-neutral-200 dark:border-neutral-700 bg-transparent text-left font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800"
                          >
                            {row.graphics || "—"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openIssueRowEditor(row)}
                            className="w-full px-2 py-2 border-r border-neutral-200 dark:border-neutral-700 bg-transparent text-left font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800"
                          >
                            {row.layout || "—"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openIssueRowEditor(row)}
                            className="w-full px-2 py-2 border-r border-neutral-200 dark:border-neutral-700 bg-transparent text-left font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800"
                          >
                            {row.online || "—"}
                          </button>
                          <div className="flex items-center justify-between gap-1 px-1 py-1">
                            <span className="px-1.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-[10px] font-semibold text-neutral-700 dark:text-neutral-200">
                              {row.progress || "Pending"}
                            </span>
                            <button
                              type="button"
                              onClick={() => deleteIssueRow(row.id)}
                              className="text-neutral-400 hover:text-red-600 text-xs cursor-pointer ml-1"
                              title="Remove row"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-3 space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 pb-2">
                    <div>
                      <h4 className="font-sans font-black text-neutral-900 dark:text-neutral-100 text-sm">Issue Tasks</h4>
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Issue-only tasks that are dispatched from the publication planner and assigned to the layout team.</p>
                    </div>
                    <span className="text-[10px] font-bold bg-[#bc1700]/10 text-[#bc1700] dark:text-red-400 px-2 py-1 rounded-full">
                      {issueTaskCards.length} task{issueTaskCards.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {issueTaskCards.length === 0 ? (
                    <div className="p-5 text-center text-[11px] text-neutral-400 dark:text-neutral-500 bg-white dark:bg-neutral-900 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-700">
                      No issue tasks yet. Save or dispatch a publication task to see it here.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                      {issueTaskCards.map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => setSelectedTask(task)}
                          className="text-left bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-3 hover:border-[#bc1700]/60 hover:shadow-sm transition-all cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded-full bg-[#bc1700]/10 text-[#bc1700] dark:text-red-400 text-[9px] font-black uppercase tracking-[0.12em]">
                              {task.typeOfRelease || "Issue Article"}
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">
                              {task.priority || "Medium"}
                            </span>
                          </div>

                          <h5 className="font-sans font-black text-sm text-neutral-900 dark:text-neutral-100 leading-tight mb-2">
                            {task.title}
                          </h5>

                          <div className="grid grid-cols-2 gap-2 text-[10px] text-neutral-600 dark:text-neutral-300">
                            <div>
                              <span className="block text-[8px] uppercase tracking-[0.12em] text-neutral-400 mb-0.5">Writer</span>
                              <span className="font-semibold">{task.writer || "Unspecified"}</span>
                            </div>
                            <div>
                              <span className="block text-[8px] uppercase tracking-[0.12em] text-neutral-400 mb-0.5">Layout</span>
                              <span className="font-semibold">{task.illusLayout || "Unassigned"}</span>
                            </div>
                          </div>

                          <div className="mt-2 flex items-center justify-between text-[9px] text-neutral-500 dark:text-neutral-400 border-t border-neutral-200 dark:border-neutral-700 pt-2">
                            <span>{task.releaseDate || "Issue Board"}</span>
                            <span className="font-semibold text-neutral-700 dark:text-neutral-200">{task.progress}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
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
                <option value="Signos">Signos</option>
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
            <button type="button" onClick={saveIssueRowEditor} className="px-3 py-2 rounded-xl bg-[#bc1700] text-white font-bold cursor-pointer">Save Row</button>
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
              <div className="p-1.5 bg-brand-maroon/10 text-brand-maroon dark:text-red-400 rounded-lg">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-display font-black text-neutral-950 dark:text-neutral-100 text-sm flex items-center gap-1.5">
                  {taskFormOrigin === "online-pubmat" ? "Assign Online Pubmat Task" : "Assign Design Task"}
                </h3>
                {taskFormOrigin === "online-pubmat" && (
                  <span className="text-[10px] text-brand-maroon dark:text-red-400 font-semibold">
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
                  <option value="News">News</option>
                  <option value="Features">Features (feats artx)</option>
                  <option value="Opinion">Opinion (op artx)</option>
                  <option value="Cult">Cult / Culture (cult artx)</option>
                  <option value="Editorial">Editorial</option>
                  <option value="Front">Front</option>
                  <option value="Signos">Signos</option>
                  <option value="Graphics">Graphics / Illustration</option>
                  <option value="News Feats">News Feats</option>
                  <option value="OP Persona">OP Persona</option>
                  <option value="Opinion w/ Lola P">Opinion w/ Lola P</option>
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
                    <span className="text-[10px] font-mono text-[#bc1700] dark:text-red-400 font-bold truncate max-w-[120px]">
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
                  <FileText className="w-4 h-4 text-brand-maroon dark:text-red-400" />
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
              <label className="text-neutral-600 font-semibold block mb-1">Canva Workspace Design Link (Optional)</label>
              <input
                type="text"
                placeholder="e.g. https://www.canva.com/design/DAF..."
                value={formCanvaLink}
                onChange={(e) => setFormCanvaLink(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-red-600 outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-neutral-600 font-semibold block mb-1">Pubmat / Reference Link (Optional)</label>
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
            className="w-full py-2.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl cursor-pointer transition-all shadow-md"
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
        onUpdateTask={(updatedTask) => {
          setSelectedTask(updatedTask);
          let updatedList = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);

          // If updating an Issue Article or its online companion, keep both in sync
          if (updatedTask.typeOfRelease === "Issue Article" || updatedTask.id.endsWith("-online") || updatedTask.title.includes("(Online Pubmat)")) {
            const baseTitle = updatedTask.title.replace(/\s*\(Online Pubmat\)$/i, "").trim();
            const isOnline = updatedTask.id.endsWith("-online") || updatedTask.typeOfRelease === "Online Article";
            
            const companionIndex = updatedList.findIndex(
              t => (t.id !== updatedTask.id) && (
                t.id === (isOnline ? updatedTask.id.replace(/-online$/, "") : `${updatedTask.id}-online`) ||
                t.title.replace(/\s*\(Online Pubmat\)$/i, "").trim() === baseTitle
              )
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
                id: `${updatedTask.id}-online`,
                title: `${baseTitle} (Online Pubmat)`,
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
