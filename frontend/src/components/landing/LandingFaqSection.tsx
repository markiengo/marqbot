"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/shared/Button";

const faqItems = [
  {
    id: "official",
    question: "Is MarqBot official?",
    answer:
      "No. MarqBot is student-built for Marquette Business students. It helps you draft faster. It does not replace official advising or CheckMarq.",
  },
  {
    id: "accuracy",
    question: "How accurate are the recommendations?",
    answer:
      "They are based on mapped degree rules, course relationships, and eligibility checks. That is much better than guesswork. You should still verify the final schedule before registration.",
  },
  {
    id: "advisor",
    question: "Should I still check with my advisor or CheckMarq?",
    answer:
      "Yes. The best use is getting to a good draft faster, then confirming the final decision in the official systems.",
  },
  {
    id: "updates",
    question: "How often do the rules get updated?",
    answer:
      "When mapped Marquette data changes or a planning edge case gets fixed. If you spot something stale, report it.",
  },
  {
    id: "wrong",
    question: "What if MarqBot suggests something wrong?",
    answer:
      "Treat it like a bug report, not your fault. Send the course and program context, then confirm the decision through official advising and CheckMarq.",
  },
] as const;

export function LandingFaqSection() {
  const [openIds, setOpenIds] = useState<string[]>(faqItems[0] ? [faqItems[0].id] : []);

  return (
    <section
      id="faq"
      data-testid="landing-faq"
      className="relative overflow-hidden bg-[linear-gradient(180deg,#09192d_0%,#0a1d34_100%)] py-16 sm:py-20"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(255,204,0,0.08),transparent_24%),radial-gradient(circle_at_84%_16%,rgba(0,114,206,0.06),transparent_28%)]" />

      <div className="relative mx-auto max-w-[72rem] px-5 sm:px-7 lg:px-10">
        <div className="text-center">
          <p className="text-[0.96rem] font-semibold uppercase tracking-[0.24em] text-gold-light">
            FAQ
          </p>
          <h2 className="mt-4 text-[clamp(2.4rem,6vw,4.7rem)] font-bold leading-[0.95] tracking-[-0.04em] text-white">
            Questions before you <span className="text-gold-light">trust it.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-[38rem] text-[1rem] leading-relaxed text-slate-300">
            MarqBot should make planning calmer and stay honest about the final check.
          </p>

          <div className="mt-8 flex justify-center">
            <Button asChild variant="gold" size="lg" className="min-w-[220px] border border-gold/60 shadow-[0_0_28px_rgba(255,204,0,0.16)]">
              <Link href="/about">
                About MarqBot
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-12 space-y-4">
          {faqItems.map((item) => {
            const isOpen = openIds.includes(item.id);
            const buttonId = `faq-button-${item.id}`;
            const panelId = `faq-panel-${item.id}`;

            return (
              <article
                key={item.id}
                className={`overflow-hidden rounded-[1.6rem] border ${
                  isOpen
                    ? "border-gold/22 bg-[linear-gradient(180deg,rgba(255,204,0,0.08),rgba(10,29,53,0.84)_24%,rgba(9,24,44,0.92))]"
                    : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))]"
                }`}
              >
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() =>
                    setOpenIds((current) =>
                      current.includes(item.id)
                        ? current.filter((id) => id !== item.id)
                        : [...current, item.id],
                    )
                  }
                  className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left sm:px-7 sm:py-6"
                >
                  <span className="text-[1.2rem] font-bold leading-tight text-[#b6dcff] sm:text-[1.5rem]">
                    {item.question}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-2xl font-light ${
                      isOpen
                        ? "border-gold/22 bg-gold/10 text-gold-light"
                        : "border-white/10 bg-white/[0.04] text-slate-100"
                    }`}
                  >
                    {isOpen ? "-" : "+"}
                  </span>
                </button>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                  className="grid grid-rows-[1fr] opacity-100 transition-all duration-300"
                >
                  <div className="overflow-hidden">
                    <div className="px-5 pb-5 text-[1.05rem] leading-relaxed text-slate-300 sm:px-7 sm:pb-6 sm:text-[1.2rem]">
                      {item.answer}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
