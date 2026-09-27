// Shared public catalog clients must never read an ERP/MDV admin session.
// Customer authentication continues through print3dAccountClient explicitly.
export async function getAuthSessionToken(): Promise<string> { return ''; }
export async function getCurrentAuthUserId(): Promise<null> { return null; }
export async function signOutAuthSession(): Promise<void> {}
export async function buildAuthHeaders(extra: Record<string,string> = {}) { return extra; }
