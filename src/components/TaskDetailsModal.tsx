import React, { useRef, useState } from "react";
import { 
  X, MessageSquare, Link, ExternalLink, Sparkles, Clock, AlertTriangle, 
  Trash2, User, FileText, Send, Calendar, RefreshCw, Lock, ImagePlus, Pencil
} from "lucide-react";
import { Task, TeamMember, TaskComment, TaskStatus, TaskPriority } from "../types";
import { extractHyperlinkDetails } from "../lib/canvaTemplates";
import { isUserAssignedToTask } from "../lib/memberUtils";
import { compressCommentImage, formatCommentDetails, handleBulletKeyDown, MAX_COMMENT_IMAGES, RenderFormattedComment } from "../lib/commentUtils";
import { getPreferredFirstName } from "../lib/memberUtils";
import { isOnlinePubmatTask } from "../lib/canvaTemplates";
import { toISOFormatDate, formatISOToDisplayDate } from "./AssignmentsList";
import GoogleDocShareWidget from "./GoogleDocShareWidget";
import { shareGoogleDocWithMember } from "../lib/googleDriveShare";
import CommentImageAnnotator from "./CommentImageAnnotator";

interface TaskDetailsModalProps {
  task: Task;
  members: TeamMember[];
  comments: TaskComment[];
  speechEnabled: boolean;
  currentUserEmail: string;
  currentUserName: string;
  currentUserRole?: string;
  onClose: () => void;
  onUpdateTask: (task: Task) => void;
  onDeleteTask?: (task: Task) => void;
  onAddComment: (comment: TaskComment) => void;
  onUpdateComment: (comment: TaskComment) => Promise<boolean>;
  onRemoveComment: (comment: TaskComment) => Promise<boolean>;
  onTriggerCritiqueTab?: (task: Task) => void;
}

