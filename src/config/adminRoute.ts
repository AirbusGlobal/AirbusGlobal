/**
 * Private Admin Portal Route Configuration
 * 
 * Keep the path in a single constant so it can easily be changed later
 * (e.g., when the custom Airbus domain is connected).
 */
export const ADMIN_PORTAL_PATH = '/admin-portal-k7x2q9';

/**
 * Normalizes a pathname to check if it matches the private admin portal route.
 * Handles both production (root `/`) and Vite base prefix (e.g., `/AirbusGlobal/`).
 */
export function isAdminRoute(pathname: string = window.location.pathname): boolean {
  // Strip trailing slashes and normalize
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  
  if (cleanPath === ADMIN_PORTAL_PATH) {
    return true;
  }
  
  // Vite dev or GitHub Pages style sub-path: /AirbusGlobal/admin-portal-k7x2q9
  if (cleanPath.endsWith(ADMIN_PORTAL_PATH)) {
    return true;
  }
  
  return false;
}

/**
 * Returns the full navigation path for the admin portal, taking into account Vite base URL.
 */
export function getAdminPortalHref(): string {
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${prefix}${ADMIN_PORTAL_PATH}`;
}
