import { eq, sql } from "drizzle-orm";
import type { Database } from "../db/client.ts";
import {
  geoPrompts,
  pageClusterTargets,
  pages,
  queryClusters,
  queries,
  sites,
} from "../../drizzle/schema/seo.ts";

type SiteContext = {
  id: number;
  name: string;
  domain: string;
  businessType: string;
};

type PromptSeed = {
  id: number | null;
  prompt: string;
  source: "geo_prompt" | "query_seed";
  isPrimaryQuerySeed: boolean;
  isConversational: boolean;
};

type ClusterPromptGroup = {
  clusterId: number;
  clusterName: string;
  intent: string | null;
  funnelStage: string | null;
  priorityScore: number | null;
  promptCount: number;
  conversationalPromptCount: number;
  mappedPageTitle: string | null;
  mappedPageUrl: string | null;
  prompts: PromptSeed[];
};

export type GeoOverview = {
  site: {
    id: number;
    name: string;
    domain: string;
    businessType: string;
    pageCount: number;
    clusterCount: number;
  };
  setup: {
    hasSchema: boolean;
    hasSavedPrompts: boolean;
    headline: string;
    description: string;
    nextStep: string;
  };
  summary: {
    clusterCount: number;
    totalPrompts: number;
    clusterCoverage: number;
    mappedClusterCount: number;
    conversationalPromptCount: number;
    activeRecommendations: number;
  };
  clusters: ClusterPromptGroup[];
  recommendations: Array<{
    id: number | null;
    type: string;
    title: string;
    rationale: string;
    status: string;
    impactScore: number | null;
    effortScore: number | null;
    clusterId: number | null;
    clusterName: string | null;
    prompt: string | null;
    pageTitle: string | null;
    pageUrl: string | null;
  }>;
};

function parseNumeric(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isNaN(numericValue) ? null : numericValue;
}

function normalizePrompt(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function derivePageTitle(url: string, titleTag: string | null) {
  if (titleTag?.trim()) return titleTag.trim();

  try {
    const parsed = new URL(url);
    return parsed.pathname === "/" ? parsed.hostname : parsed.pathname;
  } catch {
    return url;
  }
}

async function hasGeoSchema(db: Database): Promise<boolean> {
  try {
    const result = await db.execute(sql<{ exists: boolean }>`
      SELECT to_regclass('public.geo_prompts') IS NOT NULL AS "exists"
    `);
    return Boolean(result.rows[0]?.exists);
  } catch {
    return false;
  }
}

function isConversationalPrompt(prompt: string) {
  const words = prompt.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 6) return true;
  return /\?/.test(prompt) || /\b(how|what|why|when|who|best|should|can|does|is|are|my|our|you)\b/i.test(prompt);
}

function sortPrompts(a: PromptSeed, b: PromptSeed) {
  if (a.source !== b.source) {
    return a.source === "geo_prompt" ? -1 : 1;
  }

  if (a.isPrimaryQuerySeed !== b.isPrimaryQuerySeed) {
    return a.isPrimaryQuerySeed ? -1 : 1;
  }

  if (a.isConversational !== b.isConversational) {
    return a.isConversational ? -1 : 1;
  }

  return a.prompt.localeCompare(b.prompt);
}

function sortClusters(a: ClusterPromptGroup, b: ClusterPromptGroup) {
  const priorityDelta = (b.priorityScore ?? -1) - (a.priorityScore ?? -1);
  if (priorityDelta !== 0) return priorityDelta;

  const promptDelta = b.promptCount - a.promptCount;
  if (promptDelta !== 0) return promptDelta;

  return a.clusterName.localeCompare(b.clusterName);
}

