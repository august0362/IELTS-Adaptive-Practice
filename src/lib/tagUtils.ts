// Unicode-aware so Vietnamese tags like "#TừVựng" are matched, not just ASCII.
const TAG_PATTERN = /#([\p{L}\p{N}_]+)/gu;

/** Pulls every #tag out of free-form note content, in first-seen order, deduplicated. */
export function extractTags(content: string): string[] {
  const seen = new Set<string>();
  for (const match of content.matchAll(TAG_PATTERN)) {
    seen.add(match[1]);
  }
  return Array.from(seen);
}

export function tagsToString(tags: string[]): string {
  return tags.join(",");
}

export function parseTagsString(tags: string): string[] {
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}
