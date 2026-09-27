import { UserRole } from "../types";

export interface MemberOfficialInfo {
  email: string;
  officialName: string;
  displayName: string;
  preferredFirstName: string;
  role: UserRole;
  college: string;
  contact: string;
}

export const OFFICIAL_MEMBERS_MAP: Record<string, MemberOfficialInfo> = {
  "ctrodriguez2@up.edu.ph": {
    email: "ctrodriguez2@up.edu.ph",
    officialName: "Rodriguez, Christian Matthew T.",
    displayName: "RODRIGUEZ - Xtian Rodriguez",
    preferredFirstName: "Xtian",
    role: "Layout Editor",
    college: "CAS",
    contact: "9812918708"
  },
  "rcabad1@up.edu.ph": {
    email: "rcabad1@up.edu.ph",
    officialName: "Abad, Ryaen Vincent C.",
    displayName: "ABAD - Ronz Abad",
    preferredFirstName: "Ronz",
    role: "Layout Deputy",
    college: "CAMP",
    contact: "9270675190"
  },
  "lfroldan@up.edu.ph": {
    email: "lfroldan@up.edu.ph",
    officialName: "Roldan, Lady Jamaica F.",
    displayName: "ROLDAN - Jam Roldan",
    preferredFirstName: "Jam",
    role: "Layout Staffer",
    college: "CAMP",
    contact: "9629022674"
  },
  "cndonor@up.edu.ph": {
    email: "cndonor@up.edu.ph",
    officialName: "Donor, Carl Dexter N.",
    displayName: "DONOR - Carl Donor",
    preferredFirstName: "Carl",
    role: "Layout Staffer",
    college: "CP",
    contact: "9054353693"
  },
  "jaumali2@up.edu.ph": {
    email: "jaumali2@up.edu.ph",
    officialName: "Umali, Jherica A.",
    displayName: "UMALI - Jhe Umali",
    preferredFirstName: "Jhe",
    role: "Layout Probi",
    college: "CPH",
    contact: "9294904845"
  },
  "ctmusni@up.edu.ph": {
    email: "ctmusni@up.edu.ph",
    officialName: "Musni, Clarisse Joy T.",
    displayName: "MUSNI - Aris Musni",
    preferredFirstName: "Aris",
    role: "Layout Probi",
    college: "CP",
    contact: "9305260606"
  },
  "casorio@up.edu.ph": {
    email: "casorio@up.edu.ph",
    officialName: "Sorio, Clarissa Joyce A.",
    displayName: "SORIO - Issa Sorio",
    preferredFirstName: "Issa",
    role: "Layout Probi",
    college: "CP",
    contact: "9662691102"
  },
  "ztatienza@up.edu.ph": {
    email: "ztatienza@up.edu.ph",
    officialName: "Atienza, Zoe Marceux T.",
    displayName: "ATIENZA - Zoe Atienza",
    preferredFirstName: "Zoe",
    role: "Layout Probi",
    college: "CAS",
    contact: "9171234567"
  },
  "jcmagno1@up.edu.ph": {
    email: "jcmagno1@up.edu.ph",
    officialName: "Magno, Joanna Eve C.",
    displayName: "MAGNO - Eve Magno",
    preferredFirstName: "Eve",
    role: "Layout Probi",
    college: "CAS",
    contact: "9189876543"
  },
  "ibdizon@up.edu.ph": {
    email: "ibdizon@up.edu.ph",
    officialName: "Dizon, Iris B.",
    displayName: "DIZON - Iris Dizon",
    preferredFirstName: "Iris",
    role: "Layout Probi",
    college: "CAMP",
    contact: "9195551234"
  }
};

/**
 * Returns the requested preferred First Name for the user
 * (e.g. Christian, Ronz, Jam, Carl, Jhe, Aris, Issa, Zoe, Eve, Iris)
 */
