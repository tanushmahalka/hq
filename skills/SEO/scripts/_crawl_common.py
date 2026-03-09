from __future__ import annotations

import argparse
import asyncio
import gzip
import html
import json
import re
import sys
import uuid
import xml.etree.ElementTree as ET
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.parse import urldefrag, urljoin, urlparse


FETCHER_CLASS: Any | None = None

DESKTOP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    )
}

MOBILE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) "
        "Version/17.0 Mobile/15E148 Safari/604.1"
    )
}


@dataclass(slots=True)
class CrawlConfig:
    seed_url: str
    explicit_sitemaps: list[str]
    include_subdomains: bool
    max_pages: int
    concurrency: int
    timeout: int
    verify: bool
    compare_mobile: bool = False


@dataclass(slots=True)
class DiscoveredUrl:
    url: str
    discovery_method: str
    depth: int


@dataclass(slots=True)
class PageResult:
    requested_url: str
    final_url: str | None
    canonical_url: str | None
    status_code: int | None
    discovery_method: str
    depth: int
    content_type: str | None
    title_tag: str | None
    meta_description: str | None
    h1: str | None
    robots_indexable: bool | None
    robots_followable: bool | None
    indexability: str
    canonical_status: str
    hreflang_status: str
    schema_types: list[str]
    has_schema: bool
    word_count: int
    outlink_count: int
    internal_links: list[str]
    last_modified_header: str | None
    last_published_at: str | None
    mobile_parity_ok: bool | None
    page_type: str
    is_money_page: bool
    is_authority_asset: bool
    content_status: str
    canonical_target_url: str | None
    error: str | None = None


@dataclass(slots=True)
class CrawlCollection:
    records: list[PageResult]
    started_at: str
    finished_at: str
    seed_host: str
    sitemap_candidates: int
    fetched_sitemaps: int
    used_sitemap: bool
    used_crawl_fallback: bool


def eprint(message: str) -> None:
    print(message, file=sys.stderr)


def iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_fetcher() -> Any:
    global FETCHER_CLASS
    if FETCHER_CLASS is None:
        try:
            from scrapling import AsyncFetcher
        except ImportError as exc:
            raise RuntimeError(
                "Scrapling fetchers are unavailable. Run this script with `uv run` so "
                "`scrapling[fetchers]` is installed from the script metadata."
            ) from exc
        FETCHER_CLASS = AsyncFetcher
    return FETCHER_CLASS


def normalize_seed_url(value: str) -> str:
    candidate = value.strip()
    if not candidate:
        raise argparse.ArgumentTypeError("seed URL cannot be empty")
    if "://" not in candidate:
        candidate = f"https://{candidate}"
    parsed = urlparse(candidate)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise argparse.ArgumentTypeError(f"invalid URL: {value}")
    return strip_fragment(candidate)


def positive_int(value: str) -> int:
    try:
        parsed = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("must be an integer") from exc
    if parsed < 1:
        raise argparse.ArgumentTypeError("must be >= 1")
    return parsed


def strip_fragment(value: str) -> str:
    clean, _ = urldefrag(value)
    return clean


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def is_http_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def is_same_scope(url: str, seed_host: str, include_subdomains: bool) -> bool:
    host = (urlparse(url).hostname or "").lower()
    if not host:
        return False
    if host == seed_host:
        return True
    return include_subdomains and host.endswith(f".{seed_host}")


def normalize_candidate_url(
    raw_url: str,
    base_url: str,
    seed_host: str,
    include_subdomains: bool,
) -> str | None:
    candidate = strip_fragment(urljoin(base_url, raw_url.strip()))
    if not is_http_url(candidate):
        return None
    if not is_same_scope(candidate, seed_host, include_subdomains):
        return None
    return candidate


def decode_body(body: bytes) -> bytes:
    if body[:2] == b"\x1f\x8b":
        try:
            return gzip.decompress(body)
        except OSError:
            return body
    return body


def header_value(headers: dict[str, Any], name: str) -> str | None:
    target = name.lower()
    for key, value in headers.items():
        if key.lower() == target:
            return str(value)
    return None


