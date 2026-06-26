/**
 * Resolves the backend base URL.
 *
 * - Explicit override via NEXT_PUBLIC_API_BASE always wins.
 * - In the browser on a non-localhost host (i.e. the unified Vercel deployment),
 *   the backend is served behind the "/_/backend" route prefix on the same origin.
 * - Otherwise (local dev / SSR) fall back to the standalone dev server.
 */
export function backendBase(): string {
  if (process.env.NEXT_PUBLIC_API_BASE) return process.env.NEXT_PUBLIC_API_BASE;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") return "/_/backend";
  }
  return "http://localhost:4000";
}

export function graphqlUri(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? `${backendBase()}/graphql`;
}

export function googleAuthUrl(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_AUTH_URL ?? `${backendBase()}/auth/google`;
}
