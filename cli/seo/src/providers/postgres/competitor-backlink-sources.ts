export interface CompetitorBacklinkSourceRecord {
  id: string;
  sourceUrl: string;
}

export interface CompetitorBacklinkSpamScoreUpdate {
  id: string;
  spamScore: number;
}

export interface FetchCompetitorBacklinkSourceBatchOptions {
  afterId: string;
  limit: number;
  force: boolean;
}

export interface CompetitorBacklinkSourcesRepository {
  fetchBatch(options: FetchCompetitorBacklinkSourceBatchOptions): Promise<CompetitorBacklinkSourceRecord[]>;
  updateSpamScores(updates: CompetitorBacklinkSpamScoreUpdate[]): Promise<number>;
}

interface QueryResult<Row> {
  rows: Row[];
  rowCount: number | null;
}

interface Queryable {
  query<Row>(sql: string, params?: unknown[]): Promise<QueryResult<Row>>;
}

export class PgCompetitorBacklinkSourcesRepository implements CompetitorBacklinkSourcesRepository {
  constructor(private readonly db: Queryable) {}

  async fetchBatch(options: FetchCompetitorBacklinkSourceBatchOptions): Promise<CompetitorBacklinkSourceRecord[]> {
    const filter = options.force ? "" : "AND backlink_spam_score IS NULL";
    const result = await this.db.query<{ id: string; source_url: string }>(
      `
        SELECT
          id::text AS id,
          source_url
        FROM competitor_backlink_sources
        WHERE id > $1
          ${filter}
          AND source_url IS NOT NULL
        ORDER BY id ASC
        LIMIT $2
      `,
      [options.afterId, options.limit],
    );

    return result.rows.map((row) => ({
      id: row.id,
      sourceUrl: row.source_url,
    }));
  }

  async updateSpamScores(updates: CompetitorBacklinkSpamScoreUpdate[]): Promise<number> {
    if (updates.length === 0) {
      return 0;
    }

    const params: unknown[] = [];
    const tuples: string[] = [];

    for (const [index, update] of updates.entries()) {
      const idIndex = index * 2 + 1;
      const scoreIndex = idIndex + 1;
      params.push(update.id, update.spamScore);
      tuples.push(`($${idIndex}, $${scoreIndex})`);
    }

    const result = await this.db.query(
      `
        UPDATE competitor_backlink_sources AS c
        SET backlink_spam_score = v.spam_score
        FROM (VALUES ${tuples.join(", ")}) AS v(id_text, spam_score)
        WHERE c.id::text = v.id_text
      `,
      params,
    );

    return result.rowCount ?? 0;
  }
}
