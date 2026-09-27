import React, { useState } from "react";
import { 
  X, MessageSquare, Link, ExternalLink, Sparkles, Clock, AlertTriangle, 
  Trash2, User, FileText, Send, Calendar, RefreshCw, Lock 
} from "lucide-react";
import { Task, TeamMember, TaskComment, TaskStatus, TaskPriority } from "../types";
import { extractHyperlinkDetails } from "../lib/canvaTemplates";
import { formatCommentDetails, handleBulletKeyDown, RenderFormattedComment } from "../lib/commentUtils";
import GoogleDocShareWidget from "./GoogleDocShareWidget";
import { shareGoogleDocWithMember } from "../lib/googleDriveShare";

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
  onAddComment: (comment: TaskComment) => void;
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
  onAddComment,
  onTriggerCritiqueTab,
}: TaskDetailsModalProps) {
  const [commentText, setCommentText] = useState("");
  const isLayoutEditor = currentUserRole === "Layout Editor";
  const isEditorOrDeputy = currentUserRole === "Layout Editor" || currentUserRole === "Layout Deputy" || currentUserRole === "Online Layout Head";

  const isAssignedStaffer = (task.illusLayout || "").toLowerCase().includes((currentUserName || "").toLowerCase()) || 
    (currentUserName && currentUserName.toLowerCase().includes((task.illusLayout || "").toLowerCase())) ||
    (currentUserEmail && (task.illusLayout || "").toLowerCase().includes(currentUserEmail.toLowerCase()));

  const canViewThisTaskComments = isEditorOrDeputy || isAssignedStaffer;

  const speakText = (text: string) => {
    if (!speechEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  };

  const taskComments = comments.filter((c) => c.taskId === task.id);

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
    if (!commentText.trim()) return;
    
    const newComment: TaskComment = {
      id: `comment-${Date.now()}`,
      taskId: task.id,
      authorName: currentUserName,
      authorEmail: currentUserEmail,
      text: commentText,
      timestamp: new Date().toISOString()
    };

    onAddComment(newComment);
    
    // Also increment commentsCount on the task
    onUpdateTask({
      ...task,
      commentsCount: task.commentsCount + 1
    });

    setCommentText("");
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
              <span className="text-[10px] font-bold text-brand-maroon dark:text-red-400 uppercase tracking-wider block truncate">
                {task.typeOfRelease} • {task.typeOfContent}
              </span>
              <h2 className="text-lg sm:text-xl font-display font-black text-gray-900 dark:text-neutral-100 leading-tight">
                {task.title}
              </h2>
            </div>
            
            <button 
              onClick={onClose}
              className="p-1 bg-gray-50 dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-full text-gray-400 hover:text-gray-800 dark:hover:text-neutral-200 transition-all shrink-0 cursor-pointer"
              aria-label="Close details modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Editors Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            
            <div>
              <label className="text-gray-400 dark:text-neutral-400 block font-semibold mb-1">Status</label>
              <select
                value={task.progress}
                onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                className="w-full px-2.5 py-1.5 sm:py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg font-semibold text-gray-800 dark:text-neutral-200 outline-none focus:ring-2 focus:ring-brand-maroon cursor-pointer"
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
                onChange={(e) => handlePriorityChange(e.target.value as TaskPriority)}
                className="w-full px-2.5 py-1.5 sm:py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg font-semibold text-gray-800 dark:text-neutral-200 outline-none focus:ring-2 focus:ring-brand-maroon cursor-pointer"
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
                onChange={(e) => handleAssigneeChange(e.target.value)}
                className="w-full px-2.5 py-1.5 sm:py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg font-semibold text-gray-800 dark:text-neutral-200 outline-none focus:ring-2 focus:ring-brand-maroon cursor-pointer"
              >
                <option value="Unassigned">Unassigned</option>
                {members.map(m => (
                  <option key={m.id} value={m.name}>{m.name.split(",")[0]}</option>
                ))}
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

              {isLayoutEditor && (
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

            {/* Illustration Link Editor */}
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 p-3 sm:p-3.5 rounded-xl space-y-2 text-xs">
              <span className="font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Illustration Link
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
                <p className="text-[10px] text-gray-500 dark:text-neutral-400 italic">No illustration link attached yet.</p>
              )}

              {isLayoutEditor && (
                <div className="space-y-1">
                  <label className="text-[9px] text-gray-400 dark:text-neutral-400 font-semibold block">Update Illustration Link</label>
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
                        speakText("Illustration link saved and synchronized.");
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
              {currentUserRole === "Layout Editor" && task.progress !== "For Review" && task.progress !== "Completed" && task.progress !== "Approved" && (
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
              {currentUserRole === "Layout Editor" && task.progress !== "Completed" && task.progress !== "Approved" && (
                <button
                  onClick={() => {
                    const updated = { ...task, progress: "Approved" as const, lastUpdated: new Date().toISOString() };
                    onUpdateTask(updated);
                    speakText("Approved and sent to EIC.");
                  }}
                  className="px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-all text-[11px] cursor-pointer whitespace-nowrap flex-1 sm:flex-initial text-center"
                >
                  Approve & Submit EIC
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

          <div className="space-y-1.5 text-xs">
            <span className="font-semibold text-gray-500 dark:text-neutral-400 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-gray-400" />
              Editorial Schedule
            </span>
            <p className="text-gray-600 dark:text-neutral-300 bg-gray-50 dark:bg-neutral-800 p-2.5 rounded-lg font-medium border border-gray-100 dark:border-neutral-700">
              Target Release date set for: <span className="font-bold text-brand-maroon dark:text-red-400">{task.releaseDate}</span> (Writeup identifier: <span className="font-mono">{task.writeup}</span>)
            </p>
          </div>

        </div>

        {/* Right Side: Collaboration Feed & Comments */}
        <div className="w-full md:w-[350px] bg-gray-50/50 dark:bg-neutral-850 p-3.5 sm:p-5 md:p-6 flex flex-col justify-between max-h-[90vh]">
          
          <div className="space-y-3 sm:space-y-4 flex-1 flex flex-col overflow-hidden">
            <h3 className="font-display font-bold text-gray-900 dark:text-neutral-100 text-sm flex items-center gap-1.5 border-b border-gray-200 dark:border-neutral-700 pb-2">
              <MessageSquare className="w-4 h-4 text-brand-maroon dark:text-red-400" />
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
                          <span className="text-[10px] text-gray-400 dark:text-neutral-400 font-mono">
                            {new Date(com.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="pl-6 pt-1 text-gray-800 dark:text-neutral-200">
                          <RenderFormattedComment text={cleanedText} isEditorRole={roleLabel.includes("Editor") || roleLabel.includes("EIC")} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Post Comment Input */}
          {canViewThisTaskComments && (
            <div className="pt-3 border-t border-gray-100/80 dark:border-neutral-700 mt-auto space-y-1.5 text-left">
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
                  onClick={handlePostComment}
                  className="p-2.5 bg-brand-maroon hover:bg-brand-maroon-dark text-white rounded-xl transition-all self-stretch flex items-center justify-center shrink-0 cursor-pointer shadow-2xs"
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
