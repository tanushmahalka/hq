# DataForSEO Reference

## Provider Docs
- LLM reference: https://docs.dataforseo.com/v3/llms.txt/
- Instant page audit: https://docs.dataforseo.com/v3/on_page/instant_pages/
- Backlinks bulk ranks: https://docs.dataforseo.com/v3/backlinks-bulk_ranks-live/
- Backlinks bulk spam score: https://docs.dataforseo.com/v3/backlinks-bulk_spam_score-live/
- AI Optimization overview: https://docs.dataforseo.com/v3/ai_optimization/overview/
- LLM mentions overview: https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/overview/
- AI keyword data overview: https://docs.dataforseo.com/v3/ai_optimization/ai_keyword_data/overview/
- LLM responses overview: https://docs.dataforseo.com/v3/ai_optimization/llm_responses/overview/

## Notes
- Use `on_page/instant_pages` as the core page audit endpoint.
- Use `backlinks/bulk_ranks/live` for domain rating lookups. DataForSEO expects domains without `https://` and `www.`.
- Use `backlinks/bulk_spam_score/live` for domain spam score lookups. Both bulk backlinks endpoints accept up to 1000 targets per request.
- The `sync-db` workflow in this CLI reads backlink rows from Postgres in batches, derives domains from `source_url`, and updates `backlink_spam_score` without loading the whole dataset into memory.
- GEO workflows in this CLI are built from AI keyword volume, LLM mentions, and LLM responses endpoints.
