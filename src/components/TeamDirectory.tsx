import React, { useState } from "react";
import { 
  Users, Search, ShieldCheck, Mail, Phone, GraduationCap, 
  AlertCircle, Key, Eye, EyeOff, Copy, Check, LayoutGrid, TableProperties,
  Calendar, Clock, X, Lock, BookOpen
} from "lucide-react";
import { TeamMember, MemberSchedule, Task, normalizeEmail } from "../types";
import { OFFICIAL_ACCOUNTS } from "./LoginPage";
import { getOfficialFullName } from "../lib/memberUtils";

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface TeamDirectoryProps {
  members: TeamMember[];
  speechEnabled: boolean;
  currentUserRole?: string;
  currentUserEmail?: string;
  currentUserName?: string;
  tasks?: Task[];
  onUpdateMembers?: (members: TeamMember[]) => void;
}

export default function TeamDirectory({
  members,
  speechEnabled,
  currentUserRole = "Layout Staffer",
  currentUserEmail = "",
  currentUserName = "",
  tasks = [],
  onUpdateMembers,
}: TeamDirectoryProps) {
  const [search, setSearch] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Schedule Modal State
  const [selectedMemberForSchedule, setSelectedMemberForSchedule] = useState<any | null>(null);
  const [unavailableDays, setUnavailableDays] = useState<string[]>([]);

  const isLayoutEditor = currentUserRole === "Layout Editor";
  const isLayoutDeputy = currentUserRole === "Layout Deputy";
  const canViewWorkload = isLayoutEditor || isLayoutDeputy;

  const speakText = (text: string) => {
    if (!speechEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  };

  const togglePasswordReveal = (email: string) => {
    setRevealedPasswords(prev => ({ ...prev, [email]: !prev[email] }));
  };

  const handleCopy = (text: string, keyId: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
    speakText(`Copied ${label} to clipboard.`);
  };

  // Merge official accounts into member list to guarantee all 10 members with accurate display names
  const effectiveMembers = OFFICIAL_ACCOUNTS.map((official, idx) => {
    const existing = members.find(
      (m) =>
        m.email.toLowerCase() === official.email.toLowerCase() ||
        m.name.toLowerCase() === official.name.toLowerCase() ||
        (official.displayName && m.displayName === official.displayName) ||
        (m.name.includes("Donor") && official.name.includes("Donor")) ||
        (m.name.includes("Atienza") && official.name.includes("Atienza")) ||
        (m.name.includes("Magno") && official.name.includes("Magno")) ||
        (m.name.includes("Dizon") && official.name.includes("Dizon"))
    );

    // Compute semester 1 completed pubs (tasks done)
    const staffTasks = tasks.filter(t => {
      const art = (t.illusLayout || "").toLowerCase();
      const nameParts = official.name.toLowerCase();
      const displayParts = official.displayName.toLowerCase();
      return (
        t.progress === "Completed" && (
          art.includes(official.name.split(",")[0].toLowerCase()) ||
          nameParts.includes(art) ||
          displayParts.includes(art)
        )
      );
    });

    // Derive purely from completed tasks. Never add the stored currentSemPubs:
    // handleSaveSchedule persists effectiveMembers for everyone, so adding the
    // prior stored value would compound the count on each availability edit.
    const calculatedSemPubs = staffTasks.length;

    return {
      id: existing ? existing.id : String(idx + 1),
      name: official.name,
      displayName: official.displayName,
      role: official.role,
      college: official.college,
      email: official.email,
      contact: official.contact,
      statusSem1: existing?.statusSem1 || "Active",
      statusSem2: existing?.statusSem2 || "Active",
      type: (existing?.type || (official.role === "Layout Editor" ? "editor" : "layout")) as "layout",
      xp: existing?.xp || 0,
      level: existing?.level || 1,
      completedTasks: existing?.completedTasks || 0,
      currentSemPubs: calculatedSemPubs,
      schedule: existing?.schedule || "Mon/Wed/Fri: Free afternoons | Tue/Thu: Classes until 4PM",
      pin: official.pin
    };
  });

  const filteredMembers = effectiveMembers.filter((m) => {
    const searchLower = search.toLowerCase();
    const matchesSearch = 
      m.name.toLowerCase().includes(searchLower) ||
      (m.displayName && m.displayName.toLowerCase().includes(searchLower)) ||
      m.email.toLowerCase().includes(searchLower) ||
      m.college.toLowerCase().includes(searchLower) ||
      m.contact.includes(search);
    const matchesCollege = collegeFilter === "All" || m.college === collegeFilter;
    const matchesRole = roleFilter === "All" || m.role === roleFilter;

    return matchesSearch && matchesCollege && matchesRole;
  });

  const colleges = Array.from(new Set(effectiveMembers.map((m) => m.college)));

  // Open schedule modal
  const handleOpenScheduleModal = (member: any) => {
    setSelectedMemberForSchedule(member);
    const existingDays = Array.isArray(member.schedule?.unavailableDays) ? member.schedule.unavailableDays : [];
    setUnavailableDays(existingDays);
  };

  const toggleUnavailableDay = (day: string) => {
    setUnavailableDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  // Save Schedule to backend state (reflected across all members' directory)
  const handleSaveSchedule = () => {
    if (!selectedMemberForSchedule) return;

    const ordered = WEEK_DAYS.filter(d => unavailableDays.includes(d));
    const summary = ordered.length > 0
      ? `Unavailable all day: ${ordered.join(", ")}`
      : "Available all week";

    const updatedMembersList = effectiveMembers.map((m) => {
      if (m.email.toLowerCase() === selectedMemberForSchedule.email.toLowerCase()) {
        return {
          ...m,
          schedule: { summary, unavailableDays: ordered, lastUpdated: new Date().toISOString() }
        };
      }
      return m;
    });

    if (onUpdateMembers) {
      onUpdateMembers(updatedMembersList as TeamMember[]);
    }

    setSelectedMemberForSchedule(null);
    speakText(`Schedule saved for ${selectedMemberForSchedule.displayName || selectedMemberForSchedule.name}.`);
  };

  return (
    <div className="space-y-4 sm:space-y-6 text-left">
      
      {/* Search, Filters, and View Switcher */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search staff by display name, UP email, college (CAMP, CP, CAS, CPH), or contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs sm:text-sm focus:bg-white focus:ring-2 focus:ring-brand-maroon outline-none transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
            {/* College Filter */}
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-gray-500" />
              <select
                value={collegeFilter}
                onChange={(e) => setCollegeFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-gray-700 outline-none cursor-pointer"
                aria-label="Filter by College"
              >
                <option value="All">All Colleges ({colleges.length})</option>
                {colleges.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Role Filter */}
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-gray-500" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-gray-700 outline-none cursor-pointer"
                aria-label="Filter by Role"
              >
                <option value="All">All Roles</option>
                <option value="Layout Editor">Layout Editor</option>
                <option value="Layout Deputy">Layout Deputy</option>
                <option value="Layout Staffer">Layout Staffer</option>
                <option value="Layout Probi">Layout Probi</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`p-1.5 rounded-md flex items-center gap-1 text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-white text-brand-maroon shadow-xs"
                    : "text-gray-500 hover:text-gray-900"
                }`}
                title="Cards view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md flex items-center gap-1 text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white text-brand-maroon shadow-xs"
                    : "text-gray-500 hover:text-gray-900"
                }`}
                title="Account details table"
              >
                <TableProperties className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>

          </div>

        </div>

        {/* Counter banner */}
        <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
          <span className="font-medium">
            Showing <strong className="text-gray-800">{filteredMembers.length}</strong> of {effectiveMembers.length} MKule Layout Desk members
          </span>
          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200">
            Term AY 2026-2027 • Semester 1
          </span>
        </div>
      </div>

      {/* VIEW 1: Cards View */}
      {viewMode === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
          {filteredMembers.map((m) => {
            const isRevealed = !!revealedPasswords[m.email];
            const isSelf = normalizeEmail(m.email).toLowerCase() === normalizeEmail(currentUserEmail).toLowerCase();
            const canViewThisPassword = isLayoutEditor || isSelf;

            const schedText = typeof m.schedule === "string" 
              ? m.schedule 
              : m.schedule?.summary || "No schedule submitted yet.";

            return (
              <div 
                key={m.id} 
                className="glass-card rounded-2xl p-4 sm:p-5 space-y-3.5 hover:border-brand-maroon/30 hover:shadow-md transition-all text-left flex flex-col justify-between bg-white border border-gray-100"
              >
                {/* Header info */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-display font-black text-gray-900 text-sm leading-snug">
                          {getOfficialFullName(m.name, m.email)}
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 shrink-0">
                        {m.college}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[10px] font-bold text-brand-maroon uppercase bg-brand-maroon/5 px-2 py-0.5 rounded border border-brand-maroon/15">
                        {m.role}
                      </span>
                      <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Active Account
                      </span>
                    </div>
                  </div>

                  {/* Workload Metric: Total Pubs Done This Semester (Editor/Deputy only) */}
                  {canViewWorkload && (
                    <div className="bg-neutral-50 border border-neutral-200/80 rounded-xl p-2.5 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">
                          Sem 1 Pubs Done
                        </span>
                        <p className="text-sm font-black text-neutral-900 font-sans">
                          {m.currentSemPubs || 0} <span className="text-[10px] font-normal text-neutral-500">completed</span>
                        </p>
                      </div>
                      <span className="text-[9px] text-neutral-400 font-mono text-right">
                        Resets Jan 2027<br />(Sem 2)
                      </span>
                    </div>
                  )}

                  {/* Schedule Display */}
                  <div className="space-y-1.5 bg-neutral-50/70 p-2.5 rounded-xl border border-neutral-150">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-neutral-700 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-brand-maroon" /> Weekly Availability
                      </span>
                      {(isLayoutEditor || isSelf) && (
                        <button
                          type="button"
                          onClick={() => handleOpenScheduleModal(m)}
                          className="text-[10px] font-bold text-brand-maroon hover:underline cursor-pointer"
                        >
                          Update
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-600 line-clamp-2 leading-relaxed">
                      {schedText}
                    </p>
                  </div>

                  {/* Contact Metadata */}
                  <div className="space-y-1.5 text-xs text-gray-600 pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between group">
                      <p className="flex items-center gap-2 font-mono text-[11px] truncate">
                        <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{normalizeEmail(m.email)}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCopy(m.email, `email-${m.email}`, "email")}
                        className="text-gray-400 hover:text-brand-maroon p-1 rounded transition-colors shrink-0 cursor-pointer"
                        title="Copy email"
                      >
                        {copiedKey === `email-${m.email}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between group">
                      <p className="flex items-center gap-2 font-mono text-[11px]">
                        <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>+63 {m.contact}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCopy(`+63 ${m.contact}`, `phone-${m.email}`, "contact number")}
                        className="text-gray-400 hover:text-brand-maroon p-1 rounded transition-colors shrink-0 cursor-pointer"
                        title="Copy contact number"
                      >
                        {copiedKey === `phone-${m.email}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Account Security & Password section (Only Layout Editor can view all, others only their own) */}
                  <div className="pt-2 border-t border-gray-100 bg-neutral-50 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-3 sm:p-4 rounded-b-2xl">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                        <Key className="w-3 h-3 text-brand-maroon" /> Account Password
                      </span>
                      {canViewThisPassword ? (
                        <span className="text-[9px] font-mono text-emerald-600 uppercase font-bold">Authorized</span>
                      ) : (
                        <span className="text-[9px] font-mono text-neutral-400 uppercase">Editor Only</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                      {canViewThisPassword ? (
                        <>
                          <span className="font-mono text-xs font-bold text-neutral-800 tracking-wider">
                            {isRevealed ? m.pin : "••••••••"}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => togglePasswordReveal(m.email)}
                              className="text-gray-400 hover:text-gray-700 p-1 rounded cursor-pointer"
                              title={isRevealed ? "Hide password" : "Show password"}
                            >
                              {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopy(m.pin, `pin-${m.email}`, "password")}
                              className="text-gray-400 hover:text-brand-maroon p-1 rounded cursor-pointer"
                              title="Copy password"
                            >
                              {copiedKey === `pin-${m.email}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5 text-neutral-400 text-xs py-0.5">
                          <Lock className="w-3 h-3 text-neutral-400 shrink-0" />
                          <span className="text-[10px] font-mono italic">Protected (Editor Only)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            );
          })}

          {filteredMembers.length === 0 && (
            <div className="col-span-full py-16 text-center text-gray-500 text-xs bg-white rounded-2xl border border-gray-100">
              <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              No layout staff matching active parameters found.
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: Account Details & Credentials Table */}
      {viewMode === "table" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="p-3.5 sm:p-4 bg-neutral-50/80 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="font-display font-bold text-xs sm:text-sm text-gray-900">
                Layout Section Member Directory &amp; Schedule Roster
              </h4>
              <p className="text-[11px] text-gray-500">
                Official MKule layout team schedule availability, college affiliations, and individual credentials
              </p>
            </div>
            {isLayoutEditor && (
              <button
                type="button"
                onClick={() => {
                  const allRevealed = filteredMembers.every(m => revealedPasswords[m.email]);
                  const nextState: Record<string, boolean> = {};
                  filteredMembers.forEach(m => {
                    nextState[m.email] = !allRevealed;
                  });
                  setRevealedPasswords(nextState);
                }}
                className="text-xs font-semibold text-brand-maroon hover:underline flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Toggle All Passwords</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-100/75 text-neutral-600 text-[10px] font-bold uppercase tracking-wider border-b border-neutral-200">
                <tr>
                  <th className="py-3 px-4">Display Name &amp; Member</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">College</th>
                  <th className="py-3 px-3">Sem 1 Pubs Done</th>
                  <th className="py-3 px-4">Schedule Availability</th>
                  <th className="py-3 px-4">UP Webmail</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Password</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMembers.map((m) => {
                  const isRevealed = !!revealedPasswords[m.email];
                  const isSelf = normalizeEmail(m.email).toLowerCase() === normalizeEmail(currentUserEmail).toLowerCase();
                  const canViewThisPassword = isLayoutEditor || isSelf;

                  const schedText = typeof m.schedule === "string" 
                    ? m.schedule 
                    : m.schedule?.summary || "No schedule submitted";

                  return (
                    <tr key={m.id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-neutral-900">{getOfficialFullName(m.name, m.email)}</div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-brand-maroon/5 text-brand-maroon border border-brand-maroon/15 rounded text-[10px] font-bold uppercase">
                          {m.role}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-neutral-100 text-neutral-700 font-mono font-bold rounded text-[10px]">
                          {m.college}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-bold text-neutral-900">{m.currentSemPubs || 0} pubs</span>
                      </td>
                      <td className="py-3 px-4 max-w-[200px]">
                        <div className="truncate text-[11px] text-neutral-700" title={schedText}>
                          {schedText}
                        </div>
                        {(isLayoutEditor || isSelf) && (
                          <button
                            type="button"
                            onClick={() => handleOpenScheduleModal(m)}
                            className="text-[10px] text-brand-maroon hover:underline font-bold cursor-pointer"
                          >
                            Edit Schedule
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-neutral-700 whitespace-nowrap">
                        {normalizeEmail(m.email)}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-neutral-600 whitespace-nowrap">
                        +63 {m.contact}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {canViewThisPassword ? (
                          <div className="inline-flex items-center gap-2 bg-neutral-100 border border-neutral-200 px-2.5 py-1 rounded-lg">
                            <span className="font-mono font-bold text-neutral-800 tracking-wider text-xs">
                              {isRevealed ? m.pin : "••••••••"}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePasswordReveal(m.email)}
                              className="text-neutral-400 hover:text-neutral-700 p-0.5 rounded cursor-pointer"
                              title={isRevealed ? "Hide" : "Reveal"}
                            >
                              {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono text-neutral-400 italic flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Protected
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {canViewThisPassword ? (
                          <button
                            type="button"
                            onClick={() => handleCopy(m.pin, `tbl-pin-${m.email}`, "password")}
                            className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[11px] font-semibold rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Copy Password"
                          >
                            {copiedKey === `tbl-pin-${m.email}` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-700 font-bold">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-neutral-500" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-[10px] text-neutral-400 italic">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SCHEDULE ENTER / SCAN MODAL */}
      {selectedMemberForSchedule && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 max-w-lg w-full p-5 space-y-4 text-left animate-fade-in max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between border-b pb-3 border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-maroon/10 text-brand-maroon dark:text-brand-maroon-light flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-black text-sm text-neutral-900 dark:text-neutral-100">
                    Schedule Availability
                  </h3>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {selectedMemberForSchedule.displayName || selectedMemberForSchedule.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMemberForSchedule(null)}
                className="text-neutral-400 hover:text-neutral-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 7 day-availability buttons: press a day to mark it unavailable for the whole day */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-neutral-800">
                Tap the days you are <span className="text-brand-maroon">NOT available</span> for the whole day.
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {WEEK_DAYS.map((day) => {
                  const isOff = unavailableDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleUnavailableDay(day)}
                      aria-pressed={isOff}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        isOff
                          ? "bg-brand-maroon text-white border-brand-maroon shadow-xs"
                          : "bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border-neutral-300 dark:border-neutral-600 hover:border-brand-maroon/60 hover:text-brand-maroon dark:hover:text-brand-maroon-light"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-neutral-400">
                This schedule will be saved and reflected across all other layout members' directory immediately.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedMemberForSchedule(null)}
                className="px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSchedule}
                className="px-4 py-1.5 bg-brand-maroon hover:bg-brand-maroon-dark text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                Save Schedule
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
