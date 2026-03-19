"""One-time scraper for Marquette undergraduate policies.

Fetches the undergraduate policy inventory from the live Marquette Bulletin,
recursively scrapes the linked university and undergraduate college policy
pages, and writes a single Markdown memo for review.
"""

from __future__ import annotations

import argparse
import re
import time
import urllib.parse
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import requests


BASE_URL = "https://bulletin.marquette.edu"
DEFAULT_ROOT_URL = f"{BASE_URL}/policies/"
DEFAULT_OUTPUT_PATH = Path("docs/memos/webscrape_policies.md")

REQUEST_TIMEOUT = 30.0
RETRY_COUNT = 5
REQUEST_DELAY_SECONDS = 0.25

UNDERGRAD_CONTAINER_ID = "undergraduatetextcontainer"
COLLEGE_CONTAINER_ID = "policiestextcontainer"
COLLEGE_SECTION_HEADING = "Undergraduate College Policies"
UNIVERSITY_SECTION_HEADING = "University Policies"

HEADER_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
CONTAINER_TAGS = {"div", "section", "article"}
LIST_TAGS = {"ul", "ol"}
SKIP_TAGS = {"script", "style", "noscript"}

IGNORED_LINK_TITLES = {"university section"}
EXCLUDED_COLLEGE_HEADING_FRAGMENTS = (
    "graduate school of management",
    "graduate",
    "health science professional",
    "dental",
    "law school",
    "professional",
)


def _require_beautifulsoup():
    try:
        from bs4 import BeautifulSoup as _BeautifulSoup
        from bs4 import NavigableString as _NavigableString
        from bs4 import Tag as _Tag
    except ImportError as exc:  # pragma: no cover - dependency error path
        raise RuntimeError(
            "Missing dependency beautifulsoup4. Install once with: pip install beautifulsoup4"
        ) from exc
    return _BeautifulSoup, _NavigableString, _Tag


BeautifulSoup, NavigableString, Tag = _require_beautifulsoup()


@dataclass(frozen=True)
class PolicyLink:
    title: str
    url: str


@dataclass(frozen=True)
class SectionLinks:
    name: str
    landing_url: str
    links: list[PolicyLink]


@dataclass
class PolicyRecord:
    title: str
    url: str
    body_markdown: str
    primary_section: str
    source_sections: list[str] = field(default_factory=list)


def clean_text(text: str | None) -> str:
    return re.sub(r"\s+", " ", str(text or "").replace("\xa0", " ")).strip()


def clean_multiline_text(text: str) -> str:
    text = text.replace("\xa0", " ")
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line).strip()


def normalize_url(base_url: str, url: str, *, keep_fragment: bool = False) -> str:
    absolute = urllib.parse.urljoin(base_url, url)
    parts = urllib.parse.urlsplit(absolute)
    path = parts.path or "/"
    if not path.endswith("/") and "." not in path.rsplit("/", 1)[-1]:
        path = f"{path}/"
    fragment = parts.fragment if keep_fragment else ""
    return urllib.parse.urlunsplit((parts.scheme.lower(), parts.netloc.lower(), path, "", fragment))


def strip_fragment(url: str) -> str:
    parts = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, parts.query, ""))


def build_session() -> requests.Session:
    session = requests.Session()
    session.trust_env = False
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            )
        }
    )
    return session


def request_text(session: requests.Session, url: str, *, timeout: float, retries: int) -> str:
    target = strip_fragment(url)
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            response = session.get(target, timeout=timeout)
            response.raise_for_status()
            if response.apparent_encoding:
                response.encoding = response.apparent_encoding
            return response.text
        except requests.RequestException as exc:
            last_error = exc
            if attempt == retries:
                break
            wait_seconds = min(4.0, 0.35 * (2 ** (attempt - 1)))
            print(f"[retry] GET {target} attempt {attempt}/{retries - 1} failed: {exc}")
            time.sleep(wait_seconds)
    raise RuntimeError(f"Failed GET after retries: {target}") from last_error


