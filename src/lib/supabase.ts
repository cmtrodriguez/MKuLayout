import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";
import { 
  Task, 
  TeamMember, 
  CalendarEvent, 
  PersonalCalendarEvent, 
  Poll, 
  PollOption, 
  Notification, 
  TaskComment, 
  TaskStatus, 
  TaskPriority, 
  UserRole,
  normalizeEmail 
} from "../types";
import { getOfficialDisplayName, resolveMemberEmail } from "./memberUtils";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export type AppProfile = {
  id: string;
  email: string;
  full_name?: string | null;
  role?: string | null;
  college?: string | null;
  contact?: string | null;
  avatar_url?: string | null;
};

// UUID validation helper
function ensureUuid(id?: string | null): string {
  if (typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return id;
  }
  return crypto.randomUUID();
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(callback: (event: string, session: any) => void) {
  if (!supabase) return { unsubscribe: () => {} };
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return subscription;
}

export async function signInWithEmailPassword(email: string, password: string) {
  if (!supabase) throw new Error("Supabase client is not configured.");
  const cleanEmail = normalizeEmail(email).toLowerCase();
  return await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: password.trim()
  });
}

export async function signOut() {
  if (!supabase) return;
  return await supabase.auth.signOut();
}

export async function fetchUserProfile(userId: string): Promise<AppProfile | null> {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("User profile lookup failed:", error.message);
    return null;
  }
  return data as AppProfile | null;
}

export async function fetchUserProfileByEmail(email: string): Promise<AppProfile | null> {
  if (!supabase || !email) return null;
  const normalizedEmail = normalizeEmail(email).toLowerCase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    console.warn("Profile lookup by email failed:", error.message);
    return null;
  }
  return data as AppProfile | null;
}

// ============================================================================
// MEMBERS
// ============================================================================

export function memberFromDb(row: any): TeamMember {
  return {
    id: row.id,
    name: row.name || "",
    displayName: row.display_name || row.name || "",
    role: (row.role as UserRole) || "Layout Staffer",
    college: row.college || "",
    email: row.email || "",
    contact: row.contact || "",
    statusSem1: row.status_sem1 || "Active",
    statusSem2: row.status_sem2 || "Active",
    type: row.type || "layout",
    xp: row.xp ?? 0,
    level: row.level ?? 1,
    completedTasks: row.completed_tasks ?? 0,
    currentSemPubs: row.current_sem_pubs ?? 0,
    schedule: typeof row.schedule === "object" ? row.schedule : (row.schedule || ""),
    avatarUrl: row.avatar_url || undefined,
    pin: row.pin || undefined
  };
}

export async function fetchMembers(): Promise<TeamMember[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("members").select("*").order("name", { ascending: true });
  if (error) {
    console.error("Error fetching members:", error.message);
    return [];
  }
  return (data || []).map(memberFromDb);
}

