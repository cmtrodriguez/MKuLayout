import React, { useState, useEffect } from "react";
import { 
  Link as LinkIcon, ExternalLink, Edit2, Save, Copy, Check, 
  Search, RotateCcw, LayoutGrid, ChevronDown, ChevronUp, Sparkles, Plus, Trash2, X
} from "lucide-react";

interface CanvaTemplate {
  id: string;
  name: string;
  category: "Branding & Gen" | "Editorial" | "Visuals & Layouts";
  defaultLink: string;
  isCustom?: boolean;
}

const DEFAULT_TEMPLATES: CanvaTemplate[] = [
  { id: "logo", name: "Logo", category: "Branding & Gen", defaultLink: "https://canva.link/l3llvrp9kwrgg3m" },
  { id: "cover-photo", name: "Cover Photo", category: "Branding & Gen", defaultLink: "https://canva.link/6mquv2ahy9tvuux" },
  { id: "header", name: "Header", category: "Branding & Gen", defaultLink: "https://canva.link/3tafgcpim4bufdk" },
  { id: "press-id", name: "Press ID", category: "Branding & Gen", defaultLink: "https://canva.link/press-id" },
  { id: "editorial-board", name: "Editorial Board", category: "Branding & Gen", defaultLink: "https://canva.link/editorial-board" },
  
  { id: "news", name: "News", category: "Editorial", defaultLink: "https://canva.link/wivqojjmn675ek9" },
  { id: "opinion", name: "Opinion", category: "Editorial", defaultLink: "https://canva.link/m4fmpvw4jhqu63s" },
  { id: "editorial", name: "Editorial", category: "Editorial", defaultLink: "https://canva.link/k6wnamj4r2p7n04" },
  { id: "medium", name: "Medium", category: "Editorial", defaultLink: "https://canva.link/5yuv72zezab85he" },
  { id: "features", name: "Features", category: "Editorial", defaultLink: "https://canva.link/njge9atp9633hpf" },
  { id: "culture", name: "Culture", category: "Editorial", defaultLink: "https://canva.link/s0vxxbc10zgoajg" },
  { id: "fta", name: "FTA", category: "Editorial", defaultLink: "https://canva.link/d04jojiynnkfhkl" },
  { id: "kultorepaso", name: "Kultorepaso", category: "Editorial", defaultLink: "https://canva.link/frvsal372oghuq1" },
  { id: "jst", name: "JST", category: "Editorial", defaultLink: "https://canva.link/jst" },
  
  { id: "advisories", name: "Advisories", category: "Visuals & Layouts", defaultLink: "https://canva.link/fkmevv8z959kpbs" },
  { id: "standalone-illus", name: "Standalone Illus", category: "Visuals & Layouts", defaultLink: "https://canva.link/exxhxuypbjzbj7k" },
  { id: "photo-essay", name: "Photo Essay", category: "Visuals & Layouts", defaultLink: "https://canva.link/photo-essay" },
  { id: "multiple-page-pubs", name: "Multiple Page Pubs", category: "Visuals & Layouts", defaultLink: "https://canva.link/zh2imiqoh8uu0qs" },
  { id: "donation-pubmat", name: "Donation Pubmat", category: "Visuals & Layouts", defaultLink: "https://canva.link/donation-pubmat" },
];

interface CanvaDirectoryProps {
  currentUserRole?: string;
}

