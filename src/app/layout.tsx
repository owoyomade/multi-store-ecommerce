import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
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
  title: { default: "Storefront Studio", template: "%s · Storefront Studio" },
  description: "Launch and run multiple online stores from one dashboard.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Render every page per request. Each response carries a fresh CSP nonce,
  // and a page built ahead of time would have scripts without one, which the
  // browser would then refuse to run.
  await connection();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
