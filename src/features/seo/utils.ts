import type { BadgeVariant } from "./types";

type PageVisibilityStatus = "searchable" | "hidden" | "attention";

export function toTitleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatDate(value: Date | string | null) {
  if (!value) return "Not available";
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

export function formatOptionalNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "Not captured";
  return formatNumber(value);
}

export function formatOptionalDecimal(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "Not captured";

  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(value);

  if (Number.isNaN(numericValue)) {
    return "Not captured";
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(numericValue);
}

export function getPageRole(
  pageType: string,
  isMoneyPage: boolean,
  isAuthorityAsset: boolean,
) {
  const normalizedPageType = pageType.trim().toLowerCase();

  if (["homepage", "core_page"].includes(normalizedPageType)) {
    return {
      label: "Core page",
      tone: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-200",
    };
  }

  if (
    ["service", "category", "product", "local_landing"].includes(
      normalizedPageType,
    )
  ) {
    return {
      label: "Revenue page",
      tone: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-200",
    };
  }

  if (normalizedPageType === "tool") {
    return {
      label: "Lead magnet",
      tone: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200",
    };
  }

  if (["article", "resource_article"].includes(normalizedPageType)) {
    return {
      label: "Authority asset",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    };
  }

  if (normalizedPageType === "legal") {
    return {
      label: "Legal page",
      tone: "border-stone-200 bg-stone-50 text-stone-700 dark:border-stone-400/30 dark:bg-stone-500/10 dark:text-stone-200",
    };
  }

  if (isMoneyPage && isAuthorityAsset) {
    return {
      label: "Revenue + authority",
      tone: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-400/30 dark:bg-fuchsia-500/10 dark:text-fuchsia-200",
    };
  }

  if (isMoneyPage) {
    return {
      label: "Revenue page",
      tone: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-200",
    };
  }

  if (isAuthorityAsset) {
    return {
      label: "Authority asset",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    };
  }

  return {
    label: "General page",
    tone: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-400/20 dark:bg-slate-500/10 dark:text-slate-200",
  };
}

export function getPageStatusDotClass(filter: PageVisibilityStatus) {
  if (filter === "searchable") return "bg-emerald-400";
  if (filter === "hidden") return "bg-slate-300";
  return "bg-amber-400";
}

export function getDisplayPath(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.pathname || "/";
  } catch {
    return url;
  }
}

export function getVisibilityStatus(
  indexability: string | null,
  statusCode: number | null,
): {
  label: string;
  variant: BadgeVariant;
  filter: PageVisibilityStatus;
} {
  const normalized = indexability?.toLowerCase() ?? "";

  if (statusCode !== null && statusCode >= 400) {
    return {
      label: "Needs attention",
      variant: "destructive",
      filter: "attention",
    };
  }

  if (normalized.includes("noindex") || normalized.includes("blocked")) {
    return {
      label: "Hidden from search",
      variant: "secondary",
      filter: "hidden",
    };
  }

  if (normalized.includes("index")) {
    return {
      label: "Can appear in search",
      variant: "default",
      filter: "searchable",
    };
  }

  return {
    label: "Review status",
    variant: "outline",
    filter: "attention",
  };
}

export function getPriorityStatus(priorityScore: string | null): {
  label: string;
  variant: BadgeVariant;
} {
  const numericScore = priorityScore ? Number(priorityScore) : Number.NaN;

  if (!Number.isNaN(numericScore) && numericScore >= 80) {
    return { label: "High priority", variant: "default" };
  }

  if (!Number.isNaN(numericScore) && numericScore >= 50) {
    return { label: "Medium priority", variant: "secondary" };
  }

  if (!Number.isNaN(numericScore)) {
    return { label: "Low priority", variant: "outline" };
  }

  return { label: "Priority open", variant: "outline" };
}
