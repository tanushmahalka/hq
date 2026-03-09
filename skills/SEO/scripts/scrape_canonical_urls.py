#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "scrapling[fetchers]>=0.4.1",
# ]
# ///
"""
Collect canonical URLs for a site.

This script uses shared sitemap-first crawl logic from `_crawl_common.py` and
returns either a deduplicated canonical list or a page-to-canonical mapping.

Examples:
    uv run skills/SEO/scripts/scrape_canonical_urls.py https://example.com
    uv run skills/SEO/scripts/scrape_canonical_urls.py https://example.com --page-map --format csv --output canonicals.csv
    uv run skills/SEO/scripts/scrape_canonical_urls.py https://example.com --sitemap https://example.com/sitemap_index.xml
    uv run skills/SEO/scripts/scrape_canonical_urls.py https://example.com --insecure
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
from pathlib import Path

from _crawl_common import CrawlConfig
from _crawl_common import PageResult
from _crawl_common import collect_site_pages
from _crawl_common import eprint
from _crawl_common import normalize_seed_url
from _crawl_common import positive_int


def write_text(path: Path | None, content: str) -> None:
    if path:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return
    print(content)


def render_page_map_text(records: list[PageResult]) -> str:
    lines = ["requested_url\tstatus_code\tcanonical_url\tfinal_url\tdiscovery_method\terror"]
    for record in records:
        lines.append(
            "\t".join(
                [
                    record.requested_url,
                    "" if record.status_code is None else str(record.status_code),
                    record.canonical_url or "",
                    record.final_url or "",
                    record.discovery_method,
                    record.error or "",
                ]
            )
        )
    return "\n".join(lines)


def render_output(records: list[PageResult], output_format: str, page_map: bool) -> str:
    if page_map:
        payload = [
            {
                "requested_url": record.requested_url,
                "final_url": record.final_url,
                "canonical_url": record.canonical_url,
                "status_code": record.status_code,
                "discovery_method": record.discovery_method,
                "error": record.error,
            }
            for record in records
        ]
        if output_format == "json":
            return json.dumps(payload, indent=2, sort_keys=True)
        if output_format == "csv":
            from io import StringIO

            buffer = StringIO()
            writer = csv.DictWriter(
                buffer,
                fieldnames=[
                    "requested_url",
                    "final_url",
                    "canonical_url",
                    "status_code",
                    "discovery_method",
                    "error",
                ],
            )
            writer.writeheader()
            writer.writerows(payload)
            return buffer.getvalue().rstrip("\n")
        return render_page_map_text(records)

    canonical_urls = sorted({record.canonical_url for record in records if record.canonical_url})
    if output_format == "json":
        return json.dumps(canonical_urls, indent=2)
    if output_format == "csv":
        from io import StringIO

        buffer = StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["canonical_url"])
        for canonical_url in canonical_urls:
            writer.writerow([canonical_url])
        return buffer.getvalue().rstrip("\n")
    return "\n".join(canonical_urls)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Scrape canonical URLs for a site with sitemap-first discovery."
    )
    parser.add_argument("url", type=normalize_seed_url, help="Seed URL or domain to inventory")
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
        help="Maximum number of pages to process when crawling or truncating sitemap pages.",
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
        "--format",
        choices=["text", "json", "csv"],
        default="text",
        help="Output format. Default is text.",
    )
    parser.add_argument(
        "--page-map",
        action="store_true",
        help="Output page-to-canonical mappings instead of a deduplicated canonical list.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Write output to a file instead of stdout.",
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
            compare_mobile=False,
        )
    )
    output = render_output(collection.records, output_format=args.format, page_map=args.page_map)
    write_text(args.output, output)

    success_count = sum(1 for record in collection.records if not record.error)
    canonical_count = len({record.canonical_url for record in collection.records if record.canonical_url})
    eprint(
        f"[info] Processed {len(collection.records)} page(s), successful fetches: "
        f"{success_count}, unique canonicals: {canonical_count}"
    )
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
