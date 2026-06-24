import axios from 'axios';
import { applyElectronOverrides } from '@/lib/electron';
import { getApiBaseUrl } from '@/lib/utils/api-base-url';

/**
 * Unauthenticated axios instance for login/sign-up flows (no Bearer interceptors).
 * Session correlation uses `x-session-token` from initAuth, stored in sessionStorage.
 *
 * baseURL is resolved dynamically per-request via getApiBaseUrl() so that
 * a misconfigured NEXT_PUBLIC_API_BASE_URL (e.g. localhost set on Vercel)
 * is caught at runtime and falls back to relative URLs automatically.
 */
export const publicAuthClient = axios.create({
  baseURL: '',
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

publicAuthClient.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  return applyElectronOverrides(config);
});
