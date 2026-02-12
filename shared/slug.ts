const SUFFIX_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const SUFFIX_LENGTH = 3;
const MAX_TITLE_LENGTH = 48;

function randomSuffix(): string {
  let s = "";
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    s += SUFFIX_CHARS[Math.floor(Math.random() * SUFFIX_CHARS.length)];
  }
  return s;
}

export function generateTaskSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  let truncated = slug.slice(0, MAX_TITLE_LENGTH);
  if (slug.length > MAX_TITLE_LENGTH) {
    const lastHyphen = truncated.lastIndexOf("-");
    if (lastHyphen > 0) truncated = truncated.slice(0, lastHyphen);
  }

  const base = truncated || "task";
  return `${base}-${randomSuffix()}`;
}
