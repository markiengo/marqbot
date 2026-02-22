import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const indexPath = path.join(repoRoot, "frontend", "index.html");
const stylePath = path.join(repoRoot, "frontend", "style.css");

function read(relPath) {
  return fs.readFileSync(relPath, "utf8");
}

describe("v1.7 static UI contract", () => {
  test("left rail includes branding logo and six nav buttons in order", () => {
    const html = read(indexPath);
    expect(html).toContain('id="rail"');
    expect(html).toContain('src="marquette_logo2.jpg"');

    const navOrder = ["nav-home", "nav-plan", "nav-courses", "nav-saved", "nav-ai-advisor", "nav-avatar"];
    let cursor = -1;
    for (const navId of navOrder) {
      const idx = html.indexOf(`id="${navId}"`);
      expect(idx).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });

  test("placeholder screens include home and avatar variants", () => {
    const html = read(indexPath);
    expect(html).toContain('id="placeholder-home" class="placeholder-screen placeholder-screen--home"');
    expect(html).toContain('id="placeholder-courses" class="placeholder-screen placeholder-screen--courses"');
    expect(html).toContain('id="placeholder-saved" class="placeholder-screen placeholder-screen--saved"');
    expect(html).toContain('id="placeholder-ai" class="placeholder-screen placeholder-screen--ai"');
    expect(html).toContain('id="placeholder-avatar" class="placeholder-screen placeholder-screen--avatar"');
  });

  test("placeholder screens include notify input and button", () => {
    const html = read(indexPath);
    const notifyInputs = (html.match(/class="placeholder-notify-input"/g) || []).length;
    const notifyButtons = (html.match(/class="placeholder-notify-btn"/g) || []).length;
    expect(notifyInputs).toBeGreaterThanOrEqual(5);
    expect(notifyButtons).toBeGreaterThanOrEqual(5);
  });

  test("semester modal container exists with close controls", () => {
    const html = read(indexPath);
    expect(html).toContain('id="semester-modal"');
    expect(html).toContain('data-modal-close="backdrop"');
    expect(html).toContain('id="semester-modal-close"');
    expect(html).toContain('id="semester-modal-body"');
  });

  test("cover image assets exist", () => {
    const files = [
      path.join(repoRoot, "frontend", "screen_courses_cover.jpg"),
      path.join(repoRoot, "frontend", "screen_saved_cover.jpg"),
      path.join(repoRoot, "frontend", "screen_aiadvisor_cover.jpg"),
      path.join(repoRoot, "frontend", "screen_plan_cover.jpg"),
      path.join(repoRoot, "frontend", "marquette_logo2.jpg"),
    ];
    for (const file of files) {
      expect(fs.existsSync(file)).toBe(true);
    }
  });

  test("CSS defines rail, app-shell hiding, and directional transitions", () => {
    const css = read(stylePath);
    expect(css).toContain("#rail");
    expect(css).toContain(".rail-link.is-active");
    expect(css).toContain("#app-shell.app-shell-hidden");
    expect(css).toContain(".transition-up");
    expect(css).toContain(".transition-down");
  });

  test("CSS defines placeholder covers for home, avatar, and existing static pages", () => {
    const css = read(stylePath);
    expect(css).toContain(".placeholder-screen--home");
    expect(css).toContain("screen_plan_cover.jpg");
    expect(css).toContain(".placeholder-screen--courses");
    expect(css).toContain("screen_courses_cover.jpg");
    expect(css).toContain(".placeholder-screen--saved");
    expect(css).toContain(".placeholder-screen--avatar");
    expect(css).toContain("screen_saved_cover.jpg");
    expect(css).toContain(".placeholder-screen--ai");
    expect(css).toContain("screen_aiadvisor_cover.jpg");
  });

  test("CSS defines recommendation interactive layout and modal styles", () => {
    const css = read(stylePath);
    expect(css).toContain(".recommendation-interactive");
    expect(css).toContain(".semester-selector");
    expect(css).toContain(".semester-detail-pane");
    expect(css).toContain(".semester-modal");
    expect(css).toContain(".semester-modal-card");
  });

  test("mobile breakpoint collapses rail to bottom bar", () => {
    const css = read(stylePath);
    expect(css).toContain("@media (max-width: 900px)");
    expect(css).toContain("#rail {");
    expect(css).toContain("position: fixed;");
    expect(css).toContain("bottom: 0;");
    expect(css).toContain("grid-template-columns: repeat(6, minmax(0, 1fr));");
  });
});
