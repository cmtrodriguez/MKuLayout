import React, { useState, useEffect } from "react";
import { Lock, CheckCircle2, AlertCircle, Key, RefreshCw, ExternalLink, ShieldCheck } from "lucide-react";
import { TeamMember, normalizeEmail } from "../types";
import { 
  isGoogleDocUrl, 
  shareGoogleDocWithMember, 
  signInWithGoogleDrive, 
  getCachedDriveToken,
  ShareResult 
} from "../lib/googleDriveShare";
import { OFFICIAL_ACCOUNTS } from "./LoginPage";

interface GoogleDocShareWidgetProps {
  docUrl: string;
  assignedMemberName: string;
  members: TeamMember[];
  onShareStatusChange?: (status: ShareResult) => void;
  className?: string;
}

export default function GoogleDocShareWidget({
  docUrl,
  assignedMemberName,
  members,
  onShareStatusChange,
  className = ""
}: GoogleDocShareWidgetProps) {
  const [status, setStatus] = useState<"idle" | "sharing" | "success" | "auth_required" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Find member email
  const member = members.find(m => m.name.toLowerCase() === assignedMemberName.toLowerCase()) ||
    OFFICIAL_ACCOUNTS.find(a => a.name.toLowerCase() === assignedMemberName.toLowerCase());

  const memberEmail = normalizeEmail(member?.email || "");
  const isValidDoc = isGoogleDocUrl(docUrl);
  const isValidMember = Boolean(assignedMemberName && assignedMemberName !== "Unassigned" && memberEmail);

  // Auto-attempt share when docUrl or assigned member changes if token is available
  useEffect(() => {
    if (isValidDoc && isValidMember) {
      if (getCachedDriveToken()) {
        handleShare();
      }
    } else {
      setStatus("idle");
      setStatusMessage("");
    }
  }, [docUrl, assignedMemberName, memberEmail]);

  const handleShare = async (force: boolean = false) => {
    if (!docUrl || !memberEmail) return;

    setStatus("sharing");
    setStatusMessage(`Granting Google Doc access to ${assignedMemberName} (${memberEmail})...`);

    const result = await shareGoogleDocWithMember(docUrl, memberEmail, assignedMemberName, "writer", force);

    if (result.success) {
      setStatus("success");
      setStatusMessage(result.message);
      if (onShareStatusChange) onShareStatusChange(result);
    } else if (result.requiresAuth) {
      setStatus("auth_required");
      setStatusMessage(result.message);
      if (onShareStatusChange) onShareStatusChange(result);
    } else {
      setStatus("error");
      setStatusMessage(result.message);
      if (onShareStatusChange) onShareStatusChange(result);
    }
  };

  const handleConnectGoogleDrive = async () => {
    setIsSigningIn(true);
    try {
      const authResult = await signInWithGoogleDrive();
      if (authResult?.accessToken) {
        // Retry sharing immediately
        await handleShare();
      }
    } catch (err: any) {
      setStatus("error");
      setStatusMessage(err?.message || "Google Drive connection failed.");
    } finally {
      setIsSigningIn(false);
    }
  };

  if (!isValidDoc || !isValidMember) {
    return null;
  }

  return (
    <div className={`p-3 rounded-xl border text-xs transition-all ${
      status === "success"
        ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
        : status === "auth_required"
        ? "bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
        : status === "error"
        ? "bg-red-50/80 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200"
        : status === "sharing"
        ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200"
        : "bg-stone-50 dark:bg-neutral-850 border-stone-200 dark:border-neutral-750 text-stone-800 dark:text-neutral-200"
    } ${className}`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {status === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />}
          {status === "auth_required" && <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />}
          {status === "error" && <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />}
          {status === "sharing" && <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin mt-0.5 shrink-0" />}
          {status === "idle" && <ShieldCheck className="w-4 h-4 text-stone-600 dark:text-neutral-400 mt-0.5 shrink-0" />}

          <div className="space-y-0.5 text-left min-w-0 flex-1">
            <div className="font-bold flex items-center gap-1.5 flex-wrap">
              <span className="text-neutral-900 dark:text-neutral-100">Google Doc Access Lock Handler</span>
              <span className="px-1.5 py-0.5 bg-white/80 dark:bg-neutral-800 border dark:border-neutral-700 rounded text-[10px] font-mono text-stone-700 dark:text-neutral-300 truncate max-w-full">
                {memberEmail}
              </span>
            </div>
            <p className="text-[11px] leading-snug text-neutral-600 dark:text-neutral-300">
              {statusMessage || `Ready to grant Google Doc writer permissions to ${assignedMemberName} (${memberEmail}).`}
            </p>
          </div>
        </div>

        <div className="shrink-0 w-full sm:w-auto mt-1 sm:mt-0">
          {status === "auth_required" ? (
            <button
              type="button"
              onClick={handleConnectGoogleDrive}
              disabled={isSigningIn}
              className="w-full sm:w-auto px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{isSigningIn ? "Connecting..." : "Authorize Google Drive"}</span>
            </button>
          ) : status === "success" ? (
            <span className="w-full sm:w-auto px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-bold rounded-md text-[10px] uppercase font-mono tracking-wider flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Access Granted
            </span>
          ) : (
            <button
              type="button"
              onClick={() => handleShare(true)}
              disabled={status === "sharing"}
              className="w-full sm:w-auto px-3 py-1.5 bg-stone-900 hover:bg-black dark:bg-neutral-800 dark:hover:bg-neutral-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs border border-transparent dark:border-neutral-600"
            >
              <Lock className="w-3.5 h-3.5 text-amber-300" />
              <span>{status === "sharing" ? "Sharing..." : "Grant Doc Access"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