export function getPreferredFirstName(name?: string | null, email?: string | null): string {
  if (email) {
    const lowEmail = email.trim().toLowerCase();
    for (const [key, val] of Object.entries(OFFICIAL_MEMBERS_MAP)) {
      if (key.toLowerCase() === lowEmail) {
        return val.preferredFirstName;
      }
    }
  }

  if (!name) return "Staff";

  const lower = name.toLowerCase();
  if (lower.includes("rodriguez") || lower.includes("christian")) return "Christian";
  if (lower.includes("abad") || lower.includes("ronz") || lower.includes("ryaen")) return "Ronz";
  if (lower.includes("roldan") || lower.includes("jam") || lower.includes("lady")) return "Jam";
  if (lower.includes("donor") || lower.includes("carl")) return "Carl";
  if (lower.includes("umali") || lower.includes("jhe") || lower.includes("jherica")) return "Jhe";
  if (lower.includes("musni") || lower.includes("aris") || lower.includes("clarisse")) return "Aris";
  if (lower.includes("sorio") || lower.includes("issa") || lower.includes("clarissa")) return "Issa";
  if (lower.includes("atienza") || lower.includes("zoe")) return "Zoe";
  if (lower.includes("magno") || lower.includes("eve") || lower.includes("joanna")) return "Eve";
  if (lower.includes("dizon") || lower.includes("iris")) return "Iris";

  if (name.includes(",")) {
    const parts = name.split(",");
    if (parts[1]) {
      const first = parts[1].trim().split(" ")[0];
      if (first) return first;
    }
  }

  return name.trim().split(" ")[0] || "Staff";
}

/**
 * Get official display name (e.g. "ABAD - Ronz Abad")
 */
export function getOfficialDisplayName(email?: string, name?: string): string {
  if (email) {
    const info = OFFICIAL_MEMBERS_MAP[email.trim().toLowerCase()];
    if (info) return info.displayName;
  }
  if (name) {
    const lower = name.toLowerCase();
    for (const val of Object.values(OFFICIAL_MEMBERS_MAP)) {
      if (
        lower.includes(val.preferredFirstName.toLowerCase()) || 
        lower.includes(val.officialName.toLowerCase().split(",")[0])
      ) {
        return val.displayName;
      }
    }
  }
  return name || "Layout Artist";
}

export function getOfficialFullName(name?: string | null, email?: string | null): string {
  if (email) {
    const info = OFFICIAL_MEMBERS_MAP[email.trim().toLowerCase()];
    if (info) return info.officialName;
  }

  if (!name) return "Layout Artist";

  const lower = name.toLowerCase();
  for (const val of Object.values(OFFICIAL_MEMBERS_MAP)) {
    if (
      lower.includes(val.preferredFirstName.toLowerCase()) ||
      lower.includes(val.officialName.toLowerCase().split(",")[0]) ||
      lower.includes(val.displayName.toLowerCase().split(" - ")[1]?.trim().toLowerCase() || "")
    ) {
      return val.officialName;
    }
  }

  const trimmed = name.trim();
  if (!trimmed) return "Layout Artist";
  if (trimmed.includes(",")) return trimmed;
  const parts = trimmed.split(/\s+/);
  if (parts.length <= 1) return trimmed;
  return `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(" ")}`;
}

/**
 * Checks if a task is assigned to a specific staff member
 */
export function isUserAssignedToTask(task: { illusLayout?: string; graphics?: string; writer?: string }, userName: string, userEmail: string): boolean {
  const preferred = getPreferredFirstName(userName, userEmail).toLowerCase();
  const rawTarget = `${task.illusLayout || ""} ${task.graphics || ""}`.toLowerCase();

  if (rawTarget.includes(preferred)) return true;

  if (userEmail) {
    const info = OFFICIAL_MEMBERS_MAP[userEmail.toLowerCase()];
    if (info) {
      const lastName = info.officialName.split(",")[0].toLowerCase();
      if (rawTarget.includes(lastName)) return true;
    }
  }

  if (userName) {
    const parts = userName.toLowerCase().split(/[\s,]+/);
    for (const p of parts) {
      if (p.length > 2 && rawTarget.includes(p)) return true;
    }
  }

  return false;
}