def collapse_whitespace(value: str | None) -> str | None:
    if value is None:
        return None
    collapsed = re.sub(r"\s+", " ", value).strip()
    return collapsed or None


def parse_datetime_string(raw: str | None) -> str | None:
    if not raw:
        return None
    value = raw.strip()
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        try:
            parsed = parsedate_to_datetime(value)
        except (TypeError, ValueError):
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).replace(microsecond=0).isoformat()


def url_uuid(namespace: str, value: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"{namespace}|{value}"))


async def fetch(
    url: str,
    timeout: int,
    verify: bool,
    headers: dict[str, str] | None = None,
) -> tuple[Any | None, str | None]:
    fetcher = load_fetcher()
    try:
        response = await fetcher.get(url, timeout=timeout, verify=verify, headers=headers or DESKTOP_HEADERS)
    except Exception as exc:  # pragma: no cover
        return None, str(exc)
    return response, None


async def discover_sitemaps(
    seed_url: str,
    explicit_sitemaps: list[str],
    timeout: int,
    verify: bool,
) -> list[str]:
    discovered: list[str] = []
    seen: set[str] = set()

    def add(candidate: str) -> None:
        normalized = strip_fragment(candidate)
        if normalized and normalized not in seen:
            seen.add(normalized)
            discovered.append(normalized)

    for sitemap in explicit_sitemaps:
        add(sitemap)

    robots_url = urljoin(seed_url, "/robots.txt")
    robots_response, robots_error = await fetch(robots_url, timeout=timeout, verify=verify)
    if robots_error:
        eprint(f"[warn] Failed to fetch robots.txt: {robots_error}")
    elif robots_response and (robots_response.status or 0) < 400:
        body = decode_body(robots_response.body).decode("utf-8", errors="replace")
        for line in body.splitlines():
            if ":" not in line:
                continue
            key, value = line.split(":", 1)
            if key.strip().lower() == "sitemap":
                sitemap_url = urljoin(robots_response.url, value.strip())
                if is_http_url(sitemap_url):
                    add(sitemap_url)

    add(urljoin(seed_url, "/sitemap.xml"))
    return discovered


async def expand_sitemaps(
    sitemap_urls: list[str],
    seed_host: str,
    include_subdomains: bool,
    timeout: int,
    verify: bool,
) -> tuple[list[str], int]:
    queue = deque(sitemap_urls)
    seen_sitemaps: set[str] = set()
    page_urls: set[str] = set()
    fetched_count = 0

    while queue:
        sitemap_url = queue.popleft()
        if sitemap_url in seen_sitemaps:
            continue
        seen_sitemaps.add(sitemap_url)
        response, error = await fetch(sitemap_url, timeout=timeout, verify=verify)
        if error:
            eprint(f"[warn] Failed sitemap fetch {sitemap_url}: {error}")
            continue
        if not response or (response.status or 0) >= 400:
            status = response.status if response else "n/a"
            eprint(f"[warn] Skipping sitemap {sitemap_url}: HTTP {status}")
            continue

        fetched_count += 1
        body = decode_body(response.body)
        try:
            root = ET.fromstring(body)
        except ET.ParseError as exc:
            eprint(f"[warn] Invalid XML in sitemap {sitemap_url}: {exc}")
            continue

        root_name = local_name(root.tag)
        loc_values = [
            (element.text or "").strip()
            for element in root.iter()
            if local_name(element.tag) == "loc" and (element.text or "").strip()
        ]

        if root_name == "sitemapindex":
            for loc in loc_values:
                next_sitemap = strip_fragment(loc)
                if is_http_url(next_sitemap) and next_sitemap not in seen_sitemaps:
                    queue.append(next_sitemap)
            continue

        if root_name != "urlset":
            eprint(f"[warn] Unsupported sitemap root `{root_name}` at {sitemap_url}")
            continue

        for loc in loc_values:
            page_url = strip_fragment(loc)
            if is_http_url(page_url) and is_same_scope(page_url, seed_host, include_subdomains):
                page_urls.add(page_url)

    return sorted(page_urls), fetched_count


def extract_first(response: Any, xpath_selector: str) -> str | None:
    return collapse_whitespace(response.xpath(xpath_selector).get())