export function CanvaDirectory({ currentUserRole }: CanvaDirectoryProps = {}) {
  const isLayoutStaff = currentUserRole === "Layout Staff Member";
  const [isOpen, setIsOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [links, setLinks] = useState<Record<string, string>>({});
  const [customTemplates, setCustomTemplates] = useState<CanvaTemplate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Template Form modal/inline state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<"Branding & Gen" | "Editorial" | "Visuals & Layouts">("Editorial");
  const [newLink, setNewLink] = useState("");

  useEffect(() => {
    // Load links from localStorage or fall back to defaults
    const storedLinks = localStorage.getItem("mku_canva_template_links_v2");
    const storedCustom = localStorage.getItem("mku_custom_canva_templates");

    let initialCustom: CanvaTemplate[] = [];
    if (storedCustom) {
      try {
        initialCustom = JSON.parse(storedCustom);
        setCustomTemplates(initialCustom);
      } catch (e) {
        setCustomTemplates([]);
      }
    }

    if (storedLinks) {
      try {
        setLinks(JSON.parse(storedLinks));
      } catch (e) {
        const initialLinks: Record<string, string> = {};
        DEFAULT_TEMPLATES.forEach(t => {
          initialLinks[t.id] = t.defaultLink;
        });
        setLinks(initialLinks);
      }
    } else {
      const initialLinks: Record<string, string> = {};
      DEFAULT_TEMPLATES.forEach(t => {
        initialLinks[t.id] = t.defaultLink;
      });
      initialCustom.forEach(t => {
        initialLinks[t.id] = t.defaultLink;
      });
      setLinks(initialLinks);
    }
  }, []);

  const saveLinks = (updated: Record<string, string>) => {
    setLinks(updated);
    localStorage.setItem("mku_canva_template_links_v2", JSON.stringify(updated));
  };

  const saveCustomTemplates = (updatedCustom: CanvaTemplate[]) => {
    setCustomTemplates(updatedCustom);
    localStorage.setItem("mku_custom_canva_templates", JSON.stringify(updatedCustom));
  };

  const handleEditStart = (id: string, currentVal: string) => {
    setEditingId(id);
    setEditValue(currentVal);
  };

  const handleEditSave = (id: string) => {
    const updated = { ...links, [id]: editValue };
    saveLinks(updated);
    setEditingId(null);
  };

  const handleResetDefaults = () => {
    if (window.confirm("Are you sure you want to reset template links back to default values?")) {
      const initialLinks: Record<string, string> = {};
      DEFAULT_TEMPLATES.forEach(t => {
        initialLinks[t.id] = t.defaultLink;
      });
      customTemplates.forEach(t => {
        initialLinks[t.id] = t.defaultLink;
      });
      saveLinks(initialLinks);
    }
  };

  const handleCopyLink = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleAddTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newLink.trim()) return;

    const id = `custom-${Date.now()}`;
    const newT: CanvaTemplate = {
      id,
      name: newName.trim(),
      category: newCategory,
      defaultLink: newLink.trim(),
      isCustom: true,
    };

    const nextCustom = [...customTemplates, newT];
    saveCustomTemplates(nextCustom);

    const nextLinks = { ...links, [id]: newLink.trim() };
    saveLinks(nextLinks);

    setNewName("");
    setNewLink("");
    setShowAddForm(false);
  };

  const handleDeleteCustomTemplate = (id: string) => {
    if (window.confirm("Delete this custom Canva asset template?")) {
      const nextCustom = customTemplates.filter(t => t.id !== id);
      saveCustomTemplates(nextCustom);
      const nextLinks = { ...links };
      delete nextLinks[id];
      saveLinks(nextLinks);
    }
  };

  const allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];

  const filteredTemplates = allTemplates.filter(t => {
    return t.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200/70 dark:border-neutral-800 rounded-xl sm:rounded-2xl shadow-sm overflow-hidden text-left transition-all">
      {/* Header bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 sm:px-5 py-2.5 sm:py-4 bg-gradient-to-r from-neutral-50 to-neutral-100/50 dark:from-neutral-800 dark:to-neutral-800/60 flex items-center justify-between border-b border-neutral-150 dark:border-neutral-700 cursor-pointer hover:bg-neutral-100/30 dark:hover:bg-neutral-700/60 transition-all"
      >
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="p-1 sm:p-1.5 bg-brand-maroon/10 rounded-lg sm:rounded-xl text-brand-maroon">
            <LayoutGrid className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
          <div>
            <h3 className="font-sans font-black text-xs sm:text-sm text-stone-900 dark:text-neutral-100 tracking-tight flex items-center gap-1.5">
              Canva Template Directory
              <span className="text-[9px] sm:text-[10px] font-mono font-bold bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 px-1.5 py-0.5 rounded-full">
                {allTemplates.length} Items
              </span>
            </h3>
            <p className="text-[9px] sm:text-[10px] text-stone-500 dark:text-neutral-400 font-medium">
              Unified design canvases for writers, layouts, and oversight desks. Click to edit or open.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronUp className="w-4 h-4 text-stone-500 dark:text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-stone-500 dark:text-neutral-400" />}
        </div>
      </div>

      {isOpen && (
        <div className="p-2.5 sm:p-4 space-y-2.5 sm:space-y-4">
          {/* Search and Add */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            {/* Search */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search Canva template..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-250 bg-white rounded-xl focus:ring-1 focus:ring-brand-maroon outline-none"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
              {!isLayoutStaff && (
                <>
                  <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="px-3 py-1.5 text-[10px] font-bold bg-brand-maroon hover:bg-brand-maroon-dark text-white rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Template</span>
                  </button>

                  <button
                    onClick={handleResetDefaults}
                    className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-50 rounded-lg transition-all cursor-pointer"
                    title="Reset all to defaults"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Add New Template Inline Form Modal */}
          {showAddForm && (
            <form 
              onSubmit={handleAddTemplateSubmit}
              className="p-4 bg-red-50/50 border border-red-200/80 rounded-xl space-y-3 animate-fade-in"
            >
              <div className="flex items-center justify-between border-b border-red-200/50 pb-2">
                <h4 className="font-sans font-bold text-xs text-brand-maroon flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Add New Canva Template
                </h4>
                <button 
                  type="button" 
                  onClick={() => setShowAddForm(false)}
                  className="p-1 text-stone-400 hover:text-stone-700 rounded-md"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-stone-700 mb-1">Template Name</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Infographics Pubmat"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white outline-none focus:ring-1 focus:ring-brand-maroon"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-stone-700 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white outline-none focus:ring-1 focus:ring-brand-maroon cursor-pointer"
                  >
                    <option value="Branding & Gen">Branding & Gen</option>
                    <option value="Editorial">Editorial</option>
                    <option value="Visuals & Layouts">Visuals & Layouts</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-stone-700 mb-1">Canva Link</label>
                  <input 
                    type="text"
                    required
                    placeholder="https://canva.link/..."
                    value={newLink}
                    onChange={(e) => setNewLink(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white outline-none focus:ring-1 focus:ring-brand-maroon"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-brand-maroon hover:bg-brand-maroon-dark text-white text-xs font-bold rounded-lg cursor-pointer shadow-sm"
                >
                  Save New Template
                </button>
              </div>
            </form>
          )}

          {/* Directory Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredTemplates.map((t) => {
              const currentUrl = links[t.id] || t.defaultLink;
              const isEditing = editingId === t.id;
              const hasCopied = copiedId === t.id;

              return (
                <div 
                  key={t.id}
                  className="p-3 rounded-xl border border-neutral-150 bg-neutral-50/50 hover:bg-neutral-50 hover:border-neutral-200 transition-all flex flex-col justify-between space-y-2 group relative"
                >
                  {/* Item badge/meta */}
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono font-bold bg-brand-maroon/5 text-brand-maroon px-2 py-0.5 rounded">
                      {t.category}
                    </span>
                    {t.isCustom && (
                      <button
                        onClick={() => handleDeleteCustomTemplate(t.id)}
                        className="text-stone-400 hover:text-red-600 transition-all cursor-pointer"
                        title="Delete custom template"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Title and URL */}
                  <div>
                    <h4 className="font-sans font-black text-xs text-stone-900">{t.name}</h4>
                    
                    {isEditing ? (
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 px-2 py-1 text-[10px] border border-neutral-300 rounded bg-white font-mono focus:ring-1 focus:ring-brand-maroon outline-none"
                          placeholder="Paste Canva URL here"
                        />
                        <button
                          onClick={() => handleEditSave(t.id)}
                          className="p-1 bg-emerald-600 text-white hover:bg-emerald-700 rounded transition-all cursor-pointer"
                          title="Save Link"
                        >
                          <Save className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-[9px] text-stone-500 font-mono truncate mt-0.5" title={currentUrl}>
                        {currentUrl}
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  {!isEditing && (
                    <div className="flex items-center gap-1.5 pt-1 border-t border-neutral-200/30">
                      {/* Open design */}
                      <a
                        href={currentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-1 px-2 bg-white hover:bg-stone-50 text-stone-700 border border-neutral-200 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 hover:text-stone-900 transition-all"
                      >
                        <span>Launch</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>

                      {/* Copy Link */}
                      <button
                        onClick={() => handleCopyLink(t.id, currentUrl)}
                        className={`p-1 border border-neutral-200 text-stone-500 hover:text-stone-850 rounded-lg bg-white cursor-pointer transition-all ${hasCopied ? "bg-emerald-50 border-emerald-300 text-emerald-700" : ""}`}
                        title="Copy to Clipboard"
                      >
                        {hasCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>

                      {/* Edit Link (Only for Editors/Heads) */}
                      {!isLayoutStaff && (
                        <button
                          onClick={() => handleEditStart(t.id, currentUrl)}
                          className="p-1 border border-neutral-200 text-stone-500 hover:text-stone-850 hover:border-neutral-300 rounded-lg bg-white cursor-pointer transition-all"
                          title="Edit Canva Link"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredTemplates.length === 0 && (
              <div className="col-span-full py-8 text-center text-xs text-stone-400 font-medium">
                No matching Canva templates found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

