import React, { useState } from "react";
import { Lock, Mail, CheckCircle2, AlertCircle, ShieldCheck, RefreshCw, X, FileText, User } from "lucide-react";
import { TeamMember, normalizeEmail } from "../types";
import { shareGoogleDocWithMember, isGoogleDocUrl, signInWithGoogleDrive, getCachedDriveToken } from "../lib/googleDriveShare";
import { OFFICIAL_ACCOUNTS } from "./LoginPage";

interface GoogleDocConfirmModalProps {
  isOpen: boolean;
  taskTitle: string;
  docUrl: string;
  assignedMemberName: string;
  members: TeamMember[];
  onConfirm: (targetEmail: string) => Promise<void> | void;
  onCancel: () => void;
}

export function findDirectoryEmail(name: string, members: TeamMember[] = []): string {
  if (!name || name === "Unassigned") return "";
  const cleanName = name.toLowerCase().trim();
  
  // Direct or partial match in members prop
  const memberMatch = members.find(m => {
    const mName = m.name.toLowerCase().trim();
    return mName === cleanName || mName.includes(cleanName) || cleanName.includes(mName);
  });
  if (memberMatch?.email) return normalizeEmail(memberMatch.email);

  // Match in official security accounts directory
  const officialMatch = OFFICIAL_ACCOUNTS.find(a => {
    const aName = a.name.toLowerCase().trim();
    return aName === cleanName || aName.includes(cleanName) || cleanName.includes(aName);
  });
  if (officialMatch?.email) return normalizeEmail(officialMatch.email);

  return "";
}

export default function GoogleDocConfirmModal({
  isOpen,
  taskTitle,
  docUrl,
  assignedMemberName,
  members,
  onConfirm,
  onCancel
}: GoogleDocConfirmModalProps) {
  if (!isOpen) return null;

  const initialEmail = findDirectoryEmail(assignedMemberName, members);
  const [email, setEmail] = useState(initialEmail || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [requiresAuth, setRequiresAuth] = useState(false);

  const isValidDoc = isGoogleDocUrl(docUrl);

  const handleGrantAndConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMessage("Please specify or verify the directory email address.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setRequiresAuth(false);

    try {
      if (isValidDoc && email) {
        const shareRes = await shareGoogleDocWithMember(docUrl, email, assignedMemberName, "writer");
        if (!shareRes.success) {
          setErrorMessage(shareRes.message || "Failed to grant access via Google Drive API.");
          setRequiresAuth(Boolean(shareRes.requiresAuth));
          setIsSubmitting(false);
          return;
        }
      }

      await onConfirm(email);
    } catch (err: any) {
      setErrorMessage(err?.message || "An error occurred while granting Google Doc permissions.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProceedWithoutDriveShare = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(email);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAuthorizeDrive = async () => {
    setIsSigningIn(true);
    setErrorMessage("");
    try {
      const auth = await signInWithGoogleDrive();
      if (auth?.accessToken) {
        setRequiresAuth(false);
        // Automatically proceed after sign-in
        const shareRes = await shareGoogleDocWithMember(docUrl, email, assignedMemberName, "writer");
        if (shareRes.success) {
          await onConfirm(email);
        } else {
          setErrorMessage(shareRes.message);
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Google Drive sign in failed.");
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden text-left flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-stone-900 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400 border border-amber-400/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-stone-100 leading-tight">
                Confirm Private Google Doc Access
              </h3>
              <p className="text-stone-400 text-xs">
                Send document permissions & email invite to assigned layout staff
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-stone-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleGrantAndConfirm} className="p-5 space-y-4 overflow-y-auto text-xs text-stone-700">
          {/* Assignment Context Banner */}
          <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-2">
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-brand-maroon mt-0.5 shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-wider">Assignment Title</span>
                <span className="font-bold text-stone-900 text-sm leading-snug">{taskTitle}</span>
              </div>
            </div>

            {docUrl && (
              <div className="pt-2 border-t border-stone-200/80 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-stone-500">Document Link:</span>
                <a
                  href={docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-brand-maroon hover:underline font-bold truncate max-w-[240px]"
                >
                  {docUrl}
                </a>
              </div>
            )}
          </div>

          {/* Assigned Person & Email */}
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-amber-50/70 border border-amber-200/80 p-3 rounded-xl">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-amber-700" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-800/70 block">Assigned Layout Staff</span>
                  <span className="font-extrabold text-amber-950 text-sm">{assignedMemberName}</span>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-amber-200/60 text-amber-900 text-[10px] font-bold uppercase rounded font-mono">
                Editor Access
              </span>
            </div>

            {/* Email Field derived from directory */}
            <div className="space-y-1">
              <label className="font-bold text-stone-800 block flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-stone-600" />
                  <span>Directory Email Address</span>
                </span>
                {initialEmail && (
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Verified Directory Match
                  </span>
                )}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(normalizeEmail(e.target.value))}
                placeholder="staff.email@up.edu.ph"
                className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl font-mono text-xs text-stone-900 outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all shadow-2xs"
              />
              <p className="text-[11px] text-stone-500 leading-normal">
                Google Drive will send an automated invitation email with writer/editing permissions directly to this address.
              </p>
            </div>
          </div>

          {/* Error / Auth Required Notice */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-950 flex items-start gap-2 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <p className="font-medium text-amber-900">{errorMessage}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleAuthorizeDrive}
                    disabled={isSigningIn}
                    className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{isSigningIn ? "Connecting Google..." : "Authorize Google Drive Now"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleProceedWithoutDriveShare}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold rounded-lg text-xs transition-all cursor-pointer"
                  >
                    Confirm Assignment Anyway
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer Buttons */}
          <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2.5 border border-stone-300 text-stone-700 font-semibold hover:bg-stone-100 rounded-xl transition-all cursor-pointer text-xs"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !email}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer text-xs disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Granting Access & Sending Email...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Send Doc Access to Email</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
