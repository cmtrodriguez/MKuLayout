import React, { useState } from "react";
import { 
  Calendar as CalendarIcon, Clock, Plus, Info, 
  MapPin, AlertTriangle, ChevronLeft, ChevronRight, CheckCircle2, Trash2 
} from "lucide-react";
import { CalendarEvent } from "../types";

interface CalendarViewProps {
  events: CalendarEvent[];
  speechEnabled: boolean;
  currentUserRole: string;
  onUpdateEvents: (events: CalendarEvent[]) => void;
}

export default function CalendarView({
  events,
  speechEnabled,
  currentUserRole,
  onUpdateEvents,
}: CalendarViewProps) {
  const isEditorOrDeputy = currentUserRole === "Layout Editor" || currentUserRole === "Layout Deputy" || currentUserRole === "Online Layout Head";
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDate, setNewEventDate] = useState("2026-07-15");
  const [newEventType, setNewEventType] = useState<"deadline" | "meeting" | "workshop">("meeting");
  const [newEventDesc, setNewEventDesc] = useState("");

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

  // Static July 2026 calendar metrics:
  // July 2026 starts on a Wednesday, has 31 days.
  const DAYS_IN_JULY = 31;
  const START_OFFSET = 3; // Wednesday offset (Sunday=0, Mon=1, Tue=2, Wed=3)
  
  const daysArray = Array.from({ length: DAYS_IN_JULY }, (_, i) => i + 1);
  const emptyPrecedingCells = Array.from({ length: START_OFFSET }, (_, i) => null);
  const gridCells = [...emptyPrecedingCells, ...daysArray];

  // Helper to extract events on a specific day of July 2026
  const getEventsForDay = (day: number) => {
    const formattedDate = `2026-07-${String(day).padStart(2, "0")}`;
    return events.filter(e => e.start.startsWith(formattedDate));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Calendar Grid Section */}
      <div className="lg:col-span-2 glass-card rounded-2xl p-5 space-y-4 text-left">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-brand-maroon" />
            <h2 className="font-display font-bold text-gray-900 text-base">
              July 2026 Release Timeline
            </h2>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 font-bold bg-gray-100 px-2 py-0.5 rounded">
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
        <div className="grid grid-cols-7 text-center font-mono text-[10px] text-gray-400 uppercase font-bold tracking-wider pt-1">
          <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
        </div>

        {/* July Month Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {gridCells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="h-16 bg-gray-50/40 rounded-lg border border-transparent" />;
            }

            const dayEvents = getEventsForDay(day);

            return (
              <div 
                key={`day-${day}`} 
                className="h-16 bg-white border border-gray-100 rounded-lg p-1.5 flex flex-col justify-between hover:border-brand-maroon/20 hover:bg-brand-cream/20 cursor-pointer transition-all"
                onClick={() => {
                  if (dayEvents.length > 0) {
                    speakText(`July ${day} contains ${dayEvents.length} scheduled event: ${dayEvents.map(e => e.title).join(", ")}`);
                  } else {
                    speakText(`July ${day} calendar day has no scheduled events`);
                  }
                }}
              >
                <span className="font-mono text-[10px] font-bold text-gray-400">{day}</span>
                
                {/* Micro dots or titles */}
                <div className="space-y-0.5">
                  {dayEvents.map(e => (
                    <div 
                      key={e.id}
                      className={`text-[8px] font-bold truncate px-1 rounded uppercase ${
                        e.type === "deadline" ? "bg-red-50 text-brand-red" :
                        e.type === "meeting" ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"
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
        
        {showAddEvent && (
          <div className="glass-card rounded-2xl p-5 space-y-4 animate-fade-in text-left">
            <h3 className="font-display font-bold text-gray-900 text-sm border-b pb-2">
              Schedule Event
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Event Title</label>
                <input
                  type="text"
                  placeholder="e.g. InDesign Grids Review Meeting"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Date</label>
                  <input
                    type="date"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-maroon outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Type</label>
                  <select
                    value={newEventType}
                    onChange={(e) => setNewEventType(e.target.value as any)}
                    className="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-maroon cursor-pointer outline-none"
                  >
                    <option value="meeting">Meeting</option>
                    <option value="deadline">Release Deadline</option>
                    <option value="workshop">Workshop</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Details, location (e.g. Zoom or FAURA 202)..."
                  value={newEventDesc}
                  onChange={(e) => setNewEventDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon"
                />
              </div>

              <button
                onClick={handleAddEvent}
                className="w-full py-2 bg-brand-maroon hover:bg-brand-maroon-dark text-white font-bold rounded-lg text-xs"
              >
                Add to July Grid
              </button>
            </div>
          </div>
        )}

        {/* Upcoming events timeline list */}
        <div className="glass-card rounded-2xl p-5 space-y-4 text-left">
          <h3 className="font-display font-bold text-gray-900 text-base">
            Calendar Schedule Agenda
          </h3>

          <div className="space-y-3">
            {events.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-xs">
                No events scheduled on the calendar yet.
              </div>
            ) : (
              events.map((e) => (
              <div key={e.id} className="p-3 bg-gray-50/50 hover:bg-brand-cream/30 border border-gray-100 rounded-xl space-y-1 relative group">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-gray-900 text-xs truncate max-w-[150px]">{e.title}</h4>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                      e.type === "deadline" ? "bg-red-50 text-brand-red border border-red-100" :
                      e.type === "meeting" ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-green-50 text-green-700"
                    }`}>
                      {e.type}
                    </span>
                    {isEditorOrDeputy && (
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
                {e.description && <p className="text-[11px] text-gray-500 leading-relaxed">{e.description}</p>}
                
                <span className="text-[10px] text-brand-maroon font-mono font-bold block pt-1">
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
