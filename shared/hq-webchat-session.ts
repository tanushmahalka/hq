const COMBINING_MARKS_RE = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC_RE = /[^a-z0-9]+/g;
const EDGE_HYPHENS_RE = /^-+|-+$/g;
const REPEATED_HYPHENS_RE = /-+/g;
const USER_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type ParsedHqWebchatSessionKey = {
  agentId: string;
  userSlug: string;
  userName: string;
};

export function slugifyHqWebchatUserName(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(COMBINING_MARKS_RE, "")
    .toLowerCase()
    .replace(NON_ALPHANUMERIC_RE, "-")
    .replace(REPEATED_HYPHENS_RE, "-")
    .replace(EDGE_HYPHENS_RE, "");

  return slug || "user";
}

export function humanizeHqWebchatUserSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  if (!USER_SLUG_RE.test(normalized)) {
    return "User";
  }

  return normalized
    .split("-")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

export function buildHqWebchatSessionKey(params: {
  agentId: string;
  userName: string;
}): string {
  const agentId = params.agentId.trim();
  const userSlug = slugifyHqWebchatUserName(params.userName);
  return `agent:${agentId}:hq:webchat:user:${userSlug}`;
}

export function parseHqWebchatSessionKey(
  sessionKey: string,
): ParsedHqWebchatSessionKey | null {
  const parts = sessionKey.trim().split(":");
  if (parts.length !== 6) {
    return null;
  }

  const [scope, agentId, namespace, channel, kind, userSlugRaw] = parts;
  const userSlug = userSlugRaw.trim().toLowerCase();
  if (
    scope.toLowerCase() !== "agent" ||
    !agentId.trim() ||
    namespace.toLowerCase() !== "hq" ||
    channel.toLowerCase() !== "webchat" ||
    kind.toLowerCase() !== "user" ||
    !USER_SLUG_RE.test(userSlug)
  ) {
    return null;
  }

  return {
    agentId: agentId.trim(),
    userSlug,
    userName: humanizeHqWebchatUserSlug(userSlug),
  };
}
