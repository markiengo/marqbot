from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[2] / "scripts" / "scrape_undergrad_policies.py"
SPEC = importlib.util.spec_from_file_location("scrape_undergrad_policies", MODULE_PATH)
scraper = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = scraper
SPEC.loader.exec_module(scraper)


def test_parse_undergraduate_index_extracts_university_and_college_sections():
    html = """
    <div id="undergraduatetextcontainer">
      <h3>University Policies</h3>
      <div class="sitemap">
        <ul>
          <li><a href="/policies/alpha/">Alpha</a></li>
          <li><a href="/policies/beta/">Beta</a></li>
        </ul>
      </div>
      <h3>Undergraduate College Policies</h3>
      <div class="sitemap">
        <ul>
          <li><a href="/arts-sciences/#policiestext">College of Arts and Sciences</a></li>
          <li><a href="/engineering/#policiestext">College of Engineering</a></li>
        </ul>
      </div>
    </div>
    """

    sections = scraper.parse_undergraduate_index(html, "https://bulletin.marquette.edu/policies/")

    assert [section.name for section in sections] == [
        "University Policies",
        "College of Arts and Sciences",
        "College of Engineering",
    ]
    assert [link.title for link in sections[0].links] == ["Alpha", "Beta"]
    assert sections[0].links[0].url == "https://bulletin.marquette.edu/policies/alpha/"
    assert sections[1].landing_url == "https://bulletin.marquette.edu/arts-sciences/#policiestext"


def test_parse_college_policy_links_skips_back_links_and_non_undergrad_sections():
    html = """
    <div id="policiestextcontainer">
      <h2>College of Health Sciences Policies</h2>
      <p>Introductory text.</p>
      <h2>UNDERGRADUATE COLLEGE</h2>
      <div class="sitemap">
        <ul>
          <li><a href="/policies/">university section</a></li>
          <li><a href="/health-sciences/policies/deans-list/">Dean's List Criteria</a></li>
          <li><a href="/health-sciences/policies/degrees-offered/">Degrees Offered</a></li>
        </ul>
      </div>
      <h2>HEALTH SCIENCE PROFESSIONAL</h2>
      <div class="sitemap">
        <ul>
          <li><a href="/health-sciences/policies/professional-only/">Professional Only</a></li>
        </ul>
      </div>
    </div>
    """

    links = scraper.parse_college_policy_links(
        html,
        "https://bulletin.marquette.edu/health-sciences/#policiestext",
        "https://bulletin.marquette.edu/policies/",
    )

    assert [link.title for link in links] == ["Dean's List Criteria", "Degrees Offered"]
    assert all("professional-only" not in link.url for link in links)
    assert all(link.url != "https://bulletin.marquette.edu/policies/" for link in links)


def test_extract_policy_page_renders_basic_markdown_structure():
    html = """
    <html>
      <body>
        <main id="contentarea">
          <header>
            <h1 class="page-title">Academic Advising</h1>
          </header>
          <div id="textcontainer" class="page_content">
            <p>Intro paragraph.</p>
            <h2>Adviser and Student Expectations</h2>
            <ul>
              <li>Meet regularly.</li>
              <li>Use campus resources.</li>
            </ul>
          </div>
        </main>
      </body>
    </html>
    """

    title, body = scraper.extract_policy_page(html, "https://bulletin.marquette.edu/policies/academic-advising/")

    assert title == "Academic Advising"
    assert "Intro paragraph." in body
    assert "#### Adviser and Student Expectations" in body
    assert "- Meet regularly." in body


def test_render_markdown_cross_references_duplicate_policy_urls():
    sections = [
        scraper.SectionLinks(
            name="University Policies",
            landing_url="https://bulletin.marquette.edu/policies/#undergraduatetext",
            links=[scraper.PolicyLink(title="Academic Integrity", url="https://bulletin.marquette.edu/policies/academic-integrity/")],
        ),
        scraper.SectionLinks(
            name="College of Communication",
            landing_url="https://bulletin.marquette.edu/communication/#policiestext",
            links=[scraper.PolicyLink(title="Academic Integrity", url="https://bulletin.marquette.edu/policies/academic-integrity/")],
        ),
    ]
    records = {
        "https://bulletin.marquette.edu/policies/academic-integrity/": scraper.PolicyRecord(
            title="Academic Integrity",
            url="https://bulletin.marquette.edu/policies/academic-integrity/",
            body_markdown="Policy body text.",
            primary_section="University Policies",
            source_sections=["University Policies", "College of Communication"],
        )
    }

    markdown = scraper.render_markdown(
        edition="2025-26 Edition",
        root_url="https://bulletin.marquette.edu/policies/",
        sections=sections,
        records=records,
        scraped_at=scraper.datetime(2026, 3, 18, 12, 0, 0, tzinfo=scraper.timezone.utc),
    )

    assert "Also linked from: College of Communication" in markdown
    assert "Full text captured under University Policies." in markdown
    assert markdown.count("### Academic Integrity") == 2