def extract_first_attr(response: Any, xpath_selector: str) -> str | None:
    return collapse_whitespace(response.xpath(xpath_selector).get())


def extract_canonical(response: Any) -> str | None:
    raw = response.xpath(
        "//link[contains(concat(' ', normalize-space(translate(@rel, "
        "'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')), ' '), "
        "' canonical ')]/@href"
    ).get()
    if not raw:
        return None
    normalized = strip_fragment(response.urljoin(raw.strip()))
    return normalized if is_http_url(normalized) else None


def extract_internal_links(response: Any, seed_host: str, include_subdomains: bool) -> list[str]:
    links: set[str] = set()
    current_url = strip_fragment(response.url)
    for raw_link in response.css("a::attr(href)").getall():
        normalized = normalize_candidate_url(
            raw_link,
            base_url=response.url,
            seed_host=seed_host,
            include_subdomains=include_subdomains,
        )
        if normalized and normalized != current_url:
            links.add(normalized)
    return sorted(links)


def parse_robot_tokens(raw_values: list[str]) -> tuple[bool | None, bool | None]:
    tokens: set[str] = set()
    for raw_value in raw_values:
        for token in raw_value.lower().split(","):
            cleaned = token.strip()
            if cleaned:
                tokens.add(cleaned)
    if not tokens:
        return True, True
    if "none" in tokens:
        return False, False
    indexable = False if "noindex" in tokens else True
    followable = False if "nofollow" in tokens else True
    return indexable, followable


def extract_robots_directives(response: Any) -> tuple[bool | None, bool | None]:
    meta_values = response.xpath(
        "//meta[translate(@name, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')='robots']/@content"
    ).getall()
    header = header_value(response.headers, "x-robots-tag")
    raw_values = [value for value in meta_values if value]
    if header:
        raw_values.append(header)
    return parse_robot_tokens(raw_values)


def extract_hreflang_status(response: Any) -> str:
    values = [
        value.strip()
        for value in response.xpath(
            "//link[contains(concat(' ', normalize-space(translate(@rel, "
            "'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')), ' '), "
            "' alternate ')]/@hreflang"
        ).getall()
        if value and value.strip()
    ]
    if not values:
        return "missing"
    if values == ["x-default"]:
        return "x-default-only"
    return "present"


def normalize_schema_type(raw_value: str) -> str:
    value = raw_value.strip()
    value = value.replace("https://schema.org/", "")
    value = value.replace("http://schema.org/", "")
    return value


def walk_schema_types(node: Any, collected: set[str]) -> None:
    if isinstance(node, dict):
        raw_type = node.get("@type")
        if isinstance(raw_type, str):
            collected.add(normalize_schema_type(raw_type))
        elif isinstance(raw_type, list):
            for item in raw_type:
                if isinstance(item, str):
                    collected.add(normalize_schema_type(item))
        for value in node.values():
            walk_schema_types(value, collected)
        return
    if isinstance(node, list):
        for item in node:
            walk_schema_types(item, collected)


def extract_schema_types(response: Any) -> list[str]:
    types: set[str] = set()
    for raw_json in response.xpath(
        "//script[translate(@type, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')='application/ld+json']/text()"
    ).getall():
        try:
            payload = json.loads(raw_json)
        except json.JSONDecodeError:
            continue
        walk_schema_types(payload, types)
    for raw_itemtype in response.xpath("//*[@itemtype]/@itemtype").getall():
        for chunk in raw_itemtype.split():
            normalized = normalize_schema_type(chunk)
            if normalized:
                types.add(normalized)
    return sorted(types)


def decode_html(response: Any) -> str:
    body = decode_body(response.body)
    encoding = getattr(response, "encoding", None) or "utf-8"
    try:
        return body.decode(encoding, errors="replace")
    except LookupError:
        return body.decode("utf-8", errors="replace")


def extract_word_count(response: Any) -> int:
    raw_html = decode_html(response)
    without_scripts = re.sub(r"(?is)<script.*?>.*?</script>", " ", raw_html)
    without_styles = re.sub(r"(?is)<style.*?>.*?</style>", " ", without_scripts)
    text = re.sub(r"(?s)<[^>]+>", " ", without_styles)
    plain = html.unescape(text)
    return len(re.findall(r"\b[\w'-]+\b", plain))


