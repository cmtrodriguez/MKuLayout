import React, { useState, useEffect } from "react";
import { 
  Plus, Calendar as CalendarIcon, RefreshCw, CheckCircle, 
  Clock, Flame, Users, BookOpen, BellRing, CheckSquare, Sparkles,
  ArrowRight, Award, Trophy, GraduationCap, ChevronRight, FileText, Vote,
  Folder, ExternalLink, Trash2, X, BarChart3, Filter, Maximize2, Minimize2,
  CalendarDays, CheckCircle2, ChevronLeft, Lock, Tag
} from "lucide-react";
import { Task, TeamMember, CalendarEvent, Poll, PersonalCalendarEvent } from "../types";
import { getPreferredFirstName, isUserAssignedToTask } from "../lib/memberUtils";
import { fetchPersonalEvents, upsertPersonalEvent, deletePersonalEvent, createPoll, updatePollOptionVotes, deletePoll, createAnnouncement } from "../lib/supabase";
import CalendarView from "./CalendarView";
import MeetingPolls from "./MeetingPolls";

interface DashboardOverviewProps {
  tasks: Task[];
  members: TeamMember[];
  events: CalendarEvent[];
  announcements: { id: string; title: string; content: string; date: string; author: string }[];
  speechEnabled: boolean;
  onNavigate: (tab: string) => void;
  onAddTask: () => void;
  currentUserName?: string;
  currentUserEmail?: string;
  currentUserRole?: string;
  onUpdateEvents: (events: CalendarEvent[]) => void;
  polls: Poll[];
  onUpdatePolls: (polls: Poll[]) => void;
  onUpdateAnnouncements?: (announcements: any[]) => void;
}