export async function upsertMember(member: Partial<TeamMember>): Promise<void> {
  if (!supabase) return;
  const row = {
    id: member.id,
    name: member.name,
    display_name: member.displayName,
    role: member.role,
    college: member.college,
    email: member.email,
    contact: member.contact,
    status_sem1: member.statusSem1,
    status_sem2: member.statusSem2,
    type: member.type,
    xp: member.xp,
    level: member.level,
    completed_tasks: member.completedTasks,
    current_sem_pubs: member.currentSemPubs,
    schedule: typeof member.schedule === "string" ? { note: member.schedule } : member.schedule,
    avatar_url: member.avatarUrl,
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase.from("members").upsert(row, { onConflict: "id" });
  if (error) console.error("Error upserting member:", error.message);
}

// ============================================================================
// TASKS
// ============================================================================

export function taskFromDb(row: any): Task {
  // The tasks table has no assignee columns; the assigned artist's display name lives
  // in illus_layout, so the assignee email is re-derived from the member registry.
  const illusLayout = row.illus_layout || "Unassigned";
  return {
    id: row.id,
    title: row.title || "",
    typeOfRelease: row.type_of_release || "Online Article",
    typeOfContent: row.type_of_content || "feats artx",
    writer: row.writer || "",
    illusLayout,
    assigneeEmail: resolveMemberEmail(illusLayout) || undefined,
    assigneeName: illusLayout !== "Unassigned" ? illusLayout : undefined,
    graphics: row.graphics || "",
    progress: (row.progress as TaskStatus) || "Not Started",
    writeup: row.writeup || "",
    priority: (row.priority as TaskPriority) || "Medium",
    releaseDate: row.release_date || "",
    time: row.time || undefined,
    estimatedHours: row.estimated_hours != null ? Number(row.estimated_hours) : undefined,
    actualHours: row.actual_hours != null ? Number(row.actual_hours) : undefined,
    notes: row.notes || "",
    reviewers: Array.isArray(row.reviewers) ? row.reviewers : [],
    files: Array.isArray(row.files) ? row.files : [],
    commentsCount: row.comments_count != null ? Number(row.comments_count) : 0,
    revisionCount: row.revision_count != null ? Number(row.revision_count) : 0,
    lastUpdated: row.last_updated || row.updated_at || new Date().toISOString(),
    canvaLink: row.canva_link || undefined,
    pubmatLink: row.pubmat_link || undefined,
    draftLink: row.draft_link || undefined,
    addedToLayout: row.added_to_layout || undefined,
    graphicsIllus: row.graphics_illus || undefined,
    onlineHandler: row.online_handler || undefined,
    isPendingConfirmation: Boolean(row.is_pending_confirmation)
  };
}

export function taskToDb(task: Partial<Task>): any {
  const id = ensureUuid(task.id);
  // assignee_email/assignee_name do not exist in the tasks table; the assignment is
  // persisted through illus_layout (the artist display name) instead.
  const assigneeLabel =
    task.illusLayout && task.illusLayout !== "Unassigned"
      ? task.illusLayout
      : task.assigneeName ||
        (task.assigneeEmail ? getOfficialDisplayName(task.assigneeEmail) : "") ||
        "Unassigned";
  return {
    id,
    title: task.title ?? "Untitled Task",
    type_of_release: task.typeOfRelease ?? "Online Article",
    type_of_content: task.typeOfContent ?? "feats artx",
    writer: task.writer ?? "",
    illus_layout: assigneeLabel,
    graphics: task.graphics ?? "",
    progress: task.progress ?? "Not Started",
    writeup: task.writeup ?? "",
    priority: task.priority ?? "Medium",
    release_date: task.releaseDate ?? "",
    time: task.time ?? null,
    estimated_hours: task.estimatedHours != null ? task.estimatedHours : null,
    actual_hours: task.actualHours != null ? task.actualHours : null,
    notes: task.notes ?? "",
    reviewers: Array.isArray(task.reviewers) ? task.reviewers : [],
    files: Array.isArray(task.files) ? task.files : [],
    comments_count: task.commentsCount ?? 0,
    revision_count: task.revisionCount ?? 0,
    last_updated: task.lastUpdated ? new Date(task.lastUpdated).toISOString() : new Date().toISOString(),
    canva_link: task.canvaLink ?? null,
    pubmat_link: task.pubmatLink ?? null,
    draft_link: task.draftLink ?? null,
    added_to_layout: task.addedToLayout ?? null,
    graphics_illus: task.graphicsIllus ?? null,
    online_handler: task.onlineHandler ?? null,
    is_pending_confirmation: Boolean(task.isPendingConfirmation),
    updated_at: new Date().toISOString()
  };
}

export async function fetchTasks(): Promise<Task[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching tasks:", error.message);
    return [];
  }
  return (data || []).map(taskFromDb);
}

export async function upsertTask(task: Partial<Task>): Promise<Task | null> {
  if (!supabase) return null;
  const dbPayload = taskToDb(task);
  const { data, error } = await supabase.from("tasks").upsert(dbPayload).select().single();
  if (error) {
    console.error("Error saving task to Supabase:", error.message);
    return null;
  }
  return taskFromDb(data);
}

export async function deleteTask(taskId: string): Promise<boolean> {
  if (!supabase || !taskId) return false;
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) {
    console.error("Error deleting task:", error.message);
    return false;
  }
  return true;
}

// ============================================================================
// TASK COMMENTS
// ============================================================================

const COMMENT_IMAGE_ENVELOPE = "__MKULE_COMMENT_V1__";
const isCommentImageDataUrl = (value: unknown): value is string =>
  typeof value === "string" && /^data:image\/(?:jpeg|png|webp);base64,/i.test(value);