def classify_canonical_status(
    requested_url: str,
    final_url: str | None,
    canonical_url: str | None,
) -> str:
    if not canonical_url:
        return "missing"
    target = final_url or requested_url
    if canonical_url == target:
        return "self"
    requested_host = (urlparse(requested_url).hostname or "").lower()
    canonical_host = (urlparse(canonical_url).hostname or "").lower()
    target_host = (urlparse(target).hostname or "").lower()
    if canonical_host and target_host and canonical_host != target_host:
        return "conflicting"
    if canonical_url == requested_url and requested_url != target:
        return "conflicting"
    return "points_elsewhere"


def classify_indexability(status_code: int | None, robots_indexable: bool | None, canonical_status: str) -> str:
    if status_code is None or status_code >= 400:
        return "error"
    if robots_indexable is False:
        return "noindex"
    if canonical_status == "points_elsewhere":
        return "duplicate"
    return "indexable"


def classify_content_status(status_code: int | None, requested_url: str, final_url: str | None) -> str:
    if final_url and requested_url != final_url:
        return "redirected"
    if status_code in {404, 410}:
        return "deleted"
    if status_code and 200 <= status_code < 300:
        return "live"
    return "archived"


def classify_page_type(url: str, title_tag: str | None, h1: str | None) -> str:
    parsed = urlparse(url)
    path = parsed.path.lower()
    keywords = f"{path} {(title_tag or '').lower()} {(h1 or '').lower()}"
    if path in {"", "/"}:
        return "homepage"
    if any(token in path for token in ("/locations/", "/location/", "/areas/", "near-me")):
        return "local_landing"
    if any(token in path for token in ("/tool", "/tools", "/template", "/templates", "/calculator")):
        return "tool"
    if any(token in path for token in ("/product", "/products", "/shop/", "/store/")):
        return "product"
    if any(token in path for token in ("/category", "/categories", "/collection", "/collections")):
        return "category"
    if any(token in path for token in ("/service", "/services", "/solution", "/solutions")):
        return "service"
    if any(token in path for token in ("/blog", "/blogs", "/news", "/article", "/articles", "/resources", "/guides", "/insights")):
        return "article"
    if keywords.count("-") >= 4:
        return "article"
    return "other"


def classify_money_page(page_type: str, url: str, title_tag: str | None, h1: str | None) -> bool:
    keywords = f"{url.lower()} {(title_tag or '').lower()} {(h1 or '').lower()}"
    if page_type in {"service", "category", "product"}:
        return True
    money_terms = (
        "pricing",
        "contact",
        "demo",
        "quote",
        "buy",
        "shop",
        "service",
        "solution",
        "product",
        "book",
        "consult",
    )
    return any(term in keywords for term in money_terms)


def classify_authority_asset(page_type: str, url: str, title_tag: str | None, h1: str | None) -> bool:
    keywords = f"{url.lower()} {(title_tag or '').lower()} {(h1 or '').lower()}"
    if page_type in {"article", "tool"}:
        return True
    authority_terms = (
        "report",
        "study",
        "research",
        "template",
        "glossary",
        "guide",
        "case study",
    )
    return any(term in keywords for term in authority_terms)


def extract_last_published_at(response: Any) -> str | None:
    candidates = [
        extract_first_attr(
            response,
            "//meta[@property='article:published_time']/@content",
        ),
        extract_first_attr(
            response,
            "//meta[@name='article:published_time']/@content",
        ),
        extract_first_attr(
            response,
            "//meta[@property='og:updated_time']/@content",
        ),
        extract_first_attr(
            response,
            "//time[@datetime]/@datetime",
        ),
    ]
    for candidate in candidates:
        normalized = parse_datetime_string(candidate)
        if normalized:
            return normalized
    return None


def compare_mobile_parity(desktop: PageResult, mobile: PageResult) -> bool | None:
    if mobile.error or desktop.error:
        return None
    comparable = (
        desktop.status_code == mobile.status_code,
        desktop.title_tag == mobile.title_tag,
        desktop.meta_description == mobile.meta_description,
        desktop.h1 == mobile.h1,
        desktop.canonical_url == mobile.canonical_url,
        desktop.robots_indexable == mobile.robots_indexable,
    )
    return all(comparable)