export default function DashboardOverview({
  tasks,
  members,
  events,
  announcements,
  speechEnabled,
  onNavigate,
  onAddTask,
  currentUserName = "Rodriguez, Christian",
  currentUserEmail = "ctrodriguez2@up.edu.ph",
  currentUserRole = "Layout Editor",
  onUpdateEvents,
  polls,
  onUpdatePolls,
  onUpdateAnnouncements,
}: DashboardOverviewProps) {

  const [overviewTab, setOverviewTab] = useState<"desk" | "calendar" | "polls">("desk");
  const isEditorOrDeputy = currentUserRole === "Layout Editor" || currentUserRole === "Layout Deputy" || currentUserRole === "Online Layout Head";
  const isStaffOrProbi = currentUserRole === "Layout Staffer" || currentUserRole === "Layout Probi" || currentUserRole === "Layout Staff Member";

  // Workload Tracker period & filter state (for Editor & Deputy)
  const [workloadPeriod, setWorkloadPeriod] = useState<"month" | "semester">("semester");
  const [selectedMonth, setSelectedMonth] = useState<string>("September");

  // Staffer & Probi Personal Task Stats & Category period
  const [staffStatsPeriod, setStaffStatsPeriod] = useState<"semester" | "month">("semester");
  const [staffStatsMonth, setStaffStatsMonth] = useState<string>("September");

  // Personal Events state for Staffer & Probi (Private to logged-in user)
  const [personalEvents, setPersonalEvents] = useState<PersonalCalendarEvent[]>(() => {
    try {
      const saved = localStorage.getItem(`mkule_personal_events_${currentUserEmail}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [showPersonalCalendarModal, setShowPersonalCalendarModal] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventCategory, setNewEventCategory] = useState<"Reminder" | "Task Target" | "Meeting" | "Personal">("Reminder");
  const [newEventTime, setNewEventTime] = useState("");
  const [newEventNotes, setNewEventNotes] = useState("");

  // Sync personal events from Supabase
  useEffect(() => {
    if (!currentUserEmail) return;
    fetchPersonalEvents(currentUserEmail).then(evs => {
      if (evs.length > 0) {
        setPersonalEvents(evs);
        localStorage.setItem(`mkule_personal_events_${currentUserEmail}`, JSON.stringify(evs));
      }
    }).catch(() => {
      // If Supabase unavailable, fall back to cached localStorage data
    });
  }, [currentUserEmail]);

  const handleAddPersonalEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;

    const newEv: PersonalCalendarEvent = {
      id: crypto.randomUUID(),
      userEmail: currentUserEmail,
      title: newEventTitle.trim(),
      date: selectedCalendarDate,
      time: newEventTime.trim() || undefined,
      category: newEventCategory,
      notes: newEventNotes.trim() || undefined,
      completed: false,
      createdAt: new Date().toISOString()
    };

    const nextEvents = [newEv, ...personalEvents];
    setPersonalEvents(nextEvents);
    localStorage.setItem(`mkule_personal_events_${currentUserEmail}`, JSON.stringify(nextEvents));

    try {
      await upsertPersonalEvent(newEv);
    } catch (err) {
      console.error("Failed to save personal event:", err);
    }

    setNewEventTitle("");
    setNewEventTime("");
    setNewEventNotes("");
    speakText(`Personal event added for ${selectedCalendarDate}`);
  };

  const handleToggleEventCompleted = async (id: string) => {
    const updated = personalEvents.map(ev => ev.id === id ? { ...ev, completed: !ev.completed } : ev);
    setPersonalEvents(updated);
    localStorage.setItem(`mkule_personal_events_${currentUserEmail}`, JSON.stringify(updated));
    const target = updated.find(ev => ev.id === id);
    if (target) {
      try {
        await upsertPersonalEvent(target);
      } catch (err) {
        console.error("Failed to update personal event:", err);
      }
    }
  };

  const handleDeletePersonalEvent = async (id: string) => {
    const nextEvents = personalEvents.filter(ev => ev.id !== id);
    setPersonalEvents(nextEvents);
    localStorage.setItem(`mkule_personal_events_${currentUserEmail}`, JSON.stringify(nextEvents));
    try {
      await deletePersonalEvent(id, currentUserEmail);
    } catch (err) {
      console.error("Failed to delete personal event:", err);
    }
    speakText("Personal event removed.");
  };

  // Announcement state
  const [showAddAnnouncement, setShowAddAnnouncement] = useState(false);
  const [newAnnTitle, setNewAnnTitle] = useState("");
  const [newAnnContent, setNewAnnContent] = useState("");

  const getFirstName = (name: string) => {
    if (!name) return "User";
    if (name.includes(",")) {
      const parts = name.split(",");
      if (parts[1]) {
        const firstNamePart = parts[1].trim().split(" ")[0];
        if (firstNamePart) return firstNamePart;
      }
    }
    return name.trim().split(" ")[0] || name;
  };

  const speakText = (text: string) => {
    if (!speechEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  };

  const handleAddAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnContent.trim()) return;

    const newAnn = {
      id: `ann-${Date.now()}`,
      title: newAnnTitle.trim(),
      content: newAnnContent.trim(),
      date: new Date().toISOString().split("T")[0],
      author: `${currentUserName} (${currentUserRole})`
    };

    const updated = [newAnn, ...announcements];
    if (onUpdateAnnouncements) {
      onUpdateAnnouncements(updated);
    }
    setNewAnnTitle("");
    setNewAnnContent("");
    setShowAddAnnouncement(false);
    speakText("Announcement posted across all members.");
  };

  const handleDeleteAnnouncement = (id: string) => {
    if (window.confirm("Remove this announcement for all members?")) {
      const updated = announcements.filter(a => a.id !== id);
      if (onUpdateAnnouncements) {
        onUpdateAnnouncements(updated);
      }
      speakText("Announcement removed.");
    }
  };

  // Find tasks assigned specifically to this layout staff member using the same
  // official email/name matching logic as the rest of the app.
  const staffAssignedTasks = tasks.filter(t =>
    !t.isPendingConfirmation && isUserAssignedToTask(t, currentUserName, currentUserEmail)
  );

  // Compute metrics
  const activeTasks = isStaffOrProbi 
    ? staffAssignedTasks.filter(t => t.progress !== "Completed" && t.progress !== "Shelved" && t.progress !== "Archived")
    : tasks.filter(t => t.progress !== "Completed" && t.progress !== "Shelved" && t.progress !== "Archived");

  const completedTasks = isStaffOrProbi
    ? staffAssignedTasks.filter(t => t.progress === "Completed").length
    : tasks.filter(t => t.progress === "Completed").length;

  const lateSubmissions = isStaffOrProbi
    ? staffAssignedTasks.filter(t => t.progress === "For Review" || t.progress === "Revision Needed").length
    : tasks.filter(t => t.progress === "Revision Needed" || t.progress === "drafting").length;

  const activeArtistsCount = members.filter(m => m.statusSem1 === "Active" || m.statusSem2 === "Active").length;
  
  const displayTasks = isStaffOrProbi ? staffAssignedTasks : tasks.slice(0, 4);

  const getTaskProgress = (task: Task) => {
    switch (task.progress) {
      case "Completed": return 100;
      case "Approved": return 90;
      case "for posting": return 80;
      case "For Review": return 70;
      case "Revision Needed": return 50;
      case "In Progress": return 40;
      case "drafting": return 30;
      case "Assigned": return 20;
      default: return 10;
    }
  };

  // Staffer workload dataset: total online pubs vs issues per staffer, per month or per semester
  const staffMembersList = members.length > 0 ? members : [
    { id: "1", name: "Rodriguez, Christian Matthew T.", displayName: "RODRIGUEZ - Xtian Rodriguez" },
    { id: "2", name: "Abad, Ryaen Vincent C.", displayName: "ABAD - Ronz Abad" },
    { id: "3", name: "Roldan, Lady Jamaica F.", displayName: "ROLDAN - Jam Roldan" },
    { id: "4", name: "Donor, Carl Dexter N.", displayName: "DONOR - Carl Donor" },
    { id: "5", name: "Umali, Jherica A.", displayName: "UMALI - Jhe Umali" },
    { id: "6", name: "Musni, Clarisse Joy T.", displayName: "MUSNI - Aris Musni" },
    { id: "7", name: "Sorio, Clarissa Joyce A.", displayName: "SORIO - Issa Sorio" },
    { id: "8", name: "Atienza, Zoe Marceux T.", displayName: "ATIENZA - Zoe Atienza" },
    { id: "9", name: "Magno, Joanna Eve C.", displayName: "MAGNO - Eve Magno" },
    { id: "10", name: "Dizon, Iris B.", displayName: "DIZON - Iris Dizon" },
  ];

  const getStaffShortName = (m: any) => {
    if (m.displayName) {
      const parts = m.displayName.split("-");
      if (parts[1]) return parts[1].trim().split(" ")[0];
      return parts[0].trim();
    }
    if (m.name.includes(",")) {
      const parts = m.name.split(",");
      if (parts[1]) return parts[1].trim().split(" ")[0];
      return parts[0].trim();
    }
    return m.name.split(" ")[0];
  };

  const workloadData = staffMembersList.map((m) => {
    const shortName = getStaffShortName(m);
    const mNameLower = m.name.toLowerCase();
    const shortLower = shortName.toLowerCase();

    // Filter tasks for this staffer
    const memberTasks = tasks.filter((t) => {
      const artist = (t.illusLayout || "").toLowerCase();
      return (
        artist.includes(shortLower) ||
        mNameLower.includes(artist) ||
        (m.email && t.illusLayout.toLowerCase() === m.email.toLowerCase())
      );
    });

    let filtered = memberTasks;
    if (workloadPeriod === "month") {
      filtered = memberTasks.filter((t) => {
        if (!selectedMonth || selectedMonth === "All") return true;
        const rel = (t.releaseDate || "").toLowerCase();
        return rel.includes(selectedMonth.toLowerCase());
      });
    }

    const onlinePubs = filtered.filter(
      (t) => t.typeOfRelease === "Online Article" || t.title.toLowerCase().includes("online")
    ).length;

    const issues = filtered.filter(
      (t) => t.typeOfRelease === "Issue Article" || t.typeOfRelease === "Newspaper Issue" || t.title.toLowerCase().includes("issue")
    ).length;

    return {
      id: m.id,
      name: shortName,
      fullName: m.displayName || m.name,
      onlinePubs,
      issues,
      total: onlinePubs + issues,
    };
  });

  const maxBarValue = Math.max(...workloadData.map(d => Math.max(d.onlinePubs, d.issues)), 4);

  // Computed stats for current logged-in staffer / probi
  const myAssignedTasks = tasks.filter(t => isUserAssignedToTask(t, currentUserName, currentUserEmail));
  const myCompletedTasks = myAssignedTasks.filter(t => 
    t.progress === "Completed" || t.progress === "Approved" || t.progress === "for posting"
  );

  // Month-filtered completed tasks
  const myMonthCompletedTasks = myCompletedTasks.filter(t => {
    const releaseText = (t.releaseDate || "").toLowerCase();
    const targetMonth = staffStatsMonth.toLowerCase();
    return releaseText.includes(targetMonth) || releaseText.includes(targetMonth.substring(0, 3));
  });

  const effectiveCompletedTasks = staffStatsPeriod === "semester" ? myCompletedTasks : myMonthCompletedTasks;

  const CATEGORIES = [
    "News", "Features", "Opinion", "Cult", "Editorial", "Front", "MM", "Graphics"
  ];

  const categoryCounts: Record<string, number> = {};
  CATEGORIES.forEach(cat => { categoryCounts[cat] = 0; });

  effectiveCompletedTasks.forEach(t => {
    const content = (t.typeOfContent || "").toLowerCase();
    let matched = false;
    for (const cat of CATEGORIES) {
      if (content.includes(cat.toLowerCase())) {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        matched = true;
        break;
      }
    }
    if (!matched) {
      categoryCounts["Features"] = (categoryCounts["Features"] || 0) + 1;
    }
  });

  return (
    <div className="space-y-2.5 sm:space-y-4 md:space-y-5 text-left bg-[#faf9f6] dark:bg-neutral-950 p-0 sm:p-1 md:p-3 rounded-xl sm:rounded-[28px] transition-colors">
      
      {/* 1. COMPACT DASHBOARD HEADER & SUB-TAB SWITCHER */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl sm:rounded-3xl p-3 sm:p-5 border border-neutral-200/60 dark:border-neutral-800 shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-lines pointer-events-none opacity-30 dark:opacity-10" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div>
              <h2 className="font-sans font-black text-base sm:text-xl md:text-2xl text-neutral-900 dark:text-neutral-100 tracking-tight leading-tight">
                Welcome, {getPreferredFirstName(currentUserName, currentUserEmail)}!
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
            {/* MKule Layout Drive Folder Link */}
            <a 
              href="https://drive.google.com/drive/folders/1IKOK2njjP5SO15gjxIWB-wcZfZgUW76e?usp=drive_link"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3.5 sm:py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200/80 dark:border-emerald-800 rounded-xl sm:rounded-2xl text-emerald-900 dark:text-emerald-300 text-[10px] sm:text-xs font-bold transition-all shadow-2xs group cursor-pointer"
            >
              <Folder className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700 dark:text-emerald-400 group-hover:scale-105 transition-transform" />
              <span>MKule '26-'27 Layout Drive</span>
              <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
            </a>

            {/* Sub-tab Switcher styled with horizontal layout */}
            <div className="flex flex-wrap items-center bg-neutral-100 dark:bg-neutral-800 p-0.5 sm:p-1 rounded-xl sm:rounded-2xl gap-0.5 sm:gap-1 w-full sm:w-auto">
              <button
                onClick={() => {
                  setOverviewTab("desk");
                  speakText("Switched to Home Desk");
                }}
                className={`px-2.5 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-2 cursor-pointer flex-1 sm:flex-initial justify-center ${
                  overviewTab === "desk"
                    ? "bg-gradient-to-r from-[#bc1700] to-[#660000] text-white shadow-md shadow-red-950/20"
                    : "text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/50 dark:hover:bg-neutral-700"
                }`}
              >
                <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Home Desk</span>
                <span className={`text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded-full font-bold ${
                  overviewTab === "desk" ? "bg-white/20 text-white" : "bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200"
                }`}>{activeTasks.length}</span>
              </button>

              <button
                onClick={() => {
                  setOverviewTab("calendar");
                  speakText("Switched to Timeline Calendar");
                }}
                className={`px-2.5 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-2 cursor-pointer flex-1 sm:flex-initial justify-center ${
                  overviewTab === "calendar"
                    ? "bg-gradient-to-r from-[#bc1700] to-[#660000] text-white shadow-md shadow-red-950/20"
                    : "text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/50 dark:hover:bg-neutral-700"
                }`}
              >
                <CalendarIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Timeline Calendar</span>
                <span className={`text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded-full font-bold ${
                  overviewTab === "calendar" ? "bg-white/20 text-white" : "bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200"
                }`}>{events.length}</span>
              </button>

              <button
                onClick={() => {
                  setOverviewTab("polls");
                  speakText("Switched to Meeting Polls");
                }}
                className={`px-2.5 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-2 cursor-pointer flex-1 sm:flex-initial justify-center ${
                  overviewTab === "polls"
                    ? "bg-gradient-to-r from-[#bc1700] to-[#660000] text-white shadow-md shadow-red-950/20"
                    : "text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/50 dark:hover:bg-neutral-700"
                }`}
              >
                <Vote className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Meeting Polls</span>
                <span className={`text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded-full font-bold ${
                  overviewTab === "polls" ? "bg-white/20 text-white" : "bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200"
                }`}>{polls?.length || 0}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- CONTENT AREA: RENDERS CONDITIONALLY BASED ON SELECT SUB-TAB --- */}

      {overviewTab === "desk" && (
        <div className="space-y-3 sm:space-y-6">
          {/* Row of 4 Metrics Cards (Hidden for Layout Staff and Probi) */}
          {!isStaffOrProbi && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
              {/* Metric 1 */}
              <div 
                className="bg-white dark:bg-neutral-900 rounded-xl sm:rounded-3xl p-2.5 sm:p-4 md:p-5 border border-neutral-200/60 dark:border-neutral-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group"
                onClick={() => onNavigate("online-pubmat")}
                onMouseEnter={() => speakText(`Active layout assignments: ${activeTasks.length}`)}
              >
                <div className="flex justify-between items-start mb-1 sm:mb-2">
                  <span className="text-lg sm:text-2xl font-black text-neutral-900 dark:text-neutral-100 font-sans tracking-tight">
                    {activeTasks.length}
                  </span>
                  <span className="p-1 sm:p-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg sm:rounded-xl text-neutral-500 dark:text-neutral-400 group-hover:bg-red-50 dark:group-hover:bg-red-950/40 group-hover:text-[#bc1700] dark:group-hover:text-red-400 transition-all">
                    <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </span>
                </div>
                <div>
                  <p className="text-[10px] sm:text-[11px] font-bold text-neutral-800 dark:text-neutral-200 tracking-tight">Active Tasks</p>
                  <p className="text-[9px] sm:text-[10px] text-neutral-400 dark:text-neutral-500">Total in progress</p>
                </div>
              </div>

              {/* Metric 2 */}
              <div 
                className="bg-white dark:bg-neutral-900 rounded-xl sm:rounded-3xl p-2.5 sm:p-4 md:p-5 border border-neutral-200/60 dark:border-neutral-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group"
                onClick={() => onNavigate("newspaper-issue")}
                onMouseEnter={() => speakText(`Completed publication tasks: ${completedTasks}`)}
              >
                <div className="flex justify-between items-start mb-1 sm:mb-2">
                  <span className="text-lg sm:text-2xl font-black text-neutral-900 dark:text-neutral-100 font-sans tracking-tight">
                    {completedTasks}
                  </span>
                  <span className="p-1 sm:p-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg sm:rounded-xl text-neutral-500 dark:text-neutral-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/40 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-all">
                    <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </span>
                </div>
                <div>
                  <p className="text-[10px] sm:text-[11px] font-bold text-neutral-800 dark:text-neutral-200 tracking-tight">Completed</p>
                  <p className="text-[9px] sm:text-[10px] text-neutral-400 dark:text-neutral-500">Published items</p>
                </div>
              </div>

              {/* Metric 3 */}
              <div 
                className="bg-white dark:bg-neutral-900 rounded-xl sm:rounded-3xl p-2.5 sm:p-4 md:p-5 border border-neutral-200/60 dark:border-neutral-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group"
                onClick={() => onNavigate("review-submissions")}
                onMouseEnter={() => speakText(`Pending drafts: ${lateSubmissions}`)}
              >
                <div className="flex justify-between items-start mb-1 sm:mb-2">
                  <span className="text-lg sm:text-2xl font-black text-neutral-900 dark:text-neutral-100 font-sans tracking-tight">
                    {lateSubmissions}
                  </span>
                  <span className="p-1 sm:p-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg sm:rounded-xl text-neutral-500 dark:text-neutral-400 group-hover:bg-amber-50 dark:group-hover:bg-amber-950/40 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-all">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </span>
                </div>
                <div>
                  <p className="text-[10px] sm:text-[11px] font-bold text-neutral-800 dark:text-neutral-200 tracking-tight">Pending Reviews</p>
                  <p className="text-[9px] sm:text-[10px] text-neutral-400 dark:text-neutral-500">Awaiting sign-off</p>
                </div>
              </div>

              {/* Metric 4 */}
              <div 
                className="bg-white dark:bg-neutral-900 rounded-xl sm:rounded-3xl p-2.5 sm:p-4 md:p-5 border border-neutral-200/60 dark:border-neutral-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group"
                onClick={() => onNavigate("directory")}
                onMouseEnter={() => speakText(`Active team artists: ${activeArtistsCount}`)}
              >
                <div className="flex justify-between items-start mb-1 sm:mb-2">
                  <span className="text-lg sm:text-2xl font-black text-neutral-900 dark:text-neutral-100 font-sans tracking-tight">
                    {activeArtistsCount}
                  </span>
                  <span className="p-1 sm:p-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg sm:rounded-xl text-neutral-500 dark:text-neutral-400 group-hover:bg-red-50 dark:group-hover:bg-red-950/40 group-hover:text-[#bc1700] dark:group-hover:text-red-400 transition-all">
                    <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </span>
                </div>
                <div>
                  <p className="text-[10px] sm:text-[11px] font-bold text-neutral-800 dark:text-neutral-200 tracking-tight">Team Roster</p>
                  <p className="text-[9px] sm:text-[10px] text-neutral-400 dark:text-neutral-500">Authorized personnel</p>
                </div>
              </div>
            </div>
          )}

          {/* DYNAMIC LAYOUT WORKSPACE */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-2.5 sm:gap-4 pt-0 sm:pt-1">
            
            {/* Left Side: Tasks list */}
            <div className="xl:col-span-8 space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between pb-0.5 sm:pb-1">
                <h3 className="font-sans font-black text-sm sm:text-lg text-neutral-900 dark:text-neutral-100 tracking-tight">
                  My Layout Assignments
                </h3>
                <span className="text-[10px] sm:text-xs text-neutral-400 dark:text-neutral-500 font-medium">
                  Staggered by progress
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-4">
                {displayTasks.length === 0 ? (
                  <div className="col-span-2 bg-white dark:bg-neutral-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-neutral-200/60 dark:border-neutral-800 text-center text-neutral-400 dark:text-neutral-500 text-xs">
                    No layout assignments in your queue today.
                  </div>
                ) : (
                  displayTasks.map((task, idx) => {
                    const colors = [
                      { bg: "bg-[#fdf4f2] dark:bg-neutral-900/90", tagBg: "bg-[#fcdfd8] dark:bg-red-950/60", tagText: "text-[#bc1700] dark:text-red-300", text: "text-[#660000] dark:text-neutral-100", barColor: "bg-[#bc1700]" },
                      { bg: "bg-[#f5faf8] dark:bg-neutral-900/90", tagBg: "bg-[#def2e9] dark:bg-emerald-950/60", tagText: "text-[#0f766e] dark:text-emerald-300", text: "text-[#042f2e] dark:text-neutral-100", barColor: "bg-emerald-600" },
                      { bg: "bg-[#fcfdf2] dark:bg-neutral-900/90", tagBg: "bg-[#f3f7ca] dark:bg-lime-950/60", tagText: "text-[#6c7d0f] dark:text-lime-300", text: "text-[#1a2e05] dark:text-neutral-100", barColor: "bg-lime-600" },
                      { bg: "bg-[#faf5f8] dark:bg-neutral-900/90", tagBg: "bg-[#f5daeb] dark:bg-pink-950/60", tagText: "text-[#b01e74] dark:text-pink-300", text: "text-[#3d0322] dark:text-neutral-100", barColor: "bg-rose-500" }
                    ];
                    const theme = colors[idx % colors.length];
                    const progressVal = getTaskProgress(task);

                    return (
                      <div 
                        key={task.id} 
                        className={`${theme.bg} rounded-xl sm:rounded-[24px] p-3 sm:p-5 flex flex-col justify-between hover:scale-[1.01] transition-all cursor-pointer relative shadow-sm hover:shadow-md border border-neutral-200/40 dark:border-neutral-800 overflow-hidden group`}
                        onClick={() => onNavigate(isStaffOrProbi ? "my-assignments" : "online-pubmat")}
                      >
                        <div>
                          <span className={`${theme.tagBg} ${theme.tagText} text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block`}>
                            {task.typeOfRelease || "Online Article"}
                          </span>
                          
                          <h4 className={`font-sans font-black text-xs sm:text-base ${theme.text} tracking-tight leading-snug sm:leading-tight mt-1.5 sm:mt-3 line-clamp-1 sm:line-clamp-2`}>
                            {task.title}
                          </h4>
                          
                          <p className={`text-[10px] sm:text-xs ${theme.text} opacity-70 dark:opacity-60 mt-0.5 sm:mt-1`}>
                            <span className="font-bold">{task.illusLayout || "Unassigned"}</span> • <span className="font-bold">{task.writer || "N/A"}</span>
                          </p>
                        </div>

                        <div className="bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm p-2 sm:p-3 rounded-lg sm:rounded-2xl flex items-center justify-between mt-2.5 sm:mt-4 shadow-sm border border-neutral-100 dark:border-neutral-700">
                          <div className="flex-grow pr-2 sm:pr-3">
                            <div className="flex justify-between items-center mb-0.5 sm:mb-1">
                              <span className="text-[9px] sm:text-[10px] font-bold text-neutral-800 dark:text-neutral-200">
                                {progressVal}% completed
                              </span>
                            </div>
                            <div className="w-full bg-neutral-100 dark:bg-neutral-700 h-1 sm:h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`${theme.barColor} h-full rounded-full transition-all duration-500`}
                                style={{ width: `${progressVal}%` }}
                              />
                            </div>
                          </div>
                          
                          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white dark:bg-neutral-700 border border-neutral-100 dark:border-neutral-600 shadow-sm flex items-center justify-center text-neutral-800 dark:text-neutral-200 group hover:bg-neutral-50 dark:hover:bg-neutral-600 shrink-0">
                            <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Side: Deadlines timeline */}
            <div className="xl:col-span-4 space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between pb-0.5 sm:pb-1">
                <h3 className="font-sans font-black text-sm sm:text-lg text-neutral-900 dark:text-neutral-100 tracking-tight">
                  Deadlines Timeline
                </h3>
                <button 
                  onClick={() => setOverviewTab("calendar")}
                  className="text-[11px] sm:text-xs text-[#bc1700] dark:text-red-400 hover:underline font-bold cursor-pointer"
                >
                  See all
                </button>
              </div>

              <div className="bg-white dark:bg-neutral-900 rounded-xl sm:rounded-[24px] p-3 sm:p-5 border border-neutral-200/60 dark:border-neutral-800 shadow-sm space-y-2 sm:space-y-3">
                <div className="flex items-center gap-1.5 sm:gap-2 pb-1 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#bc1700] animate-pulse" />
                  <h4 className="font-sans font-black text-[10px] sm:text-xs text-neutral-800 dark:text-neutral-200 uppercase tracking-widest">
                    Latest Tasks & Deadlines
                  </h4>
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  {events.length === 0 ? (
                    <div className="py-3 text-center text-neutral-400 dark:text-neutral-500 text-xs">
                      No upcoming events in timeline.
                    </div>
                  ) : (
                    events.slice(0, 3).map((e) => (
                      <div 
                        key={e.id} 
                        className="flex items-center justify-between gap-2 sm:gap-3 p-1.5 sm:p-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 rounded-xl sm:rounded-2xl transition-all border border-neutral-100/50 dark:border-neutral-800"
                      >
                        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                          <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl shrink-0 ${
                            e.type === "deadline" ? "bg-red-50 dark:bg-red-950/50 text-[#bc1700] dark:text-red-400" :
                            e.type === "meeting" ? "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400" : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
                          }`}>
                            <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <h5 className="font-sans font-bold text-[11px] sm:text-xs text-neutral-850 dark:text-neutral-200 truncate leading-snug">
                              {e.title}
                            </h5>
                            <p className="text-[9px] sm:text-[10px] text-neutral-400 dark:text-neutral-500 font-sans mt-0.5">
                              Date: {e.start}
                            </p>
                          </div>
                        </div>

                        <button 
                          onClick={() => setOverviewTab("calendar")}
                          className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-all cursor-pointer"
                          title="View on calendar"
                        >
                          <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {isEditorOrDeputy && (
                  <button
                    onClick={onAddTask}
                    className="w-full py-2 sm:py-2.5 bg-gradient-to-r from-[#bc1700] to-[#660000] hover:shadow-md text-white font-bold rounded-lg sm:rounded-xl text-[11px] sm:text-xs flex items-center justify-center gap-1.5 transition-all shadow-[0_8px_20px_rgba(188,23,0,0.15)] cursor-pointer"
                  >
                    <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span>Create New Assignment</span>
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* LOWER SECTION: ANNOUNCEMENTS & WORKLOAD TRACKER */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 sm:gap-4 pt-0 sm:pt-1">
            
            {/* Layout Desk Announcements (Editor & Deputy can add/remove, reflected across all) */}
            <div className={`${!isEditorOrDeputy ? "lg:col-span-12" : "lg:col-span-5"} bg-white dark:bg-neutral-900 rounded-xl sm:rounded-[24px] p-3 sm:p-5 border border-neutral-200/60 dark:border-neutral-800 shadow-sm space-y-2 sm:space-y-3`}>
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-1.5 sm:pb-2">
                <h3 className="font-sans font-black text-neutral-900 dark:text-neutral-100 text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                  <BellRing className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#bc1700]" />
                  Layout Desk Announcements
                </h3>
                
                <div className="flex items-center gap-1.5">
                  {isEditorOrDeputy && (
                    <button
                      type="button"
                      onClick={() => setShowAddAnnouncement(!showAddAnnouncement)}
                      className="px-2 py-0.5 text-[9px] font-bold bg-[#bc1700] text-white rounded-md hover:bg-[#8e1200] transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-2.5 h-2.5" /> Post
                    </button>
                  )}
                  <span className="text-[8px] sm:text-[9px] bg-red-50 dark:bg-red-950/50 text-[#bc1700] dark:text-red-400 px-1.5 sm:px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">
                    Live
                  </span>
                </div>
              </div>

              {/* Add Announcement Modal/Form for Editor & Deputy */}
              {showAddAnnouncement && isEditorOrDeputy && (
                <form onSubmit={handleAddAnnouncement} className="p-3 bg-red-50/60 dark:bg-neutral-800 rounded-xl border border-red-200 dark:border-neutral-700 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-[#bc1700] dark:text-red-400">Create Desk Announcement</span>
                    <button type="button" onClick={() => setShowAddAnnouncement(false)} className="text-neutral-400 hover:text-neutral-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Announcement Title"
                    value={newAnnTitle}
                    onChange={(e) => setNewAnnTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs outline-none"
                  />
                  <textarea
                    required
                    rows={2}
                    placeholder="Announcement details (reflected across all members)..."
                    value={newAnnContent}
                    onChange={(e) => setNewAnnContent(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs outline-none resize-none"
                  />
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-[#bc1700] hover:bg-[#8e1200] text-white font-bold rounded-lg text-[10px] cursor-pointer shadow-xs"
                  >
                    Broadcast to All Members
                  </button>
                </form>
              )}

              <div className="space-y-2 sm:space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {announcements.length === 0 ? (
                  <div className="py-6 text-center text-neutral-400 dark:text-neutral-500 text-xs">
                    No layout announcements currently posted.
                  </div>
                ) : (
                  announcements.map((ann) => (
                    <div 
                      key={ann.id} 
                      className="p-2.5 sm:p-3 bg-neutral-50/70 dark:bg-neutral-800/70 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl sm:rounded-2xl border border-neutral-200/30 dark:border-neutral-700 transition-all space-y-1.5 relative group"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-bold text-neutral-950 dark:text-neutral-100 text-xs tracking-tight">
                          {ann.title}
                        </h4>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] sm:text-[9px] font-mono text-neutral-400 dark:text-neutral-500 font-semibold">{ann.date}</span>
                          {isEditorOrDeputy && (
                            <button
                              type="button"
                              onClick={() => handleDeleteAnnouncement(ann.id)}
                              className="text-neutral-400 hover:text-red-600 p-0.5 rounded cursor-pointer opacity-70 group-hover:opacity-100 transition-opacity"
                              title="Delete announcement"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
                        {ann.content}
                      </p>
                      <div className="flex items-center justify-between pt-1 border-t border-neutral-200/10 dark:border-neutral-700/50">
                        <span className="text-[8px] sm:text-[9px] bg-red-50 dark:bg-red-950/60 text-[#bc1700] dark:text-red-300 font-bold uppercase px-1.5 py-0.5 rounded">
                          {ann.author}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>


            {/* WORKLOAD TRACKER FOR LAYOUT EDITOR & LAYOUT DEPUTY */}
            {isEditorOrDeputy && (
              <div className="lg:col-span-7 bg-white dark:bg-neutral-900 rounded-xl sm:rounded-[24px] p-3 sm:p-5 border border-neutral-200/60 dark:border-neutral-800 shadow-sm space-y-3">
                
                {/* Header with period toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800 gap-2">
                  <div>
                    <h3 className="font-sans font-black text-neutral-900 dark:text-neutral-100 text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                      <BarChart3 className="w-4 h-4 text-[#bc1700]" />
                      Workload Tracker (Online Pubs vs Issues)
                    </h3>
                    <p className="text-[9px] sm:text-[10px] text-neutral-400 dark:text-neutral-500">
                      Total online pubs and newspaper issues per staffer in vertical bar graph form
                    </p>
                  </div>

                  {/* Toggle Period: Per Month vs Per Semester */}
                  <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg gap-1 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setWorkloadPeriod("semester")}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                        workloadPeriod === "semester"
                          ? "bg-white dark:bg-neutral-700 text-[#bc1700] dark:text-red-400 shadow-xs"
                          : "text-neutral-600 dark:text-neutral-300 hover:text-neutral-900"
                      }`}
                    >
                      Per Semester
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkloadPeriod("month")}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                        workloadPeriod === "month"
                          ? "bg-white dark:bg-neutral-700 text-[#bc1700] dark:text-red-400 shadow-xs"
                          : "text-neutral-600 dark:text-neutral-300 hover:text-neutral-900"
                      }`}
                    >
                      Per Month
                    </button>
                  </div>
                </div>

                {/* Sub-controls & Legend */}
                <div className="flex flex-wrap items-center justify-between text-xs gap-2 pt-0.5">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#bc1700]" />
                      <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-300">Online Pubs</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#1E3A8A]" />
                      <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-300">Newspaper Issues</span>
                    </div>
                  </div>

                  {workloadPeriod === "semester" ? (
                    <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                      <span>Semester 1 (Current • AY 2026-2027)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-neutral-400">Month:</span>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-2 py-0.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-[10px] font-bold text-neutral-800 dark:text-neutral-200 outline-none cursor-pointer"
                      >
                        <option value="All">All Months</option>
                        <option value="July">July</option>
                        <option value="August">August</option>
                        <option value="September">September (Current)</option>
                        <option value="October">October</option>
                        <option value="November">November</option>
                        <option value="December">December</option>
                        <option value="January">January</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* VERTICAL BAR GRAPH */}
                <div className="pt-2 pb-1 overflow-x-auto">
                  <div className="min-w-[460px]">
                    <svg className="w-full h-44 sm:h-52" viewBox="0 0 540 180">
                      {/* Grid lines */}
                      <line x1="20" y1="140" x2="520" y2="140" className="stroke-neutral-200 dark:stroke-neutral-750 stroke-1" />
                      <line x1="20" y1="100" x2="520" y2="100" className="stroke-neutral-100 dark:stroke-neutral-800 stroke-1 stroke-dasharray-2" />
                      <line x1="20" y1="60" x2="520" y2="60" className="stroke-neutral-100 dark:stroke-neutral-800 stroke-1 stroke-dasharray-2" />
                      <line x1="20" y1="20" x2="520" y2="20" className="stroke-neutral-100 dark:stroke-neutral-800 stroke-1 stroke-dasharray-2" />

                      {workloadData.map((d, index) => {
                        const groupX = 35 + index * 48;
                        const barWidth = 14;
                        const chartHeight = 110;

                        // Online Pubs bar
                        const onlineHeight = Math.max((d.onlinePubs / maxBarValue) * chartHeight, d.onlinePubs > 0 ? 8 : 2);
                        const onlineY = 140 - onlineHeight;

                        // Issues bar
                        const issuesHeight = Math.max((d.issues / maxBarValue) * chartHeight, d.issues > 0 ? 8 : 2);
                        const issuesY = 140 - issuesHeight;

                        return (
                          <g key={d.id} className="group cursor-pointer">
                            {/* Staffer group background hover */}
                            <rect
                              x={groupX - 5}
                              y={10}
                              width={barWidth * 2 + 14}
                              height={135}
                              rx={4}
                              className="fill-transparent group-hover:fill-neutral-50 dark:group-hover:fill-neutral-800/40 transition-colors"
                            />

                            {/* Bar 1: Online Pubs (Maroon) */}
                            <rect
                              x={groupX}
                              y={onlineY}
                              width={barWidth}
                              height={onlineHeight}
                              rx={3}
                              className="fill-[#bc1700] hover:fill-[#8e1200] transition-all"
                            />
                            {/* Online count */}
                            <text
                              x={groupX + barWidth / 2}
                              y={onlineY - 3}
                              textAnchor="middle"
                              className="font-mono text-[8px] font-bold fill-[#bc1700] dark:fill-red-400"
                            >
                              {d.onlinePubs}
                            </text>

                            {/* Bar 2: Issues (Navy Blue) */}
                            <rect
                              x={groupX + barWidth + 3}
                              y={issuesY}
                              width={barWidth}
                              height={issuesHeight}
                              rx={3}
                              className="fill-[#1E3A8A] hover:fill-[#172554] transition-all"
                            />
                            {/* Issues count */}
                            <text
                              x={groupX + barWidth + 3 + barWidth / 2}
                              y={issuesY - 3}
                              textAnchor="middle"
                              className="font-mono text-[8px] font-bold fill-[#1E3A8A] dark:fill-blue-400"
                            >
                              {d.issues}
                            </text>

                            {/* Staffer name */}
                            <text
                              x={groupX + barWidth + 1.5}
                              y="156"
                              textAnchor="middle"
                              className="font-sans text-[8.5px] font-bold fill-neutral-600 dark:fill-neutral-400 group-hover:fill-neutral-950 dark:group-hover:fill-white"
                            >
                              {d.name}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>

                {/* Footer notes */}
                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center justify-between text-[10px] text-neutral-400 gap-1 font-sans">
                  <span>Term 1 of 2 (2 Semesters total). Resets upon Semester 2 commencement in January.</span>
                  <span className="font-bold text-neutral-600 dark:text-neutral-300">
                    Total: {workloadData.reduce((acc, curr) => acc + curr.onlinePubs, 0)} Online • {workloadData.reduce((acc, curr) => acc + curr.issues, 0)} Issues
                  </span>
                </div>
              </div>
            )}

            {/* PERSONAL WORKLOAD & MINI CALENDAR FOR LAYOUT STAFFER & PROBI */}
            {isStaffOrProbi && (
              <div className="lg:col-span-7">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-white dark:bg-neutral-900 rounded-xl sm:rounded-[24px] p-3.5 sm:p-5 border border-neutral-200/60 dark:border-neutral-800 shadow-sm space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800 gap-2">
                      <div>
                        <h3 className="font-sans font-black text-neutral-900 dark:text-neutral-100 text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                          <BarChart3 className="w-4 h-4 text-[#bc1700]" />
                          My Completed Layout Tasks &amp; Categories
                        </h3>
                        <p className="text-[9px] sm:text-[10px] text-neutral-400 dark:text-neutral-500">
                          Total pubs done both per semester and per month with specific editorial categories
                        </p>
                      </div>

                      <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg gap-1 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setStaffStatsPeriod("semester")}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                            staffStatsPeriod === "semester"
                              ? "bg-white dark:bg-neutral-700 text-[#bc1700] dark:text-red-400 shadow-xs"
                              : "text-neutral-600 dark:text-neutral-300 hover:text-neutral-900"
                          }`}
                        >
                          Per Semester
                        </button>
                        <button
                          type="button"
                          onClick={() => setStaffStatsPeriod("month")}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                            staffStatsPeriod === "month"
                              ? "bg-white dark:bg-neutral-700 text-[#bc1700] dark:text-red-400 shadow-xs"
                              : "text-neutral-600 dark:text-neutral-300 hover:text-neutral-900"
                          }`}
                        >
                          Per Month
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between bg-neutral-50 dark:bg-neutral-800/60 p-2.5 sm:p-3 rounded-xl border border-neutral-200/40 dark:border-neutral-700/60 gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider">
                            {staffStatsPeriod === "semester" ? "Semester 1 Total Completed" : `Month (${staffStatsMonth}) Completed`}
                          </p>
                          <p className="font-sans font-black text-sm sm:text-base text-neutral-900 dark:text-neutral-100">
                            {effectiveCompletedTasks.length} Publication Tasks Done
                          </p>
                        </div>
                      </div>

                      {staffStatsPeriod === "month" && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-neutral-400 font-semibold">Month:</span>
                          <select
                            value={staffStatsMonth}
                            onChange={(e) => setStaffStatsMonth(e.target.value)}
                            className="px-2 py-0.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded text-[10px] font-bold text-neutral-800 dark:text-neutral-200 outline-none cursor-pointer"
                          >
                            <option value="July">July</option>
                            <option value="August">August</option>
                            <option value="September">September (Current)</option>
                            <option value="October">October</option>
                            <option value="November">November</option>
                            <option value="December">December</option>
                            <option value="January">January</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-[#bc1700]" /> Editorial Content Categories Breakdown
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {CATEGORIES.map(cat => {
                          const count = categoryCounts[cat] || 0;
                          return (
                            <div 
                              key={cat}
                              className={`p-2 rounded-xl border text-left transition-all ${
                                count > 0 
                                  ? "bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/40" 
                                  : "bg-neutral-50/50 dark:bg-neutral-800/40 border-neutral-150 dark:border-neutral-800 opacity-60"
                              }`}
                            >
                              <span className="text-[9px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-tight block">
                                {cat}
                              </span>
                              <span className="font-mono font-black text-sm text-neutral-900 dark:text-neutral-100">
                                {count} {count === 1 ? "task" : "tasks"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-neutral-900 rounded-xl sm:rounded-[24px] p-3.5 sm:p-5 border border-neutral-200/60 dark:border-neutral-800 shadow-sm space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/60 text-[#bc1700] dark:text-red-400 flex items-center justify-center">
                          <CalendarDays className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-sans font-black text-neutral-900 dark:text-neutral-100 text-xs sm:text-sm">
                            Personal Event Calendar &amp; Reminders
                          </h3>
                          <p className="text-[9px] sm:text-[10px] text-neutral-400 dark:text-neutral-500">
                            Private to you ({getPreferredFirstName(currentUserName, currentUserEmail)}) • Saved across logins
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowPersonalCalendarModal(true)}
                        className="px-2.5 py-1 bg-[#bc1700] hover:bg-[#8e1200] text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                      >
                        <Maximize2 className="w-3 h-3" />
                        <span>Expand Calendar</span>
                      </button>
                    </div>

                    <div 
                      onClick={() => setShowPersonalCalendarModal(true)}
                      className="p-3 bg-neutral-50/70 dark:bg-neutral-850 rounded-xl border border-neutral-200/50 dark:border-neutral-800 cursor-pointer hover:border-[#bc1700]/50 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-xs text-neutral-800 dark:text-neutral-200">
                          {calendarMonth.toLocaleString("en-US", { month: "long", year: "numeric" })}
                        </span>
                        <span className="text-[10px] text-[#bc1700] dark:text-red-400 font-bold group-hover:underline flex items-center gap-1">
                          <span>{personalEvents.length} personal items</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>

                      <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-mono">
                        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => (
                          <div key={day} className="text-neutral-400 font-bold py-0.5">{day}</div>
                        ))}

                        {Array.from({ length: 42 }).map((_, index) => {
                          const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
                          const offset = (firstDay.getDay() + 6) % 7;
                          const dayNumber = index - offset + 1;
                          const thisDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), dayNumber);
                          const isCurrentMonth = thisDate.getMonth() === calendarMonth.getMonth();
                          const isToday = thisDate.toDateString() === new Date().toDateString();
                          const iso = thisDate.toISOString().split('T')[0];
                          const dayEvents = personalEvents.filter(ev => ev.date === iso);

                          return (
                            <div
                              key={`${calendarMonth.getMonth()}-${index}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCalendarDate(iso);
                                setShowPersonalCalendarModal(true);
                              }}
                              className={`min-h-[54px] rounded-md border p-1 text-left transition-all ${
                                isCurrentMonth ? 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700' : 'bg-neutral-100/60 dark:bg-neutral-800/30 border-transparent text-neutral-300'
                              } ${isToday ? 'ring-1 ring-[#bc1700] bg-[#fff5f4] dark:bg-[#2a120f]' : ''}`}
                            >
                              <div className={`text-[9px] font-bold ${isToday ? 'text-[#bc1700]' : 'text-neutral-700 dark:text-neutral-200'}`}>
                                {isCurrentMonth ? thisDate.getDate() : ''}
                              </div>
                              <div className="mt-1 space-y-0.5 overflow-hidden">
                                {dayEvents.slice(0, 2).map(event => (
                                  <div key={event.id} className="truncate rounded bg-red-50 dark:bg-red-950/50 px-1 text-[7px] text-[#bc1700] dark:text-red-300 font-bold">
                                    {event.title}
                                  </div>
                                ))}
                                {dayEvents.length > 2 && (
                                  <div className="text-[7px] font-bold text-neutral-500">+{dayEvents.length - 2}</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {personalEvents.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                          Upcoming Personal Reminders
                        </div>
                        <div className="space-y-1">
                          {personalEvents.slice(0, 3).map(ev => (
                            <div 
                              key={ev.id}
                              className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800 text-xs border border-neutral-150 dark:border-neutral-750"
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={ev.completed}
                                  onChange={() => handleToggleEventCompleted(ev.id)}
                                  className="w-3.5 h-3.5 accent-[#bc1700] cursor-pointer"
                                />
                                <span className={`text-[11px] font-medium ${ev.completed ? "line-through text-neutral-400" : "text-neutral-800 dark:text-neutral-100"}`}>
                                  {ev.title}
                                </span>
                              </div>
                              <span className="font-mono text-[9px] text-neutral-400 bg-white dark:bg-neutral-700 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-600">
                                {ev.date}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* EXPANDABLE PERSONAL EVENT CALENDAR MODAL */}
      {showPersonalCalendarModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 text-left animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 max-w-5xl w-full p-4 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#bc1700]/10 text-[#bc1700] dark:text-red-400 flex items-center justify-center">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-black text-sm sm:text-base text-neutral-900 dark:text-neutral-100">
                    My Personal Event Calendar &amp; Reminders
                  </h3>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1 font-mono">
                    <Lock className="w-3 h-3 text-emerald-600" /> Private to {getPreferredFirstName(currentUserName, currentUserEmail)} • Live to today’s date
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPersonalCalendarModal(false)}
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_0.9fr] gap-4">
              <div className="bg-neutral-50 dark:bg-neutral-850 rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 sm:p-4">
                <div className="flex items-center justify-between pb-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                      className="w-8 h-8 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-[#bc1700] cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <h4 className="font-sans font-black text-base text-neutral-900 dark:text-neutral-100">
                      {calendarMonth.toLocaleString("en-US", { month: "long", year: "numeric" })}
                    </h4>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                    className="w-8 h-8 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-[#bc1700] cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => (
                    <div key={day} className="py-2">{day}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 42 }).map((_, index) => {
                    const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
                    const offset = (firstDay.getDay() + 6) % 7;
                    const dayNumber = index - offset + 1;
                    const thisDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), dayNumber);
                    const isCurrentMonth = thisDate.getMonth() === calendarMonth.getMonth();
                    const isToday = thisDate.toDateString() === new Date().toDateString();
                    const iso = thisDate.toISOString().split('T')[0];
                    const dayEvents = personalEvents.filter(ev => ev.date === iso).sort((a, b) => (a.title || '').localeCompare(b.title || ''));

                    return (
                      <button
                        key={`${calendarMonth.getMonth()}-${index}`}
                        type="button"
                        onClick={() => setSelectedCalendarDate(iso)}
                        className={`min-h-[88px] rounded-xl border p-2 text-left transition-all ${
                          isCurrentMonth ? 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:border-[#bc1700]/60' : 'bg-neutral-100/70 dark:bg-neutral-800/40 border-transparent text-neutral-300'
                        } ${isToday ? 'ring-2 ring-[#bc1700] bg-[#fff7f5] dark:bg-[#2b1714]' : ''}`}
                      >
                        <div className={`text-[10px] font-bold ${isToday ? 'text-[#bc1700]' : 'text-neutral-700 dark:text-neutral-200'}`}>
                          {isCurrentMonth ? thisDate.getDate() : ''}
                        </div>

                        <div className="mt-1 space-y-1">
                          {dayEvents.slice(0, 2).map(event => (
                            <div key={event.id} className="rounded-md bg-red-50 dark:bg-red-950/50 px-1.5 py-0.5 text-[8px] text-[#bc1700] dark:text-red-300 font-bold truncate">
                              {event.title}
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <div className="text-[8px] font-bold text-neutral-500 dark:text-neutral-400">
                              +{dayEvents.length - 2} more
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <form onSubmit={handleAddPersonalEvent} className="p-3 sm:p-4 bg-neutral-50 dark:bg-neutral-850 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3">
                  <span className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200 block uppercase tracking-wider">
                    + Add Personal Event / Reminder
                  </span>
                  <div className="space-y-2">
                    <input
                      type="text"
                      required
                      placeholder="Event title"
                      value={newEventTitle}
                      onChange={(e) => setNewEventTitle(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#bc1700]"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="date"
                        required
                        value={selectedCalendarDate}
                        onChange={(e) => setSelectedCalendarDate(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#bc1700]"
                      />
                      <select
                        value={newEventCategory}
                        onChange={(e) => setNewEventCategory(e.target.value as any)}
                        className="w-full px-2 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#bc1700]"
                      >
                        <option value="Reminder">Reminder</option>
                        <option value="Task Target">Task Target</option>
                        <option value="Meeting">Meeting</option>
                        <option value="Personal">Personal</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      placeholder="Optional notes or time"
                      value={newEventNotes}
                      onChange={(e) => setNewEventNotes(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-[#bc1700] hover:bg-[#8e1200] text-white font-bold rounded-lg text-xs transition-colors shadow-xs cursor-pointer"
                  >
                    Save Event
                  </button>
                </form>

                <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
                      {new Date(selectedCalendarDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </h4>
                    <span className="text-[9px] bg-red-50 dark:bg-red-950/60 text-[#bc1700] dark:text-red-300 px-2 py-0.5 rounded-full font-bold uppercase">
                      {personalEvents.filter(ev => ev.date === selectedCalendarDate).length} items
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                    {personalEvents.filter(ev => ev.date === selectedCalendarDate).length === 0 ? (
                      <div className="py-6 text-center text-neutral-400 dark:text-neutral-500 text-xs">
                        No events on this day.
                      </div>
                    ) : (
                      personalEvents
                        .filter(ev => ev.date === selectedCalendarDate)
                        .map(ev => (
                          <div key={ev.id} className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={ev.completed}
                                onChange={() => handleToggleEventCompleted(ev.id)}
                                className="mt-0.5 w-3.5 h-3.5 accent-[#bc1700] cursor-pointer"
                              />
                              <div>
                                <p className={`text-[11px] font-bold ${ev.completed ? 'line-through text-neutral-400' : 'text-neutral-900 dark:text-neutral-100'}`}>
                                  {ev.title}
                                </p>
                                {ev.notes && (
                                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">{ev.notes}</p>
                                )}
                              </div>
                            </div>
                            <button type="button" onClick={() => handleDeletePersonalEvent(ev.id)} className="text-neutral-400 hover:text-red-600 cursor-pointer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPersonalCalendarModal(false)}
                className="px-4 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 rounded-lg text-xs font-semibold hover:bg-neutral-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {overviewTab === "calendar" && (
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-4 sm:p-6 border border-neutral-200/60 dark:border-neutral-800 shadow-sm">
          <CalendarView
            events={events}
            speechEnabled={speechEnabled}
            currentUserRole={currentUserRole}
            onUpdateEvents={onUpdateEvents}
          />
        </div>
      )}

      {overviewTab === "polls" && (
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-4 sm:p-6 border border-neutral-200/60 dark:border-neutral-800 shadow-sm">
          <MeetingPolls
            polls={polls}
            members={members}
            speechEnabled={speechEnabled}
            currentUserEmail={currentUserEmail}
            onUpdatePolls={onUpdatePolls}
          />
        </div>
      )}

    </div>
  );
}