def extract_edition(root_html: str) -> str:
    soup = BeautifulSoup(root_html, "html.parser")
    edition = soup.select_one("#edition")
    return clean_text(edition.get_text(" ", strip=True)) or "Unknown Edition"


def extract_links_from_sitemap(
    sitemap: Tag,
    *,
    base_url: str,
    keep_fragment: bool = False,
    ignored_urls: set[str] | None = None,
) -> list[PolicyLink]:
    links: list[PolicyLink] = []
    seen_urls: set[str] = set()
    ignored = ignored_urls or set()

    for anchor in sitemap.select("a[href]"):
        title = clean_text(anchor.get_text(" ", strip=True))
        href = clean_text(anchor.get("href", ""))
        if not title or not href:
            continue

        normalized = normalize_url(base_url, href, keep_fragment=keep_fragment)
        normalized_without_fragment = strip_fragment(normalized)
        if title.lower() in IGNORED_LINK_TITLES:
            continue
        if normalized_without_fragment in ignored:
            continue
        if normalized_without_fragment in seen_urls:
            continue

        seen_urls.add(normalized_without_fragment)
        links.append(PolicyLink(title=title, url=normalized))
    return links


def parse_undergraduate_index(root_html: str, root_url: str) -> list[SectionLinks]:
    soup = BeautifulSoup(root_html, "html.parser")
    container = soup.select_one(f"#{UNDERGRAD_CONTAINER_ID}")
    if container is None:
        raise RuntimeError(f"Could not find #{UNDERGRAD_CONTAINER_ID} in policies root page.")

    university_links: list[PolicyLink] = []
    college_links: list[PolicyLink] = []
    current_heading = ""

    for child in container.find_all(recursive=False):
        if not isinstance(child, Tag):
            continue
        if child.name in HEADER_TAGS:
            current_heading = clean_text(child.get_text(" ", strip=True))
            continue
        is_link_container = child.name in LIST_TAGS or (
            child.name == "div" and "sitemap" in (child.get("class") or [])
        )
        if is_link_container:
            if current_heading == UNIVERSITY_SECTION_HEADING:
                university_links = extract_links_from_sitemap(child, base_url=root_url)
            elif current_heading == COLLEGE_SECTION_HEADING:
                college_links = extract_links_from_sitemap(child, base_url=root_url, keep_fragment=True)

    if not university_links:
        raise RuntimeError("No university undergraduate policy links found.")
    if not college_links:
        raise RuntimeError("No undergraduate college landing links found.")

    sections = [
        SectionLinks(
            name=UNIVERSITY_SECTION_HEADING,
            landing_url=normalize_url(root_url, f"{root_url}#undergraduatetext", keep_fragment=True),
            links=university_links,
        )
    ]
    sections.extend(SectionLinks(name=link.title, landing_url=link.url, links=[]) for link in college_links)
    return sections


def is_excluded_college_heading(text: str) -> bool:
    lowered = clean_text(text).lower()
    if not lowered:
        return False
    if "undergraduate" in lowered:
        return False
    return any(fragment in lowered for fragment in EXCLUDED_COLLEGE_HEADING_FRAGMENTS)


def parse_college_policy_links(college_html: str, college_landing_url: str, root_url: str) -> list[PolicyLink]:
    soup = BeautifulSoup(college_html, "html.parser")
    container = soup.select_one(f"#{COLLEGE_CONTAINER_ID}")
    if container is None:
        raise RuntimeError(f"Could not find #{COLLEGE_CONTAINER_ID} in {college_landing_url}")

    ignored_urls = {
        strip_fragment(normalize_url(root_url, root_url)),
        strip_fragment(normalize_url(college_landing_url, college_landing_url)),
    }

    links: list[PolicyLink] = []
    seen_urls: set[str] = set()
    collect_links = False

    for child in container.find_all(recursive=False):
        if not isinstance(child, Tag):
            continue
        if child.name in HEADER_TAGS:
            heading_text = clean_text(child.get_text(" ", strip=True))
            collect_links = not is_excluded_college_heading(heading_text)
            continue
        is_link_container = child.name in LIST_TAGS or (
            child.name == "div" and "sitemap" in (child.get("class") or [])
        )
        if is_link_container and collect_links:
            for link in extract_links_from_sitemap(
                child,
                base_url=college_landing_url,
                ignored_urls=ignored_urls,
            ):
                normalized_without_fragment = strip_fragment(link.url)
                if normalized_without_fragment in seen_urls:
                    continue
                seen_urls.add(normalized_without_fragment)
                links.append(link)

    if not links:
        raise RuntimeError(f"No undergraduate college policy links found in {college_landing_url}")
    return links


