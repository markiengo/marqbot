import Image from "next/image";
import Link from "next/link";
import { ABOUT_CONTACT_LINKS } from "@/components/about/aboutContent";
import { ContactIcon } from "@/components/shared/ContactIcon";

type FooterProps = {
  variant?: "default" | "marketing";
};

const marketingColumns = {
  product: [
    { label: "Planner", href: "/planner" },
    { label: "Saved Plans", href: "/saved" },
    { label: "About MarqBot", href: "/about" },
    { label: "Start Planning", href: "/onboarding" },
  ],
};

function DefaultFooter() {
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
                Student-built degree planning. Real rules, clear next moves, zero tab-induced anxiety.
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
          <p>Always double-check with your advisor and CheckMarq before registration.</p>
        </div>
      </div>
    </footer>
  );
}

function MarketingFooter() {
  return (
    <footer
      data-testid="marketing-footer"
      className="relative mt-auto overflow-hidden border-t border-white/10 bg-[linear-gradient(180deg,rgba(3,14,28,0.99),rgba(4,20,37,0.99))] text-slate-300"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,204,0,0.12),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(0,114,206,0.14),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_18%)]" />

      <div className="relative mx-auto max-w-[96rem] px-5 py-14 sm:px-7 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[1.35fr_0.95fr_0.8fr]">
          <div>
            <div className="flex items-center gap-3">
              <Image
                src="/assets/branding/marquette_logo.webp"
                alt="Marquette"
                width={34}
                height={34}
                className="rounded-lg"
              />
              <span className="font-[family-name:var(--font-sora)] text-2xl font-bold text-white">
                MarqBot
              </span>
            </div>
            <p className="mt-5 max-w-[26rem] text-sm leading-relaxed text-slate-300">
              Student-built degree planning for Marquette Business students. Real rules. Clear tradeoffs. Less registration fog.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Student-built", "Not official advising", "Verify before registration"].map((pill) => (
                <span
                  key={pill}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-300"
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white">Product</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {marketingColumns.product.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-slate-300 transition-colors hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white">Connect</h3>
            <div className="mt-4 flex flex-wrap gap-3">
              {ABOUT_CONTACT_LINKS.map((contact) => (
                <a
                  key={contact.href}
                  href={contact.href}
                  target={contact.href.startsWith("mailto:") ? undefined : "_blank"}
                  rel={contact.href.startsWith("mailto:") ? undefined : "noreferrer"}
                  aria-label={`${contact.label}: ${contact.handle}`}
                  className="group flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition-all duration-300 hover:-translate-y-1 hover:border-gold/35 hover:bg-[linear-gradient(140deg,rgba(255,204,0,0.12),rgba(0,114,206,0.10))] hover:text-white"
                >
                  <ContactIcon icon={contact.icon} className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <p>Built for Marquette Business students. Not an official Marquette University product.</p>
          <p>Always confirm the final schedule with CheckMarq and your advisor.</p>
        </div>
      </div>
    </footer>
  );
}

export function Footer({ variant = "default" }: FooterProps) {
  if (variant === "marketing") {
    return <MarketingFooter />;
  }

  return <DefaultFooter />;
}
