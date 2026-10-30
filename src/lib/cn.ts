export function cn(
  ...parts: Array<string | null | undefined | false | 0>
): string {
  return parts.filter(Boolean).join(" ");
}
