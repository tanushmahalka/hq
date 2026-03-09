#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "scrapling[fetchers]>=0.4.1",
# ]
# ///
"""
Generate schema-shaped crawl payloads for `pages`, `crawl_runs`, and `crawl_page_facts`.

This script does not write to a database. It emits structured crawl artifacts so
an agent can review them and then save them into the SEO operational schema.

Examples:
    uv run skills/SEO/scripts/crawl_site_facts.py https://example.com
    uv run skills/SEO/scripts/crawl_site_facts.py https://example.com --output-dir skills/SEO/output/example
    uv run skills/SEO/scripts/crawl_site_facts.py https://example.com --skip-mobile-parity --insecure
"""

from __future__ import annotations

import argparse
import asyncio
import json
import uuid
from pathlib import Path
from typing import Any

from _crawl_common import CrawlCollection
from _crawl_common import CrawlConfig
from _crawl_common import PageResult
from _crawl_common import collect_site_pages
from _crawl_common import eprint
from _crawl_common import normalize_seed_url
from _crawl_common import positive_int
from _crawl_common import strip_fragment
from _crawl_common import url_uuid


def page_identity(record: PageResult) -> str:
    return record.final_url or record.requested_url


def choose_primary_page_record(records: list[PageResult]) -> PageResult:
    ranked = sorted(
        records,
        key=lambda record: (
            record.error is not None,
            record.requested_url != (record.final_url or record.requested_url),
            0 if record.status_code and 200 <= record.status_code < 300 else 1,
            record.requested_url,
        ),
    )
    return ranked[0]


def build_pages_payload(collection: CrawlCollection) -> list[dict[str, Any]]:
    grouped: dict[str, list[PageResult]] = {}
    for record in collection.records:
        grouped.setdefault(page_identity(record), []).append(record)

    payload: list[dict[str, Any]] = []
    for page_url in sorted(grouped):
        record = choose_primary_page_record(grouped[page_url])
        content_status = record.content_status
        if page_url == (record.final_url or record.requested_url) and record.status_code and 200 <= record.status_code < 300:
            content_status = "live"
        payload.append(
            {
                "id": url_uuid(collection.seed_host, page_url),
                "site_id": None,
                "url": page_url,
                "canonical_url": record.canonical_url,
                "page_type": record.page_type,
                "title_tag": record.title_tag,
                "meta_description": record.meta_description,
                "h1": record.h1,
                "status_code": record.status_code,
                "indexability": record.indexability,
                "canonical_target_url": record.canonical_target_url,
                "last_crawled_at": collection.finished_at,
                "last_published_at": record.last_published_at,
                "is_money_page": record.is_money_page,
                "is_authority_asset": record.is_authority_asset,
                "content_status": content_status,
                "created_at": collection.finished_at,
                "updated_at": collection.finished_at,
                "site_domain": collection.seed_host,
            }
        )
    return payload


def build_crawl_run_payload(collection: CrawlCollection, crawl_run_id: str) -> dict[str, Any]:
    source = "custom_bot_sitemap" if collection.used_sitemap else "custom_bot"
    status = "failed" if collection.records and all(record.error for record in collection.records) else "success"
    notes = (
        f"sitemap_candidates={collection.sitemap_candidates}; "
        f"fetched_sitemaps={collection.fetched_sitemaps}; "
        f"used_sitemap={str(collection.used_sitemap).lower()}; "
        f"used_crawl_fallback={str(collection.used_crawl_fallback).lower()}; "
        f"pages={len(collection.records)}"
    )
    return {
        "id": crawl_run_id,
        "site_id": None,
        "source": source,
        "started_at": collection.started_at,
        "finished_at": collection.finished_at,
        "status": status,
        "notes": notes,
        "site_domain": collection.seed_host,
    }


