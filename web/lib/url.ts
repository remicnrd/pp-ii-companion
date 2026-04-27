// Helper for prefixing static asset URLs with the configured basePath.
// Set NEXT_PUBLIC_BASE_PATH at build time (driven by BASE_PATH in next.config.ts).
const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

/** Prepend the configured basePath to an absolute path. Returns input if already absolute (http(s)://). */
export function withBasePath(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.startsWith("/")) path = "/" + path;
  return BASE + path;
}

export const BASE_PATH = BASE;
