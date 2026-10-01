import React, { useEffect, useState } from "react";
import { 
  Calendar as CalendarIcon, Clock, Plus, Info, 
  MapPin, AlertTriangle, ChevronLeft, ChevronRight, CheckCircle2, Trash2, Lock 
} from "lucide-react";
import { CalendarEvent, Task, PersonalCalendarEvent } from "../types";
import { fetchPersonalEvents, upsertPersonalEvent, deletePersonalEvent } from "../lib/supabase";

interface CalendarViewProps {
  events: CalendarEvent[];
  tasks: Task[];
  speechEnabled: boolean;
  currentUserRole: string;
  currentUserEmail?: string;
  currentUserName?: string;
  onUpdateEvents: (events: CalendarEvent[]) => void;
}

export default function CalendarView({
  events,
  tasks,
  speechEnabled,
  currentUserRole,
  currentUserEmail = "",
  currentUserName = "",
  onUpdateEvents,
}: CalendarViewProps) {
  const isEditorOrDeputy = currentUserRole === "Layout Editor" || currentUserRole === "Layout Deputy" || currentUserRole === "Online Layout Head";
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDate, setNewEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newEventType, setNewEventType] = useState<"deadline" | "meeting" | "workshop">("meeting");
  const [newEventDesc, setNewEventDesc] = useState("");

  // Personal reminders — private to the signed-in account, editable by everyone.
  const [showAddPersonal, setShowAddPersonal] = useState(false);
  const [personalEvents, setPersonalEvents] = useState<PersonalCalendarEvent[]>([]);
  const [personalTitle, setPersonalTitle] = useState("");
  const [personalDate, setPersonalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [personalCategory, setPersonalCategory] = useState<"Reminder" | "Task Target" | "Meeting" | "Personal">("Reminder");
  const [personalNotes, setPersonalNotes] = useState("");

  useEffect(() => {
    if (!currentUserEmail) return;
    let active = true;
    fetchPersonalEvents(currentUserEmail).then(evs => {
      if (active) setPersonalEvents(evs);
    }).catch(() => {});
    return () => { active = false; };
  }, [currentUserEmail]);

  const speakText = (text: string) => {
    if (!speechEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  };

  const handleAddEvent = () => {
    if (!isEditorOrDeputy) return;
    if (!newEventTitle.trim()) {
      speakText("Please specify an event title.");
      return;
    }

    const created: CalendarEvent = {
      id: `e-${Date.now()}`,
      title: newEventTitle,
      start: newEventDate,
      type: newEventType,
      description: newEventDesc
    };

    onUpdateEvents([...events, created]);
    setNewEventTitle("");
    setNewEventDesc("");
    setShowAddEvent(false);
    speakText("New event added to layout desk calendar.");
  };

  const handleDeleteEvent = (id: string) => {
    if (!isEditorOrDeputy) return;
    if (window.confirm("Are you sure you want to remove this calendar event?")) {
      const updated = events.filter(e => e.id !== id);
      onUpdateEvents(updated);
      speakText("Event removed from timeline calendar.");
    }
  };

  const handleAddPersonalEvent = async () => {
    if (!currentUserEmail || !personalTitle.trim()) {
      speakText("Please specify a reminder title.");
      return;
    }
    const newEv: PersonalCalendarEvent = {
      id: crypto.randomUUID(),
      userEmail: currentUserEmail,
      title: personalTitle.trim(),
      date: personalDate,
      category: personalCategory,
      notes: personalNotes.trim() || undefined,
      completed: false,
      createdAt: new Date().toISOString()
    };
    setPersonalEvents(prev => [...prev, newEv].sort((a, b) => a.date.localeCompare(b.date)));
    setPersonalTitle("");
    setPersonalNotes("");
    setShowAddPersonal(false);
    try {
      await upsertPersonalEvent(newEv);
    } catch (err) {
      console.error("Failed to save personal event:", err);
    }
    speakText("Personal reminder added to your private calendar.");
  };

  const handleDeletePersonalEvent = async (id: string) => {
    setPersonalEvents(prev => prev.filter(ev => ev.id !== id));
    try {
      await deletePersonalEvent(id, currentUserEmail);
    } catch (err) {
      console.error("Failed to delete personal event:", err);
    }
    speakText("Personal reminder removed.");
  };

  // Dynamic current-month calendar so task deadlines land on the right day
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-based
  const monthName = today.toLocaleString("en-US", { month: "long" });

  const DAYS_IN_MONTH = new Date(year, month + 1, 0).getDate();
  const START_OFFSET = new Date(year, month, 1).getDay(); // Sunday=0

  const daysArray = Array.from({ length: DAYS_IN_MONTH }, (_, i) => i + 1);
  const emptyPrecedingCells = Array.from({ length: START_OFFSET }, (_, i) => null);
  const gridCells = [...emptyPrecedingCells, ...daysArray];

  const MONTH_NAMES = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];

  // Normalize a task deadline (ISO "YYYY-MM-DD" or display "MONTH D") to ISO; null if not a date
  const toTaskISO = (raw: string): string | null => {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const disp = /^([A-Za-z]+)\s+(\d{1,2})(?:,?\s*(\d{4}))?$/.exec(trimmed);
    if (disp) {
      const mi = MONTH_NAMES.indexOf(disp[1].toUpperCase());
      if (mi === -1) return null;
      const yr = disp[3] ? Number(disp[3]) : year;
      return `${yr}-${String(mi + 1).padStart(2, "0")}-${String(Number(disp[2])).padStart(2, "0")}`;
    }
    return null;
  };

  // Task deadlines rendered as calendar entries alongside standalone events.
  // Completed/approved/archived tasks are dropped — their deadline is already done.
  const isDoneTask = (t: Task) =>
    t.progress === "Completed" || t.progress === "Approved" || t.progress === "Archived";

  const taskEntries = tasks
    .filter(t => !isDoneTask(t))
    .map(t => ({ id: `task-${t.id}`, title: t.title, start: toTaskISO(t.releaseDate || "") || "", type: "deadline" as const, isTask: true, isPersonal: false, description: "", category: t.typeOfContent || "" }))
    .filter(e => e.start);

  const eventEntries = events.map(e => ({ id: e.id, title: e.title, start: e.start, type: e.type, isTask: false, isPersonal: false, description: e.description, category: "" }));

  // Private reminders belonging to this account only
  const personalEntries = personalEvents.map(ev => ({
    id: `personal-${ev.id}`,
    title: ev.title,
    start: ev.date,
    type: "personal" as const,
    isTask: false,
    isPersonal: true,
    description: ev.notes || "",
    category: ev.category || "Personal",
    personalId: ev.id
  }));

  const agendaItems = [...eventEntries, ...taskEntries, ...personalEntries].sort((a, b) => a.start.localeCompare(b.start));

  // Helper to extract entries (events + task deadlines + personal reminders) on a specific day
  const getEventsForDay = (day: number) => {
    const formattedDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return agendaItems.filter(e => e.start.startsWith(formattedDate));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Calendar Grid Section */}
      <div className="lg:col-span-2 glass-card rounded-2xl p-5 space-y-4 text-left">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-brand-maroon" />
            <h2 className="font-display font-bold text-gray-900 dark:text-neutral-100 text-base">
              {monthName} {year} Release Timeline
            </h2>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 dark:text-neutral-500 font-bold bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
              Academic Term 2026-2027
            </span>
            {isEditorOrDeputy && (
              <button
                onClick={() => setShowAddEvent(!showAddEvent)}
                className="px-3 py-1.5 bg-brand-maroon text-white font-semibold rounded-lg text-xs hover:bg-brand-maroon-dark transition-all flex items-center gap-1 shadow cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Event
              </button>
            )}
          </div>
        </div>

        {/* Days of Week header */}
        <div className="grid grid-cols-7 text-center font-mono text-[10px] text-gray-400 dark:text-neutral-500 uppercase font-bold tracking-wider pt-1">
          <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
        </div>

        {/* Month Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {gridCells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="h-16 bg-gray-50/40 dark:bg-neutral-800/30 rounded-lg border border-transparent" />;
            }

            const dayEvents = getEventsForDay(day);

            return (
              <div 
                key={`day-${day}`} 
                className="h-16 bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-lg p-1.5 flex flex-col justify-between hover:border-brand-maroon/20 hover:bg-brand-cream/20 dark:hover:bg-neutral-800 cursor-pointer transition-all"
                onClick={() => {
                  if (dayEvents.length > 0) {
                    speakText(`${monthName} ${day} contains ${dayEvents.length} scheduled item: ${dayEvents.map(e => e.title).join(", ")}`);
                  } else {
                    speakText(`${monthName} ${day} calendar day has no scheduled events`);
                  }
                }}
              >
                <span className="font-mono text-[10px] font-bold text-gray-400 dark:text-neutral-500">{day}</span>
                
                {/* Micro dots or titles */}
                <div className="space-y-0.5">
                  {dayEvents.map(e => (
                    <div 
                      key={e.id}
                      className={`text-[8px] font-bold truncate px-1 rounded uppercase ${
                        e.isPersonal ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300" :
                        e.type === "deadline" ? "bg-red-50 dark:bg-red-950/40 text-brand-red dark:text-red-300" :
                        e.type === "meeting" ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300" : "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-300"
                      }`}
                    >
                      {e.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Events list and creator sidebar */}
      <div className="space-y-6">
        
        {showAddEvent && isEditorOrDeputy && (
          <div className="glass-card rounded-2xl p-5 space-y-4 animate-fade-in text-left">
            <h3 className="font-display font-bold text-gray-900 dark:text-neutral-100 text-sm border-b pb-2">
              Schedule Shared Event
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-neutral-300 block mb-1">Event Title</label>
                <input
                  type="text"
                  placeholder="e.g. InDesign Grids Review Meeting"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-neutral-100 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-neutral-300 block mb-1">Date</label>
                  <input
                    type="date"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full px-2 py-2 border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-neutral-100 rounded-lg text-xs focus:ring-2 focus:ring-brand-maroon outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-neutral-300 block mb-1">Type</label>
                  <select
                    value={newEventType}
                    onChange={(e) => setNewEventType(e.target.value as any)}
                    className="w-full px-2 py-2 border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-neutral-100 rounded-lg text-xs focus:ring-2 focus:ring-brand-maroon cursor-pointer outline-none"
                  >
                    <option value="meeting">Meeting</option>
                    <option value="deadline">Release Deadline</option>
                    <option value="workshop">Workshop</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-neutral-300 block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Details, location (e.g. Zoom or FAURA 202)..."
                  value={newEventDesc}
                  onChange={(e) => setNewEventDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-neutral-100 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon"
                />
              </div>

              <button
                onClick={handleAddEvent}
                className="w-full py-2 bg-brand-maroon hover:bg-brand-maroon-dark text-white font-bold rounded-lg text-xs cursor-pointer"
              >
                Add to {monthName} Grid
              </button>
            </div>
          </div>
        )}

        {/* Personal reminder creator — available to every member, private to them */}
        <div className="glass-card rounded-2xl p-5 space-y-3 text-left">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-display font-bold text-gray-900 dark:text-neutral-100 text-sm flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> My Personal Reminders
            </h3>
            <button
              onClick={() => setShowAddPersonal(!showAddPersonal)}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer transition-all"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>

          <p className="text-[10px] text-gray-400 dark:text-neutral-500">
            Private to {currentUserName || "you"} • Only visible on your account
          </p>

          {showAddPersonal && (
            <div className="space-y-2 text-xs p-3 rounded-xl bg-emerald-50/50 dark:bg-neutral-800 border border-emerald-100 dark:border-neutral-700 animate-fade-in">
              <input
                type="text"
                placeholder="Reminder title"
                value={personalTitle}
                onChange={(e) => setPersonalTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-neutral-100 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={personalDate}
                  onChange={(e) => setPersonalDate(e.target.value)}
                  className="w-full px-2 py-2 border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-neutral-100 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <select
                  value={personalCategory}
                  onChange={(e) => setPersonalCategory(e.target.value as any)}
                  className="w-full px-2 py-2 border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-neutral-100 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
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
                value={personalNotes}
                onChange={(e) => setPersonalNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-neutral-100 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                onClick={handleAddPersonalEvent}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs cursor-pointer"
              >
                Save Personal Reminder
              </button>
            </div>
          )}
        </div>

        {/* Upcoming events timeline list */}
        <div className="glass-card rounded-2xl p-5 space-y-4 text-left">
          <h3 className="font-display font-bold text-gray-900 dark:text-neutral-100 text-base">
            Calendar Schedule Agenda
          </h3>

          <div className="space-y-3">
            {agendaItems.length === 0 ? (
              <div className="p-6 text-center text-gray-400 dark:text-neutral-500 text-xs">
                No events or task deadlines scheduled on the calendar yet.
              </div>
            ) : (
              agendaItems.map((e) => (
              <div key={e.id} className="p-3 bg-gray-50/50 dark:bg-neutral-800/50 hover:bg-brand-cream/30 dark:hover:bg-neutral-800 border border-gray-100 dark:border-neutral-700 rounded-xl space-y-1 relative group">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-gray-900 dark:text-neutral-100 text-xs truncate max-w-[150px]">{e.title}</h4>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                      e.isPersonal ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/40" :
                      e.type === "deadline" ? "bg-red-50 dark:bg-red-950/40 text-brand-red dark:text-red-300 border border-red-100 dark:border-red-900/40" :
                      e.type === "meeting" ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40" : "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300"
                    }`}>
                      {e.isPersonal ? "private" : e.isTask ? "task deadline" : e.type}
                    </span>
                    {e.isPersonal && (
                      <button
                        type="button"
                        onClick={() => handleDeletePersonalEvent((e as any).personalId)}
                        className="text-gray-400 hover:text-red-600 p-0.5 rounded cursor-pointer transition-colors"
                        title="Remove personal reminder"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    {!e.isTask && !e.isPersonal && isEditorOrDeputy && (
                      <button
                        type="button"
                        onClick={() => handleDeleteEvent(e.id)}
                        className="text-gray-400 hover:text-red-600 p-0.5 rounded cursor-pointer transition-colors"
                        title="Remove event"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                {e.category && (
                  <span className="inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-brand-cream dark:bg-neutral-700 text-brand-maroon dark:text-brand-maroon-light border border-brand-maroon/20 dark:border-neutral-600">
                    {e.category}
                  </span>
                )}
                {e.description && <p className="text-[11px] text-gray-500 dark:text-neutral-400 leading-relaxed">{e.description}</p>}
                
                <span className="text-[10px] text-brand-maroon dark:text-brand-maroon-light font-mono font-bold block pt-1">
                  ⏱ {e.start}
                </span>
              </div>
            ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
