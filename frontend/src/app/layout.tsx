import type { Metadata, Viewport } from "next";
import { Sora, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { Navbar } from "@/components/layout/Navbar";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "MarqBot",
  description: "Student-built degree planning for Marquette Business students. Real rules. Clear next moves.",
  applicationName: "MarqBot",
  openGraph: {
    title: "MarqBot",
    description: "Student-built degree planning for Marquette Business students. Real rules. Clear next moves.",
    siteName: "MarqBot",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "MarqBot",
    description: "Student-built degree planning for Marquette Business students. Real rules. Clear next moves.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sora.variable} ${jakarta.variable}`}>
      <body className="min-h-screen bg-orbs">
        <AppProvider>
          <Navbar />
          <main>{children}</main>
        </AppProvider>
      </body>
    </html>
  );
}
