export interface PageResult<T> {
  data: T;
  nextUrl?: string;
}

export async function paginateWs<T>({
  pageSize,
  start = 0,
  fetchPage,
}: {
  pageSize: number;
  start?: number;
  fetchPage: (pageStart: number, pageSize: number) => Promise<T>;
}): Promise<T> {
  const pages: T[] = [];
  let pageStart = start;

  for (;;) {
    const page = await fetchPage(pageStart, pageSize);
    pages.push(page);

    const entries = extractEntries(page);
    if (!entries || entries.length < pageSize) {
      return mergePages(pages);
    }

    pageStart += entries.length;
  }
}

export async function paginateLinkHeader<T>({
  initialPage,
  fetchPage,
}: {
  initialPage: PageResult<T>;
  fetchPage: (url: string) => Promise<PageResult<T>>;
}): Promise<T> {
  const pages: T[] = [initialPage.data];
  let nextUrl = initialPage.nextUrl;

  while (nextUrl) {
    const nextPage = await fetchPage(nextUrl);
    pages.push(nextPage.data);
    nextUrl = nextPage.nextUrl;
  }

  return mergePages(pages);
}

export function parseLinkHeader(header: string | null): Record<string, string> {
  if (!header) {
    return {};
  }

  const links: Record<string, string> = {};

  for (const part of header.split(",")) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="([^"]+)"/);
    if (match) {
      links[match[2]] = match[1];
    }
  }

  return links;
}

export function extractEntries(value: unknown): unknown[] | null {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "object" && value !== null && Array.isArray((value as { entries?: unknown[] }).entries)) {
    return (value as { entries: unknown[] }).entries;
  }

  return null;
}

function mergePages<T>(pages: T[]): T {
  if (pages.length === 1) {
    return pages[0];
  }

  if (pages.every(Array.isArray)) {
    return pages.flat() as T;
  }

  const first = pages[0];
  if (typeof first === "object" && first !== null && Array.isArray((first as { entries?: unknown[] }).entries)) {
    const mergedEntries = pages.flatMap((page) => extractEntries(page) ?? []);
    return {
      ...(first as Record<string, unknown>),
      entries: mergedEntries,
    } as T;
  }

  return pages[pages.length - 1];
}
