export type UserRole = 
  | 'Layout Editor' 
  | 'Layout Deputy' 
  | 'Layout Staffer' 
  | 'Layout Probi'
  // Backwards compatibility aliases
  | 'Online Layout Head' 
  | 'Layout Staff Member' 
  | 'Publication Editor-in-Chief';

export function normalizeEmail(email?: string | null): string {
  if (!email) return "";
  const trimmed = email.trim();
  if (/rxtiannn@gmail|mkulayout\.upm@gmail\.com/i.test(trimmed)) {
    return "ctrodriguez2@up.edu.ph";
  }
  return trimmed;
}

export interface ScheduleEntry {
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  timeSlot: string; // e.g. "7am", "8am", "9am", ... "8pm"
  subject: string;
}

export interface MemberSchedule {
  summary?: string;
  unavailableDays?: string[]; // whole-day unavailable highlighted columns
  entries?: ScheduleEntry[];
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
  lastUpdated?: string;
}

export interface PersonalCalendarEvent {
  id: string;
  userEmail: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string;
  notes?: string;
  category?: "Reminder" | "Task Target" | "Meeting" | "Personal";
  completed?: boolean;
  createdAt?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  displayName?: string;
  role: UserRole;
  college: string;
  email: string;
  contact: string;
  statusSem1: 'Active' | 'LOA' | 'Inactive';
  statusSem2: 'Active' | 'LOA' | 'Inactive';
  type: 'layout' | 'illustrator' | 'editor';
  xp: number;
  level: number;
  completedTasks: number;
  currentSemPubs?: number;
  schedule?: MemberSchedule | string;
  avatarUrl?: string;
  pin?: string;
}

export type TaskStatus = 
  | 'Not Started' 
  | 'Assigned' 
  | 'In Progress' 
  | 'For Review' 
  | 'Revision Needed' 
  | 'Approved' 
  | 'Completed' 
  | 'Archived' 
  | 'Shelved' 
  | 'drafting' 
  | 'for posting';

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface Task {
  id: string;
  title: string;
  typeOfRelease: string; // e.g. "Online Article", "Issue Article", "Multimedia", "From the Archives"
  typeOfContent: string; // e.g. "feats artx", "op artx", "cult artx", "editorial", "illustration", "photo essay"
  writer: string;
  illusLayout: string; // E.g., "Christian", "Leyan"
  assigneeEmail?: string; // canonical member email used for cross-device matching
  assigneeName?: string; // canonical assigned name label
  graphics?: string; // E.g., "Carl", "Zam"
  progress: TaskStatus;
  writeup: string;
  priority: TaskPriority;
  releaseDate: string; // e.g. "AUGUST 28", "SEPTEMBER 3"
  time?: string;
  estimatedHours?: number;
  actualHours?: number;
  notes?: string;
  reviewers?: string[]; // list of reviewer names
  files: string[]; // Mock file paths/names
  commentsCount: number;
  revisionCount: number;
  lastUpdated: string;
  canvaLink?: string; // e.g. Canva design link for staff
  mediumCanvaLink?: string;
  pubmatLink?: string; // Google Drive or Illustration link for pubmat
  isPendingConfirmation?: boolean;
  draftLink?: string;
  addedToLayout?: string;
  graphicsIllus?: string;
  onlineHandler?: string;
  sourceIssueRowId?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO date format "YYYY-MM-DD"
  end?: string;
  type: 'deadline' | 'meeting' | 'workshop' | 'release';
  description?: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // array of emails
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  category: 'design' | 'meeting' | 'editorial' | 'theme' | 'other';
  anonymous: boolean;
  active: boolean;
  endsAt: string; // ISO timestamp
  creator: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'assignment' | 'deadline' | 'revision' | 'poll' | 'birthday';
  timestamp: string;
  readBy: string[]; // array of emails
  targetEmails?: string[]; // accounts this alert is addressed to; persisted in read_by
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorName: string;
  authorEmail: string;
  text: string;
  timestamp: string;
  images?: string[];
  editedAt?: string;
  removedAt?: string;
}

export interface LayoutCritiqueResponse {
  score: number; // overall score out of 100
  critique: string; // Markdown formatted AI feedback
  accessibilityCheck: {
    passed: boolean;
    issues: string[];
    contrastRatio?: string;
  };
  recommendations: string[]; // key improvements
}

export interface SheetMerge {
  startRowIndex: number;    // 0-indexed inclusive
  endRowIndex: number;      // 0-indexed exclusive (endRowIndex > startRowIndex)
  startColumnIndex: number; // 0-indexed inclusive
  endColumnIndex: number;   // 0-indexed exclusive (endColumnIndex > startColumnIndex)
  sheetId?: number;
  label?: string;
}

