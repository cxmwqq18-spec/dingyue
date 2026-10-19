"""Read-only browser regression for the standalone Aidreamcapes inspiration page.

Run against a loopback app with the current local relational content. No tasks,
generation, customer records, or page content are created by these checks.
"""

import argparse
import json
from pathlib import Path
import subprocess
import tempfile
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--base-url", default="http://127.0.0.1:3002")
parser.add_argument("--artifacts", default=None)
args = parser.parse_args()
assert urlparse(args.base_url).hostname in ("127.0.0.1", "localhost"), "Use a loopback app."
artifacts = Path(args.artifacts or tempfile.mkdtemp(prefix="aidreamcapes-inspirations-"))
artifacts.mkdir(parents=True, exist_ok=True)
executable = subprocess.check_output([
    "node", "--input-type=module", "-e",
    'import { chromium } from "playwright"; console.log(chromium.executablePath());',
], text=True).strip()
url = args.base_url + "/site/aidreamcapes/app/inspirations"
checks, errors, data_requests = [], [], []

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=executable)
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, service_workers="block")
    page = context.new_page()
    page.set_default_navigation_timeout(60000)
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("request", lambda request: data_requests.append(request.url)
            if request.resource_type in ("fetch", "xhr", "eventsource") and "/api/" in request.url else None)

    response = page.goto(url, wait_until="networkidle", timeout=60000)
    assert response.status == 200
    assert urlparse(page.url).path == "/site/aidreamcapes/app/inspirations"
    expect(page.get_by_role("heading", name="Inspirations.", exact=True)).to_be_visible()
    expect(page.get_by_role("complementary", name="Workspace navigation")).to_have_count(0)
    expect(page.locator("iframe")).to_have_count(0)
    expect(page.locator('meta[name="robots"]')).to_have_attribute("content", "noindex, nofollow")
    cards = page.locator("[data-inspiration-card]")
    total = cards.count()
    assert total > 1, "Current local LivePage examples are required."
    checks.append(f"Independent noindex page renders {total} current examples without the creation shell.")

    # The next repaint is enough for interactive filters; they must not fetch data.
    page.get_by_role("button", name="Video ideas").click()
    assert cards.count() > 0
    video_count = cards.count()
    assert "kind=video" in page.url
    page.get_by_role("button", name="Photo ideas").click()
    photo_count = cards.count()
    assert photo_count > 0 and video_count + photo_count == total
    search = page.get_by_role("searchbox", name="Search inspirations")
    search.fill("no-example-matches-this-20261019")
    expect(page.get_by_role("heading", name="No matching examples")).to_be_visible()
    page.get_by_role("button", name="Clear filters").click()
    assert cards.count() == total
    category_buttons = page.get_by_role("group", name="Category filters").get_by_role("button")
    if category_buttons.count() > 1:
        category_buttons.nth(1).click()
        selected_category = category_buttons.nth(1).inner_text()
        assert 0 < cards.count() < total
        page.reload(wait_until="networkidle")
        expect(page.get_by_role("button", name=selected_category, exact=True)).to_have_attribute("aria-pressed", "true")
        page.get_by_role("button", name="All categories", exact=True).click()
    search.fill("product")
    before_reload = cards.count()
    assert before_reload > 0
    page.reload(wait_until="networkidle")
    expect(search).to_have_value("product")
    assert cards.count() == before_reload
    page.get_by_role("button", name="Clear search", exact=True).click()
    expect(search).to_have_value("")
    expect(cards).to_have_count(total)
    checks.append("Media/category/search filters work locally and survive reload through the URL.")

    first = cards.first
    first_label = first.get_attribute("aria-label").removeprefix("Open ").removesuffix(" example")
    first_image = first.locator("img").get_attribute("src")
    first.click()
    dialog = page.get_by_role("dialog", name=first_label, exact=True)
    expect(dialog).to_be_visible()
    assert dialog.locator("img").get_attribute("src") == first_image
    expect(dialog.get_by_role("button", name="Previous example")).to_be_disabled()
    create = dialog.get_by_role("link", name="Create a", exact=False)
    href = create.get_attribute("href")
    assert href.startswith("/site/aidreamcapes/")
    assert "mydreamshoots" not in href
    assert any(part in href for part in ("/ai-video-generation/", "/ai-image-generation/", "/app/create"))
    dialog.get_by_role("button", name="Next example").click()
    expect(dialog).to_have_count(0)
    dialog = page.get_by_role("dialog")
    assert dialog.get_attribute("aria-labelledby")
    page.keyboard.press("ArrowLeft")
    expect(page.get_by_role("dialog", name=first_label, exact=True)).to_be_visible()
    # Native dialog keeps keyboard focus inside the example.
    for _ in range(8):
        page.keyboard.press("Tab")
        assert page.evaluate("!!document.activeElement.closest('dialog')")
    page.screenshot(path=str(artifacts / "desktop-example.png"))
    page.keyboard.press("Escape")
    expect(page.get_by_role("dialog")).to_have_count(0)
    expect(first).to_be_focused()
    assert page.evaluate("document.body.style.overflow") != "hidden"
    checks.append("Example preview preserves the asset, has a scoped creation link, supports next/previous, focus trapping, and Escape.")

    page.screenshot(path=str(artifacts / "desktop-gallery.png"))
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    for width in (390, 320):
        page.set_viewport_size({"width": width, "height": 844})
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"No overflow at {width}px."
        first.click()
        expect(page.get_by_role("button", name="Close example")).to_be_in_viewport()
        expect(page.get_by_role("link", name="Create a", exact=False)).to_be_in_viewport()
        page.screenshot(path=str(artifacts / f"mobile-example-{width}.png"))
        page.get_by_role("button", name="Close example").click()
        page.screenshot(path=str(artifacts / f"mobile-gallery-{width}.png"))
    checks.append("Gallery and detail actions fit both 390px and 320px mobile screens.")
    assert data_requests == [], f"Gallery made no public/customer API requests: {data_requests}"
    assert errors == [], f"No browser errors: {errors}"

    # Check the alias and historical query entry separately, without client mocks.
    for route, expected in (
        ("/site/aidreamcapes/app/create/inspirations", "/site/aidreamcapes/app/inspirations"),
        ("/site/aidreamcapes/app/create?view=inspirations", "/site/aidreamcapes/app/inspirations"),
        ("/site/aivideosugc/app/inspirations", "/site/aivideosugc/app/inspirations"),
        ("/site/aivideosugc/app/create?view=inspirations", "/site/aivideosugc/app/inspirations"),
    ):
        page.goto(args.base_url + route, wait_until="networkidle", timeout=60000)
        assert urlparse(page.url).path == expected
        expect(page.locator("[data-inspiration-card]")).to_have_count(total)
    checks.append("Both Aidreamcapes route aliases and historical view links reach a standalone page.")

    nojs = browser.new_context(java_script_enabled=False, viewport={"width": 1440, "height": 1000})
    raw_page = nojs.new_page()
    response = raw_page.goto(url, wait_until="networkidle", timeout=60000)
    assert response.status == 200
    expect(raw_page.locator("[data-inspiration-card]")).to_have_count(total)
    assert raw_page.locator('[data-inspiration-card] img[src]').count() == total
    checks.append("All examples and their images are present in HTML with JavaScript disabled.")
    nojs.close()

    host_context = browser.new_context(extra_http_headers={"x-forwarded-host": "www.aivideosugc.com", "x-forwarded-proto": "https"})
    host_page = host_context.new_page()
    for path in ("/app/inspirations", "/app/create/inspirations"):
        host_response = host_page.goto(args.base_url + path, wait_until="networkidle", timeout=60000)
        assert host_response.status == 200
        expect(host_page.locator("[data-inspiration-card]")).to_have_count(total)
        expect(host_page.get_by_role("complementary", name="Workspace navigation")).to_have_count(0)
        expect(host_page.get_by_role("link", name="Back to workspace")).to_have_attribute("href", "/app/create")
    host_context.close()
    checks.append("Canonical host routing also serves both standalone entry paths with host-relative actions.")

    page.goto(url, wait_until="networkidle")
    for media in ("Video ideas", "Photo ideas"):
        page.get_by_role("button", name=media).click()
        page.locator("[data-inspiration-card]").first.click()
        target = page.get_by_role("dialog").get_by_role("link", name="Create a", exact=False).get_attribute("href")
        target_response = context.request.get(args.base_url + target, timeout=60000)
        assert target_response.status == 200, f"Creation route is available: {target}"
        page.get_by_role("button", name="Close example").click()
    page.get_by_role("link", name="Back to workspace").click()
    expect(page.get_by_role("complementary", name="Workspace navigation")).to_be_visible(timeout=30000)
    checks.append("Video/photo creation destinations return HTTP 200 and the back link opens the workspace.")
    context.close()
    browser.close()

report = {"ok": True, "baseUrl": args.base_url, "checks": checks, "errors": errors, "artifacts": str(artifacts)}
(artifacts / "report.json").write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
