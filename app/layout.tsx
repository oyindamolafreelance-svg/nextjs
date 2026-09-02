import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "./_components/Nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LinguaBoard — Translation & Localization Jobs",
  description:
    "A curated, invite-only job board for professional translators and localizers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-6">{children}</main>
        <footer className="mt-8 border-t divider px-6 py-8 text-center text-xs muted">
          <p className="font-semibold text-[color:var(--fg)]">LinguaBoard</p>
          <p className="mt-1">
            A curated board for translation &amp; localization professionals.
          </p>
        </footer>
      </body>
    </html>
  );
}
