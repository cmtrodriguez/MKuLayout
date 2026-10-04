import React, { useRef, useState } from "react";
import { 
  CheckSquare, Link, Clock, Plus, Award, ClipboardList, ShieldCheck, 
  XCircle, Sparkles, AlertCircle, MessageCircle, FileDown, ExternalLink,
  ChevronRight, Calendar, User, Eye, Play, BookOpen, Search, Folder, LayoutGrid, CheckCircle, Send,
  Lock, ShieldAlert, ImagePlus, X, Pencil, Trash2
} from "lucide-react";
import { Task, TeamMember, TaskComment, UserRole } from "../types";
import { extractHyperlinkDetails, isOnlinePubmatTask } from "../lib/canvaTemplates";
import { compressCommentImage, formatCommentDetails, handleBulletKeyDown, MAX_COMMENT_IMAGES, RenderFormattedComment } from "../lib/commentUtils";
import { isUserAssignedToTask, resolveMemberEmail, getEditorDeputyEmails } from "../lib/memberUtils";
import CommentImageAnnotator from "./CommentImageAnnotator";

// ==========================================
// 1. LAYOUT STAFF DASHBOARD
// ==========================================
interface LayoutStaffDashboardProps {
  tasks: Task[];
  currentUserEmail: string;
  currentUserName: string;
  speechEnabled: boolean;
  onUpdateTask: (task: Task) => void;
  onAddComment: (commentText: string, taskId: string, images?: string[]) => void;
  onUpdateComment: (comment: TaskComment) => Promise<boolean>;
  onRemoveComment: (comment: TaskComment) => Promise<boolean>;
  comments?: TaskComment[];
  onAddNotification: (title: string, message: string, type: 'info' | 'assignment' | 'deadline' | 'revision' | 'poll' | 'birthday', targetEmails?: string[]) => void;
}

