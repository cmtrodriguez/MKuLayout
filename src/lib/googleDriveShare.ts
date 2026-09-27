import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

let firebaseApp: any = null;
let auth: any = null;

try {
  firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
} catch (e) {
  console.warn("Firebase Auth initialization warning:", e);
}

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive');
provider.addScope('https://www.googleapis.com/auth/documents');

let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initGoogleDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken && onAuthSuccess) {
        onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn && onAuthFailure) {
        onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogleDrive = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (!auth) throw new Error("Firebase Auth is not initialized");
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google OAuth access token');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err) {
    console.error("Google Drive OAuth error:", err);
    throw err;
  } finally {
    isSigningIn = false;
  }
};

export const getCachedDriveToken = () => cachedAccessToken;

export function extractGoogleFileId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/(?:document|spreadsheets|presentation|file)\/d\/([a-zA-Z0-9_-]+)/i)
    || url.match(/id=([a-zA-Z0-9_-]+)/i);
  return match && match[1] ? match[1] : null;
}

export function isGoogleDocUrl(url: string): boolean {
  if (!url) return false;
  return Boolean(extractGoogleFileId(url)) || url.includes("docs.google.com") || url.includes("drive.google.com");
}

export interface ShareResult {
  success: boolean;
  message: string;
  requiresAuth?: boolean;
}

// Cache of recently shared documents to prevent duplicate API calls & duplicate emails
const recentlySharedMap = new Map<string, number>();
const DEDUPE_WINDOW_MS = 60000; // 60 seconds deduplication window

export function isRecentlyShared(fileUrl: string, emailAddress: string, role: string = 'writer'): boolean {
  const fileId = extractGoogleFileId(fileUrl);
  if (!fileId || !emailAddress) return false;
  const key = `${fileId}:${emailAddress.toLowerCase().trim()}:${role}`;
  const timestamp = recentlySharedMap.get(key);
  return Boolean(timestamp && (Date.now() - timestamp < DEDUPE_WINDOW_MS));
}

export function clearShareCache(fileUrl?: string, emailAddress?: string): void {
  if (fileUrl && emailAddress) {
    const fileId = extractGoogleFileId(fileUrl);
    if (fileId) {
      const keyPrefix = `${fileId}:${emailAddress.toLowerCase().trim()}`;
      for (const k of recentlySharedMap.keys()) {
        if (k.startsWith(keyPrefix)) {
          recentlySharedMap.delete(k);
        }
      }
    }
  } else {
    recentlySharedMap.clear();
  }
}

export async function shareGoogleDocWithMember(
  fileUrl: string,
  emailAddress: string,
  memberName: string,
  role: string = 'writer',
  force: boolean = false
): Promise<ShareResult> {
  if (!fileUrl || !emailAddress) {
    return { success: false, message: "Missing file link or member email address." };
  }

  const fileId = extractGoogleFileId(fileUrl);
  if (!fileId) {
    return { success: false, message: "Link is not a valid Google Doc or Google Drive document." };
  }

  const normalizedEmail = emailAddress.toLowerCase().trim();
  const cacheKey = `${fileId}:${normalizedEmail}:${role}`;

  // Prevent sending duplicate emails if this document was already shared recently
  if (!force) {
    const lastSharedTime = recentlySharedMap.get(cacheKey);
    if (lastSharedTime && (Date.now() - lastSharedTime < DEDUPE_WINDOW_MS)) {
      return {
        success: true,
        message: `Access already granted to ${memberName} (${emailAddress}) on Google Doc!`
      };
    }
  }

  const token = cachedAccessToken;

  try {
    const res = await fetch("/api/drive/share", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        fileUrl,
        emailAddress: normalizedEmail,
        role,
        accessToken: token
      })
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401 || data.requiresAuth) {
        return {
          success: false,
          requiresAuth: true,
          message: `Google Drive sign-in required to automatically share document access with ${memberName} (${emailAddress}).`
        };
      }
      return {
        success: false,
        message: data.error || "Failed to grant access on Google Doc."
      };
    }

    // Record successful share to avoid duplicate email notifications
    recentlySharedMap.set(cacheKey, Date.now());

    return {
      success: true,
      message: `Access successfully granted to ${memberName} (${emailAddress}) on Google Doc!`
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Network error while connecting to Google Drive API."
    };
  }
}
