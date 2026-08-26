import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import {
  getKindeServerSession,
  LoginLink,
  LogoutLink,
  RegisterLink,
} from "@kinde-oss/kinde-auth-nextjs/server";
import { Logo } from "@/components/Logo";
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { isAuthenticated, getUser } = getKindeServerSession();
  const authed = await isAuthenticated();
  const user = authed ? await getUser() : null;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link
              href="/"
              className="flex items-center gap-2 font-mono text-sm font-semibold tracking-tight"
            >
              <Logo className="h-5 w-5" />
              snow-audit
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link href="/checklist" className="hover:underline">
                What we check
              </Link>
              <Link href="/upload" className="hover:underline">
                Run an audit
              </Link>
              {authed ? (
                <>
                  <span className="text-neutral-500">{user?.email}</span>
                  <LogoutLink className="hover:underline">Sign out</LogoutLink>
                </>
              ) : (
                <>
                  <LoginLink className="hover:underline">Sign in</LoginLink>
                  <RegisterLink className="rounded-lg bg-neutral-900 px-3 py-1.5 font-semibold text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
                    Sign up
                  </RegisterLink>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
        <footer className="border-t border-neutral-200 px-6 py-6 text-center text-xs text-neutral-500 dark:border-neutral-800">
          &copy; {new Date().getFullYear()} snow-audit. All rights reserved.
        </footer>
      </body>
    </html>
  );
}
