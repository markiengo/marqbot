import Image from "next/image";

export function Footer() {
  return (
    <footer className="bg-navy text-white/70 mt-auto relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 60% 80% at 20% 100%, rgba(255, 204, 0, 0.04), transparent), radial-gradient(ellipse 50% 60% at 80% 0%, rgba(0, 114, 206, 0.03), transparent)"
      }} />
      <div className="anchor-gold max-w-7xl mx-auto" />
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
            BUILT FOR MARQUETTE BUSINESS STUDENTS
            <br className="hidden sm:block" />
            Not an official Marquette University product.
          </p>
        </div>
      </div>
    </footer>
  );
}