def render_inline(node: NavigableString | Tag, base_url: str) -> str:
    if isinstance(node, NavigableString):
        return str(node)
    if not isinstance(node, Tag):
        return ""
    if node.name in SKIP_TAGS:
        return ""
    if node.name == "br":
        return "\n"
    if node.name == "a":
        text = render_inline_children(node, base_url)
        href = clean_text(node.get("href", ""))
        if not href:
            return text
        absolute = normalize_url(base_url, href, keep_fragment=True)
        if not text:
            return absolute
        return f"[{text}]({absolute})"
    if node.name in {"strong", "b"}:
        text = render_inline_children(node, base_url)
        return f"**{text}**" if text else ""
    if node.name in {"em", "i"}:
        text = render_inline_children(node, base_url)
        return f"*{text}*" if text else ""
    return render_inline_children(node, base_url)


def render_inline_children(node: Tag, base_url: str) -> str:
    text = "".join(render_inline(child, base_url) for child in node.children)
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    return text.strip()


def render_table(table: Tag) -> str:
    rows: list[list[str]] = []
    for row in table.select("tr"):
        cells = [clean_text(cell.get_text(" ", strip=True)).replace("|", "\\|") for cell in row.find_all(["th", "td"])]
        if any(cells):
            rows.append(cells)
    if not rows:
        return ""

    width = max(len(row) for row in rows)
    normalized_rows = [row + [""] * (width - len(row)) for row in rows]
    header = normalized_rows[0]
    separator = ["---"] * width
    lines = [
        f"| {' | '.join(header)} |",
        f"| {' | '.join(separator)} |",
    ]
    lines.extend(f"| {' | '.join(row)} |" for row in normalized_rows[1:])
    return "\n".join(lines)


def render_description_list(node: Tag, base_url: str) -> str:
    lines: list[str] = []
    current_term = ""

    for child in node.find_all(recursive=False):
        if not isinstance(child, Tag):
            continue
        if child.name == "dt":
            current_term = render_inline_children(child, base_url)
            continue
        if child.name == "dd":
            detail = render_markdown_blocks(child, base_url)
            if current_term and detail:
                lines.append(f"- **{current_term}:** {detail}")
            elif current_term:
                lines.append(f"- **{current_term}**")
            elif detail:
                lines.append(f"- {detail}")
            current_term = ""

    return "\n".join(line for line in lines if line)


def render_list_item(item: Tag, base_url: str, depth: int) -> str:
    text_parts: list[str] = []
    nested_parts: list[str] = []

    for child in item.children:
        if isinstance(child, NavigableString):
            raw = clean_text(str(child))
            if raw:
                text_parts.append(raw)
            continue
        if not isinstance(child, Tag):
            continue
        if child.name in LIST_TAGS:
            nested_parts.append(render_list(child, base_url, depth + 1))
            continue
        if child.name == "p":
            paragraph = render_inline_children(child, base_url)
            if paragraph:
                text_parts.append(paragraph)
            continue
        if child.name in HEADER_TAGS:
            heading = render_inline_children(child, base_url)
            if heading:
                text_parts.append(heading)
            continue
        if child.name in CONTAINER_TAGS:
            rendered = render_markdown_blocks(child, base_url)
            if rendered:
                text_parts.append(rendered)
            continue
        rendered = render_inline(child, base_url)
        rendered = clean_multiline_text(rendered)
        if rendered:
            text_parts.append(rendered)

    item_text = "\n\n".join(part for part in text_parts if part).strip()
    if not item_text:
        item_text = clean_text(item.get_text(" ", strip=True))

    if nested_parts:
        nested_text = "\n".join(part for part in nested_parts if part)
        if item_text:
            return f"{item_text}\n{nested_text}".strip()
        return nested_text
    return item_text


