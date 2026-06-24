import { isElectron, getElectronApiBaseUrl } from '@/lib/electron';

/**
 * Returns the API base URL.
 *
 * - **Electron**: session URL (pre-login Continue) then durable localStorage (post-login).
 * - **Web**: returns the build-time NEXT_PUBLIC_API_BASE_URL env variable. The
 *   web build never trusts localStorage — a stale value or any localStorage
 *   write from this origin would otherwise silently redirect every API call,
 *   including auth-bearing requests.
 *
 * Safety: if NEXT_PUBLIC_API_BASE_URL is set to a localhost URL but the app is
 * running on a non-localhost host (e.g. Vercel), we fall back to relative URLs
 * so that Next.js API routes on the same origin are always reachable.
 */
export function getApiBaseUrl(): string {
  if (isElectron()) {
    return getElectronApiBaseUrl();
  }
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL || '';
  if (configured && typeof window !== 'undefined') {
    try {
      const url = new URL(configured);
      const isLocalhost =
        url.hostname === 'localhost' || url.hostname === '127.0.0.1';
      const runningOnLocalhost =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
      if (isLocalhost && !runningOnLocalhost) {
        // Configured to hit localhost but deployed elsewhere — use relative URLs
        return '';
      }
    } catch {
      // Malformed URL — fall back to relative
      return '';
    }
  }
  return configured;
}
