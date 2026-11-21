/**
 * Private Admin Portal Route Configuration
 * 
 * Keep the path in a single constant so it can easily be changed later
 * (e.g., when the custom Airbus domain is connected).
 */
export const ADMIN_PORTAL_PATH = '/admin-portal-k7x2q9';
export const ADMIN_ALIAS_PATH = '/admin';

/**
 * Normalizes a pathname to check if it matches the private admin portal route (/admin-portal-k7x2q9 or /admin).
 * Handles both production (root `/`) and Vite base prefix (e.g., `/AirbusGlobal/`).
 */
export function isAdminRoute(pathname: string = window.location.pathname): boolean {
  const cleanPath = ('/' + pathname.replace(/^\/+/, '')).replace(/\/+$/, '') || '/';

  if (cleanPath === ADMIN_PORTAL_PATH || cleanPath.endsWith(ADMIN_PORTAL_PATH)) {
    return true;
  }

  if (cleanPath === ADMIN_ALIAS_PATH || cleanPath.endsWith(ADMIN_ALIAS_PATH)) {
    return true;
  }

  return false;
}

/**
 * Returns the root-normalized base prefix (never a relative './' prefix) so /admin resolves cleanly.
 */
export function getNormalizedBasePrefix(pathname: string = typeof window !== 'undefined' ? window.location.pathname : '/'): string {
  if (pathname.startsWith('/AirbusGlobal')) {
    return '/AirbusGlobal';
  }
  const base = import.meta.env.BASE_URL || '/';
  if (!base || base === '/' || base === './' || base === '.') {
    return '';
  }
  const leading = base.startsWith('/') ? base : `/${base}`;
  return leading.replace(/\/+$/, '');
}

/**
 * Returns the full navigation path for the admin portal, taking into account Vite base URL.
 */
export function getAdminPortalHref(): string {
  return `${getNormalizedBasePrefix()}${ADMIN_PORTAL_PATH}`;
}
