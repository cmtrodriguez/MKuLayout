import React, { useState } from "react";
import { 
  User, Shield, Award, Settings, LogOut, Eye, EyeOff, Volume2, 
  Sparkles, CheckCircle, HelpCircle, Palette, Lock, Sun, Moon, 
  Type, FolderOpen, ExternalLink, RefreshCw, Key, Copy, Check, 
  ShieldCheck, Mail, Phone, GraduationCap, Users 
} from "lucide-react";
import { TeamMember, UserRole, normalizeEmail } from "../types";
import { OFFICIAL_ACCOUNTS } from "./LoginPage";
import { OFFICIAL_MEMBERS_MAP, getOfficialFullName, getPreferredFirstName } from "../lib/memberUtils";

interface ProfileSettingsProps {
  currentUserRole: UserRole;
  currentUserName: string;
  currentUserEmail: string;
  members: TeamMember[];
  tasks?: any[];
  speechEnabled: boolean;
  setSpeechEnabled: (v: boolean) => void;
  fontSizeMultiplier: number;
  setFontSizeMultiplier: (v: number) => void;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
  darkMode?: boolean;
  setDarkMode?: (v: boolean) => void;
  accentTheme?: "maroon" | "navy" | "forest" | "grape";
  setAccentTheme?: (v: "maroon" | "navy" | "forest" | "grape") => void;
  dyslexicFont?: boolean;
  setDyslexicFont?: (v: boolean) => void;
  onLogout: () => void;
}