def build_crawl_page_facts_payload(
    collection: CrawlCollection,
    crawl_run_id: str,
    pages_payload: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    page_id_by_url = {page["url"]: page["id"] for page in pages_payload}
    inlink_count: dict[str, int] = {}
    for record in collection.records:
        for link in record.internal_links:
            normalized = strip_fragment(link)
            inlink_count[normalized] = inlink_count.get(normalized, 0) + 1

    payload: list[dict[str, Any]] = []
    for record in collection.records:
        target_url = page_identity(record)
        fact_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{crawl_run_id}|{record.requested_url}"))
        payload.append(
            {
                "id": fact_id,
                "crawl_run_id": crawl_run_id,
                "page_id": page_id_by_url.get(target_url),
                "url": record.requested_url,
                "final_url": record.final_url,
                "status_code": record.status_code,
                "content_type": record.content_type,
                "robots_indexable": record.robots_indexable,
                "robots_followable": record.robots_followable,
                "canonical_url": record.canonical_url,
                "canonical_status": record.canonical_status,
                "hreflang_status": record.hreflang_status,
                "depth": record.depth,
                "inlink_count": inlink_count.get(record.final_url or record.requested_url, 0),
                "outlink_count": record.outlink_count,
                "word_count": record.word_count,
                "has_schema": record.has_schema,
                "schema_types": record.schema_types,
                "mobile_parity_ok": record.mobile_parity_ok,
                "core_web_vitals_status": "unknown",
                "last_modified_header": record.last_modified_header,
                "created_at": collection.finished_at,
                "site_domain": collection.seed_host,
                "error": record.error,
            }
        )
    return payload


def render_json_lines(rows: list[dict[str, Any]]) -> str:
    return "\n".join(json.dumps(row, sort_keys=True) for row in rows)


def write_output_files(
    output_dir: Path,
    crawl_run: dict[str, Any],
    pages_payload: list[dict[str, Any]],
    facts_payload: list[dict[str, Any]],
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "crawl_run.json").write_text(json.dumps(crawl_run, indent=2, sort_keys=True), encoding="utf-8")
    (output_dir / "pages.jsonl").write_text(render_json_lines(pages_payload), encoding="utf-8")
    (output_dir / "crawl_page_facts.jsonl").write_text(
        render_json_lines(facts_payload),
        encoding="utf-8",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate schema-shaped crawl payloads for pages, crawl_runs, and crawl_page_facts."
    )
    parser.add_argument("url", type=normalize_seed_url, help="Seed URL or domain to crawl")
    parser.add_argument(
        "--sitemap",
        action="append",
        default=[],
        help="Explicit sitemap URL. Can be passed multiple times.",
    )
    parser.add_argument(
        "--include-subdomains",
        action="store_true",
        help="Include URLs on subdomains of the seed host.",
    )
    parser.add_argument(
        "--max-pages",
        type=positive_int,
        default=5000,
        help="Maximum number of pages to process.",
    )
    parser.add_argument(
        "--concurrency",
        type=positive_int,
        default=8,
        help="Maximum number of concurrent page fetches.",
    )
    parser.add_argument(
        "--timeout",
        type=positive_int,
        default=30,
        help="Per-request timeout in seconds.",
    )
    parser.add_argument(
        "--skip-mobile-parity",
        action="store_true",
        help="Skip the extra mobile fetch used to populate mobile_parity_ok.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="Write crawl_run.json, pages.jsonl, and crawl_page_facts.jsonl into a directory.",
    )
    parser.add_argument(
        "--insecure",
        action="store_true",
        help="Disable TLS certificate verification for environments with broken CA bundles.",
    )
    return parser


async def run(args: argparse.Namespace) -> int:
    collection = await collect_site_pages(
        CrawlConfig(
            seed_url=args.url,
            explicit_sitemaps=[normalize_seed_url(url) for url in args.sitemap],
            include_subdomains=args.include_subdomains,
            max_pages=args.max_pages,
            concurrency=args.concurrency,
            timeout=args.timeout,
            verify=not args.insecure,
            compare_mobile=not args.skip_mobile_parity,
        )
    )
    crawl_run_id = str(uuid.uuid4())
    pages_payload = build_pages_payload(collection)
    crawl_run = build_crawl_run_payload(collection, crawl_run_id)
    facts_payload = build_crawl_page_facts_payload(collection, crawl_run_id, pages_payload)

    if args.output_dir:
        write_output_files(args.output_dir, crawl_run, pages_payload, facts_payload)
    else:
        payload = {
            "site_domain": collection.seed_host,
            "crawl_run": crawl_run,
            "pages": pages_payload,
            "crawl_page_facts": facts_payload,
            "summary": {
                "pages_discovered": len(collection.records),
                "page_rows": len(pages_payload),
                "crawl_fact_rows": len(facts_payload),
                "used_sitemap": collection.used_sitemap,
                "used_crawl_fallback": collection.used_crawl_fallback,
            },
        }
        print(json.dumps(payload, indent=2, sort_keys=True))

    success_count = sum(1 for record in collection.records if not record.error)
    eprint(
        f"[info] Crawl rows: {len(collection.records)}, page rows: {len(pages_payload)}, "
        f"successful fetches: {success_count}"
    )
    if args.output_dir:
        eprint(f"[info] Wrote crawl artifacts to {args.output_dir}")
    if args.insecure:
        eprint("[info] TLS certificate verification was disabled with --insecure")
    return 0


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return asyncio.run(run(args))
    except KeyboardInterrupt:
        eprint("[error] Interrupted")
        return 130
    except RuntimeError as exc:
        eprint(f"[error] {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
