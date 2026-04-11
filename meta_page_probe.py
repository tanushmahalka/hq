#!/usr/bin/env python3

import argparse
import json
import os
import re
import sys
from html import unescape
from urllib.parse import quote_plus, urlparse
from urllib.request import Request, urlopen


DUCKDUCKGO_SEARCH_URL = "https://html.duckduckgo.com/html/?q={query}"
TAVILY_SEARCH_URL = "https://api.tavily.com/search"
USER_AGENT = "Mozilla/5.0 (compatible; MetaPageProbe/1.0)"


def normalize_host(raw_url: str) -> str:
    candidate = raw_url.strip()
    if "://" not in candidate:
        candidate = f"https://{candidate}"

    parsed = urlparse(candidate)
    host = parsed.netloc.lower() or parsed.path.lower()
    return host.strip("/")


def build_query(host: str) -> str:
    return f"site:facebook.com {host}"


def fetch_duckduckgo_html(query: str) -> str:
    request = Request(
        DUCKDUCKGO_SEARCH_URL.format(query=quote_plus(query)),
        headers={"User-Agent": USER_AGENT},
    )
    with urlopen(request, timeout=20) as response:
        return response.read().decode("utf-8", errors="replace")


def extract_first_result(html: str) -> dict | None:
    pattern = re.compile(
        r'<a[^>]*class="result__a"[^>]*href="(?P<href>[^"]+)"[^>]*>(?P<title>.*?)</a>',
        re.DOTALL,
    )
    match = pattern.search(html)
    if not match:
        return None

    snippet_match = re.search(
        r'<a[^>]*class="result__snippet"[^>]*>(?P<snippet>.*?)</a>',
        html[match.end():],
        re.DOTALL,
    )

    return {
        "url": unescape(strip_tags(match.group("href"))),
        "title": unescape(strip_tags(match.group("title"))),
        "snippet": unescape(strip_tags(snippet_match.group("snippet"))) if snippet_match else None,
    }


def strip_tags(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def fetch_tavily_result(query: str, api_key: str, max_results: int) -> dict:
    payload = json.dumps(
        {
            "query": query,
            "search_depth": "basic",
            "max_results": max_results,
            "include_answer": False,
            "include_raw_content": False,
        }
    ).encode("utf-8")
    request = Request(
        TAVILY_SEARCH_URL,
        data=payload,
        headers={
            "User-Agent": USER_AGENT,
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    with urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8", errors="replace"))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Search for the top Facebook result for a company website host."
    )
    parser.add_argument("website_url", help="Website URL or host, e.g. www.shopbloom.in")
    parser.add_argument(
        "--provider",
        choices=("duckduckgo", "tavily"),
        default="tavily",
        help="Search provider to use.",
    )
    parser.add_argument(
        "--tavily-api-key",
        default=os.environ.get("TAVILY_API_KEY"),
        help="Tavily API key. Defaults to TAVILY_API_KEY env var.",
    )
    parser.add_argument(
        "--max-results",
        type=int,
        default=5,
        help="Maximum number of results to request from the provider.",
    )
    args = parser.parse_args()

    host = normalize_host(args.website_url)
    query = build_query(host)

    try:
        if args.provider == "tavily":
            if not args.tavily_api_key:
                print(json.dumps({"query": query, "error": "Missing Tavily API key"}, indent=2))
                return 1

            response = fetch_tavily_result(query, args.tavily_api_key, args.max_results)
            result = {
                "provider": "tavily",
                "input": args.website_url,
                "host": host,
                "query": query,
                "first_result": response["results"][0] if response.get("results") else None,
                "results": response.get("results", []),
                "result_count": len(response.get("results", [])),
                "request_id": response.get("request_id"),
                "response_time": response.get("response_time"),
            }
        else:
            html = fetch_duckduckgo_html(query)
            result = {
                "provider": "duckduckgo",
                "input": args.website_url,
                "host": host,
                "query": query,
                "first_result": extract_first_result(html),
            }
    except Exception as exc:
        print(json.dumps({"query": query, "error": str(exc)}, indent=2))
        return 1

    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
