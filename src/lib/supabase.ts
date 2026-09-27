import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
};

export async function fetchUserProfileByEmail(email: string): Promise<AppProfile | null> {
  if (!supabase || !email) return null;

  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    console.warn("Profile lookup failed:", error.message);
    return null;
  }

  return data as AppProfile | null;
}

export async function fetchSupabaseState<T = unknown>() {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("app_state")
    .select("content")
    .eq("id", "app-state")
    .maybeSingle();

  if (error) {
    console.warn("Supabase fetch failed:", error.message);
    return null;
  }

  if (!data?.content) return null;
  return (typeof data.content === "string" ? JSON.parse(data.content) : data.content) as T;
}

export async function saveSupabaseState<T = unknown>(payload: T) {
  if (!supabase) return false;

  const { error } = await supabase.from("app_state").upsert(
    {
      id: "app-state",
      content: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    console.warn("Supabase save failed:", error.message);
    return false;
  }

  return true;
}
