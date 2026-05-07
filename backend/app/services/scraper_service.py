from __future__ import annotations

import json
import re
from dataclasses import dataclass
from html import unescape
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urlparse

import httpx


class ScraperError(ValueError):
    pass


@dataclass
class ScrapedBookData:
    title: str
    author: str
    genre: str
    publication_year: int
    source: str
    source_url: str
    synopsis: str
    rating: int
    cover_url: str | None = None


class _BookMetadataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.meta: dict[str, str] = {}
        self.title_parts: list[str] = []
        self.json_ld_blocks: list[str] = []
        self._in_title = False
        self._in_json_ld = False
        self._current_script: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = {key.lower(): value or "" for key, value in attrs}
        if tag.lower() == "title":
            self._in_title = True
        if tag.lower() == "meta":
            key = attr.get("property") or attr.get("name") or attr.get("itemprop")
            content = attr.get("content")
            if key and content:
                self.meta[key.lower()] = unescape(content).strip()
        if tag.lower() == "script" and "ld+json" in attr.get("type", "").lower():
            self._in_json_ld = True
            self._current_script = []

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._in_title = False
        if tag.lower() == "script" and self._in_json_ld:
            self._in_json_ld = False
            block = "".join(self._current_script).strip()
            if block:
                self.json_ld_blocks.append(block)
            self._current_script = []

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title_parts.append(data)
        if self._in_json_ld:
            self._current_script.append(data)

    @property
    def page_title(self) -> str:
        return " ".join(part.strip() for part in self.title_parts if part.strip()).strip()


class ScraperService:
    def __init__(self, timeout_seconds: float = 6.0) -> None:
        self.timeout_seconds = timeout_seconds

    def scrape(self, url: str) -> ScrapedBookData:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ScraperError("Enter a valid http or https book page URL.")

        html = self._fetch(url)
        metadata = self.parse_html(html, url)
        if not metadata.title:
            raise ScraperError("The page was fetched, but no usable book title was found.")
        return metadata

    def _fetch(self, url: str) -> str:
        try:
            with httpx.Client(
                timeout=self.timeout_seconds,
                follow_redirects=True,
                headers={
                    "User-Agent": (
                        "BookScapeUniversityProject/1.0 "
                        "(metadata scraper; contact: local-demo)"
                    ),
                    "Accept": "text/html,application/xhtml+xml",
                },
            ) as client:
                response = client.get(url)
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise ScraperError(
                f"The source returned HTTP {exc.response.status_code}; scraping may be blocked."
            ) from exc
        except httpx.RequestError as exc:
            raise ScraperError("Could not fetch the page. Check the URL or try another source.") from exc

        content_type = response.headers.get("content-type", "")
        if "html" not in content_type and response.text.lstrip().startswith("<") is False:
            raise ScraperError("The URL did not return an HTML book page.")
        return response.text

    def parse_html(self, html: str, url: str) -> ScrapedBookData:
        parser = _BookMetadataParser()
        parser.feed(html)

        json_ld_books = self._extract_json_ld_books(parser.json_ld_blocks)
        primary_json = json_ld_books[0] if json_ld_books else {}
        meta = parser.meta
        source = self.detect_source(url)

        title = self._first_text(
            self._json_value(primary_json, "name"),
            meta.get("book:title"),
            meta.get("og:title"),
            meta.get("twitter:title"),
            self._clean_page_title(parser.page_title, source),
        )
        author = self._first_text(
            self._author_from_json(primary_json),
            meta.get("book:author"),
            meta.get("author"),
        ) or "Unknown author"
        synopsis = self._first_text(
            self._json_value(primary_json, "description"),
            meta.get("og:description"),
            meta.get("description"),
            meta.get("twitter:description"),
        ) or "No synopsis was available from the scraped page."
        cover_url = self._first_text(
            self._image_from_json(primary_json),
            meta.get("og:image"),
            meta.get("twitter:image"),
        )
        genre = self._first_text(
            self._json_value(primary_json, "genre"),
            meta.get("book:tag"),
            meta.get("keywords"),
        ) or "Discovered"
        publication_year = self._extract_year(
            self._json_value(primary_json, "datePublished"),
            meta.get("book:release_date"),
            html,
        )
        rating = self._extract_rating(primary_json)

        return ScrapedBookData(
            title=title,
            author=author,
            genre=genre.split(",")[0].strip()[:80] or "Discovered",
            publication_year=publication_year,
            source=source,
            source_url=url,
            synopsis=synopsis,
            rating=rating,
            cover_url=cover_url,
        )

    def detect_source(self, url: str) -> str:
        host = urlparse(url).netloc.lower()
        if "goodreads" in host:
            return "Goodreads"
        if "amazon" in host:
            return "Amazon"
        if "barnesandnoble" in host or "bn.com" in host:
            return "Barnes & Noble"
        if "openlibrary" in host:
            return "Open Library"
        return "Generic Book Page"

    def _extract_json_ld_books(self, blocks: list[str]) -> list[dict[str, Any]]:
        books: list[dict[str, Any]] = []
        for block in blocks:
            try:
                parsed = json.loads(block)
            except json.JSONDecodeError:
                continue
            books.extend(self._find_book_nodes(parsed))
        return books

    def _find_book_nodes(self, node: Any) -> list[dict[str, Any]]:
        if isinstance(node, list):
            return [book for item in node for book in self._find_book_nodes(item)]
        if not isinstance(node, dict):
            return []

        found: list[dict[str, Any]] = []
        node_type = node.get("@type") or node.get("type")
        types = node_type if isinstance(node_type, list) else [node_type]
        if any(str(item).lower() == "book" for item in types if item):
            found.append(node)

        graph = node.get("@graph")
        if graph:
            found.extend(self._find_book_nodes(graph))
        return found

    def _json_value(self, node: dict[str, Any], key: str) -> str | None:
        value = node.get(key)
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, list):
            values = [self._stringify_json_value(item) for item in value]
            return ", ".join(item for item in values if item)
        return self._stringify_json_value(value)

    def _stringify_json_value(self, value: Any) -> str | None:
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, dict):
            for key in ("name", "url", "@id"):
                if isinstance(value.get(key), str):
                    return value[key].strip()
        return None

    def _author_from_json(self, node: dict[str, Any]) -> str | None:
        return self._json_value(node, "author")

    def _image_from_json(self, node: dict[str, Any]) -> str | None:
        return self._json_value(node, "image")

    def _extract_year(self, *values: str | None) -> int:
        for value in values:
            if not value:
                continue
            match = re.search(r"(1[5-9]\d{2}|20\d{2})", value)
            if match:
                return int(match.group(1))
        return 2024

    def _extract_rating(self, node: dict[str, Any]) -> int:
        aggregate = node.get("aggregateRating")
        if isinstance(aggregate, dict):
            value = aggregate.get("ratingValue")
            try:
                return max(0, min(5, round(float(value))))
            except (TypeError, ValueError):
                pass
        return 0

    def _first_text(self, *values: str | None) -> str:
        for value in values:
            if value and value.strip():
                return unescape(value).strip()
        return ""

    def _clean_page_title(self, title: str, source: str) -> str:
        cleaned = title.strip()
        for separator in (" | ", " - ", " — "):
            if separator in cleaned:
                cleaned = cleaned.split(separator)[0].strip()
        if source != "Generic Book Page":
            cleaned = re.sub(source, "", cleaned, flags=re.IGNORECASE).strip(" :-|")
        return cleaned