def render_list(node: Tag, base_url: str, depth: int = 0) -> str:
    ordered = node.name == "ol"
    lines: list[str] = []

    for index, item in enumerate(node.find_all("li", recursive=False), start=1):
        marker = f"{index}." if ordered else "-"
        body = render_list_item(item, base_url, depth)
        if not body:
            continue
        item_lines = body.splitlines()
        prefix = f"{'  ' * depth}{marker} "
        continuation = f"{'  ' * depth}   "
        formatted = prefix + item_lines[0]
        for extra_line in item_lines[1:]:
            formatted += f"\n{continuation}{extra_line}"
        lines.append(formatted.rstrip())

    return "\n".join(lines)


def render_block(node: Tag, base_url: str) -> str:
    if node.name in SKIP_TAGS:
        return ""
    if node.name in HEADER_TAGS:
        heading_text = render_inline_children(node, base_url)
        if not heading_text:
            return ""
        html_level = int(node.name[1])
        markdown_level = min(6, max(4, html_level + 2))
        return f"{'#' * markdown_level} {heading_text}"
    if node.name == "p":
        return render_inline_children(node, base_url)
    if node.name in LIST_TAGS:
        return render_list(node, base_url)
    if node.name == "blockquote":
        quoted = clean_multiline_text(render_markdown_blocks(node, base_url))
        if not quoted:
            return ""
        return "\n".join(f"> {line}" for line in quoted.splitlines())
    if node.name == "table":
        return render_table(node)
    if node.name == "dl":
        return render_description_list(node, base_url)
    if node.name in CONTAINER_TAGS:
        return render_markdown_blocks(node, base_url)
    if node.name == "a" and not node.get("href") and not clean_text(node.get_text(" ", strip=True)):
        return ""
    return clean_multiline_text(render_inline(node, base_url))


def render_markdown_blocks(container: Tag, base_url: str) -> str:
    blocks: list[str] = []
    for child in container.children:
        if not isinstance(child, Tag):
            continue
        rendered = render_block(child, base_url).strip()
        if rendered:
            blocks.append(rendered)
    return "\n\n".join(blocks).strip()


def extract_policy_page(policy_html: str, policy_url: str) -> tuple[str, str]:
    soup = BeautifulSoup(policy_html, "html.parser")
    title_tag = soup.select_one("h1.page-title")
    title = clean_text(title_tag.get_text(" ", strip=True) if title_tag else "")
    if not title:
        raise RuntimeError(f"Missing page title for {policy_url}")

    container = soup.select_one("#textcontainer")
    if container is None:
        container = soup.select_one("main#contentarea .page_content")
    if container is None:
        raise RuntimeError(f"Missing main policy content for {policy_url}")

    body_markdown = render_markdown_blocks(container, policy_url)
    if not body_markdown:
        raise RuntimeError(f"Empty policy body for {policy_url}")
    return title, body_markdown


def fetch_undergraduate_sections(
    session: requests.Session,
    root_url: str,
    *,
    timeout: float,
    retries: int,
    delay: float,
) -> tuple[str, list[SectionLinks]]:
    root_html = request_text(session, root_url, timeout=timeout, retries=retries)
    sections = parse_undergraduate_index(root_html, root_url)

    hydrated_sections: list[SectionLinks] = [sections[0]]
    for section in sections[1:]:
        if delay:
            time.sleep(delay)
        college_html = request_text(session, section.landing_url, timeout=timeout, retries=retries)
        links = parse_college_policy_links(college_html, section.landing_url, root_url)
        hydrated_sections.append(SectionLinks(name=section.name, landing_url=section.landing_url, links=links))

    return root_html, hydrated_sections