export function commentFromDb(row: any): TaskComment {
  const storedText = row.text || "";
  let text = storedText;
  let images: string[] | undefined;
  if (storedText.startsWith(COMMENT_IMAGE_ENVELOPE)) {
    try {
      const payload = JSON.parse(storedText.slice(COMMENT_IMAGE_ENVELOPE.length));
      text = typeof payload.text === "string" ? payload.text : "";
      images = Array.isArray(payload.images) ? payload.images.filter(isCommentImageDataUrl).slice(0, 5) : [];
    } catch {
      text = storedText;
    }
  }
  return {
    id: row.id,
    taskId: row.task_id,
    authorName: row.author_name || "Staff",
    authorEmail: row.author_email || "",
    text,
    timestamp: row.timestamp || row.created_at || new Date().toISOString(),
    ...(images?.length ? { images } : {})
  };
}

export async function fetchComments(taskId?: string): Promise<TaskComment[]> {
  if (!supabase) return [];
  let query = supabase.from("task_comments").select("*").order("timestamp", { ascending: true });
  if (taskId) query = query.eq("task_id", taskId);
  const { data, error } = await query;
  if (error) {
    console.error("Error fetching comments:", error.message);
    return [];
  }
  return (data || []).map(commentFromDb);
}

export async function createComment(comment: Partial<TaskComment>): Promise<TaskComment | null> {
  if (!supabase || !comment.taskId) return null;
  const images = Array.isArray(comment.images) ? comment.images.filter(isCommentImageDataUrl).slice(0, 5) : [];
  const text = comment.text || "";
  if (!text.trim() && images.length === 0) return null;
  const id = ensureUuid(comment.id);
  const row = {
    id,
    task_id: comment.taskId,
    author_name: comment.authorName || "Staff",
    author_email: comment.authorEmail || "",
    text: images.length ? `${COMMENT_IMAGE_ENVELOPE}${JSON.stringify({ text, images })}` : text,
    timestamp: comment.timestamp ? new Date(comment.timestamp).toISOString() : new Date().toISOString()
  };
  const { data, error } = await supabase.from("task_comments").insert(row).select().single();
  if (error) {
    console.error("Error creating comment:", error.message);
    return null;
  }
  return commentFromDb(data);
}

export async function deleteComment(commentId: string): Promise<boolean> {
  if (!supabase || !commentId) return false;
  const { error } = await supabase.from("task_comments").delete().eq("id", commentId);
  return !error;
}

// ============================================================================
// CALENDAR EVENTS (Desk/Team Calendar)
// ============================================================================

export function calendarEventFromDb(row: any): CalendarEvent {
  return {
    id: row.id,
    title: row.title || "",
    start: row.start_at ? row.start_at.substring(0, 10) : "",
    end: row.ends_at ? row.ends_at.substring(0, 10) : undefined,
    type: (row.type as any) || "meeting",
    description: row.description || ""
  };
}

export async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("calendar_events").select("*").order("start_at", { ascending: true });
  if (error) {
    console.error("Error fetching calendar events:", error.message);
    return [];
  }
  return (data || []).map(calendarEventFromDb);
}

export async function upsertCalendarEvent(event: Partial<CalendarEvent>): Promise<CalendarEvent | null> {
  if (!supabase) return null;
  const id = ensureUuid(event.id);
  const startDate = event.start ? (event.start.includes("T") ? event.start : `${event.start}T00:00:00.000Z`) : new Date().toISOString();
  const endDate = event.end ? (event.end.includes("T") ? event.end : `${event.end}T23:59:59.000Z`) : null;
  const row = {
    id,
    title: event.title || "Meeting",
    start_at: startDate,
    ends_at: endDate,
    type: event.type || "meeting",
    description: event.description || ""
  };
  const { data, error } = await supabase.from("calendar_events").upsert(row).select().single();
  if (error) {
    console.error("Error saving calendar event:", error.message);
    return null;
  }
  return calendarEventFromDb(data);
}

export async function deleteCalendarEvent(id: string): Promise<boolean> {
  if (!supabase || !id) return false;
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  return !error;
}

// ============================================================================
// PERSONAL CALENDAR EVENTS
// ============================================================================

