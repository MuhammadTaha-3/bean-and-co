// Frontend-only admin gate (Phase 1). Phase 2: replace with a real session from the backend.
export const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "admin@beanandco.pk").toLowerCase();
const KEY = "bc2_admin_session";

export function adminLogin(email: string): boolean {
  if (email.trim().toLowerCase() !== ADMIN_EMAIL) return false;
  window.localStorage.setItem(KEY, ADMIN_EMAIL);
  return true;
}
export const adminLogout = () => window.localStorage.removeItem(KEY);
export const hasAdminSession = () =>
  typeof window !== "undefined" && window.localStorage.getItem(KEY) === ADMIN_EMAIL;