export default function ProfileSettings({
  currentUserRole,
  currentUserName,
  currentUserEmail,
  members,
  tasks = [],
  speechEnabled,
  setSpeechEnabled,
  fontSizeMultiplier,
  setFontSizeMultiplier,
  highContrast,
  setHighContrast,
  darkMode = false,
  setDarkMode,
  accentTheme = "maroon",
  setAccentTheme,
  dyslexicFont = false,
  setDyslexicFont,
  onLogout,
}: ProfileSettingsProps) {
  // Find current user's full member object for details
  const officialAccount = OFFICIAL_ACCOUNTS.find(
    (a) =>
      a.email.toLowerCase() === currentUserEmail.toLowerCase() ||
      a.name.toLowerCase() === currentUserName.toLowerCase() ||
      (a.name.includes("Donor") && currentUserName.includes("Donor"))
  );

  const currentMember = members.find(m => m.email === currentUserEmail) || {
    xp: currentUserRole === "Layout Staff Member" ? 320 : 1200,
    level: currentUserRole === "Layout Staff Member" ? 3 : 10,
    college: officialAccount?.college || "CP",
    contact: officialAccount?.contact || "9054353693"
  };

  const userCollege = officialAccount?.college || currentMember.college || "CP";
  const userContact = officialAccount?.contact || currentMember.contact || "9054353693";
  const userPin = officialAccount?.pin || "••••••••";

  const [showPwdModal, setShowPwdModal] = useState(false);
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showSectionRoster, setShowSectionRoster] = useState(false);
  const [statsMode, setStatsMode] = useState<"semester" | "month">("semester");
  const [selectedMonth, setSelectedMonth] = useState<string>("September");

  const monthOrder = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const memberTasks = tasks.filter((task: any) => {
    const memberNames = [
      getOfficialFullName(currentUserName, currentUserEmail),
      currentUserName,
      getPreferredFirstName(currentUserName, currentUserEmail),
      OFFICIAL_MEMBERS_MAP[currentUserEmail.toLowerCase()]?.officialName,
      OFFICIAL_MEMBERS_MAP[currentUserEmail.toLowerCase()]?.preferredFirstName,
      (currentUserName || "").split(",")[0],
      (currentUserName || "").split(" ")[0]
    ].filter(Boolean).map((value) => value.toLowerCase());

    const assigneeFit = (task.illusLayout || "").toLowerCase();
    const graphicsFit = (task.graphics || "").toLowerCase();
    const writerFit = (task.writer || "").toLowerCase();

    return memberNames.some((value) => assigneeFit.includes(value) || graphicsFit.includes(value) || writerFit.includes(value));
  });

  const completedWork = memberTasks.filter((task: any) => task.progress === "Completed" || task.progress === "Approved").length;
  const activeWork = memberTasks.filter((task: any) => task.progress !== "Completed" && task.progress !== "Approved" && task.progress !== "Archived" && task.progress !== "Shelved").length;

  const monthCounts = monthOrder.map((month) => {
    const count = memberTasks.filter((task: any) => {
      const raw = String(task.releaseDate || "").toLowerCase();
      return raw.includes(month.toLowerCase()) || raw.includes(month.slice(0, 3).toLowerCase());
    }).length;
    return { month, count };
  });

  const peakMonth = monthCounts.reduce((top, current) => current.count > top.count ? current : top, monthCounts[0] || { month: "N/A", count: 0 });

  const handleCopy = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
    speakText(`Copied ${label} to clipboard.`);
  };

  const speakText = (text: string) => {
    if (!speechEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  };

  const handleAccentChange = (color: "maroon" | "navy" | "forest" | "grape") => {
    if (setAccentTheme) {
      setAccentTheme(color);
    }
    speakText(`Accent theme adjusted to ${color}`);
  };

  const handleResetDefaults = () => {
    if (setDarkMode) setDarkMode(false);
    if (setAccentTheme) setAccentTheme("maroon");
    setFontSizeMultiplier(1);
    setHighContrast(false);
    if (setDyslexicFont) setDyslexicFont(false);
    setSpeechEnabled(false);
    speakText("Workspace settings reset to defaults.");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
      
      {/* Profile Card and Bio */}
      <div className="space-y-4 sm:space-y-6">
        <div className="glass-card rounded-2xl p-5 sm:p-6 text-center space-y-4 relative overflow-hidden bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 shadow-sm">
          <div className="absolute top-0 inset-x-0 h-2 bg-brand-maroon" />
          
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[var(--color-brand-maroon)]/5 dark:bg-[var(--color-brand-maroon)]/20 rounded-full flex items-center justify-center mx-auto border-2 border-[var(--color-brand-maroon)]/20">
            <User className="w-8 h-8 sm:w-10 sm:h-10 text-[var(--color-brand-maroon)] dark:text-red-400" />
          </div>

          <div>
            <h3 className="font-display font-black text-gray-900 dark:text-neutral-100 text-base leading-tight">
              {currentUserName}
            </h3>
            <p className="text-xs text-gray-400 dark:text-neutral-400 mt-1 break-all">{normalizeEmail(currentUserEmail)}</p>
          </div>

          <div className="flex justify-center gap-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 bg-[var(--color-brand-maroon)]/5 dark:bg-[var(--color-brand-maroon)]/20 text-[var(--color-brand-maroon)] dark:text-red-400 border border-[var(--color-brand-maroon)]/15 dark:border-[var(--color-brand-maroon)]/40 text-[10px] font-bold uppercase rounded-full">
              {currentUserRole}
            </span>
            <span className="px-2.5 py-0.5 bg-gray-50 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 border border-gray-100 dark:border-neutral-700 text-[10px] font-bold uppercase rounded-full">
              {currentMember.college}
            </span>
          </div>

          <div className="border-t pt-4 border-gray-100 dark:border-neutral-800 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-400 dark:text-neutral-400 block text-[9px] font-semibold uppercase">Workspace level</span>
              <span className="font-mono font-bold text-gray-800 dark:text-neutral-200 text-sm">LVL {currentMember.level}</span>
            </div>
            <div>
              <span className="text-gray-400 dark:text-neutral-400 block text-[9px] font-semibold uppercase">Total XP</span>
              <span className="font-mono font-bold text-gray-800 dark:text-neutral-200 text-sm">{currentMember.xp} XP</span>
            </div>
          </div>

          <button
            onClick={() => {
              onLogout();
              speakText("Logged out of layout workspace successfully.");
            }}
            className="w-full py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Log Out Workspace
          </button>
        </div>

        {/* Official Account Details & Security Credentials Card */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 space-y-3 bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-neutral-800">
            <div className="flex items-center gap-2 text-[var(--color-brand-maroon)] dark:text-red-400">
              <ShieldCheck className="w-4 h-4" />
              <h4 className="font-bold text-xs text-gray-900 dark:text-neutral-100">
                Official Account Details
              </h4>
            </div>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
              Verified
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {/* College Affiliation */}
            <div className="flex items-center justify-between py-1 border-b border-gray-50 dark:border-neutral-800/60">
              <span className="text-gray-400 dark:text-neutral-400 text-[11px] flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5" /> College
              </span>
              <span className="font-mono font-bold text-gray-800 dark:text-neutral-200 text-xs bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
                {userCollege}
              </span>
            </div>

            {/* Official UP Mail */}
            <div className="flex items-center justify-between py-1 border-b border-gray-50 dark:border-neutral-800/60">
              <span className="text-gray-400 dark:text-neutral-400 text-[11px] flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> UP Mail
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] text-gray-800 dark:text-neutral-200 max-w-[130px] truncate">
                  {normalizeEmail(currentUserEmail)}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(currentUserEmail, "user-email", "UP Webmail")}
                  className="text-gray-400 hover:text-brand-maroon p-0.5 rounded cursor-pointer"
                  title="Copy email"
                >
                  {copiedField === "user-email" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Contact Number */}
            <div className="flex items-center justify-between py-1 border-b border-gray-50 dark:border-neutral-800/60">
              <span className="text-gray-400 dark:text-neutral-400 text-[11px] flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Contact
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] text-gray-800 dark:text-neutral-200">
                  +63 {userContact}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(`+63 ${userContact}`, "user-contact", "contact number")}
                  className="text-gray-400 hover:text-brand-maroon p-0.5 rounded cursor-pointer"
                  title="Copy contact"
                >
                  {copiedField === "user-contact" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Alphanumeric Password */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-400 dark:text-neutral-400 text-[11px] flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-brand-maroon" /> Account Password
                </span>
                <span className="text-[9px] font-mono uppercase text-gray-400">Alphanumeric</span>
              </div>
              <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-800/80 border border-gray-200 dark:border-neutral-700 rounded-lg px-2.5 py-1.5">
                <span className="font-mono font-bold text-xs tracking-wider text-neutral-900 dark:text-neutral-100">
                  {showUserPassword ? userPin : "••••••••"}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowUserPassword(!showUserPassword)}
                    className="text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 p-0.5 rounded cursor-pointer"
                    title={showUserPassword ? "Hide" : "Show"}
                  >
                    {showUserPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(userPin, "user-pin", "password")}
                    className="text-gray-400 hover:text-brand-maroon p-0.5 rounded cursor-pointer"
                    title="Copy password"
                  >
                    {copiedField === "user-pin" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Lead/Editor view for Section Accounts */}
            {(currentUserRole === "Layout Editor" || currentUserRole === "Online Layout Head") && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowSectionRoster(!showSectionRoster)}
                  className="w-full py-1.5 px-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{showSectionRoster ? "Hide Section Passwords" : "View All 7 Section Passwords"}</span>
                </button>

                {showSectionRoster && (
                  <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {OFFICIAL_ACCOUNTS.map((acc) => (
                      <div
                        key={acc.email}
                        className="p-1.5 bg-neutral-50 dark:bg-neutral-800/60 rounded border border-gray-100 dark:border-neutral-700 flex items-center justify-between text-[10px]"
                      >
                        <div className="truncate mr-2">
                          <p className="font-bold text-neutral-800 dark:text-neutral-200 truncate">{acc.name}</p>
                          <p className="text-gray-400 font-mono">{acc.college} • +63 {acc.contact}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <code className="font-mono font-bold text-neutral-900 dark:text-neutral-100 px-1 py-0.5 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded">
                            {acc.pin}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopy(acc.pin, `roster-${acc.email}`, "password")}
                            className="p-0.5 text-gray-400 hover:text-brand-maroon cursor-pointer"
                            title="Copy"
                          >
                            {copiedField === `roster-${acc.email}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Workspace Google Drive Integration Card */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 space-y-2.5 bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center gap-2 text-[var(--color-brand-maroon)] dark:text-red-400">
            <FolderOpen className="w-4 h-4" />
            <h4 className="font-bold text-xs text-gray-900 dark:text-neutral-100">MKule '26-'27 Layout Drive</h4>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-neutral-400 leading-normal">
            Connected to official MKule Google Drive workspace repository for layout assets and issue templates.
          </p>
          <a
            href="https://drive.google.com/drive/folders/1IKOK2njjP5SO15gjxIWB-wcZfZgUW76e?usp=drive_link"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2 px-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-100 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open MKule '26-'27 Layout Drive
          </a>
        </div>
      </div>

      {/* Profile settings Panel */}
      <div className="lg:col-span-2 space-y-4 sm:space-y-6">
        <div className="glass-card rounded-2xl p-4 sm:p-6 space-y-5 sm:space-y-6 bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 shadow-sm">
          
          <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-brand-maroon dark:text-red-400" />
              <h3 className="font-display font-bold text-gray-950 dark:text-neutral-100 text-base">Workspace Configuration</h3>
            </div>
            <button
              onClick={handleResetDefaults}
              className="text-[11px] text-brand-maroon dark:text-red-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              title="Reset all settings to default"
            >
              <RefreshCw className="w-3 h-3" /> Reset Defaults
            </button>
          </div>

          <div className="space-y-5 text-xs">
            <div className="rounded-2xl border border-gray-200 dark:border-neutral-700 bg-gradient-to-br from-gray-50 via-white to-red-50 dark:from-neutral-800 dark:via-neutral-900 dark:to-red-950/30 p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-brand-maroon dark:text-red-400">
                    <Award className="w-4 h-4" />
                    <h4 className="font-bold text-xs text-gray-900 dark:text-white">Workload Tracker</h4>
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-neutral-300 mt-1">Monthly and semester workload overview</p>
                </div>
                <div className="inline-flex rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-0.5">
                  <button
                    type="button"
                    onClick={() => setStatsMode("semester")}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer ${statsMode === "semester" ? "bg-brand-maroon text-white" : "text-gray-600 dark:text-neutral-300"}`}
                  >
                    Semester
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatsMode("month")}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer ${statsMode === "month" ? "bg-brand-maroon text-white" : "text-gray-600 dark:text-neutral-300"}`}
                  >
                    Month
                  </button>
                </div>
              </div>

              {statsMode === "semester" ? (
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2.5">
                    <div className="text-[9px] uppercase text-gray-400 dark:text-neutral-400">Total</div>
                    <div className="font-black text-base text-gray-900 dark:text-white">{memberTasks.length}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2.5">
                    <div className="text-[9px] uppercase text-gray-400 dark:text-neutral-400">Completed</div>
                    <div className="font-black text-base text-emerald-600 dark:text-emerald-400">{completedWork}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2.5">
                    <div className="text-[9px] uppercase text-gray-400 dark:text-neutral-400">Active</div>
                    <div className="font-black text-base text-brand-maroon dark:text-red-400">{activeWork}</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {monthOrder.map((month) => (
                      <button
                        key={month}
                        type="button"
                        onClick={() => setSelectedMonth(month)}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer ${selectedMonth === month ? "bg-neutral-900 text-white" : "bg-white dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 border border-gray-200 dark:border-neutral-700"}`}
                      >
                        {month.slice(0, 3)}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {monthCounts.map(({ month, count }) => {
                      const width = Math.max(count * 18, count > 0 ? 16 : 4);
                      return (
                        <div key={month} className={`flex items-center gap-2 text-[10px] ${selectedMonth === month ? "text-brand-maroon dark:text-red-400" : "text-gray-600 dark:text-neutral-300"}`}>
                          <span className="w-12 shrink-0">{month.slice(0, 3)}</span>
                          <div className="h-2.5 flex-1 rounded-full bg-gray-200 dark:bg-neutral-700 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${count > 0 ? "bg-[var(--color-brand-gradient)]" : "bg-gray-200 dark:bg-neutral-700"}`}
                              style={{ width: `${Math.min(width, 100)}%` }}
                            />
                          </div>
                          <span className="w-5 text-right font-bold">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-gray-200 dark:border-neutral-700 pt-2 text-[10px] text-gray-500 dark:text-neutral-400">
                <span>Peak month</span>
                <span className="font-bold text-gray-800 dark:text-neutral-200">{peakMonth.month} • {peakMonth.count}</span>
              </div>
            </div>
            
            {/* Dark / Light Mode Selector */}
            <div className="space-y-2">
              <label className="font-semibold text-gray-700 dark:text-neutral-200 flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-500" /> Appearance & Contrast Theme
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (setDarkMode) setDarkMode(false);
                    speakText("Light mode enabled");
                  }}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                    !darkMode 
                      ? "border-brand-maroon bg-brand-cream/30 text-brand-maroon-dark font-bold shadow-xs ring-1 ring-brand-maroon/30" 
                      : "border-gray-200 dark:border-neutral-750 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-600 dark:text-neutral-400"
                  }`}
                >
                  <Sun className="w-5 h-5 text-amber-500 shrink-0" />
                  <div>
                    <span className="block font-bold text-xs text-gray-900 dark:text-neutral-100">Light Mode</span>
                    <span className="block text-[10px] text-gray-500 dark:text-neutral-400">Crisp ivory canvas with high contrast</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (setDarkMode) setDarkMode(true);
                    speakText("Dark mode enabled");
                  }}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                    darkMode 
                      ? "border-brand-maroon bg-brand-maroon/15 dark:bg-brand-maroon/30 text-brand-maroon-light dark:text-red-300 font-bold shadow-xs ring-1 ring-brand-maroon/30" 
                      : "border-gray-200 dark:border-neutral-750 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-600 dark:text-neutral-400"
                  }`}
                >
                  <Moon className="w-5 h-5 text-indigo-400 shrink-0" />
                  <div>
                    <span className="block font-bold text-xs text-gray-900 dark:text-neutral-100">Dark Mode</span>
                    <span className="block text-[10px] text-gray-500 dark:text-neutral-400">Dark canvas with legible light text</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Visual themes */}
            <div className="space-y-2 border-t pt-4 border-gray-100 dark:border-neutral-800">
              <label className="font-semibold text-gray-700 dark:text-neutral-200 flex items-center gap-2">
                <Palette className="w-4 h-4 text-brand-maroon dark:text-red-400" /> Brand Accent Color
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "maroon", label: "UP Maroon", colorClass: "bg-[#bc1700]" },
                  { id: "navy", label: "Royal Navy", colorClass: "bg-[#1E3A8A]" },
                  { id: "forest", label: "Forest Green", colorClass: "bg-[#065F46]" },
                  { id: "grape", label: "Grape Purple", colorClass: "bg-[#581C87]" }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleAccentChange(item.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                      accentTheme === item.id 
                        ? "border-brand-maroon bg-brand-cream/30 dark:bg-brand-maroon/20 text-brand-maroon-dark dark:text-red-300 font-bold ring-1 ring-brand-maroon/30" 
                        : "border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-850 text-gray-500 dark:text-neutral-400"
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${item.colorClass} shrink-0`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>

        </div>
      </div>

    </div>
  );
}
