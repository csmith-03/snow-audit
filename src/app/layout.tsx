import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "snow-audit",
  description:
    "AI code review for ServiceNow Business Rules, Client Scripts, Script Includes, and UI Actions.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
              snow-audit
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link href="/upload" className="hover:underline">
                Run an audit
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-neutral-200 px-6 py-6 text-center text-xs text-neutral-500 dark:border-neutral-800">
          snow-audit — code review for ServiceNow developers
        </footer>
      </body>
    </html>
  );
}