function buildSetupCopy(args: {
  hasSchema: boolean;
  hasSavedPrompts: boolean;
  clusterCount: number;
  coveredClusterCount: number;
  totalPrompts: number;
  conversationalPromptCount: number;
}): GeoOverview["setup"] {
  if (args.clusterCount === 0) {
    return {
      hasSchema: args.hasSchema,
      hasSavedPrompts: args.hasSavedPrompts,
      headline: "GEO starts with query clusters",
      description:
        "This workspace does not have SEO query clusters yet, so there is nothing for GEO to organize into conversational prompt buckets.",
      nextStep: "Add query clusters first, then GEO can turn them into a prompt library for AI-style discovery.",
    };
  }

  if (!args.hasSchema) {
    return {
      hasSchema: false,
      hasSavedPrompts: false,
      headline: "GEO is using query clusters as the starter prompt library",
      description: `HQ found ${args.totalPrompts} seed prompts across ${args.coveredClusterCount} query clusters by reusing the existing SEO query set.`,
      nextStep:
        "Run `bun run db:push` when you want to save dedicated long-form GEO prompts directly under each cluster.",
    };
  }

  if (!args.hasSavedPrompts) {
    return {
      hasSchema: true,
      hasSavedPrompts: false,
      headline: "GEO is seeded from the current query clusters",
      description: `Each query cluster now acts like its own prompt set. Right now the prompt library is mostly seeded from search-style queries, not saved long-form GEO prompts yet.`,
      nextStep:
        "Rewrite the top clusters into longer, friend-style prompts first so AI discovery maps to how buyers actually ask.",
    };
  }

  return {
    hasSchema: true,
    hasSavedPrompts: true,
    headline: "GEO prompt planning is organized by query cluster",
    description: `You have ${args.totalPrompts} prompts across ${args.coveredClusterCount} clusters, and ${args.conversationalPromptCount} of them already read like natural AI conversations.`,
    nextStep:
      "Keep expanding thin clusters and replace terse search phrases with prompts that sound like a buyer talking to an assistant.",
  };
}

function buildHeuristicRecommendations(args: {
  hasSchema: boolean;
  clusters: ClusterPromptGroup[];
}): GeoOverview["recommendations"] {
  const recommendations: GeoOverview["recommendations"] = [];

  if (!args.hasSchema) {
    recommendations.push({
      id: null,
      type: "setup",
      title: "Enable saved GEO prompts under each query cluster",
      rationale:
        "HQ is already deriving seed prompts from your SEO clusters. Migrating the GEO prompt table lets the team save dedicated long-form prompts per cluster instead of relying only on query seeds.",
      status: "open",
      impactScore: 92,
      effortScore: 18,
      clusterId: null,
      clusterName: null,
      prompt: null,
      pageTitle: null,
      pageUrl: null,
    });
  }

  const clustersWithoutPrompts = [...args.clusters]
    .filter((cluster) => cluster.promptCount === 0)
    .sort(sortClusters)
    .slice(0, 2);

  for (const cluster of clustersWithoutPrompts) {
    recommendations.push({
      id: null,
      type: "prompt_gap",
      title: `Add the first GEO prompts to "${cluster.clusterName}"`,
      rationale:
        "This cluster exists in SEO, but GEO does not have any prompt phrasing for it yet. Start with a few buyer-style questions so the cluster can participate in AI discovery planning.",
      status: "open",
      impactScore: cluster.priorityScore ?? 78,
      effortScore: 24,
      clusterId: cluster.clusterId,
      clusterName: cluster.clusterName,
      prompt: null,
      pageTitle: cluster.mappedPageTitle,
      pageUrl: cluster.mappedPageUrl,
    });
  }

  const unmappedClusters = [...args.clusters]
    .filter((cluster) => cluster.promptCount > 0 && !cluster.mappedPageUrl)
    .sort(sortClusters)
    .slice(0, 2);

  for (const cluster of unmappedClusters) {
    recommendations.push({
      id: null,
      type: "mapping_gap",
      title: `Map an owned page to "${cluster.clusterName}"`,
      rationale:
        "This cluster already has prompt intent, but there is no obvious owned page attached to it yet. GEO work is much easier to operationalize when every cluster points to a destination page.",
      status: "open",
      impactScore: cluster.priorityScore ?? 74,
      effortScore: 40,
      clusterId: cluster.clusterId,
      clusterName: cluster.clusterName,
      prompt: cluster.prompts[0]?.prompt ?? null,
      pageTitle: null,
      pageUrl: null,
    });
  }

  const nonConversationalClusters = [...args.clusters]
    .filter((cluster) => cluster.promptCount > 0 && cluster.conversationalPromptCount === 0)
    .sort(sortClusters)
    .slice(0, 2);

  for (const cluster of nonConversationalClusters) {
    recommendations.push({
      id: null,
      type: "rewrite",
      title: `Rewrite "${cluster.clusterName}" into natural-language prompts`,
      rationale:
        "The current prompts still look like search queries. GEO works better when prompts include context, constraints, and the kind of phrasing a person would use with ChatGPT or another assistant.",
      status: "open",
      impactScore: cluster.priorityScore ?? 82,
      effortScore: 28,
      clusterId: cluster.clusterId,
      clusterName: cluster.clusterName,
      prompt: cluster.prompts[0]?.prompt ?? null,
      pageTitle: cluster.mappedPageTitle,
      pageUrl: cluster.mappedPageUrl,
    });
  }

  const thinClusters = [...args.clusters]
    .filter(
      (cluster) =>
        cluster.promptCount > 0 &&
        cluster.promptCount < 3 &&
        cluster.conversationalPromptCount > 0,
    )
    .sort(sortClusters)
    .slice(0, 2);

  for (const cluster of thinClusters) {
    recommendations.push({
      id: null,
      type: "expansion",
      title: `Expand "${cluster.clusterName}" beyond a single phrasing`,
      rationale:
        "One or two prompts usually are not enough for GEO. Add comparison, recommendation, and context-rich variants so the cluster reflects how different buyers ask the same question.",
      status: "open",
      impactScore: cluster.priorityScore ?? 70,
      effortScore: 22,
      clusterId: cluster.clusterId,
      clusterName: cluster.clusterName,
      prompt: cluster.prompts[0]?.prompt ?? null,
      pageTitle: cluster.mappedPageTitle,
      pageUrl: cluster.mappedPageUrl,
    });
  }

  return recommendations.slice(0, 6);
}

