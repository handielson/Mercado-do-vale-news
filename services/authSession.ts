import { vpsAuthService } from './vpsAuthService';

export async function getAuthSessionToken(): Promise<string> {
  return vpsAuthService.getStoredToken();
}

export async function getCurrentAuthUserId(): Promise<string | null> {
  return vpsAuthService.getStoredSession()?.user.id || null;
}

export async function signOutAuthSession(): Promise<void> {
  vpsAuthService.signOut();
}

export async function buildAuthHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await getAuthSessionToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}