export function personalEventFromDb(row: any): PersonalCalendarEvent {
  return {
    id: row.id,
    userEmail: row.user_email,
    title: row.title || "",
    date: row.date || "",
    time: row.time || undefined,
    notes: row.notes || undefined,
    category: (row.category as any) || "Personal",
    completed: Boolean(row.completed),
    createdAt: row.created_at
  };
}

export async function fetchPersonalEvents(userEmail: string): Promise<PersonalCalendarEvent[]> {
  if (!supabase || !userEmail) return [];
  const cleanEmail = normalizeEmail(userEmail).toLowerCase();
  const { data, error } = await supabase
    .from("personal_calendar_events")
    .select("*")
    .ilike("user_email", cleanEmail)
    .order("date", { ascending: true });
  if (error) {
    console.error("Error fetching personal events:", error.message);
    return [];
  }
  return (data || []).map(personalEventFromDb);
}

export async function upsertPersonalEvent(event: Partial<PersonalCalendarEvent>): Promise<PersonalCalendarEvent | null> {
  if (!supabase || !event.userEmail || !event.title) return null;
  const id = ensureUuid(event.id);
  const row = {
    id,
    user_email: normalizeEmail(event.userEmail).toLowerCase(),
    title: event.title,
    date: event.date,
    time: event.time || null,
    notes: event.notes || null,
    category: event.category || "Personal",
    completed: Boolean(event.completed)
  };
  const { data, error } = await supabase.from("personal_calendar_events").upsert(row).select().single();
  if (error) {
    console.error("Error saving personal event:", error.message);
    return null;
  }
  return personalEventFromDb(data);
}

export async function deletePersonalEvent(id: string, userEmail?: string): Promise<boolean> {
  if (!supabase || !id) return false;
  let query = supabase.from("personal_calendar_events").delete().eq("id", id);
  if (userEmail) query = query.ilike("user_email", normalizeEmail(userEmail).toLowerCase());
  const { error } = await query;
  return !error;
}

// ============================================================================
// POLLS & POLL OPTIONS
// ============================================================================

export async function fetchPolls(): Promise<Poll[]> {
  if (!supabase) return [];
  const { data: pollsData, error: pollsErr } = await supabase.from("polls").select("*").order("created_at", { ascending: false });
  if (pollsErr) {
    console.error("Error fetching polls:", pollsErr.message);
    return [];
  }
  const { data: optionsData, error: optionsErr } = await supabase.from("poll_options").select("*");
  if (optionsErr) {
    console.error("Error fetching poll options:", optionsErr.message);
  }

  const optionsByPoll = new Map<string, PollOption[]>();
  for (const opt of (optionsData || [])) {
    const list = optionsByPoll.get(opt.poll_id) || [];
    list.push({
      id: opt.id,
      text: opt.text || "",
      votes: Array.isArray(opt.votes) ? opt.votes : []
    });
    optionsByPoll.set(opt.poll_id, list);
  }

  return (pollsData || []).map((p: any) => ({
    id: p.id,
    question: p.question || "",
    options: optionsByPoll.get(p.id) || [],
    category: p.category || "design",
    anonymous: Boolean(p.anonymous),
    active: Boolean(p.active),
    endsAt: p.ends_at || "",
    creator: p.creator || ""
  }));
}

export async function createPoll(poll: Partial<Poll>): Promise<Poll | null> {
  if (!supabase || !poll.question) return null;
  const pollId = ensureUuid(poll.id);
  const pollRow = {
    id: pollId,
    question: poll.question,
    category: poll.category || "design",
    anonymous: Boolean(poll.anonymous),
    active: poll.active !== false,
    ends_at: poll.endsAt ? new Date(poll.endsAt).toISOString() : null,
    creator: poll.creator || ""
  };
  const { data: insertedPoll, error: pollErr } = await supabase.from("polls").insert(pollRow).select().single();
  if (pollErr) {
    console.error("Error creating poll:", pollErr.message);
    return null;
  }

  const optionRows = (poll.options || []).map(opt => ({
    id: ensureUuid(opt.id),
    poll_id: pollId,
    text: opt.text,
    votes: Array.isArray(opt.votes) ? opt.votes : []
  }));

  if (optionRows.length > 0) {
    const { error: optErr } = await supabase.from("poll_options").insert(optionRows);
    if (optErr) console.error("Error creating poll options:", optErr.message);
  }

  return {
    id: insertedPoll.id,
    question: insertedPoll.question,
    options: optionRows.map(o => ({ id: o.id, text: o.text, votes: o.votes })),
    category: insertedPoll.category,
    anonymous: Boolean(insertedPoll.anonymous),
    active: Boolean(insertedPoll.active),
    endsAt: insertedPoll.ends_at || "",
    creator: insertedPoll.creator
  };
}