async function loadSiteContext(db: Database, siteId: number): Promise<SiteContext> {
  const rows = await db
    .select({
      id: sites.id,
      name: sites.name,
      domain: sites.domain,
      businessType: sites.businessType,
    })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);

  const site = rows[0];
  if (!site) {
    throw new Error("Site not found.");
  }

  return site;
}

async function loadPromptInputs(db: Database, siteId: number, schemaReady: boolean) {
  const [clusterRows, queryRows, targetRows, pageRows, storedPromptRows] = await Promise.all([
    db
      .select({
        id: queryClusters.id,
        name: queryClusters.name,
        primaryIntent: queryClusters.primaryIntent,
        funnelStage: queryClusters.funnelStage,
        priorityScore: queryClusters.priorityScore,
      })
      .from(queryClusters)
      .where(eq(queryClusters.siteId, siteId)),
    db
      .select({
        clusterId: queries.clusterId,
        query: queries.query,
        isPrimary: queries.isPrimary,
      })
      .from(queries)
      .innerJoin(queryClusters, eq(queries.clusterId, queryClusters.id))
      .where(eq(queryClusters.siteId, siteId)),
    db
      .select({
        clusterId: pageClusterTargets.clusterId,
        pageId: pageClusterTargets.pageId,
      })
      .from(pageClusterTargets)
      .innerJoin(queryClusters, eq(pageClusterTargets.clusterId, queryClusters.id))
      .where(eq(queryClusters.siteId, siteId)),
    db
      .select({
        id: pages.id,
        url: pages.url,
        titleTag: pages.titleTag,
      })
      .from(pages)
      .where(eq(pages.siteId, siteId)),
    schemaReady
      ? db
          .select({
            id: geoPrompts.id,
            queryClusterId: geoPrompts.queryClusterId,
            prompt: geoPrompts.prompt,
            mappedPageId: geoPrompts.mappedPageId,
          })
          .from(geoPrompts)
          .where(eq(geoPrompts.siteId, siteId))
      : Promise.resolve([]),
  ]);

  return {
    clusterRows,
    queryRows,
    targetRows,
    pageRows,
    storedPromptRows,
  };
}