export default function TaskDetailsModal({
  task,
  members,
  comments,
  speechEnabled,
  currentUserEmail,
  currentUserName,
  currentUserRole,
  onClose,
  onUpdateTask,
  onDeleteTask,
  onAddComment,
  onUpdateComment,
  onRemoveComment,
  onTriggerCritiqueTab,
}: TaskDetailsModalProps) {
  const [commentText, setCommentText] = useState("");
  const [commentImages, setCommentImages] = useState<string[]>([]);
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const [imageError, setImageError] = useState("");
  const imageInput = useRef<HTMLInputElement>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null);
  const [commentActionError, setCommentActionError] = useState("");
  const isEditorOrDeputy = currentUserRole === "Layout Editor" || currentUserRole === "Layout Deputy" || currentUserRole === "Online Layout Head";
  const showMediumCanvaLink = isOnlinePubmatTask(task.typeOfRelease, task.title);

  const isAssignedStaffer = (task.illusLayout || "").toLowerCase().includes((currentUserName || "").toLowerCase()) || 
    (currentUserName && currentUserName.toLowerCase().includes((task.illusLayout || "").toLowerCase())) ||
    (currentUserEmail && (task.illusLayout || "").toLowerCase().includes(currentUserEmail.toLowerCase()));

  const canViewThisTaskComments = isEditorOrDeputy || isAssignedStaffer;

  // Once a task has an assignee, only that assigned account may change the workflow
  // fields (status / priority / assignee). Editor & Deputy may still set them while the
  // task is unassigned so it can be handed out in the first place.
  const hasAssignee = Boolean(task.illusLayout) && task.illusLayout !== "Unassigned";
  const canEditCoreFields = isAssignedStaffer || (!hasAssignee && isEditorOrDeputy);

  // Only the assigned artist may submit for review — leaders viewing someone
  // else's task should not see the submit button.
  const isThisTaskAssignee = isUserAssignedToTask(task, currentUserName, currentUserEmail);

  const speakText = (text: string) => {
    if (!speechEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  };

  const taskComments = comments.filter((c) => c.taskId === task.id);

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

  const handleSelectCommentImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = "";
    const availableSlots = MAX_COMMENT_IMAGES - commentImages.length;
    if (files.length === 0) return;
    if (availableSlots <= 0) {
      setImageError("A message can include up to 5 pictures.");
      return;
    }

    setIsPreparingImages(true);
    setImageError(files.length > availableSlots ? "Only 5 pictures can be attached to one message." : "");
    const preparedImages: string[] = [];
    for (const file of files.slice(0, availableSlots)) {
      try {
        preparedImages.push(await compressCommentImage(file));
      } catch (error) {
        setImageError(error instanceof Error ? error.message : "Could not add this image.");
      }
    }
    setCommentImages((current) => [...current, ...preparedImages].slice(0, MAX_COMMENT_IMAGES));
    setIsPreparingImages(false);
  };

  // Status handle
  const handleStatusChange = (newStatus: TaskStatus) => {
    const updated = { 
      ...task, 
      progress: newStatus,
      lastUpdated: new Date().toISOString()
    };
    onUpdateTask(updated);
    speakText(`Assignment status changed to ${newStatus}`);
  };

  // Priority handle
  const handlePriorityChange = (newPriority: TaskPriority) => {
    onUpdateTask({ ...task, priority: newPriority });
    speakText(`Assignment priority adjusted to ${newPriority}`);
  };

  // Assignee handle
  const handleAssigneeChange = (newName: string) => {
    onUpdateTask({ ...task, illusLayout: newName });
    speakText(`Re-assigned task to ${newName}`);
  };

  // Add Comment
  const handlePostComment = () => {
    if ((!commentText.trim() && commentImages.length === 0) || isPreparingImages) return;
    
    const newComment: TaskComment = {
      id: crypto.randomUUID(),
      taskId: task.id,
      authorName: currentUserName,
      authorEmail: currentUserEmail,
      text: commentText,
      timestamp: new Date().toISOString(),
      ...(commentImages.length ? { images: commentImages } : {})
    };

    onAddComment(newComment);
    
    // Also increment commentsCount on the task
    onUpdateTask({
      ...task,
      commentsCount: task.commentsCount + 1
    });

    setCommentText("");
    setCommentImages([]);
    setImageError("");
    speakText("Comment added.");
  };

  const handleTriggerCritique = () => {
    onTriggerCritiqueTab(task);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div 
        className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col md:flex-row shadow-2xl border border-gray-100 dark:border-neutral-800 text-left animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-label={`Details for task ${task.title}`}
      >
        
        {/* Left Side: Core Metadata & File Drawer */}
        <div className="flex-1 p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 border-b md:border-b-0 md:border-r border-gray-100 dark:border-neutral-800">
          
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0 flex-1">
              <span className="text-[10px] font-bold text-brand-maroon dark:text-brand-maroon-light uppercase tracking-wider block truncate">
                {task.typeOfRelease} • {task.typeOfContent}
              </span>
              <h2 className="text-lg sm:text-xl font-display font-black text-gray-900 dark:text-neutral-100 leading-tight">
                {task.title}
              </h2>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Deadline — visible to all, editable only by Editor / Deputy */}
              <div className="flex items-center gap-1.5" title="Task deadline">
                <Calendar className="w-4 h-4 text-gray-400 dark:text-neutral-400 shrink-0" />
                {isEditorOrDeputy ? (
                  <input
                    type="date"
                    value={toISOFormatDate(task.releaseDate || "")}
                    onChange={(e) => onUpdateTask({ ...task, releaseDate: formatISOToDisplayDate(e.target.value), lastUpdated: new Date().toISOString() })}
                    className="px-2 py-1 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-[11px] font-semibold text-gray-700 dark:text-neutral-200 outline-none focus:ring-2 focus:ring-brand-maroon cursor-pointer"
                    aria-label="Change task deadline"
                  />
                ) : (
                  <span className="px-2 py-1 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-[11px] font-semibold text-gray-700 dark:text-neutral-200">
                    {task.releaseDate ? formatISOToDisplayDate(task.releaseDate) : "No deadline"}
                  </span>
                )}
              </div>

              {isEditorOrDeputy && onDeleteTask && (
                <button
                  onClick={() => {
                    if (window.confirm(`Delete task '${task.title}'? This cannot be undone.`)) {
                      onDeleteTask(task);
                    }
                  }}
                  className="p-1 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900 rounded-full text-rose-500 hover:text-rose-700 transition-all shrink-0 cursor-pointer"
                  aria-label="Delete task"
                  title="Delete task"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1 bg-gray-50 dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-full text-gray-400 hover:text-gray-800 dark:hover:text-neutral-200 transition-all shrink-0 cursor-pointer"
                aria-label="Close details modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Editors Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            
            <div>
              <label className="text-gray-400 dark:text-neutral-400 block font-semibold mb-1">Status</label>
              <select
                value={task.progress}
                disabled={!canEditCoreFields}
                onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                className={`w-full px-2.5 py-1.5 sm:py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg font-semibold text-gray-800 dark:text-neutral-200 outline-none focus:ring-2 focus:ring-brand-maroon ${canEditCoreFields ? "cursor-pointer" : "opacity-60 cursor-not-allowed"}`}
              >
                <option value="Not Started">Not Started</option>
                <option value="Assigned">Assigned</option>
                <option value="In Progress">Working</option>
                <option value="For Review">Review</option>
                <option value="Revision Needed">Revision Needed</option>
                <option value="Completed">Completed</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="text-gray-400 dark:text-neutral-400 block font-semibold mb-1">Priority</label>
              <select
                value={task.priority}
                disabled={!canEditCoreFields}
                onChange={(e) => handlePriorityChange(e.target.value as TaskPriority)}
                className={`w-full px-2.5 py-1.5 sm:py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg font-semibold text-gray-800 dark:text-neutral-200 outline-none focus:ring-2 focus:ring-brand-maroon ${canEditCoreFields ? "cursor-pointer" : "opacity-60 cursor-not-allowed"}`}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="text-gray-400 dark:text-neutral-400 block font-semibold mb-1">Assignee</label>
              <select
                value={task.illusLayout}
                disabled={!canEditCoreFields}
                onChange={(e) => handleAssigneeChange(e.target.value)}
                className={`w-full px-2.5 py-1.5 sm:py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg font-semibold text-gray-800 dark:text-neutral-200 outline-none focus:ring-2 focus:ring-brand-maroon ${canEditCoreFields ? "cursor-pointer" : "opacity-60 cursor-not-allowed"}`}
              >
                <option value="Unassigned">Unassigned</option>
                {members.map(m => {
                  const firstName = getPreferredFirstName(m.name, m.email);
                  return (
                    <option key={m.id} value={firstName}>{firstName}</option>
                  );
                })}
              </select>
            </div>

          </div>

          {/* Active Workspace & Link Sync Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            
            {/* Canva Workspace Link Editor */}
            <div className="bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800/60 p-3 sm:p-3.5 rounded-xl space-y-2 text-xs">
              <span className="font-bold text-cyan-800 dark:text-cyan-400 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                Canva Workspace Link
              </span>
              
              {task.canvaLink ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-cyan-900 dark:text-cyan-200 font-mono truncate bg-white dark:bg-neutral-800 px-2 py-1 rounded border border-cyan-100 dark:border-cyan-800 flex-1">
                    {extractHyperlinkDetails(task.canvaLink).label || task.canvaLink}
                  </p>
                  <a 
                    href={extractHyperlinkDetails(task.canvaLink).url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg text-[10px] flex items-center gap-1 shrink-0 shadow-sm cursor-pointer"
                  >
                    Launch
                  </a>
                </div>
              ) : (
                <p className="text-[10px] text-gray-500 dark:text-neutral-400 italic">No design workspace link attached yet.</p>
              )}

              {isEditorOrDeputy && (
                <div className="space-y-1">
                  <label className="text-[9px] text-gray-400 dark:text-neutral-400 font-semibold block">Update/Attach Canva Link</label>
                  <input
                    type="text"
                    placeholder="https://www.canva.com/design/..."
                    defaultValue={task.canvaLink || ""}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val !== (task.canvaLink || "")) {
                        onUpdateTask({
                          ...task,
                          canvaLink: val,
                          lastUpdated: new Date().toISOString()
                        });
                        speakText("Canva link saved and synchronized.");
                      }
                    }}
                    className="w-full px-2 py-1 border border-cyan-200/60 dark:border-cyan-800/60 rounded-lg text-xs outline-none bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:ring-1 focus:ring-cyan-500 font-mono"
                  />
                </div>
              )}
            </div>

            {/* Medium Canva Link Editor */}
            {showMediumCanvaLink && <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 p-3 sm:p-3.5 rounded-xl space-y-2 text-xs">
              <span className="font-bold text-blue-800 dark:text-blue-400 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Medium Canva Link
              </span>
              {task.mediumCanvaLink ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-blue-900 dark:text-blue-200 font-mono truncate bg-white dark:bg-neutral-800 px-2 py-1 rounded border border-blue-100 dark:border-blue-800 flex-1">
                    {extractHyperlinkDetails(task.mediumCanvaLink).label || task.mediumCanvaLink}
                  </p>
                  <a href={extractHyperlinkDetails(task.mediumCanvaLink).url} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[10px] flex items-center gap-1 shrink-0 shadow-sm cursor-pointer">Launch</a>
                </div>
              ) : (
                <p className="text-[10px] text-gray-500 dark:text-neutral-400 italic">No Medium Canva link attached yet.</p>
              )}
              {isEditorOrDeputy && (
                <div className="space-y-1">
                  <label className="text-[9px] text-gray-400 dark:text-neutral-400 font-semibold block">Update/Attach Medium Canva Link</label>
                  <input
                    type="text"
                    placeholder="https://www.canva.com/design/..."
                    defaultValue={task.mediumCanvaLink || ""}
                    onBlur={(event) => {
                      const value = event.target.value.trim();
                      if (value !== (task.mediumCanvaLink || "")) {
                        onUpdateTask({ ...task, mediumCanvaLink: value, lastUpdated: new Date().toISOString() });
                        speakText("Medium Canva link saved and synchronized.");
                      }
                    }}
                    className="w-full px-2 py-1 border border-blue-200/60 dark:border-blue-800/60 rounded-lg text-xs outline-none bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
              )}
            </div>}

            {/* ArtX Document Link Editor */}
            <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/60 p-3 sm:p-3.5 rounded-xl space-y-2 text-xs">
              <span className="font-bold text-rose-800 dark:text-rose-400 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                ArtX Document Link
              </span>
              {task.draftLink ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-rose-900 dark:text-rose-200 font-mono truncate bg-white dark:bg-neutral-800 px-2 py-1 rounded border border-rose-100 dark:border-rose-800 flex-1">
                    {extractHyperlinkDetails(task.draftLink).label || task.draftLink}
                  </p>
                  <a href={extractHyperlinkDetails(task.draftLink).url} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[10px] flex items-center gap-1 shrink-0 shadow-sm cursor-pointer">Launch</a>
                </div>
              ) : (
                <p className="text-[10px] text-gray-500 dark:text-neutral-400 italic">No ArtX document link attached yet.</p>
              )}
              {isEditorOrDeputy && (
                <div className="space-y-1">
                  <label className="text-[9px] text-gray-400 dark:text-neutral-400 font-semibold block">Update/Attach ArtX Document Link</label>
                  <input
                    type="text"
                    placeholder="https://docs.google.com/document/..."
                    defaultValue={task.draftLink || ""}
                    onBlur={(event) => {
                      const value = event.target.value.trim();
                      if (value !== (task.draftLink || "")) {
                        onUpdateTask({ ...task, draftLink: value, lastUpdated: new Date().toISOString() });
                        speakText("ArtX document link saved and synchronized.");
                      }
                    }}
                    className="w-full px-2 py-1 border border-rose-200/60 dark:border-rose-800/60 rounded-lg text-xs outline-none bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:ring-1 focus:ring-rose-500 font-mono"
                  />
                </div>
              )}
            </div>

            {/* Illustration Link Editor */}
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 p-3 sm:p-3.5 rounded-xl space-y-2 text-xs">
              <span className="font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Illustration/Photo Link
              </span>
              
              {task.pubmatLink ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-emerald-900 dark:text-emerald-200 font-mono truncate bg-white dark:bg-neutral-800 px-2 py-1 rounded border border-emerald-100 dark:border-emerald-800 flex-1">
                    {extractHyperlinkDetails(task.pubmatLink).label || task.pubmatLink}
                  </p>
                  <a 
                    href={extractHyperlinkDetails(task.pubmatLink).url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] flex items-center gap-1 shrink-0 shadow-sm cursor-pointer"
                  >
                    Launch
                  </a>
                </div>
              ) : (
                <p className="text-[10px] text-gray-500 dark:text-neutral-400 italic">No illustration/photo link attached yet.</p>
              )}

              {isEditorOrDeputy && (
                <div className="space-y-1">
                  <label className="text-[9px] text-gray-400 dark:text-neutral-400 font-semibold block">Update Illustration/Photo Link</label>
                  <input
                    type="text"
                    placeholder="https://drive.google.com/..."
                    defaultValue={task.pubmatLink || ""}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val !== (task.pubmatLink || "")) {
                        onUpdateTask({
                          ...task,
                          pubmatLink: val,
                          lastUpdated: new Date().toISOString()
                        });
                        speakText("Illustration/photo link saved and synchronized.");
                      }
                    }}
                    className="w-full px-2 py-1 border border-emerald-200/60 dark:border-emerald-800/60 rounded-lg text-xs outline-none bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>
              )}
            </div>

          </div>

          {/* Google Doc Auto-Share Permissions Widget */}
          <GoogleDocShareWidget
            docUrl={task.draftLink || task.addedToLayout || task.pubmatLink || ""}
            assignedMemberName={task.illusLayout}
            members={members}
          />

          {/* Workflow Transitions Panel */}
          <div className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <span className="font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wide shrink-0">Workflow Actions Desk</span>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
              {isThisTaskAssignee && task.progress !== "For Review" && task.progress !== "Completed" && task.progress !== "Approved" && (
                <button
                  onClick={() => {
                    const updated = { ...task, progress: "For Review" as const, lastUpdated: new Date().toISOString() };
                    onUpdateTask(updated);
                    speakText("Submitted draft for review.");
                  }}
                  className="px-2.5 sm:px-3 py-1.5 bg-neutral-900 hover:bg-black text-white font-bold rounded-lg transition-all text-[11px] cursor-pointer whitespace-nowrap flex-1 sm:flex-initial text-center"
                >
                  Submit for Review
                </button>
              )}
              {(task.progress === "For Review" || task.progress === "In Progress" || task.progress === "Approved") && (
                <button
                  onClick={() => {
                    const updated = { ...task, progress: "Revision Needed" as const, lastUpdated: new Date().toISOString() };
                    onUpdateTask(updated);
                    speakText("Returned layout for revision.");
                  }}
                  className="px-2.5 sm:px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold rounded-lg transition-all text-[11px] cursor-pointer whitespace-nowrap flex-1 sm:flex-initial text-center"
                >
                  Flag for Revision
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Right Side: Collaboration Feed & Comments */}
        <div className="w-full md:w-[350px] bg-gray-50/50 dark:bg-neutral-850 p-3.5 sm:p-5 md:p-6 flex flex-col justify-between max-h-[90vh]">
          
          <div className="space-y-3 sm:space-y-4 flex-1 flex flex-col overflow-hidden">
            <h3 className="font-display font-bold text-gray-900 dark:text-neutral-100 text-sm flex items-center gap-1.5 border-b border-gray-200 dark:border-neutral-700 pb-2">
              <MessageSquare className="w-4 h-4 text-brand-maroon dark:text-brand-maroon-light" />
              Design-Desk Comments {canViewThisTaskComments ? `(${taskComments.length})` : "(Restricted)"}
            </h3>

            {!canViewThisTaskComments ? (
              <div className="py-12 px-3 text-center space-y-3 my-auto">
                <div className="w-10 h-10 rounded-full bg-neutral-200/70 dark:bg-neutral-800 text-neutral-500 flex items-center justify-center mx-auto">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-gray-800 dark:text-neutral-200">
                    Comments Restricted
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-neutral-400 leading-normal">
                    Revision notes and feedback on this specific task are confidential between the assigned artist, Layout Editor, and Layout Deputy.
                  </p>
                </div>
              </div>
            ) : (
              /* Comments Feed list */
              <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                {taskComments.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 dark:text-neutral-500 text-xs italic">
                    No collaboration logs posted. Send directions to illustrator below.
                  </div>
                ) : (
                  taskComments.map((com) => {
                    const { cleanedText, roleLabel, badgeStyle, initials } = formatCommentDetails(com);
                    return (
                      <div key={com.id} className="space-y-1.5 bg-white dark:bg-neutral-800 p-3 sm:p-3.5 rounded-2xl border border-gray-100/80 dark:border-neutral-700 text-xs shadow-2xs text-left">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="w-5 h-5 rounded-full bg-neutral-900 dark:bg-neutral-700 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                              {initials}
                            </div>
                            <span className="font-bold text-gray-900 dark:text-neutral-100 text-xs">{com.authorName}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${badgeStyle}`}>
                              {roleLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 dark:text-neutral-400 font-mono">
                              {new Date(com.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {currentUserEmail && com.authorEmail?.trim().toLowerCase() === currentUserEmail.trim().toLowerCase() && !com.removedAt && (
                              <span className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => { setEditingCommentId(com.id); setEditCommentText(com.text); setCommentActionError(""); }}
                                  disabled={savingCommentId === com.id}
                                  className="p-1 text-neutral-500 hover:text-brand-maroon dark:hover:text-red-300 rounded cursor-pointer disabled:opacity-40"
                                  aria-label="Edit your message"
                                  title="Edit message"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveComment(com)}
                                  disabled={savingCommentId === com.id}
                                  className="p-1 text-neutral-500 hover:text-rose-600 rounded cursor-pointer disabled:opacity-40"
                                  aria-label="Remove your message"
                                  title="Remove message"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </span>
                            )}
                          </div>
                        </div>
                        {com.removedAt ? (
                          <p className="pl-6 pt-1 text-xs text-neutral-400 italic">Message removed</p>
                        ) : editingCommentId === com.id ? (
                          <div className="pl-6 pt-1 space-y-2">
                            <textarea
                              value={editCommentText}
                              onChange={(event) => setEditCommentText(event.target.value)}
                              rows={3}
                              className="w-full px-2.5 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-xs text-neutral-800 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-brand-maroon resize-y"
                              aria-label="Edit your message"
                            />
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => setEditingCommentId(null)} className="px-2.5 py-1 text-xs text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md cursor-pointer">Cancel</button>
                              <button type="button" onClick={() => handleSaveComment(com)} disabled={savingCommentId === com.id} className="px-2.5 py-1 text-xs font-semibold bg-brand-maroon text-white rounded-md cursor-pointer disabled:opacity-50">{savingCommentId === com.id ? "Saving…" : "Save"}</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="pl-6 pt-1 text-gray-800 dark:text-neutral-200">
                              <RenderFormattedComment text={cleanedText} isEditorRole={roleLabel.includes("Editor") || roleLabel.includes("EIC")} />
                              {com.editedAt && <span className="mt-1 block text-[9px] text-neutral-400 italic">Edited</span>}
                            </div>
                            {com.images && com.images.length > 0 && (
                          <div className="pl-6 grid grid-cols-2 gap-2">
                            {com.images.slice(0, MAX_COMMENT_IMAGES).map((image, index) => (
                              <div key={`${com.id}-${index}`} className="aspect-square overflow-hidden rounded-lg border border-gray-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900">
                                <CommentImageAnnotator image={image} allowAnnotation={false} label={`View picture ${index + 1}`} />
                              </div>
                            ))}
                          </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })
                )}
                {commentActionError && <p role="alert" className="text-[10px] text-rose-600 dark:text-rose-400">{commentActionError}</p>}
              </div>
            )}
          </div>

          {/* Post Comment Input */}
          {canViewThisTaskComments && (
            <div className="pt-3 border-t border-gray-100/80 dark:border-neutral-700 mt-auto space-y-1.5 text-left">
              <input
                ref={imageInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleSelectCommentImages}
                className="hidden"
                aria-label="Choose pictures to attach"
              />
              {commentImages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {commentImages.map((image, index) => (
                    <div key={image} className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-700">
                      <CommentImageAnnotator
                        image={image}
                        label={`Annotate picture ${index + 1}`}
                        onSave={(annotatedImage) => setCommentImages((current) => current.map((item, imageIndex) => imageIndex === index ? annotatedImage : item))}
                      />
                      <button
                        type="button"
                        onClick={() => setCommentImages((current) => current.filter((_, imageIndex) => imageIndex !== index))}
                        className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/70 text-white cursor-pointer"
                        aria-label={`Remove picture ${index + 1}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <span className="self-center text-[10px] text-gray-500">{commentImages.length}/{MAX_COMMENT_IMAGES}</span>
                </div>
              )}
              {(imageError || isPreparingImages) && (
                <p role={imageError ? "alert" : "status"} className="text-[10px] text-rose-600 dark:text-rose-400">
                  {isPreparingImages ? "Preparing pictures…" : imageError}
                </p>
              )}
              <div className="flex items-start gap-2">
                <textarea
                  placeholder="Post a layout suggestion... (type '- ' for bullet points, Enter for new line)"
                  value={commentText}
                  rows={2}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => handleBulletKeyDown(e, commentText, setCommentText, handlePostComment)}
                  className="flex-1 px-3 py-2 border border-gray-200 dark:border-neutral-700 rounded-xl text-xs focus:ring-2 focus:ring-brand-maroon bg-white dark:bg-neutral-800 text-gray-800 dark:text-neutral-100 outline-none resize-none"
                />
                <button
                  type="button"
                  onClick={() => imageInput.current?.click()}
                  disabled={isPreparingImages || commentImages.length >= MAX_COMMENT_IMAGES}
                  className="p-2.5 border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 hover:text-brand-maroon rounded-xl disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer self-stretch"
                  aria-label={`Attach pictures (${commentImages.length} of ${MAX_COMMENT_IMAGES})`}
                  title={`Attach pictures (${commentImages.length}/${MAX_COMMENT_IMAGES})`}
                >
                  <ImagePlus className="w-4 h-4" />
                </button>
                <button
                  onClick={handlePostComment}
                  disabled={isPreparingImages || (!commentText.trim() && commentImages.length === 0)}
                  className="p-2.5 bg-brand-maroon hover:bg-brand-maroon-dark text-white rounded-xl transition-all self-stretch flex items-center justify-center shrink-0 cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Send comment"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-neutral-500 font-medium">
                Press <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-neutral-800 border dark:border-neutral-700 rounded text-[9px]">Enter</kbd> for new line, <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-neutral-800 border dark:border-neutral-700 rounded text-[9px]">- </kbd> for bullets, or <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-neutral-800 border dark:border-neutral-700 rounded text-[9px]">Ctrl+Enter</kbd> to submit.
              </p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