def collect_policy_records(
    session: requests.Session,
    sections: list[SectionLinks],
    *,
    timeout: float,
    retries: int,
    delay: float,
) -> dict[str, PolicyRecord]:
    records: dict[str, PolicyRecord] = {}

    for section in sections:
        for link in section.links:
            record = records.get(link.url)
            if record is not None:
                if section.name not in record.source_sections:
                    record.source_sections.append(section.name)
                continue

            if delay:
                time.sleep(delay)
            policy_html = request_text(session, link.url, timeout=timeout, retries=retries)
            title, body_markdown = extract_policy_page(policy_html, link.url)
            records[link.url] = PolicyRecord(
                title=title,
                url=link.url,
                body_markdown=body_markdown,
                primary_section=section.name,
                source_sections=[section.name],
            )
    return records


def render_markdown(
    *,
    edition: str,
    root_url: str,
    sections: list[SectionLinks],
    records: dict[str, PolicyRecord],
    scraped_at: datetime,
) -> str:
    total_links = sum(len(section.links) for section in sections)
    duplicates = total_links - len(records)

    parts = [
        "# Marquette Undergraduate Policies Web Scrape",
        "",
        f"- Bulletin edition: {edition}",
        f"- Root source: {normalize_url(root_url, root_url, keep_fragment=True)}#undergraduatetext",
        f"- Scraped at (UTC): {scraped_at.astimezone(timezone.utc).isoformat(timespec='seconds')}",
        "- Dedupe rule: full policy text is included once per unique policy URL; later occurrences cross-reference the first section.",
        f"- Sections scraped: {len(sections)}",
        f"- Policy links discovered: {total_links}",
        f"- Unique policy pages captured: {len(records)}",
        f"- Duplicate links cross-referenced: {duplicates}",
    ]

    for section in sections:
        parts.extend(["", f"## {section.name}", "", f"Section source: {section.landing_url}"])
        for link in section.links:
            record = records[link.url]
            parts.extend(["", f"### {record.title}", "", f"Source URL: {record.url}"])
            if record.primary_section != section.name:
                parts.extend(["", f"Full text captured under {record.primary_section}."])
                continue

            other_sections = [name for name in record.source_sections if name != section.name]
            if other_sections:
                parts.extend(["", f"Also linked from: {', '.join(other_sections)}"])
            parts.extend(["", record.body_markdown])

    return "\n".join(parts).strip() + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape Marquette undergraduate policies into docs/memos/webscrape_policies.md"
    )
    parser.add_argument("--root-url", default=DEFAULT_ROOT_URL, help="Bulletin policies root URL.")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help="Markdown output path.",
    )
    parser.add_argument("--timeout", type=float, default=REQUEST_TIMEOUT, help="HTTP timeout in seconds.")
    parser.add_argument("--delay", type=float, default=REQUEST_DELAY_SECONDS, help="Delay between requests.")
    parser.add_argument("--max-retries", type=int, default=RETRY_COUNT, help="Maximum request retries.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root_url = normalize_url(args.root_url, args.root_url)
    session = build_session()

    print(f"[start] Scraping undergraduate policies from {root_url}")
    root_html, sections = fetch_undergraduate_sections(
        session,
        root_url,
        timeout=args.timeout,
        retries=args.max_retries,
        delay=args.delay,
    )
    records = collect_policy_records(
        session,
        sections,
        timeout=args.timeout,
        retries=args.max_retries,
        delay=args.delay,
    )

    edition = extract_edition(root_html)
    scraped_at = datetime.now(timezone.utc)
    markdown = render_markdown(
        edition=edition,
        root_url=root_url,
        sections=sections,
        records=records,
        scraped_at=scraped_at,
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(markdown, encoding="utf-8")

    total_links = sum(len(section.links) for section in sections)
    duplicate_count = total_links - len(records)
    print(
        "[done] "
        f"sections={len(sections)} "
        f"policy_links={total_links} "
        f"unique_pages={len(records)} "
        f"duplicates={duplicate_count} "
        f"output={args.output}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