function buildClusterPromptGroups(args: {
  clusterRows: Array<{
    id: number;
    name: string;
    primaryIntent: string;
    funnelStage: string | null;
    priorityScore: string | null;
  }>;
  queryRows: Array<{ clusterId: number; query: string; isPrimary: boolean }>;
  targetRows: Array<{ clusterId: number; pageId: number }>;
  pageRows: Array<{ id: number; url: string; titleTag: string | null }>;
  storedPromptRows: Array<{
    id: number;
    queryClusterId: number;
    prompt: string;
    mappedPageId: number | null;
  }>;
}): ClusterPromptGroup[] {
  const pageById = new Map(args.pageRows.map((page) => [page.id, page]));
  const firstMappedPageByCluster = new Map<number, number>();
  const storedPromptsByCluster = new Map<
    number,
    Array<{ id: number; prompt: string; mappedPageId: number | null }>
  >();
  const querySeedsByCluster = new Map<number, Array<{ query: string; isPrimary: boolean }>>();

  for (const row of args.targetRows) {
    if (!firstMappedPageByCluster.has(row.clusterId)) {
      firstMappedPageByCluster.set(row.clusterId, row.pageId);
    }
  }

  for (const row of args.storedPromptRows) {
    const existing = storedPromptsByCluster.get(row.queryClusterId) ?? [];
    existing.push(row);
    storedPromptsByCluster.set(row.queryClusterId, existing);
  }

  for (const row of args.queryRows) {
    const existing = querySeedsByCluster.get(row.clusterId) ?? [];
    existing.push(row);
    querySeedsByCluster.set(row.clusterId, existing);
  }

  for (const rows of querySeedsByCluster.values()) {
    rows.sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return a.query.localeCompare(b.query);
    });
  }

  return args.clusterRows
    .map((cluster) => {
      const dedupedPrompts = new Map<string, PromptSeed>();
      const storedPrompts = storedPromptsByCluster.get(cluster.id) ?? [];
      const querySeeds = querySeedsByCluster.get(cluster.id) ?? [];

      for (const promptRow of storedPrompts) {
        const normalized = normalizePrompt(promptRow.prompt);
        if (!normalized) continue;

        dedupedPrompts.set(normalized, {
          id: promptRow.id,
          prompt: promptRow.prompt,
          source: "geo_prompt",
          isPrimaryQuerySeed: false,
          isConversational: isConversationalPrompt(promptRow.prompt),
        });
      }

      for (const querySeed of querySeeds) {
        const normalized = normalizePrompt(querySeed.query);
        if (!normalized || dedupedPrompts.has(normalized)) continue;

        dedupedPrompts.set(normalized, {
          id: null,
          prompt: querySeed.query,
          source: "query_seed",
          isPrimaryQuerySeed: querySeed.isPrimary,
          isConversational: isConversationalPrompt(querySeed.query),
        });
      }

      const prompts = [...dedupedPrompts.values()].sort(sortPrompts);
      const conversationalPromptCount = prompts.filter((prompt) => prompt.isConversational).length;
      const mappedPageId =
        firstMappedPageByCluster.get(cluster.id) ??
        storedPrompts.find((prompt) => prompt.mappedPageId)?.mappedPageId ??
        null;
      const mappedPage = mappedPageId ? pageById.get(mappedPageId) ?? null : null;

      return {
        clusterId: cluster.id,
        clusterName: cluster.name,
        intent: cluster.primaryIntent,
        funnelStage: cluster.funnelStage,
        priorityScore: parseNumeric(cluster.priorityScore),
        promptCount: prompts.length,
        conversationalPromptCount,
        mappedPageTitle: mappedPage ? derivePageTitle(mappedPage.url, mappedPage.titleTag) : null,
        mappedPageUrl: mappedPage?.url ?? null,
        prompts,
      };
    })
    .sort(sortClusters);
}

export async function getGeoOverview(db: Database, siteId: number): Promise<GeoOverview> {
  const site = await loadSiteContext(db, siteId);
  const schemaReady = await hasGeoSchema(db);
  const { clusterRows, queryRows, targetRows, pageRows, storedPromptRows } = await loadPromptInputs(
    db,
    siteId,
    schemaReady,
  );

  const clusters = buildClusterPromptGroups({
    clusterRows,
    queryRows,
    targetRows,
    pageRows,
    storedPromptRows,
  });

  const totalPrompts = clusters.reduce((sum, cluster) => sum + cluster.promptCount, 0);
  const coveredClusterCount = clusters.filter((cluster) => cluster.promptCount > 0).length;
  const mappedClusterCount = clusters.filter((cluster) => Boolean(cluster.mappedPageUrl)).length;
  const conversationalPromptCount = clusters.reduce(
    (sum, cluster) => sum + cluster.conversationalPromptCount,
    0,
  );
  const hasSavedPrompts = storedPromptRows.length > 0;
  const setup = buildSetupCopy({
    hasSchema: schemaReady,
    hasSavedPrompts,
    clusterCount: clusterRows.length,
    coveredClusterCount,
    totalPrompts,
    conversationalPromptCount,
  });
  const recommendations = buildHeuristicRecommendations({
    hasSchema: schemaReady,
    clusters,
  });

  return {
    site: {
      id: site.id,
      name: site.name,
      domain: site.domain,
      businessType: site.businessType,
      pageCount: pageRows.length,
      clusterCount: clusterRows.length,
    },
    setup,
    summary: {
      clusterCount: clusterRows.length,
      totalPrompts,
      clusterCoverage: clusterRows.length > 0 ? coveredClusterCount / clusterRows.length : 0,
      mappedClusterCount,
      conversationalPromptCount,
      activeRecommendations: recommendations.length,
    },
    clusters,
    recommendations,
  };
}
