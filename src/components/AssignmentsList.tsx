import React, { useState } from "react";
import { 
  ClipboardList, Search, Filter, Plus, ArrowUpDown, Clock, CheckCircle, 
  AlertCircle, Edit2, Check, ArrowRight, BookOpen, User, ExternalLink,
  Trash2, FileSpreadsheet, ListPlus, X, Link as LinkIcon, FolderPlus,
  FileText, CheckCircle2, Loader2, RefreshCw
} from "lucide-react";
import { Task, TeamMember } from "../types";
import { getAllCanvaTemplates, extractHyperlinkDetails } from "../lib/canvaTemplates";
import GoogleDocShareWidget from "./GoogleDocShareWidget";
import GoogleDocConfirmModal from "./GoogleDocConfirmModal";
import { shareGoogleDocWithMember } from "../lib/googleDriveShare";
import { fetchGoogleDocTitle, extractDocInputDetails } from "../lib/googleDocTitle";

import { OFFICIAL_MEMBERS_MAP, getOfficialDisplayName, getPreferredFirstName } from "../lib/memberUtils";

interface AssignmentsListProps {
  tasks: Task[];
  members: TeamMember[];
  speechEnabled: boolean;
  currentUserRole: string;
  onUpdateTasks: (tasks: Task[]) => void;
  onAddTask: () => void;
  onOpenTaskDetails: (task: Task) => void;
}

function toISOFormatDate(dateStr: string): string {
  if (!dateStr) return "";
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const currentYear = new Date().getFullYear();
  const parsed = new Date(`${trimmed} ${currentYear}`);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
}

function formatISOToDisplayDate(isoStr: string): string {
  if (!isoStr) return "";
  const parts = isoStr.split("-");
  if (parts.length !== 3) return isoStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return isoStr;
  const dateObj = new Date(y, m - 1, d);
  const monthName = dateObj.toLocaleString("en-US", { month: "long" }).toUpperCase();
  return `${monthName} ${d}`;
}

