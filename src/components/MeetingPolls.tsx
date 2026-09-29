import React, { useState } from "react";
import { 
  Vote, Plus, Users, Clock, EyeOff, ShieldCheck, 
  CheckCircle, MessageCircle, BarChart, Sparkles, HelpCircle, Trash2 
} from "lucide-react";
import { Poll, TeamMember } from "../types";

interface MeetingPollsProps {
  polls: Poll[];
  members: TeamMember[];
  speechEnabled: boolean;
  currentUserEmail: string;
  currentUserRole?: string;
  onUpdatePolls: (polls: Poll[]) => void;
}

export default function MeetingPolls({
  polls,
  members,
  speechEnabled,
  currentUserEmail,
  currentUserRole,
  onUpdatePolls,
}: MeetingPollsProps) {
  const isLeader = currentUserRole === "Layout Editor" || currentUserRole === "Layout Deputy";
  const [showCreate, setShowCreate] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newCategory, setNewCategory] = useState<Poll["category"]>("design");
  const [newAnonymous, setNewAnonymous] = useState(false);
  const [newOptions, setNewOptions] = useState<string[]>(["", ""]);

  const speakText = (text: string) => {
    if (!speechEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  };

  // Vote helper
  const handleVote = (pollId: string, optionId: string) => {
    const updated = polls.map((p) => {
      if (p.id === pollId) {
        // Find if user already voted in this poll
        let alreadyVotedOptionId: string | null = null;
        p.options.forEach((opt) => {
          if (opt.votes.includes(currentUserEmail)) {
            alreadyVotedOptionId = opt.id;
          }
        });

        const newOptions = p.options.map((opt) => {
          let votes = [...opt.votes];
          
          // Remove old vote
          if (alreadyVotedOptionId === opt.id) {
            votes = votes.filter((v) => v !== currentUserEmail);
          }
          
          // Add new vote
          if (opt.id === optionId) {
            votes.push(currentUserEmail);
          }

          return { ...opt, votes };
        });

        speakText("Your vote has been cast and synchronized.");
        return { ...p, options: newOptions };
      }
      return p;
    });

    onUpdatePolls(updated);
  };

  // Add Option helper
  const handleAddOptionField = () => {
    setNewOptions([...newOptions, ""]);
  };

  // Create Poll helper
  const handleCreatePoll = () => {
    if (!newQuestion.trim()) {
      speakText("Poll question cannot be left empty.");
      return;
    }
    const filteredOptions = newOptions.filter((o) => o.trim() !== "");
    if (filteredOptions.length < 2) {
      speakText("Please specify at least two viable voting options.");
      return;
    }

    const newPoll: Poll = {
      id: crypto.randomUUID(),
      question: newQuestion,
      options: filteredOptions.map((text) => ({
        id: crypto.randomUUID(),
        text,
        votes: []
      })),
      category: newCategory,
      anonymous: newAnonymous,
      active: true,
      endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      creator: currentUserEmail
    };

    onUpdatePolls([newPoll, ...polls]);
    setShowCreate(false);
    setNewQuestion("");
    setNewOptions(["", ""]);
    speakText("New design coordination poll launched successfully.");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Active Polls List */}
      <div className="lg:col-span-2 space-y-6">
        
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-gray-900 text-base">
              Layout Decisions & Scheduling Polls
            </h2>
            <p className="text-xs text-gray-500">
              Cast your vote on front-page layout orientations, typography matching, or Figma team sessions.
            </p>
          </div>

          {isLeader && (
          <button
            onClick={() => {
              setShowCreate(!showCreate);
              speakText(showCreate ? "Closed poll creator" : "Opened poll creator");
            }}
            className="px-3.5 py-1.5 bg-brand-maroon hover:bg-brand-maroon-dark text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Propose Poll
          </button>
          )}
        </div>

        <div className="space-y-6">
          {polls.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500 text-xs space-y-1">
              <Vote className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="font-bold text-gray-700 text-sm">No layout polls active</p>
              <p>Click "Propose Poll" to create a new team consensus vote on design decisions or schedules.</p>
            </div>
          ) : (
            polls.map((poll) => {
            // Calculate total votes
            const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes.length, 0);
            
            // Check if user voted in this poll
            const userVotedOptionId = poll.options.find(o => o.votes.includes(currentUserEmail))?.id;

            return (
              <div key={poll.id} className="glass-card rounded-2xl p-5 space-y-4">
                
                {/* Poll category and indicators */}
                <div className="flex items-center justify-between gap-2 border-b pb-2.5 border-gray-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      poll.category === "design" ? "bg-amber-50 text-amber-700 border border-amber-100" :
                      poll.category === "meeting" ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-purple-50 text-purple-700 border"
                    }`}>
                      {poll.category} Issue
                    </span>
                    {poll.anonymous && (
                      <span className="flex items-center gap-1 text-gray-400 font-medium text-[10px]">
                        <EyeOff className="w-3 h-3" /> Anonymous
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] font-mono text-gray-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Closes in 5 Days
                  </span>

                  {isLeader && (
                    <button
                      onClick={() => {
                        if (window.confirm("Delete this poll? This cannot be undone.")) {
                          onUpdatePolls(polls.filter((p) => p.id !== poll.id));
                          speakText("Poll removed.");
                        }
                      }}
                      className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-600 transition-all shrink-0 cursor-pointer"
                      aria-label={`Delete poll: ${poll.question}`}
                      title="Delete poll"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Question */}
                <h3 className="font-display font-bold text-gray-900 text-sm leading-snug">
                  {poll.question}
                </h3>

                {/* Options List */}
                <div className="space-y-3 pt-1">
                  {poll.options.map((opt) => {
                    const votesCount = opt.votes.length;
                    const percent = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
                    const isSelected = userVotedOptionId === opt.id;

                    return (
                      <div key={opt.id} className="space-y-1.5 text-xs">
                        <button
                          onClick={() => handleVote(poll.id, opt.id)}
                          className={`w-full p-3 bg-gray-50 hover:bg-brand-maroon/5 rounded-xl border transition-all text-left flex items-center justify-between relative overflow-hidden group ${
                            isSelected ? "border-brand-maroon bg-brand-cream/40" : "border-gray-100"
                          }`}
                        >
                          <span className="font-semibold text-gray-800 z-10 group-hover:text-brand-maroon transition-all flex items-center gap-2">
                            {isSelected && <CheckCircle className="w-4 h-4 text-brand-maroon fill-white" />}
                            {opt.text}
                          </span>

                          <span className="font-mono font-bold text-gray-500 z-10">{percent}%</span>
                        </button>

                        {/* Visually dynamic progress bar */}
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            style={{ width: `${percent}%` }}
                            className={`h-full rounded-full transition-all duration-500 ${
                              isSelected ? "bg-brand-maroon" : "bg-gray-300"
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100/60 text-[10px] text-gray-400">
                  <span>Total votes: {totalVotes} layout staff</span>
                  <span>Proposed by: {poll.creator.split("@")[0]}</span>
                </div>

              </div>
            );
          }))}
        </div>

      </div>

      {/* Poll Proposal Sidebar Form */}
      <div className="space-y-6">
        {showCreate && (
          <div className="glass-card rounded-2xl p-5 space-y-4 animate-fade-in">
            <div className="border-b pb-2 flex items-center justify-between">
              <h3 className="font-display font-bold text-gray-900 text-sm flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-brand-maroon animate-spin" />
                Poll Configurator
              </h3>
              <button 
                onClick={() => setShowCreate(false)}
                className="text-gray-400 hover:text-gray-700 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Poll Question / Decision Name</label>
                <input
                  type="text"
                  placeholder="e.g. Which Figma grids orientation should we adopt?"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-maroon outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Category Type</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-maroon outline-none cursor-pointer"
                >
                  <option value="design">Design Concept</option>
                  <option value="meeting">Meeting Scheduling</option>
                  <option value="editorial">Editorial Layout</option>
                </select>
              </div>

              {/* Multiple Options entries */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600 block">Voting Options</label>
                {newOptions.map((opt, index) => (
                  <input
                    key={index}
                    type="text"
                    placeholder={`Option ${index + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const copy = [...newOptions];
                      copy[index] = e.target.value;
                      setNewOptions(copy);
                    }}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-maroon outline-none"
                  />
                ))}

                <button
                  onClick={handleAddOptionField}
                  className="text-[10px] text-brand-maroon hover:underline font-bold"
                >
                  + Add Option field
                </button>
              </div>

              {/* Anonymous setting */}
              <div className="flex items-center justify-between pt-1">
                <label htmlFor="toggle-poll-anon" className="text-xs font-semibold flex items-center gap-1.5">
                  <EyeOff className="w-3.5 h-3.5 text-gray-400" /> Anonymous Voting?
                </label>
                <button
                  id="toggle-poll-anon"
                  onClick={() => setNewAnonymous(!newAnonymous)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    newAnonymous ? "bg-brand-maroon" : "bg-gray-200"
                  }`}
                  role="switch"
                  aria-checked={newAnonymous}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      newAnonymous ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <button
                onClick={handleCreatePoll}
                className="w-full py-2 bg-brand-maroon hover:bg-brand-maroon-dark text-white font-bold rounded-lg transition-all"
              >
                Launch Vote
              </button>
            </div>
          </div>
        )}

        {/* Democratic voting rules */}
        <div className="bg-brand-cream border border-brand-maroon/10 p-4 rounded-2xl text-xs space-y-1">
          <h4 className="font-bold text-gray-900 flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-green-600" /> Layout Democratic Rules:
          </h4>
          <p className="text-gray-600 leading-normal">
            Voting ensures full team consensus before locking layout formats in InDesign. Anonymous settings protect layout staff opinions.
          </p>
        </div>

      </div>

    </div>
  );
}
