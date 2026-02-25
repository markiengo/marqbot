import Image from "next/image";

export function Footer() {
  return (
    <footer className="bg-navy text-white/70 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image
              src="/assets/branding/marquette_logo.webp"
              alt="Marquette"
              width={28}
              height={28}
              className="rounded-lg opacity-80"
            />
            <span className="font-[family-name:var(--font-sora)] font-semibold text-white">
              MarqBot
            </span>
          </div>
          <p className="text-sm text-center md:text-right">
            Built for Marquette College of Business students.
            <br className="hidden sm:block" />
            Not an official Marquette University product.
          </p>
        </div>
      </div>
    </footer>
  );
}