export function LayoutStaffDashboard({
  tasks,
  currentUserEmail,
  currentUserName,
  speechEnabled,
  onUpdateTask,
  onAddComment,
  onUpdateComment,
  onRemoveComment,
  comments = [],
  onAddNotification,
}: LayoutStaffDashboardProps) {
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentImages, setCommentImages] = useState<Record<string, string[]>>({});
  const [preparingCommentImages, setPreparingCommentImages] = useState<Record<string, boolean>>({});
  const [commentImageErrors, setCommentImageErrors] = useState<Record<string, string>>({});
  const commentImageInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null);
  const [commentActionError, setCommentActionError] = useState("");

  const speakText = (text: string) => {
    if (!speechEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  };

  const handleSendTaskComment = (taskId: string) => {
    const text = commentInputs[taskId]?.trim();
    const images = commentImages[taskId] || [];
    if ((!text && images.length === 0) || preparingCommentImages[taskId]) return;
    onAddComment(text || "", taskId, images);
    setCommentInputs(prev => ({ ...prev, [taskId]: "" }));
    setCommentImages(prev => ({ ...prev, [taskId]: [] }));
    setCommentImageErrors(prev => ({ ...prev, [taskId]: "" }));
    speakText("Comment sent to editor.");
  };

  const handleSelectTaskCommentImages = async (taskId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = "";
    const currentImages = commentImages[taskId] || [];
    const availableSlots = MAX_COMMENT_IMAGES - currentImages.length;
    if (files.length === 0) return;
    if (availableSlots <= 0) {
      setCommentImageErrors(prev => ({ ...prev, [taskId]: "A message can include up to 5 pictures." }));
      return;
    }

    setPreparingCommentImages(prev => ({ ...prev, [taskId]: true }));
    let errorMessage = files.length > availableSlots ? "Only 5 pictures can be attached to one message." : "";
    const preparedImages: string[] = [];
    for (const file of files.slice(0, availableSlots)) {
      try {
        preparedImages.push(await compressCommentImage(file));
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "Could not add this image.";
      }
    }
    setCommentImages(prev => ({ ...prev, [taskId]: [...(prev[taskId] || []), ...preparedImages].slice(0, MAX_COMMENT_IMAGES) }));
    setCommentImageErrors(prev => ({ ...prev, [taskId]: errorMessage }));
    setPreparingCommentImages(prev => ({ ...prev, [taskId]: false }));
  };

  const handleSaveComment = async (comment: TaskComment) => {
    const updatedText = editCommentText.trim();
    if (!updatedText && !comment.images?.length) {
      setCommentActionError("A message needs text or an attached picture.");
      return;
    }
    setSavingCommentId(comment.id);
    setCommentActionError("");
    const saved = await onUpdateComment({ ...comment, text: updatedText, editedAt: new Date().toISOString() });
    setSavingCommentId(null);
    if (saved) setEditingCommentId(null);
    else setCommentActionError("Could not save the edit. Try again.");
  };

  const handleRemoveComment = async (comment: TaskComment) => {
    if (!window.confirm("Remove this message? It will remain in the record as removed.")) return;
    setSavingCommentId(comment.id);
    setCommentActionError("");
    const saved = await onRemoveComment(comment);
    setSavingCommentId(null);
    if (!saved) setCommentActionError("Could not remove the message. Try again.");
  };

  // Completed and shelved assignments are hidden from the active "My Assignments" list.
  const isDoneTask = (t: Task) =>
    t.progress === "Completed" || t.progress === "Approved" || t.progress === "Archived" || t.progress === "Shelved";

  const myTasks = tasks.filter(t =>
    !t.isPendingConfirmation && !isDoneTask(t) && isUserAssignedToTask(t, currentUserName, currentUserEmail)
  );
  const issueTasks = myTasks.filter(t =>
    t.typeOfRelease === "Issue Article" || (!!t.sourceIssueRowId && t.typeOfRelease !== "Online Article" && !/\(Online Pubmat\)$/i.test(t.title))
  );
  const onlineTasks = myTasks.filter(t => !issueTasks.some(issue => issue.id === t.id));

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* Overview stats for layout staff */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-3 sm:gap-6">
        <div className="glass-card rounded-xl sm:rounded-2xl p-3.5 sm:p-5 space-y-2 sm:space-y-2 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="p-1 sm:p-2 bg-brand-maroon/10 text-brand-maroon rounded-lg">
              <ClipboardList className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <h3 className="font-display font-bold text-gray-900 text-xs sm:text-sm">Personal Workload</h3>
          </div>
          <div className="pt-0.5 sm:pt-2">
            <h4 className="text-xl sm:text-3xl font-display font-black text-gray-900">{myTasks.length}</h4>
            <p className="text-[9px] sm:text-[11px] text-gray-400">{issueTasks.length} issue · {onlineTasks.length} online pubmat</p>
          </div>
        </div>

        <div className="glass-card rounded-xl sm:rounded-2xl p-3.5 sm:p-5 space-y-2 sm:space-y-2 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="p-1 sm:p-2 bg-green-500/10 text-green-600 rounded-lg">
              <CheckSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <h3 className="font-display font-bold text-gray-900 text-xs sm:text-sm">Pending Reviews</h3>
          </div>
          <div className="pt-0.5 sm:pt-2">
            <h4 className="text-xl sm:text-3xl font-display font-black text-gray-900">
              {myTasks.filter(t => t.progress === "For Review").length}
            </h4>
            <p className="text-[9px] sm:text-[11px] text-gray-400">Layout drafts under critique</p>
          </div>
        </div>
      </div>

      {/* Main Worklist */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center gap-1.5 border-b pb-1 sm:pb-2 border-gray-100">
          <ClipboardList className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-maroon" />
          <h3 className="font-display font-bold text-gray-900 text-xs sm:text-sm">My Assignments</h3>
          <span className="text-[10px] text-gray-400 font-medium">Issue layouts and online pubmats assigned to you</span>
        </div>

        {myTasks.length === 0 ? (
          <div className="bg-white/50 border border-gray-100 rounded-xl sm:rounded-2xl p-4 sm:p-8 text-center text-gray-500 text-xs space-y-1">
            <p className="font-bold text-gray-700">No active design assignments found.</p>
            <p>You can check the general schedule in the table or sync spreadsheets if a new row was added.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:gap-5">
            {myTasks.map(task => {
              const isRevision = task.progress === "Revision Needed";
              const isForReview = task.progress === "For Review";
              const isApproved = task.progress === "Approved";
              const isCompleted = task.progress === "Completed";
              
              const taskComments = comments.filter(c => c.taskId === task.id);
              const revisionComments = taskComments.filter(c => 
                c.text.toUpperCase().includes("REVISION") || 
                c.text.toUpperCase().includes("CRITIQUE") ||
                c.authorName.toLowerCase().includes("editor") ||
                c.authorName.toLowerCase().includes("eic")
              );
              
              return (
                <div 
                  key={task.id} 
                  className={`rounded-xl sm:rounded-2xl p-3.5 sm:p-6 border transition-all space-y-3.5 sm:space-y-4 hover:shadow-md ${
                    isRevision ? "border-red-300 bg-red-50/20 shadow-sm" : 
                    isForReview ? "border-purple-200 bg-purple-50/10" :
                    isApproved || isCompleted ? "border-emerald-200 bg-emerald-50/10" :
                    "border-gray-200 bg-white"
                  }`}
                >
                  {/* Header: Title & Status Badges */}
                  <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3 pb-2 sm:pb-3 border-b border-gray-100">
                    <div className="space-y-0.5 sm:space-y-1 text-left">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="text-[9px] sm:text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-brand-maroon/10 text-brand-maroon">
                          {task.typeOfRelease}
                        </span>
                        <span className="text-[11px] sm:text-xs text-gray-500 font-medium">Priority: <strong className="text-gray-800">{task.priority}</strong></span>
                        <span className="text-[11px] sm:text-xs text-gray-500 font-medium">• Target: <strong className="text-gray-800">{task.releaseDate}</strong></span>
                      </div>
                      <h4 className="font-bold text-gray-900 text-sm sm:text-base leading-snug">{task.title}</h4>
                    </div>

                    {task.progress !== "For Review" && task.progress !== "Approved" && task.progress !== "Completed" ? (
                      <button
                        onClick={() => {
                          const updated = { ...task, progress: "For Review" as const, lastUpdated: new Date().toISOString() };
                          onUpdateTask(updated);
                          onAddNotification(
                            "Draft Submitted",
                            `${currentUserName} submitted '${task.title}' for review.`,
                            "info",
                            getEditorDeputyEmails()
                          );
                          speakText(`Draft layout for ${task.title} submitted for review.`);
                        }}
                        className="px-3 py-1 sm:px-4 sm:py-1.5 bg-brand-maroon hover:bg-brand-maroon-dark text-white text-[11px] sm:text-xs font-bold rounded-full transition-all shadow-sm cursor-pointer flex items-center gap-1.5 shrink-0"
                      >
                        <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300" />
                        <span>Mark Accomplished</span>
                      </button>
                    ) : (
                      <span className={`text-[11px] sm:text-xs font-bold px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full ${
                        task.progress === "Completed" ? "bg-green-100 text-green-700" :
                        task.progress === "Approved" ? "bg-emerald-100 text-emerald-700" :
                        "bg-purple-100 text-purple-700"
                      }`}>
                        {task.progress}
                      </span>
                    )}
                  </div>

                  {/* Highlighted Revision Alert Banner */}
                  {isRevision && (
                    <div className="p-2.5 sm:p-3.5 bg-gradient-to-r from-red-50 to-amber-50 border border-red-200/90 rounded-lg sm:rounded-xl flex items-start gap-2 sm:gap-3 text-left shadow-2xs">
                      <AlertCircle className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-red-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-bold text-red-800 text-[10px] sm:text-[11px] uppercase tracking-wider flex items-center gap-1">
                            Revision Requested by Layout Editor / EIC
                          </span>
                          <span className="text-[9px] sm:text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full border border-red-200 shrink-0">
                            Action Needed
                          </span>
                        </div>
                        <div className="text-[11px] sm:text-xs text-neutral-800 leading-relaxed font-medium">
                          {revisionComments.length > 0 ? (
                            <RenderFormattedComment 
                              text={formatCommentDetails(revisionComments[revisionComments.length - 1]).cleanedText} 
                              isEditorRole={true} 
                            />
                          ) : (
                            "The Layout Editor has requested revisions on your design layout. Please review comments below, update your draft on Canva/Drive, and click 'Mark Accomplished' when ready."
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Direct Link Action Cards Row (3 Clean Buttons, always one row) */}
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3">
                    {/* 1. ArtX Writer Draft Link */}
                    {(() => {
                      const docRaw = task.draftLink || task.addedToLayout || task.writeup || "";
                      const details = extractHyperlinkDetails(docRaw);
                      const hasDocUrl = details.url && (details.url.startsWith("http://") || details.url.startsWith("https://") || details.url.includes("docs.google.com"));
                      
                      return hasDocUrl ? (
                        <a
                          href={details.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-2.5 sm:p-3 bg-red-50/80 hover:bg-red-100 border border-red-200/80 rounded-lg sm:rounded-xl transition-all group cursor-pointer"
                        >
                          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-maroon shrink-0" />
                            <div className="min-w-0 text-left">
                              <span className="block text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-brand-maroon">ArtX Writer Draft</span>
                              <span className="block text-[11px] sm:text-xs font-semibold text-gray-900 truncate">{details.label || "Open Writer Document"}</span>
                            </div>
                          </div>
                          <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-brand-maroon group-hover:translate-x-0.5 transition-transform shrink-0" />
                        </a>
                      ) : (
                        <div className="flex items-center gap-2 sm:gap-2.5 p-2 sm:p-3 bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl text-gray-400 text-xs">
                          <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                          <span className="font-medium text-[10px] sm:text-[11px]">No Writer Draft Attached</span>
                        </div>
                      );
                    })()}

                    {/* 2. Assigned Canva Design Link */}
                    {(() => {
                      const canvaRaw = task.canvaLink || "";
                      const details = extractHyperlinkDetails(canvaRaw);
                      const hasCanva = details.url && details.url.startsWith("http");

                      return hasCanva ? (
                        <a
                          href={details.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-2.5 sm:p-3 bg-cyan-50/80 hover:bg-cyan-100 border border-cyan-200/80 rounded-lg sm:rounded-xl transition-all group cursor-pointer"
                        >
                          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                            <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-700 shrink-0" />
                            <div className="min-w-0 text-left">
                              <span className="block text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-cyan-700">Assigned Canva Link</span>
                              <span className="block text-[11px] sm:text-xs font-semibold text-cyan-900 truncate">{details.label || "Open Canva Design"}</span>
                            </div>
                          </div>
                          <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                        </a>
                      ) : (
                        <div className="flex items-center gap-2 sm:gap-2.5 p-2 sm:p-3 bg-gray-50 border border-dashed border-gray-200 rounded-lg sm:rounded-xl text-gray-400 text-xs">
                          <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                          <span className="font-medium text-[10px] sm:text-[11px]">No Canva Link Assigned</span>
                        </div>
                      );
                    })()}

                    {/* Medium Canva Design Link */}
                    {isOnlinePubmatTask(task.typeOfRelease, task.title) && (() => {
                      const mediumCanva = extractHyperlinkDetails(task.mediumCanvaLink || "");
                      const hasMediumCanva = mediumCanva.url && mediumCanva.url.startsWith("http");

                      return hasMediumCanva ? (
                        <a
                          href={mediumCanva.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-2.5 sm:p-3 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/80 rounded-lg sm:rounded-xl transition-all group cursor-pointer"
                        >
                          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                            <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-700 shrink-0" />
                            <div className="min-w-0 text-left">
                              <span className="block text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-blue-700">Medium Canva Link</span>
                              <span className="block text-[11px] sm:text-xs font-semibold text-blue-900 truncate">{mediumCanva.label || "Open Medium Canva"}</span>
                            </div>
                          </div>
                          <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                        </a>
                      ) : (
                        <div className="flex items-center gap-2 sm:gap-2.5 p-2 sm:p-3 bg-gray-50 border border-dashed border-gray-200 rounded-lg sm:rounded-xl text-gray-400 text-xs">
                          <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                          <span className="font-medium text-[10px] sm:text-[11px]">No Medium Canva Link</span>
                        </div>
                      );
                    })()}

                    {/* 3. Pubmat / Drive Link */}
                    {(() => {
                      const pubmatRaw = task.pubmatLink || "";
                      const details = extractHyperlinkDetails(pubmatRaw);
                      const hasDrive = details.url && details.url.startsWith("http");

                      return hasDrive ? (
                        <a
                          href={details.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-2.5 sm:p-3 bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg sm:rounded-xl transition-all group cursor-pointer"
                        >
                          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                            <Folder className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700 shrink-0" />
                            <div className="min-w-0 text-left">
                              <span className="block text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-emerald-700">Pubmat / Drive Link</span>
                              <span className="block text-[11px] sm:text-xs font-semibold text-emerald-900 truncate">{details.label || "Open Drive Folder"}</span>
                            </div>
                          </div>
                          <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                        </a>
                      ) : (
                        <div className="flex items-center gap-2 sm:gap-2.5 p-2 sm:p-3 bg-gray-50 border border-dashed border-gray-200 rounded-lg sm:rounded-xl text-gray-400 text-xs">
                          <Folder className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                          <span className="font-medium text-[10px] sm:text-[11px]">No Drive Link Set</span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Editorial Comments & Discussion Section */}
                  <div className="pt-2 sm:pt-3 border-t border-gray-100 space-y-2 sm:space-y-3 text-left">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                        <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-maroon" />
                        <span>Comments & Revisions ({taskComments.length})</span>
                      </div>
                      {taskComments.length > 0 && (
                        <span className="text-[9px] sm:text-[10px] text-gray-400">
                          Latest by {taskComments[taskComments.length - 1].authorName}
                        </span>
                      )}
                    </div>

                    {taskComments.length === 0 ? (
                      <p className="text-[11px] sm:text-xs text-gray-400 italic bg-gray-50/50 p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-gray-100">
                        No comments recorded yet. When the Layout Editor or EIC reviews your layout, their feedback will appear here.
                      </p>
                    ) : (
                      <div className="space-y-1.5 sm:space-y-2.5 max-h-52 sm:max-h-60 overflow-y-auto pr-1">
                        {taskComments.map((c) => {
                          const { cleanedText, roleLabel, badgeStyle, initials } = formatCommentDetails(c);
                          const isEditorRole = roleLabel.includes("Editor") || roleLabel.includes("EIC") || roleLabel.includes("Head");

                          return (
                            <div 
                              key={c.id} 
                              className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border text-[11px] sm:text-xs leading-relaxed space-y-1.5 sm:space-y-2 transition-all ${
                                isEditorRole 
                                  ? "bg-amber-50/60 border-amber-200/80 text-amber-950 shadow-2xs" 
                                  : "bg-white border-gray-200/80 text-gray-800 shadow-2xs"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                  <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full font-black text-[9px] sm:text-[10px] flex items-center justify-center shrink-0 ${
                                    isEditorRole ? "bg-amber-900 text-amber-100" : "bg-neutral-800 text-neutral-100"
                                  }`}>
                                    {initials}
                                  </div>
                                  <span className="font-bold text-gray-900 text-[11px] sm:text-xs">{c.authorName}</span>
                                  <span className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${badgeStyle}`}>
                                    {roleLabel}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] sm:text-[10px] text-gray-400 font-mono shrink-0">
                                    {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                                  </span>
                                  {currentUserEmail && c.authorEmail?.trim().toLowerCase() === currentUserEmail.trim().toLowerCase() && !c.removedAt && (
                                    <span className="flex items-center gap-0.5">
                                      <button
                                        type="button"
                                        onClick={() => { setEditingCommentId(c.id); setEditCommentText(c.text); setCommentActionError(""); }}
                                        disabled={savingCommentId === c.id}
                                        className="p-1 text-neutral-500 hover:text-brand-maroon rounded cursor-pointer disabled:opacity-40"
                                        aria-label="Edit your message"
                                        title="Edit message"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveComment(c)}
                                        disabled={savingCommentId === c.id}
                                        className="p-1 text-neutral-500 hover:text-rose-600 rounded cursor-pointer disabled:opacity-40"
                                        aria-label="Remove your message"
                                        title="Remove message"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </span>
                                  )}
                                </div>
                              </div>
                              {c.removedAt ? (
                                <p className="pl-6 sm:pl-8 italic text-neutral-400">Message removed</p>
                              ) : editingCommentId === c.id ? (
                                <div className="pl-6 sm:pl-8 space-y-2">
                                  <textarea
                                    value={editCommentText}
                                    onChange={(event) => setEditCommentText(event.target.value)}
                                    rows={3}
                                    className="w-full px-2.5 py-2 border border-neutral-200 rounded-lg bg-white text-xs text-neutral-800 outline-none focus:ring-2 focus:ring-brand-maroon resize-y"
                                    aria-label="Edit your message"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button type="button" onClick={() => setEditingCommentId(null)} className="px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-100 rounded-md cursor-pointer">Cancel</button>
                                    <button type="button" onClick={() => handleSaveComment(c)} disabled={savingCommentId === c.id} className="px-2.5 py-1 text-xs font-semibold bg-brand-maroon text-white rounded-md cursor-pointer disabled:opacity-50">{savingCommentId === c.id ? "Saving…" : "Save"}</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="pl-6 sm:pl-8">
                                  <RenderFormattedComment text={cleanedText} isEditorRole={isEditorRole} />
                                  {c.editedAt && <span className="mt-1 block text-[9px] text-neutral-400 italic">Edited</span>}
                                </div>
                              )}
                              {!c.removedAt && c.images && c.images.length > 0 && (
                                <div className="pl-6 sm:pl-8 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {c.images.slice(0, MAX_COMMENT_IMAGES).map((image, imageIndex) => (
                                    <div key={`${c.id}-${imageIndex}`} className="aspect-square overflow-hidden rounded-lg border border-gray-200 bg-neutral-100">
                                      <CommentImageAnnotator image={image} allowAnnotation={false} label={`View picture ${imageIndex + 1}`} />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {commentActionError && <p role="alert" className="text-[10px] text-rose-600">{commentActionError}</p>}

                    {/* Inline Reply/Comment Input */}
                    <div className="space-y-1 pt-1">
                      <input
                        ref={(element) => { commentImageInputs.current[task.id] = element; }}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        onChange={(event) => handleSelectTaskCommentImages(task.id, event)}
                        className="hidden"
                        aria-label="Choose pictures to attach"
                      />
                      {(commentImages[task.id] || []).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {(commentImages[task.id] || []).map((image, imageIndex) => (
                            <div key={image} className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-200">
                              <CommentImageAnnotator
                                image={image}
                                label={`Annotate picture ${imageIndex + 1}`}
                                onSave={(annotatedImage) => setCommentImages(prev => ({
                                  ...prev,
                                  [task.id]: (prev[task.id] || []).map((item, index) => index === imageIndex ? annotatedImage : item),
                                }))}
                              />
                              <button
                                type="button"
                                onClick={() => setCommentImages(prev => ({ ...prev, [task.id]: (prev[task.id] || []).filter((_, index) => index !== imageIndex) }))}
                                className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/70 text-white cursor-pointer"
                                aria-label={`Remove picture ${imageIndex + 1}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          <span className="self-center text-[10px] text-gray-500">{commentImages[task.id].length}/{MAX_COMMENT_IMAGES}</span>
                        </div>
                      )}
                      {(commentImageErrors[task.id] || preparingCommentImages[task.id]) && (
                        <p role={commentImageErrors[task.id] ? "alert" : "status"} className="text-[10px] text-rose-600">
                          {preparingCommentImages[task.id] ? "Preparing pictures…" : commentImageErrors[task.id]}
                        </p>
                      )}
                      <div className="flex items-start gap-1.5 sm:gap-2">
                        <textarea
                          placeholder="Reply to editor... (Enter for new line)"
                          className="flex-1 px-2.5 py-1.5 sm:px-3 sm:py-2 border border-gray-200 rounded-lg sm:rounded-xl text-[11px] sm:text-xs outline-none focus:ring-1 focus:ring-brand-maroon bg-white resize-none"
                          rows={2}
                          value={commentInputs[task.id] || ""}
                          onChange={(e) => setCommentInputs({ ...commentInputs, [task.id]: e.target.value })}
                          onKeyDown={(e) => {
                            handleBulletKeyDown(
                              e,
                              commentInputs[task.id] || "",
                              (v) => setCommentInputs({ ...commentInputs, [task.id]: v }),
                              () => handleSendTaskComment(task.id)
                            );
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => commentImageInputs.current[task.id]?.click()}
                          disabled={preparingCommentImages[task.id] || (commentImages[task.id] || []).length >= MAX_COMMENT_IMAGES}
                          className="p-2 border border-gray-200 bg-white text-gray-600 hover:text-brand-maroon rounded-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer self-stretch"
                          aria-label={`Attach pictures (${(commentImages[task.id] || []).length} of ${MAX_COMMENT_IMAGES})`}
                          title={`Attach pictures (${(commentImages[task.id] || []).length}/${MAX_COMMENT_IMAGES})`}
                        >
                          <ImagePlus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleSendTaskComment(task.id)}
                          disabled={preparingCommentImages[task.id] || (!(commentInputs[task.id] || "").trim() && (commentImages[task.id] || []).length === 0)}
                          className="px-2.5 py-2 sm:px-3.5 sm:py-2.5 bg-neutral-900 hover:bg-black text-white text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl transition-all shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs self-stretch disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300" />
                          <span className="hidden sm:inline">Post Comment</span>
                          <span className="sm:hidden">Send</span>
                        </button>
                      </div>
                      <div className="text-[9px] sm:text-[10px] text-gray-400 font-medium text-left">
                        Press <kbd className="px-1 py-0.2 bg-gray-100 border rounded text-[8px] sm:text-[9px]">Enter</kbd> for new line, <kbd className="px-1 py-0.2 bg-gray-100 border rounded text-[8px] sm:text-[9px]">- </kbd> for bullets.
                      </div>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

// ==========================================
// 2. EDITOR-IN-CHIEF DASHBOARD
// ==========================================
interface EicDashboardProps {
  tasks: Task[];
  speechEnabled: boolean;
  onUpdateTask: (task: Task) => void;
  onAddComment: (commentText: string, taskId: string) => void;
  comments: TaskComment[];
  onAddNotification?: (title: string, message: string, type: 'info' | 'assignment' | 'deadline' | 'revision' | 'poll' | 'birthday', targetEmails?: string[]) => void;
  currentUserRole?: UserRole;
  currentUserName?: string;
  currentUserEmail?: string;
}

export function EicDashboard({
  tasks,
  speechEnabled,
  onUpdateTask,
  onAddComment,
  comments,
  onAddNotification,
  currentUserRole,
  currentUserName,
  currentUserEmail,
}: EicDashboardProps) {
  const [selectedReviewTaskId, setSelectedReviewTaskId] = useState<string | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<"review" | "pipeline">("review");
  const [pipelineSearch, setPipelineSearch] = useState("");

  const isEditorOrDeputy = currentUserRole === "Layout Editor" || currentUserRole === "Layout Deputy" || currentUserRole === "Online Layout Head";

  const speakText = (text: string) => {
    if (!speechEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  };

  if (!isEditorOrDeputy) {
    return (
      <div className="bg-white rounded-3xl p-8 sm:p-12 border border-neutral-200/80 shadow-sm text-center space-y-4 max-w-md mx-auto my-8 animate-fade-in text-left">
        <div className="w-14 h-14 bg-red-50 text-brand-maroon rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <Lock className="w-7 h-7" />
        </div>
        <div className="space-y-1.5 text-center">
          <h3 className="font-display font-black text-gray-900 text-lg">
            Review Submissions Restricted
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Only the <strong>Layout Editor</strong> and <strong>Layout Deputy</strong> can view submitted progress for review and add comments.
          </p>
        </div>
        <p className="text-[11px] text-gray-500 bg-neutral-50 p-3.5 rounded-xl border border-neutral-200/70 text-center leading-normal">
          You can view editorial critique and comments directly on your own submitted assignments under the <strong>My Assignments</strong> tab.
        </p>
      </div>
    );
  }

  // Filter tasks requiring inspection review — only those actually submitted for review
  const reviewTasks = tasks.filter(t => t.progress === "For Review");

  const handleApprove = (task: Task) => {
    const isLayoutEditor = currentUserRole === "Layout Editor";
    const updated: Task = {
      ...task,
      progress: "Approved",
      lastUpdated: new Date().toISOString()
    };
    onUpdateTask(updated);
    
    const approvalComment = "Approved layout design. Excellent proportions, colors, and font tracking. Locked for publication release.";
    onAddComment(approvalComment, task.id);
    
    if (onAddNotification) {
      const assigneeEmail = task.assigneeEmail || resolveMemberEmail(task.illusLayout);
      onAddNotification(
        isLayoutEditor ? "Layout Approved" : "Layout Approved",
        `Your layout '${task.title}' was approved and locked for publication.`,
        "assignment",
        assigneeEmail ? [assigneeEmail] : undefined
      );
    }
    setSelectedReviewTaskId(null);
    speakText(`Layout ${task.title} approved for publication release!`);
  };

  const handleRequestRevision = (task: Task) => {
    if (!revisionFeedback.trim()) {
      speakText("Please write constructive revision notes before requesting layout changes.");
      return;
    }
    const updated: Task = {
      ...task,
      progress: "Revision Needed",
      lastUpdated: new Date().toISOString()
    };
    onUpdateTask(updated);
    
    const isLayoutEditor = currentUserRole === "Layout Editor";
    onAddComment(revisionFeedback.trim(), task.id);
    
    if (onAddNotification) {
      const assigneeEmail = task.assigneeEmail || resolveMemberEmail(task.illusLayout);
      onAddNotification(
        "Revision Requested",
        `${isLayoutEditor ? "The layout editor" : "The EIC"} requested revisions on '${task.title}'. Check 'My Assignments'.`,
        "revision",
        assigneeEmail ? [assigneeEmail] : undefined
      );
    }
    
    setRevisionFeedback("");
    setSelectedReviewTaskId(null);
    speakText(`Revision request submitted for ${task.title}. Assigned artist notified.`);
  };

  // Filter all tasks for the Oversight pipeline tab
  const filteredPipelineTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(pipelineSearch.toLowerCase()) ||
    t.illusLayout.toLowerCase().includes(pipelineSearch.toLowerCase()) ||
    t.writer.toLowerCase().includes(pipelineSearch.toLowerCase())
  );

  return (
    <div className="space-y-3 sm:space-y-6">
      
      {/* Overview */}
      <div className="bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-brand-maroon/5 shadow-sm text-left">
        <h2 className="font-display font-bold text-gray-900 text-sm sm:text-lg flex items-center gap-1.5 sm:gap-2">
          <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-brand-maroon" />
          {currentUserRole === "Layout Editor" ? "Layout Editorial Review Desk" : "Publication Oversight Desk (EIC Dashboard)"}
        </h2>
        <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
          {currentUserRole === "Layout Editor"
            ? "As Layout Editor, review submitted design drafts from layout staff, verify Canva elements, suggest revisions, or sign off and approve for release."
            : "As Publication Editor-in-Chief, review layout submissions, verify margins/contrast ratios, request structural revisions, or oversee the entire publication pipeline from draft to final lock."
          }
        </p>
      </div>

      {/* Sub-tab selection row */}
      <div className="flex gap-1.5 sm:gap-2 border-b border-gray-100 pb-1 text-left">
        <button
          onClick={() => {
            setActiveSubTab("review");
            speakText("Showing layout submissions requiring inspection");
          }}
          className={`px-2.5 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeSubTab === "review" 
              ? "border-brand-maroon text-brand-maroon font-black" 
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          Pending Review ({reviewTasks.length})
        </button>
        <button
          onClick={() => {
            setActiveSubTab("pipeline");
            speakText("Showing publication pipeline oversight hub");
          }}
          className={`px-2.5 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeSubTab === "pipeline" 
              ? "border-brand-maroon text-brand-maroon font-black" 
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          Pipeline Oversight ({tasks.length})
        </button>
      </div>

      {activeSubTab === "review" ? (
        <div className="space-y-3 sm:space-y-4">

          {/* Submissions requiring check */}
          <div className="space-y-3 sm:space-y-4 text-left">
            <div className="flex items-center gap-1.5 border-b pb-1 sm:pb-2 border-gray-100">
              <ClipboardList className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-brand-maroon" />
              <h3 className="font-display font-bold text-gray-950 text-xs sm:text-sm">Design Layouts Requiring Inspection</h3>
            </div>

            {reviewTasks.length === 0 ? (
              <div className="bg-white/50 border border-gray-100 rounded-xl sm:rounded-2xl p-4 sm:p-8 text-center text-gray-500 text-xs">
                <p className="font-bold text-gray-700">All submissions up to date!</p>
                <p className="mt-1">No layout drafts are currently pending editorial review.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-5 items-start">
                {reviewTasks.map(task => {
                  const isSelected = selectedReviewTaskId === task.id;
                  return (
                    <div 
                      key={task.id} 
                      className={`p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border transition-all cursor-pointer space-y-3 sm:space-y-4 bg-white ${
                        isSelected ? "border-brand-maroon shadow-md" : "border-gray-100 hover:border-brand-maroon/15"
                      }`}
                      onClick={() => {
                        setSelectedReviewTaskId(task.id);
                        speakText(`Inspecting layout files for ${task.title}`);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 sm:gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <span className="text-[9px] sm:text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-brand-maroon/5 text-brand-maroon">
                              {task.typeOfRelease}
                            </span>
                            <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              task.progress === "For Review" ? "bg-purple-100 text-purple-700" : "bg-rose-100 text-rose-700"
                            }`}>
                              {task.progress}
                            </span>
                          </div>
                          <h4 className="font-bold text-gray-900 text-xs sm:text-sm mt-1 sm:mt-1.5">{task.title}</h4>
                          <p className="text-[9px] sm:text-[10px] text-gray-400 font-mono">Artist: {task.illusLayout}</p>
                          {task.canvaLink && (
                            <p className="text-[9px] sm:text-[10px] text-cyan-600 font-medium mt-0.5 sm:mt-1 max-w-full">
                              Canva: <a href={task.canvaLink} target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-cyan-800 break-all">{task.canvaLink}</a>
                            </p>
                          )}
                          {task.pubmatLink && (
                            <p className="text-[9px] sm:text-[10px] text-emerald-600 font-medium mt-0.5 sm:mt-1 max-w-full">
                              Pubmat/Drive: <a href={task.pubmatLink} target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-emerald-800 break-all">{task.pubmatLink}</a>
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0 pl-1">
                          <span className="text-[9px] sm:text-[10px] text-gray-400 block font-semibold uppercase">Deadline</span>
                          <span className="text-[11px] sm:text-xs font-bold text-gray-800">{task.releaseDate}</span>
                        </div>
                      </div>

                      {/* Links review section */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 bg-neutral-50 p-2 sm:p-3 rounded-lg sm:rounded-xl border border-gray-150">
                        <div>
                          <span className="text-[8px] sm:text-[9px] uppercase font-bold text-gray-400 block mb-0.5 sm:mb-1">Canva Link</span>
                          {task.canvaLink ? (
                            <a 
                              href={task.canvaLink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 sm:py-1 bg-cyan-100 hover:bg-cyan-200 text-cyan-800 text-[11px] sm:text-xs font-bold rounded transition-all"
                            >
                              Open Canva Workspace <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-[11px] sm:text-xs text-gray-400 italic">Not set</span>
                          )}
                        </div>
                        <div>
                          <span className="text-[8px] sm:text-[9px] uppercase font-bold text-gray-400 block mb-0.5 sm:mb-1">Google Drive & Illustration Link</span>
                          {task.pubmatLink ? (
                            <a 
                              href={task.pubmatLink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 sm:py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] sm:text-xs font-bold rounded transition-all"
                            >
                              Open Google Drive Link <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-[11px] sm:text-xs text-gray-400 italic">Not set</span>
                          )}
                        </div>
                      </div>

                      {/* Expand Actions when selected */}
                      {isSelected && (
                        <div className="pt-2 sm:pt-4 border-t border-gray-100 space-y-2 sm:space-y-4 text-xs">
                          <div>
                            <label className="block text-[11px] sm:text-xs font-semibold text-gray-600 mb-1">
                              Constructive Revision Notes (Requested changes)
                            </label>
                            <textarea
                              placeholder="Type constructive revision notes... (use '- ' for bullet points, press Enter for next line)"
                              value={revisionFeedback}
                              onChange={(e) => setRevisionFeedback(e.target.value)}
                              onKeyDown={(e) => handleBulletKeyDown(e, revisionFeedback, setRevisionFeedback)}
                              rows={2}
                              className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon bg-white resize-none"
                            />
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedReviewTaskId(null);
                              }}
                              className="text-gray-500 hover:text-gray-900 font-semibold text-[11px] sm:text-xs"
                            >
                              Minimize Detail
                            </button>
                            
                            <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                              {task.canvaLink && (
                                <a
                                  href={task.canvaLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-cyan-50 border border-cyan-200 hover:bg-cyan-100 text-cyan-800 font-bold rounded-lg sm:rounded-xl transition-all flex items-center gap-1 text-[11px] sm:text-xs"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Canva <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRequestRevision(task);
                                }}
                                className="px-2.5 py-1.5 sm:px-4 sm:py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg sm:rounded-xl transition-all flex items-center gap-1 cursor-pointer text-[11px] sm:text-xs"
                              >
                                <XCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Request Revision
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApprove(task);
                                }}
                                className="px-2.5 py-1.5 sm:px-4 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg sm:rounded-xl transition-all flex items-center gap-1 shadow-sm cursor-pointer text-[11px] sm:text-xs"
                              >
                                <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Approve & Lock
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      ) : (
        /* =======================================================
           EIC PIPELINE OVERSIGHT HUB (ALL DESIGN ASSIGNMENTS)
           ======================================================= */
        <div className="space-y-4 text-left">
          <div className="bg-white p-4 rounded-xl border border-gray-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search assignments by layout title, writer, or artist..."
                value={pipelineSearch}
                onChange={(e) => setPipelineSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:bg-white focus:ring-1 focus:ring-brand-maroon transition-all"
              />
            </div>
            <div className="text-xs text-gray-500 font-medium">
              Overseeing <span className="font-bold text-brand-maroon">{filteredPipelineTasks.length}</span> assigned design tasks
            </div>
          </div>

          <div className="space-y-4">
            {filteredPipelineTasks.length === 0 ? (
              <div className="bg-white/50 border border-gray-100 rounded-xl sm:rounded-2xl p-6 sm:p-10 text-center text-gray-500 text-xs space-y-1">
                <p className="font-bold text-gray-700 text-sm">No pipeline tasks in queue</p>
                <p>Tasks created or synchronized from the schedule will appear here in the live step tracker.</p>
              </div>
            ) : (
              filteredPipelineTasks.map(task => {
              // Map progress state to one of the 5 pipeline stages
              let currentStageIndex = 0;
              if (task.progress === "In Progress" || task.progress === "drafting" || task.progress === "for posting") {
                currentStageIndex = 1;
              } else if (task.progress === "For Review") {
                currentStageIndex = 2;
              } else if (task.progress === "Revision Needed") {
                currentStageIndex = 3;
              } else if (task.progress === "Completed" || task.progress === "Approved") {
                currentStageIndex = 4;
              }

              const stages = [
                { label: "Assigned", color: "bg-amber-500" },
                { label: "Designing", color: "bg-blue-500" },
                { label: "Pending Critique", color: "bg-purple-500" },
                { label: "Revision Loop", color: "bg-rose-500" },
                { label: "Approved & Done", color: "bg-emerald-600" }
              ];

              return (
                <div key={task.id} className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-brand-maroon/5 text-brand-maroon border border-brand-maroon/10">
                          {task.typeOfRelease}
                        </span>
                        <span className="text-[9px] font-mono text-gray-400">ID: {task.writeup}</span>
                      </div>
                      <h4 className="font-bold text-gray-900 text-sm mt-1">{task.title}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Artist: <span className="font-bold text-gray-700">{task.illusLayout}</span> • Writer: <span className="font-medium text-gray-600">{task.writer}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3 self-start md:self-center">
                      {task.canvaLink ? (
                        <a
                          href={task.canvaLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-sm cursor-pointer transition-all"
                        >
                          Launch Canva <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400 italic bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
                          No Canva link attached
                        </span>
                      )}
                      <div className="text-right">
                        <span className="text-[10px] text-gray-400 block uppercase font-semibold">Target Date</span>
                        <span className="text-xs font-bold text-gray-800">{task.releaseDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* VISUAL STEPPER TIMELINE */}
                  <div className="bg-gray-50/50 border border-gray-100/60 p-4 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
                      <span>Pipeline Progress Track</span>
                      <span className="text-brand-maroon">Stage {currentStageIndex + 1} of 5: {stages[currentStageIndex].label}</span>
                    </div>

                    <div className="relative flex items-center justify-between w-full pt-2">
                      {/* Connecting Background Line */}
                      <div className="absolute top-[18px] left-0 right-0 h-0.5 bg-gray-200 -z-10" />
                      
                      {/* Highlighted Progress line */}
                      <div 
                        className="absolute top-[18px] left-0 h-0.5 bg-emerald-500 -z-10 transition-all duration-500" 
                        style={{ width: `${(currentStageIndex / 4) * 100}%` }}
                      />

                      {stages.map((stage, sIdx) => {
                        const isPassed = sIdx < currentStageIndex;
                        const isActive = sIdx === currentStageIndex;
                        return (
                          <div key={stage.label} className="flex flex-col items-center flex-1 text-center relative">
                            {/* Circle Dot */}
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 font-mono text-[10px] font-bold ${
                              isPassed ? "bg-emerald-500 text-white" :
                              isActive ? `${stage.color} text-white ring-4 ring-offset-2 ring-emerald-500/10` :
                              "bg-gray-200 text-gray-500"
                            }`}>
                              {isPassed ? "✓" : sIdx + 1}
                            </div>
                            
                            {/* Label */}
                            <span className={`text-[9px] mt-1.5 font-bold transition-all ${
                              isActive ? "text-gray-900 font-black" :
                              isPassed ? "text-emerald-700" :
                              "text-gray-400"
                            }`}>
                              {stage.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            }))}
          </div>
        </div>
      )}

    </div>
  );
}
