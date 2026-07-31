/**
 * API client.
 *
 * One place that knows how to talk to kyros-web:
 *   - attaches the access token,
 *   - refreshes it exactly once on a 401 and replays the request,
 *   - unwraps the { data } / { error } envelope into values and typed errors.
 *
 * Callers never see the envelope and never handle token expiry.
 */

import { getTokens, setTokens, clearTokens } from './tokens';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'OTP_ATTEMPTS_EXCEEDED'
  | 'CONSENT_REQUIRED'
  | 'CONSENT_WITHDRAWN'
  | 'ENROLLMENT_STEP_INVALID'
  | 'BATCH_AT_CAPACITY'
  | 'WAITLIST_FULL'
  | 'PAYMENT_FAILED'
  | 'POLICY_VIOLATION'
  | 'SLOT_UNAVAILABLE'
  | 'CONFIG_INVALID'
  | 'INTERNAL'
  | 'NETWORK';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, status = 0, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** True when retrying later could plausibly succeed. */
  get isRetryable(): boolean {
    return this.code === 'NETWORK' || this.code === 'INTERNAL' || this.status >= 500;
  }

  /** True when the failure is the device being offline rather than a rejection. */
  get isOffline(): boolean {
    return this.code === 'NETWORK';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Skip the Authorization header (signup, login, catalog browsing). */
  anonymous?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(path.startsWith('/') ? path : `/${path}`, BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Refresh is deduplicated: several requests failing with 401 at once must not
 * each burn a refresh token, since the server rotates them and treats reuse of
 * a rotated token as a compromise.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const tokens = await getTokens();
    if (!tokens?.refreshToken) return false;

    try {
      const response = await fetch(buildUrl('/api/v1/auth/refresh'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });

      if (!response.ok) {
        await clearTokens();
        return false;
      }

      const payload = (await response.json()) as {
        data: { accessToken: string; refreshToken: string };
      };
      await setTokens(payload.data);
      return true;
    } catch {
      // A network failure is not a reason to sign the user out — they may
      // simply be on a train.
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function execute<T>(path: string, options: RequestOptions, isRetry: boolean): Promise<T> {
  const tokens = options.anonymous ? null : await getTokens();

  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (tokens?.accessToken) headers.authorization = `Bearer ${tokens.accessToken}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch {
    throw new ApiError('NETWORK', 'No connection. Check your network and try again.');
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError('INTERNAL', 'The server sent something we could not read.', response.status);
  }

  if (response.ok) {
    return (payload as { data: T }).data;
  }

  const error = (payload as { error?: { code?: ApiErrorCode; message?: string; details?: unknown } })
    .error;
  const code = error?.code ?? 'INTERNAL';

  // One refresh attempt, then replay. `isRetry` stops an infinite loop when the
  // refresh itself yields a token the server still rejects.
  if ((code === 'TOKEN_EXPIRED' || code === 'UNAUTHENTICATED') && !isRetry && !options.anonymous) {
    if (await refreshAccessToken()) {
      return execute<T>(path, options, true);
    }
  }

  throw new ApiError(
    code,
    error?.message ?? 'Something went wrong.',
    response.status,
    error?.details,
  );
}

export function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return execute<T>(path, options, false);
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], anonymous = false) =>
    request<T>(path, { method: 'GET', query, anonymous }),
  post: <T>(path: string, body?: unknown, anonymous = false) =>
    request<T>(path, { method: 'POST', body, anonymous }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
};