async def extract_page_result(
    discovered: DiscoveredUrl,
    config: CrawlConfig,
    seed_host: str,
    headers: dict[str, str] | None = None,
) -> PageResult:
    response, error = await fetch(
        discovered.url,
        timeout=config.timeout,
        verify=config.verify,
        headers=headers,
    )
    if error:
        return PageResult(
            requested_url=discovered.url,
            final_url=None,
            canonical_url=None,
            status_code=None,
            discovery_method=discovered.discovery_method,
            depth=discovered.depth,
            content_type=None,
            title_tag=None,
            meta_description=None,
            h1=None,
            robots_indexable=None,
            robots_followable=None,
            indexability="error",
            canonical_status="missing",
            hreflang_status="missing",
            schema_types=[],
            has_schema=False,
            word_count=0,
            outlink_count=0,
            internal_links=[],
            last_modified_header=None,
            last_published_at=None,
            mobile_parity_ok=None,
            page_type="other",
            is_money_page=False,
            is_authority_asset=False,
            content_status="archived",
            canonical_target_url=None,
            error=error,
        )

    final_url = strip_fragment(response.url)
    canonical_url = extract_canonical(response)
    status_code = int(response.status) if response.status is not None else None
    title_tag = extract_first(response, "//title/text()")
    meta_description = extract_first_attr(
        response,
        "//meta[translate(@name, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')='description']/@content",
    )
    h1 = extract_first(response, "(//h1//text())[1]")
    robots_indexable, robots_followable = extract_robots_directives(response)
    canonical_status = classify_canonical_status(discovered.url, final_url, canonical_url)
    indexability = classify_indexability(status_code, robots_indexable, canonical_status)
    hreflang_status = extract_hreflang_status(response)
    schema_types = extract_schema_types(response)
    content_type = header_value(response.headers, "content-type")
    last_modified_header = parse_datetime_string(header_value(response.headers, "last-modified"))
    last_published_at = extract_last_published_at(response)
    internal_links = []
    if status_code and 200 <= status_code < 400:
        internal_links = extract_internal_links(response, seed_host, config.include_subdomains)
    word_count = extract_word_count(response) if status_code and 200 <= status_code < 400 else 0
    page_url = final_url or discovered.url
    page_type = classify_page_type(page_url, title_tag, h1)
    is_money_page = classify_money_page(page_type, page_url, title_tag, h1)
    is_authority_asset = classify_authority_asset(page_type, page_url, title_tag, h1)
    content_status = classify_content_status(status_code, discovered.url, final_url)
    canonical_target_url = canonical_url if canonical_status in {"points_elsewhere", "conflicting"} else None

    return PageResult(
        requested_url=discovered.url,
        final_url=final_url,
        canonical_url=canonical_url,
        status_code=status_code,
        discovery_method=discovered.discovery_method,
        depth=discovered.depth,
        content_type=content_type,
        title_tag=title_tag,
        meta_description=meta_description,
        h1=h1,
        robots_indexable=robots_indexable,
        robots_followable=robots_followable,
        indexability=indexability,
        canonical_status=canonical_status,
        hreflang_status=hreflang_status,
        schema_types=schema_types,
        has_schema=bool(schema_types),
        word_count=word_count,
        outlink_count=len(internal_links),
        internal_links=internal_links,
        last_modified_header=last_modified_header,
        last_published_at=last_published_at,
        mobile_parity_ok=None,
        page_type=page_type,
        is_money_page=is_money_page,
        is_authority_asset=is_authority_asset,
        content_status=content_status,
        canonical_target_url=canonical_target_url,
        error=None,
    )


