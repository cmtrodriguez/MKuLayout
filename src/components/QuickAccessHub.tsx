import React, { useState } from "react";
import { 
  Plus, ExternalLink, FileSpreadsheet, FileText, Calendar, 
  Sparkles, Palette, Trash2, Edit3, ShieldAlert, CheckCircle 
} from "lucide-react";

interface QuickLink {
  id: string;
  title: string;
  category: "Canva Template" | "Google Workspace" | "Reference Guide";
  subcategory?: string;
  url: string;
  description: string;
}

interface QuickAccessHubProps {
  speechEnabled: boolean;
  currentUserRole: string;
}

export default function QuickAccessHub({ speechEnabled, currentUserRole }: QuickAccessHubProps) {
  const [links, setLinks] = useState<QuickLink[]>(() => {
    try {
      const saved = localStorage.getItem("mku_quick_links");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<QuickLink["category"]>("Canva Template");
  const [newSubcategory, setNewSubcategory] = useState("News/Editorial");
  const [newUrl, setNewUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const speakText = (text: string) => {
    if (!speechEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  };

  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newUrl) {
      speakText("Please fill out the Title and URL fields.");
      return;
    }

    const newLink: QuickLink = {
      id: `l-${Date.now()}`,
      title: newTitle,
      category: newCategory,
      subcategory: newCategory === "Canva Template" ? newSubcategory : "Workspace/Ref",
      url: newUrl.startsWith("http") ? newUrl : `https://${newUrl}`,
      description: newDescription || "No description provided."
    };

    const next = [...links, newLink];
    setLinks(next);
    localStorage.setItem("mku_quick_links", JSON.stringify(next));
    setNewTitle("");
    setNewUrl("");
    setNewDescription("");
    setShowAddModal(false);
    speakText(`Shortcut link for ${newTitle} has been successfully added to the hub.`);
  };

  const handleDeleteLink = (id: string, title: string) => {
    const next = links.filter(l => l.id !== id);
    setLinks(next);
    localStorage.setItem("mku_quick_links", JSON.stringify(next));
    speakText(`Deleted link shortcut for ${title}`);
  };

  const isAdmin = currentUserRole === "Layout Editor" || currentUserRole === "Online Layout Head";

  const canvaLinks = links.filter(l => l.category === "Canva Template");
  const workspaceLinks = links.filter(l => l.category === "Google Workspace");
  const referenceLinks = links.filter(l => l.category === "Reference Guide");

  return (
    <div className="space-y-6">
      
      {/* Header Panel */}
      <div className="bg-white p-5 rounded-2xl border border-brand-maroon/5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2">
            <Palette className="w-5 h-5 text-brand-maroon" />
            Workspace Shortcuts & Canva Hub
          </h2>
          <p className="text-xs text-gray-500">
            Easily launch official InDesign/Canva publication templates, access Google Drive article logs, or reference publication style guides.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setShowAddModal(true);
              speakText("Opened shortcut link creator modal.");
            }}
            className="px-4 py-2.5 bg-brand-maroon hover:bg-brand-maroon-dark text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Shortcut
          </button>
        )}
      </div>

      {links.length === 0 && (
        <div className="bg-white/60 border border-gray-200/80 rounded-2xl p-8 text-center text-gray-500 text-xs space-y-2">
          <Palette className="w-8 h-8 text-gray-400 mx-auto" />
          <p className="font-bold text-gray-700 text-sm">No shortcuts or templates registered yet</p>
          <p className="max-w-md mx-auto">
            Use the "Add Shortcut" button above to attach your official Canva layout templates, Google Sheets trackers, or InDesign guides.
          </p>
        </div>
      )}

      {/* Grid segments */}
      {links.length > 0 && (
      <div className="space-y-8">
        
        {/* Section 1: Canva templates */}
        {canvaLinks.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b pb-2 border-gray-100">
            <span className="p-1 bg-amber-500/10 text-amber-600 rounded">
              <Palette className="w-4 h-4" />
            </span>
            <h3 className="font-display font-bold text-gray-950 text-sm">Canva Graphic & Pub Templates</h3>
            <span className="text-[10px] font-mono text-gray-400">Pre-measured guidelines</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {canvaLinks.map(link => (
                <div 
                  key={link.id} 
                  className="glass-card hover:shadow-md hover:border-brand-maroon/20 rounded-2xl p-5 flex flex-col justify-between space-y-4 group transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-bold uppercase rounded">
                        {link.subcategory}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteLink(link.id, link.title)}
                          className="text-gray-300 hover:text-red-500 p-1 rounded transition-all opacity-0 group-hover:opacity-100"
                          title="Delete shortcut"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <h4 className="font-bold text-gray-900 text-sm group-hover:text-brand-maroon transition-all">
                      {link.title}
                    </h4>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {link.description}
                    </p>
                  </div>

                  <div>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                      onClick={() => speakText(`Opening Canva template for ${link.title}`)}
                    >
                      Use Canva Template <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
          </div>
        </div>
        )}

        {/* Section 2: Google Workspace links */}
        {workspaceLinks.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b pb-2 border-gray-100">
            <span className="p-1 bg-green-500/10 text-green-600 rounded">
              <FileSpreadsheet className="w-4 h-4" />
            </span>
            <h3 className="font-display font-bold text-gray-950 text-sm">Google Workspace Integration Files</h3>
            <span className="text-[10px] font-mono text-gray-400">Live collaboration</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaceLinks.map(link => {
                const isSheet = link.title.toLowerCase().includes("sheet") || link.title.toLowerCase().includes("spread");
                return (
                  <div 
                    key={link.id} 
                    className="glass-card hover:shadow-md hover:border-brand-maroon/20 rounded-2xl p-5 flex flex-col justify-between space-y-4 group transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${
                          isSheet 
                            ? "bg-green-50 text-green-700 border-green-100" 
                            : "bg-blue-50 text-blue-700 border-blue-100"
                        }`}>
                          {isSheet ? "Google Sheets" : "Google Drive / Docs"}
                        </span>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteLink(link.id, link.title)}
                            className="text-gray-300 hover:text-red-500 p-1 rounded transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <h4 className="font-bold text-gray-900 text-sm group-hover:text-brand-maroon transition-all">
                        {link.title}
                      </h4>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        {link.description}
                      </p>
                    </div>

                    <div>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border ${
                          isSheet 
                            ? "bg-green-50 hover:bg-green-100 text-green-900 border-green-200" 
                            : "bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-200"
                        }`}
                        onClick={() => speakText(`Opening Google Workspace file: ${link.title}`)}
                      >
                        Open Workspace File <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
        )}

        {/* Section 3: Reference guides & standards */}
        {referenceLinks.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b pb-2 border-gray-100">
            <span className="p-1 bg-purple-500/10 text-purple-600 rounded">
              <FileText className="w-4 h-4" />
            </span>
            <h3 className="font-display font-bold text-gray-950 text-sm">Reference Guides & Contrast Rules</h3>
            <span className="text-[10px] font-mono text-gray-400">Design guidelines</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {referenceLinks.map(link => (
                <div 
                  key={link.id} 
                  className="glass-card hover:shadow-md hover:border-brand-maroon/20 rounded-2xl p-5 flex flex-col justify-between space-y-4 group transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 text-[10px] font-bold uppercase rounded">
                        {link.subcategory || "Rules"}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteLink(link.id, link.title)}
                          className="text-gray-300 hover:text-red-500 p-1 rounded transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <h4 className="font-bold text-gray-900 text-sm group-hover:text-brand-maroon transition-all">
                      {link.title}
                    </h4>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {link.description}
                    </p>
                  </div>

                  <div>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                      onClick={() => speakText(`Viewing design specifications guidelines`)}
                    >
                      View Style Book <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
          </div>
        </div>
        )}

      </div>
      )}

      {/* Add Shortcut link Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleAddLink}
            className="bg-white rounded-3xl p-6 border border-brand-maroon/10 shadow-2xl w-full max-w-md space-y-4"
          >
            <div className="border-b pb-2 flex items-center justify-between">
              <h3 className="font-display font-bold text-gray-900 text-base">Create Shortcut Link</h3>
              <button 
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-700 text-xs font-semibold"
              >
                Close
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Shortcut Title</label>
                <input
                  type="text"
                  placeholder="e.g. Sports Advisory Canva Template"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Shortcut Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => {
                    setNewCategory(e.target.value as any);
                    if (e.target.value === "Canva Template") {
                      setNewSubcategory("News/Editorial");
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs cursor-pointer focus:ring-2 focus:ring-brand-maroon"
                >
                  <option value="Canva Template">Canva Template</option>
                  <option value="Google Workspace">Google Workspace File / Folder</option>
                  <option value="Reference Guide">Reference Style Book</option>
                </select>
              </div>

              {newCategory === "Canva Template" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Canva Pub Type</label>
                  <select
                    value={newSubcategory}
                    onChange={(e) => setNewSubcategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs cursor-pointer focus:ring-2 focus:ring-brand-maroon"
                  >
                    <option value="News/Editorial">News / Editorial</option>
                    <option value="Features/Culture">Features / Culture</option>
                    <option value="Advisories">Advisories</option>
                    <option value="Illustration">Illustration</option>
                    <option value="Shortform">Shortform</option>
                    <option value="Multi-page Pubs">Multi-page Pubs</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Target Link URL</label>
                <input
                  type="text"
                  placeholder="https://canva.com/design/... or Google URL"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Quick Description</label>
                <textarea
                  placeholder="Who should use this, and what is it for?"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-maroon resize-none"
                />
              </div>

              <div className="flex items-center gap-1.5 p-2 bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-100">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[10px]">Adding shortcuts updates layout files for all layout staff members.</span>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-brand-maroon hover:bg-brand-maroon-dark text-white font-bold rounded-lg transition-all"
              >
                Save Shortcut
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
