import { redirect as nextRedirect } from "next/navigation";

/**
 * redirect() wrapper that auto-encodes non-ASCII query parameters.
 * Node.js HTTP headers reject non-ASCII characters; this prevents ERR_INVALID_CHAR.
 */
export function redirect(url: string): never {
  const qIdx = url.indexOf("?");
  if (qIdx === -1) return nextRedirect(url) as never;

  const path   = url.slice(0, qIdx);
  const params = new URLSearchParams(url.slice(qIdx + 1));
  return nextRedirect(`${path}?${params.toString()}`) as never;
}
