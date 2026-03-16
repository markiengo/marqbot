import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="relative mt-auto overflow-hidden border-t border-white/10 bg-[linear-gradient(180deg,rgba(7,18,39,0.98),rgba(12,29,56,0.95))] text-ink-secondary">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 80% at 15% 100%, rgba(255,204,0,0.08), transparent), radial-gradient(ellipse 50% 60% at 80% 0%, rgba(0,114,206,0.08), transparent)",
        }}
      />
      <div className="mx-auto max-w-[96rem] px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-4">
            <Image
              src="/assets/branding/marquette_logo.webp"
              alt="Marquette"
              width={28}
              height={28}
              className="rounded-lg"
            />
            <div>
              <p className="font-[family-name:var(--font-sora)] text-xl font-semibold text-white">
                MarqBot
              </p>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-secondary">
                Student-built planning for Marquette Business students. Real rules, clearer next moves, less registration archaeology.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link href="/planner" className="rounded-full border border-border-medium bg-surface-card px-4 py-2 font-medium text-ink-primary transition-colors hover:bg-surface-hover">
              Planner
            </Link>
            <Link href="/saved" className="rounded-full border border-border-medium bg-surface-card px-4 py-2 font-medium text-ink-primary transition-colors hover:bg-surface-hover">
              Saved
            </Link>
            <Link href="/about" className="rounded-full border border-border-medium bg-surface-card px-4 py-2 font-medium text-ink-primary transition-colors hover:bg-surface-hover">
              About
            </Link>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-5 text-sm text-ink-faint md:flex-row md:items-center md:justify-between">
          <p>Built for Marquette Business students. Not an official Marquette University product.</p>
          <p>Double-check registration choices with your advisor and CheckMarq.</p>
        </div>
      </div>
    </footer>
  );
}
