import React from "react";
import { CalendarCheck, UserCheck, UserX } from "lucide-react";
import { TeamMember, MemberSchedule } from "../types";
import { OFFICIAL_MEMBERS_MAP, getPreferredFirstName } from "../lib/memberUtils";

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function getTodayKey(now: Date = new Date()): string {
  return WEEK_DAYS[(now.getDay() + 6) % 7];
}

// A member without a structured weekly availability update (no schedule, a legacy
// string note, or an object without unavailableDays) is considered free all week.
export function isMemberAvailableToday(
  schedule: TeamMember["schedule"],
  today: string = getTodayKey()
): boolean {
  if (!schedule || typeof schedule === "string") return true;
  const days = (schedule as MemberSchedule).unavailableDays;
  if (!Array.isArray(days) || days.length === 0) return true;
  return !days.some((d) => (d || "").toLowerCase().slice(0, 3) === today.toLowerCase());
}

export interface AvailabilityEntry {
  id: string;
  name: string;
  firstName: string;
  role: string;
  email: string;
  available: boolean;
}

export function getAvailabilityRoster(
  members: TeamMember[],
  today: string = getTodayKey()
): AvailabilityEntry[] {
  const officials = Object.values(OFFICIAL_MEMBERS_MAP);
  const roster: AvailabilityEntry[] = officials.map((o) => {
    const match = members.find((m) => (m.email || "").toLowerCase() === o.email.toLowerCase());
    return {
      id: o.email,
      name: o.displayName,
      firstName: o.preferredFirstName,
      role: o.role,
      email: o.email,
      available: isMemberAvailableToday(match?.schedule, today),
    };
  });

  const officialEmails = new Set(officials.map((o) => o.email.toLowerCase()));
  (members || []).forEach((m) => {
    const email = (m.email || "").toLowerCase();
    if (officialEmails.has(email)) return;
    const role = (m.role || "").toLowerCase();
    const isLayoutTeam =
      role.includes("layout") || role.includes("deputy") || role.includes("staffer") ||
      role.includes("probi") || role.includes("editor");
    if (!isLayoutTeam) return;
    roster.push({
      id: m.id || email || m.name,
      name: m.displayName || m.name,
      firstName: getPreferredFirstName(m.name, m.email),
      role: m.role,
      email: m.email,
      available: isMemberAvailableToday(m.schedule, today),
    });
  });

  return roster;
}

export default function AvailableTodayCard({ members }: { members: TeamMember[] }) {
  const today = getTodayKey();
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const roster = getAvailabilityRoster(members, today);
  const available = roster.filter((r) => r.available);
  const unavailable = roster.filter((r) => !r.available);

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl sm:rounded-3xl border border-emerald-200/70 dark:border-emerald-800/50 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-800 dark:to-emerald-900 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2 sm:p-2.5 bg-white/15 rounded-xl sm:rounded-2xl text-white shrink-0">
            <CalendarCheck className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-black text-white text-sm sm:text-lg leading-tight truncate">
              Available Layout Members Today
            </h3>
            <p className="text-[10px] sm:text-xs text-emerald-100 font-semibold truncate">
              {dateLabel} • Based on weekly availability
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="block text-2xl sm:text-4xl font-black text-white leading-none">
            {available.length}
            <span className="text-sm sm:text-xl text-emerald-200 font-bold">/{roster.length}</span>
          </span>
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-emerald-100 font-bold">
            Free today
          </span>
        </div>
      </div>

      {/* Available members grid */}
      <div className="p-3.5 sm:p-5 space-y-3">
        {available.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5">
            {available.map((m) => (
              <div
                key={m.id}
                className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl px-2.5 py-2 sm:p-3 flex items-center gap-2 min-w-0"
                title={`${m.name} (${m.role}) — available today`}
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-600 text-white font-black text-[10px] sm:text-xs flex items-center justify-center shrink-0">
                  {m.firstName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs font-bold text-emerald-950 dark:text-emerald-200 truncate flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    {m.firstName}
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-emerald-700/80 dark:text-emerald-400/80 font-semibold truncate">
                    {m.role.replace("Layout ", "")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 italic py-2 text-center">
            No layout members are marked available today.
          </p>
        )}

        {unavailable.length > 0 && (
          <div className="pt-2.5 border-t border-neutral-100 dark:border-neutral-800">
            <p className="text-[10px] sm:text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <UserX className="w-3.5 h-3.5 text-rose-500" />
              Unavailable today ({unavailable.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {unavailable.map((m) => (
                <span
                  key={m.id}
                  className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-full text-[10px] sm:text-[11px] font-semibold text-rose-700 dark:text-rose-300"
                  title={`${m.name} (${m.role})`}
                >
                  {m.firstName}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="text-[9px] sm:text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
          Members who have not updated their weekly availability are considered free all week.
        </p>
      </div>
    </div>
  );
}