async def fetch_pages_from_sitemap(
    discovered_urls: list[DiscoveredUrl],
    config: CrawlConfig,
    seed_host: str,
) -> list[PageResult]:
    semaphore = asyncio.Semaphore(config.concurrency)
    records: list[PageResult] = []

    async def worker(discovered: DiscoveredUrl) -> None:
        async with semaphore:
            desktop = await extract_page_result(discovered, config, seed_host, headers=DESKTOP_HEADERS)
            if config.compare_mobile and not desktop.error:
                mobile = await extract_page_result(discovered, config, seed_host, headers=MOBILE_HEADERS)
                desktop.mobile_parity_ok = compare_mobile_parity(desktop, mobile)
            records.append(desktop)

    await asyncio.gather(*(worker(discovered) for discovered in discovered_urls))
    return sorted(records, key=lambda record: record.requested_url)


async def crawl_without_sitemap(config: CrawlConfig, seed_host: str) -> list[PageResult]:
    queue: asyncio.Queue[DiscoveredUrl | None] = asyncio.Queue()
    await queue.put(DiscoveredUrl(url=config.seed_url, discovery_method="crawl", depth=0))

    seen: set[str] = {config.seed_url}
    records: list[PageResult] = []
    seen_lock = asyncio.Lock()

    async def worker() -> None:
        while True:
            current = await queue.get()
            if current is None:
                queue.task_done()
                return

            desktop = await extract_page_result(current, config, seed_host, headers=DESKTOP_HEADERS)
            if config.compare_mobile and not desktop.error:
                mobile = await extract_page_result(current, config, seed_host, headers=MOBILE_HEADERS)
                desktop.mobile_parity_ok = compare_mobile_parity(desktop, mobile)
            records.append(desktop)

            final_url = desktop.final_url
            if final_url:
                async with seen_lock:
                    seen.add(final_url)

            if desktop.internal_links:
                async with seen_lock:
                    for link in desktop.internal_links:
                        if len(seen) >= config.max_pages:
                            break
                        if link in seen:
                            continue
                        seen.add(link)
                        await queue.put(
                            DiscoveredUrl(
                                url=link,
                                discovery_method="crawl",
                                depth=current.depth + 1,
                            )
                        )

            queue.task_done()

    workers = [asyncio.create_task(worker()) for _ in range(config.concurrency)]
    await queue.join()

    for _ in workers:
        await queue.put(None)
    await asyncio.gather(*workers)
    return sorted(records, key=lambda record: record.requested_url)


async def collect_site_pages(config: CrawlConfig) -> CrawlCollection:
    started_at = iso_now()
    seed_host = (urlparse(config.seed_url).hostname or "").lower()

    sitemap_urls = await discover_sitemaps(
        seed_url=config.seed_url,
        explicit_sitemaps=config.explicit_sitemaps,
        timeout=config.timeout,
        verify=config.verify,
    )
    if sitemap_urls:
        eprint(f"[info] Discovered {len(sitemap_urls)} sitemap candidate(s)")
    else:
        eprint("[info] No sitemap candidates discovered")

    sitemap_page_urls, fetched_sitemaps = await expand_sitemaps(
        sitemap_urls=sitemap_urls,
        seed_host=seed_host,
        include_subdomains=config.include_subdomains,
        timeout=config.timeout,
        verify=config.verify,
    )
    if fetched_sitemaps:
        eprint(
            f"[info] Parsed {fetched_sitemaps} sitemap(s) and found {len(sitemap_page_urls)} in-scope page URL(s)"
        )

    used_sitemap = bool(sitemap_page_urls)
    if sitemap_page_urls:
        if len(sitemap_page_urls) > config.max_pages:
            eprint(
                f"[warn] Truncating sitemap page list from {len(sitemap_page_urls)} to {config.max_pages}"
            )
            sitemap_page_urls = sitemap_page_urls[: config.max_pages]
        discovered_urls = [
            DiscoveredUrl(url=url, discovery_method="sitemap", depth=0) for url in sitemap_page_urls
        ]
        records = await fetch_pages_from_sitemap(discovered_urls, config, seed_host)
    else:
        eprint("[info] Falling back to internal link crawl")
        records = await crawl_without_sitemap(config, seed_host)

    finished_at = iso_now()
    return CrawlCollection(
        records=records,
        started_at=started_at,
        finished_at=finished_at,
        seed_host=seed_host,
        sitemap_candidates=len(sitemap_urls),
        fetched_sitemaps=fetched_sitemaps,
        used_sitemap=used_sitemap,
        used_crawl_fallback=not used_sitemap,
    )