export default function AssignmentsList({
  tasks,
  members,
  speechEnabled,
  currentUserRole,
  onUpdateTasks,
  onAddTask,
  onOpenTaskDetails,
}: AssignmentsListProps) {
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState("All");
  const [progressFilter, setProgressFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"priority" | "date">("date");

  // State for pending tasks inline editing
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Task> | null>(null);
  const [isFetchingDocTitle, setIsFetchingDocTitle] = useState(false);

  const canvaTemplates = getAllCanvaTemplates();

  const speakText = (text: string) => {
    if (!speechEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  };

  const handleStatusChange = (taskId: string, newStatus: Task["progress"]) => {
    const updated = tasks.map(t => {
      if (t.id === taskId) {
        return { ...t, progress: newStatus, lastUpdated: new Date().toISOString() };
      }
      return t;
    });
    onUpdateTasks(updated);
    speakText(`Assignment progress updated to ${newStatus}`);
  };

  // State for Google Doc access confirmation modal
  const [confirmModalData, setConfirmModalData] = useState<{
    task: Task;
    activeForm: Task;
    docUrl: string;
    assignedName: string;
  } | null>(null);

  const executeDispatch = (task: Task, activeForm: Task) => {
    const templates = getAllCanvaTemplates();

    // Auto-resolve Canva link from template if not already explicitly specified
    let resolvedCanvaLink = activeForm.canvaLink;
    if (!resolvedCanvaLink && activeForm.typeOfContent) {
      const match = templates.find(
        t => t.name.toLowerCase() === activeForm.typeOfContent.toLowerCase() ||
             t.id.toLowerCase() === activeForm.typeOfContent.toLowerCase()
      );
      if (match) {
        resolvedCanvaLink = match.currentLink;
      }
    }

    let finalAddedToLayout = activeForm.addedToLayout || activeForm.draftLink || "";
    if (activeForm.draftLink && activeForm.writeup && !activeForm.draftLink.includes("=HYPERLINK")) {
      finalAddedToLayout = `=HYPERLINK("${activeForm.draftLink}", "${activeForm.writeup}")`;
    }

    const finalData: Task = {
      ...activeForm,
      canvaLink: resolvedCanvaLink || activeForm.canvaLink || "",
      pubmatLink: activeForm.pubmatLink || "",
      draftLink: activeForm.draftLink || "",
      writeup: activeForm.writeup || "",
      addedToLayout: finalAddedToLayout,
      isPendingConfirmation: false,
      progress: (activeForm.illusLayout && activeForm.illusLayout !== "Unassigned") ? "Assigned" : "Not Started",
      lastUpdated: new Date().toISOString()
    };
    
    let updated = tasks.map(t => t.id === task.id ? finalData : t);

    // Whenever assigning/confirming an Issue Layout task,
    // automatically generate/update the companion Online Pubmat assignment for the same ArtX
    if (finalData.typeOfRelease === "Issue Article" || task.typeOfRelease === "Issue Article") {
      const baseTitle = finalData.title.replace(/\s*\(Online Pubmat\)$/i, "").trim();

      const existingOnlineIdx = updated.findIndex(
        t => (t.id === `${task.id}-online` || (t.typeOfRelease === "Online Article" && t.title.replace(/\s*\(Online Pubmat\)$/i, "").trim() === baseTitle))
      );

      const onlineTitle = `${baseTitle} (Online Pubmat)`;

      const onlineTask: Task = {
        ...finalData,
        id: existingOnlineIdx !== -1 ? updated[existingOnlineIdx].id : `${task.id}-online`,
        title: onlineTitle,
        typeOfRelease: "Online Article",
        isPendingConfirmation: false,
        progress: (finalData.illusLayout && finalData.illusLayout !== "Unassigned") ? "Assigned" : "Not Started",
        lastUpdated: new Date().toISOString()
      };

      if (existingOnlineIdx !== -1) {
        updated[existingOnlineIdx] = onlineTask;
      } else {
        updated = [onlineTask, ...updated];
      }
    }

    onUpdateTasks(updated);
    
    if (editingTaskId === task.id) {
      setEditingTaskId(null);
      setEditForm(null);
    }
    
    speakText(`Confirmed and dispatched dual assignments (Issue Layout & Online Pubmat) for "${finalData.title}" to ${finalData.illusLayout}.`);
  };

  const handleConfirmAndDispatch = (task: Task) => {
    const activeForm = (editingTaskId === task.id && editForm ? { ...task, ...editForm } : task) as Task;
    executeDispatch(task, activeForm);
  };

  const handleRejectTask = (taskId: string) => {
    const updated = tasks.filter(t => t.id !== taskId && t.id !== `${taskId}-online`);
    onUpdateTasks(updated);
    
    if (editingTaskId === taskId) {
      setEditingTaskId(null);
      setEditForm(null);
    }
    
    speakText("Imported sheet assignment removed.");
  };

  const startEdit = (task: Task) => {
    setEditingTaskId(task.id);
    
    // Auto-match Canva template if possible
    const templates = getAllCanvaTemplates();
    let initialCanvaLink = task.canvaLink;
    if (!initialCanvaLink && task.typeOfContent) {
      const match = templates.find(t => t.name.toLowerCase() === task.typeOfContent.toLowerCase() || t.id.toLowerCase() === task.typeOfContent.toLowerCase());
      if (match) initialCanvaLink = match.currentLink;
    }

    const getCleanTextTitle = (input: string | undefined | null): string => {
      if (!input) return "";
      const d = extractHyperlinkDetails(input);
      const label = d.label || "";
      if (label && !label.startsWith("=HYPERLINK") && !label.startsWith("http://") && !label.startsWith("https://")) {
        return label;
      }
      if (!input.startsWith("=HYPERLINK") && !input.startsWith("http://") && !input.startsWith("https://")) {
        return input;
      }
      return "";
    };

    const docDetails = extractHyperlinkDetails(task.draftLink || task.addedToLayout);
    const writeupDetails = extractHyperlinkDetails(task.writeup);
    
    const initialTitle = getCleanTextTitle(task.writeup) || getCleanTextTitle(docDetails.label) || "";
    const initialUrl = docDetails.url || writeupDetails.url || task.draftLink || task.addedToLayout || "";

    const initialGraphics = task.graphicsIllus || task.graphics || "";

    setEditForm({
      ...task,
      graphicsIllus: initialGraphics,
      graphics: initialGraphics,
      illusLayout: task.illusLayout || "Unassigned",
      onlineHandler: task.onlineHandler || (task.illusLayout && task.illusLayout !== "Unassigned" ? task.illusLayout : ""),
      writeup: initialTitle,
      draftLink: initialUrl,
      addedToLayout: initialUrl,
      canvaLink: initialCanvaLink || ""
    });
  };

  const handleFieldChange = (key: keyof Task, val: any) => {
    setEditForm(prev => prev ? { ...prev, [key]: val } : null);
  };

  const handleFieldsChange = (updates: Partial<Task>) => {
    setEditForm(prev => prev ? { ...prev, ...updates } : null);
  };

  const handleArtxDocLinkChange = async (urlVal: string) => {
    const details = extractDocInputDetails(urlVal);
    const cleanUrl = details.url || urlVal;

    if (details.embeddedTitle) {
      handleFieldsChange({
        title: (!editForm?.title || editForm.title === "ArtX Assignment" || editForm.title.startsWith("http")) ? details.embeddedTitle : editForm.title,
        writeup: details.embeddedTitle,
        draftLink: cleanUrl,
        addedToLayout: cleanUrl ? `=HYPERLINK("${cleanUrl}", "${details.embeddedTitle}")` : ""
      });
      return;
    }

    handleFieldsChange({
      draftLink: cleanUrl,
      addedToLayout: cleanUrl
    });

    // Auto-fetch Google Docs title
    if (cleanUrl && (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://"))) {
      setIsFetchingDocTitle(true);
      try {
        const res = await fetchGoogleDocTitle(cleanUrl);
        if (res.success && res.title) {
          handleFieldsChange({
            writeup: res.title,
            title: (!editForm?.title || editForm.title === "ArtX Assignment" || editForm.title.startsWith("http")) ? res.title : editForm.title,
            draftLink: cleanUrl,
            addedToLayout: `=HYPERLINK("${cleanUrl}", "${res.title}")`
          });
        }
      } catch (err) {
        console.error("Auto fetch doc title error:", err);
      } finally {
        setIsFetchingDocTitle(false);
      }
    }
  };

  const savePendingEdit = (taskId: string) => {
    if (editForm) {
      const graphicsVal = editForm.graphicsIllus || editForm.graphics || "";
      
      const cleanWriteupCandidate = extractHyperlinkDetails(editForm.writeup).label;
      const finalWriteup = (cleanWriteupCandidate && !cleanWriteupCandidate.startsWith("=HYPERLINK") && !cleanWriteupCandidate.startsWith("http://") && !cleanWriteupCandidate.startsWith("https://"))
        ? cleanWriteupCandidate
        : (editForm.writeup && !editForm.writeup.startsWith("=HYPERLINK") && !editForm.writeup.startsWith("http://") && !editForm.writeup.startsWith("https://") ? editForm.writeup : "");

      let updated = tasks.map(t => t.id === taskId ? {
        ...t,
        ...editForm,
        writeup: finalWriteup,
        graphicsIllus: graphicsVal,
        graphics: graphicsVal,
        lastUpdated: new Date().toISOString()
      } : t);

      // If updating an Issue Article task, sync its companion Online Article task as well
      if (editForm.typeOfRelease === "Issue Article" || editForm.illusLayout) {
        const baseTitle = (editForm.title || "").replace(/\s*\(Online Pubmat\)$/i, "").trim();
        updated = updated.map(t => {
          if (t.id === `${taskId}-online` || (t.typeOfRelease === "Online Article" && t.title.replace(/\s*\(Online Pubmat\)$/i, "").trim() === baseTitle)) {
            return {
              ...t,
              illusLayout: editForm.illusLayout || t.illusLayout,
              writer: editForm.writer || t.writer,
              graphicsIllus: graphicsVal || t.graphicsIllus,
              graphics: graphicsVal || t.graphics,
              draftLink: editForm.draftLink || t.draftLink,
              addedToLayout: editForm.addedToLayout || t.addedToLayout,
              pubmatLink: editForm.pubmatLink || t.pubmatLink,
              canvaLink: editForm.canvaLink || t.canvaLink,
              writeup: editForm.writeup || t.writeup,
              releaseDate: editForm.releaseDate || t.releaseDate,
              lastUpdated: new Date().toISOString()
            };
          }
          return t;
        });
      }

      onUpdateTasks(updated);
      setEditingTaskId(null);
      setEditForm(null);
      speakText("Changes saved locally.");
    }
  };

  const filteredTasks = tasks.filter(t => {
    // Hide tasks that are print issues from the general online pubmat list unless we filter specifically
    if (t.typeOfRelease === "Issue Article" && !t.isPendingConfirmation) return false;
    // Exclude tasks pending confirmation from the main list so they only show in the confirmation deck
    if (t.isPendingConfirmation) return false;

    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) ||
                          t.writer.toLowerCase().includes(search.toLowerCase()) ||
                          t.illusLayout.toLowerCase().includes(search.toLowerCase());
    const matchesFormat = formatFilter === "All" || t.typeOfRelease === formatFilter;
    const matchesProgress = progressFilter === "All" || t.progress === progressFilter;
    return matchesSearch && matchesFormat && matchesProgress;
  });

  const priorityWeights = { Urgent: 4, High: 3, Medium: 2, Low: 1 };

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortBy === "priority") {
      return (priorityWeights[b.priority] || 0) - (priorityWeights[a.priority] || 0);
    } else {
      return a.releaseDate.localeCompare(b.releaseDate);
    }
  });

  const pendingConfirmTasks = tasks.filter(t => t.isPendingConfirmation === true);
  const isAdmin = currentUserRole === "Layout Editor" || currentUserRole === "Layout Deputy" || currentUserRole === "Online Layout Head";

  // Filter available layout and illustration staff for selection
  const staffMembers = members.filter(m => m.statusSem1 === "Active" || m.statusSem2 === "Active");

  return (
    <div className="space-y-3 sm:space-y-6">

      {/* --- GOOGLE SHEETS PENDING IMPORT DESK --- */}
      {isAdmin && pendingConfirmTasks.length > 0 && (
        <div className="bg-brand-cream/25 dark:bg-neutral-900/60 border-2 border-brand-maroon/20 dark:border-brand-maroon/40 rounded-xl sm:rounded-2xl p-3 sm:p-6 text-left space-y-2.5 sm:space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 border-b border-brand-maroon/10 dark:border-brand-maroon/20 pb-2 sm:pb-3">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="p-1.5 sm:p-2 bg-brand-maroon/10 text-brand-maroon dark:text-red-400 rounded-lg sm:rounded-xl">
                <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-display font-black text-gray-950 dark:text-neutral-100 text-xs sm:text-sm">
                  📥 Google Sheets Pending Import Desk
                </h3>
                <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-neutral-400 font-medium">
                  Verify and configure newly added rows from the Newspaper Issue sheet before dispatching.
                </p>
              </div>
            </div>
            <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-brand-maroon text-white font-bold rounded-md sm:rounded-lg text-[9px] sm:text-[10px] uppercase font-mono tracking-wider shadow-sm animate-pulse">
              {pendingConfirmTasks.length} Pending Confirmation
            </span>
          </div>

          <div className="space-y-2.5 sm:space-y-4">
            {pendingConfirmTasks.map((task) => {
              const isEditing = editingTaskId === task.id;
              
              return (
                <div 
                  key={task.id} 
                  className={`border rounded-lg sm:rounded-xl p-3 sm:p-5 bg-white dark:bg-neutral-900 transition-all shadow-sm ${
                    isEditing ? "border-brand-maroon ring-1 ring-brand-maroon/10 dark:border-red-500" : "border-gray-200 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700"
                  }`}
                >
                  {isEditing && editForm ? (
                    // Inline Editing Form
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-[10px] font-bold text-brand-maroon uppercase tracking-wider flex items-center gap-1">
                          <Edit2 className="w-3 h-3" /> Editing Assignment Details
                        </span>
                        <button 
                          onClick={() => {
                            setEditingTaskId(null);
                            setEditForm(null);
                          }}
                          className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-3.5 text-xs">
                        {/* Row 1: Artx Title | Section or Content (Canva Template) | Article Writer */}
                        <div className="space-y-1">
                          <label className="font-bold text-gray-700 dark:text-neutral-300 block">Artx Title</label>
                          <input
                            type="text"
                            value={editForm.title || ""}
                            placeholder="ArtX title or summary..."
                            onChange={(e) => handleFieldChange("title", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-250 dark:border-neutral-700 rounded-lg outline-none focus:ring-1 focus:ring-brand-maroon bg-white dark:bg-neutral-800 text-gray-800 dark:text-neutral-100"
                          />
                        </div>

                        {/* Section or Content (Canva Template) */}
                        <div className="space-y-1">
                          <label className="font-bold text-gray-700 dark:text-neutral-300 block flex items-center justify-between">
                            <span>Section or Content (Canva Template)</span>
                            {editForm.canvaLink && (
                              <span className="text-[10px] text-cyan-700 dark:text-cyan-400 font-normal">Link attached</span>
                            )}
                          </label>
                          {(() => {
                            const normalizedContentType = (editForm.typeOfContent || "").trim();
                            const selectedTemplate = canvaTemplates.find(
                              t => t.name.toLowerCase() === normalizedContentType.toLowerCase() ||
                                   t.id.toLowerCase() === normalizedContentType.toLowerCase() ||
                                   (t.id === "features" && (normalizedContentType.toLowerCase().includes("feat") || normalizedContentType === "31")) ||
                                   (t.id === "opinion" && (normalizedContentType.toLowerCase().includes("op") || normalizedContentType.toLowerCase().includes("persona"))) ||
                                   (t.id === "editorial" && normalizedContentType.toLowerCase().includes("edit")) ||
                                   (t.id === "cult" && normalizedContentType.toLowerCase().includes("cult")) ||
                                   (t.id === "news" && normalizedContentType.toLowerCase().includes("news"))
                            );
                            const selectValue = selectedTemplate ? selectedTemplate.name : normalizedContentType;

                            return (
                              <select
                                value={selectValue}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const match = canvaTemplates.find(
                                    t => t.name.toLowerCase() === val.toLowerCase() || t.id.toLowerCase() === val.toLowerCase()
                                  );
                                  handleFieldsChange({
                                    typeOfContent: val,
                                    canvaLink: match ? match.currentLink : (editForm.canvaLink || "")
                                  });
                                }}
                                className="w-full px-3 py-2 border border-gray-250 dark:border-neutral-700 rounded-lg outline-none focus:ring-1 focus:ring-brand-maroon bg-white dark:bg-neutral-800 text-gray-800 dark:text-neutral-100 font-medium cursor-pointer"
                              >
                                <option value="">-- Select Canva Asset Template --</option>
                                
                                {/* Fallback option for custom/unmatched section names */}
                                {!selectedTemplate && normalizedContentType && (
                                  <option value={normalizedContentType}>{normalizedContentType}</option>
                                )}

                                {["Editorial", "Visuals & Layouts", "Branding & Gen"].map(cat => {
                                  const catTemplates = canvaTemplates.filter(t => t.category === cat);
                                  if (catTemplates.length === 0) return null;
                                  return (
                                    <optgroup key={cat} label={`--- ${cat} ---`}>
                                      {catTemplates.map(t => (
                                        <option key={t.id} value={t.name}>
                                          {t.name}
                                        </option>
                                      ))}
                                    </optgroup>
                                  );
                                })}
                              </select>
                            );
                          })()}
                        </div>

                        {/* Article Writer */}
                        <div className="space-y-1">
                          <label className="font-bold text-gray-700 dark:text-neutral-300 block">Article Writer</label>
                          <input
                            type="text"
                            value={editForm.writer || ""}
                            placeholder="e.g. Moy, Bryle"
                            onChange={(e) => handleFieldChange("writer", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-250 dark:border-neutral-700 rounded-lg outline-none focus:ring-1 focus:ring-brand-maroon bg-white dark:bg-neutral-800 text-gray-800 dark:text-neutral-100"
                          />
                        </div>

                        {/* Row 2: Assigned Layout Artist | Illustrator | Online Pubmat */}
                        <div className="space-y-1">
                          <label className="font-bold text-gray-700 dark:text-neutral-300 block">Assigned Layout Artist</label>
                          {(() => {
                            const currentVal = editForm.illusLayout || "Unassigned";
                            const getFirstName = (name: string) => name.split(" ")[0].trim();
                            
                            const exactMatch = staffMembers.find(m => m.name === currentVal);
                            const fuzzyMatch = !exactMatch ? staffMembers.find(m => 
                              m.name.toLowerCase() === currentVal.toLowerCase() || 
                              getFirstName(m.name).toLowerCase() === currentVal.toLowerCase() ||
                              m.name.toLowerCase().includes(currentVal.toLowerCase()) ||
                              currentVal.toLowerCase().includes(getFirstName(m.name).toLowerCase())
                            ) : null;
                            
                            const selectVal = exactMatch ? exactMatch.name : (fuzzyMatch ? fuzzyMatch.name : currentVal);
                            const hasMatchInStaff = Boolean(exactMatch || fuzzyMatch || selectVal === "Unassigned");

                            return (
                              <select
                                value={selectVal}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const syncPubmat = val === "Unassigned" ? "" : val;
                                  handleFieldsChange({
                                    illusLayout: val,
                                    onlineHandler: syncPubmat
                                  });
                                }}
                                className="w-full px-3 py-2 border border-gray-250 dark:border-neutral-700 rounded-lg outline-none focus:ring-1 focus:ring-brand-maroon bg-white dark:bg-neutral-800 text-gray-800 dark:text-neutral-100 cursor-pointer"
                              >
                                <option value="Unassigned">Unassigned</option>
                                {!hasMatchInStaff && currentVal && currentVal !== "Unassigned" && (
                                  <option value={currentVal}>{currentVal}</option>
                                )}
                                {staffMembers.map(m => (
                                  <option key={m.id} value={m.name}>
                                    {m.displayName || getOfficialDisplayName(m.email, m.name)} ({m.role})
                                  </option>
                                ))}
                              </select>
                            );
                          })()}
                        </div>

                        {/* Illustrator */}
                        <div className="space-y-1">
                          <label className="font-bold text-gray-700 dark:text-neutral-300 block">Illustrator</label>
                          <input
                            type="text"
                            value={editForm.graphicsIllus || editForm.graphics || ""}
                            placeholder="e.g. Illustrator or artist name"
                            onChange={(e) => {
                              const val = e.target.value;
                              handleFieldsChange({
                                graphicsIllus: val,
                                graphics: val
                              });
                            }}
                            className="w-full px-3 py-2 border border-gray-250 dark:border-neutral-700 rounded-lg outline-none focus:ring-1 focus:ring-brand-maroon bg-white dark:bg-neutral-800 text-gray-800 dark:text-neutral-100"
                          />
                        </div>

                        {/* Online Pubmat */}
                        <div className="space-y-1">
                          <label className="font-bold text-gray-700 dark:text-neutral-300 block">Online Pubmat</label>
                          <input
                            type="text"
                            value={editForm.onlineHandler || (editForm.illusLayout && editForm.illusLayout !== "Unassigned" ? editForm.illusLayout : "")}
                            placeholder="e.g. Layout artist / pubmat handler"
                            onChange={(e) => handleFieldChange("onlineHandler", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-250 dark:border-neutral-700 rounded-lg outline-none focus:ring-1 focus:ring-brand-maroon bg-white dark:bg-neutral-800 text-gray-800 dark:text-neutral-100"
                          />
                        </div>

                        {/* Row 3: Artx Document Title | ArtX Document Link | Google Drive Link (Optional) */}
                        <div className="space-y-1">
                          <label className="font-bold text-gray-700 dark:text-neutral-300 block">Artx Document Title</label>
                          <input
                            type="text"
                            value={editForm.writeup || ""}
                            placeholder="e.g. Final Article Draft Title"
                            onChange={(e) => handleFieldChange("writeup", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-250 dark:border-neutral-700 rounded-lg outline-none focus:ring-1 focus:ring-brand-maroon bg-white dark:bg-neutral-800 text-gray-800 dark:text-neutral-100 text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-gray-700 dark:text-neutral-300 block flex items-center justify-between">
                            <span>ArtX Document Link</span>
                            {isFetchingDocTitle && (
                              <span className="text-[10px] text-brand-maroon dark:text-red-400 font-semibold animate-pulse">Auto-fetching title...</span>
                            )}
                          </label>
                          <input
                            type="text"
                            value={editForm.draftLink || editForm.addedToLayout || ""}
                            placeholder="https://docs.google.com/document/d/..."
                            onChange={(e) => handleArtxDocLinkChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-250 dark:border-neutral-700 rounded-lg outline-none focus:ring-1 focus:ring-brand-maroon bg-white dark:bg-neutral-800 text-gray-800 dark:text-neutral-100 font-mono text-xs"
                          />
                          {(editForm.writeup && editForm.writeup !== editForm.draftLink && !editForm.writeup.startsWith("http")) && (
                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800 animate-fade-in">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="truncate">Doc Title: "{editForm.writeup}"</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-emerald-800 dark:text-emerald-400 block flex items-center gap-1">
                            <FolderPlus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Illustration Link (Optional)</span>
                          </label>
                          <input
                            type="text"
                            value={editForm.pubmatLink || ""}
                            placeholder="https://drive.google.com/..."
                            onChange={(e) => handleFieldChange("pubmatLink", e.target.value)}
                            className="w-full px-3 py-2 border border-emerald-300 dark:border-emerald-700/60 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-neutral-800 text-gray-800 dark:text-neutral-100 font-mono text-xs"
                          />
                        </div>

                        {/* Row 4: Format Destination | Assignment Priority | Release Target/Date */}
                        <div className="space-y-1">
                          <label className="font-bold text-gray-700 dark:text-neutral-300 block">Format Destination</label>
                          <select
                            value={editForm.typeOfRelease || "Issue Article"}
                            onChange={(e) => handleFieldChange("typeOfRelease", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-250 dark:border-neutral-700 rounded-lg outline-none focus:ring-1 focus:ring-brand-maroon bg-white dark:bg-neutral-800 text-gray-800 dark:text-neutral-100 cursor-pointer"
                          >
                            <option value="Issue Article">Issue Article (Print Issue)</option>
                            <option value="Online Article">Online Article (Pubmat Dashboard)</option>
                            <option value="Multimedia">Multimedia Layout</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-gray-700 dark:text-neutral-300 block">Assignment Priority</label>
                          <select
                            value={editForm.priority || "Medium"}
                            onChange={(e) => handleFieldChange("priority", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-250 dark:border-neutral-700 rounded-lg outline-none focus:ring-1 focus:ring-brand-maroon bg-white dark:bg-neutral-800 text-gray-800 dark:text-neutral-100 cursor-pointer"
                          >
                            <option value="Low">Low Priority</option>
                            <option value="Medium">Medium Priority</option>
                            <option value="High">High Priority</option>
                            <option value="Urgent">Urgent Priority</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-gray-700 dark:text-neutral-300 block">Release Target/Date</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="date"
                              value={toISOFormatDate(editForm.releaseDate || "")}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val) {
                                  handleFieldChange("releaseDate", formatISOToDisplayDate(val));
                                } else {
                                  handleFieldChange("releaseDate", "");
                                }
                              }}
                              className="px-2.5 py-2 border border-gray-250 dark:border-neutral-700 rounded-lg outline-none focus:ring-1 focus:ring-brand-maroon bg-white dark:bg-neutral-800 text-gray-800 dark:text-neutral-100 text-xs font-medium cursor-pointer flex-1 min-w-0"
                            />
                            <input
                              type="text"
                              value={editForm.releaseDate || ""}
                              placeholder="e.g. JULY 15"
                              onChange={(e) => handleFieldChange("releaseDate", e.target.value)}
                              className="w-24 sm:w-28 px-2 py-2 border border-gray-250 dark:border-neutral-700 rounded-lg outline-none focus:ring-1 focus:ring-brand-maroon bg-white dark:bg-neutral-800 text-gray-800 dark:text-neutral-100 text-xs font-semibold text-center uppercase shrink-0"
                              title="Formatted date label"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Google Doc Auto-Share Permissions Widget (Placed cleanly below 4 rows) */}
                      <div className="pt-2">
                        <GoogleDocShareWidget
                          docUrl={editForm.draftLink || editForm.addedToLayout || editForm.pubmatLink || ""}
                          assignedMemberName={editForm.illusLayout || "Unassigned"}
                          members={members}
                        />
                      </div>

                      <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
                        <button 
                          onClick={() => {
                            setEditingTaskId(null);
                            setEditForm(null);
                          }}
                          className="px-3.5 py-2 border border-gray-200 text-gray-500 hover:text-gray-800 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => savePendingEdit(task.id)}
                          className="px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                        >
                          Save Progress Details
                        </button>
                        <button 
                          onClick={() => handleConfirmAndDispatch(task)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1 cursor-pointer animate-bounce"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Confirm & Dispatch Direct
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Regular View mode with action triggers
                    <div className="flex flex-col md:flex-row justify-between gap-3 sm:gap-5 text-xs text-left">
                      <div className="space-y-2 sm:space-y-3 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="text-[8px] sm:text-[9px] font-bold uppercase px-1.5 sm:px-2 py-0.5 rounded bg-brand-maroon/5 dark:bg-red-950/40 text-brand-maroon dark:text-red-300 border border-brand-maroon/10 dark:border-red-800">
                            {task.typeOfContent}
                          </span>
                          <span className="text-[8px] sm:text-[9px] font-bold uppercase px-1.5 sm:px-2 py-0.5 rounded bg-amber-500/10 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-500/20 dark:border-amber-800">
                            Sheets Row Import
                          </span>
                        </div>

                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-gray-900 dark:text-neutral-100 leading-snug">
                            {task.title}
                          </h4>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 text-[11px] sm:text-xs pt-0.5 sm:pt-1">
                          <div>
                            <span className="text-gray-400 dark:text-neutral-500 block font-semibold text-[8px] sm:text-[9px] uppercase">Writer</span>
                            <span className="font-bold text-gray-800 dark:text-neutral-200">{task.writer}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 dark:text-neutral-500 block font-semibold text-[8px] sm:text-[9px] uppercase">Layout Artist</span>
                            <span className="font-bold text-gray-800 dark:text-neutral-200">{task.illusLayout}</span>
                          </div>
                          {task.graphicsIllus && (
                            <div>
                              <span className="text-gray-400 dark:text-neutral-500 block font-semibold text-[8px] sm:text-[9px] uppercase">Graphics/Illus</span>
                              <span className="font-bold text-gray-800 dark:text-neutral-200">{task.graphicsIllus}</span>
                            </div>
                          )}
                          {task.onlineHandler && (
                            <div>
                              <span className="text-gray-400 dark:text-neutral-500 block font-semibold text-[8px] sm:text-[9px] uppercase">Online</span>
                              <span className="font-bold text-gray-800 dark:text-neutral-200">{task.onlineHandler}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-x-3 sm:gap-x-4 gap-y-1 sm:gap-y-2 text-[10px] sm:text-[11px] text-gray-500 dark:text-neutral-400 pt-1 sm:pt-1.5 border-t border-gray-50 dark:border-neutral-800">
                          {(task.draftLink || task.addedToLayout) && (() => {
                            const doc = extractHyperlinkDetails(task.draftLink || task.addedToLayout);
                            return (
                              <span className="truncate flex items-center gap-1">
                                <strong>ArtX Doc:</strong>
                                {doc.url ? (
                                  <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-brand-maroon dark:text-red-400 underline font-semibold hover:text-red-800 dark:hover:text-red-300">
                                    {doc.label || "Open Document"}
                                  </a>
                                ) : (
                                  <span>{doc.label}</span>
                                )}
                              </span>
                            );
                          })()}
                          {task.pubmatLink && (() => {
                            const drive = extractHyperlinkDetails(task.pubmatLink);
                            return (
                              <span className="truncate flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                                <strong>Drive:</strong>
                                <a href={drive.url} target="_blank" rel="noopener noreferrer" className="underline font-semibold hover:text-emerald-900 dark:hover:text-emerald-300">
                                  {drive.label || "Open Drive"}
                                </a>
                              </span>
                            );
                          })()}
                          <span>
                            <strong>Release Target:</strong> {task.releaseDate}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-row md:flex-col items-stretch justify-center gap-1.5 sm:gap-2 sm:self-end md:self-center shrink-0 w-full md:w-auto">
                        <button
                          onClick={() => startEdit(task)}
                          className="flex-1 md:flex-initial px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-250 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-bold rounded-lg sm:rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all text-[11px] sm:text-xs"
                        >
                          <Edit2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => handleRejectTask(task.id)}
                          className="flex-1 md:flex-initial px-2 sm:px-3 py-1.5 sm:py-2 border border-red-200 dark:border-red-800/80 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 font-bold rounded-lg sm:rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all text-[11px] sm:text-xs"
                        >
                          <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Reject
                        </button>
                        <button
                          onClick={() => handleConfirmAndDispatch(task)}
                          className="flex-1 md:flex-initial px-2.5 sm:px-4 py-1.5 sm:py-2.5 bg-brand-maroon hover:bg-brand-maroon-dark text-white font-bold rounded-lg sm:rounded-xl flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer transition-all shadow-md text-[11px] sm:text-xs"
                        >
                          <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Dispatch
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search and Filters Hub */}
      <div className="bg-white dark:bg-neutral-900 p-2.5 sm:p-4 rounded-xl border border-gray-100 dark:border-neutral-800 flex flex-col md:flex-row gap-2.5 sm:gap-4 items-center justify-between shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 absolute left-2.5 sm:left-3 top-2.5 sm:top-3 text-gray-400 dark:text-neutral-500" />
          <input
            type="text"
            placeholder="Search tasks by layout name, writer, or artist..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 sm:pl-9 pr-3 sm:pr-4 py-1.5 sm:py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-[11px] sm:text-xs outline-none focus:bg-white dark:focus:bg-neutral-800 text-gray-800 dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-brand-maroon transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 w-full md:w-auto">
          {/* Format */}
          <div className="flex items-center gap-1 sm:gap-1.5 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg px-2 sm:px-2.5 py-1 sm:py-1.5 text-[11px] sm:text-xs text-gray-700 dark:text-neutral-200 font-semibold">
            <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400 dark:text-neutral-400" />
            <select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
              className="bg-transparent outline-none cursor-pointer text-gray-800 dark:text-neutral-200"
            >
              <option value="Online Article" className="dark:bg-neutral-800">Online Article</option>
              <option value="Multimedia" className="dark:bg-neutral-800">Multimedia</option>
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1 sm:gap-1.5 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg px-2 sm:px-2.5 py-1 sm:py-1.5 text-[11px] sm:text-xs text-gray-700 dark:text-neutral-200 font-semibold">
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400 dark:text-neutral-400" />
            <select
              value={progressFilter}
              onChange={(e) => setProgressFilter(e.target.value)}
              className="bg-transparent outline-none cursor-pointer text-gray-800 dark:text-neutral-200"
            >
              <option value="All" className="dark:bg-neutral-800">All Progress</option>
              <option value="Assigned" className="dark:bg-neutral-800">Assigned</option>
              <option value="In Progress" className="dark:bg-neutral-800">In Progress</option>
              <option value="For Review" className="dark:bg-neutral-800">For Review</option>
              <option value="Revision Needed" className="dark:bg-neutral-800">Revision Needed</option>
              <option value="Completed" className="dark:bg-neutral-800">Completed</option>
            </select>
          </div>

          {/* Sort button */}
          <button
            onClick={() => {
              const next = sortBy === "date" ? "priority" : "date";
              setSortBy(next);
              speakText(`Sorted tasks by ${next}`);
            }}
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 border border-gray-200 dark:border-neutral-700 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center gap-1 sm:gap-1.5 bg-gray-50 dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-750 transition-all text-gray-700 dark:text-neutral-200 cursor-pointer"
          >
            <ArrowUpDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400 dark:text-neutral-400" />
            Sort: {sortBy === "date" ? "Target Date" : "Priority"}
          </button>

          {isAdmin && (
            <button
              onClick={onAddTask}
              className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 bg-brand-maroon hover:bg-brand-maroon-dark text-white rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Assign Layout
            </button>
          )}
        </div>
      </div>

      {/* Grid List */}
      {sortedTasks.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200/80 dark:border-neutral-800 rounded-2xl p-8 sm:p-12 text-center text-gray-500 dark:text-neutral-400 text-xs space-y-2">
          <ClipboardList className="w-8 h-8 text-gray-400 mx-auto" />
          <p className="font-bold text-gray-700 dark:text-neutral-200 text-sm">No layout assignments found</p>
          <p className="max-w-md mx-auto">
            There are currently no tasks matching your filters. Click "Assign Layout" above or import tasks from Google Sheets to populate your queue.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
          {sortedTasks.map(task => {
          const isOverdue = task.progress !== "Completed" && task.priority === "Urgent";
          return (
            <div 
              key={task.id} 
              className={`glass-card hover:shadow-md rounded-xl sm:rounded-2xl p-3.5 sm:p-5 border transition-all flex flex-col justify-between space-y-2.5 sm:space-y-4 text-left ${
                isOverdue 
                  ? "border-red-200 dark:border-red-800 bg-red-50/10 dark:bg-red-950/20" 
                  : "border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900"
              }`}
              onMouseEnter={() => speakText(`Layout assignment card for: ${task.title}. Assigned to: ${task.illusLayout}`)}
            >
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-brand-maroon/5 dark:bg-brand-maroon/20 text-brand-maroon dark:text-red-400 border border-brand-maroon/10 dark:border-brand-maroon/30">
                    {task.typeOfRelease}
                  </span>
                  
                  {/* Priority Pill */}
                  <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded ${
                    task.priority === "Urgent" ? "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800" :
                    task.priority === "High" ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800" :
                    task.priority === "Medium" ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800" : 
                    "bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 border border-gray-200 dark:border-neutral-700"
                  }`}>
                    {task.priority} Priority
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-gray-950 dark:text-neutral-100 text-xs sm:text-sm leading-snug hover:text-brand-maroon dark:hover:text-red-400 cursor-pointer transition-all"
                      onClick={() => onOpenTaskDetails(task)}>
                    {task.title}
                  </h4>
                  <p className="text-[9px] sm:text-[10px] text-gray-400 dark:text-neutral-400 mt-0.5 font-mono">ID: {task.writeup || "Drafting"}</p>
                </div>

                {task.canvaLink && (
                  <div className="bg-cyan-50/60 dark:bg-cyan-950/40 border border-cyan-100 dark:border-cyan-800 p-1.5 sm:p-2 rounded-lg sm:rounded-xl flex items-center justify-between gap-2 text-[10px]">
                    <span className="text-cyan-800 dark:text-cyan-300 font-medium truncate block flex-1 font-mono text-[9px] sm:text-[10px]">
                      {task.canvaLink}
                    </span>
                    <a 
                      href={task.canvaLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-0.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg text-[8px] sm:text-[9px] flex items-center gap-0.5 shrink-0"
                    >
                      Canva <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-1.5 sm:gap-2 pt-1.5 sm:pt-2 border-t border-gray-100 dark:border-neutral-800 text-[11px] sm:text-xs">
                  <div>
                    <span className="text-[9px] sm:text-[10px] text-gray-400 dark:text-neutral-400 uppercase font-semibold block">Writer</span>
                    <span className="font-bold text-gray-700 dark:text-neutral-200 truncate block">{task.writer}</span>
                  </div>
                  <div>
                    <span className="text-[9px] sm:text-[10px] text-gray-400 dark:text-neutral-400 uppercase font-semibold block">Layout Artist</span>
                    <span className="font-bold text-gray-700 dark:text-neutral-200 truncate block flex items-center gap-1">
                      <User className="w-3 h-3 text-brand-maroon dark:text-red-400 shrink-0" />
                      <span className="truncate">{task.illusLayout}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Select and Actions */}
              <div className="pt-2 sm:pt-3 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between gap-2 sm:gap-3 text-xs">
                <div>
                  <span className="text-[8px] sm:text-[9px] text-gray-400 dark:text-neutral-400 font-semibold uppercase block mb-0.5 sm:mb-1">Update Status</span>
                  <select
                    value={task.progress}
                    onChange={(e) => handleStatusChange(task.id, e.target.value as any)}
                    className="px-2 sm:px-2.5 py-1 border border-gray-200 dark:border-neutral-700 rounded-lg text-[11px] sm:text-xs outline-none cursor-pointer bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-200 focus:ring-2 focus:ring-brand-maroon"
                  >
                    <option value="Not Started" className="dark:bg-neutral-800">Not Started</option>
                    <option value="Assigned" className="dark:bg-neutral-800">Assigned</option>
                    <option value="In Progress" className="dark:bg-neutral-800">In Progress</option>
                    <option value="For Review" className="dark:bg-neutral-800">For Review</option>
                    <option value="Revision Needed" className="dark:bg-neutral-800">Revision Needed</option>
                    <option value="Completed" className="dark:bg-neutral-800">Completed</option>
                  </select>
                </div>

                <button
                  onClick={() => {
                    onOpenTaskDetails(task);
                    speakText("Opening full workspace dialogue for layout assignment card.");
                  }}
                  className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-brand-cream dark:bg-neutral-800 hover:bg-brand-maroon dark:hover:bg-brand-maroon text-brand-maroon dark:text-red-300 hover:text-white dark:hover:text-white border border-brand-maroon/20 dark:border-neutral-700 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                >
                  Workspace <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </button>
              </div>

            </div>
          );
        })}
        </div>
      )}

      {/* Modal for Google Doc Permission Confirmation */}
      <GoogleDocConfirmModal
        isOpen={Boolean(confirmModalData)}
        taskTitle={confirmModalData?.activeForm.title || ""}
        docUrl={confirmModalData?.docUrl || ""}
        assignedMemberName={confirmModalData?.assignedName || ""}
        members={members}
        onConfirm={async () => {
          if (confirmModalData) {
            executeDispatch(confirmModalData.task, confirmModalData.activeForm);
            setConfirmModalData(null);
          }
        }}
        onCancel={() => setConfirmModalData(null)}
      />
    </div>
  );
}
