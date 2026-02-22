import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const indexPath = path.join(repoRoot, "frontend", "index.html");
const stylePath = path.join(repoRoot, "frontend", "style.css");

function read(relPath) {
  return fs.readFileSync(relPath, "utf8");
}

describe("v1.6.1 static UI contract", () => {
  test("topbar uses marquette_logo2.jpg", () => {
    const html = read(indexPath);
    expect(html).toContain('src="marquette_logo2.jpg"');
    expect(html).not.toContain('src="marquette-logo.jpg"');
  });

  test("placeholder screens have per-page cover classes", () => {
    const html = read(indexPath);
    expect(html).toContain('id="placeholder-courses" class="placeholder-screen placeholder-screen--courses"');
    expect(html).toContain('id="placeholder-saved" class="placeholder-screen placeholder-screen--saved"');
    expect(html).toContain('id="placeholder-ai" class="placeholder-screen placeholder-screen--ai"');
  });

  test("placeholder screens include notify input and button", () => {
    const html = read(indexPath);
    const notifyInputs = (html.match(/class="placeholder-notify-input"/g) || []).length;
    const notifyButtons = (html.match(/class="placeholder-notify-btn"/g) || []).length;
    expect(notifyInputs).toBeGreaterThanOrEqual(3);
    expect(notifyButtons).toBeGreaterThanOrEqual(3);
  });

  test("cover image assets exist", () => {
    const files = [
      path.join(repoRoot, "frontend", "screen_courses_cover.jpg"),
      path.join(repoRoot, "frontend", "screen_saved_cover.jpg"),
      path.join(repoRoot, "frontend", "screen_aiadvisor_cover.jpg"),
      path.join(repoRoot, "frontend", "marquette_logo2.jpg"),
    ];
    for (const file of files) {
      expect(fs.existsSync(file)).toBe(true);
    }
  });

  test("CSS defines cover backgrounds and blur overlay layers", () => {
    const css = read(stylePath);
    expect(css).toContain('.placeholder-screen--courses');
    expect(css).toContain('screen_courses_cover.jpg');
    expect(css).toContain('.placeholder-screen--saved');
    expect(css).toContain('screen_saved_cover.jpg');
    expect(css).toContain('.placeholder-screen--ai');
    expect(css).toContain('screen_aiadvisor_cover.jpg');
    expect(css).toContain('.placeholder-screen::before');
    expect(css).toContain('.placeholder-screen::after');
    expect(css).toContain('backdrop-filter: blur(8px)');
  });

  test("CSS defines smooth shell/placeholder transition class", () => {
    const css = read(stylePath);
    expect(css).toContain('#app-shell.app-shell-hidden');
    expect(css).toContain('transition: opacity 220ms ease');
  });
});