export async function updatePollOptionVotes(optionId: string, votes: string[]): Promise<boolean> {
  if (!supabase || !optionId) return false;
  const { error } = await supabase.from("poll_options").update({ votes }).eq("id", optionId);
  return !error;
}

export async function deletePoll(pollId: string): Promise<boolean> {
  if (!supabase || !pollId) return false;
  const { error } = await supabase.from("polls").delete().eq("id", pollId);
  return !error;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

// The notifications table has no per-account column, so the intended recipients are
// stored inside read_by as "target:<email>" entries alongside plain read-receipt emails.
const TARGET_PREFIX = "target:";

export function notificationFromDb(row: any): Notification {
  const rawReadBy: string[] = Array.isArray(row.read_by) ? row.read_by : [];
  return {
    id: row.id,
    title: row.title || "",
    message: row.message || "",
    type: row.type || "info",
    timestamp: row.timestamp || row.created_at || new Date().toISOString(),
    readBy: rawReadBy.filter((entry) => !entry.startsWith(TARGET_PREFIX)),
    targetEmails: rawReadBy
      .filter((entry) => entry.startsWith(TARGET_PREFIX))
      .map((entry) => entry.slice(TARGET_PREFIX.length))
  };
}

export async function fetchNotifications(): Promise<Notification[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("notifications").select("*").order("timestamp", { ascending: false }).limit(50);
  if (error) {
    console.error("Error fetching notifications:", error.message);
    return [];
  }
  return (data || []).map(notificationFromDb);
}

export async function createNotification(n: Partial<Notification>): Promise<Notification | null> {
  if (!supabase || !n.title) return null;
  const id = ensureUuid(n.id);
  const targets = Array.from(new Set(
    (n.targetEmails || [])
      .map((email) => normalizeEmail(email).toLowerCase())
      .filter(Boolean)
  ));
  const row = {
    id,
    title: n.title,
    message: n.message || "",
    type: n.type || "info",
    timestamp: n.timestamp ? new Date(n.timestamp).toISOString() : new Date().toISOString(),
    read_by: [...(Array.isArray(n.readBy) ? n.readBy : []), ...targets.map((email) => `${TARGET_PREFIX}${email}`)]
  };
  const { data, error } = await supabase.from("notifications").insert(row).select().single();
  if (error) {
    console.error("Error inserting notification:", error.message);
    return null;
  }
  return notificationFromDb(data);
}

export async function markNotificationRead(id: string, userEmail: string): Promise<void> {
  if (!supabase || !id || !userEmail) return;
  const { data } = await supabase.from("notifications").select("read_by").eq("id", id).maybeSingle();
  const currentReadBy: string[] = Array.isArray(data?.read_by) ? data.read_by : [];
  if (!currentReadBy.includes(userEmail)) {
    await supabase.from("notifications").update({
      read_by: [...currentReadBy, userEmail]
    }).eq("id", id);
  }
}

// ============================================================================
// ANNOUNCEMENTS
// ============================================================================

export async function fetchAnnouncements(): Promise<any[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching announcements:", error.message);
    return [];
  }
  return data || [];
}

export async function createAnnouncement(ann: { id?: string; title: string; content: string; author?: string; date?: string }): Promise<any> {
  if (!supabase) return null;
  const id = ensureUuid(ann.id);
  const row = {
    id,
    title: ann.title,
    content: ann.content,
    author: ann.author || "Layout Desk",
    date: ann.date || new Date().toISOString().substring(0, 10),
    created_at: new Date().toISOString()
  };
  const { data, error } = await supabase.from("announcements").insert(row).select().single();
  if (error) console.error("Error inserting announcement:", error.message);
  return data;
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  if (!supabase) return false;
  const uuid = ensureUuid(id);
  const { error } = await supabase.from("announcements").delete().eq("id", uuid);
  if (error) {
    console.error("Error deleting announcement:", error.message);
    return false;
  }
  return true;
}

