import { eq, sql, and, inArray } from "drizzle-orm";
import type { Database } from "../db/client.ts";
import {
  geoCitations,
  geoPromptResults,
  geoPrompts,
  geoRuns,
  pageClusterTargets,
  pages,
  queryClusters,
  queries,
  siteCompetitors,
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

/* ---------------------------------------------------------------------------
 * GEO Visibility (results-driven view for CEO dashboard)
 * --------------------------------------------------------------------------- */

export type GeoVisibilityProvider = {
  platform: string;
  mentionRate: number;
  citationRate: number;
  totalResults: number;
};

export type GeoVisibilityClusterProvider = {
  platform: string;
  mentioned: boolean;
  cited: boolean;
  competitors: Array<{ domain: string; label: string }>;
};

export type GeoVisibilityCluster = {
  clusterId: number;
  clusterName: string;
  intent: string | null;
  funnelStage: string | null;
  promptCount: number;
  providers: GeoVisibilityClusterProvider[];
  prompts: Array<{ id: number; prompt: string }>;
};

export type GeoVisibility = {
  hasResults: boolean;
  summary: {
    totalPromptsRun: number;
    brandMentionRate: number;
    brandCitationRate: number;
    providersWithMentions: number;
    totalProviders: number;
  };
  providers: GeoVisibilityProvider[];
  clusters: GeoVisibilityCluster[];
  platforms: string[];
};

export async function getGeoVisibility(db: Database, siteId: number): Promise<GeoVisibility> {
  const schemaReady = await hasGeoSchema(db);

  if (!schemaReady) {
    return {
      hasResults: false,
      summary: {
        totalPromptsRun: 0,
        brandMentionRate: 0,
        brandCitationRate: 0,
        providersWithMentions: 0,
        totalProviders: 0,
      },
      providers: [],
      clusters: [],
      platforms: [],
    };
  }

  // Fetch all results joined with runs (for platform) and prompts (for clusterId)
  const resultRows = await db
    .select({
      resultId: geoPromptResults.id,
      brandMentioned: geoPromptResults.brandMentioned,
      brandCited: geoPromptResults.brandCited,
      promptId: geoPromptResults.promptId,
      platform: geoRuns.platform,
      clusterId: geoPrompts.queryClusterId,
    })
    .from(geoPromptResults)
    .innerJoin(geoRuns, eq(geoPromptResults.runId, geoRuns.id))
    .innerJoin(geoPrompts, eq(geoPromptResults.promptId, geoPrompts.id))
    .where(eq(geoPromptResults.siteId, siteId));

  if (resultRows.length === 0) {
    return {
      hasResults: false,
      summary: {
        totalPromptsRun: 0,
        brandMentionRate: 0,
        brandCitationRate: 0,
        providersWithMentions: 0,
        totalProviders: 0,
      },
      providers: [],
      clusters: [],
      platforms: [],
    };
  }

  // Fetch competitor citations for these results
  const resultIds = resultRows.map((r) => r.resultId);
  const citationRows = await db
    .select({
      resultId: geoCitations.resultId,
      domain: geoCitations.domain,
      isCompetitor: geoCitations.isCompetitor,
      siteCompetitorId: geoCitations.siteCompetitorId,
    })
    .from(geoCitations)
    .where(and(eq(geoCitations.siteId, siteId), eq(geoCitations.isCompetitor, true)));

  // Fetch competitor labels
  const competitorRows = await db
    .select({
      id: siteCompetitors.id,
      domain: siteCompetitors.competitorDomain,
      label: siteCompetitors.label,
    })
    .from(siteCompetitors)
    .where(eq(siteCompetitors.siteId, siteId));

  const competitorById = new Map(competitorRows.map((c) => [c.id, c]));

  // Fetch cluster metadata
  const clusterIds = [...new Set(resultRows.map((r) => r.clusterId))];
  const clusterMetaRows =
    clusterIds.length > 0
      ? await db
          .select({
            id: queryClusters.id,
            name: queryClusters.name,
            primaryIntent: queryClusters.primaryIntent,
            funnelStage: queryClusters.funnelStage,
          })
          .from(queryClusters)
          .where(inArray(queryClusters.id, clusterIds))
      : [];

  const clusterMeta = new Map(clusterMetaRows.map((c) => [c.id, c]));

  // Fetch prompts per cluster
  const promptRows = await db
    .select({
      id: geoPrompts.id,
      prompt: geoPrompts.prompt,
      clusterId: geoPrompts.queryClusterId,
    })
    .from(geoPrompts)
    .where(eq(geoPrompts.siteId, siteId));

  const promptsByCluster = new Map<number, Array<{ id: number; prompt: string }>>();
  for (const p of promptRows) {
    const arr = promptsByCluster.get(p.clusterId) ?? [];
    arr.push({ id: p.id, prompt: p.prompt });
    promptsByCluster.set(p.clusterId, arr);
  }

  // Build competitor citations index: resultId → Set of competitor domains
  const competitorsByResult = new Map<number, Set<string>>();
  for (const cit of citationRows) {
    const set = competitorsByResult.get(cit.resultId) ?? new Set();
    set.add(cit.domain);
    competitorsByResult.set(cit.resultId, set);
  }

  // --- Aggregate summary ---
  const platforms = [...new Set(resultRows.map((r) => r.platform))].sort();
  const totalResults = resultRows.length;
  const mentionedCount = resultRows.filter((r) => r.brandMentioned).length;
  const citedCount = resultRows.filter((r) => r.brandCited).length;

  // Per-provider stats
  const providerMap = new Map<string, { mentioned: number; cited: number; total: number }>();
  for (const r of resultRows) {
    const stats = providerMap.get(r.platform) ?? { mentioned: 0, cited: 0, total: 0 };
    stats.total++;
    if (r.brandMentioned) stats.mentioned++;
    if (r.brandCited) stats.cited++;
    providerMap.set(r.platform, stats);
  }

  const providers: GeoVisibilityProvider[] = [...providerMap.entries()]
    .map(([platform, stats]) => ({
      platform,
      mentionRate: stats.total > 0 ? stats.mentioned / stats.total : 0,
      citationRate: stats.total > 0 ? stats.cited / stats.total : 0,
      totalResults: stats.total,
    }))
    .sort((a, b) => b.mentionRate - a.mentionRate);

  const providersWithMentions = providers.filter((p) => p.mentionRate > 0).length;

  // --- Cluster × Provider matrix ---
  type CellKey = `${number}:${string}`;
  const clusterProviderCells = new Map<
    CellKey,
    { mentioned: boolean; cited: boolean; competitorDomains: Set<string>; resultIds: number[] }
  >();

  for (const r of resultRows) {
    const key: CellKey = `${r.clusterId}:${r.platform}`;
    const cell = clusterProviderCells.get(key) ?? {
      mentioned: false,
      cited: false,
      competitorDomains: new Set(),
      resultIds: [],
    };
    if (r.brandMentioned) cell.mentioned = true;
    if (r.brandCited) cell.cited = true;
    cell.resultIds.push(r.resultId);
    // Merge competitor domains from citations
    const compDomains = competitorsByResult.get(r.resultId);
    if (compDomains) {
      for (const d of compDomains) cell.competitorDomains.add(d);
    }
    clusterProviderCells.set(key, cell);
  }

  // Build cluster rows
  const clusterIdSet = new Set(resultRows.map((r) => r.clusterId));
  const clusters: GeoVisibilityCluster[] = [...clusterIdSet]
    .map((clusterId) => {
      const meta = clusterMeta.get(clusterId);
      const clusterProviders: GeoVisibilityClusterProvider[] = platforms.map((platform) => {
        const key: CellKey = `${clusterId}:${platform}`;
        const cell = clusterProviderCells.get(key);
        const competitors: Array<{ domain: string; label: string }> = [];
        if (cell) {
          for (const domain of cell.competitorDomains) {
            const comp = competitorRows.find((c) => c.domain === domain);
            competitors.push({ domain, label: comp?.label ?? domain });
          }
        }
        return {
          platform,
          mentioned: cell?.mentioned ?? false,
          cited: cell?.cited ?? false,
          competitors,
        };
      });

      return {
        clusterId,
        clusterName: meta?.name ?? `Cluster ${clusterId}`,
        intent: meta?.primaryIntent ?? null,
        funnelStage: meta?.funnelStage ?? null,
        promptCount: promptsByCluster.get(clusterId)?.length ?? 0,
        providers: clusterProviders,
        prompts: promptsByCluster.get(clusterId) ?? [],
      };
    })
    .sort((a, b) => {
      // Sort by how many providers mention them (desc)
      const aMentions = a.providers.filter((p) => p.mentioned).length;
      const bMentions = b.providers.filter((p) => p.mentioned).length;
      return bMentions - aMentions || a.clusterName.localeCompare(b.clusterName);
    });

  return {
    hasResults: true,
    summary: {
      totalPromptsRun: totalResults,
      brandMentionRate: totalResults > 0 ? mentionedCount / totalResults : 0,
      brandCitationRate: totalResults > 0 ? citedCount / totalResults : 0,
      providersWithMentions,
      totalProviders: platforms.length,
    },
    providers,
    clusters,
    platforms,
  };
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
