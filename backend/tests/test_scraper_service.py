import httpx
import pytest

from app.services import scraper_service as scraper_module
from app.services.scraper_service import ScraperError, ScraperService


def test_scrape_rejects_non_http_urls():
    service = ScraperService()

    with pytest.raises(ScraperError, match="valid http or https"):
        service.scrape("ftp://example.com/book")


def test_scrape_requires_a_usable_title(monkeypatch):
    service = ScraperService()
    monkeypatch.setattr(service, "_fetch", lambda url: "<html><head></head><body></body></html>")

    with pytest.raises(ScraperError, match="no usable book title"):
        service.scrape("https://example.com/empty")


def test_parse_html_uses_meta_title_and_text_fallbacks():
    service = ScraperService()
    html = """
    <html>
      <head>
        <title>The Fallback Book | Goodreads</title>
        <meta name="author" content="Meta Author" />
        <meta name="description" content="Meta synopsis." />
        <meta name="keywords" content="Fantasy, Magic, Adventure" />
        <meta property="og:image" content="https://example.com/fallback.jpg" />
      </head>
      <body>First published in 1999.</body>
    </html>
    """

    result = service.parse_html(html, "https://www.goodreads.com/book/show/1")

    assert result.title == "The Fallback Book"
    assert result.author == "Meta Author"
    assert result.genre == "Fantasy"
    assert result.publication_year == 1999
    assert result.rating == 0
    assert result.cover_url == "https://example.com/fallback.jpg"
    assert result.source == "Goodreads"


def test_parse_html_extracts_nested_json_ld_book_nodes():
    service = ScraperService()
    html = """
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@graph": [
              {"@type": "WebPage", "name": "Page"},
              {
                "@type": ["CreativeWork", "Book"],
                "name": "Graph Book",
                "author": ["Writer One", {"name": "Writer Two"}],
                "genre": ["Literary", "Fiction"],
                "image": {"url": "https://example.com/graph.jpg"},
                "datePublished": "2018",
                "description": "From a graph.",
                "aggregateRating": {"ratingValue": "4.2"}
              }
            ]
          }
        </script>
      </head>
    </html>
    """

    result = service.parse_html(html, "https://openlibrary.org/books/OL1M")

    assert result.title == "Graph Book"
    assert result.author == "Writer One, Writer Two"
    assert result.genre == "Literary"
    assert result.cover_url == "https://example.com/graph.jpg"
    assert result.publication_year == 2018
    assert result.rating == 4
    assert result.source == "Open Library"


def test_parse_html_ignores_bad_json_ld_and_uses_defaults():
    service = ScraperService()
    html = """
    <html>
      <head>
        <title>Plain Book - Shop</title>
        <script type="application/ld+json">{bad json</script>
      </head>
    </html>
    """

    result = service.parse_html(html, "https://example.com/plain")

    assert result.title == "Plain Book"
    assert result.author == "Unknown author"
    assert result.genre == "Discovered"
    assert result.synopsis == "No synopsis was available from the scraped page."
    assert result.publication_year == 2024
    assert result.source == "Generic Book Page"


def test_detect_source_covers_supported_hosts():
    service = ScraperService()

    assert service.detect_source("https://amazon.com/dp/1") == "Amazon"
    assert service.detect_source("https://www.barnesandnoble.com/w/1") == "Barnes & Noble"
    assert service.detect_source("https://bn.com/w/1") == "Barnes & Noble"


class _FakeClient:
    def __init__(self, response=None, error=None, *args, **kwargs):
        self.response = response
        self.error = error

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def get(self, url):
        if self.error:
            raise self.error
        return self.response


class _FakeResponse:
    def __init__(self, text, content_type="text/html"):
        self.text = text
        self.headers = {"content-type": content_type}

    def raise_for_status(self):
        return None


def test_fetch_rejects_non_html_responses(monkeypatch):
    monkeypatch.setattr(
        scraper_module.httpx,
        "Client",
        lambda *args, **kwargs: _FakeClient(_FakeResponse("plain text", "text/plain")),
    )

    with pytest.raises(ScraperError, match="did not return an HTML"):
        ScraperService()._fetch("https://example.com/file.txt")


def test_fetch_maps_request_errors(monkeypatch):
    request = httpx.Request("GET", "https://example.com/book")
    monkeypatch.setattr(
        scraper_module.httpx,
        "Client",
        lambda *args, **kwargs: _FakeClient(error=httpx.RequestError("offline", request=request)),
    )

    with pytest.raises(ScraperError, match="Could not fetch"):
        ScraperService()._fetch("https://example.com/book")


def test_fetch_maps_http_status_errors(monkeypatch):
    request = httpx.Request("GET", "https://example.com/book")
    response = httpx.Response(403, request=request)
    monkeypatch.setattr(
        scraper_module.httpx,
        "Client",
        lambda *args, **kwargs: _FakeClient(
            error=httpx.HTTPStatusError("blocked", request=request, response=response)
        ),
    )

    with pytest.raises(ScraperError, match="HTTP 403"):
        ScraperService()._fetch("https://example.com/book")