// ============================================================================
// ISSUE SHEETS & SHARED APP STATE
// ============================================================================

export async function fetchIssueSheets(): Promise<any[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("app_state").select("data").eq("id", "issue_sheets").maybeSingle();
  if (error && error.code !== "PGRST116") {
    console.warn("Issue sheets fetch failed:", error.message);
    return null;
  }
  if (!data?.data) return null;
  return Array.isArray(data.data) ? data.data : null;
}

export async function saveIssueSheets(sheets: any[]): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("app_state").upsert({
    id: "issue_sheets",
    data: sheets,
    updated_at: new Date().toISOString()
  });
  if (error) {
    console.error("Error saving issue sheets to app_state:", error.message);
    return false;
  }
  return true;
}

// ============================================================================
// CANVA TEMPLATE DIRECTORY (shared team state via app_state)
// ============================================================================

export interface CanvaDirectoryState {
  links: Record<string, string>;
  custom: Array<{ id: string; name: string; category: string; defaultLink: string; isCustom?: boolean }>;
  removed: string[];
}

function normalizeCanvaState(d: any): CanvaDirectoryState {
  return {
    links: d && typeof d.links === "object" && d.links ? d.links : {},
    custom: d && Array.isArray(d.custom) ? d.custom : [],
    removed: d && Array.isArray(d.removed) ? d.removed : []
  };
}

export async function fetchCanvaState(): Promise<CanvaDirectoryState | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("app_state").select("data").eq("id", "canva_templates").maybeSingle();
  if (error && error.code !== "PGRST116") {
    console.warn("Canva templates fetch failed:", error.message);
    return null;
  }
  if (!data?.data || typeof data.data !== "object") return null;
  return normalizeCanvaState(data.data);
}

export async function saveCanvaState(state: CanvaDirectoryState): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("app_state").upsert({
    id: "canva_templates",
    data: state,
    updated_at: new Date().toISOString()
  });
  if (error) {
    console.error("Error saving canva templates to app_state:", error.message);
    return false;
  }
  return true;
}

export function subscribeToCanvaState(onChange: (state: CanvaDirectoryState) => void): () => void {
  if (!supabase) return () => {};
  const channelName = `mkule-canva-${Math.random().toString(36).substring(2, 9)}`;
  const channel: RealtimeChannel = supabase.channel(channelName);
  channel.on("postgres_changes", { event: "*", schema: "public", table: "app_state" }, (payload) => {
    const rec = payload.new as any;
    if (rec && rec.id === "canva_templates" && rec.data) {
      onChange(normalizeCanvaState(rec.data));
    }
  });
  channel.subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// ============================================================================
// REALTIME SUBSCRIPTION MANAGER
// ============================================================================

export interface RealtimeHandlers {
  onTasksChange?: () => void;
  onCommentsChange?: (payload: any) => void;
  onCalendarChange?: () => void;
  onPersonalEventsChange?: () => void;
  onPollsChange?: () => void;
  onNotificationsChange?: (payload: any) => void;
  onAnnouncementsChange?: () => void;
  onMembersChange?: () => void;
  onIssueSheetsChange?: (data: any) => void;
}

export function subscribeToLayoutRealtime(handlers: RealtimeHandlers): () => void {
  if (!supabase) return () => {};

  const channelName = `mkule-realtime-${Math.random().toString(36).substring(2, 9)}`;
  const channel: RealtimeChannel = supabase.channel(channelName);

  channel
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
      handlers.onTasksChange?.();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "task_comments" }, (payload) => {
      handlers.onCommentsChange?.(payload);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, () => {
      handlers.onCalendarChange?.();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "personal_calendar_events" }, () => {
      handlers.onPersonalEventsChange?.();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "polls" }, () => {
      handlers.onPollsChange?.();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "poll_options" }, () => {
      handlers.onPollsChange?.();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, (payload) => {
      handlers.onNotificationsChange?.(payload);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
      handlers.onAnnouncementsChange?.();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "members" }, () => {
      handlers.onMembersChange?.();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "app_state" }, (payload) => {
      if (payload.new && (payload.new as any).id === "issue_sheets") {
        handlers.onIssueSheetsChange?.((payload.new as any).data);
      }
    });

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      // Connected to Realtime
    }
  });

  return () => {
    supabase.removeChannel(channel);
  };
}
